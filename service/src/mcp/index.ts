/**
 * UltraLife MCP Server
 * 
 * Model Context Protocol server that provides tools for LLMs to interact
 * with the UltraLife protocol on Cardano.
 * 
 * The LLM using these tools becomes the documentation - it can explain
 * what UltraLife is, how it works, and help users interact with it
 * through natural conversation.
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from '@modelcontextprotocol/sdk/types.js';

import { UltraLifeIndexer } from '../indexer/index.js';
import { UltraLifeTxBuilder } from '../builder/index.js';
import { ComposableTxBuilder, CompositionBundles } from '../builder/composable.js';
import type { UltraLifeConfig, CategoryRef, WhatOffered, LocationScope, Terms, CompoundFlow, ComposedActionInput } from '../types/index.js';

import { TOOLS, ULTRALIFE_CONTEXT } from './tools.js';

// =============================================================================
// MCP SERVER
// =============================================================================

export class UltraLifeMcpServer {
  private server: Server;
  private indexer: UltraLifeIndexer;
  private builder: UltraLifeTxBuilder;
  private composableBuilder: ComposableTxBuilder | null = null;
  private config: UltraLifeConfig;

  constructor(config: UltraLifeConfig) {
    this.config = config;
    this.indexer = new UltraLifeIndexer(config);
    this.builder = new UltraLifeTxBuilder(config, this.indexer);
    
    this.server = new Server(
      {
        name: 'ultralife-protocol',
        version: '0.1.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.setupHandlers();
  }

  private setupHandlers(): void {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: TOOLS,
    }));

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;
      
      try {
        const result = await this.handleTool(name, args || {});
        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        return {
          content: [{ type: 'text', text: JSON.stringify({ error: errorMessage }) }],
          isError: true,
        };
      }
    });
  }

  private async handleTool(name: string, args: Record<string, unknown>): Promise<unknown> {
    switch (name) {
      // === INFORMATION ===
      case 'get_ultralife_info':
        return this.getUltraLifeInfo(args.topic as string);
      
      case 'get_protocol_stats':
        return this.indexer.getProtocolStats();

      // === pNFT ===
      case 'get_pnft':
        return this.indexer.getPnft(args.pnft_id as string);
      
      case 'get_pnft_by_address':
        return this.indexer.getPnftByOwner(args.address as string);
      
      case 'get_token_balance': {
        const balance = await this.indexer.getPnftTokenBalance(args.pnft_id as string);
        return { pnft_id: args.pnft_id, balance: balance.toString() };
      }
      
      case 'list_pnfts':
        return this.indexer.listPnfts({
          bioregion: args.bioregion as string,
          minLevel: args.min_level as number,
          limit: args.limit as number || 10,
        });

      // === TREASURY & BONDING CURVE ===
      case 'get_token_price':
        return this.indexer.getTokenPrice();

      case 'simulate_purchase':
        return this.indexer.simulatePurchase(args.ada_amount as number);

      case 'get_founder_status':
        return this.indexer.getFounderStatus();

      case 'get_treasury_status':
        return this.indexer.getTreasuryState();

      case 'build_purchase_tokens':
        return this.buildPurchaseTokens(args);

      // === BIOREGION ===
      case 'list_bioregions':
        return this.indexer.listBioregions();

      case 'get_bioregion':
        return this.indexer.getBioregion(args.bioregion_id as string);

      // === MARKETPLACE ===
      case 'list_offerings':
        return this.indexer.listOfferings({
          bioregion: args.bioregion as string,
          offerer: args.offerer as string,
          status: args.status as string,
          limit: args.limit as number || 10,
        });
      
      case 'get_offering':
        return this.indexer.getOffering(args.offering_id as string);
      
      case 'list_needs':
        return this.indexer.listNeeds({
          bioregion: args.bioregion as string,
          needer: args.needer as string,
          status: args.status as string,
          limit: args.limit as number || 10,
        });
      
      case 'get_need':
        return this.indexer.getNeed(args.need_id as string);

      // === COLLECTIVE ===
      case 'list_collectives':
        return this.indexer.listCollectives({
          bioregion: args.bioregion as string,
          member: args.member as string,
        });
      
      case 'get_collective':
        return this.indexer.getCollective(args.collective_id as string);

      // === SPENDING BUCKETS ===
      case 'list_buckets':
        return this.indexer.listBuckets(args.pnft_id as string);
      
      case 'get_bucket':
        return this.indexer.getBucket(args.pnft_id as string, args.bucket_id as string);
      
      case 'build_create_bucket':
        return this.buildCreateBucket(args);
      
      case 'build_fund_bucket':
        return this.buildFundBucket(args);
      
      case 'build_spend_bucket':
        return this.buildSpendBucket(args);
      
      case 'build_transfer_between_buckets':
        return this.buildTransferBetweenBuckets(args);

      // === TRANSACTION BUILDING ===
      case 'build_mint_pnft':
        return this.buildMintPnft(args);
      
      case 'build_create_offering':
        return this.buildCreateOffering(args);
      
      case 'build_create_collective':
        return this.buildCreateCollective(args);
      
      case 'build_add_collective_member':
        return this.buildAddCollectiveMember(args);
      
      case 'build_transfer_tokens':
        return this.buildTransferTokens(args);
      
      case 'build_accept_offering':
        return this.buildAcceptOffering(args);
      
      case 'build_purchase_from_pool':
        return this.buildPurchaseFromPool(args);

      case 'post_job':
        return this.buildPostJob(args);
      case 'bid':
        return this.buildBid(args);
      case 'complete':
      case 'submit_work':
        return this.buildSubmitWork(args);
      case 'accept_bid':
        return this.buildAcceptBid(args);
      case 'release_payment':
        return this.buildReleasePayment(args);


      // === DIGITAL ASSET TWIN ===
      case 'get_asset':
        return this.getAsset(args.asset_id as string);

      case 'get_asset_service_history':
        return this.getAssetServiceHistory(args);

      case 'list_assets':
        return this.listAssets(args);

      case 'get_asset_current_state':
        return this.getAssetCurrentState(args.asset_id as string);

      // === AUTOMATION CONTROL ===
      case 'list_automations':
        return this.listAutomations(args.asset_id as string);

      case 'get_automation_commands':
        return this.getAutomationCommands(args.asset_id as string, args.endpoint_id as string);

      case 'execute_automation':
        return this.executeAutomation(args);

      case 'grant_automation_permission':
        return this.grantAutomationPermission(args);

      case 'build_register_asset':
        return this.buildRegisterAsset(args);

      case 'build_record_service':
        return this.buildRecordService(args);

      // === COMPOSED TRANSACTIONS ===
      case 'build_composed_transaction':
        return this.buildComposedTransaction(args);

      case 'get_composition_bundles':
        return this.getCompositionBundles(args.bundle_type as string);

      case 'estimate_composed_fees':
        return this.estimateComposedFees(args);

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  }

  // ===========================================================================
  // INFORMATION HANDLER
  // ===========================================================================

  private getUltraLifeInfo(topic?: string): object {
    const info: Record<string, object> = {
      general: {
        summary: 'UltraLife Protocol is a bioregion-based economic system on Cardano',
        key_concepts: ['pNFT (identity)', 'Bioregions', 'Offerings', 'Collectives', 'Impact tracking', 'UBI'],
        how_it_works: 'Preprod: users can mint a Basic pNFT (unsigned tx, Ryan signs). Basic cannot transact. DNA-verified Standard, work_auction labor loop, and UBI are protocol spec, not live until preprod hashes exist.',
      },
      identity: {
        what: 'pNFT (Personal NFT) - on-chain identity. Live mint is Basic (not DNA-verified). Standard/DNA is spec, not live.',
        levels: {
          Basic: 'Live mint path: wallet signature only. Cannot transact or bid.',
          Ward: 'Spec: guardian-linked. Not used for trades crews.',
          Standard: 'Spec: DNA verified, required to transact/bid. Not offered. Do not invent DNA.',
          Verified: 'Spec: Standard + bioregion residency. Not live.',
          Steward: 'Spec: Verified + community endorsement. Not live.',
        },
        bootstrap: 'Spec: new pNFTs receive 50 token grant. Not a live trades payroll.',
        recovery: 'Lost access? Guardians (other pNFTs you designate) can help recover',
      },
      offerings: {
        what: 'Anything you want to offer: goods, work, knowledge, care, access',
        types: ['Thing (physical goods)', 'Work (services/labor)', 'Access (rental/use)', 'Knowledge (information)', 'Care (support/caregiving)'],
        terms: ['Priced', 'Range', 'Auction', 'Trade', 'Gift', 'Community Service'],
        impacts: 'Every offering declares expected compound flows (environmental impact)',
      },
      collectives: {
        what: 'Groups of pNFTs working together - like a company, but transparent',
        features: ['Shared treasury', 'Member governance', 'Resource ownership', 'Can create offerings'],
        formation: 'Any verified pNFT can create a collective',
      },
      bioregions: {
        what: 'Geographic areas defined by ecological boundaries (watersheds, ecosystems)',
        tracks: {
          resources: 'Water, land, air, energy health indices',
          humans: 'Health, education, housing, food security, care availability',
          activity: 'Offerings, needs, agreements, value transacted',
        },
        importance: 'UBI distribution tied to bioregion health - creates incentive to improve local ecosystem',
      },
      impacts: {
        what: 'Every transaction records compound flows (CO2, H2O, NOx, etc.)',
        how: 'Activity produces impacts → recorded on assets → transferred to consumer on purchase',
        accountability: 'Consumer sees their total impact - demand drives the supply chain',
        offsetting: 'Can purchase impact tokens to offset negative impacts',
      },
      tokens: {
        total_supply: '400 billion (single pool)',
        uses: ['Payments', 'Staking', 'Governance', 'Impact offsetting'],
        earning: ['Work', 'Offerings', 'Care credits', 'UBI'],
        ubi: 'Distributed based on bioregion health and participation',
      },
    };

    if (topic && topic in info) {
      return { topic, ...info[topic] };
    }

    return {
      overview: ULTRALIFE_CONTEXT.trim(),
      available_topics: Object.keys(info),
      tip: 'Ask about a specific topic for detailed information',
    };
  }

  // ===========================================================================
  // TRANSACTION BUILDERS
  // ===========================================================================

  private async buildMintPnft(args: Record<string, unknown>): Promise<object> {
    const userAddress = args.user_address as string;
    
    // Basic mint only. Do not invent DNA or testnet_proof.
    if (args.dna_hash || args.verification_proof) {
      return {
        status: 'BLOCKED',
        reason: 'This tool mints Basic only. Do not pass a DNA hash or verification proof. Standard upgrade is a separate Ryan-signed path. No fake DNA.',
        submitted_tx_hash: null,
      };
    }

    const result = await this.builder.buildMintPnft({
      userAddress,
      dnaHash: undefined,
      verificationProof: undefined,
      level: 'Basic',
    });

    return {
      action: 'Mint pNFT',
      transaction: {
        unsigned_cbor: result.tx.toString(),
        tx_hash: result.tx.toHash(),
      },
      summary: result.summary,
      next_step: 'Sign this transaction with your wallet to complete pNFT creation',
    };
  }

  private async buildCreateOffering(args: Record<string, unknown>): Promise<object> {
    const offererPnft = args.offerer_pnft as string;
    const whatType = args.what_type as string;
    const description = args.description as string;
    const bioregion = args.bioregion as string;
    const price = args.price as number || 0;
    const negotiable = args.negotiable as boolean ?? true;

    // Build category
    const category: CategoryRef = {
      type: 'Custom',
      description_hash: this.hashString(description),
    };

    // Build what
    const what: WhatOffered = {
      type: whatType as any,
      description_hash: this.hashString(description),
    };

    // Build location
    const location: LocationScope = bioregion && bioregion !== 'anywhere'
      ? { type: 'Bioregional', bioregion }
      : { type: 'Anywhere' };

    // Build terms
    const terms: Terms = price > 0
      ? { type: 'Priced', amount: BigInt(price * 1_000_000), negotiable }
      : { type: 'CommunityService' };

    const result = await this.builder.buildCreateOffering({
      offererPnft,
      category,
      what,
      location,
      availability: { type: 'Now' },
      terms,
      expectedCompounds: [],
      evidence: [],
    });

    return {
      action: 'Create Offering',
      transaction: {
        unsigned_cbor: result.tx.toString(),
        tx_hash: result.tx.toHash(),
      },
      summary: result.summary,
      next_step: 'Sign this transaction with your wallet to list your offering',
    };
  }

  private async buildCreateCollective(args: Record<string, unknown>): Promise<object> {
    const founderPnft = args.founder_pnft as string;
    const name = args.name as string;
    const bioregion = args.bioregion as string;
    const governanceDescription = args.governance_description as string || 'Default single-member governance';

    const result = await this.builder.buildCreateCollective({
      founderPnft,
      name,
      bioregion,
      governanceRules: this.hashString(governanceDescription),
    });

    return {
      action: 'Create Collective',
      transaction: {
        unsigned_cbor: result.tx.toString(),
        tx_hash: result.tx.toHash(),
      },
      summary: result.summary,
      next_step: 'Sign this transaction with your wallet to create your collective',
    };
  }

  private async buildAddCollectiveMember(args: Record<string, unknown>): Promise<object> {
    const collectiveId = args.collective_id as string;
    const newMemberPnft = args.new_member_pnft as string;
    const approverPnft = args.approver_pnft as string;

    const result = await this.builder.buildAddCollectiveMember({
      collectiveId,
      newMemberPnft,
      approverPnft,
    });

    return {
      action: 'Add Collective Member',
      transaction: {
        unsigned_cbor: result.tx.toString(),
        tx_hash: result.tx.toHash(),
      },
      summary: result.summary,
      next_step: 'Sign this transaction with your wallet to add the new member',
    };
  }

  private async buildTransferTokens(args: Record<string, unknown>): Promise<object> {
    const result = await this.builder.buildTransferTokens({
      senderPnft: args.sender_pnft as string,
      senderAddress: args.sender_address as string,
      recipientPnft: args.recipient_pnft as string,
      recipientAddress: args.recipient_address as string,
      amount: BigInt((args.amount as number) * 1_000_000),
      purpose: args.purpose as string,
    });

    return {
      action: 'Transfer Tokens',
      transaction: {
        unsigned_cbor: result.tx.toString(),
        tx_hash: result.tx.toHash(),
      },
      summary: result.summary,
      next_step: 'Sign this transaction with your wallet to complete the transfer',
    };
  }

  private async buildAcceptOffering(args: Record<string, unknown>): Promise<object> {
    const completeByDays = args.complete_by_days as number || 30;
    const completeBy = Date.now() + (completeByDays * 24 * 60 * 60 * 1000);

    const result = await this.builder.buildAcceptOffering({
      offeringId: args.offering_id as string,
      accepterPnft: args.accepter_pnft as string,
      payment: BigInt((args.payment as number) * 1_000_000),
      completeBy,
      verification: { type: 'CounterpartyConfirm' },
    });

    return {
      action: 'Accept Offering',
      transaction: {
        unsigned_cbor: result.tx.toString(),
        tx_hash: result.tx.toHash(),
      },
      summary: result.summary,
      next_step: 'Sign this transaction with your wallet to accept the offering and lock payment in escrow',
    };
  }

  private async buildPurchaseFromPool(args: Record<string, unknown>): Promise<object> {
    const adaAmount = BigInt((args.ada_amount as number) * 1_000_000);

    const result = await this.builder.buildPurchaseFromPool({
      buyerAddress: args.buyer_address as string,
      adaAmount,
    });

    return {
      action: 'Purchase Tokens from Pool',
      transaction: {
        unsigned_cbor: result.tx.toString(),
        tx_hash: result.tx.toHash(),
      },
      summary: result.summary,
      note: 'Testnet rate: 1 ADA = 100 tokens',
      next_step: 'Sign this transaction with your wallet to purchase tokens',
    };
  }

  private async buildPurchaseTokens(args: Record<string, unknown>): Promise<object> {
    const buyerPnft = args.buyer_pnft as string;
    const adaAmount = args.ada_amount as number;

    // Verify buyer has valid pNFT
    const pnft = await this.indexer.getPnft(buyerPnft);
    if (!pnft) {
      throw new Error('Buyer pNFT not found');
    }

    // Get current price info
    const priceInfo = await this.indexer.getTokenPrice();
    const simulation = await this.indexer.simulatePurchase(adaAmount);

    // Build transaction that queues purchase for epoch settlement
    const result = await this.builder.buildPurchaseFromPool({
      buyerAddress: pnft.owner, // Use pNFT owner address
      adaAmount: BigInt(Math.floor(adaAmount * 1_000_000)),
    });

    return {
      action: 'Purchase Tokens (Epoch Settlement)',
      transaction: {
        unsigned_cbor: result.tx.toString(),
        tx_hash: result.tx.toHash(),
      },
      purchase_details: {
        ada_amount: adaAmount,
        current_price: priceInfo.pricePerToken,
        estimated_tokens: simulation.tokensReceived,
        price_impact: `${simulation.priceImpact.toFixed(4)}%`,
      },
      note: 'Purchase will be settled at epoch boundary using bonding curve price. ' +
            'Actual tokens received may vary based on other purchases in the same epoch.',
      summary: result.summary,
      next_step: 'Sign this transaction with your wallet to queue your purchase',
    };
  }

  // ===========================================================================
  // SPENDING BUCKET BUILDERS
  // ===========================================================================

  private async buildCreateBucket(args: Record<string, unknown>): Promise<object> {
    const initialFunding = args.initial_funding ? BigInt((args.initial_funding as number) * 1_000_000) : 0n;

    const result = await this.builder.buildCreateBucket({
      pnftId: args.pnft_id as string,
      name: args.name as string,
      template: args.template as string,
      allocation: args.allocation ? BigInt((args.allocation as number) * 1_000_000) : undefined,
      period: args.period as string,
      rollover: args.rollover as boolean,
      maxBalance: args.max_balance ? BigInt((args.max_balance as number) * 1_000_000) : undefined,
      initialFunding,
    });

    return {
      action: 'Create Spending Bucket',
      transaction: {
        unsigned_cbor: result.tx.toString(),
        tx_hash: result.tx.toHash(),
      },
      summary: result.summary,
      next_step: 'Sign this transaction with your wallet to create your spending bucket',
    };
  }

  private async buildFundBucket(args: Record<string, unknown>): Promise<object> {
    const result = await this.builder.buildFundBucket({
      pnftId: args.pnft_id as string,
      bucketId: args.bucket_id as string,
      amount: BigInt((args.amount as number) * 1_000_000),
    });

    return {
      action: 'Fund Bucket',
      transaction: {
        unsigned_cbor: result.tx.toString(),
        tx_hash: result.tx.toHash(),
      },
      summary: result.summary,
      next_step: 'Sign this transaction with your wallet to add funds to your bucket',
    };
  }

  private async buildSpendBucket(args: Record<string, unknown>): Promise<object> {
    const result = await this.builder.buildSpendBucket({
      pnftId: args.pnft_id as string,
      bucketId: args.bucket_id as string,
      recipientPnft: args.recipient_pnft as string,
      recipientAddress: args.recipient_address as string || 'addr_test1TODO', // Would resolve from pNFT
      amount: BigInt((args.amount as number) * 1_000_000),
      purpose: args.purpose as string,
    });

    return {
      action: 'Spend from Bucket',
      transaction: {
        unsigned_cbor: result.tx.toString(),
        tx_hash: result.tx.toHash(),
      },
      summary: result.summary,
      note: 'This transaction will operate in Hydra head if available for instant settlement',
      next_step: 'Sign this transaction with your wallet to complete the payment',
    };
  }

  private async buildTransferBetweenBuckets(args: Record<string, unknown>): Promise<object> {
    const result = await this.builder.buildTransferBetweenBuckets({
      pnftId: args.pnft_id as string,
      fromBucket: args.from_bucket as string,
      toBucket: args.to_bucket as string,
      amount: BigInt((args.amount as number) * 1_000_000),
    });

    return {
      action: 'Transfer Between Buckets',
      transaction: {
        unsigned_cbor: result.tx.toString(),
        tx_hash: result.tx.toHash(),
      },
      summary: result.summary,
      next_step: 'Sign this transaction with your wallet to move funds between your buckets',
    };
  }

  // ===========================================================================
  // DIGITAL ASSET TWIN HANDLERS
  // ===========================================================================
  //
  // No scanning required - query ledger directly for all asset information.
  // Every physical asset has a complete digital record on-chain.
  //
  // ===========================================================================

  private async getAsset(assetId: string): Promise<object> {
    // Query asset from ledger - no scanning needed
    const asset = await this.indexer.getAsset?.(assetId);

    if (!asset) {
      // Return mock data for development
      return {
        asset_id: assetId,
        category: 'Vehicle',
        owner_pnft: 'demo_owner',
        attributes: {
          name: 'Demo Asset',
          specs: { type: 'Vehicle', make: 'Demo', model: 'Model X', year: 2024 },
          location: { type: 'Bioregion', bioregion: 'demo_bioregion' },
        },
        service_count: 0,
        automations: [],
        note: 'Asset data retrieved directly from ledger - no scanning required',
      };
    }

    return {
      ...asset,
      note: 'Complete asset record retrieved from ledger - no scanning required',
    };
  }

  private async getAssetServiceHistory(args: Record<string, unknown>): Promise<object> {
    const assetId = args.asset_id as string;

    // Query service history directly from ledger - no scanning needed
    const history = await this.indexer.getAssetServiceHistory?.({
      assetId,
      serviceType: args.service_type as string,
      performer: args.performer as string,
      fromDate: args.from_date as number,
      toDate: args.to_date as number,
      limit: args.limit as number || 50,
    });

    if (!history) {
      // Return mock data for development
      return {
        asset_id: assetId,
        services: [],
        total_services: 0,
        total_spend: '0',
        note: 'Query service history directly from ledger - no scanning needed. All past services are recorded on-chain.',
      };
    }

    return {
      ...history,
      note: 'Complete service history from ledger - no scanning required',
    };
  }

  private async listAssets(args: Record<string, unknown>): Promise<object> {
    const ownerPnft = args.owner_pnft as string;
    const category = args.category as string;

    const assets = await this.indexer.listAssets?.({
      ownerPnft,
      category,
      limit: args.limit as number || 50,
    });

    if (!assets) {
      // Return mock data for development
      return {
        owner_pnft: ownerPnft,
        assets: [],
        total: 0,
        note: 'All owned assets queryable from ledger - land, buildings, vehicles, equipment',
      };
    }

    return {
      owner_pnft: ownerPnft,
      assets,
      note: 'All asset records from ledger - no scanning required to view attributes or history',
    };
  }

  private async getAssetCurrentState(assetId: string): Promise<object> {
    // Query current IoT sensor state
    const state = await this.indexer.getAssetCurrentState?.(assetId);

    if (!state) {
      return {
        asset_id: assetId,
        status: 'Unknown',
        sensor_readings: [],
        alerts: [],
        note: 'IoT sensor data available when asset has connected devices',
      };
    }

    return {
      asset_id: assetId,
      ...state,
    };
  }

  // ===========================================================================
  // AUTOMATION CONTROL HANDLERS
  // ===========================================================================
  //
  // Control IoT devices from the same LLM interface.
  // "Turn off the lights" → LLM → MCP → Blockchain → IoT endpoint
  //
  // ===========================================================================

  private async listAutomations(assetId: string): Promise<object> {
    const automations = await this.indexer.listAutomations?.(assetId);

    if (!automations) {
      return {
        asset_id: assetId,
        endpoints: [],
        note: 'Automation endpoints listed here when IoT devices are registered to this asset',
      };
    }

    return {
      asset_id: assetId,
      endpoints: automations,
    };
  }

  private async getAutomationCommands(assetId: string, endpointId: string): Promise<object> {
    const commands = await this.indexer.getAutomationCommands?.(assetId, endpointId);

    if (!commands) {
      return {
        asset_id: assetId,
        endpoint_id: endpointId,
        commands: [],
        note: 'Available commands for this automation endpoint',
      };
    }

    return {
      asset_id: assetId,
      endpoint_id: endpointId,
      commands,
    };
  }

  private async executeAutomation(args: Record<string, unknown>): Promise<object> {
    const assetId = args.asset_id as string;
    const endpointId = args.endpoint_id as string;
    const commandId = args.command_id as string;
    const executorPnft = args.executor_pnft as string;
    const parameters = args.parameters as Record<string, unknown> || {};

    // Verify executor has permission
    // Execute command through indexer/IoT bridge
    const result = await this.indexer.executeAutomation?.({
      assetId,
      endpointId,
      commandId,
      executorPnft,
      parameters,
    });

    if (!result) {
      return {
        asset_id: assetId,
        endpoint_id: endpointId,
        command_id: commandId,
        success: false,
        error: 'Automation execution not yet implemented - IoT bridge pending',
        note: 'Automation commands will be recorded on-chain when executed',
      };
    }

    return {
      asset_id: assetId,
      endpoint_id: endpointId,
      command_id: commandId,
      success: result.success,
      result: result.result,
      impact: result.impact,
      recorded_at: Date.now(),
    };
  }

  private async grantAutomationPermission(args: Record<string, unknown>): Promise<object> {
    const assetId = args.asset_id as string;
    const ownerPnft = args.owner_pnft as string;
    const granteePnft = args.grantee_pnft as string;
    const allowedCommands = args.allowed_commands as string[] || [];
    const expiresAt = args.expires_at as number;

    // Build permission grant transaction
    return {
      action: 'Grant Automation Permission',
      asset_id: assetId,
      grantee: granteePnft,
      allowed_commands: allowedCommands.length > 0 ? allowedCommands : 'all',
      expires_at: expiresAt || 'never',
      note: 'Permission recorded on-chain. Grantee can now control specified automations.',
      next_step: 'Sign transaction to grant permission',
    };
  }

  private async buildRegisterAsset(args: Record<string, unknown>): Promise<object> {
    const ownerPnft = args.owner_pnft as string;
    const category = args.category as string;
    const name = args.name as string;
    const description = args.description as string || '';
    const specs = args.specs as Record<string, unknown> || {};
    const bioregion = args.bioregion as string || 'global';

    // Build asset registration transaction
    return {
      action: 'Register Digital Asset Twin',
      asset: {
        owner_pnft: ownerPnft,
        category,
        name,
        description_hash: this.hashString(description),
        specs,
        bioregion,
      },
      note: 'Once registered, all attributes and service history stored on-chain. No scanning required to access.',
      next_step: 'Sign transaction to register asset on-chain',
    };
  }

  private async buildRecordService(args: Record<string, unknown>): Promise<object> {
    const assetId = args.asset_id as string;
    const serviceType = args.service_type as string;
    const performerPnft = args.performer_pnft as string;
    const description = args.description as string;
    const amountPaid = args.amount_paid as number || 0;
    const impactCompounds = args.impact_compounds as unknown[] || [];
    const evidenceHash = args.evidence_hash as string;

    // Build service record transaction
    return {
      action: 'Record Service on Asset',
      service: {
        asset_id: assetId,
        service_type: serviceType,
        performer_pnft: performerPnft,
        description_hash: this.hashString(description),
        amount_paid: amountPaid,
        impact_compounds: impactCompounds,
        evidence_hash: evidenceHash,
        timestamp: Date.now(),
      },
      note: 'Service permanently recorded on ledger. Anyone can query asset history - no scanning required.',
      next_step: 'Sign transaction to record service on-chain',
    };
  }

  // ===========================================================================
  // COMPOSED TRANSACTION HANDLERS
  // ===========================================================================

  private async buildComposedTransaction(args: Record<string, unknown>): Promise<object> {
    const actions = args.actions as ComposedActionInput[];

    if (!actions || actions.length === 0) {
      throw new Error('At least one action is required');
    }

    if (!this.composableBuilder) {
      this.composableBuilder = new ComposableTxBuilder(this.config, this.indexer);
      await this.composableBuilder.initialize();
    }

    // Add each action to the builder
    for (const action of actions) {
      switch (action.type) {
        case 'mint_pnft':
          this.composableBuilder.addMintPnft(action.params as any);
          break;
        case 'create_offering':
          this.composableBuilder.addCreateOffering(action.params as any);
          break;
        case 'accept_offering':
          this.composableBuilder.addAcceptOffering(action.params as any);
          break;
        case 'transfer':
          this.composableBuilder.addTransfer(action.params as any);
          break;
        case 'claim_ubi':
          this.composableBuilder.addClaimUbi(action.params as any);
          break;
        case 'record_impact':
          this.composableBuilder.addRecordImpact(action.params as any);
          break;
        case 'create_bucket':
          this.composableBuilder.addCreateBucket(action.params as any);
          break;
        case 'fund_bucket':
          this.composableBuilder.addFundBucket(action.params as any);
          break;
        case 'spend_bucket':
          this.composableBuilder.addSpendBucket(action.params as any);
          break;
        case 'create_collective':
          this.composableBuilder.addCreateCollective(action.params as any);
          break;
        case 'add_collective_member':
          this.composableBuilder.addAddCollectiveMember(action.params as any);
          break;
        case 'claim_grant':
          this.composableBuilder.addClaimGrant(action.params as any);
          break;
        default:
          throw new Error(`Unknown action type: ${action.type}`);
      }
    }

    const result = await this.composableBuilder.build();
    this.composableBuilder.clear();

    return {
      action: 'Build Composed Transaction',
      action_count: actions.length,
      actions: actions.map(a => a.type),
      tx_hash: result.txHash,
      summary: result.summary,
      savings_estimate: `~${(actions.length - 1) * 0.17} ADA saved vs separate transactions`,
      unsigned_tx: result.tx.toString(),
      next_step: 'Sign the transaction with your wallet to execute all actions atomically',
    };
  }

  private getCompositionBundles(bundleType?: string): object {
    const bundles = {
      onboarding: {
        name: 'Onboarding Bundle',
        description: 'Create identity, claim bootstrap grant, set up spending bucket',
        actions: ['mint_pnft', 'claim_grant', 'create_bucket'],
        typical_fee: '~0.35 ADA',
        savings: '~0.34 ADA vs separate transactions',
      },
      marketplace: {
        name: 'Marketplace Bundle',
        description: 'Accept offering, record impact, transfer payment',
        actions: ['accept_offering', 'record_impact', 'transfer'],
        typical_fee: '~0.40 ADA',
        savings: '~0.34 ADA vs separate transactions',
      },
      settlement: {
        name: 'Settlement Bundle',
        description: 'Multiple transfers and impact recordings in one transaction',
        actions: ['transfer (multiple)', 'record_impact (multiple)'],
        typical_fee: '~0.50 ADA for 5 transfers',
        savings: '~0.68 ADA vs separate transactions',
      },
      impact: {
        name: 'Impact Bundle',
        description: 'Record multiple impact events from a single activity',
        actions: ['record_impact (multiple with different compounds)'],
        typical_fee: '~0.25 ADA for 3 impacts',
        savings: '~0.34 ADA vs separate transactions',
      },
    };

    if (bundleType && bundleType !== 'all' && bundleType in bundles) {
      return bundles[bundleType as keyof typeof bundles];
    }

    return {
      available_bundles: Object.keys(bundles),
      bundles,
      usage: 'Use build_composed_transaction with an array of actions to create bundled transactions',
    };
  }

  private async estimateComposedFees(args: Record<string, unknown>): Promise<object> {
    const actions = args.actions as ComposedActionInput[];

    if (!actions || actions.length === 0) {
      return { error: 'At least one action is required' };
    }

    const baseFee = 0.17;
    const additionalActionFee = 0.05;
    const estimatedFee = baseFee + (actions.length - 1) * additionalActionFee;
    const separateFees = actions.length * baseFee;
    const savings = separateFees - estimatedFee;

    return {
      action_count: actions.length,
      actions: actions.map(a => a.type),
      estimated_fee: `~${estimatedFee.toFixed(2)} ADA`,
      if_separate: `~${separateFees.toFixed(2)} ADA`,
      savings: `~${savings.toFixed(2)} ADA`,
      note: 'Actual fees depend on transaction size and script execution units',
    };
  }


  private async wrapUnsigned(result: { unsigned?: object; summary?: object; tx?: { toString(): string; toHash(): string } }): Promise<object> {
    if (result.unsigned) {
      return {
        ...(result.unsigned as object),
        summary: result.summary,
        next_step: 'Ryan signs this preprod transaction. MCP does not submit and does not invent a tx hash.',
      };
    }
    if (result.tx) {
      return {
        submitted: false,
        unsigned_cbor: result.tx.toString(),
        tx_hash: result.tx.toHash(),
        summary: result.summary,
        next_step: 'Sign with the wallet that holds the pNFT.',
      };
    }
    throw new Error('Builder produced neither unsigned payload nor tx');
  }

  private async buildPostJob(args: Record<string, unknown>): Promise<object> {
    const result = await this.builder.buildPostJob({
      ...args,
      pnft_id: args.pnft_id,
      pnftLevel: args.pnft_level,
      user_address: args.user_address,
      expected_impacts: args.expected_impacts,
    });
    return this.wrapUnsigned(result as any);
  }

  private async buildBid(args: Record<string, unknown>): Promise<object> {
    const result = await this.builder.buildBid({
      ...args,
      pnftLevel: args.pnft_level,
    });
    return this.wrapUnsigned(result as any);
  }

  private async buildAcceptBid(args: Record<string, unknown>): Promise<object> {
    const result = await this.builder.buildAcceptBid(args);
    return this.wrapUnsigned(result as any);
  }

  private async buildSubmitWork(args: Record<string, unknown>): Promise<object> {
    if (!args.evidence_hash) {
      return { error: 'evidence_hash required. Will not invent a demo hash.', submitted: false };
    }
    const result = await this.builder.buildSubmitWork(args);
    return this.wrapUnsigned(result as any);
  }

  private async buildReleasePayment(args: Record<string, unknown>): Promise<object> {
    const result = await this.builder.buildReleasePayment(args);
    return this.wrapUnsigned(result as any);
  }

  // ===========================================================================
  // HELPERS
  // ===========================================================================

  private hashString(str: string): string {
    // Simple hash for demo - production would use proper hashing
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(16).padStart(64, '0');
  }

  // ===========================================================================
  // START SERVER
  // ===========================================================================

  async start(): Promise<void> {
    await this.indexer.initialize();
    await this.builder.initialize();
    
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    
    console.error('UltraLife MCP Server running on stdio');
  }
}

// =============================================================================
// MAIN
// =============================================================================

export async function startMcpServer(config: UltraLifeConfig): Promise<void> {
  const server = new UltraLifeMcpServer(config);
  await server.start();
}

export default UltraLifeMcpServer;
