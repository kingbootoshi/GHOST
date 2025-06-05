#!/usr/bin/env bash
# chat.sh – quick test for /chat

# Load vars from ghost-worker/.env (if present)
ENV_FILE="$(dirname "$0")/.env"
[[ -f $ENV_FILE ]] && export $(grep -v '^#' "$ENV_FILE" | xargs)

TOKEN=${SUPA_TOKEN:-}
PROMPT=${1:-"Hello!"}
URL=${2:-"http://localhost:8787/chat"}

if [[ -z $TOKEN ]]; then
  echo "SUPA_TOKEN missing – add it to ghost-worker/.env" >&2
  exit 1
fi

curl -N "$URL" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"messages\":[{\"role\":\"user\",\"content\":\"$PROMPT\"}]}"