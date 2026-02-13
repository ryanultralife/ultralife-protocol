/**
 * Content Access Service
 *
 * Hash-based content storage with time-limited access grants.
 *
 * Architecture:
 * - Only hashes stored on-chain (tiny transactions)
 * - Actual content stored off-chain (IPFS/Arweave)
 * - Owner grants time-limited access (8hr, 24hr, work contract duration)
 * - LLM interface generates viewable formats (JPEG, JSON, etc.) on demand
 *
 * Flow:
 * 1. Owner registers content → gets content_hash on-chain
 * 2. Owner grants access to grantee → AccessGrant datum on-chain
 * 3. Grantee requests view → LLM validates grant → generates output format
 * 4. View logged for audit trail
 */

import {
  AccessGrant,
  AccessLevel,
  ContentReference,
  ContentType,
  GrantDuration,
  ViewRequest,
  ViewResponse,
  ViewError,
  OutputFormat,
  ContentPreview,
  AccessLogEntry,
  ContentRegistry,
  WorkContractAccessGrants,
  BatchAccessGrant,
  ByteArray,
  AssetName,
  calculateExpiry,
  isGrantValid,
  GRANT_DURATIONS,
} from '../types/index.js';

// =============================================================================
// CONTENT REGISTRY - Track registered content and grants
// =============================================================================

/**
 * In-memory content registry (would be backed by indexer/database in production)
 */
class ContentAccessService {
  private contents: Map<ByteArray, ContentReference> = new Map();
  private grants: Map<ByteArray, AccessGrant> = new Map();
  private accessLogs: AccessLogEntry[] = [];

  // =============================================================================
  // CONTENT REGISTRATION
  // =============================================================================

  /**
   * Register content off-chain and store hash on-chain
   * Returns the content_hash that goes in the ledger transaction
   */
  registerContent(params: {
    contentHash: ByteArray;
    contentType: ContentType;
    sizeBytes: number;
    storageNetwork: 'IPFS' | 'Arweave' | 'Filecoin' | 'Private';
    encrypted: boolean;
    ownerPnft: AssetName;
    linkedAsset?: AssetName;
    linkedAgreement?: ByteArray;
    descriptionHash?: ByteArray;
  }): ContentReference {
    const content: ContentReference = {
      content_hash: params.contentHash,
      content_type: params.contentType,
      size_bytes: params.sizeBytes,
      storage_network: params.storageNetwork,
      encrypted: params.encrypted,
      owner_pnft: params.ownerPnft,
      registered_at: Date.now(),
      linked_asset: params.linkedAsset,
      linked_agreement: params.linkedAgreement,
      description_hash: params.descriptionHash,
    };

    this.contents.set(params.contentHash, content);
    return content;
  }

  /**
   * Get content reference by hash
   */
  getContent(contentHash: ByteArray): ContentReference | undefined {
    return this.contents.get(contentHash);
  }

  // =============================================================================
  // ACCESS GRANTS
  // =============================================================================

  /**
   * Grant access to content with specified duration
   */
  grantAccess(params: {
    contentHash: ByteArray;
    granteePnft: AssetName;
    grantorPnft: AssetName;
    duration: GrantDuration;
    accessLevel: AccessLevel;
    maxViews?: number;
    workAgreementId?: ByteArray;
  }): AccessGrant {
    const content = this.contents.get(params.contentHash);
    if (!content) {
      throw new Error(`Content not found: ${params.contentHash}`);
    }

    // Verify grantor owns the content
    if (content.owner_pnft !== params.grantorPnft) {
      throw new Error('Only content owner can grant access');
    }

    const grantedAt = Date.now();
    const expiresAt = calculateExpiry(params.duration, grantedAt);

    const grant: AccessGrant = {
      grant_id: generateGrantId(),
      content_hash: params.contentHash,
      grantee_pnft: params.granteePnft,
      grantor_pnft: params.grantorPnft,
      duration: params.duration,
      granted_at: grantedAt,
      expires_at: expiresAt,
      access_level: params.accessLevel,
      revoked: false,
      view_count: 0,
      max_views: params.maxViews,
      work_agreement_id: params.workAgreementId,
    };

    this.grants.set(grant.grant_id, grant);
    return grant;
  }

