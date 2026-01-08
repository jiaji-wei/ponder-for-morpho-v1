# Agent Development Guide for ponder-for-morpho-v1

This guide provides essential information for AI coding agents working in this repository.

## Project Overview

**Tech Stack**: TypeScript (ES2022) + Ponder v0.15.2 (blockchain indexing framework)  
**Purpose**: Index Morpho Blue protocol contracts and provide GraphQL/REST APIs  
**Package Manager**: pnpm v9.13.2 (workspaces enabled)  
**Node Version**: >=18.14

## Build & Development Commands

### Working Directory

All commands should be run from `/Users/jacob/Code/project/opencode/ponder-for-morpho-v1/apps/ponder`

### Primary Commands

```bash
# Development server (http://localhost:42069)
pnpm dev

# Production server
pnpm start

# Database operations
pnpm db

# Generate types from schema
pnpm codegen

# Lint all TypeScript files
pnpm lint

# Type checking
pnpm typecheck
```

### Database Management

When you modify `ponder.schema.ts`, you need to drop the existing schema:

```bash
# Drop schema and restart (safe for development)
psql postgresql://ponder:ponder123@localhost:5432/lending_master \
  -c "DROP SCHEMA IF EXISTS morpho_blue CASCADE;" && pnpm dev

# Or use the alias
pnpm db drop  # (may have dependency issues, use psql directly)
```

**Why**: Ponder detects schema changes and requires a fresh start. See [DATABASE.md](apps/ponder/DATABASE.md) for details.

### Chain Configuration

Control which chains to index using the `TIER_TO_INDEX` environment variable:

```bash
# Index only mainnet (recommended for development)
TIER_TO_INDEX=mainnet pnpm dev

# Index mainnet and Base
TIER_TO_INDEX=mainnet,base pnpm dev

# Index all Tier 1 chains
TIER_TO_INDEX=1 pnpm dev

# Index all chains (default)
pnpm dev
```

See [CHAIN_CONFIG.md](apps/ponder/CHAIN_CONFIG.md) for detailed configuration options.

### Testing

**Status**: Vitest v3.1.4 is installed but no tests are currently implemented.  
**To add tests**: Create `*.test.ts` files and add test script to package.json.  
**Run single test**: `vitest <file-path>` (once configured)

## Code Style Guidelines

### Language & Formatting

**Line Length**: Max 100 characters (Prettier enforced)  
**Module System**: ES Modules (type: "module")  
**Target**: ES2022  
**Auto-formatting**: Prettier runs on save and via lint-staged on commit

### TypeScript Configuration

**Strict Mode**: Enabled with additional safety checks:

- `strict: true`
- `noUncheckedIndexedAccess: true` (always check array/object access for undefined)
- `isolatedModules: true`
- `verbatimModuleSyntax: false`

**Type Safety Rules**:

- Always provide explicit types for function parameters and return values
- Use `type` over `interface` for object types (per project style)
- Prefer `readonly` arrays in function parameters when not mutating
- Use type helpers like `NonNullable`, `Exclude`, `Pick` from built-in utilities

### Import Order & Organization

**Enforced by ESLint** (`import-x/order`):

1. External dependencies (alphabetical)
2. Blank line
3. Ponder virtual modules (`ponder:*`)
4. Blank line
5. Internal path aliases (`@/*`, `~/*`)
6. Blank line
7. Relative imports (`./`, `../`)

**Example**:

```typescript
import { createConfig } from "ponder";
import { parseAbi } from "viem";

import type { PonderContract } from "@/types";

import { getChains } from "./chains";
```

**Special Ponder Modules** (ignored in import resolution):

- `ponder:api`
- `ponder:registry`
- `ponder:schema`

### Naming Conventions

**Variables/Functions**: `camelCase`

```typescript
const marketId = "0x...";
function getMarketData() {}
```

**Types/Interfaces**: `PascalCase`

```typescript
type PonderContract<K extends string> = { ... }
```

**Constants**: `PascalCase` for contract configs, `SCREAMING_SNAKE_CASE` for true constants

