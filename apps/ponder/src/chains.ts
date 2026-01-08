import { chains } from "@/constants";
import { type PickFrom, type PonderContract, pick } from "@/types";

type ChainName = keyof typeof chains;

function setDifference<T>(a: T[], ...bs: T[][]): T[] {
  const set = new Set(a);
  for (const b of bs) {
    for (const item of b) {
      set.delete(item);
    }
  }

  return [...set];
}

const TIER_1 = [
  "mainnet",
  "base",
  "unichain",
  "katana",
  "arbitrum",
  "hyperevm",
  "monad",
] satisfies ChainName[];

const TIER_2 = [
  "celo",
  "hemi",
  "lisk",
  "optimism",
  "plume",
  "soneium",
  "tac",
  "worldchain",
] satisfies Exclude<ChainName, (typeof TIER_1)[number]>[];

// chains that have too many reorgs / RPC issues to work properly
const TIER_3 = ["sei", "polygon", "botanix"] satisfies Exclude<
  ChainName,
  (typeof TIER_1)[number] | (typeof TIER_2)[number]
>[];

const TIER_4 = setDifference(Object.keys(chains), TIER_1, TIER_2, TIER_3) as Exclude<
  ChainName,
  (typeof TIER_1)[number] | (typeof TIER_2)[number] | (typeof TIER_3)[number]
>[];

const tiers = {
  "1": TIER_1,
  "2": TIER_2,
  "3": TIER_3,
  "4": TIER_4,
  all: Object.keys(chains) as (keyof typeof chains)[],
};

type Tiers = typeof tiers;

/**
 * Parse chain selector string into array of chain names
 * Supports:
 * - Tier: "1", "2", "3", "4", "all"
 * - Single chain: "mainnet"
 * - Multiple chains: "mainnet,base,arbitrum"
 * - Mixed: "1,optimism" (tier 1 + optimism)
 */
export function parseChainSelector(selector: string): ChainName[] {
  const parts = selector.split(",").map((s) => s.trim());
  const result = new Set<ChainName>();

  for (const part of parts) {
    if (part in tiers) {
      // It's a tier
      const tierChains = tiers[part as keyof Tiers];
      for (const chain of tierChains) {
        result.add(chain as ChainName);
      }
    } else if (part in chains) {
      // It's a single chain name
      result.add(part as ChainName);
    } else {
      throw new Error(
        `Invalid chain selector: "${part}". Must be a tier (1, 2, 3, 4, all) or chain name (${Object.keys(chains).join(", ")})`,
      );
    }
  }

  return [...result];
}

export function getChainNames<K extends keyof Tiers>(tier: K): Tiers[K] {
  return tiers[tier];
}

export function getChains<K extends keyof Tiers>(tier: K): PickFrom<typeof chains, Tiers[K]>;
export function getChains(selector: string): PickFrom<typeof chains, ChainName[]>;
export function getChains(
  selectorOrTier: string | keyof Tiers,
): PickFrom<typeof chains, ChainName[]> {
  const chainNames =
    selectorOrTier in tiers
      ? tiers[selectorOrTier as keyof Tiers]
      : parseChainSelector(selectorOrTier);
  return pick(chains, chainNames);
}

export function getPartialContract<
  Contract extends PonderContract<keyof typeof chains>,
  K extends keyof Tiers,
>(
  contract: Contract,
  tier: K,
): Omit<Contract, "chain"> & { chain: PickFrom<Contract["chain"], Tiers[K]> };
export function getPartialContract<Contract extends PonderContract<keyof typeof chains>>(
  contract: Contract,
  selector: string,
): Omit<Contract, "chain"> & { chain: PickFrom<Contract["chain"], ChainName[]> };
export function getPartialContract<Contract extends PonderContract<keyof typeof chains>>(
  contract: Contract,
  selectorOrTier: string | keyof Tiers,
): Omit<Contract, "chain"> & { chain: PickFrom<Contract["chain"], ChainName[]> } {
  const chainNames =
    selectorOrTier in tiers
      ? tiers[selectorOrTier as keyof Tiers]
      : parseChainSelector(selectorOrTier);
  return {
    ...contract,
    chain: pick(contract.chain, chainNames),
  };
}
