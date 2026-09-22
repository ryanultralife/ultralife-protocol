export type Bioregion = {
  id: string;
  name: string;
  realm: string;
  health: number;
  treasuryUltra: number;
  residents: number;
  note: string;
};

export const BIOREGIONS: Bioregion[] = [
  {
    id: "intec-site",
    name: "Intec site",
    realm: "Plant",
    health: 0.8,
    treasuryUltra: 0,
    residents: 40,
    note: "First plant collective. Seed pool ticker ULSEED-INTEC is not this id.",
  },
  {
    id: "reno-tric",
    name: "Reno / Tahoe-Reno Industrial Center",
    realm: "Plant",
    health: 0.8,
    treasuryUltra: 0,
    residents: 40,
    note: "Second plant collective. Seed pool ticker ULSEED-TRIC is not this id. A to B lot move is a Transfer.",
  },
  {
    id: "sierra-nevada",
    name: "Sierra Nevada",
    realm: "Nearctic",
    health: 0.78,
    treasuryUltra: 128_400,
    residents: 2140,
    note: "Granite batholith, mixed conifer. Home of SNEV bioregion pools.",
  },
  {
    id: "california-chaparral",
    name: "California Chaparral",
    realm: "Nearctic",
    health: 0.61,
    treasuryUltra: 86_200,
    residents: 4820,
    note: "Mediterranean shrubland. Fire-adapted. Dense demand.",
  },
  {
    id: "amazon",
    name: "Amazon Moist Forests",
    realm: "Neotropic",
    health: 0.71,
    treasuryUltra: 402_100,
    residents: 910,
    note: "Highest carbon sequestration capacity in the set.",
  },
  {
    id: "great-basin",
    name: "Great Basin Shrub Steppe",
    realm: "Nearctic",
    health: 0.66,
    treasuryUltra: 54_800,
    residents: 640,
    note: "Sagebrush sea. Water rights are the scarce asset.",
  },
  {
    id: "cascades",
    name: "Cascades",
    realm: "Nearctic",
    health: 0.82,
    treasuryUltra: 97_350,
    residents: 1280,
    note: "Volcanic arc. High UBI from standing forest.",
  },
  {
    id: "sonoran",
    name: "Sonoran Desert",
    realm: "Nearctic",
    health: 0.58,
    treasuryUltra: 41_900,
    residents: 1760,
    note: "Extraction pressure on water and copper.",
  },
  {
    id: "boreal-shield",
    name: "Boreal Shield",
    realm: "Nearctic",
    health: 0.84,
    treasuryUltra: 63_200,
    residents: 390,
    note: "Slow carbon, long memory.",
  },
  {
    id: "mekong",
    name: "Mekong Riparian",
    realm: "Indomalayan",
    health: 0.54,
    treasuryUltra: 112_000,
    residents: 6400,
    note: "Sediment, fish, rice. High impact velocity.",
  },
];

