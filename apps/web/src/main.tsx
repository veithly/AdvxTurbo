import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import '@rainbow-me/rainbowkit/styles.css';
import { RainbowKitProvider, darkTheme, connectorsForWallets } from '@rainbow-me/rainbowkit';
import { injectedWallet, metaMaskWallet, rainbowWallet } from '@rainbow-me/rainbowkit/wallets';
import { WagmiProvider, createConfig, http } from 'wagmi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { defineChain } from 'viem';
import { I18nProvider } from './i18n/index.js';
import { App } from './App.js';
import './styles.css';

// Injective EVM Testnet（游戏所有资产/奖励所在链）
const injectiveTestnet = defineChain({
  id: 1439,
  name: 'Injective EVM Testnet',
  nativeCurrency: { name: 'Injective', symbol: 'INJ', decimals: 18 },
  rpcUrls: { default: { http: ['https://k8s.testnet.json-rpc.injective.network/'] } },
  blockExplorers: { default: { name: 'Blockscout', url: 'https://testnet.blockscout.injective.network' } },
});

const connectors = connectorsForWallets(
  [{ groupName: 'Wallets', wallets: [injectedWallet, metaMaskWallet, rainbowWallet] }],
  { appName: 'Advx Turbo', projectId: 'advx-turbo-local' }
);

const wagmiConfig = createConfig({
  chains: [injectiveTestnet],
  connectors,
  transports: { [injectiveTestnet.id]: http() },
});

const queryClient = new QueryClient();

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider theme={darkTheme({ accentColor: '#7B53A5' })} modalSize="compact">
          <I18nProvider>
            <BrowserRouter>
              <App />
            </BrowserRouter>
          </I18nProvider>
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  </React.StrictMode>
);
