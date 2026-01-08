# Docker Deployment Guide

This guide covers deploying the PostgreSQL database and Ponder indexer using Docker.

## Quick Start

### 1. Start PostgreSQL

```bash
# Start PostgreSQL container
docker-compose up -d postgres

# Verify it's running
docker-compose ps
docker-compose logs postgres
```

### 2. Configure Environment

```bash
# Copy example env file
cp apps/ponder/.env.example apps/ponder/.env

# Edit .env with your configuration
nano apps/ponder/.env
```

Minimal configuration:

```bash
DATABASE_URL=postgresql://ponder:ponder123@localhost:5432/lending_master
TIER_TO_INDEX=mainnet
PONDER_RPC_URL_1=https://eth-mainnet.g.alchemy.com/v2/YOUR_KEY
```

### 3. Start Ponder Indexer

```bash
cd apps/ponder
pnpm install
pnpm dev
```

## PostgreSQL Container

### Configuration

**Image**: `postgres:16-alpine` (lightweight, production-ready)

**Environment Variables**:

- `POSTGRES_USER`: ponder
- `POSTGRES_PASSWORD`: ponder123
- `POSTGRES_DB`: lending_master

**Ports**: 5432:5432 (host:container)

**Volumes**:

- `postgres_data`: Persistent data storage
- `./init-db.sh`: Initialization script

### Management Commands

```bash
# Start database
docker-compose up -d postgres

# Stop database
docker-compose stop postgres

# Restart database
docker-compose restart postgres

# View logs
docker-compose logs -f postgres

# Remove database (WARNING: deletes all data)
docker-compose down -v
```

### Connect to Database

```bash
# Using docker exec
docker exec -it morpho-ponder-postgres psql -U ponder -d lending_master

# Using psql client (if installed locally)
psql postgresql://ponder:ponder123@localhost:5432/lending_master
```

### Backup and Restore

#### Backup

```bash
# Backup entire database
docker exec morpho-ponder-postgres pg_dump -U ponder lending_master > backup.sql

# Backup specific schema
docker exec morpho-ponder-postgres pg_dump -U ponder -n morpho_blue lending_master > morpho_blue.sql
```

#### Restore

```bash
# Restore from backup
cat backup.sql | docker exec -i morpho-ponder-postgres psql -U ponder -d lending_master
```

## Production Deployment

### Environment Variables

Create a production `.env` file:

```bash
# Database
DATABASE_URL=postgresql://ponder:ponder123@postgres:5432/lending_master

# Chain selection
TIER_TO_INDEX=mainnet,base,arbitrum
TIER_TO_SERVE=mainnet,base,arbitrum

# RPC URLs (use private RPCs in production!)
PONDER_RPC_URL_1=https://eth-mainnet.g.alchemy.com/v2/YOUR_KEY
PONDER_RPC_URL_8453=https://base-mainnet.g.alchemy.com/v2/YOUR_KEY
PONDER_RPC_URL_42161=https://arb-mainnet.g.alchemy.com/v2/YOUR_KEY

# Performance tuning
PONDER_MAX_RANGE_1=50000
PONDER_MAX_RANGE_8453=100000
PONDER_MAX_RANGE_42161=100000
```

### Docker Compose Override (Production)

Create `docker-compose.prod.yml`:

```yaml
version: "3.8"

services:
  postgres:
    environment:
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD} # Use stronger password
    volumes:
      - /var/lib/postgresql/data:/var/lib/postgresql/data # Use host volume
    deploy:
      resources:
        limits:
          memory: 4G
          cpus: "2"
        reservations:
          memory: 2G
          cpus: "1"
```

Start with production config:

```bash
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

### Security Best Practices

1. **Change default password**:

   ```bash
   # Use strong password in production
   POSTGRES_PASSWORD=$(openssl rand -base64 32)
   ```

2. **Network isolation**:

   - Don't expose port 5432 to public internet
   - Use Docker networks for internal communication

3. **SSL/TLS**:

   - Configure PostgreSQL with SSL certificates in production
   - Update DATABASE_URL: `postgresql://user:pass@host:5432/db?sslmode=require`

