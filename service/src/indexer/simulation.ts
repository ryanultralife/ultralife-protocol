/**
 * UltraLife Simulation Indexer
 *
 * Reads from deployment.json to provide simulated data for local development
 * and testing. Implements the same interface as the blockchain indexer.
 */

import { readFileSync } from 'fs';
import { join } from 'path';
import type {
  PnftDatum,
  Offering,
  Need,
  BioregionIndex,
  Collective,
  ByteArray,
  AssetName,
  Address,
  SpendingBucketDatum,
  BucketState,
  IndexValue,
  CompoundBalance,
  VerificationLevel,
} from '../types/index.js';

// =============================================================================
// DEPLOYMENT DATA TYPES
// =============================================================================

interface DeploymentPnft {
  id: string;
  owner: string;
  level: string;
  bioregion: string;
  createdAt: string;
  createdSlot: number;
  status: string;
  testnetSimulated?: boolean;
  lands_stewarded?: string[];
}

interface DeploymentLand {
  landId: string;
  name: string;
  boundsHash: string;
  area_m2: number;
  bioregion: string;
  classification: {
    name: string;
    terrain: string;
    ecosystem: string;
    sequestrationRate: number;
  };
  health: {
    overall_index: number;
    soil_health: number;
    water_health: number;
    biodiversity_index: number;
    carbon_stock: number;
    last_survey: string | null;
  };
  primarySteward: string;
  stewardAddress: string;
  rights: Record<string, unknown>;
  traditional_territory: string | null;
  cultural_protocols: string | null;
  registered_at: number;
  registeredAt: string;
  testnetSimulated?: boolean;
}

interface DeploymentBioregionStats {
  totalLandArea: number;
  landsRegistered: number;
  totalSequestrationCapacity: number;
}

interface DeploymentCreditBalance {
  total: number;
  available: number;
  sold: number;
  byLand: Record<string, number>;
}

interface DeploymentOffering {
  id: string;
  offerer: string;
  category: string;
  description: string;
  bioregion: string;
  price: number;
  status: string;
  createdAt: string;
}

interface DeploymentNeed {
  id: string;
  needer: string;
  category: string;
  description: string;
  bioregion: string;
  budget: number;
  status: string;
  createdAt: string;
}

interface DeploymentData {
  testUsers: Array<{
    name: string;
    address: string;
    mnemonic: string;
    pnftId: string;
    bioregion: string;
    createdAt: string;
  }>;
  pnfts: DeploymentPnft[];
  ultraBalances: Record<string, number>;
  signupGrants: Array<{
    pnftId: string;
    pnftOwner: string;
    amount: number;
    claimedAt: string;
    testnetSimulated?: boolean;
  }>;
  lands: DeploymentLand[];
  bioregionStats: Record<string, DeploymentBioregionStats>;
  transactions: Array<{
    txHash: string;
    sender: string;
    senderAddress: string;
    recipient: string;
    recipientAddress: string;
    amount: number;
    txType: { code: number; name: string; description: string };
    impact: {
      preset?: string;
      description: string;
      compounds: Array<{
        compound: string;
        quantity: number;
        unit: string;
        confidence: number;
        category?: string;
      }>;
      netImpact: number;
      evidenceHash: string;
    };
    timestamp: string;
    testnetSimulated?: boolean;
  }>;
  bioregionImpact: Record<string, {
    totalTransactions: number;
    totalVolume: number;
    netImpact: number;
    byType: Record<string, number>;
    byCompound: Record<string, number>;
  }>;
  impactTokens: Array<{
    tokenId: string;
    amount: number;
    category: string;
    compounds: Array<{
      compound: string;
      quantity: number;
      unit: string;
      confidence: number;
    }>;
    mintedAt: string;
    mintedBy: string;
    bioregion: string;
    txHash: string;
  }>;
  impactTokenBalances: Record<string, Array<{
    tokenId: string;
    amount: number;
    category: string;
  }>>;
  impactDebt: Record<string, number>;
  sequestrationCredits: Array<{
    creditId: string;
    landId: string;
    landName: string;
    steward: string;
    stewardAddress: string;
    bioregion: string;
    amount: number;
    unit: string;
    cyclesGenerated: number;
    generatedAt: string;
    landType: string;
    sequestrationRate: number;
    confidence: number;
    status: string;
    testnetSimulated?: boolean;
  }>;
  creditBalances: Record<string, DeploymentCreditBalance>;
  lastCreditGeneration: Record<string, string>;
  creditPurchases: Array<{
    purchaseId: string;
    buyer: string;
    seller: string;
    amount: number;
    unit: string;
    price: number;
    priceUnit: string;
    debtBefore: number;
    debtAfter: number;
    purchasedAt: string;
    testnetSimulated?: boolean;
  }>;
  marketplace?: {
    listings: DeploymentOffering[];
  };
  care?: {
    needs: DeploymentNeed[];
  };
  collectives?: Array<{
    collective_id: string;
    name: string;
    name_hash: string;
    members: string[];
    resources: string[];
    governance_hash: string;
    treasury: string;
    bioregion: string;
  }>;
}

