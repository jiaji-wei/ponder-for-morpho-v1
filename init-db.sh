#!/bin/bash
set -e

echo "Initializing Morpho Ponder database..."

# Database is already created by POSTGRES_DB env var
# This script can be used for additional initialization if needed

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
    -- Grant privileges
    GRANT ALL PRIVILEGES ON DATABASE lending_master TO ponder;
    
    -- Create extensions if needed
    -- CREATE EXTENSION IF NOT EXISTS pg_trgm;
    -- CREATE EXTENSION IF NOT EXISTS btree_gin;
    
    SELECT 'Database initialized successfully' AS status;
EOSQL

echo "Database initialization completed."
