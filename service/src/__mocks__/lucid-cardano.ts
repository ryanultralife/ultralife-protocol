/**
 * Mock for lucid-cardano module (not installed in dev environment)
 */
export const Lucid = {
  new: async () => ({
    newTx: () => ({
      complete: async () => ({
        sign: () => ({
          complete: async () => ({
            submit: async () => 'mock_tx_hash',
          }),
        }),
      }),
    }),
    selectWalletFromPrivateKey: async () => {},
    utxosAt: async () => [],
    wallet: { address: async () => 'addr_test1_mock' },
  }),
};

export const Blockfrost = class {
  constructor() {}
};

export const Data = {
  to: () => '',
  from: () => ({}),
};
