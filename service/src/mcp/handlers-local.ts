/**
 * Local Mode Handlers for UltraLife MCP Server
 *
 * These handlers use deployment.json instead of blockchain queries,
 * enabling development and testing without actual blockchain deployment.
 */

import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

// =============================================================================
// TYPES
// =============================================================================

interface PnftRecord {
  id: string;
  owner: string;
  level: string;
  bioregion: string;
  createdAt: string;
  createdSlot: number;
  status: string;
  testnetSimulated: boolean;
  lands_stewarded?: string[];
}

interface LandRecord {
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
  registered_at: number;
  registeredAt: string;
  testnetSimulated: boolean;
}

interface TransactionRecord {
  txHash: string;
  sender: string;
  senderAddress: string;
  senderBioregion: string;
  recipient: string;
  recipientAddress: string;
  recipientBioregion: string;
  amount: number;
  txType: {
    code: number;
    name: string;
    description: string;
  };
  impact: {
    description: string;
    compounds: Array<{
      compound: string;
      quantity: number;
      unit: string;
      confidence: number;
    }>;
    netImpact: number;
    evidenceHash: string;
  };
  note: string;
  slot: number;
  timestamp: string;
  testnetSimulated: boolean;
}

interface BioregionStats {
  totalLandArea: number;
  landsRegistered: number;
  totalSequestrationCapacity: number;
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
  pnfts: PnftRecord[];
  ultraBalances: Record<string, number>;
  signupGrants: Array<{
    pnftId: string;
    pnftOwner: string;
    amount: number;
    claimedAt: string;
    testnetSimulated: boolean;
  }>;
  lands: LandRecord[];
  bioregionStats: Record<string, BioregionStats>;
  transactions: TransactionRecord[];
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
    testnetSimulated: boolean;
  }>;
  creditBalances: Record<string, {
    total: number;
    available: number;
    sold: number;
    byLand: Record<string, number>;
  }>;
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
    testnetSimulated: boolean;
  }>;
  marketplace?: Array<{
    id: string;
    offerer: string;
    what: string;
    description: string;
    price: number;
    status: string;
    bioregion: string;
    createdAt: string;
  }>;
  care?: Array<{
    id: string;
    needer: string;
    description: string;
    status: string;
    bioregion: string;
    createdAt: string;
  }>;
}

interface ProtocolSpec {
  protocol: string;
  version: string;
  network: string;
  description: string;
  principles: string[];
  compounds: Record<string, Record<string, {
    name: string;
    unit: string;
    direction?: string;
    example?: string;
    note?: string;
  }>>;
  confidence_levels: Record<string, {
    method: string;
    description: string;
    verify_days: number | null;
  }>;
  transaction_types: Record<string, {
    code: number;
    description: string;
    example: string;
  }>;
  land_sequestration: {
    description: string;
    rates_tCO2_per_ha_per_year: Record<string, number>;
    credit_price_ultra: number;
    credit_generation: string;
  };
  llm_instructions: Record<string, string[]>;
}

// =============================================================================
// LOCAL HANDLERS CLASS
// =============================================================================

export class LocalModeHandlers {
  private deploymentData: DeploymentData | null = null;
  private protocolSpec: ProtocolSpec | null = null;
  private deploymentPath: string;
  private protocolSpecPath: string;

  constructor(deploymentPath: string, protocolSpecPath?: string) {
    this.deploymentPath = deploymentPath;
    // Default protocol spec path relative to deployment path
    this.protocolSpecPath = protocolSpecPath || resolve(dirname(deploymentPath), '../protocol-spec.json');
  }

  // ===========================================================================
  // INITIALIZATION
  // ===========================================================================

  async initialize(): Promise<void> {
    this.loadDeploymentData();
    this.loadProtocolSpec();
    console.error(`[LOCAL MODE] Loaded deployment data from: ${this.deploymentPath}`);
    console.error(`[LOCAL MODE] pNFTs: ${this.deploymentData?.pnfts.length || 0}`);
    console.error(`[LOCAL MODE] Lands: ${this.deploymentData?.lands.length || 0}`);
    console.error(`[LOCAL MODE] Transactions: ${this.deploymentData?.transactions.length || 0}`);
  }

