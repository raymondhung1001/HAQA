#!/bin/bash
set -e

echo "Starting PostgreSQL with custom initialization..."

mkdir -p /var/lib/postgresql/tablespaces
chown -R postgres:postgres /var/lib/postgresql/tablespaces

/usr/local/bin/docker-entrypoint.sh postgres &

PG_PID=$!

until pg_isready -U postgres -d "$POSTGRES_DB"; do
  echo "Waiting for PostgreSQL to start..."
  sleep 2
done

echo "PostgreSQL started, running initialization scripts..."

execute_sql_with_env() {
    local sql_file=$1
    local username=$2
    
    if [ ! -f "$sql_file" ]; then
        echo "Error: SQL file not found: $sql_file"
        return 1
    fi
    
    echo "Processing and executing SQL file: $sql_file as $username"
    
    cat "$sql_file" | \
        sed -e "s/__DB_SCHEMA__/$DB_SCHEMA/g" \
        -e "s/__DB_NAME__/$POSTGRES_DB/g" \
        -e "s/__POSTGRES_APP_USER__/$POSTGRES_APP_USER/g" \
        -e "s/__POSTGRES_APP_PASSWORD__/$POSTGRES_APP_PASSWORD/g" | \
        psql -v ON_ERROR_STOP=1 --username "$username" --dbname "$POSTGRES_DB"
        
    echo "Completed execution of: $sql_file"
}

echo "Executing schema creation SQL..."
execute_sql_with_env "/scripts/schema-01.sql" "postgres"

echo "Creating admin user and app user..."
execute_sql_with_env "/scripts/schema-02.sql" "postgres"

echo "Inserting initial data..."
execute_sql_with_env "/scripts/data-01.sql" "postgres"

echo "Database initialization completed successfully"

wait $PG_PID