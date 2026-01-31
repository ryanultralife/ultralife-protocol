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
import type { UltraLifeConfig } from '../types/index.js';
export declare class UltraLifeMcpServer {
    private server;
    private indexer;
    private builder;
    private config;
    constructor(config: UltraLifeConfig);
    private setupHandlers;
    private handleTool;
    private getUltraLifeInfo;
    private buildMintPnft;
    private buildCreateOffering;
    private buildCreateCollective;
    private buildAddCollectiveMember;
    private buildTransferTokens;
    private buildAcceptOffering;
    private buildPurchaseFromPool;
    private buildPurchaseTokens;
    private buildCreateBucket;
    private buildFundBucket;
    private buildSpendBucket;
    private buildTransferBetweenBuckets;
    private hashString;
    start(): Promise<void>;
}
export declare function startMcpServer(config: UltraLifeConfig): Promise<void>;
export default UltraLifeMcpServer;
//# sourceMappingURL=index.d.ts.map