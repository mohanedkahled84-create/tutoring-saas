import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getServiceSupabaseClient } from "../apps/tutoring/dist/supabase.js";
import { encryptBackupData, getBackupEncryptionKey } from "./backup-crypto.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const backupsDir = path.resolve(__dirname, "../backups");

if (!fs.existsSync(backupsDir)) {
  fs.mkdirSync(backupsDir, { recursive: true });
}

export async function performDatabaseBackup() {
  // Ensure encryption key is configured before starting any database work
  getBackupEncryptionKey();

  const supabase = getServiceSupabaseClient();
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupFileName = `supabase_backup_${timestamp}.json.enc`;
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
    "activity_logs",
    "teachers",
    "assistants",
    "rooms",
    "enrollments",
    "teacher_payouts",
  ];

  const backupData = {
    metadata: {
      timestamp: new Date().toISOString(),
      project_id: "ofaraxqrpcdiregxjyyb",
      engine: "Centrly AES-256-GCM Authenticated Backup Engine",
      tables_count: tables.length,
      format_version: "2.0-encrypted",
      cipher: "aes-256-gcm",
    },
    tables: {},
  };

  for (const table of tables) {
    try {
      const { data, error } = await supabase.from(table).select("*");
      if (error) {
        console.warn(`[BackupEngine] Notice: Table '${table}' returned: ${error.message}`);
        backupData.tables[table] = { status: "skipped", error: error.message };
      } else {
        backupData.tables[table] = {
          status: "success",
          rows_count: data ? data.length : 0,
          rows: data || [],
        };
        console.log(`[BackupEngine] Dumped ${table}: ${data ? data.length : 0} rows`);
      }
    } catch (err) {
      console.warn(`[BackupEngine] Failed to query table '${table}': ${err.message}`);
      backupData.tables[table] = { status: "error", error: err.message };
    }
  }

  // Pure in-memory encryption: AES-256-GCM
  console.log("[BackupEngine] Encrypting database snapshot with AES-256-GCM in memory...");
  const encryptedBuffer = encryptBackupData(backupData);

  // Directly write encrypted file (.json.enc). No plaintext touches disk.
  fs.writeFileSync(backupFilePath, encryptedBuffer);
  console.log(`[BackupEngine] Encrypted backup successfully written to: ${backupFilePath} (${encryptedBuffer.length} bytes)`);

  return backupFilePath;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  performDatabaseBackup()
    .then((file) => {
      console.log(`[BackupEngine] Backup completed successfully: ${file}`);
      process.exit(0);
    })
    .catch((err) => {
      console.error("[BackupEngine] Backup failed:", err);
      process.exit(1);
    });
}