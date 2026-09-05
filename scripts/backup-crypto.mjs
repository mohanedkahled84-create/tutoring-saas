import crypto from "node:crypto";
import fs from "node:fs";

/**
 * DEV-25: AES-256-GCM Backup Encryption & Decryption Engine
 * Provides authenticated symmetric encryption for all database snapshots.
 *
 * Binary Format:
 * [12 bytes IV] + [16 bytes Auth Tag] + [N bytes Ciphertext]
 */

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12; // 96 bits recommended for GCM
const AUTH_TAG_LENGTH = 16; // 128 bits authentication tag

/**
 * Derives a 32-byte (256-bit) encryption key buffer from BACKUP_ENCRYPTION_KEY.
 * Guarantees exactly 32 bytes via SHA-256 derivation.
 */
export function getBackupEncryptionKey() {
  const secret = process.env.BACKUP_ENCRYPTION_KEY;
  if (!secret || secret.trim().length === 0) {
    throw new Error(
      "BACKUP_ENCRYPTION_KEY environment variable is missing or empty. " +
      "It is required for encrypting/decrypting backups with AES-256-GCM. " +
      "Please set BACKUP_ENCRYPTION_KEY in your GitHub Repository Secrets or local environment."
    );
  }

  return crypto.createHash("sha256").update(secret.trim()).digest();
}

/**
 * Encrypts arbitrary backup data (object or string) with AES-256-GCM.
 * Plaintext is processed purely in memory and never touches disk.
 *
 * @param {object|string} data - Plaintext backup data
 * @param {Buffer} [keyBuffer] - Optional 32-byte key buffer (derived from env if omitted)
 * @returns {Buffer} Encrypted binary buffer (IV + AuthTag + Ciphertext)
 */
export function encryptBackupData(data, keyBuffer = getBackupEncryptionKey()) {
  if (keyBuffer.length !== 32) {
    throw new Error("Invalid encryption key length: expected 32 bytes for AES-256.");
  }

  const jsonString = typeof data === "string" ? data : JSON.stringify(data);
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, keyBuffer, iv);

  const ciphertext = Buffer.concat([
    cipher.update(jsonString, "utf8"),
    cipher.final(),
  ]);

  const authTag = cipher.getAuthTag();

  // Combine IV (12B) + AuthTag (16B) + Ciphertext
  return Buffer.concat([iv, authTag, ciphertext]);
}

/**
 * Decrypts an encrypted binary backup buffer using AES-256-GCM.
 * Validates integrity via the authentication tag; rejects any tampered or corrupted bytes.
 *
 * @param {Buffer} encryptedBuffer - Encrypted binary buffer
 * @param {Buffer} [keyBuffer] - Optional 32-byte key buffer (derived from env if omitted)
 * @returns {object} Parsed JSON backup data
 */
export function decryptBackupData(encryptedBuffer, keyBuffer = getBackupEncryptionKey()) {
  if (keyBuffer.length !== 32) {
    throw new Error("Invalid encryption key length: expected 32 bytes for AES-256.");
  }

  if (encryptedBuffer.length < IV_LENGTH + AUTH_TAG_LENGTH) {
    throw new Error("Corrupted backup: buffer length is shorter than required encryption headers.");
  }

  const iv = encryptedBuffer.subarray(0, IV_LENGTH);
  const authTag = encryptedBuffer.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const ciphertext = encryptedBuffer.subarray(IV_LENGTH + AUTH_TAG_LENGTH);

  const decipher = crypto.createDecipheriv(ALGORITHM, keyBuffer, iv);
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]);

  const jsonString = decrypted.toString("utf8");
  return JSON.parse(jsonString);
}

/**
 * Reads an encrypted backup file from disk and decrypts it into memory.
 *
 * @param {string} filePath - Path to .json.enc backup file
 * @param {Buffer} [keyBuffer] - Optional 32-byte key buffer
 * @returns {object} Parsed JSON backup data
 */
export function decryptBackupFile(filePath, keyBuffer = getBackupEncryptionKey()) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Backup file not found: ${filePath}`);
  }

  const fileBuffer = fs.readFileSync(filePath);
  return decryptBackupData(fileBuffer, keyBuffer);
}