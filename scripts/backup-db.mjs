import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getServiceSupabaseClient } from "../apps/tutoring/dist/supabase.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const backupsDir = path.resolve(__dirname, "../backups");

if (!fs.existsSync(backupsDir)) {
  fs.mkdirSync(backupsDir, { recursive: true });
}

export async function performDatabaseBackup() {
  const supabase = getServiceSupabaseClient();
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupFileName = `supabase_backup_${timestamp}.json`;
  const backupFilePath = path.join(backupsDir, backupFileName);

  console.log(`[BackupEngine] Starting automated database backup at ${new Date().toISOString()}...`);

  // Core tables to backup
  const tables = [
    "tenants",
    "users",
    "students",
    "groups",
    "group_students",
    "sessions",
    "attendance",
    "quiz_scores",
    "payment_proofs",
    "message_logs",
    "whatsapp_connections",
  ];

  const backupData = {
    metadata: {
      timestamp: new Date().toISOString(),
      project_id: "ofaraxqrpcdiregxjyyb",
      engine: "Antigravity Automated Backup System",
      tables_count: tables.length,
    },
    tables: {},
  };

  for (const table of tables) {
    const { data, error } = await supabase.from(table).select("*");
    if (error) {
      console.warn(`[BackupEngine] Warning: Failed to dump table ${table}: ${error.message}`);
      backupData.tables[table] = { status: "error", error: error.message };
    } else {
      backupData.tables[table] = {
        status: "success",
        rows_count: data ? data.length : 0,
        rows: data || [],
      };
      console.log(`[BackupEngine] Dumped ${table}: ${data ? data.length : 0} rows`);
    }
  }

  fs.writeFileSync(backupFilePath, JSON.stringify(backupData, null, 2), "utf-8");
  console.log(`[BackupEngine] Backup successfully written to: ${backupFilePath}`);

  return backupFilePath;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  performDatabaseBackup()
    .then((file) => {
      console.log(`[BackupEngine] Completed successfully: ${file}`);
      process.exit(0);
    })
    .catch((err) => {
      console.error("[BackupEngine] Backup failed:", err);
      process.exit(1);
    });
}