  private loadDeploymentData(): void {
    if (!existsSync(this.deploymentPath)) {
      throw new Error(`Deployment file not found: ${this.deploymentPath}`);
    }
    const content = readFileSync(this.deploymentPath, 'utf-8');
    this.deploymentData = JSON.parse(content);
  }

  private loadProtocolSpec(): void {
    if (existsSync(this.protocolSpecPath)) {
      const content = readFileSync(this.protocolSpecPath, 'utf-8');
      this.protocolSpec = JSON.parse(content);
    } else {
      console.error(`[LOCAL MODE] Protocol spec not found at: ${this.protocolSpecPath}`);
    }
  }

  private getData(): DeploymentData {
    if (!this.deploymentData) {
      throw new Error('Deployment data not loaded. Call initialize() first.');
    }
    return this.deploymentData;
  }

  // ===========================================================================
  // TOOL HANDLERS
  // ===========================================================================

  /**
   * get_ultralife_info - Return protocol documentation from protocol-spec.json
   */
  getUltraLifeInfo(topic?: string): object {
    const spec = this.protocolSpec;

    const info: Record<string, object> = {
      general: {
        protocol: spec?.protocol || 'UltraLife',
        version: spec?.version || '1.0.0',
        network: spec?.network || 'cardano',
        description: spec?.description || 'Impact-tracked economy on Cardano',
        principles: spec?.principles || [],
        key_concepts: ['pNFT (identity)', 'Bioregions', 'Offerings', 'Collectives', 'Impact tracking', 'UBI'],
      },
      identity: {
        what: 'pNFT (Personal NFT) - your permanent, DNA-verified identity on-chain',
        levels: {
          Basic: 'Wallet only (limited functionality)',
          Standard: 'DNA verified (full functionality)',
          Verified: 'Standard + bioregion residency confirmed',
          Steward: 'Verified + community endorsement (governance rights)',
        },
        bootstrap: 'New pNFTs receive 50 token grant',
      },
      compounds: spec?.compounds || {},
      confidence_levels: spec?.confidence_levels || {},
      transaction_types: spec?.transaction_types || {},
      land_sequestration: spec?.land_sequestration || {},
      llm_instructions: spec?.llm_instructions || {},
    };

    if (topic && topic in info) {
      return { topic, ...info[topic], mode: 'local' };
    }

    return {
      overview: spec?.description || 'UltraLife Protocol - Impact-tracked economy on Cardano',
      available_topics: Object.keys(info),
      tip: 'Ask about a specific topic for detailed information',
      mode: 'local',
    };
  }

  /**
   * get_protocol_stats - Aggregate statistics from deployment.json
   */
  getProtocolStats(): object {
    const data = this.getData();

    // Calculate total value locked (sum of all balances)
    const totalBalance = Object.values(data.ultraBalances).reduce((sum, bal) => sum + bal, 0);

    // Calculate total transactions volume
    const totalVolume = data.transactions.reduce((sum, tx) => sum + tx.amount, 0);

    // Count bioregions
    const bioregions = Object.keys(data.bioregionStats);

    // Calculate total land area
    const totalLandArea = Object.values(data.bioregionStats).reduce(
      (sum, stats) => sum + stats.totalLandArea, 0
    );

    return {
      mode: 'local',
      total_pnfts: data.pnfts.length,
      total_bioregions: bioregions.length,
      bioregion_names: bioregions,
      total_lands: data.lands.length,
      total_land_area_m2: totalLandArea,
      total_transactions: data.transactions.length,
      total_volume_ultra: totalVolume,
      total_value_locked: totalBalance,
      sequestration_credits_generated: data.sequestrationCredits.length,
      impact_tokens_minted: data.impactTokens.length,
      test_users: data.testUsers.length,
    };
  }

  /**
   * get_pnft - Lookup pNFT by ID in deployment.pnfts
   */
  getPnft(pnftId: string): object | null {
    const data = this.getData();
    const pnft = data.pnfts.find(p => p.id === pnftId);

    if (!pnft) {
      return { error: `pNFT not found: ${pnftId}`, mode: 'local' };
    }

    // Find associated user info if available
    const user = data.testUsers.find(u => u.pnftId === pnftId);

    // Get token balance
    const balance = data.ultraBalances[pnft.owner] || 0;

    // Get impact debt
    const impactDebt = data.impactDebt[pnft.owner] || 0;

    return {
      ...pnft,
      user_name: user?.name || null,
      token_balance: balance,
      impact_debt: impactDebt,
      mode: 'local',
    };
  }

