#!/bin/bash
# Guarded apply of 0015_invite_delivery_binding with real PRAGMA pre/post-checks.
# Same reviewer-cleared convention as 0013/0014: fail-closed on missing expected
# columns, unexpected columns reported never removed, retry is a strict no-op,
# schema_migrations tracking row written only after postcheck passes, with a
# truthful note. Usage: TARGET=local|remote PERSIST=<dir> ./apply-0015-guarded.sh
set -euo pipefail
cd ~/portal
TARGET="${TARGET:-local}"
PERSIST="${PERSIST:-/tmp/rp/portal/.wrangler/state}"
SQL_FILE="drizzle/0015_invite_delivery_binding.sql"
TAG="0015_invite_delivery_binding"
NOTE="adds member_invite_tokens.delivery (emailed|pending_send|legacy) for invite delivery binding; legacy default labels pre-existing manually-issued rows"
if [ "$TARGET" = "remote" ]; then
  W="npx wrangler d1 execute al-waili-portal-d1 --remote --json"
else
  W="npx wrangler d1 execute DB --local --json --config dist/server/wrangler.json --persist-to $PERSIST"
fi
COLS=$($W --command "SELECT name FROM pragma_table_info('member_invite_tokens')" 2>/dev/null | jq -r '.[0].results[].name' | sort | tr '\n' ' ')
echo "precheck columns: $COLS"
for c in id member_id token_hash email expires_at created_by; do echo "$COLS" | grep -qw "$c" || { echo "MISSING expected column $c — abort (fail-closed)"; exit 1; }; done
EXTRA=$(echo "$COLS" | tr ' ' '\n' | grep -v -w -e id -e member_id -e token_hash -e email -e expires_at -e consumed_at -e created_by -e delivery -e '^$' | tr '\n' ' ' || true)
[ -n "$EXTRA" ] && echo "NOTE unexpected columns preserved for review: $EXTRA"
if echo "$COLS" | grep -qw delivery; then echo "delivery present — no-op"; else
  if [ "$TARGET" = "remote" ]; then
    npx wrangler d1 execute al-waili-portal-d1 --remote --file "$SQL_FILE" >/dev/null 2>&1 || { echo "apply failed"; exit 1; }
  else
    npx wrangler d1 execute DB --local --config dist/server/wrangler.json --persist-to "$PERSIST" --file "$SQL_FILE" >/dev/null 2>&1 || { echo "apply failed"; exit 1; }
  fi
  echo "applied"
fi
POST=$($W --command "SELECT name FROM pragma_table_info('member_invite_tokens')" 2>/dev/null | jq -r '.[0].results[].name' | sort | tr '\n' ' ')
echo "postcheck columns: $POST"
echo "$POST" | grep -qw delivery || { echo "POSTCHECK FAILED: delivery absent"; exit 1; }
echo "postcheck delivery values:"
$W --command "SELECT delivery, COUNT(*) n FROM member_invite_tokens GROUP BY delivery" 2>/dev/null | jq -c '.[0].results'
$W --command "CREATE TABLE IF NOT EXISTS schema_migrations (tag TEXT PRIMARY KEY, applied_at TEXT NOT NULL DEFAULT (datetime('now')), note TEXT NOT NULL)" >/dev/null 2>&1 || { echo "schema_migrations ensure failed"; exit 1; }
ALREADY=$($W --command "SELECT COUNT(*) n FROM schema_migrations WHERE tag='$TAG'" 2>/dev/null | jq -r '.[0].results[0].n')
if [ "$ALREADY" = "0" ]; then
  $W --command "INSERT INTO schema_migrations(tag, applied_at, note) VALUES('$TAG', datetime('now'), '$NOTE')" 2>/dev/null | jq -c '.[0].success // .' && echo "tracking row written"
else
  echo "tracking row already present — no-op"
fi