4. **Regular backups**:
   ```bash
   # Automated daily backup (add to crontab)
   0 2 * * * docker exec morpho-ponder-postgres pg_dump -U ponder lending_master | gzip > /backups/lending_$(date +\%Y\%m\%d).sql.gz
   ```

## Monitoring

### Database Health

```bash
# Check if database is ready
docker exec morpho-ponder-postgres pg_isready -U ponder

# Check database size
docker exec morpho-ponder-postgres psql -U ponder -d lending_master -c "
SELECT
  pg_size_pretty(pg_database_size('lending_master')) AS db_size;
"

# Check schema size
docker exec morpho-ponder-postgres psql -U ponder -d lending_master -c "
SELECT
  schemaname,
  pg_size_pretty(SUM(pg_total_relation_size(schemaname||'.'||tablename))::bigint) AS size
FROM pg_tables
WHERE schemaname = 'morpho_blue'
GROUP BY schemaname;
"

# Check transaction count
docker exec morpho-ponder-postgres psql -U ponder -d lending_master -c "
SELECT COUNT(*) FROM morpho_blue.transaction;
"
```

### Container Metrics

```bash
# Resource usage
docker stats morpho-ponder-postgres

# Logs
docker logs -f morpho-ponder-postgres

# Inspect configuration
docker inspect morpho-ponder-postgres
```

## Troubleshooting

### Problem: Container won't start

```bash
# Check logs
docker-compose logs postgres

# Common issues:
# - Port 5432 already in use
# - Insufficient permissions on volume
# - Invalid environment variables
```

### Problem: Connection refused

```bash
# Verify container is running
docker-compose ps

# Verify network
docker network ls
docker network inspect morpho-network

# Test connection
docker exec morpho-ponder-postgres psql -U ponder -d lending_master -c "SELECT 1;"
```

### Problem: Out of disk space

```bash
# Check volume usage
docker system df -v

# Clean up unused volumes
docker volume prune

# Check PostgreSQL data directory size
docker exec morpho-ponder-postgres du -sh /var/lib/postgresql/data
```

### Problem: Slow performance

```bash
# Increase memory allocation in docker-compose.yml
# Check PostgreSQL configuration
docker exec morpho-ponder-postgres psql -U ponder -d lending_master -c "
SHOW shared_buffers;
SHOW effective_cache_size;
SHOW max_connections;
"
```

## Development vs Production

| Aspect        | Development        | Production              |
| ------------- | ------------------ | ----------------------- |
| Password      | ponder123 (simple) | Strong random password  |
| Port exposure | localhost:5432     | Internal only           |
| Data volume   | Docker volume      | Host volume at /var/lib |
| Backups       | Manual             | Automated daily         |
| Resources     | No limits          | CPU/Memory limits set   |
| SSL           | Disabled           | Enabled                 |

## Migration Guide

### Moving to New Host

1. **Export data from old host**:

```bash
docker exec morpho-ponder-postgres pg_dump -U ponder lending_master | gzip > morpho_export.sql.gz
```

2. **Copy to new host**:

```bash
scp morpho_export.sql.gz user@newhost:/tmp/
```

3. **Start PostgreSQL on new host**:

```bash
docker-compose up -d postgres
```

4. **Restore data**:

```bash
gunzip -c /tmp/morpho_export.sql.gz | docker exec -i morpho-ponder-postgres psql -U ponder -d lending_master
```

5. **Verify**:

```bash
docker exec morpho-ponder-postgres psql -U ponder -d lending_master -c "SELECT COUNT(*) FROM morpho_blue.transaction;"
```

## Useful Commands Reference

```bash
# Start everything
docker-compose up -d

# Stop everything
docker-compose down

# Rebuild and restart
docker-compose up -d --build

# View all logs
docker-compose logs -f

# Execute SQL
docker exec -i morpho-ponder-postgres psql -U ponder -d lending_master <<< "SELECT 1;"

# Shell access
docker exec -it morpho-ponder-postgres sh

# Database shell
docker exec -it morpho-ponder-postgres psql -U ponder -d lending_master
```
