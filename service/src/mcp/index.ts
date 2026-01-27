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
import { UbiOperations } from '../sdk/ubi.js';
import type { UltraLifeConfig, CategoryRef, WhatOffered, LocationScope, Terms, CompoundFlow } from '../types/index.js';

// =============================================================================
// PROTOCOL CONTEXT (What the LLM knows about UltraLife)
// =============================================================================

const ULTRALIFE_CONTEXT = `
UltraLife Protocol is a bioregion-based economic system on Cardano where:

IDENTITY (pNFT):
- Every human has ONE identity, verified by DNA
- pNFT = Personal NFT, your permanent on-chain identity
- Verification levels: Basic → Standard (DNA) → Verified (bioregion) → Steward (community)
- New pNFTs receive 50 token bootstrap grant

OFFERINGS & NEEDS:
- Anyone can offer anything: work, goods, knowledge, care, access
- Anyone can post needs: work requests, purchases, services needed
- Agreements form when offers match needs
- All transactions record compound flows (environmental impact)

COLLECTIVES:
- Groups of pNFTs working together (like a business)
- Have shared treasury and governance
- Can own resources and create offerings

BIOREGIONS:
- Geographic areas defined by ecological boundaries (not political)
- Track resource health: water, land, air, energy
- Track human wellbeing: health, education, housing, food security
- UBI distribution based on bioregion health

IMPACTS:
- Every transaction declares compound flows (CO2, H2O, etc.)
- Consumer accrues the impact of their purchases
- Creates accountability without middlemen

TOKENS:
- 400 billion total supply (single bonding curve)
- Used for all economic activity
- UBI distributed based on bioregion and participation
`;

// =============================================================================
// TOOL DEFINITIONS
// =============================================================================

