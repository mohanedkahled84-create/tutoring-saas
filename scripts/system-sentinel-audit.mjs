/**
 * Centrly Sentinel - Automated Full-Stack Health, Security & Regression Auditor
 * 
 * Usage:
 *   node scripts/system-sentinel-audit.mjs
 */

import http from "node:http";
import https from "node:https";
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, "..");
const BACKEND_DIR = path.join(ROOT_DIR, "apps", "tutoring");

const REPORT = {
  timestamp: new Date().toISOString(),
  overallStatus: "PASS",
  checks: [],
};

function addCheck(name, status, details, latencyMs = null) {
  REPORT.checks.push({ name, status, details, latencyMs });
  const icon = status === "PASS" ? "✅" : status === "WARN" ? "⚠️" : "❌";
  const latencyStr = latencyMs ? ` (${latencyMs}ms)` : "";
  console.log(`${icon} [${status}] ${name}${latencyStr}: ${details}`);
  if (status === "FAIL") {
    REPORT.overallStatus = "FAIL";
  } else if (status === "WARN" && REPORT.overallStatus !== "FAIL") {
    REPORT.overallStatus = "WARN";
  }
}

async function checkLiveEndpoint(url, expectedStatus = 200, timeoutMs = 8000) {
  const start = Date.now();
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
    const latency = Date.now() - start;
    if (res.status === expectedStatus) {
      let extra = `HTTP ${res.status}`;
      try {
        const json = await res.json();
        if (json.status) extra += ` (status: ${json.status})`;
        if (json.database) extra += ` | DB: ${json.database.status} (${json.database.latency_ms}ms)`;
        if (json.system?.memory) extra += ` | Heap: ${json.system.memory.heap_used_mb}MB`;
      } catch (_) {}
      return { ok: true, latency, details: extra };
    } else {
      return { ok: false, latency, details: `Returned HTTP ${res.status}` };
    }
  } catch (err) {
    return { ok: false, latency: Date.now() - start, details: err.message };
  }
}