```typescript
export const MetaMorpho = { ... };  // Contract config
const MAX_RETRIES = 3;              // True constant
```

**Files**: `camelCase.ts` for implementation, `PascalCase.ts` for ABIs/constants

### Error Handling

**Async Operations**: NEVER ignore floating promises

```typescript
// ❌ Bad
someAsyncFunction();

// ✅ Good
await someAsyncFunction();
void someAsyncFunction(); // Only if intentionally fire-and-forget
```

**Type Assertions**: Avoid `as` - use type guards or proper typing instead
**Unused Variables**: Error level - must be removed or prefixed with `_` if intentional

### Comments & Documentation

**JSDoc**: Use for exported functions/types when behavior is non-obvious  
**Inline Comments**: Only when "why" is unclear, not "what"  
**TODOs**: Include issue reference: `// TODO(#123): Description`

### Ponder-Specific Patterns

**Schema Definition** (`ponder.schema.ts`):

- Use `p.createTable()` for entity definitions
- Always include `.id()` for primary key
- Use typed relations via `references()`

**Event Handlers** (`src/*.ts`):

- Export context-aware handler functions
- Always destructure needed properties from context
- Use `context.db` for database operations
- Type event args explicitly

**Contract Configuration**:

- Use `PonderContract<K>` type for type-safe chain configs
- Use helper functions `pick()` and `typedFromEntries()` from `@/types`
- Define contracts in `constants.ts` as `PonderContract<ChainKey>`

**API Routes** (`src/api/*.ts`):

- Use Hono framework
- Apply rate limiting on sensitive endpoints
- Return typed responses with proper status codes
- Keep business logic in separate utility functions

### File Organization

```
apps/ponder/
├── abis/              # Contract ABIs (TypeScript exports)
├── src/
│   ├── api/          # Hono API routes
│   │   └── utils/    # API helper functions
│   ├── *.ts          # Event handler files (one per contract)
│   ├── chains.ts     # Chain configuration helpers
│   ├── constants.ts  # Contract configs & addresses
│   └── types.ts      # Shared type definitions
├── ponder.config.ts  # Ponder framework configuration
├── ponder.schema.ts  # Database schema
└── ponder-env.d.ts   # Generated types (don't edit)
```

## Git Workflow

**Pre-commit Hook**: Runs `eslint --fix` on staged `*.ts` files via lint-staged  
**Before Committing**:

1. Ensure `pnpm typecheck` passes
2. Ensure `pnpm lint` passes
3. Test locally with `pnpm dev`

**Commit Messages**: Use conventional commits style when possible

## Common Pitfalls to Avoid

1. **Don't** manually edit `ponder-env.d.ts` - it's auto-generated by codegen
2. **Don't** forget to run `pnpm codegen` after schema changes
3. **Don't** use `any` type - use `unknown` and narrow with type guards
4. **Don't** bypass linting with `// eslint-disable` without good reason and explanation
5. **Don't** access array/object properties without checking for undefined (due to `noUncheckedIndexedAccess`)
6. **Don't** commit code that fails type checking - CI will reject it

## Environment Variables

Defined in `environment.d.ts`:

- `TIER_TO_INDEX`: Which chain tier to index (`all` by default)
- `TIER_TO_SERVE`: Which chain tier to serve via API
- Standard Ponder env vars (DATABASE_URL, PORT, etc.)

## Key Dependencies to Know

- **Ponder**: Blockchain indexing framework - read docs at ponder.sh
- **Viem**: Ethereum library - use for address/ABI utilities
- **Hono**: Web framework for API routes
- **@morpho-org/blue-sdk**: Morpho protocol SDK for market calculations

## When Stuck

1. Check existing event handlers for similar patterns
2. Review Ponder docs: https://ponder.sh
3. Check `ponder-env.d.ts` for available context types
4. Use `pnpm codegen` to regenerate types after schema changes
5. Check ESLint errors - they often point to the actual issue

---

**Last Updated**: Generated for agents working on TypeScript blockchain indexer using Ponder framework.
