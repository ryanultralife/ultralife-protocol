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
import { ComposableTxBuilder, CompositionBundles } from '../builder/composable.js';
import { UltraLifeIndexer } from '../indexer/index.js';
import { TESTNET_CONFIG, findPlaceholders } from '../config.js';

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

      // Fail early and clearly if the chain isn't deployed for this bundle yet,
      // rather than letting Lucid build against placeholder (TODO) addresses.
      const missing = findPlaceholders(TESTNET_CONFIG, bundle);
      if (missing.length) {
        return res.status(503).json({
          error: `Protocol contracts not deployed for "${bundle}". Compile + deploy reference scripts and set the matching env vars first.`,
          missing,
        });
      }

      const coerced = coerceBigints(params || {}) as Record<string, unknown>;
      const actions = make(coerced);

      const indexer = new UltraLifeIndexer(TESTNET_CONFIG);
      const builder = new ComposableTxBuilder(TESTNET_CONFIG, indexer);
      await builder.initialize();

      const payerAddress = (coerced.payerAddress || coerced.userAddress) as string | undefined;
      if (!payerAddress) {
        return res.status(400).json({ error: 'params.payerAddress (or userAddress) is required for coin selection' });
      }
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
      // Lucid's TxComplete.toString() returns the unsigned tx as CBOR hex.
      const unsignedTx = composed.tx.toString();

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
}