export const VALIDATOR_CATALOG = [
  { name: "pnft.pnft.spend", category: "Identity", mem: 18_400, cpu: 5_120_000 },
  { name: "pnft.pnft_policy.mint", category: "Identity", mem: 22_100, cpu: 6_840_000 },
  { name: "recovery.recovery.spend", category: "Identity", mem: 16_200, cpu: 4_410_000 },
  { name: "biometric.biometric.spend", category: "Identity", mem: 15_100, cpu: 4_020_000 },
  { name: "access_control.access_control.spend", category: "Identity", mem: 14_600, cpu: 3_880_000 },
  { name: "token.token.spend", category: "Token", mem: 14_800, cpu: 3_920_000 },
  { name: "token.token_policy.mint", category: "Token", mem: 19_600, cpu: 5_770_000 },
  { name: "treasury.treasury.spend", category: "Token", mem: 21_400, cpu: 6_210_000 },
  { name: "ubi.ubi.spend", category: "Staking", mem: 17_900, cpu: 5_040_000 },
  { name: "stake_pool.stake_pool.spend", category: "Staking", mem: 20_300, cpu: 5_880_000 },
  { name: "governance.governance.spend", category: "Staking", mem: 24_700, cpu: 7_150_000 },
  { name: "bioregion.bioregion.spend", category: "Bioregion", mem: 19_200, cpu: 5_460_000 },
  { name: "bioregion.bioregion_policy.mint", category: "Bioregion", mem: 18_100, cpu: 5_110_000 },
  { name: "land_rights.land_rights.spend", category: "Bioregion", mem: 28_400, cpu: 8_220_000 },
  { name: "commons.commons.spend", category: "Bioregion", mem: 16_800, cpu: 4_730_000 },
  { name: "impact.impact.spend", category: "Impact", mem: 21_900, cpu: 6_440_000 },
  { name: "impact_market.impact_market.spend", category: "Impact", mem: 32_600, cpu: 9_180_000 },
  { name: "impact_policy.impact_policy.mint", category: "Impact", mem: 18_700, cpu: 5_330_000 },
  { name: "remediation.remediation.spend", category: "Impact", mem: 23_100, cpu: 6_720_000 },
  { name: "preservation.preservation.spend", category: "Impact", mem: 20_800, cpu: 5_990_000 },
  { name: "asset_impact.asset_impact.spend", category: "Impact", mem: 26_500, cpu: 7_640_000 },
  { name: "marketplace.marketplace.spend", category: "Marketplace", mem: 25_200, cpu: 7_310_000 },
  { name: "work_auction.work_auction.spend", category: "Marketplace", mem: 29_800, cpu: 8_540_000 },
  { name: "lease.lease.spend", category: "Marketplace", mem: 13_800, cpu: 3_720_000 },
  { name: "records.records.spend", category: "Records", mem: 13_400, cpu: 3_610_000 },
  { name: "registry.registry.spend", category: "Records", mem: 12_900, cpu: 3_440_000 },
  { name: "memory.memory.spend", category: "Records", mem: 15_600, cpu: 4_280_000 },
  { name: "collective.collective.spend", category: "Collectives", mem: 22_700, cpu: 6_590_000 },
  { name: "care.care.spend", category: "Collectives", mem: 18_300, cpu: 5_210_000 },
  { name: "energy.energy.spend", category: "Infrastructure", mem: 16_100, cpu: 4_560_000 },
  { name: "grants.grants.spend", category: "Infrastructure", mem: 14_200, cpu: 3_980_000 },
  { name: "genesis.genesis.spend", category: "Infrastructure", mem: 11_800, cpu: 3_220_000 },
  { name: "spending_bucket.spending_bucket.spend", category: "Hydra", mem: 19_500, cpu: 5_530_000 },
  { name: "ultralife_validator.ultralife_validator.spend", category: "Hydra", mem: 21_000, cpu: 6_050_000 },
  { name: "fee_pool.fee_pool.spend", category: "Hydra", mem: 15_200, cpu: 4_170_000 },
  { name: "oracle_bioregion.oracle_bioregion.spend", category: "Oracle", mem: 17_400, cpu: 4_890_000 },
  { name: "oracle_impact.oracle_impact.spend", category: "Oracle", mem: 17_700, cpu: 4_960_000 },
  { name: "isotope.isotope.spend", category: "Care", mem: 22_400, cpu: 6_480_000 },
  { name: "isotope.isotope_policy.mint", category: "Care", mem: 18_200, cpu: 5_210_000 },
] as const;

export function validatorByName(name: string) {
  return VALIDATOR_CATALOG.find((v) => v.name === name);
}

export type PoolSeed = {
  id: string;
  ticker: string;
  name: string;
  bioregion: string;
  focus: string;
  operator: string;
  stakeUltra: number;
  epochFees: number;
};

