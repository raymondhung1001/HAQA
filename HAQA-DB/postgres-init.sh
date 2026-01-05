#!/bin/bash
set -e

echo "Processing SQL templates..."
mkdir -p /tmp/processed-sql

TEMPLATE_DIR="/opt/sql-templates"
PROCESSED_DIR="/tmp/processed-sql"

# Process SQL templates with environment variable substitution
for f in "$TEMPLATE_DIR"/*.sql; do
  filename=$(basename "$f")
  echo "Processing $filename..."
  
  sed "s|##APP_USER_PASSWORD##|${APP_USER_PASSWORD}|g" "$f" > "$PROCESSED_DIR/$filename"
done
echo "SQL templates processed successfully."

echo "Waiting for PostgreSQL to be ready..."
RETRIES=30
until pg_isready -U postgres || [ $RETRIES -eq 0 ]; do
    echo "Waiting for PostgreSQL... ($RETRIES retries left)"
    sleep 1
    RETRIES=$((RETRIES-1))
done

if [ $RETRIES -eq 0 ]; then
    echo "ERROR: PostgreSQL did not become ready in time"
    exit 1
fi

echo "PostgreSQL is ready. Running initialization scripts..."

PSQL="psql -v ON_ERROR_STOP=1 -U postgres -d $POSTGRES_DB"

# Function to run SQL file with error handling
run_sql_file() {
    local file="$1"
    local description="$2"
    
    if [ ! -f "$file" ]; then
        echo "WARNING: SQL file $file not found, skipping..."
        return 0
    fi
    
    echo "Running $description..."
    if $PSQL -f "$file"; then
        echo "✓ $description completed successfully"
    else
        echo "ERROR: Failed to execute $description"
        exit 1
    fi
}

# Run initialization scripts in order
run_sql_file "$PROCESSED_DIR/001-db-init.sql" "Database initialization"

# Install pg_uuidv7 extension after schema is created
run_sql_file "$PROCESSED_DIR/000-install-pg-uuidv7.sql" "pg_uuidv7 extension installation"

run_sql_file "$PROCESSED_DIR/002-sequence-creation.sql" "Sequence creation"
run_sql_file "$PROCESSED_DIR/003-table-creation.sql" "Table creation"
run_sql_file "$PROCESSED_DIR/004-index-creation.sql" "Index creation"
run_sql_file "$PROCESSED_DIR/005-function-creation.sql" "Function creation"
run_sql_file "$PROCESSED_DIR/006-triggers-creation.sql" "Trigger creation"
run_sql_file "$PROCESSED_DIR/007-constraints-validation.sql" "Validation constraints"
run_sql_file "$PROCESSED_DIR/008-foreign-key-indexes.sql" "Foreign key indexes"
run_sql_file "$PROCESSED_DIR/999-grant-public-schema.sql" "Grant permissions"
run_sql_file "$PROCESSED_DIR/9999-data-preparation.sql" "Data preparation"

echo "Database initialization completed successfully."
echo "All tables, indexes, constraints, and triggers have been created."