// =============================================================================
// SIMULATION INDEXER
// =============================================================================

export class SimulationIndexer {
  private deploymentPath: string;

  constructor(deploymentPath?: string) {
    this.deploymentPath = deploymentPath || join(
      process.cwd(),
      'scripts',
      'deployment.json'
    );
  }

  // ===========================================================================
  // DATA LOADING (Hot reload on each call)
  // ===========================================================================

  private loadDeploymentData(): DeploymentData {
    try {
      const data = readFileSync(this.deploymentPath, 'utf-8');
      return JSON.parse(data) as DeploymentData;
    } catch (error) {
      console.warn(`Could not load deployment.json from ${this.deploymentPath}, using defaults`);
      return this.getDefaultData();
    }
  }

  private getDefaultData(): DeploymentData {
    return {
      testUsers: [],
      pnfts: [],
      ultraBalances: {},
      signupGrants: [],
      lands: [],
      bioregionStats: {},
      transactions: [],
      bioregionImpact: {},
      impactTokens: [],
      impactTokenBalances: {},
      impactDebt: {},
      sequestrationCredits: [],
      creditBalances: {},
      lastCreditGeneration: {},
      creditPurchases: [],
    };
  }

  // ===========================================================================
  // INITIALIZATION
  // ===========================================================================

  async initialize(): Promise<void> {
    console.log('Initializing Simulation indexer...');
    const data = this.loadDeploymentData();
    console.log(`Loaded ${data.pnfts?.length || 0} pNFTs, ${Object.keys(data.bioregionStats || {}).length} bioregions`);
    console.log('Simulation indexer initialized');
  }

  async syncState(): Promise<void> {
    // No-op for simulation - data is loaded fresh on each call
  }

  // ===========================================================================
  // pNFT QUERIES
  // ===========================================================================

  async getPnft(pnftId: AssetName): Promise<PnftDatum | null> {
    const data = this.loadDeploymentData();
    const pnft = data.pnfts.find(p => p.id === pnftId);

    if (!pnft) {
      return null;
    }

    return this.convertToPnftDatum(pnft);
  }

  async getPnftByOwner(ownerAddress: Address): Promise<PnftDatum | null> {
    const data = this.loadDeploymentData();
    const pnft = data.pnfts.find(p => p.owner === ownerAddress);

    if (!pnft) {
      return null;
    }

    return this.convertToPnftDatum(pnft);
  }

  async listPnfts(options?: {
    bioregion?: ByteArray;
    minLevel?: number;
    limit?: number;
  }): Promise<PnftDatum[]> {
    const data = this.loadDeploymentData();
    let results = data.pnfts.map(p => this.convertToPnftDatum(p));

    if (options?.bioregion) {
      results = results.filter(p => p.bioregion === options.bioregion);
    }

    if (options?.minLevel !== undefined) {
      const levelOrder: Record<string, number> = {
        'Basic': 0,
        'Ward': 0,
        'Standard': 1,
        'Verified': 2,
        'Steward': 3,
      };
      results = results.filter(p => (levelOrder[p.level] ?? 0) >= options.minLevel!);
    }

    if (options?.limit) {
      results = results.slice(0, options.limit);
    }

    return results;
  }

  private convertToPnftDatum(pnft: DeploymentPnft): PnftDatum {
    const levelMap: Record<string, VerificationLevel> = {
      'Basic': 'Basic',
      'Ward': 'Ward',
      'Standard': 'Standard',
      'Verified': 'Verified',
      'Steward': 'Steward',
    };

    return {
      pnft_id: pnft.id,
      owner: pnft.owner,
      level: levelMap[pnft.level] || 'Basic',
      bioregion: pnft.bioregion || null,
      dna_hash: null,
      guardian: null,
      ward_since: null,
      created_at: pnft.createdSlot || 0,
      upgraded_at: null,
      consumer_impacts: null,
      care_credits: 0n,
    };
  }

