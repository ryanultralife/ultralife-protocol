/**
 * POST /build — orchestrator proposal → UNSIGNED preprod transaction.
 *
 * The Christian app's /api/build-tx calls this with { bundle, params }. We map
 * the bundle name to a CompositionBundle, build the tx against the payer's
 * address (read-only coin selection, NO signing key), and return the unsigned
 * CBOR. The human/biometric signs and submits; /api/anchor records the hash.
 *
 * Never signs. Never submits. Never holds a key.
 */

import type { Express, Request, Response } from 'express';
import { Blockfrost } from '@lucid-evolution/lucid';
import type { ProtocolParameters } from '@lucid-evolution/lucid';
import { ComposableTxBuilder, CompositionBundles } from '../builder/composable.js';
import { UltraLifeIndexer } from '../indexer/index.js';
import { TESTNET_CONFIG, findPlaceholdersForActions } from '../config.js';

// Shared across requests: the indexer is a stateless reader, and protocol
// parameters change once per epoch at most — fetch them once instead of on
// every /build call. Each request still gets its OWN Lucid instance (via
// builder.initialize) so concurrent requests can't race on wallet selection.
let indexerSingleton: UltraLifeIndexer | null = null;
let paramsCache: Promise<ProtocolParameters> | null = null;

function getIndexer(): UltraLifeIndexer {
  return (indexerSingleton ??= new UltraLifeIndexer(TESTNET_CONFIG));
}

function getProtocolParameters(): Promise<ProtocolParameters> {
  if (!paramsCache) {
    const provider = new Blockfrost(
      `https://cardano-${TESTNET_CONFIG.network}.blockfrost.io/api`,
      TESTNET_CONFIG.blockfrostApiKey
    );
    paramsCache = provider.getProtocolParameters().catch((e) => {
      paramsCache = null; // don't cache failures
      throw e;
    });
  }
  return paramsCache;
}

// Amount fields that arrive over HTTP as JSON numbers/strings but the builder
// needs as bigint (lovelace / token quantities). Coerced before the bundle runs
// so `rent * BigInt(commissionBps)` etc. don't throw "mix BigInt and other types".
const BIGINT_FIELDS = new Set([
  'rent',
  'amount',
  'grantAmount',
  'initialFunding',
  'maxBalance',
  'minBalance',
  'quantity',
]);

function coerceBigints(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(coerceBigints);
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (BIGINT_FIELDS.has(k) && (typeof v === 'number' || typeof v === 'string')) {
        out[k] = BigInt(v);
      } else {
        out[k] = coerceBigints(v);
      }
    }
    return out;
  }
  return value;
}

// The composed summary contains bigints, which JSON.stringify can't serialize.
function bigintSafe(obj: unknown): unknown {
  return JSON.parse(JSON.stringify(obj, (_k, v) => (typeof v === 'bigint' ? v.toString() : v)));
}

type BundleFn = (params: Record<string, unknown>) => Array<{ type: string; params: Record<string, unknown> }>;

export function registerBuildRoute(app: Express): void {
  app.post('/build', async (req: Request, res: Response) => {
    try {
      const { bundle, params } = (req.body || {}) as { bundle?: string; params?: unknown };

      if (!bundle) return res.status(400).json({ error: 'Missing "bundle"' });

      const make = (CompositionBundles as unknown as Record<string, BundleFn>)[bundle];
      if (!make) {
        return res.status(400).json({
          error: `Unknown bundle: ${bundle}`,
          available: Object.keys(CompositionBundles),
        });
      }

      const coerced = coerceBigints(params || {}) as Record<string, unknown>;

      // Bundles do bigint math on their params — malformed input is a caller
      // error (400), not a server fault.
      let actions: ReturnType<BundleFn>;
      try {
        actions = make(coerced);
      } catch (e: unknown) {
        const detail = e instanceof Error ? e.message : String(e);
        return res.status(400).json({ error: `Invalid params for bundle "${bundle}": ${detail}` });
      }

      // Fail early and clearly if the chain isn't deployed for what this bundle
      // actually composes, rather than letting Lucid build against placeholder
      // (TODO) addresses. Derived from the action list, so it covers every
      // bundle — including ones added later.
      const missing = findPlaceholdersForActions(TESTNET_CONFIG, actions.map((a) => a.type));
      if (missing.length) {
        return res.status(503).json({
          error: `Protocol contracts not deployed for "${bundle}". Run deploy-scripts (writes deployment.json) or set the matching env vars first.`,
          missing,
        });
      }

      // Cheap validation before any network work.
      const payerAddress = (coerced.payerAddress || coerced.userAddress) as string | undefined;
      if (!payerAddress) {
        return res.status(400).json({ error: 'params.payerAddress (or userAddress) is required for coin selection' });
      }

      const builder = new ComposableTxBuilder(TESTNET_CONFIG, getIndexer());
      await builder.initialize(await getProtocolParameters());
      await builder.selectPayer(payerAddress);

      for (const a of actions) {
        switch (a.type) {
          case 'transfer': builder.addTransfer(a.params as never); break;
          case 'mint_pnft': builder.addMintPnft(a.params as never); break;
          case 'record_impact': builder.addRecordImpact(a.params as never); break;
          case 'claim_grant': builder.addClaimGrant(a.params as never); break;
          case 'create_bucket': builder.addCreateBucket(a.params as never); break;
          case 'create_offering': builder.addCreateOffering(a.params as never); break;
          case 'fund_bucket': builder.addFundBucket(a.params as never); break;
          default:
            return res.status(400).json({ error: `Unsupported action type in bundle: ${a.type}` });
        }
      }

      const composed = await builder.build();
      // lucid-evolution's TxSignBuilder.toCBOR() returns the unsigned tx as CBOR hex.
      const unsignedTx = composed.tx.toCBOR();

      return res.json({
        unsignedTx,
        txHash: composed.txHash,
        summary: bigintSafe(composed.summary),
      });
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      return res.status(500).json({ error: message });
    }
  });

  // POST /assemble — combine an unsigned tx with CIP-30 witness set(s) into a
  // submittable signed tx. The WALLET signs and the WALLET submits; this just
  // does the CBOR assembly a no-build static page can't. Never holds a key.
  app.post('/assemble', async (req: Request, res: Response) => {
    try {
      const { unsignedTx, witnesses } = (req.body || {}) as { unsignedTx?: string; witnesses?: string[] };
      if (!unsignedTx) return res.status(400).json({ error: 'Missing "unsignedTx" (CBOR hex)' });
      if (!Array.isArray(witnesses) || witnesses.length === 0) {
        return res.status(400).json({ error: 'Missing "witnesses" (array of CIP-30 witness-set CBOR hex)' });
      }

      const builder = new ComposableTxBuilder(TESTNET_CONFIG, getIndexer());
      await builder.initialize(await getProtocolParameters());
      const lucid = builder.getLucid();
      const signed = await lucid.fromTx(unsignedTx).assemble(witnesses).complete();

      return res.json({ signedTx: signed.toCBOR(), txHash: signed.toHash() });
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      return res.status(500).json({ error: message });
    }
  });
}
