import type { EngineState } from "../cardano/engine";

export function didFor(pnftId: string) {
  return `did:ultralife:${pnftId}`;
}

export function protocolDid(origin: string) {
  const host = new URL(origin).host;
  return `did:web:${host}`;
}

export function protocolDidDocument(origin: string) {
  const id = protocolDid(origin);
  return {
    "@context": ["https://www.w3.org/ns/did/v1"],
    id,
    service: [
      {
        id: `${id}#protocol`,
        type: "UltraLifeProtocol",
        serviceEndpoint: `${origin}/api/protocol`,
      },
      {
        id: `${id}#mcp`,
        type: "MCP",
        serviceEndpoint: `${origin}/api/mcp`,
      },
      {
        id: `${id}#llms`,
        type: "llms.txt",
        serviceEndpoint: `${origin}/llms.txt`,
      },
    ],
    alsoKnownAs: ["https://github.com/ryanultralife/ultralife-protocol"],
  };
}

export function identityDidDocument(state: EngineState, origin: string) {
  if (!state.pnft || !state.wallet) return null;
  const id = didFor(state.pnft.id);
  return {
    "@context": ["https://www.w3.org/ns/did/v1"],
    id,
    controller: id,
    alsoKnownAs: [state.wallet.address],
    verificationMethod: [
      {
        id: `${id}#payment`,
        type: "Ed25519VerificationKey2020",
        controller: id,
        publicKeyMultibase: state.wallet.paymentKeyHash,
      },
    ],
    service: [
      {
        id: `${id}#ultralife`,
        type: "UltraLifeProtocol",
        serviceEndpoint: `${origin}/api/protocol`,
      },
    ],
    ultralife: {
      level: state.pnft.level,
      bioregion: state.pnft.bioregion,
      impact: state.pnft.impact,
    },
  };
}