  // ===========================================================================
  // TOKEN BALANCE QUERIES
  // ===========================================================================

  async getTokenBalance(address: Address): Promise<bigint> {
    const data = this.loadDeploymentData();
    const balance = data.ultraBalances[address] ?? 0;
    // Convert to microtokens (6 decimals)
    return BigInt(Math.floor(balance * 1_000_000));
  }

  async getPnftTokenBalance(pnftId: AssetName): Promise<bigint> {
    const pnft = await this.getPnft(pnftId);
    if (!pnft) return 0n;
    return this.getTokenBalance(pnft.owner);
  }

  // ===========================================================================
  // BIOREGION QUERIES
  // ===========================================================================

  async listBioregions(): Promise<BioregionIndex[]> {
    const data = this.loadDeploymentData();
    const bioregions: BioregionIndex[] = [];

    for (const [bioregionId, stats] of Object.entries(data.bioregionStats)) {
      bioregions.push(this.createBioregionIndex(bioregionId, stats, data));
    }

    return bioregions;
  }

  async getBioregion(bioregionId: ByteArray): Promise<BioregionIndex | null> {
    const data = this.loadDeploymentData();
    const stats = data.bioregionStats[bioregionId];

    if (!stats) {
      return null;
    }

    return this.createBioregionIndex(bioregionId, stats, data);
  }

  private createBioregionIndex(
    bioregionId: string,
    stats: DeploymentBioregionStats,
    data: DeploymentData
  ): BioregionIndex {
    const impact = data.bioregionImpact?.[bioregionId];
    const defaultIndex: IndexValue = { value: 5000, trend: 0, confidence: 50 };

    // Calculate compound balances from bioregion impact
    const compoundBalances: CompoundBalance[] = [];
    if (impact?.byCompound) {
      for (const [compound, quantity] of Object.entries(impact.byCompound)) {
        compoundBalances.push({
          compound,
          quantity: BigInt(Math.floor(quantity * 1000)), // Convert to integer representation
          unit: 'g',
        });
      }
    }

    return {
      bioregion: bioregionId,
      cycle: 1,
      water_index: defaultIndex,
      land_index: { value: Math.min(10000, stats.totalLandArea / 100), trend: 0, confidence: 70 },
      air_index: defaultIndex,
      energy_index: defaultIndex,
      health_index: defaultIndex,
      education_index: defaultIndex,
      housing_index: defaultIndex,
      food_security_index: defaultIndex,
      care_availability_index: defaultIndex,
      offerings_active: data.marketplace?.listings?.filter(l => l.bioregion === bioregionId).length ?? 0,
      needs_active: data.care?.needs?.filter(n => n.bioregion === bioregionId).length ?? 0,
      agreements_completed: impact?.totalTransactions ?? 0,
      value_transacted: BigInt(Math.floor((impact?.totalVolume ?? 0) * 1_000_000)),
      care_hours: 0,
      compound_balances: compoundBalances,
      health_score: 7500, // Default healthy
      updated_at: Date.now(),
    };
  }

  // ===========================================================================
  // OFFERING QUERIES
  // ===========================================================================

  async listOfferings(options?: {
    bioregion?: ByteArray;
    offerer?: AssetName;
    category?: string;
    status?: string;
    limit?: number;
  }): Promise<Offering[]> {
    const data = this.loadDeploymentData();
    let listings = data.marketplace?.listings ?? [];

    if (options?.bioregion) {
      listings = listings.filter(l => l.bioregion === options.bioregion);
    }

    if (options?.offerer) {
      listings = listings.filter(l => l.offerer === options.offerer);
    }

    if (options?.status) {
      listings = listings.filter(l => l.status === options.status);
    }

    if (options?.limit) {
      listings = listings.slice(0, options.limit);
    }

    return listings.map(l => this.convertToOffering(l));
  }

  async getOffering(offeringId: ByteArray): Promise<Offering | null> {
    const data = this.loadDeploymentData();
    const listing = data.marketplace?.listings?.find(l => l.id === offeringId);

    if (!listing) {
      return null;
    }

    return this.convertToOffering(listing);
  }