const TOOLS: Tool[] = [
  // === INFORMATION TOOLS ===
  {
    name: 'get_ultralife_info',
    description: 'Get information about UltraLife Protocol - what it is, how it works, core concepts',
    inputSchema: {
      type: 'object',
      properties: {
        topic: { 
          type: 'string', 
          description: 'Specific topic: identity, offerings, collectives, bioregions, impacts, tokens, or general',
          enum: ['general', 'identity', 'offerings', 'collectives', 'bioregions', 'impacts', 'tokens']
        },
      },
    },
  },
  {
    name: 'get_protocol_stats',
    description: 'Get overall UltraLife protocol statistics including total pNFTs, bioregions, active offerings, and TVL',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },

  // === pNFT TOOLS ===
  {
    name: 'get_pnft',
    description: 'Get details of a specific pNFT (personal identity NFT) by ID',
    inputSchema: {
      type: 'object',
      properties: {
        pnft_id: { type: 'string', description: 'The pNFT ID to look up' },
      },
      required: ['pnft_id'],
    },
  },
  {
    name: 'get_pnft_by_address',
    description: 'Find a pNFT owned by a specific wallet address',
    inputSchema: {
      type: 'object',
      properties: {
        address: { type: 'string', description: 'The Cardano wallet address' },
      },
      required: ['address'],
    },
  },
  {
    name: 'get_token_balance',
    description: 'Get UltraLife token balance for a pNFT',
    inputSchema: {
      type: 'object',
      properties: {
        pnft_id: { type: 'string', description: 'The pNFT ID' },
      },
      required: ['pnft_id'],
    },
  },
  {
    name: 'list_pnfts',
    description: 'List pNFTs with optional filters',
    inputSchema: {
      type: 'object',
      properties: {
        bioregion: { type: 'string', description: 'Filter by bioregion ID' },
        min_level: { type: 'number', description: 'Minimum verification level (0-3)' },
        limit: { type: 'number', default: 10 },
      },
    },
  },

  // === SPENDING BUCKET TOOLS ===
  {
    name: 'list_buckets',
    description: 'List all spending buckets for a pNFT',
    inputSchema: {
      type: 'object',
      properties: {
        pnft_id: { type: 'string', description: 'The pNFT ID' },
      },
      required: ['pnft_id'],
    },
  },
  {
    name: 'get_bucket',
    description: 'Get details of a specific spending bucket',
    inputSchema: {
      type: 'object',
      properties: {
        pnft_id: { type: 'string', description: 'The pNFT ID' },
        bucket_id: { type: 'string', description: 'The bucket ID' },
      },
      required: ['pnft_id', 'bucket_id'],
    },
  },
  {
    name: 'build_create_bucket',
    description: 'Build a transaction to create a new spending bucket with daily/weekly/monthly allocation and optional rollover',
    inputSchema: {
      type: 'object',
      properties: {
        pnft_id: { type: 'string', description: 'The pNFT ID' },
        name: { type: 'string', description: 'Bucket name (e.g., "Daily Spending", "Emergency Fund")' },
        template: { 
          type: 'string', 
          enum: ['daily_spending', 'weekly_groceries', 'monthly_bills', 'emergency_fund', 'savings_goal', 'allowance', 'business_expense', 'custom'],
          description: 'Bucket template to use'
        },
        allocation: { type: 'number', description: 'Amount per period (for custom template)' },
        period: { type: 'string', enum: ['daily', 'weekly', 'monthly'], description: 'Period type (for custom template)' },
        rollover: { type: 'boolean', description: 'Enable rollover of unused funds (for custom template)' },
        max_balance: { type: 'number', description: 'Maximum accumulated balance (for custom template)' },
        initial_funding: { type: 'number', description: 'Initial ULTRA to deposit' },
      },
      required: ['pnft_id', 'name', 'template'],
    },
  },
  {
    name: 'build_fund_bucket',
    description: 'Build a transaction to add funds to an existing spending bucket',
    inputSchema: {
      type: 'object',
      properties: {
        pnft_id: { type: 'string', description: 'The pNFT ID' },
        bucket_id: { type: 'string', description: 'The bucket ID to fund' },
        amount: { type: 'number', description: 'Amount of ULTRA to add' },
      },
      required: ['pnft_id', 'bucket_id', 'amount'],
    },
  },
  {
    name: 'build_spend_bucket',
    description: 'Build a transaction to spend from a bucket (operates in Hydra head if available)',
    inputSchema: {
      type: 'object',
      properties: {
        pnft_id: { type: 'string', description: 'The sender pNFT ID' },
        bucket_id: { type: 'string', description: 'The bucket to spend from' },
        recipient_pnft: { type: 'string', description: 'The recipient pNFT ID' },
        amount: { type: 'number', description: 'Amount of ULTRA to spend' },
        purpose: { type: 'string', description: 'Purpose of the payment' },
      },
      required: ['pnft_id', 'bucket_id', 'recipient_pnft', 'amount'],
    },
  },
  {
    name: 'build_transfer_between_buckets',
    description: 'Build a transaction to transfer funds between your own buckets',
    inputSchema: {
      type: 'object',
      properties: {
        pnft_id: { type: 'string', description: 'The pNFT ID' },
        from_bucket: { type: 'string', description: 'Source bucket ID' },
        to_bucket: { type: 'string', description: 'Destination bucket ID' },
        amount: { type: 'number', description: 'Amount to transfer' },
      },
      required: ['pnft_id', 'from_bucket', 'to_bucket', 'amount'],
    },
  },

  // === BIOREGION TOOLS ===
  {
    name: 'list_bioregions',
    description: 'List all registered bioregions with their health indices',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },

  // === TREASURY & BONDING CURVE TOOLS ===
  {
    name: 'get_token_price',
    description: 'Get current bonding curve price. Price = tokens_distributed / 400B',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'simulate_purchase',
    description: 'Calculate how many tokens you would get for a given ADA amount',
    inputSchema: {
      type: 'object',
      properties: {
        ada_amount: { type: 'number', description: 'Amount of ADA to spend' },
      },
      required: ['ada_amount'],
    },
  },
  {
    name: 'get_founder_status',
    description: 'Get founder vesting status: accrued, claimed, available',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'get_treasury_status',
    description: 'Get full treasury status: reserves, distributed, epoch queue',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'build_purchase_tokens',
    description: 'Build transaction to buy tokens with ADA (queued for epoch settlement)',
    inputSchema: {
      type: 'object',
      properties: {
        buyer_pnft: { type: 'string', description: 'Buyer pNFT ID' },
        ada_amount: { type: 'number', description: 'ADA to spend' },
      },
      required: ['buyer_pnft', 'ada_amount'],
    },
  },

  {
    name: 'get_bioregion',
    description: 'Get detailed information about a specific bioregion including health indices',
    inputSchema: {
      type: 'object',
      properties: {
        bioregion_id: { type: 'string', description: 'The bioregion ID' },
      },
      required: ['bioregion_id'],
    },
  },

  // === MARKETPLACE TOOLS ===
  {
    name: 'list_offerings',
    description: 'List marketplace offerings with optional filters',
    inputSchema: {
      type: 'object',
      properties: {
        bioregion: { type: 'string', description: 'Filter by bioregion ID' },
        offerer: { type: 'string', description: 'Filter by offerer pNFT ID' },
        category: { type: 'string', description: 'Filter by category code' },
        status: { type: 'string', enum: ['Active', 'Paused', 'Fulfilled', 'Expired', 'Cancelled'] },
        limit: { type: 'number', default: 10 },
      },
    },
  },
  {
    name: 'get_offering',
    description: 'Get details of a specific offering',
    inputSchema: {
      type: 'object',
      properties: {
        offering_id: { type: 'string', description: 'The offering ID' },
      },
      required: ['offering_id'],
    },
  },
  {
    name: 'list_needs',
    description: 'List work requests/needs with optional filters',
    inputSchema: {
      type: 'object',
      properties: {
        bioregion: { type: 'string', description: 'Filter by bioregion ID' },
        needer: { type: 'string', description: 'Filter by needer pNFT ID' },
        status: { type: 'string', enum: ['Open', 'InProgress', 'Fulfilled', 'Cancelled', 'Expired'] },
        limit: { type: 'number', default: 10 },
      },
    },
  },
  {
    name: 'get_need',
    description: 'Get details of a specific need/work request',
    inputSchema: {
      type: 'object',
      properties: {
        need_id: { type: 'string', description: 'The need ID' },
      },
      required: ['need_id'],
    },
  },

  // === COLLECTIVE TOOLS ===
  {
    name: 'list_collectives',
    description: 'List collectives (organizations/businesses) with optional filters',
    inputSchema: {
      type: 'object',
      properties: {
        bioregion: { type: 'string', description: 'Filter by bioregion ID' },
        member: { type: 'string', description: 'Filter by member pNFT ID' },
      },
    },
  },
  {
    name: 'get_collective',
    description: 'Get details of a specific collective',
    inputSchema: {
      type: 'object',
      properties: {
        collective_id: { type: 'string', description: 'The collective ID' },
      },
      required: ['collective_id'],
    },
  },

  // === TRANSACTION BUILDING TOOLS ===
  {
    name: 'build_mint_pnft',
    description: 'Build a transaction to mint a new pNFT (DNA-verified identity). Returns unsigned transaction for wallet signing.',
    inputSchema: {
      type: 'object',
      properties: {
        user_address: { type: 'string', description: 'The wallet address for the new pNFT' },
        dna_hash: { type: 'string', description: 'DNA hash (on testnet, use "test_" + random string)' },
        verification_proof: { type: 'string', description: 'Verification proof (on testnet, use "testnet_proof")' },
      },
      required: ['user_address'],
    },
  },
  {
    name: 'build_create_offering',
    description: 'Build a transaction to create a new marketplace offering. Returns unsigned transaction for wallet signing.',
    inputSchema: {
      type: 'object',
      properties: {
        offerer_pnft: { type: 'string', description: 'The pNFT ID of the offerer' },
        what_type: { type: 'string', enum: ['Thing', 'Work', 'Access', 'Knowledge', 'Care'], description: 'Type of offering' },
        description: { type: 'string', description: 'Description of what is being offered' },
        bioregion: { type: 'string', description: 'Bioregion where offering is available (or "anywhere")' },
        price: { type: 'number', description: 'Price in tokens (0 for gift/community service)' },
        negotiable: { type: 'boolean', default: true, description: 'Whether price is negotiable' },
      },
      required: ['offerer_pnft', 'what_type', 'description'],
    },
  },
  {
    name: 'build_create_collective',
    description: 'Build a transaction to create a new collective (organization/business). Returns unsigned transaction for wallet signing.',
    inputSchema: {
      type: 'object',
      properties: {
        founder_pnft: { type: 'string', description: 'The pNFT ID of the founder' },
        name: { type: 'string', description: 'Name of the collective' },
        bioregion: { type: 'string', description: 'Bioregion where collective is based' },
        governance_description: { type: 'string', description: 'Description of governance rules' },
      },
      required: ['founder_pnft', 'name', 'bioregion'],
    },
  },
  {
    name: 'build_add_collective_member',
    description: 'Build a transaction to add a member to a collective. Returns unsigned transaction for wallet signing.',
    inputSchema: {
      type: 'object',
      properties: {
        collective_id: { type: 'string', description: 'The collective ID' },
        new_member_pnft: { type: 'string', description: 'The pNFT ID of the new member' },
        approver_pnft: { type: 'string', description: 'The pNFT ID of the approving existing member' },
      },
      required: ['collective_id', 'new_member_pnft', 'approver_pnft'],
    },
  },
  {
    name: 'build_transfer_tokens',
    description: 'Build a transaction to transfer tokens between pNFTs. Returns unsigned transaction for wallet signing.',
    inputSchema: {
      type: 'object',
      properties: {
        sender_pnft: { type: 'string', description: 'The sender pNFT ID' },
        sender_address: { type: 'string', description: 'The sender wallet address' },
        recipient_pnft: { type: 'string', description: 'The recipient pNFT ID' },
        recipient_address: { type: 'string', description: 'The recipient wallet address' },
        amount: { type: 'number', description: 'Amount of tokens to transfer' },
        purpose: { type: 'string', description: 'Purpose of the transfer (for record keeping)' },
      },
      required: ['sender_pnft', 'sender_address', 'recipient_pnft', 'recipient_address', 'amount', 'purpose'],
    },
  },
  {
    name: 'build_accept_offering',
    description: 'Build a transaction to accept an offering and create an agreement. Returns unsigned transaction for wallet signing.',
    inputSchema: {
      type: 'object',
      properties: {
        offering_id: { type: 'string', description: 'The offering ID to accept' },
        accepter_pnft: { type: 'string', description: 'The pNFT ID of the accepter' },
        payment: { type: 'number', description: 'Payment amount in tokens' },
        complete_by_days: { type: 'number', default: 30, description: 'Days until completion deadline' },
      },
      required: ['offering_id', 'accepter_pnft', 'payment'],
    },
  },
  {
    name: 'build_purchase_from_pool',
    description: 'Build a transaction to purchase tokens from the development pool (testnet only). Returns unsigned transaction for wallet signing.',
    inputSchema: {
      type: 'object',
      properties: {
        buyer_address: { type: 'string', description: 'The buyer wallet address' },
        ada_amount: { type: 'number', description: 'Amount of ADA to spend (1 ADA = 100 tokens on testnet)' },
      },
      required: ['buyer_address', 'ada_amount'],
    },
  },

  // === UBI TOOLS ===
  {
    name: 'get_ubi_pool',
    description: 'Get UBI pool information for a bioregion including fees collected, eligible count, and estimated per-person distribution',
    inputSchema: {
      type: 'object',
      properties: {
        bioregion: { type: 'string', description: 'The bioregion ID' },
      },
      required: ['bioregion'],
    },
  },
  {
    name: 'list_ubi_pools',
    description: 'List all active UBI pools across bioregions',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'check_ubi_eligibility',
    description: 'Check if a pNFT is eligible to claim UBI and get estimated amount',
    inputSchema: {
      type: 'object',
      properties: {
        pnft_id: { type: 'string', description: 'The pNFT ID to check' },
      },
      required: ['pnft_id'],
    },
  },
  {
    name: 'get_ubi_period_stats',
    description: 'Get current UBI period statistics including distribution totals, fee shares, and adjustment history',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'estimate_next_ubi',
    description: 'Estimate next cycle UBI distribution for a bioregion based on current data',
    inputSchema: {
      type: 'object',
      properties: {
        bioregion: { type: 'string', description: 'The bioregion ID' },
      },
      required: ['bioregion'],
    },
  },
  {
    name: 'build_claim_ubi',
    description: 'Build a transaction to claim UBI for a pNFT. Returns unsigned transaction for wallet signing.',
    inputSchema: {
      type: 'object',
      properties: {
        pnft_id: { type: 'string', description: 'The pNFT ID claiming UBI' },
      },
      required: ['pnft_id'],
    },
  },
  {
    name: 'build_initialize_ubi_pool',
    description: 'Build a transaction to initialize a UBI pool for a bioregion (admin only). Returns unsigned transaction for wallet signing.',
    inputSchema: {
      type: 'object',
      properties: {
        bioregion: { type: 'string', description: 'The bioregion ID' },
        initial_fees: { type: 'number', description: 'Initial fee pool amount' },
        admin_pnft: { type: 'string', description: 'Admin pNFT ID' },
      },
      required: ['bioregion', 'initial_fees', 'admin_pnft'],
    },
  },
];

