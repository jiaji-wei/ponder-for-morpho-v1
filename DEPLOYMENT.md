# Deployment Guide

Quick guide for deploying Ponder indexer on a new host.

## Prerequisites

- Docker and Docker Compose installed
- pnpm installed (v9.13.2+)
- Node.js 18.14+
- Git

## Step-by-Step Deployment

### 1. Clone Repository

```bash
git clone <repository-url>
cd ponder-for-morpho-v1
```

### 2. Install Dependencies

```bash
pnpm install
```

### 3. Start PostgreSQL Database

```bash
# Start PostgreSQL container
docker-compose up -d postgres

# Wait for database to be ready
docker-compose logs -f postgres
# Look for: "database system is ready to accept connections"
```

### 4. Configure Environment

```bash
# Copy example configuration
cp apps/ponder/.env.example apps/ponder/.env

# Edit configuration
nano apps/ponder/.env
```

**Minimal configuration** (mainnet only):

```bash
# Database
DATABASE_URL=postgresql://ponder:ponder123@localhost:5432/lending_master

# Index only mainnet (recommended for first deployment)
TIER_TO_INDEX=mainnet
TIER_TO_SERVE=mainnet

# RPC (use your own Alchemy/Infura key)
PONDER_RPC_URL_1=https://eth-mainnet.g.alchemy.com/v2/YOUR_ALCHEMY_KEY
```

**Production configuration** (multi-chain):

```bash
# Database
DATABASE_URL=postgresql://ponder:ponder123@localhost:5432/lending_master

# Index multiple chains
TIER_TO_INDEX=mainnet,base,arbitrum

# RPC URLs
PONDER_RPC_URL_1=https://eth-mainnet.g.alchemy.com/v2/YOUR_KEY
PONDER_RPC_URL_8453=https://base-mainnet.g.alchemy.com/v2/YOUR_KEY
PONDER_RPC_URL_42161=https://arb-mainnet.g.alchemy.com/v2/YOUR_KEY
```

### 5. Start Ponder Indexer

```bash
cd apps/ponder
pnpm dev
```

### 6. Verify Deployment

```bash
# Check if indexer is running
curl http://localhost:42069/health

# Check GraphQL endpoint
curl http://localhost:42069/graphql

# View indexing progress in logs
# You should see:
# - "Indexing started"
# - "Syncing blocks..."
# - Event processing logs
```

### 7. Access GraphQL Playground

Open browser: http://localhost:42069

Test query:

```graphql
query {
  markets(limit: 5) {
    items {
      id
      loanToken
      collateralToken
      totalSupplyAssets
    }
  }
}
```

## Production Deployment

### Using systemd (Recommended)

Create service file `/etc/systemd/system/morpho-ponder.service`:

```ini
[Unit]
Description=Morpho Ponder Indexer
After=docker.service
Requires=docker.service

[Service]
Type=simple
User=morpho
WorkingDirectory=/opt/morpho-ponder/apps/ponder
Environment="NODE_ENV=production"
ExecStart=/usr/local/bin/pnpm start
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

Enable and start:

```bash
sudo systemctl daemon-reload
sudo systemctl enable morpho-ponder
sudo systemctl start morpho-ponder
sudo systemctl status morpho-ponder
```

### Using Docker for Ponder (Optional)

If you want to run Ponder in Docker as well, create `Dockerfile`:

```dockerfile
FROM node:20-alpine

# Install pnpm
RUN corepack enable && corepack prepare pnpm@9.13.2 --activate

WORKDIR /app

# Copy workspace files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/ponder/package.json ./apps/ponder/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source
COPY apps/ponder ./apps/ponder

# Build (if needed)
WORKDIR /app/apps/ponder

EXPOSE 42069

CMD ["pnpm", "start"]
```

Add to `docker-compose.yml`:

```yaml
services:
  ponder:
    build: .
    container_name: morpho-ponder-indexer
    env_file:
      - apps/ponder/.env
    ports:
      - "42069:42069"
    depends_on:
      postgres:
        condition: service_healthy
    restart: unless-stopped
    networks:
      - morpho-network
```

## Monitoring

### Check Indexing Progress

```bash
# View logs
docker-compose logs -f postgres  # Database logs
cd apps/ponder && pnpm dev       # Ponder logs (if running locally)