  private convertToOffering(listing: DeploymentOffering): Offering {
    return {
      offering_id: listing.id,
      offerer: listing.offerer,
      category: { type: 'Custom', description_hash: listing.category },
      what: { type: 'Thing', description_hash: listing.description },
      location: listing.bioregion
        ? { type: 'Bioregional', bioregion: listing.bioregion }
        : { type: 'Anywhere' },
      availability: { type: 'Now' },
      terms: { type: 'Priced', amount: BigInt(Math.floor(listing.price * 1_000_000)), negotiable: true },
      expected_compounds: [],
      evidence: [],
      status: (listing.status as Offering['status']) || 'Active',
      created_at: new Date(listing.createdAt).getTime(),
    };
  }

  // ===========================================================================
  // NEED QUERIES
  // ===========================================================================

  async listNeeds(options?: {
    bioregion?: ByteArray;
    needer?: AssetName;
    status?: string;
    limit?: number;
  }): Promise<Need[]> {
    const data = this.loadDeploymentData();
    let needs = data.care?.needs ?? [];

    if (options?.bioregion) {
      needs = needs.filter(n => n.bioregion === options.bioregion);
    }

    if (options?.needer) {
      needs = needs.filter(n => n.needer === options.needer);
    }

    if (options?.status) {
      needs = needs.filter(n => n.status === options.status);
    }

    if (options?.limit) {
      needs = needs.slice(0, options.limit);
    }

    return needs.map(n => this.convertToNeed(n));
  }

  async getNeed(needId: ByteArray): Promise<Need | null> {
    const data = this.loadDeploymentData();
    const need = data.care?.needs?.find(n => n.id === needId);

    if (!need) {
      return null;
    }

    return this.convertToNeed(need);
  }

  private convertToNeed(need: DeploymentNeed): Need {
    return {
      need_id: need.id,
      needer: need.needer,
      category: { type: 'Custom', description_hash: need.category },
      what: { type: 'Thing', description_hash: need.description },
      location: need.bioregion
        ? { type: 'Bioregional', bioregion: need.bioregion }
        : { type: 'Anywhere' },
      when_needed: { type: 'Now' },
      budget: { type: 'Fixed', amount: BigInt(Math.floor(need.budget * 1_000_000)) },
      requirements: [],
      impact_limits: null,
      status: (need.status as Need['status']) || 'Open',
      created_at: new Date(need.createdAt).getTime(),
      deadline: null,
    };
  }

  // ===========================================================================
  // COLLECTIVE QUERIES
  // ===========================================================================

  async listCollectives(options?: {
    bioregion?: ByteArray;
    member?: AssetName;
  }): Promise<Collective[]> {
    const data = this.loadDeploymentData();
    let collectives = data.collectives ?? [];

    if (options?.bioregion) {
      collectives = collectives.filter(c => c.bioregion === options.bioregion);
    }

    if (options?.member) {
      collectives = collectives.filter(c => c.members.includes(options.member!));
    }

    return collectives.map(c => ({
      collective_id: c.collective_id,
      name_hash: c.name_hash || c.name,
      members: c.members,
      resources: c.resources,
      governance_hash: c.governance_hash,
      treasury: c.treasury,
      bioregion: c.bioregion,
    }));
  }

  async getCollective(collectiveId: ByteArray): Promise<Collective | null> {
    const data = this.loadDeploymentData();
    const collective = data.collectives?.find(c => c.collective_id === collectiveId);

    if (!collective) {
      return null;
    }

    return {
      collective_id: collective.collective_id,
      name_hash: collective.name_hash || collective.name,
      members: collective.members,
      resources: collective.resources,
      governance_hash: collective.governance_hash,
      treasury: collective.treasury,
      bioregion: collective.bioregion,
    };
  }

  // ===========================================================================
  // PROTOCOL STATS
  // ===========================================================================

  async getProtocolStats(): Promise<{
    totalPnfts: number;
    totalBioregions: number;
    activeOfferings: number;
    activeNeeds: number;
    totalValueLocked: bigint;
    totalLands: number;
    totalTransactions: number;
  }> {
    const data = this.loadDeploymentData();

    const totalBalance = Object.values(data.ultraBalances).reduce((sum, b) => sum + b, 0);

    return {
      totalPnfts: data.pnfts.length,
      totalBioregions: Object.keys(data.bioregionStats).length,
      activeOfferings: data.marketplace?.listings?.filter(l => l.status === 'Active').length ?? 0,
      activeNeeds: data.care?.needs?.filter(n => n.status === 'Open').length ?? 0,
      totalValueLocked: BigInt(Math.floor(totalBalance * 1_000_000)),
      totalLands: data.lands.length,
      totalTransactions: data.transactions.length,
    };
  }

