import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { decryptBackupFile, getBackupEncryptionKey } from "./backup-crypto.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const backupsDir = path.resolve(__dirname, "../backups");

export async function executeDecryption(targetFile, outputFile) {
  // Ensure encryption key is present
  getBackupEncryptionKey();

  let fileToDecrypt = targetFile;
  if (!fileToDecrypt) {
    if (!fs.existsSync(backupsDir)) {
      throw new Error(`Backups directory does not exist: ${backupsDir}`);
    }
    const files = fs.readdirSync(backupsDir).filter((f) => f.endsWith(".json.enc"));
    if (files.length === 0) {
      throw new Error(`No encrypted backup files (.json.enc) found in ${backupsDir}`);
    }
    files.sort().reverse();
    fileToDecrypt = path.join(backupsDir, files[0]);
  }

  console.log(`[DecryptEngine] Decrypting backup file: ${fileToDecrypt}...`);
  const decryptedData = decryptBackupFile(fileToDecrypt);

  console.log(`[DecryptEngine] Decryption successful!`);
  console.log(`[DecryptEngine] Engine: ${decryptedData.metadata?.engine || "Unknown"}`);
  console.log(`[DecryptEngine] Timestamp: ${decryptedData.metadata?.timestamp}`);
  console.log(`[DecryptEngine] Tables present: ${Object.keys(decryptedData.tables || {}).length}`);

  if (outputFile) {
    fs.writeFileSync(outputFile, JSON.stringify(decryptedData, null, 2), "utf-8");
    console.log(`[DecryptEngine] Decrypted data written to: ${outputFile}`);
  }

  return decryptedData;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const target = process.argv[2];
  const output = process.argv[3];

  executeDecryption(target, output)
    .then(() => {
      console.log("[DecryptEngine] Decrypt verification completed successfully.");
      process.exit(0);
    })
    .catch((err) => {
      console.error("[DecryptEngine] Decrypt failed:", err.message);
      process.exit(1);
    });
}