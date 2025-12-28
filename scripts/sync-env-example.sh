#!/usr/bin/env sh

ENV_FILE=".env"
EXAMPLE_FILE=".env.example"

[ ! -f "$ENV_FILE" ] && exit 0
[ ! -f "$EXAMPLE_FILE" ] && touch "$EXAMPLE_FILE"

ENV_VARS=$(grep -E '^[A-Za-z_][A-Za-z0-9_]*=' "$ENV_FILE" 2>/dev/null | cut -d'=' -f1 | sort -u)
EXAMPLE_VARS=$(grep -E '^[A-Za-z_][A-Za-z0-9_]*=' "$EXAMPLE_FILE" 2>/dev/null | cut -d'=' -f1 | sort -u)

MISSING_VARS=""
UPDATED=false

for var in $ENV_VARS; do
  if ! echo "$EXAMPLE_VARS" | grep -q "^${var}$"; then
    VALUE=$(grep -E "^${var}=" "$ENV_FILE" | cut -d'=' -f2- | head -n1)
    if [ -z "$VALUE" ] || echo "$VALUE" | grep -qiE "(secret|key|password|token|private|api_key|apikey)"; then
      VALUE=""
    fi
    echo "" >> "$EXAMPLE_FILE"
    echo "$var=$VALUE" >> "$EXAMPLE_FILE"
    MISSING_VARS="${MISSING_VARS}${var}\n"
    UPDATED=true
  fi
done

if [ "$UPDATED" = true ]; then
  git add "$EXAMPLE_FILE"
fi

exit 0