  // ===========================================================================
  // LAND QUERIES
  // ===========================================================================

  async listLands(): Promise<DeploymentLand[]> {
    const data = this.loadDeploymentData();
    return data.lands;
  }

  async getLand(landId: string): Promise<DeploymentLand | null> {
    const data = this.loadDeploymentData();
    return data.lands.find(l => l.landId === landId) ?? null;
  }

  // ===========================================================================
  // CREDIT BALANCE QUERIES
  // ===========================================================================

  async getCreditBalances(): Promise<Record<string, DeploymentCreditBalance>> {
    const data = this.loadDeploymentData();
    return data.creditBalances;
  }

  async getCreditBalance(address: Address): Promise<DeploymentCreditBalance | null> {
    const data = this.loadDeploymentData();
    return data.creditBalances[address] ?? null;
  }

  // ===========================================================================
  // IMPACT DEBT QUERIES
  // ===========================================================================

  async getImpactDebt(address: Address): Promise<number> {
    const data = this.loadDeploymentData();
    return data.impactDebt[address] ?? 0;
  }

  async getAllImpactDebt(): Promise<Record<string, number>> {
    const data = this.loadDeploymentData();
    return data.impactDebt;
  }

  // ===========================================================================
  // SPENDING BUCKET QUERIES
  // ===========================================================================

  async getSpendingBuckets(pnftId: AssetName): Promise<SpendingBucketDatum | null> {
    // Simulation doesn't have bucket data - return default
    return {
      owner_pnft: pnftId,
      buckets: [],
      total_funds: 0n,
      hydra_head: null,
      last_settlement: 0,
      created_at: Date.now(),
    };
  }

  async getBucket(pnftId: AssetName, bucketId: ByteArray): Promise<BucketState | null> {
    const buckets = await this.getSpendingBuckets(pnftId);
    if (!buckets) return null;
    return buckets.buckets.find(b => b.config.bucket_id === bucketId) ?? null;
  }

  async listBuckets(pnftId: AssetName): Promise<BucketState[]> {
    const buckets = await this.getSpendingBuckets(pnftId);
    return buckets?.buckets ?? [];
  }

  // ===========================================================================
  // TREASURY & BONDING CURVE QUERIES
  // ===========================================================================

  async getTreasuryState(): Promise<{
    totalSupply: bigint;
    distributed: bigint;
    reserved: bigint;
    adaReserve: bigint;
    currentPrice: number;
    nextEpochQueue: bigint;
    founderAccrued: bigint;
    founderClaimed: bigint;
    lastSettlement: number;
  }> {
    const data = this.loadDeploymentData();

    // Calculate distributed from balances
    const totalDistributed = Object.values(data.ultraBalances).reduce((sum, b) => sum + b, 0);
    const distributed = BigInt(Math.floor(totalDistributed * 1_000_000));
    const totalSupply = 400_000_000_000_000_000n; // 400B with 6 decimals
    const reserved = totalSupply - distributed;

    // Linear bonding curve: price = distributed / totalSupply
    const distributedRatio = Number(distributed) / Number(totalSupply);
    const currentPrice = distributedRatio > 0 ? distributedRatio : 0.0000000025;

    return {
      totalSupply,
      distributed,
      reserved,
      adaReserve: 0n,
      currentPrice,
      nextEpochQueue: 0n,
      founderAccrued: 0n,
      founderClaimed: 0n,
      lastSettlement: Date.now(),
    };
  }

  async getTokenPrice(): Promise<{
    pricePerToken: number;
    pricePerAda: number;
    distributed: string;
    remaining: string;
    percentDistributed: number;
  }> {
    const treasury = await this.getTreasuryState();

    const pricePerToken = treasury.currentPrice;
    const pricePerAda = pricePerToken > 0 ? 1 / pricePerToken : 400_000_000_000;
    const percentDistributed = (Number(treasury.distributed) / Number(treasury.totalSupply)) * 100;

    return {
      pricePerToken,
      pricePerAda,
      distributed: this.formatTokenAmount(treasury.distributed),
      remaining: this.formatTokenAmount(treasury.reserved),
      percentDistributed,
    };
  }

