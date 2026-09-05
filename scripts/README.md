# Centrly Database Security & Backups (DEV-25)

## Overview
This module handles database security, least-privilege access verification, and automated daily table backups with **AES-256-GCM in-memory encryption** and **live PostgreSQL restore verification**.

## Required Secrets & Environment Variables
- `BACKUP_ENCRYPTION_KEY`: **CRITICAL** AES-256 secret key.
  - **Action Required for Founder (Mohaned):** Must be added to GitHub Repository Secrets (`Settings -> Secrets and variables -> Actions -> New repository secret`).
  - To generate a secure 256-bit key:
    ```bash
    openssl rand -hex 32
    ```
- `SUPABASE_URL`: Production Supabase API URL.
- `SUPABASE_SERVICE_ROLE_KEY`: Scoped service role key for automated backup extraction.
- `RESTORE_DATABASE_URL`: Connection string for the scratch PostgreSQL instance during restoration testing (configured automatically in GitHub Actions service container).

## Scripts
- `backup-crypto.mjs`: Core cryptographic module providing AES-256-GCM authenticated encryption and decryption. Ensures zero plaintext backup files touch disk.
- `backup-db.mjs`: Queries all application tables from Supabase, serializes in memory, encrypts with AES-256-GCM, and writes an encrypted `.json.enc` snapshot to `backups/`.
- `decrypt-db.mjs`: Authenticated decryption utility for disaster recovery drills. Takes `.json.enc` snapshots, verifies auth tags, and outputs decrypted JSON.
- `test-restore.mjs`: Real database restore engine. Decrypts the backup, connects to a scratch PostgreSQL database, applies schema migrations, bulk-inserts rows, queries them back, and verifies row counts and field diffs (100% round-trip proof).

## Routine Usage
```bash
# 1. Perform automated or manual encrypted backup
BACKUP_ENCRYPTION_KEY="your-secret-key" node scripts/backup-db.mjs

# 2. Verify decryption
BACKUP_ENCRYPTION_KEY="your-secret-key" node scripts/decrypt-db.mjs

# 3. Execute real PostgreSQL restore test
BACKUP_ENCRYPTION_KEY="your-secret-key" RESTORE_DATABASE_URL="postgres://user:pass@localhost:5432/testdb" node scripts/test-restore.mjs
```

## GitHub Actions Automated Pipeline
The `.github/workflows/daily-backup.yml` workflow runs daily at 02:00 AM UTC:
1. Backs up database from Supabase and encrypts directly in memory with AES-256-GCM.
2. Uploads strictly the encrypted artifact (`backups/*.json.enc`) to GitHub Actions storage (30-day retention).
3. Executes a decryption verification step.
4. Spins up a disposable PostgreSQL service container, applies schema migrations, restores all rows, and asserts 100% round-trip data integrity.