  /**
   * list_pnfts - Return all pNFTs with optional filters
   */
  listPnfts(filters?: { bioregion?: string; minLevel?: number; limit?: number }): object {
    const data = this.getData();
    let pnfts = [...data.pnfts];

    // Filter by bioregion
    if (filters?.bioregion) {
      pnfts = pnfts.filter(p => p.bioregion === filters.bioregion);
    }

    // Filter by minimum level (Basic=0, Standard=1, Verified=2, Steward=3)
    if (filters?.minLevel !== undefined) {
      const levelMap: Record<string, number> = {
        'Basic': 0,
        'Standard': 1,
        'Verified': 2,
        'Steward': 3,
      };
      pnfts = pnfts.filter(p => (levelMap[p.level] || 0) >= filters.minLevel!);
    }

    // Apply limit
    const limit = filters?.limit || 10;
    pnfts = pnfts.slice(0, limit);

    // Enrich with balances
    const enriched = pnfts.map(p => ({
      ...p,
      token_balance: data.ultraBalances[p.owner] || 0,
    }));

    return {
      count: enriched.length,
      total: data.pnfts.length,
      pnfts: enriched,
      mode: 'local',
    };
  }

  /**
   * get_token_balance - Get balance from ultraBalances by pNFT ID
   */
  getTokenBalance(pnftId: string): object {
    const data = this.getData();
    const pnft = data.pnfts.find(p => p.id === pnftId);

    if (!pnft) {
      return { error: `pNFT not found: ${pnftId}`, mode: 'local' };
    }

    const balance = data.ultraBalances[pnft.owner] || 0;
    const impactDebt = data.impactDebt[pnft.owner] || 0;

    return {
      pnft_id: pnftId,
      owner: pnft.owner,
      balance: balance.toString(),
      balance_formatted: `${balance.toFixed(6)} ULTRA`,
      impact_debt: impactDebt,
      mode: 'local',
    };
  }

  /**
   * list_bioregions - Return all bioregions from bioregionStats
   */
  listBioregions(): object {
    const data = this.getData();

    const bioregions = Object.entries(data.bioregionStats).map(([name, stats]) => {
      const impact = data.bioregionImpact[name];
      return {
        id: name,
        name: name.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
        ...stats,
        impact: impact ? {
          totalTransactions: impact.totalTransactions,
          totalVolume: impact.totalVolume,
          netImpact: impact.netImpact,
        } : null,
      };
    });

    return {
      count: bioregions.length,
      bioregions,
      mode: 'local',
    };
  }

  /**
   * get_bioregion - Get detailed bioregion info
   */
  getBioregion(bioregionId: string): object {
    const data = this.getData();
    const stats = data.bioregionStats[bioregionId];

    if (!stats) {
      return { error: `Bioregion not found: ${bioregionId}`, mode: 'local' };
    }

    const impact = data.bioregionImpact[bioregionId];
    const lands = data.lands.filter(l => l.bioregion === bioregionId);
    const pnfts = data.pnfts.filter(p => p.bioregion === bioregionId);

    return {
      id: bioregionId,
      name: bioregionId.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
      stats,
      impact: impact || null,
      lands_count: lands.length,
      pnfts_count: pnfts.length,
      mode: 'local',
    };
  }

  /**
   * list_offerings - Return marketplace offerings if exists
   */
  listOfferings(filters?: { bioregion?: string; offerer?: string; status?: string; limit?: number }): object {
    const data = this.getData();

    if (!data.marketplace || data.marketplace.length === 0) {
      return {
        count: 0,
        offerings: [],
        message: 'No marketplace offerings in deployment data',
        mode: 'local',
      };
    }

    let offerings = [...data.marketplace];

    if (filters?.bioregion) {
      offerings = offerings.filter(o => o.bioregion === filters.bioregion);
    }
    if (filters?.offerer) {
      offerings = offerings.filter(o => o.offerer === filters.offerer);
    }
    if (filters?.status) {
      offerings = offerings.filter(o => o.status === filters.status);
    }

    const limit = filters?.limit || 10;
    offerings = offerings.slice(0, limit);

    return {
      count: offerings.length,
      total: data.marketplace.length,
      offerings,
      mode: 'local',
    };
  }

