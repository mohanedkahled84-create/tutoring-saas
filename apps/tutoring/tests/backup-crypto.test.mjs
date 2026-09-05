import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import {
  encryptBackupData,
  decryptBackupData,
  decryptBackupFile,
  getBackupEncryptionKey,
} from "../../../scripts/backup-crypto.mjs";

test("DEV-25: Backup Encryption Key Derivation", () => {
  const originalKey = process.env.BACKUP_ENCRYPTION_KEY;

  delete process.env.BACKUP_ENCRYPTION_KEY;
  assert.throws(
    () => getBackupEncryptionKey(),
    /BACKUP_ENCRYPTION_KEY environment variable is missing/,
    "Should throw error when BACKUP_ENCRYPTION_KEY is missing"
  );

  process.env.BACKUP_ENCRYPTION_KEY = "my-secret-passphrase-12345";
  const key = getBackupEncryptionKey();
  assert.equal(key.length, 32, "Key should be derived to exactly 32 bytes");

  // Restore
  if (originalKey) {
    process.env.BACKUP_ENCRYPTION_KEY = originalKey;
  }
});

test("DEV-25: AES-256-GCM Encryption and Decryption Round-Trip", () => {
  process.env.BACKUP_ENCRYPTION_KEY = "test-encryption-key-for-dev25-unit-test";

  const originalData = {
    metadata: {
      timestamp: new Date().toISOString(),
      project: "Centrly Tutoring SaaS",
    },
    tables: {
      students: {
        rows_count: 2,
        rows: [
          { id: "s1", name: "أحمد محمود", parent_phone: "01012345678" },
          { id: "s2", name: "سارة خالد", parent_phone: "01123456789" },
        ],
      },
    },
  };

  const encryptedBuffer = encryptBackupData(originalData);
  assert(Buffer.isBuffer(encryptedBuffer), "Result should be a Buffer");
  assert(encryptedBuffer.length > 28, "Buffer should contain IV (12B) + Tag (16B) + ciphertext");

  const decryptedData = decryptBackupData(encryptedBuffer);
  assert.deepEqual(decryptedData, originalData, "Decrypted data must match original exactly");
});

test("DEV-25: Tamper Resistance (GCM Auth Tag Failure)", () => {
  process.env.BACKUP_ENCRYPTION_KEY = "test-encryption-key-for-dev25-unit-test";

  const originalData = { sensitive: "student-pii-data" };
  const encryptedBuffer = encryptBackupData(originalData);

  // Flip a byte in the ciphertext payload
  const tamperedBuffer = Buffer.from(encryptedBuffer);
  tamperedBuffer[tamperedBuffer.length - 1] ^= 0xff;

  assert.throws(
    () => decryptBackupData(tamperedBuffer),
    /unable to authenticate|Unsupported state|auth/i,
    "Tampered buffer should be rejected by authenticated cipher"
  );
});

test("DEV-25: File Decryption Support (.json.enc)", () => {
  process.env.BACKUP_ENCRYPTION_KEY = "test-encryption-key-for-dev25-unit-test";

  const sampleData = { test_file: true, count: 42 };
  const encryptedBuffer = encryptBackupData(sampleData);

  const tempFilePath = path.join(os.tmpdir(), `test_backup_${Date.now()}.json.enc`);
  fs.writeFileSync(tempFilePath, encryptedBuffer);

  try {
    const readData = decryptBackupFile(tempFilePath);
    assert.deepEqual(readData, sampleData, "File decrypt should match original");
  } finally {
    if (fs.existsSync(tempFilePath)) {
      fs.unlinkSync(tempFilePath);
    }
  }
});