  /**
   * Grant access for common duration presets
   */
  grantQuickAccess(
    contentHash: ByteArray,
    granteePnft: AssetName,
    grantorPnft: AssetName,
    preset: keyof typeof GRANT_DURATIONS
  ): AccessGrant {
    return this.grantAccess({
      contentHash,
      granteePnft,
      grantorPnft,
      duration: GRANT_DURATIONS[preset],
      accessLevel: 'ViewOnly',
    });
  }

  /**
   * Batch grant access to multiple contents
   */
  batchGrantAccess(params: {
    contentHashes: ByteArray[];
    granteePnft: AssetName;
    grantorPnft: AssetName;
    duration: GrantDuration;
    accessLevel: AccessLevel;
    workAgreementId?: ByteArray;
  }): BatchAccessGrant {
    const grantedAt = Date.now();
    const expiresAt = calculateExpiry(params.duration, grantedAt);

    // Create individual grants for each content
    const grants = params.contentHashes.map(contentHash =>
      this.grantAccess({
        contentHash,
        granteePnft: params.granteePnft,
        grantorPnft: params.grantorPnft,
        duration: params.duration,
        accessLevel: params.accessLevel,
        workAgreementId: params.workAgreementId,
      })
    );

    const batch: BatchAccessGrant = {
      batch_id: generateBatchId(),
      content_hashes: params.contentHashes,
      grantee_pnft: params.granteePnft,
      grantor_pnft: params.grantorPnft,
      duration: params.duration,
      access_level: params.accessLevel,
      granted_at: grantedAt,
      expires_at: expiresAt,
      work_agreement_id: params.workAgreementId,
    };

    return batch;
  }

  /**
   * Auto-grant access when work contract is created
   */
  grantWorkContractAccess(params: {
    agreementId: ByteArray;
    clientPnft: AssetName;      // party_a (requester)
    workerPnft: AssetName;      // party_b (worker)
    contractEndTime: number;    // complete_by from agreement
    clientToWorkerContent: ByteArray[];   // Specs, requirements
    workerToClientContent: ByteArray[];   // Will be granted on completion
  }): WorkContractAccessGrants {
    const workDuration: GrantDuration = {
      type: 'WorkContract',
      agreement_id: params.agreementId,
    };

    // Grant client's content to worker immediately
    const clientGrants = params.clientToWorkerContent.map(hash =>
      this.grantAccess({
        contentHash: hash,
        granteePnft: params.workerPnft,
        grantorPnft: params.clientPnft,
        duration: workDuration,
        accessLevel: 'ViewOnly',
        workAgreementId: params.agreementId,
      })
    );

    return {
      agreement_id: params.agreementId,
      grants_a_to_b: params.clientToWorkerContent.map(hash => this.getContent(hash)!),
      grants_b_to_a: params.workerToClientContent.map(hash => this.getContent(hash)!),
      on_verification_grants: [],  // Unlock later
      grant_duration: workDuration,
    };
  }

  /**
   * Revoke an access grant
   */
  revokeAccess(grantId: ByteArray, reasonHash?: ByteArray): AccessGrant {
    const grant = this.grants.get(grantId);
    if (!grant) {
      throw new Error(`Grant not found: ${grantId}`);
    }

    const updated: AccessGrant = {
      ...grant,
      revoked: true,
      revoked_at: Date.now(),
      revoke_reason_hash: reasonHash,
    };

    this.grants.set(grantId, updated);
    return updated;
  }

  /**
   * Extend access grant duration
   */
  extendAccess(grantId: ByteArray, newExpiry: number): AccessGrant {
    const grant = this.grants.get(grantId);
    if (!grant) {
      throw new Error(`Grant not found: ${grantId}`);
    }

    const updated: AccessGrant = {
      ...grant,
      expires_at: newExpiry,
    };

    this.grants.set(grantId, updated);
    return updated;
  }

