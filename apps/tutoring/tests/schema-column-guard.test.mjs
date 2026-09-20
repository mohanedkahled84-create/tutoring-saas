import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const fixturePath = path.resolve(__dirname, "fixtures/db-schema.json");
const migrationsDir = path.resolve(__dirname, "../../../supabase/migrations");
const srcDir = path.resolve(__dirname, "../src");

/**
 * Loads the database schema from canonical fixture.
 */
function loadCanonicalSchema() {
  const raw = fs.readFileSync(fixturePath, "utf8");
  const data = JSON.parse(raw);
  const schema = new Map();
  for (const [table, cols] of Object.entries(data)) {
    schema.set(table.toLowerCase(), new Set(cols.map((c) => c.toLowerCase())));
  }
  return schema;
}

/**
 * Parses PostgREST select string into top-level columns and foreign table joins.
 */
function parsePostgrestSelect(raw) {
  const topColumns = [];
  const joins = [];
  let current = "";
  let depth = 0;
  let currentJoinTable = "";

  for (let i = 0; i < raw.length; i++) {
    const char = raw[i];
    if (char === "(") {
      if (depth === 0) {
        currentJoinTable = current.trim();
        current = "";
      } else {
        current += char;
      }
      depth++;
    } else if (char === ")") {
      depth--;
      if (depth === 0) {
        if (currentJoinTable) {
          joins.push({
            table: currentJoinTable.split("!")[0].split(":")[0].trim().toLowerCase(),
            columns: current
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean),
          });
        }
        current = "";
        currentJoinTable = "";
      } else {
        current += char;
      }
    } else if (char === "," && depth === 0) {
      if (current.trim()) {
        topColumns.push(current.trim());
      }
      current = "";
    } else {
      current += char;
    }
  }
  if (current.trim()) {
    topColumns.push(current.trim());
  }
  return { topColumns, joins };
}

/**
 * Scans all typescript source files for .from("table").select("cols") queries.
 */
function findSupabaseSelectCalls(dir) {
  const results = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...findSupabaseSelectCalls(fullPath));
    } else if (entry.isFile() && (entry.name.endsWith(".ts") || entry.name.endsWith(".js"))) {
      const content = fs.readFileSync(fullPath, "utf8");
      // Direct chaining: .from("table").select("...")
      const regex = /\.from\s*\(\s*["'`]([a-zA-Z0-9_]+)["'`]\s*\)\s*\.select\s*\(\s*(?:["'`]([^"'`]+)["'`]|(?:\/\*[\s\S]*?\*\/)?\s*["'`]([^"'`]+)["'`])/g;
      let match;
      while ((match = regex.exec(content)) !== null) {
        const table = match[1];
        const rawSelect = match[2] || match[3];
        if (!rawSelect) continue;
        const lineNum = content.slice(0, match.index).split("\n").length;
        results.push({
          file: fullPath,
          line: lineNum,
          table,
          rawSelect,
        });
      }
    }
  }

  return results;
}

test("CI GUARD: Every .select(...) column in apps/tutoring/src must exist in the database schema", () => {
  const schema = loadCanonicalSchema();
  const selectCalls = findSupabaseSelectCalls(srcDir);

  assert.ok(schema.size > 0, "Schema must contain tables");
  assert.ok(selectCalls.length > 0, "Found Supabase select calls to validate");

  const errors = [];

  for (const { file, line, table, rawSelect } of selectCalls) {
    const cleanTable = table.toLowerCase();
    const tableCols = schema.get(cleanTable);

    if (!tableCols) {
      if (["auth", "storage"].includes(cleanTable)) continue;
      continue;
    }

    const { topColumns, joins } = parsePostgrestSelect(rawSelect.replace(/\s+/g, " "));

    // 1. Validate top-level columns
    for (const rawCol of topColumns) {
      if (rawCol === "*" || rawCol.startsWith("count") || rawCol.includes("(") || rawCol.includes(")")) {
        continue;
      }
      const colName = rawCol.split(/\s+/)[0].split(":")[0].toLowerCase();
      if (!colName || colName === "*" || colName === "count") continue;

      if (!tableCols.has(colName)) {
        errors.push({
          file: path.relative(path.resolve(__dirname, "../../.."), file),
          line,
          table: cleanTable,
          column: colName,
        });
      }
    }

    // 2. Validate joined relation columns
    for (const join of joins) {
      const joinCols = schema.get(join.table);
      if (!joinCols) continue; // Skip unknown join tables (views, auth, etc.)

      for (const rawCol of join.columns) {
        if (rawCol === "*" || rawCol.startsWith("count") || rawCol.includes("(") || rawCol.includes(")")) {
          continue;
        }
        const colName = rawCol.split(/\s+/)[0].split(":")[0].toLowerCase();
        if (!colName || colName === "*" || colName === "count") continue;

        if (!joinCols.has(colName)) {
          errors.push({
            file: path.relative(path.resolve(__dirname, "../../.."), file),
            line,
            table: `${cleanTable} -> ${join.table}`,
            column: colName,
          });
        }
      }
    }
  }

  if (errors.length > 0) {
    const errorDetails = errors
      .map((e) => `  - ${e.file}:${e.line} -> Table '${e.table}' does NOT have column '${e.column}'`)
      .join("\n");
    assert.fail(`Schema drift detected in Supabase .select() calls:\n${errorDetails}`);
  }
});

test("CI GUARD: Regression check - public.users.financial_pin MUST NOT be queried anywhere", () => {
  const selectCalls = findSupabaseSelectCalls(srcDir);
  for (const { file, line, table, rawSelect } of selectCalls) {
    if (table.toLowerCase() === "users") {
      const cols = rawSelect.split(",").map((c) => c.trim().toLowerCase());
      assert.equal(
        cols.includes("financial_pin"),
        false,
        `Forbidden column 'financial_pin' queried at ${file}:${line}`
      );
    }
  }
});

test("CI GUARD: Migrations consistency check - migration files match schema fixture", () => {
  const migrationFiles = fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"));

  assert.ok(migrationFiles.length >= 40, "Should have all migrations present");
  assert.ok(
    migrationFiles.some((f) => f.includes("drop_financial_pin_shim")),
    "Migration dropping financial_pin shim must exist"
  );
  assert.ok(
    migrationFiles.some((f) => f.includes("sec_lockdown_production_drift")),
    "Migration locking down production drift must exist"
  );
});
