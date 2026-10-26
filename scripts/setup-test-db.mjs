import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
let pg;
try {
  pg = require("pg");
} catch {
  pg = require("../apps/tutoring/node_modules/pg");
}

const { Client } = pg;
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const migrationsDir = path.resolve(__dirname, "../supabase/migrations");
const knownProductionProjectRef = "ofaraxqrpcdiregxjyyb";

function validateTarget() {
  const connectionString = process.env.SUPABASE_TEST_DB_URL;
  const projectRef = process.env.SUPABASE_TEST_PROJECT_REF;
  if (!connectionString || !projectRef) {
    throw new Error("Set SUPABASE_TEST_DB_URL and SUPABASE_TEST_PROJECT_REF for a dedicated test project.");
  }
  if (process.env.SUPABASE_TEST_ENV !== "isolated" || process.env.APPLY_TEST_MIGRATIONS !== "true") {
    throw new Error("Refusing to migrate without SUPABASE_TEST_ENV=isolated and APPLY_TEST_MIGRATIONS=true.");
  }
  if (!/^[a-z0-9]{20}$/.test(projectRef)) {
    throw new Error("SUPABASE_TEST_PROJECT_REF must be a 20-character lowercase alphanumeric project ref.");
  }
  if (projectRef === knownProductionProjectRef || projectRef === process.env.SUPABASE_PRODUCTION_PROJECT_REF) {
    throw new Error("Refusing to run migrations against the configured production project.");
  }

  let target;
  try {
    target = new URL(connectionString);
  } catch {
    throw new Error("SUPABASE_TEST_DB_URL is not a valid PostgreSQL connection URL.");
  }
  if (target.protocol !== "postgres:" && target.protocol !== "postgresql:") {
    throw new Error("SUPABASE_TEST_DB_URL must use the postgres:// protocol.");
  }
  if (target.hostname !== `db.${projectRef}.supabase.co` || target.pathname !== "/postgres") {
    throw new Error("Database host does not match the explicitly configured Supabase test project ref.");
  }
  return { connectionString, projectRef };
}

async function assertSupabaseAuthPrerequisites(client) {
  const result = await client.query(`
    SELECT
      to_regclass('auth.users') IS NOT NULL AS has_users,
      to_regclass('auth.identities') IS NOT NULL AS has_identities,
      to_regprocedure('auth.uid()') IS NOT NULL AS has_uid,
      to_regprocedure('auth.jwt()') IS NOT NULL AS has_jwt,
      to_regprocedure('auth.role()') IS NOT NULL AS has_role,
      EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') AS has_anon,
      EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') AS has_authenticated,
      EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') AS has_service_role
  `);
  const state = result.rows[0];
  if (Object.values(state).some((value) => value !== true)) {
    throw new Error("Target is not a Supabase project with its managed Auth schema and roles. No stubs will be created.");
  }
}