# Check database records
psql $DATABASE_URL -c "
SELECT
  COUNT(*) as total_transactions,
  COUNT(DISTINCT \"user\") as unique_users,
  COUNT(DISTINCT \"chainId\") as chains_indexed
FROM morpho_blue.transaction;
"
```

### Performance Metrics

```bash
# Transaction count by type
psql $DATABASE_URL -c "
SELECT type, COUNT(*)
FROM morpho_blue.transaction
GROUP BY type
ORDER BY COUNT(*) DESC;
"

# Recent activity
psql $DATABASE_URL -c "
SELECT
  type,
  to_timestamp(timestamp) as time,
  \"user\"
FROM morpho_blue.transaction
ORDER BY timestamp DESC
LIMIT 10;
"
```

## Maintenance

### Daily Operations

```bash
# Check service status
systemctl status morpho-ponder

# View recent logs
journalctl -u morpho-ponder -n 100 -f

# Database backup
docker exec morpho-ponder-postgres pg_dump -U ponder lending_master | gzip > backup_$(date +%Y%m%d).sql.gz

# Check disk space
df -h
docker system df
```

### Schema Updates

When updating `ponder.schema.ts`:

```bash
# 1. Stop indexer
systemctl stop morpho-ponder

# 2. Drop schema
psql $DATABASE_URL -c "DROP SCHEMA IF EXISTS morpho_blue CASCADE;"

# 3. Start indexer (will recreate schema and re-index)
systemctl start morpho-ponder

# 4. Monitor re-indexing progress
journalctl -u morpho-ponder -f
```

## Troubleshooting

### Issue: Indexer stuck or slow

```bash
# Check RPC rate limits
# Solution: Use paid RPC provider (Alchemy, Infura, QuickNode)

# Check database performance
psql $DATABASE_URL -c "SELECT * FROM pg_stat_activity;"

# Restart services
systemctl restart morpho-ponder
docker-compose restart postgres
```

### Issue: Out of memory

```bash
# Reduce chains being indexed
nano apps/ponder/.env
# Set: TIER_TO_INDEX=mainnet

# Increase system resources
# Edit docker-compose.yml to add memory limits
# Or upgrade host machine
```

### Issue: Database connection errors

```bash
# Verify PostgreSQL is running
docker-compose ps postgres

# Test connection
psql $DATABASE_URL -c "SELECT 1;"

# Check network
docker network inspect morpho-network
```

## Rollback Procedure

If deployment fails:

```bash
# 1. Stop services
systemctl stop morpho-ponder
docker-compose down

# 2. Restore from backup
cat backup_YYYYMMDD.sql.gz | gunzip | docker exec -i morpho-ponder-postgres psql -U ponder -d lending_master

# 3. Checkout previous version
git log --oneline -10
git checkout <previous-commit>

# 4. Restart
docker-compose up -d postgres
systemctl start morpho-ponder
```

## Health Checks

Create a monitoring script `health-check.sh`:

```bash
#!/bin/bash

# Check PostgreSQL
if docker exec morpho-ponder-postgres pg_isready -U ponder > /dev/null 2>&1; then
  echo "✓ PostgreSQL is healthy"
else
  echo "✗ PostgreSQL is down"
  exit 1
fi

# Check Ponder API
if curl -s http://localhost:42069/health > /dev/null 2>&1; then
  echo "✓ Ponder API is responding"
else
  echo "✗ Ponder API is down"
  exit 1
fi

# Check recent indexing activity
RECENT_TX=$(psql $DATABASE_URL -t -c "SELECT COUNT(*) FROM morpho_blue.transaction WHERE timestamp > EXTRACT(EPOCH FROM NOW() - INTERVAL '1 hour');" 2>/dev/null)
if [ "$RECENT_TX" -gt 0 ]; then
  echo "✓ Indexer is active ($RECENT_TX transactions in last hour)"
else
  echo "⚠ No recent transactions indexed"
fi

echo "All checks passed!"
```

Make it executable:

```bash
chmod +x health-check.sh
```

Add to crontab for monitoring:

```bash
*/5 * * * * /opt/morpho-ponder/health-check.sh >> /var/log/morpho-health.log 2>&1
```

## Quick Reference

```bash
# Start everything
docker-compose up -d && cd apps/ponder && pnpm dev

# Stop everything
# Ctrl+C (stop pnpm dev)
docker-compose down

# Reset database and re-index
psql $DATABASE_URL -c "DROP SCHEMA IF EXISTS morpho_blue CASCADE;" && pnpm dev

# View logs
docker-compose logs -f postgres
journalctl -u morpho-ponder -f

# Backup database
docker exec morpho-ponder-postgres pg_dump -U ponder lending_master | gzip > backup.sql.gz

# Check status
systemctl status morpho-ponder
docker-compose ps
```