  async simulatePurchase(adaAmount: number): Promise<{
    adaSpent: number;
    tokensReceived: string;
    averagePrice: number;
    priceImpact: number;
    newPrice: number;
  }> {
    const treasury = await this.getTreasuryState();
    const lovelace = BigInt(Math.floor(adaAmount * 1_000_000));

    const currentPrice = treasury.currentPrice;
    const tokensReceived = currentPrice > 0
      ? BigInt(Math.floor(Number(lovelace) / currentPrice))
      : 0n;

    const newDistributed = treasury.distributed + tokensReceived;
    const newPrice = Number(newDistributed) / Number(treasury.totalSupply);

    const priceImpact = currentPrice > 0
      ? ((newPrice - currentPrice) / currentPrice) * 100
      : 0;

    const averagePrice = tokensReceived > 0n
      ? Number(lovelace) / Number(tokensReceived)
      : currentPrice;

    return {
      adaSpent: adaAmount,
      tokensReceived: this.formatTokenAmount(tokensReceived),
      averagePrice,
      priceImpact,
      newPrice,
    };
  }

  async getFounderStatus(): Promise<{
    monthlyUsd: number;
    startDate: string;
    totalMonths: number;
    totalOwed: number;
    tokensAccrued: string;
    tokensClaimed: string;
    tokensAvailable: string;
    nextSettlement: string;
  }> {
    const treasury = await this.getTreasuryState();

    const startDate = new Date('2020-01-01');
    const now = new Date();
    const totalMonths = (now.getFullYear() - startDate.getFullYear()) * 12 +
                        (now.getMonth() - startDate.getMonth());
    const totalOwed = totalMonths * 10000;

    const epochLength = 5 * 24 * 60 * 60 * 1000;
    const nextSettlement = new Date(Date.now() + epochLength);

    return {
      monthlyUsd: 10000,
      startDate: '2020-01-01',
      totalMonths,
      totalOwed,
      tokensAccrued: this.formatTokenAmount(treasury.founderAccrued),
      tokensClaimed: this.formatTokenAmount(treasury.founderClaimed),
      tokensAvailable: this.formatTokenAmount(treasury.founderAccrued - treasury.founderClaimed),
      nextSettlement: nextSettlement.toISOString(),
    };
  }

  private formatTokenAmount(amount: bigint): string {
    const withDecimals = Number(amount) / 1_000_000;
    if (withDecimals >= 1_000_000_000) {
      return `${(withDecimals / 1_000_000_000).toFixed(2)}B`;
    } else if (withDecimals >= 1_000_000) {
      return `${(withDecimals / 1_000_000).toFixed(2)}M`;
    } else if (withDecimals >= 1_000) {
      return `${(withDecimals / 1_000).toFixed(2)}K`;
    }
    return withDecimals.toFixed(2);
  }

  // ===========================================================================
  // TRANSACTION HISTORY
  // ===========================================================================

  async getTransactions(options?: {
    address?: string;
    pnftId?: string;
    bioregion?: string;
    limit?: number;
  }): Promise<DeploymentData['transactions']> {
    const data = this.loadDeploymentData();
    let txs = data.transactions;

    if (options?.address) {
      txs = txs.filter(t =>
        t.senderAddress === options.address ||
        t.recipientAddress === options.address
      );
    }

    if (options?.pnftId) {
      txs = txs.filter(t =>
        t.sender === options.pnftId ||
        t.recipient === options.pnftId
      );
    }

    if (options?.bioregion) {
      const data2 = this.loadDeploymentData();
      const bioregionPnfts = data2.pnfts
        .filter(p => p.bioregion === options.bioregion)
        .map(p => p.id);
      txs = txs.filter(t =>
        bioregionPnfts.includes(t.sender) ||
        bioregionPnfts.includes(t.recipient)
      );
    }

    if (options?.limit) {
      txs = txs.slice(-options.limit);
    }

    return txs;
  }

  // ===========================================================================
  // SEQUESTRATION CREDITS
  // ===========================================================================

  async getSequestrationCredits(): Promise<DeploymentData['sequestrationCredits']> {
    const data = this.loadDeploymentData();
    return data.sequestrationCredits;
  }

  async getCreditPurchases(): Promise<DeploymentData['creditPurchases']> {
    const data = this.loadDeploymentData();
    return data.creditPurchases;
  }
}

// =============================================================================
// EXPORTED TYPES
// =============================================================================

export type {
  DeploymentData,
  DeploymentPnft,
  DeploymentLand,
  DeploymentBioregionStats,
  DeploymentCreditBalance,
  DeploymentOffering,
  DeploymentNeed,
};

export default SimulationIndexer;
