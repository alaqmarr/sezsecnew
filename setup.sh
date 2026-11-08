#!/usr/bin/env bash
# ==============================================================================
# SEZSEC Members, Finance & Khidmat Portal (sezsecnew) — Setup & Build Script
# ==============================================================================
# Target Port       : 3334
# Companion Bridge  : http://127.0.0.1:3333 (sezinv / jamatevents)
#
# Usage:
#   chmod +x setup.sh
#   ./setup.sh
# ==============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "======================================================================"
echo "  SEZSEC Members, Finance & Khidmat Portal (Port 3334) — Setup & Build"
echo "  Working directory: $SCRIPT_DIR"
echo "======================================================================"

# 1. Pre-flight Runtime Checks
if ! command -v node >/dev/null 2>&1; then
  echo "[ERROR] Node.js is not installed. Please install Node.js v20 or newer." >&2
  exit 1
fi

if ! command -v npm >/dev/null 2>&1; then
  echo "[ERROR] npm is not installed. Please install npm along with Node.js." >&2
  exit 1
fi

NODE_VERSION="$(node -v)"
NODE_MAJOR="$(node -p "process.versions.node.split('.')[0]")"
NPM_VERSION="$(npm -v)"

if [ "$NODE_MAJOR" -lt 20 ]; then
  echo "[ERROR] Node.js v20+ is required (detected $NODE_VERSION)." >&2
  exit 1
fi

echo "[1/6] Runtime verified: Node.js $NODE_VERSION, npm v$NPM_VERSION"

# 2. Environment (.env) Provisioning & Sibling Bridge Key Discovery
if [ ! -f ".env" ]; then
  echo "[2/6] Creating .env from template with cryptographic secrets..."
  if [ -f ".env.example" ]; then
    cp ".env.example" ".env"
  else
    cat > ".env" <<'EOF'
DATABASE_URL="file:./data/sezsecnew.db"
NEON_DATABASE_URL=""
AUTH_SECRET="replace-with-strong-random-secret"
SEZSEC_BRIDGE_KEY="replace-with-strong-shared-bridge-key"
JAMATEVENTS_INTERNAL_URL="http://127.0.0.1:3333"
NEXT_PUBLIC_JAMATEVENTS_URL="http://localhost:3333"
NEXT_PUBLIC_APP_URL="http://localhost:3334"
SMTP_EMAIL="info@sezsec.org"
SMTP_PASSWORD=""
UPI_ID="dbjtsez@idfcbank"
UPI_PAYEE_NAME="Shabab Ul Eidiz Zahabi"
EOF
  fi

  node <<'NODE_EOF'
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

let envText = fs.readFileSync(".env", "utf8");

// Attempt to reuse SEZSEC_BRIDGE_KEY from sibling ../sezinv/.env or ../jamatevents/.env
let sharedBridgeKey = "";
for (const rel of ["../sezinv/.env", "../jamatevents/.env"]) {
  const candidate = path.resolve(process.cwd(), rel);
  if (fs.existsSync(candidate)) {
    const raw = fs.readFileSync(candidate, "utf8");
    const m = raw.match(/^\s*SEZSEC_BRIDGE_KEY\s*=\s*"?([^"#\r\n]+)"?/m);
    if (m && m[1].trim() && !m[1].includes("replace-with")) {
      sharedBridgeKey = m[1].trim();
      break;
    }
  }
}

const replacePlaceholder = (key, placeholder, explicitValue) => {
  const secret = explicitValue || crypto.randomBytes(32).toString("hex");
  const pattern = new RegExp(`^(${key}=)"?${placeholder}"?`, "m");
  if (pattern.test(envText)) {
    envText = envText.replace(pattern, `$1"${secret}"`);
  }
};

replacePlaceholder("AUTH_SECRET", "replace-with-strong-random-secret");
replacePlaceholder(
  "SEZSEC_BRIDGE_KEY",
  "replace-with-strong-shared-bridge-key",
  sharedBridgeKey
);

fs.writeFileSync(".env", envText, { mode: 0o600 });
if (sharedBridgeKey) {
  console.log("      Matched SEZSEC_BRIDGE_KEY from sibling Bookings app (.env).");
}
NODE_EOF
  chmod 600 ".env" 2>/dev/null || true
  echo "      Created and secured .env (mode 600)."
else
  chmod 600 ".env" 2>/dev/null || true
  echo "[2/6] Existing .env found — preserving configuration."
fi

# 3. Install Dependencies
echo "[3/6] Installing project dependencies..."
if [ "${1:-}" = "--ci" ] || [ ! -d "node_modules" ]; then
  if [ -f "package-lock.json" ]; then
    npm ci --no-audit --no-fund || npm install --no-audit --no-fund
  else
    npm install --no-audit --no-fund
  fi
else
  npm install --no-audit --no-fund
fi

# 4. Sanction Database Directory, Setup Schema & Enforce SQLite WAL Pragmas
echo "[4/6] Sanctioning SQLite database and applying Prisma schema..."

DB_FILE_PATH="$(node <<'NODE_EOF'
require("dotenv/config");
const path = require("node:path");
const rawUrl = (process.env.DATABASE_URL || "file:./data/sezsecnew.db").trim();
if (rawUrl === ":memory:") {
  process.stdout.write(":memory:");
} else {
  const stripped = rawUrl.replace(/^file:/, "");
  const resolved = path.isAbsolute(stripped)
    ? stripped
    : path.resolve(process.cwd(), stripped);
  process.stdout.write(resolved);
}
NODE_EOF
)"

if [ "$DB_FILE_PATH" != ":memory:" ]; then
  DB_DIR="$(dirname "$DB_FILE_PATH")"
  mkdir -p "$DB_DIR" "${DB_DIR}/uploads" "${DB_DIR}/backups"
  chmod 700 "$DB_DIR" "${DB_DIR}/backups" 2>/dev/null || true
  echo "      Sanctioned database & uploads directory: $DB_DIR"
fi

echo "      Generating Prisma client..."
npx prisma generate

echo "      Applying database schema (non-destructive)..."
npx prisma db push

echo "      Enforcing SQLite WAL mode, relational constraints & default modules..."
npx tsx prisma/sanction-db.ts --sync-neon

if [ "$DB_FILE_PATH" != ":memory:" ]; then
  for f in "$DB_FILE_PATH" "${DB_FILE_PATH}-wal" "${DB_FILE_PATH}-shm"; do
    if [ -f "$f" ]; then
      chmod 600 "$f" 2>/dev/null || true
    fi
  done
fi

# 5. TypeScript Verification
echo "[5/6] Running Next.js route type generation & TypeScript check..."
npx next typegen
npx tsc --noEmit
echo "      TypeScript check passed with 0 errors."

# 6. Production Build
echo "[6/6] Running optimized Next.js production build..."
npm run build

echo "======================================================================"
echo "  Setup & Build Completed Successfully!"
echo "  Start production server (port 3334) : npm run start"
echo "  Start with PM2                      : PORT=3334 pm2 start npm --name sezsecnew -- start"
echo "======================================================================"