async function main() {
  const { connectionString, projectRef } = validateTarget();
  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: true },
    connectionTimeoutMillis: 15000,
  });

  try {
    await client.connect();
    const identity = await client.query("SELECT current_database() AS db, current_user AS role");
    if (identity.rows[0]?.db !== "postgres" || identity.rows[0]?.role !== "postgres") {
      throw new Error("Connect using the dedicated test project's postgres database owner.");
    }
    await assertSupabaseAuthPrerequisites(client);

    const historyExists = await client.query("SELECT to_regclass('codex_test_migrations.applied') IS NOT NULL AS exists");
    let appliedCount = 0;
    if (historyExists.rows[0].exists) {
      const history = await client.query("SELECT count(*)::int AS count FROM codex_test_migrations.applied");
      appliedCount = history.rows[0].count;
    }
    if (appliedCount === 0) {
      const existing = await client.query(`
        SELECT count(*)::int AS count
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p')
      `);
      if (existing.rows[0].count > 0) {
        throw new Error("The target public schema is not empty. Use a fresh, dedicated Supabase test project.");
      }
    }

    await client.query("CREATE SCHEMA IF NOT EXISTS codex_test_migrations");
    await client.query("REVOKE ALL ON SCHEMA codex_test_migrations FROM PUBLIC");
    await client.query(`
      CREATE TABLE IF NOT EXISTS codex_test_migrations.applied (
        version text PRIMARY KEY,
        file_name text NOT NULL,
        applied_at timestamptz NOT NULL DEFAULT now()
      )
    `);

    const files = fs.readdirSync(migrationsDir).filter((file) => file.endsWith(".sql")).sort();
    if (files.length === 0) throw new Error("No SQL migrations were found.");
    console.log(`Applying project migrations to isolated test project ${projectRef} (${files.length} files).`);

    for (const file of files) {
      // The repository currently contains multiple historical SQL files that
      // share the same timestamp prefix. Key the private setup ledger by the
      // complete filename so none are silently skipped or collide.
      const version = file.slice(0, -4);
      const alreadyApplied = await client.query(
        "SELECT 1 FROM codex_test_migrations.applied WHERE version = $1",
        [version]
      );
      if (alreadyApplied.rowCount) continue;

      const sql = fs.readFileSync(path.join(migrationsDir, file), "utf8").replace(/^\uFEFF/, "");
      await client.query("BEGIN");
      try {
        await client.query(sql);
        await client.query(
          "INSERT INTO codex_test_migrations.applied (version, file_name) VALUES ($1, $2)",
          [version, file]
        );
        await client.query("COMMIT");
        console.log(`Applied ${file}`);
      } catch (error) {
        await client.query("ROLLBACK");
        throw new Error(`Migration ${file} failed; stopped without skipping it: ${error.message}`);
      }
    }

    const rls = await client.query(`
      SELECT c.relname AS table_name
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p') AND NOT c.relrowsecurity
      ORDER BY c.relname
    `);
    if (rls.rowCount > 0) {
      throw new Error(`RLS is disabled on public tables: ${rls.rows.map((row) => row.table_name).join(", ")}`);
    }

    const requiredTables = [
      "tenants", "users", "students", "groups", "sessions", "study_materials",
      "message_templates", "quizzes", "homework_submissions", "teachers", "assistants",
      "rooms", "email_verifications", "whatsapp_connections", "gift_codes",
      "short_links", "whatsapp_inbox", "meta_portal_dispatch_queue", "tenant_platform_settings",
    ];
    const tableCheck = await client.query(
      "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name = ANY($1::text[])",
      [requiredTables]
    );
    const foundTables = new Set(tableCheck.rows.map((row) => row.table_name));
    const missingTables = requiredTables.filter((table) => !foundTables.has(table));
    if (missingTables.length > 0) {
      throw new Error(`Required tables missing after migrations: ${missingTables.join(", ")}`);
    }

    const requiredRpcs = [
      "public.get_user_profile(uuid)",
      "public.get_email_by_phone(text)",
      "public.get_emails_by_phone(text)",
      "public.get_student_for_portal(text)",
      "public.get_student_for_portal(text,text)",
      "public.confirm_user_email_direct(text)",
      "public.is_email_confirmed(text)",
      "public.record_email_otp(text,text,timestamptz)",
      "public.resolve_portal_short_code(text)",
      "public.submit_homework_portal(text,uuid,text,text)",
      "public.submit_homework_portal(text,uuid,text,text,uuid)",
      "public.verify_homework_target(uuid,uuid)",
    ];
    const rpcCheck = await client.query(
      "SELECT signature FROM unnest($1::text[]) AS signatures(signature) WHERE to_regprocedure(signature) IS NOT NULL",
      [requiredRpcs]
    );
    const foundRpcs = new Set(rpcCheck.rows.map((row) => row.signature));
    const missingRpcs = requiredRpcs.filter((signature) => !foundRpcs.has(signature));
    if (missingRpcs.length > 0) {
      throw new Error(`Required security RPCs missing after migrations: ${missingRpcs.join(", ")}`);
    }

    const publicAccess = await client.query(`
      SELECT c.relname AS object_name
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p')
        AND (
          has_table_privilege('anon', c.oid, 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
          OR has_table_privilege('authenticated', c.oid, 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
        )
      ORDER BY c.relname
    `);
    if (publicAccess.rowCount > 0) {
      throw new Error(`Direct table grants remain for anon/authenticated: ${publicAccess.rows.map((row) => row.object_name).join(", ")}`);
    }

    const applied = await client.query("SELECT count(*)::int AS count FROM codex_test_migrations.applied");
    if (applied.rows[0].count !== files.length) {
      throw new Error(`Migration history mismatch: expected ${files.length}, found ${applied.rows[0].count}.`);
    }
    console.log(`Success: all ${files.length} migrations applied and RLS is enabled on every public table.`);
    console.log("This database matches the repository migration set; it does not certify production parity.");
  } finally {
    await client.end().catch(() => {});
  }
}

main().catch((error) => {
  console.error(`Test database setup failed: ${error.message}`);
  process.exitCode = 1;
});