/** Bioregion pools. Stake ULTRA, earn ULTRA. ADA never appears here. */
export const GENESIS_POOLS: PoolSeed[] = [
  {
    id: "pool_snev_a",
    ticker: "SNEV",
    name: "Sierra Nevada A",
    bioregion: "sierra-nevada",
    focus: "General infrastructure",
    operator: "pnft_ml361rj3_dcb6eb37787234c8",
    stakeUltra: 1_250_000,
    epochFees: 94,
  },
  {
    id: "pool_snev_b",
    ticker: "SNEV-W",
    name: "Sierra Nevada B",
    bioregion: "sierra-nevada",
    focus: "Water and watershed",
    operator: "pnft_ml361rj3_dcb6eb37787234c8",
    stakeUltra: 890_000,
    epochFees: 71,
  },
  {
    id: "pool_casc_a",
    ticker: "CASC",
    name: "Cascades A",
    bioregion: "cascades",
    focus: "Standing forest",
    operator: "pnft_cascades_boreal_02",
    stakeUltra: 970_000,
    epochFees: 88,
  },
  {
    id: "pool_amzn_a",
    ticker: "AMZN",
    name: "Amazon A",
    bioregion: "amazon",
    focus: "Conservation and carbon",
    operator: "pnft_amazon_steward_01",
    stakeUltra: 2_100_000,
    epochFees: 142,
  },
];

export const SCRIPT_ADDRESS = {
  marketplace: "addr_test1q_ul_marketplace_ref_script_lock",
  ubi: "addr_test1q_ul_ubi_distributor_lock",
  treasury: "addr_test1q_ul_treasury_bonding_curve",
  impact: "addr_test1q_ul_impact_ledger_lock",
  land: "addr_test1q_ul_land_rights_lock",
  genesis: "addr_test1q_ul_genesis_seal",
  pool: "addr_test1q_ul_stake_pool_lock",
  faucet: "addr_test1q_ul_preprod_faucet",
  auction: "addr_test1q_ul_work_auction_lock",
  isotope: "addr_test1q_ul_isotope_lot_lock",
};

export const GENESIS_JOBS: Array<{
  id: string;
  title: string;
  kind: "work" | "goods";
  bioregion: string;
  bidUltra: number;
  poster: string;
  status: "open" | "awarded";
  txId: string;
}> = [
  {
    id: "job_watershed",
    title: "Restore 12 ha north-fork riparian",
    kind: "work",
    bioregion: "sierra-nevada",
    bidUltra: 220,
    poster: "pnft_ml361rj3_dcb6eb37787234c8",
    status: "open",
    txId: "genesis",
  },
  {
    id: "job_carpentry",
    title: "Timber frame for a care house",
    kind: "work",
    bioregion: "sierra-nevada",
    bidUltra: 80,
    poster: "pnft_care_delta_9a1",
    status: "open",
    txId: "genesis",
  },
];

export const GENESIS_OFFERINGS: Array<{
  id: string;
  seller: string;
  title: string;
  kind: "goods" | "service" | "care" | "knowledge" | "land";
  bioregion: string;
  priceUltra: number;
  impact: Record<string, number>;
  available: boolean;
}> = [
  {
    id: "off_eggs",
    seller: "pnft_ml361rj3_dcb6eb37787234c8",
    title: "Pasture eggs, one dozen",
    kind: "goods",
    bioregion: "sierra-nevada",
    priceUltra: 8,
    impact: { CO2: 0.4, H2O: 18 },
    available: true,
  },
  {
    id: "off_carpentry",
    seller: "pnft_ml361rj3_dcb6eb37787234c8",
    title: "Carpentry, local timber",
    kind: "service",
    bioregion: "sierra-nevada",
    priceUltra: 50,
    impact: { CO2: 2.1, H2O: 4 },
    available: true,
  },
  {
    id: "off_care",
    seller: "pnft_care_delta_9a1",
    title: "Elder care, afternoon",
    kind: "care",
    bioregion: "california-chaparral",
    priceUltra: 22,
    impact: { CO2: 0.1 },
    available: true,
  },
  {
    id: "off_seed",
    seller: "pnft_cascades_boreal_02",
    title: "Native seed mix, 2kg",
    kind: "goods",
    bioregion: "cascades",
    priceUltra: 14,
    impact: { CO2: -1.8, H2O: 6 },
    available: true,
  },
];
