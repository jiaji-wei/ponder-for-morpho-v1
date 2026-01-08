# Chain Configuration Guide

The chain configuration system supports flexible selection of which chains to index and serve.

## Configuration Variables

- **TIER_TO_INDEX**: Controls which chains to index (sync from blockchain)
- **TIER_TO_SERVE**: Controls which chains to serve via API (defaults to TIER_TO_INDEX)

## Supported Formats

### 1. Tier-based (Batch Selection)

Index all chains in a specific tier:

```bash
# Tier 1: mainnet, base, unichain, katana, arbitrum, hyperevm, monad
TIER_TO_INDEX=1

# Tier 2: celo, hemi, lisk, optimism, plume, soneium, tac, worldchain
TIER_TO_INDEX=2

# Tier 3: sei, polygon, botanix (chains with reorg/RPC issues)
TIER_TO_INDEX=3

# Tier 4: All other chains
TIER_TO_INDEX=4

# All chains
TIER_TO_INDEX=all
```

### 2. Single Chain

Index only one specific chain:

```bash
# Index only Ethereum mainnet
TIER_TO_INDEX=mainnet

# Index only Base
TIER_TO_INDEX=base

# Index only Arbitrum
TIER_TO_INDEX=arbitrum
```

### 3. Multiple Chains

Index a custom list of chains (comma-separated):

```bash
# Index mainnet and Base
TIER_TO_INDEX=mainnet,base

# Index mainnet, Base, and Arbitrum
TIER_TO_INDEX=mainnet,base,arbitrum

# Index mainnet, Optimism, and Polygon
TIER_TO_INDEX=mainnet,optimism,polygon
```

### 4. Mixed (Tier + Custom Chains)

Combine tier selection with additional chains:

```bash
# Index all Tier 1 chains + Optimism
TIER_TO_INDEX=1,optimism

# Index all Tier 1 chains + Optimism + Polygon
TIER_TO_INDEX=1,optimism,polygon

# Index mainnet + all Tier 2 chains
TIER_TO_INDEX=mainnet,2
```

## Examples

### Example 1: Development (Mainnet Only)

```bash
# .env
TIER_TO_INDEX=mainnet
TIER_TO_SERVE=mainnet
```

### Example 2: Production (Multi-chain)

```bash
# .env
TIER_TO_INDEX=mainnet,base,arbitrum,optimism
TIER_TO_SERVE=mainnet,base,arbitrum,optimism
```

### Example 3: Testing New Chain

```bash
# .env
# Index mainnet (stable) + new chain for testing
TIER_TO_INDEX=mainnet,newchain
TIER_TO_SERVE=mainnet
```

### Example 4: High-priority Chains Only

```bash
# .env
# Index all Tier 1 chains
TIER_TO_INDEX=1
TIER_TO_SERVE=1
```

### Example 5: Different Index vs Serve

```bash
# .env
# Index many chains but only serve mainnet via API
TIER_TO_INDEX=1,2
TIER_TO_SERVE=mainnet
```

## Available Chains

Run the following to see all available chains:

```typescript
import { chains } from "@/constants";
console.log(Object.keys(chains));
```

Current chains include:

- mainnet, base, unichain, polygon, katana
- arbitrum, tac, abstract, botanix, celo
- etherlink, fraxtal, hemi, hyperevm, ink
- lisk, mode, monad, optimism, plume
- scroll, sei, soneium, sonic, stable
- worldchain, zircuit

## Chain Tiers

### Tier 1 (High Priority, Stable)

- mainnet, base, unichain, katana, arbitrum, hyperevm, monad

### Tier 2 (Medium Priority)

- celo, hemi, lisk, optimism, plume, soneium, tac, worldchain

### Tier 3 (Known Issues)

- sei, polygon, botanix
- Note: These chains have reorg or RPC stability issues

### Tier 4 (Other)

