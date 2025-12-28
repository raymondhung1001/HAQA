#!/bin/bash
set -e

echo "Processing SQL templates..."
mkdir -p /tmp/processed-sql

TEMPLATE_DIR="/opt/sql-templates"
PROCESSED_DIR="/tmp/processed-sql"

for f in "$TEMPLATE_DIR"/*.sql; do
  filename=$(basename "$f")
  echo "Processing $filename..."
  
  sed "s|##APP_USER_PASSWORD##|${APP_USER_PASSWORD}|g" "$f" > "$PROCESSED_DIR/$filename"
done
echo "SQL templates processed successfully."

echo "Waiting for PostgreSQL to be ready..."
until pg_isready -U postgres; do
  sleep 1
done

echo "PostgreSQL is ready. Running initialization scripts..."

PSQL="psql -v ON_ERROR_STOP=1 -U postgres -d $POSTGRES_DB"

$PSQL -f "$PROCESSED_DIR/001-db-init.sql"

# Install pg_uuidv7 extension after schema is created (if the SQL file exists)
if [ -f "$PROCESSED_DIR/000-install-pg-uuidv7.sql" ]; then
    $PSQL -f "$PROCESSED_DIR/000-install-pg-uuidv7.sql"
fi
$PSQL -f "$PROCESSED_DIR/002-sequence-creation.sql"
$PSQL -f "$PROCESSED_DIR/003-table-creation.sql"
$PSQL -f "$PROCESSED_DIR/004-index-creation.sql"
$PSQL -f "$PROCESSED_DIR/005-function-creation.sql"
$PSQL -f "$PROCESSED_DIR/999-grant-public-schema.sql"
$PSQL -f "$PROCESSED_DIR/9999-data-preparation.sql"

echo "Database initialization completed successfully."
