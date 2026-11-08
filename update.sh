#!/usr/bin/env bash
# ==============================================================================
# SEZSEC Members, Finance & Khidmat Portal (sezsecnew) — Production Update Script
# ==============================================================================
# Target Environment : Oracle Ubuntu Server
# PM2 Instance Name  : sezsecnew (override with PM2_APP_NAME)
# Application Port   : 3334      (override with APP_PORT)
# Loopback Bridge    : http://127.0.0.1:3333 (sezinv)
#
# Usage:
#   ./update.sh
#   bash update.sh
# ==============================================================================

set -euo pipefail

main() {
  local SCRIPT_DIR
  SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
  cd "$SCRIPT_DIR"

  local PM2_APP_NAME="${PM2_APP_NAME:-sezsecnew}"
  local APP_PORT="${APP_PORT:-3334}"
  local GIT_REMOTE="${GIT_REMOTE:-origin}"
  local GIT_BRANCH="${GIT_BRANCH:-}"

  echo "======================================================================"
  echo "  SEZSEC Members Portal ($PM2_APP_NAME) — Production Update & Deploy"
  echo "  Directory    : $SCRIPT_DIR"
  echo "  PM2 Instance : $PM2_APP_NAME (port $APP_PORT)"
  echo "======================================================================"

  # 1. Pre-flight Runtime & Tool Checks
  for cmd in git node npm; do
    if ! command -v "$cmd" >/dev/null 2>&1; then
      echo "[ERROR] Required command '$cmd' is not installed or not in PATH." >&2
      exit 1
    fi
  done

  if ! command -v pm2 >/dev/null 2>&1; then
    echo "[ERROR] PM2 is not installed or not in PATH. Install with: npm install -g pm2" >&2
    exit 1
  fi

  local NODE_VERSION NODE_MAJOR NPM_VERSION
  NODE_VERSION="$(node -v)"
  NODE_MAJOR="$(node -p "process.versions.node.split('.')[0]")"
  NPM_VERSION="$(npm -v)"

  if [ "$NODE_MAJOR" -lt 20 ]; then
    echo "[ERROR] Node.js v20+ is required (detected $NODE_VERSION)." >&2
    exit 1
  fi

  echo "[1/8] Runtime verified: Node.js $NODE_VERSION, npm v$NPM_VERSION, pm2 v$(pm2 -v)"

  if [ ! -f ".env" ]; then
    echo "      [WARN] .env not found — running initial environment bootstrap..."
    if [ -f ".env.example" ]; then
      cp ".env.example" ".env"
    fi
  fi
  chmod 600 ".env" 2>/dev/null || true

  # Resolve SQLite database path from .env
  local DB_FILE_PATH
  DB_FILE_PATH="$(node <<'NODE_EOF'
try {
  require("dotenv/config");
} catch (_) {
  const fs = require("node:fs");
  if (fs.existsSync(".env")) {
    for (const line of fs.readFileSync(".env", "utf8").split(/\r?\n/)) {
      const m = line.match(/^\s*DATABASE_URL\s*=\s*"?([^"#\r\n]+)"?/);
      if (m) process.env.DATABASE_URL = m[1].trim();
    }
  }
}
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

  # 2. Pre-Update SQLite Hot Backup
  if [ "$DB_FILE_PATH" != ":memory:" ] && [ -f "$DB_FILE_PATH" ] && [ "${SEZSEC_BACKUP_DONE:-0}" != "1" ]; then
    local DB_DIR BACKUP_DIR TIMESTAMP BACKUP_FILE
    DB_DIR="$(dirname "$DB_FILE_PATH")"
    BACKUP_DIR="${DB_DIR}/backups"
    TIMESTAMP="$(date +%Y%m%d-%H%M%S)"
    BACKUP_FILE="${BACKUP_DIR}/sezsecnew-${TIMESTAMP}.db"

    mkdir -p "$BACKUP_DIR"
    chmod 700 "$BACKUP_DIR" 2>/dev/null || true

    echo "[2/8] Creating pre-update SQLite backup..."
    if DB_SRC="$DB_FILE_PATH" DB_DST="$BACKUP_FILE" node -e '
      const Database = require("better-sqlite3");
      const db = new Database(process.env.DB_SRC, { readonly: true });
      db.backup(process.env.DB_DST)
        .then(() => { db.close(); process.exit(0); })
        .catch((err) => { console.error(err); db.close(); process.exit(1); });
    ' >/dev/null 2>&1; then
      echo "      Atomic online backup saved: $BACKUP_FILE"
    elif command -v sqlite3 >/dev/null 2>&1; then
      sqlite3 "$DB_FILE_PATH" ".backup '$BACKUP_FILE'"
      echo "      SQLite CLI backup saved: $BACKUP_FILE"
    else
      cp -p "$DB_FILE_PATH" "$BACKUP_FILE"
      if [ -f "${DB_FILE_PATH}-wal" ]; then
        cp -p "${DB_FILE_PATH}-wal" "${BACKUP_FILE}-wal"
      fi
      echo "      File copy backup saved: $BACKUP_FILE"
    fi
    chmod 600 "$BACKUP_FILE" 2>/dev/null || true

    ls -1t "${BACKUP_DIR}"/sezsecnew-*.db 2>/dev/null | tail -n +11 | while IFS= read -r old_bak; do
      rm -f "$old_bak" "${old_bak}-wal" "${old_bak}-shm"
    done
  else
    echo "[2/8] Pre-update SQLite backup complete (or fresh database)."
  fi

  # 3. Fetch & Sync Latest Code from GitHub
  if [ -z "$GIT_BRANCH" ]; then
    GIT_BRANCH="$(git rev-parse --abbrev-ref HEAD)"
    if [ "$GIT_BRANCH" = "HEAD" ] || [ -z "$GIT_BRANCH" ]; then
      GIT_BRANCH="master"
    fi
  fi

  local PRE_HEAD POST_HEAD LOCAL_DIRTY
  PRE_HEAD="$(git rev-parse HEAD)"

  echo "[3/8] Fetching latest changes from GitHub ($GIT_REMOTE/$GIT_BRANCH)..."
  git fetch --prune "$GIT_REMOTE" "$GIT_BRANCH"

  git checkout -- setup.sh update.sh 2>/dev/null || true
  LOCAL_DIRTY="$(git status --porcelain --untracked-files=no)"
  if [ -n "$LOCAL_DIRTY" ]; then
    echo "      Stashing local tracked changes before syncing to $GIT_REMOTE/$GIT_BRANCH..."
    git stash push -m "sezsecnew-pre-update-$(date +%Y%m%d-%H%M%S)" >/dev/null 2>&1 || true
  fi

  git reset --hard "${GIT_REMOTE}/${GIT_BRANCH}"
  chmod +x setup.sh update.sh 2>/dev/null || true

  POST_HEAD="$(git rev-parse HEAD)"
  if [ "$PRE_HEAD" = "$POST_HEAD" ]; then
    echo "      Already at latest commit: $(git rev-parse --short HEAD)"
  else
    echo "      Updated $(git rev-parse --short "$PRE_HEAD") -> $(git rev-parse --short "$POST_HEAD")"
    git --no-pager log --oneline "${PRE_HEAD}..${POST_HEAD}" | sed 's/^/        /'

    if [ "${SEZSEC_UPDATE_REEXEC:-0}" != "1" ] && git diff --name-only "$PRE_HEAD" "$POST_HEAD" -- update.sh | grep -q '^update\.sh$'; then
      echo "      update.sh was updated from GitHub — reloading updated script..."
      SEZSEC_UPDATE_REEXEC=1 SEZSEC_BACKUP_DONE=1 exec bash "$SCRIPT_DIR/update.sh" "$@"
    fi
  fi

  # 4. Install / Update Dependencies
  echo "[4/8] Installing npm dependencies..."
  npm install --no-audit --no-fund

  # 5. Prisma Client, Schema Sync & Database Sanctioning
  echo "[5/8] Generating Prisma client, syncing schema & sanctioning SQLite DB..."
  if [ "$DB_FILE_PATH" != ":memory:" ]; then
    local DB_DIR_ENSURE
    DB_DIR_ENSURE="$(dirname "$DB_FILE_PATH")"
    mkdir -p "$DB_DIR_ENSURE" "${DB_DIR_ENSURE}/uploads" "${DB_DIR_ENSURE}/backups"
    chmod 700 "$DB_DIR_ENSURE" "${DB_DIR_ENSURE}/backups" 2>/dev/null || true
  fi

  npx prisma generate
  npx prisma db push
  npx tsx prisma/sanction-db.ts

  if [ "$DB_FILE_PATH" != ":memory:" ]; then
    for f in "$DB_FILE_PATH" "${DB_FILE_PATH}-wal" "${DB_FILE_PATH}-shm"; do
      if [ -f "$f" ]; then
        chmod 600 "$f" 2>/dev/null || true
      fi
    done
  fi

  # 6. TypeScript Check & Production Next.js Build
  echo "[6/8] Running Next.js route typegen & TypeScript verification..."
  npx next typegen
  npx tsc --noEmit
  echo "      TypeScript check passed (0 errors)."

  echo "[7/8] Building optimized Next.js production bundle..."
  npm run build

  # 7. Restart / Provision PM2 Instance (`sezsecnew` on Port 3334)
  echo "[8/8] Restarting PM2 instance '$PM2_APP_NAME' on port $APP_PORT..."
  if pm2 describe "$PM2_APP_NAME" >/dev/null 2>&1; then
    PORT="$APP_PORT" NODE_ENV="production" pm2 restart "$PM2_APP_NAME" --update-env
  else
    echo "      PM2 process '$PM2_APP_NAME' not found — creating new instance on port $APP_PORT..."
    PORT="$APP_PORT" NODE_ENV="production" pm2 start npm --name "$PM2_APP_NAME" --cwd "$SCRIPT_DIR" -- start -- -p "$APP_PORT"
  fi

  pm2 save >/dev/null 2>&1 || pm2 save

  # Verify HTTP readiness on 127.0.0.1:3334
  if command -v curl >/dev/null 2>&1; then
    local READY=0
    local HTTP_CODE=""
    for _ in 1 2 3 4 5 6 7 8 9 10 11 12; do
      HTTP_CODE="$(curl -s -o /dev/null -w "%{http_code}" "http://127.0.0.1:${APP_PORT}/login" || true)"
      if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "307" ] || [ "$HTTP_CODE" = "302" ]; then
        READY=1
        echo "      Readiness check passed: http://127.0.0.1:${APP_PORT}/login -> HTTP $HTTP_CODE"
        break
      fi
      sleep 1
    done
    if [ "$READY" -ne 1 ]; then
      echo "      [WARN] Port $APP_PORT did not return HTTP 200 within 12s (last status: ${HTTP_CODE:-none})."
      echo "             Inspect logs with: pm2 logs $PM2_APP_NAME --lines 50"
    fi
  fi

  pm2 status "$PM2_APP_NAME"

  echo "======================================================================"
  echo "  Update Completed Successfully!"
  echo "  Commit       : $(git rev-parse --short HEAD)"
  echo "  PM2 Instance : $PM2_APP_NAME"
  echo "  Port         : $APP_PORT"
  echo "======================================================================"
}

main "$@"
exit 0
