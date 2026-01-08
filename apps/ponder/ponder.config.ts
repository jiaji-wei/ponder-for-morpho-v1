import { createConfig } from "ponder";

import { getChains, getPartialContract } from "@/chains";
import {
  AdaptiveCurveIRM,
  MetaMorpho,
  MetaMorphoFactory,
  Morpho,
  PreLiquidationFactory,
} from "@/constants";

/**
 * Chain selector configuration
 * Supports multiple formats:
 * - Tier: "1", "2", "3", "4", "all" (batch selection)
 * - Single chain: "mainnet"
 * - Multiple chains: "mainnet,base,arbitrum"
 * - Mixed: "1,optimism" (tier 1 + optimism)
 *
 * Examples:
 * - TIER_TO_INDEX="mainnet" - Index only mainnet
 * - TIER_TO_INDEX="mainnet,base,arbitrum" - Index mainnet, base, and arbitrum
 * - TIER_TO_INDEX="1" - Index all tier 1 chains
 * - TIER_TO_INDEX="1,optimism" - Index tier 1 chains + optimism
 */
const tierToIndex = process.env.TIER_TO_INDEX ?? "all";
const tierToServe = process.env.TIER_TO_SERVE ?? tierToIndex;

export default createConfig({
  ordering: "multichain",
  chains: getChains(tierToServe),
  contracts: {
    Morpho: getPartialContract(Morpho, tierToIndex),
    MetaMorphoFactory: getPartialContract(MetaMorphoFactory, tierToIndex),
    MetaMorpho: getPartialContract(MetaMorpho, tierToIndex),
    AdaptiveCurveIRM: getPartialContract(AdaptiveCurveIRM, tierToIndex),
    PreLiquidationFactory: getPartialContract(PreLiquidationFactory, tierToIndex),
  },
});
