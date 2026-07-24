import { HardhatUserConfig } from 'hardhat/config';
import '@nomicfoundation/hardhat-toolbox';

// Injective EVM 网络 (PRD 0.5 / 64.4)：Testnet 1439，Mainnet 1776
const PK = process.env.RELAYER_PRIVATE_KEY ? [process.env.RELAYER_PRIVATE_KEY] : [];

const config: HardhatUserConfig = {
  solidity: {
    version: '0.8.24',
    settings: {
      optimizer: { enabled: true, runs: 200 },
      evmVersion: 'paris',
    },
  },
  networks: {
    hardhat: { chainId: 31337 },
    localhost: { url: 'http://127.0.0.1:8545', chainId: 31337 },
    injectiveTestnet: {
      url: process.env.INJECTIVE_TESTNET_RPC || 'https://k8s.testnet.json-rpc.injective.network/',
      chainId: 1439,
      accounts: PK,
    },
    injectiveMainnet: {
      url: process.env.INJECTIVE_MAINNET_RPC || 'https://sentry.evm-rpc.injective.network/',
      chainId: 1776,
      accounts: PK,
    },
  },
};

export default config;