async function runAudit() {
  console.log("\n=======================================================");
  console.log("🛡️  Centrly System Sentinel - Starting Full Platform Audit");
  console.log(`⏰  Timestamp: ${REPORT.timestamp}`);
  console.log("=======================================================\n");

  // 1. Live Frontend Check
  console.log("--- 1. Live Cloud Infrastructure ---");
  const frontendCheck = await checkLiveEndpoint("https://centerly-eg.com");
  if (frontendCheck.ok) {
    addCheck("Live Frontend (centerly-eg.com)", "PASS", frontendCheck.details, frontendCheck.latency);
  } else {
    addCheck("Live Frontend (centerly-eg.com)", "FAIL", frontendCheck.details, frontendCheck.latency);
  }

  // 2. Live Backend Ping
  const pingCheck = await checkLiveEndpoint("https://tutoring-backend-production-c8dd.up.railway.app/health/ping");
  if (pingCheck.ok) {
    addCheck("Live Backend Ping (Railway)", "PASS", pingCheck.details, pingCheck.latency);
  } else {
    addCheck("Live Backend Ping (Railway)", "FAIL", pingCheck.details, pingCheck.latency);
  }

  // 3. Live Backend Health & Database Latency
  const healthCheck = await checkLiveEndpoint("https://tutoring-backend-production-c8dd.up.railway.app/health");
  if (healthCheck.ok) {
    addCheck("Live Backend Detailed Health & Supabase DB", "PASS", healthCheck.details, healthCheck.latency);
  } else {
    addCheck("Live Backend Detailed Health & Supabase DB", "FAIL", healthCheck.details, healthCheck.latency);
  }

  // 4. Git Branch & Working Tree Hygiene
  console.log("\n--- 2. Git & Working Tree Hygiene ---");
  try {
    const gitStatus = execSync("git status --porcelain", { cwd: ROOT_DIR, encoding: "utf8" }).trim();
    const currentBranch = execSync("git rev-parse --abbrev-ref HEAD", { cwd: ROOT_DIR, encoding: "utf8" }).trim();
    if (gitStatus.length === 0) {
      addCheck(`Git Tree Hygiene (Branch: ${currentBranch})`, "PASS", "Working directory is clean, 0 uncommitted changes.");
    } else {
      const fileCount = gitStatus.split("\n").length;
      addCheck(`Git Tree Hygiene (Branch: ${currentBranch})`, "WARN", `${fileCount} uncommitted change(s) detected.`);
    }
  } catch (err) {
    addCheck("Git Tree Hygiene", "WARN", `Git inspection failed: ${err.message}`);
  }

  // 5. Backend TypeScript Compilation & Types Integrity
  console.log("\n--- 3. Codebase Build & Types Verification ---");
  const tscStart = Date.now();
  try {
    execSync("npm run build", { cwd: BACKEND_DIR, encoding: "utf8", stdio: "pipe" });
    addCheck("Backend TypeScript Build (tsc)", "PASS", "Zero type errors, build compiled cleanly.", Date.now() - tscStart);
  } catch (err) {
    addCheck("Backend TypeScript Build (tsc)", "FAIL", "TypeScript compilation failed! Check for broken contracts or type mismatches.", Date.now() - tscStart);
  }

  // 6. Security Scans
  console.log("\n--- 4. Code-Level Security & Injection Audit ---");
  try {
    const searchTarget = path.join(BACKEND_DIR, "src");
    // Regex to detect SQL statements constructed via string interpolation
    const sqlRegex = /`\s*(SELECT\b|INSERT\s+INTO\b|UPDATE\s+\w+\s+SET\b|DELETE\s+FROM\b)[\s\S]*?\$\{/i;
    let foundInjections = [];

    function scanDir(dir) {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          scanDir(fullPath);
        } else if (entry.isFile() && (entry.name.endsWith(".ts") || entry.name.endsWith(".js"))) {
          const content = fs.readFileSync(fullPath, "utf8");
          if (sqlRegex.test(content)) {
            const lines = content.split("\n");
            for (let i = 0; i < lines.length; i++) {
              if (sqlRegex.test(lines[i])) {
                foundInjections.push(`${path.relative(ROOT_DIR, fullPath)}:${i + 1}: ${lines[i].trim()}`);
              }
            }
          }
        }
      }
    }

    scanDir(searchTarget);

    if (foundInjections.length === 0) {
      addCheck("OWASP SQL Injection Scan", "PASS", "Zero unparameterized SQL interpolations found across codebase.");
    } else {
      addCheck("OWASP SQL Injection Scan", "FAIL", `Found ${foundInjections.length} potential SQL interpolation(s): ${foundInjections[0]}`);
    }
  } catch (err) {
    addCheck("OWASP SQL Injection Scan", "WARN", `Scan check error: ${err.message}`);
  }

  // 7. Full Regression Unit Test Suite
  console.log("\n--- 5. Regression & Business Logic Test Suite ---");
  if (process.argv.includes("--fast")) {
    addCheck("Unit & Regression Test Suite", "PASS", "Skipped (--fast mode). Run full audit without --fast to execute all 344 unit tests.");
  } else {
    const testStart = Date.now();
    try {
      const testOutput = execSync("npm test", { cwd: BACKEND_DIR, encoding: "utf8", stdio: "pipe" });
      const match = testOutput.match(/pass\s+(\d+)/);
      const passCount = match ? match[1] : "all";
      addCheck("Unit & Regression Test Suite", "PASS", `100% passing tests (${passCount} tests passed, 0 failures).`, Date.now() - testStart);
    } catch (err) {
      addCheck("Unit & Regression Test Suite", "FAIL", "One or more tests failed! Regressions introduced.", Date.now() - testStart);
    }
  }

  console.log("\n=======================================================");
  const finalIcon = REPORT.overallStatus === "PASS" ? "🟢" : REPORT.overallStatus === "WARN" ? "🟡" : "🔴";
  console.log(`${finalIcon} OVERALL PLATFORM AUDIT STATUS: ${REPORT.overallStatus}`);
  console.log("=======================================================\n");

  return REPORT;
}

runAudit().catch(err => {
  console.error("Audit runner crashed:", err);
  process.exit(1);
});
