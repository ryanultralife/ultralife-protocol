/**
 * UltraLife Service Entry Point
 *
 * Starts the MCP server for LLM interaction with UltraLife Protocol.
 * Supports local mode for development without blockchain deployment.
 */

import 'dotenv/config';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { startMcpServer } from './mcp/index.js';
import { startLocalMcpServer } from './mcp/index-local.js';
import { TESTNET_CONFIG } from './config.js';

// Get directory name for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// =============================================================================
// ENVIRONMENT CONFIGURATION
// =============================================================================

const LOCAL_MODE = process.env.LOCAL_MODE === 'true';
const DEPLOYMENT_PATH = process.env.DEPLOYMENT_PATH
  ? resolve(process.cwd(), process.env.DEPLOYMENT_PATH)
  : resolve(__dirname, '../../scripts/deployment.json');
const PROTOCOL_SPEC_PATH = process.env.PROTOCOL_SPEC_PATH
  ? resolve(process.cwd(), process.env.PROTOCOL_SPEC_PATH)
  : resolve(__dirname, '../../protocol-spec.json');


// =============================================================================
// MAIN
// =============================================================================

async function main(): Promise<void> {
  console.error('Starting UltraLife MCP Server...');

  if (LOCAL_MODE) {
    console.error('Mode: LOCAL (using deployment.json)');
    console.error(`Deployment path: ${DEPLOYMENT_PATH}`);
    console.error(`Protocol spec path: ${PROTOCOL_SPEC_PATH}`);

    try {
      await startLocalMcpServer({
        deploymentPath: DEPLOYMENT_PATH,
        protocolSpecPath: PROTOCOL_SPEC_PATH,
      });
    } catch (error) {
      console.error('Failed to start local server:', error);
      process.exit(1);
    }
  } else {
    console.error('Mode: BLOCKCHAIN');
    console.error(`Network: ${TESTNET_CONFIG.network}`);

    try {
      await startMcpServer(TESTNET_CONFIG);
    } catch (error) {
      console.error('Failed to start server:', error);
      process.exit(1);
    }
  }
}

main();