  /**
   * Check if a pNFT has valid access to content
   */
  hasValidAccess(contentHash: ByteArray, requesterPnft: AssetName): AccessGrant | null {
    const currentTime = Date.now();

    for (const grant of this.grants.values()) {
      if (
        grant.content_hash === contentHash &&
        grant.grantee_pnft === requesterPnft &&
        isGrantValid(grant, currentTime)
      ) {
        return grant;
      }
    }

    // Also check if requester is the owner
    const content = this.contents.get(contentHash);
    if (content && content.owner_pnft === requesterPnft) {
      // Owner always has access - return synthetic grant
      return {
        grant_id: 'owner',
        content_hash: contentHash,
        grantee_pnft: requesterPnft,
        grantor_pnft: requesterPnft,
        duration: { type: 'Permanent' },
        granted_at: content.registered_at,
        expires_at: null,
        access_level: 'Full',
        revoked: false,
        view_count: 0,
      };
    }

    return null;
  }

  // =============================================================================
  // LLM VIEW GENERATION
  // =============================================================================

  /**
   * Handle view request from LLM interface
   * Validates access, generates appropriate output format
   */
  async handleViewRequest(request: ViewRequest): Promise<ViewResponse> {
    const currentTime = Date.now();

    // Check if requester has valid access
    const grant = this.hasValidAccess(request.content_hash, request.requester_pnft);

    if (!grant) {
      return {
        content_hash: request.content_hash,
        requester_pnft: request.requester_pnft,
        access_valid: false,
        output_format: request.output_format,
        generated_at: currentTime,
        content_type: 'Document',
        original_size_bytes: 0,
        error: { type: 'NoAccess' },
      };
    }

    // Get content reference
    const content = this.contents.get(request.content_hash);
    if (!content) {
      return {
        content_hash: request.content_hash,
        requester_pnft: request.requester_pnft,
        access_valid: false,
        output_format: request.output_format,
        generated_at: currentTime,
        content_type: 'Document',
        original_size_bytes: 0,
        error: { type: 'ContentNotFound' },
      };
    }

    // Increment view count (if not owner's synthetic grant)
    if (grant.grant_id !== 'owner') {
      const updated = { ...grant, view_count: grant.view_count + 1, last_viewed_at: currentTime };
      this.grants.set(grant.grant_id, updated);
    }

    // Log access
    this.logAccess({
      log_id: generateLogId(),
      content_hash: request.content_hash,
      accessor_pnft: request.requester_pnft,
      access_type: 'View',
      accessed_at: currentTime,
      output_format: request.output_format,
      success: true,
    });

    // Generate content in requested format
    // In production, this would fetch from IPFS/Arweave and convert
    const generatedContent = await this.generateContent(content, request);

    return {
      content_hash: request.content_hash,
      requester_pnft: request.requester_pnft,
      access_valid: true,
      access_expires_at: grant.expires_at ?? undefined,
      remaining_views: grant.max_views ? grant.max_views - grant.view_count - 1 : undefined,
      output_format: request.output_format,
      generated_content: generatedContent,
      generated_at: currentTime,
      content_type: content.content_type,
      original_size_bytes: content.size_bytes,
    };
  }

  /**
   * Generate content preview (for browsing without full access)
   */
  async generatePreview(
    contentHash: ByteArray,
    requesterPnft: AssetName
  ): Promise<ContentPreview> {
    const content = this.contents.get(contentHash);
    const grant = this.hasValidAccess(contentHash, requesterPnft);

    return {
      content_hash: contentHash,
      content_type: content?.content_type ?? 'Document',
      summary: content ? `${content.content_type} file (${formatBytes(content.size_bytes)})` : 'Unknown content',
      has_access: grant !== null,
      access_expires_at: grant?.expires_at ?? undefined,
      generated_at: Date.now(),
    };
  }

