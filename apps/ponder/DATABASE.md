# Database Management Guide

## Schema Management

Ponder uses PostgreSQL **schemas** (not to be confused with Ponder schema definitions) to isolate different apps in the same database.

### Default Behavior

- **Schema name**: Automatically derived from project name (default: `morpho_blue`)
- **Migration**: Ponder automatically migrates schema when table definitions change
- **Isolation**: Each Ponder app uses its own PostgreSQL schema

### Common Error: Schema Already Used

```
MigrationError: Schema "morpho_blue" was previously used by a different Ponder app.
Drop the schema first, or use a different schema.
```

**Cause**: Schema definition changed (e.g., added new tables, modified columns) but database still has old schema.

**Solution**: Drop the old schema and let Ponder recreate it.

### Development Workflow

#### Option 1: Drop Schema (Recommended for Development)

When you modify `ponder.schema.ts`:

```bash
# Drop the existing schema
psql $DATABASE_URL -c "DROP SCHEMA IF EXISTS morpho_blue CASCADE;"

# Restart Ponder (will recreate schema)
pnpm dev
```

**One-liner**:

```bash
psql postgresql://ponder:ponder123@localhost:5432/lending_master \
  -c "DROP SCHEMA IF EXISTS morpho_blue CASCADE;" && pnpm dev
```

#### Option 2: Use Different Schema (Testing)

Temporarily use a different schema name:

```bash
# .env
DATABASE_SCHEMA=morpho_blue_v2
```

Then run:

```bash
pnpm dev
```

**Note**: This creates a new schema without affecting the old one.

### Production Workflow

#### Safe Schema Changes

For production, Ponder supports safe migrations:

1. **Additive changes** (safe):

   - Adding new tables
   - Adding new columns
   - Adding new indexes

2. **Breaking changes** (requires manual migration):
   - Removing columns
   - Changing column types
   - Renaming tables/columns

#### Migration Strategy

**For breaking changes**:

```bash
# 1. Export existing data (if needed)
pg_dump -d lending_master -n morpho_blue -f backup.sql

# 2. Drop schema
psql $DATABASE_URL -c "DROP SCHEMA IF EXISTS morpho_blue CASCADE;"

# 3. Restart Ponder to recreate schema
pnpm start

# 4. Wait for re-indexing from blockchain
```

**Warning**: Re-indexing can take hours or days depending on chain and block range!

### Database Configuration

```bash
# .env
DATABASE_URL=postgresql://ponder:ponder123@localhost:5432/lending_master

# Optional: Custom schema name (default: derived from project)
# DATABASE_SCHEMA=morpho_blue_custom

# Optional: Connection pool settings
# DATABASE_POOL_MAX=30
```

### Useful Commands

```bash
# Connect to database
psql postgresql://ponder:ponder123@localhost:5432/lending_master

# List all schemas
\dn

# List tables in morpho_blue schema
\dt morpho_blue.*

# Drop schema
DROP SCHEMA IF EXISTS morpho_blue CASCADE;

# Check schema size
SELECT
  schemaname,
  pg_size_pretty(SUM(pg_total_relation_size(schemaname||'.'||tablename))::bigint)
FROM pg_tables
WHERE schemaname = 'morpho_blue'
GROUP BY schemaname;

# Count records in transaction table
SELECT COUNT(*) FROM morpho_blue.transaction;
```

### Common Scenarios

#### Scenario 1: Added New Table

**Change**: Added `transaction` table to `ponder.schema.ts`

**Action**: Ponder automatically migrates ✅ (additive change)

**Issue**: If you see `Schema was previously used by different app`:

```bash
# Drop and recreate
psql $DATABASE_URL -c "DROP SCHEMA IF EXISTS morpho_blue CASCADE;"
pnpm dev
```

#### Scenario 2: Changed Column Type

**Change**: Modified `timestamp: t.integer()` → `timestamp: t.bigint()`

**Action**: Must drop and recreate schema

```bash
psql $DATABASE_URL -c "DROP SCHEMA IF EXISTS morpho_blue CASCADE;"
pnpm dev
```

#### Scenario 3: Testing Schema Changes

**Action**: Use temporary schema

```bash
DATABASE_SCHEMA=morpho_blue_test pnpm dev
```

Switch back when ready:

```bash
unset DATABASE_SCHEMA
pnpm dev
```

### Performance Optimization

#### Indexes

Our schema includes indexes for common queries:

- User queries: `userIdx`, `chainUserIdx`
- Market queries: `marketIdx`
- Vault queries: `vaultIdx`
- Time-based queries: `timestampIdx`
- Type-based queries: `typeIdx`, `typeTimestampIdx`

#### Vacuum and Analyze

For large datasets, periodically run:

```sql
VACUUM ANALYZE morpho_blue.transaction;
VACUUM ANALYZE morpho_blue.position;
VACUUM ANALYZE morpho_blue.vault_balance;
```

### Backup and Restore

#### Backup Single Schema

```bash
pg_dump -d lending_master -n morpho_blue -f morpho_blue_backup.sql
```

#### Restore Schema

```bash
psql -d lending_master -f morpho_blue_backup.sql
```

#### Backup Entire Database

```bash
pg_dump lending_master > lending_master_backup.sql
```

### Troubleshooting

**Problem**: "Schema was previously used by different app"  
**Solution**: Drop schema (see Option 1 above)

**Problem**: "Connection refused"  
**Solution**: Ensure PostgreSQL container is running:

```bash
docker ps | grep postgres
```

**Problem**: Slow queries  
**Solution**: Check if indexes are being used:

```sql
EXPLAIN ANALYZE
SELECT * FROM morpho_blue.transaction
WHERE "user" = '0x...'
ORDER BY timestamp DESC;
```

**Problem**: Database too large  
**Solution**:

- Index fewer chains (use `TIER_TO_INDEX=mainnet`)
- Increase `startBlock` in contract configs
- Implement data retention policy

### Best Practices

1. **Development**: Drop and recreate schema frequently when iterating on schema design
2. **Staging**: Use separate DATABASE_URL or DATABASE_SCHEMA for testing
3. **Production**: Plan migrations carefully, backup before dropping schema
4. **Monitoring**: Track schema size and query performance
5. **Documentation**: Document all schema changes in git commits

### Quick Reference

```bash
# Drop schema and restart (development)
psql $DATABASE_URL -c "DROP SCHEMA IF EXISTS morpho_blue CASCADE;" && pnpm dev

# Check what's in database
psql $DATABASE_URL -c "\dt morpho_blue.*"

# Count transactions
psql $DATABASE_URL -c "SELECT COUNT(*) FROM morpho_blue.transaction;"

# See recent transactions
psql $DATABASE_URL -c "SELECT type, timestamp FROM morpho_blue.transaction ORDER BY timestamp DESC LIMIT 10;"
```
