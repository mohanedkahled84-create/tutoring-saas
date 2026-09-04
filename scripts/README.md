# Centrly Database Security & Backups (DEV-25)

## Overview
This module handles database least-privilege security and automated daily table backups with integrity validation.

## Scripts
- `backup-db.mjs`: Dumps all 11 core application tables from Supabase into timestamped JSON snapshots in `backups/`.
- `test-restore.mjs`: Tests restoration readiness and structural integrity of the latest or specified backup snapshot.

## Routine Usage
```bash
# Perform manual or automated cron backup
node scripts/backup-db.mjs

# Verify and test backup integrity
node scripts/test-restore.mjs
```
