/** Read-only Cardano preprod. This node does not submit. Wallet signs elsewhere. */

export const PREPROD = {
  network: "preprod",
  koios: "https://preprod.koios.rest/api/v1",
  explorer: "https://preprod.cardanoscan.io",
  pnft: {
    id: "pnft_ml361rj3_dcb6eb37787234c8",
    tx: "959f5ba634a5fc5f0d9072c4b26c78536f7ec130689489233a3aa9aff8bfe51d",
    policy: "7c9f5578c7d5815c89af5d4f4635b2aa390e3ed06facdb3ecf9971fc",
    fingerprint: "asset1zqpf9a550pddcwa3t0tzjwgmdjgc2jgx5ylaxm",
    mintedAt: "2026-02-01T03:14:10Z",
    block: 4_379_169,
    epoch: 268,
  },
};

export type PreprodReport = {
  ok: boolean;
  network: "preprod";
  tip?: { epoch: number; block: number; era: string; absSlot: number };
  pnft?: {
    alive: boolean;
    id: string;
    tx: string;
    policy: string;
    fingerprint: string;
    explorer: string;
  };
  warning?: string;
  signing: "agents-build-unsigned — wallet signs — chain is law";
};

export async function inspectPreprod(): Promise<PreprodReport> {
  const signing = "agents-build-unsigned — wallet signs — chain is law" as const;
  try {
    const tipRes = await fetch(`${PREPROD.koios}/tip`, { headers: { accept: "application/json" } });
    const tipJson = (await tipRes.json()) as Array<{
      epoch_no: number;
      block_no?: number;
      block_height?: number;
      era: string;
      abs_slot: number;
    }>;
    const tipRow = tipJson[0];
    const txRes = await fetch(`${PREPROD.koios}/tx_info`, {
      method: "POST",
      headers: { accept: "application/json", "content-type": "application/json" },
      body: JSON.stringify({ _tx_hashes: [PREPROD.pnft.tx], _assets: true }),
    });
    const txs = (await txRes.json()) as Array<{
      tx_hash: string;
      assets_minted?: Array<{ policy_id: string }>;
      outputs?: Array<{ asset_list?: Array<{ policy_id: string }> }>;
    }>;
    const tx = txs[0];
    const minted =
      tx?.assets_minted?.some((a) => a.policy_id === PREPROD.pnft.policy) ||
      tx?.outputs?.some((o) => o.asset_list?.some((a) => a.policy_id === PREPROD.pnft.policy)) ||
      false;
    return {
      ok: Boolean(tipRow && minted),
      network: "preprod",
      tip: tipRow
        ? {
            epoch: tipRow.epoch_no,
            block: tipRow.block_no ?? tipRow.block_height ?? 0,
            era: tipRow.era,
            absSlot: tipRow.abs_slot,
          }
        : undefined,
      pnft: {
        alive: minted,
        id: PREPROD.pnft.id,
        tx: PREPROD.pnft.tx,
        policy: PREPROD.pnft.policy,
        fingerprint: PREPROD.pnft.fingerprint,
        explorer: `${PREPROD.explorer}/transaction/${PREPROD.pnft.tx}`,
      },
      warning: minted
        ? undefined
        : "Documented pNFT mint not found on preprod. Do not claim the chain is live.",
      signing,
    };
  } catch (e) {
    return {
      ok: false,
      network: "preprod",
      warning: `Koios unreachable: ${e instanceof Error ? e.message : "error"}`,
      signing,
    };
  }
}