  /**
   * Generate content in the requested format
   * This is where the LLM magic happens - converting stored content to viewable formats
   */
  private async generateContent(
    content: ContentReference,
    request: ViewRequest
  ): Promise<string> {
    // In production, this would:
    // 1. Fetch content from IPFS/Arweave using content_hash
    // 2. Decrypt if encrypted (using owner's key or shared key)
    // 3. Convert to requested output format
    // 4. Apply pagination if requested

    // For now, return a placeholder showing what would be generated
    const output: Record<string, unknown> = {
      content_hash: content.content_hash,
      content_type: content.content_type,
      storage_network: content.storage_network,
      size_bytes: content.size_bytes,
      owner: content.owner_pnft,
      registered_at: new Date(content.registered_at).toISOString(),
      requested_format: request.output_format,
      message: `Content would be fetched from ${content.storage_network} and converted to ${request.output_format}`,
    };

    if (content.linked_asset) {
      output.linked_asset = content.linked_asset;
    }

    if (content.linked_agreement) {
      output.linked_agreement = content.linked_agreement;
    }

    switch (request.output_format) {
      case 'JSON':
        return JSON.stringify(output, null, 2);

      case 'Markdown':
        return generateMarkdownView(output);

      case 'Summary':
        return `**Content Summary**\n\nThis is a ${content.content_type} file stored on ${content.storage_network}.\nSize: ${formatBytes(content.size_bytes)}\nRegistered: ${new Date(content.registered_at).toLocaleDateString()}`;

      case 'PlainText':
        return Object.entries(output)
          .map(([k, v]) => `${k}: ${JSON.stringify(v)}`)
          .join('\n');

      default:
        // For binary formats (JPEG, PNG, PDF, etc.), return base64 placeholder
        return `[Binary content would be generated in ${request.output_format} format]`;
    }
  }

  // =============================================================================
  // ACCESS LOGGING
  // =============================================================================

  private logAccess(entry: AccessLogEntry): void {
    this.accessLogs.push(entry);
  }

  /**
   * Get access logs for a content hash (owner only)
   */
  getAccessLogs(
    contentHash: ByteArray,
    requesterPnft: AssetName
  ): AccessLogEntry[] {
    const content = this.contents.get(contentHash);
    if (!content || content.owner_pnft !== requesterPnft) {
      return []; // Only owner can see logs
    }

    return this.accessLogs.filter(log => log.content_hash === contentHash);
  }

  // =============================================================================
  // REGISTRY QUERIES
  // =============================================================================

  /**
   * Get content registry for a pNFT
   */
  getRegistry(ownerPnft: AssetName): ContentRegistry {
    const ownedContents = Array.from(this.contents.values())
      .filter(c => c.owner_pnft === ownerPnft);

    const givenGrants = Array.from(this.grants.values())
      .filter(g => g.grantor_pnft === ownerPnft && !g.revoked);

    const receivedGrants = Array.from(this.grants.values())
      .filter(g => g.grantee_pnft === ownerPnft && isGrantValid(g, Date.now()));

    return {
      owner_pnft: ownerPnft,
      contents: ownedContents,
      active_grants: givenGrants,
      received_grants: receivedGrants,
      total_contents: ownedContents.length,
      total_active_grants: givenGrants.length,
      total_views: givenGrants.reduce((sum, g) => sum + g.view_count, 0),
    };
  }
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

function generateGrantId(): ByteArray {
  return `grant_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function generateBatchId(): ByteArray {
  return `batch_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function generateLogId(): ByteArray {
  return `log_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

function generateMarkdownView(data: Record<string, unknown>): string {
  const lines = [
    '# Content Details',
    '',
    '| Property | Value |',
    '|----------|-------|',
  ];

  for (const [key, value] of Object.entries(data)) {
    lines.push(`| ${key} | ${JSON.stringify(value)} |`);
  }

  return lines.join('\n');
}

// =============================================================================
// EXPORTS
// =============================================================================

export const contentAccessService = new ContentAccessService();

export {
  ContentAccessService,
  ContentReference,
  AccessGrant,
  ViewRequest,
  ViewResponse,
  ContentPreview,
  ContentRegistry,
};