- All remaining chains: abstract, etherlink, fraxtal, ink, mode, scroll, sonic, stable, zircuit

## Error Handling

If you specify an invalid chain name or tier, you'll get an error:

```
Invalid chain selector: "invalidchain". Must be a tier (1, 2, 3, 4, all) or chain name (mainnet, base, ...)
```

## Performance Considerations

- **Indexing Cost**: More chains = more RPC calls and longer sync time
- **Database Size**: Each chain multiplies the data stored
- **Memory Usage**: Active indexing uses memory proportional to chain count

**Recommendation**: Start with mainnet only, then add chains as needed.

## RPC Configuration

### How It Works

RPC URLs are **automatically configured** via environment variables. The `asPonderChain()` function in `src/constants.ts` reads `PONDER_RPC_URL_{CHAIN_ID}` and applies it to the chain config.

**No code changes needed** - just set environment variables!

### Basic Configuration

```bash
# .env
# Format: PONDER_RPC_URL_{CHAIN_ID}=<RPC_URL>

# Ethereum Mainnet (chain ID: 1)
PONDER_RPC_URL_1=https://eth-mainnet.g.alchemy.com/v2/YOUR_KEY

# Base (chain ID: 8453)
PONDER_RPC_URL_8453=https://base-mainnet.g.alchemy.com/v2/YOUR_KEY

# Arbitrum (chain ID: 42161)
PONDER_RPC_URL_42161=https://arb-mainnet.g.alchemy.com/v2/YOUR_KEY
```

### Chain ID Reference

| Chain Name | Chain ID | Example RPC                                     |
| ---------- | -------- | ----------------------------------------------- |
| mainnet    | 1        | https://eth-mainnet.g.alchemy.com/v2/KEY        |
| base       | 8453     | https://base-mainnet.g.alchemy.com/v2/KEY       |
| arbitrum   | 42161    | https://arb-mainnet.g.alchemy.com/v2/KEY        |
| optimism   | 10       | https://opt-mainnet.g.alchemy.com/v2/KEY        |
| polygon    | 137      | https://polygon-mainnet.g.alchemy.com/v2/KEY    |
| unichain   | 1301     | https://unichain-mainnet.g.alchemy.com/v2/KEY   |
| scroll     | 534352   | https://scroll-mainnet.g.alchemy.com/v2/KEY     |
| celo       | 42220    | https://celo-mainnet.g.alchemy.com/v2/KEY       |
| worldchain | 480      | https://worldchain-mainnet.g.alchemy.com/v2/KEY |

### Advanced: Fallback and Load Balancing

The `parseRpcString()` function supports advanced RPC configurations:

**Fallback (retry on failure)**:

```bash
PONDER_RPC_URL_1=fallback(https://rpc1.example.com,https://rpc2.example.com,https://rpc3.example.com)
```

**Load Balance (distribute requests)**:

```bash
PONDER_RPC_URL_1=loadbalance(https://rpc1.example.com,https://rpc2.example.com,https://rpc3.example.com)
```

### Block Range Tuning

Configure `eth_getLogs` block range per chain (format: `PONDER_MAX_RANGE_{CHAIN_ID}`):

```bash
# .env
# Default: 100000 blocks per request

# Mainnet: use default
PONDER_MAX_RANGE_1=100000

# Base: supports larger ranges
PONDER_MAX_RANGE_8453=200000

# Polygon: requires smaller ranges (RPC limitations)
PONDER_MAX_RANGE_137=10000
```

**Performance tip**: Larger ranges = fewer RPC calls but higher memory usage and timeout risk. Start with 100000 and adjust based on RPC stability.

### Default Behavior

If you **don't** set `PONDER_RPC_URL_{CHAIN_ID}`, Ponder will:

1. Use public RPCs (may be rate-limited)
2. Fall back to chain's default RPC endpoints

**Recommendation**: Always configure custom RPCs for production use to avoid rate limits.
