const WASM_BYTES = new Uint8Array([
  0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00, 0x01, 0x06, 0x01, 0x60,
  0x01, 0x7f, 0x01, 0x7f, 0x03, 0x02, 0x01, 0x00, 0x07, 0x0a, 0x01, 0x06,
  0x66, 0x6f, 0x6c, 0x64, 0x33, 0x32, 0x00, 0x00, 0x0a, 0x09, 0x01, 0x07,
  0x00, 0x20, 0x00, 0x41, 0x01, 0x6a, 0x0b,
]);

let wasmFold: ((n: number) => number) | null = null;

export async function instantiateCoreWasm() {
  const { instance } = await WebAssembly.instantiate(WASM_BYTES);
  const exports = instance.exports as { fold32: (n: number) => number };
  wasmFold = exports.fold32;
  const sample = wasmFold(41);
  if (sample !== 42) {
    throw new Error("WASM fold32 failed self-check");
  }
  return { memoryPages: 1, export: "fold32", selfCheck: sample };
}

function mix(n: number) {
  return wasmFold ? wasmFold(n >>> 0) >>> 0 : (n + 1) >>> 0;
}

export async function digest(input: string): Promise<string> {
  const bytes = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  const arr = [...new Uint8Array(hash)];
  if (wasmFold) {
    for (let i = 0; i < arr.length; i++) {
      arr[i] = mix(arr[i] + i) & 0xff;
    }
  }
  return arr.map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function txHash(body: string) {
  return digest(`tx:${body}`);
}

export function hexAddr(prefix: string, hash: string) {
  return `${prefix}${hash.slice(0, 98)}`;
}

const WORDS = [
  "sierra", "canopy", "loam", "creek", "ridge", "pinyon", "aspen", "granite",
  "fog", "kelp", "mesa", "delta", "basalt", "mycelium", "cedar", "quartz",
  "oxbow", "prairie", "tide", "humus", "fern", "basil", "rain", "stone",
];

export function mnemonicFromEntropy(hex: string) {
  const words: string[] = [];
  for (let i = 0; i < 12; i++) {
    const n = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
    words.push(WORDS[n % WORDS.length]!);
  }
  return words.join(" ");
}