  /**
   * list_needs - Return care/needs if exists
   */
  listNeeds(filters?: { bioregion?: string; needer?: string; status?: string; limit?: number }): object {
    const data = this.getData();

    if (!data.care || data.care.length === 0) {
      return {
        count: 0,
        needs: [],
        message: 'No care/needs in deployment data',
        mode: 'local',
      };
    }

    let needs = [...data.care];

    if (filters?.bioregion) {
      needs = needs.filter(n => n.bioregion === filters.bioregion);
    }
    if (filters?.needer) {
      needs = needs.filter(n => n.needer === filters.needer);
    }
    if (filters?.status) {
      needs = needs.filter(n => n.status === filters.status);
    }

    const limit = filters?.limit || 10;
    needs = needs.slice(0, limit);

    return {
      count: needs.length,
      total: data.care.length,
      needs,
      mode: 'local',
    };
  }

  /**
   * get_land - Lookup land by ID
   */
  getLand(landId: string): object | null {
    const data = this.getData();
    const land = data.lands.find(l => l.landId === landId);

    if (!land) {
      return { error: `Land not found: ${landId}`, mode: 'local' };
    }

    // Find sequestration credits for this land
    const credits = data.sequestrationCredits.filter(c => c.landId === landId);
    const creditBalance = data.creditBalances[land.stewardAddress]?.byLand[landId] || 0;

    return {
      ...land,
      sequestration_credits: credits,
      total_credits_generated: creditBalance,
      mode: 'local',
    };
  }

  /**
   * list_lands - Return all lands with optional filters
   */
  listLands(filters?: { bioregion?: string; steward?: string; limit?: number }): object {
    const data = this.getData();
    let lands = [...data.lands];

    if (filters?.bioregion) {
      lands = lands.filter(l => l.bioregion === filters.bioregion);
    }
    if (filters?.steward) {
      lands = lands.filter(l => l.primarySteward === filters.steward);
    }

    const limit = filters?.limit || 10;
    lands = lands.slice(0, limit);

    return {
      count: lands.length,
      total: data.lands.length,
      lands: lands.map(l => ({
        id: l.landId,
        name: l.name,
        area_m2: l.area_m2,
        bioregion: l.bioregion,
        classification: l.classification.name,
        health_index: l.health.overall_index,
        steward: l.primarySteward,
        sequestration_rate: l.classification.sequestrationRate,
      })),
      mode: 'local',
    };
  }

  /**
   * get_pnft_by_address - Find pNFT by wallet address
   */
  getPnftByAddress(address: string): object | null {
    const data = this.getData();
    const pnft = data.pnfts.find(p => p.owner === address);

    if (!pnft) {
      return { error: `No pNFT found for address: ${address}`, mode: 'local' };
    }

    return this.getPnft(pnft.id);
  }

  /**
   * list_transactions - Return transactions (bonus helper)
   */
  listTransactions(filters?: { sender?: string; recipient?: string; bioregion?: string; limit?: number }): object {
    const data = this.getData();
    let transactions = [...data.transactions];

    if (filters?.sender) {
      transactions = transactions.filter(t => t.sender === filters.sender);
    }
    if (filters?.recipient) {
      transactions = transactions.filter(t => t.recipient === filters.recipient);
    }
    if (filters?.bioregion) {
      transactions = transactions.filter(t =>
        t.senderBioregion === filters.bioregion || t.recipientBioregion === filters.bioregion
      );
    }

    const limit = filters?.limit || 10;
    transactions = transactions.slice(0, limit);

    return {
      count: transactions.length,
      total: data.transactions.length,
      transactions,
      mode: 'local',
    };
  }

  /**
   * get_sequestration_credits - Get credit info
   */
  getSequestrationCredits(): object {
    const data = this.getData();

    return {
      total_credits: data.sequestrationCredits.length,
      credits: data.sequestrationCredits,
      balances: data.creditBalances,
      purchases: data.creditPurchases,
      mode: 'local',
    };
  }
}

export default LocalModeHandlers;
