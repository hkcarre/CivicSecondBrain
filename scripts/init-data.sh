#!/bin/sh
# init-data.sh — Initializes the /data volume with wiki skeleton files
# if they don't already exist. Runs before npm start on every boot.

WIKI_DIR="${WIKI_PATH:-/data/wiki}"
RAW_DIR="${RAW_SOURCES_PATH:-/data/raw-sources}"

mkdir -p "$WIKI_DIR" "$RAW_DIR"

# Copy seed files only if not already present on the volume
if [ ! -f "$WIKI_DIR/index.md" ]; then
  echo "🗂  Initializing wiki skeleton on volume..."
  cp /app/wiki-seed/SCHEMA.md "$WIKI_DIR/SCHEMA.md"
  cp /app/wiki-seed/index.md  "$WIKI_DIR/index.md"
  echo "✓ Wiki skeleton initialized at $WIKI_DIR"
else
  echo "✓ Wiki already initialized at $WIKI_DIR"
fi
