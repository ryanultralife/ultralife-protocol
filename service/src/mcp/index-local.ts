/**
 * UltraLife MCP Server - Local Mode
 *
 * Model Context Protocol server that provides tools for LLMs to interact
 * with UltraLife protocol data from deployment.json (local mode).
 *
 * This enables development and testing without requiring actual blockchain deployment.
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from '@modelcontextprotocol/sdk/types.js';

import { LocalModeHandlers } from './handlers-local.js';

// =============================================================================
// TOOL DEFINITIONS (same as blockchain mode, but read-only)
// =============================================================================

const TOOLS: Tool[] = [
  // === INFORMATION TOOLS ===
  {
    name: 'get_ultralife_info',
    description: 'Get information about UltraLife Protocol - what it is, how it works, core concepts. Uses protocol-spec.json in local mode.',
    inputSchema: {
      type: 'object',
      properties: {
        topic: {
          type: 'string',
          description: 'Specific topic: identity, compounds, confidence_levels, transaction_types, land_sequestration, llm_instructions, or general',
          enum: ['general', 'identity', 'compounds', 'confidence_levels', 'transaction_types', 'land_sequestration', 'llm_instructions']
        },
      },
    },
  },
  {
    name: 'get_protocol_stats',
    description: 'Get overall UltraLife protocol statistics aggregated from deployment.json including total pNFTs, bioregions, lands, and transactions',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },

  // === pNFT TOOLS ===
  {
    name: 'get_pnft',
    description: 'Get details of a specific pNFT (personal identity NFT) by ID from deployment.json',
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
    description: 'Find a pNFT owned by a specific wallet address in deployment.json',
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
    description: 'Get UltraLife token balance for a pNFT from deployment.json ultraBalances',
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
    description: 'List pNFTs from deployment.json with optional filters',
    inputSchema: {
      type: 'object',
      properties: {
        bioregion: { type: 'string', description: 'Filter by bioregion ID' },
        min_level: { type: 'number', description: 'Minimum verification level (0-3)' },
        limit: { type: 'number', default: 10 },
      },
    },
  },

  // === BIOREGION TOOLS ===
  {
    name: 'list_bioregions',
    description: 'List all bioregions from deployment.json bioregionStats with their statistics',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'get_bioregion',
    description: 'Get detailed information about a specific bioregion from deployment.json',
    inputSchema: {
      type: 'object',
      properties: {
        bioregion_id: { type: 'string', description: 'The bioregion ID' },
      },
      required: ['bioregion_id'],
    },
  },

  // === LAND TOOLS ===
  {
    name: 'get_land',
    description: 'Get details of a specific land parcel from deployment.json',
    inputSchema: {
      type: 'object',
      properties: {
        land_id: { type: 'string', description: 'The land ID to look up' },
      },
      required: ['land_id'],
    },
  },
  {
    name: 'list_lands',
    description: 'List all land parcels from deployment.json with optional filters',
    inputSchema: {
      type: 'object',
      properties: {
        bioregion: { type: 'string', description: 'Filter by bioregion ID' },
        steward: { type: 'string', description: 'Filter by steward pNFT ID' },
        limit: { type: 'number', default: 10 },
      },
    },
  },

  // === MARKETPLACE TOOLS ===
  {
    name: 'list_offerings',
    description: 'List marketplace offerings from deployment.json (if present) with optional filters',
    inputSchema: {
      type: 'object',
      properties: {
        bioregion: { type: 'string', description: 'Filter by bioregion ID' },
        offerer: { type: 'string', description: 'Filter by offerer pNFT ID' },
        status: { type: 'string', enum: ['Active', 'Paused', 'Fulfilled', 'Expired', 'Cancelled'] },
        limit: { type: 'number', default: 10 },
      },
    },
  },
  {
    name: 'list_needs',
    description: 'List care/needs from deployment.json (if present) with optional filters',
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

  // === TRANSACTION TOOLS ===
  {
    name: 'list_transactions',
    description: 'List transactions from deployment.json with optional filters',
    inputSchema: {
      type: 'object',
      properties: {
        sender: { type: 'string', description: 'Filter by sender pNFT ID' },
        recipient: { type: 'string', description: 'Filter by recipient pNFT ID' },
        bioregion: { type: 'string', description: 'Filter by bioregion ID' },
        limit: { type: 'number', default: 10 },
      },
    },
  },

  // === SEQUESTRATION CREDITS ===
  {
    name: 'get_sequestration_credits',
    description: 'Get all sequestration credits, balances, and purchases from deployment.json',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
];

// =============================================================================
// LOCAL MODE CONFIG
// =============================================================================

export interface LocalModeConfig {
  deploymentPath: string;
  protocolSpecPath?: string;
}

// =============================================================================
// LOCAL MCP SERVER
// =============================================================================

export class UltraLifeLocalMcpServer {
  private server: Server;
  private handlers: LocalModeHandlers;

  constructor(config: LocalModeConfig) {
    this.handlers = new LocalModeHandlers(config.deploymentPath, config.protocolSpecPath);

    this.server = new Server(
      {
        name: 'ultralife-protocol-local',
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
          content: [{ type: 'text', text: JSON.stringify({ error: errorMessage, mode: 'local' }) }],
          isError: true,
        };
      }
    });
  }

  private async handleTool(name: string, args: Record<string, unknown>): Promise<unknown> {
    switch (name) {
      // === INFORMATION ===
      case 'get_ultralife_info':
        return this.handlers.getUltraLifeInfo(args.topic as string);

      case 'get_protocol_stats':
        return this.handlers.getProtocolStats();

      // === pNFT ===
      case 'get_pnft':
        return this.handlers.getPnft(args.pnft_id as string);

      case 'get_pnft_by_address':
        return this.handlers.getPnftByAddress(args.address as string);

      case 'get_token_balance':
        return this.handlers.getTokenBalance(args.pnft_id as string);

      case 'list_pnfts':
        return this.handlers.listPnfts({
          bioregion: args.bioregion as string,
          minLevel: args.min_level as number,
          limit: args.limit as number || 10,
        });

      // === BIOREGION ===
      case 'list_bioregions':
        return this.handlers.listBioregions();

      case 'get_bioregion':
        return this.handlers.getBioregion(args.bioregion_id as string);

      // === LAND ===
      case 'get_land':
        return this.handlers.getLand(args.land_id as string);

      case 'list_lands':
        return this.handlers.listLands({
          bioregion: args.bioregion as string,
          steward: args.steward as string,
          limit: args.limit as number || 10,
        });

      // === MARKETPLACE ===
      case 'list_offerings':
        return this.handlers.listOfferings({
          bioregion: args.bioregion as string,
          offerer: args.offerer as string,
          status: args.status as string,
          limit: args.limit as number || 10,
        });

      case 'list_needs':
        return this.handlers.listNeeds({
          bioregion: args.bioregion as string,
          needer: args.needer as string,
          status: args.status as string,
          limit: args.limit as number || 10,
        });

      // === TRANSACTIONS ===
      case 'list_transactions':
        return this.handlers.listTransactions({
          sender: args.sender as string,
          recipient: args.recipient as string,
          bioregion: args.bioregion as string,
          limit: args.limit as number || 10,
        });

      // === SEQUESTRATION CREDITS ===
      case 'get_sequestration_credits':
        return this.handlers.getSequestrationCredits();

      default:
        throw new Error(`Unknown tool: ${name}. Note: Transaction building tools are not available in local mode.`);
    }
  }

  // ===========================================================================
  // START SERVER
  // ===========================================================================

  async start(): Promise<void> {
    await this.handlers.initialize();

    const transport = new StdioServerTransport();
    await this.server.connect(transport);

    console.error('UltraLife MCP Server (LOCAL MODE) running on stdio');
  }
}

// =============================================================================
// MAIN
// =============================================================================

export async function startLocalMcpServer(config: LocalModeConfig): Promise<void> {
  const server = new UltraLifeLocalMcpServer(config);
  await server.start();
}

export default UltraLifeLocalMcpServer;