// =============================================================================
// MCP SERVER
// =============================================================================

export class UltraLifeMcpServer {
  private server: Server;
  private indexer: UltraLifeIndexer;
  private builder: UltraLifeTxBuilder;
  private ubi: UbiOperations;
  private config: UltraLifeConfig;

  constructor(config: UltraLifeConfig) {
    this.config = config;
    this.indexer = new UltraLifeIndexer(config);
    this.builder = new UltraLifeTxBuilder(config, this.indexer);
    this.ubi = new UbiOperations(config, this.indexer, this.builder);
    
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

      // === UBI ===
      case 'get_ubi_pool':
        return this.ubi.getPoolInfo(args.bioregion as string);

      case 'list_ubi_pools':
        return this.ubi.listPools();

      case 'check_ubi_eligibility':
        return this.ubi.checkEligibility(args.pnft_id as string);

      case 'get_ubi_period_stats':
        return this.ubi.getPeriodStats();

      case 'estimate_next_ubi':
        return this.ubi.estimateNextCycleUbi(args.bioregion as string);

      case 'build_claim_ubi':
        return this.buildClaimUbi(args);

      case 'build_initialize_ubi_pool':
        return this.buildInitializeUbiPool(args);

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
        how_it_works: 'Users have DNA-verified identities (pNFTs), create/accept offerings, form collectives, and all transactions track environmental impact (compound flows). UBI is distributed based on bioregion health.',
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
    
    // Generate testnet values if not provided
    const dnaHash = args.dna_hash as string || `test_${Date.now().toString(16)}`;
    const verificationProof = args.verification_proof as string || 'testnet_proof';

    const result = await this.builder.buildMintPnft({
      userAddress,
      dnaHash,
      verificationProof,
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
  // UBI BUILDERS
  // ===========================================================================

  private async buildClaimUbi(args: Record<string, unknown>): Promise<object> {
    const result = await this.ubi.buildClaimUbi({
      pnftId: args.pnft_id as string,
    });

    return {
      action: 'Claim UBI',
      transaction: {
        unsigned_cbor: result.tx.toString(),
        tx_hash: result.tx.toHash(),
      },
      summary: result.summary,
      next_step: 'Sign this transaction with your wallet to claim your UBI',
    };
  }

  private async buildInitializeUbiPool(args: Record<string, unknown>): Promise<object> {
    const result = await this.ubi.buildInitializePool({
      bioregion: args.bioregion as string,
      initialFees: BigInt((args.initial_fees as number) * 1_000_000),
      adminPnft: args.admin_pnft as string,
    });

    return {
      action: 'Initialize UBI Pool',
      transaction: {
        unsigned_cbor: result.tx.toString(),
        tx_hash: result.tx.toHash(),
      },
      summary: result.summary,
      next_step: 'Sign this transaction with your wallet to create the UBI pool',
    };
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
    await Promise.all([
      this.indexer.initialize(),
      this.builder.initialize(),
      this.ubi.initialize(),
    ]);

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
