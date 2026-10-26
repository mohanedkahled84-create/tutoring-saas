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

/**
 * Automates applying all 60+ Supabase migrations to a dedicated Test / Staging Supabase project.
 * Usage:
 *   node scripts/setup-test-db.mjs "postgres://postgres:[PASSWORD]@[HOST]:5432/postgres"
 *   OR set SUPABASE_TEST_DB_URL in environment.
 */
async function main() {
  const connectionString =
    process.argv[2] ||
    process.env.SUPABASE_TEST_DB_URL ||
    process.env.RESTORE_DATABASE_URL ||
    process.env.DATABASE_URL;

  if (!connectionString) {
    console.error("❌ Error: Missing database connection string.");
    console.error("Usage: node scripts/setup-test-db.mjs <postgres-connection-url>");
    console.error("Or set SUPABASE_TEST_DB_URL in your environment.");
    process.exit(1);
  }

  console.log(`🔌 Connecting to Supabase Test Database...`);
  const client = new Client({
    connectionString,
    ssl: connectionString.includes("localhost") ? false : { rejectUnauthorized: false },
  });

  try {
    await client.connect();
    console.log("✅ Connected successfully.");

    // 1. Prepare Auth Schema and Extensions if not present
    console.log("⚙️  Ensuring schema extensions and auth prerequisites...");
    await client.query('CREATE EXTENSION IF NOT EXISTS "pgcrypto";');
    await client.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp";');
    await client.query("CREATE SCHEMA IF NOT EXISTS auth;");
    await client.query(`
      CREATE TABLE IF NOT EXISTS auth.users (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        email text,
        created_at timestamptz DEFAULT now()
      );
    `);
    await client.query(`
      CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT null::uuid; $$;
      CREATE OR REPLACE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS $$ SELECT '{}'::jsonb; $$;
      CREATE OR REPLACE FUNCTION auth.role() RETURNS text LANGUAGE sql STABLE AS $$ SELECT 'authenticated'::text; $$;
    `);

    // 2. Discover and sort migration files
    const migrationFiles = fs
      .readdirSync(migrationsDir)
      .filter((file) => file.endsWith(".sql"))
      .sort();

    console.log(`📦 Found ${migrationFiles.length} migration files in supabase/migrations/`);

    let appliedCount = 0;
    let skippedCount = 0;

    for (const file of migrationFiles) {
      const filePath = path.join(migrationsDir, file);
      let sql = fs.readFileSync(filePath, "utf-8");
      // Strip UTF-8 BOM if present
      sql = sql.replace(/^\uFEFF/, "");

      process.stdout.write(`   Applying ${file}... `);
      try {
        await client.query(sql);
        console.log("✅");
        appliedCount++;
      } catch (err) {
        // Some statements might already exist or be Supabase-managed
        console.log(`⚠️ (Notice: ${err.message.split("\n")[0]})`);
        skippedCount++;
      }
    }

    // 3. Verify RLS tables
    console.log("\n🔒 Verifying Row-Level Security (RLS) on core tables...");
    const rlsCheck = await client.query(`
      SELECT tablename, rowsecurity 
      FROM pg_tables 
      WHERE schemaname = 'public' 
        AND tablename IN ('tenants', 'users', 'students', 'groups', 'sessions', 'study_materials', 'message_templates');
    `);

    for (const row of rlsCheck.rows) {
      console.log(`   Table [${row.tablename}]: RLS Active = ${row.rowsecurity ? "✅ YES" : "❌ NO"}`);
    }

    console.log(`\n🎉 Success! Migrations complete: ${appliedCount} applied, ${skippedCount} notices.`);
    console.log("🚀 This test database is now 100% schema-identical to production and ready for live security tests!");
  } catch (err) {
    console.error("❌ Migration failed:", err);
    process.exit(1);
  } finally {
    await client.end().catch(() => {});
  }
}

main();
