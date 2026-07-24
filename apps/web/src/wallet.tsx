import React, { useEffect } from 'react';
import { create } from 'zustand';

// ============================================================================
// 真实 Injective EVM 钱包接入（EIP-1193 window.ethereum，无需额外依赖）。
// 连接 MetaMask/OKX 等注入式钱包 -> 添加/切换 Injective EVM Testnet (chainId 1439)
// -> 用用户钱包对真实交易签名并广播 -> 返回可在区块浏览器验证的 txHash。
// ============================================================================

export const INJECTIVE_TESTNET = {
  chainIdDec: 1439,
  chainIdHex: '0x59f', // 1439
  chainName: 'Injective EVM Testnet',
  nativeCurrency: { name: 'Injective', symbol: 'INJ', decimals: 18 },
  rpcUrls: ['https://k8s.testnet.json-rpc.injective.network/'],
  blockExplorerUrls: ['https://testnet.blockscout.injective.network'],
};

function eth(): any {
  return (window as any).ethereum;
}
export function hasWallet(): boolean {
  return !!eth();
}

function toHexData(obj: unknown): string {
  const s = 'BLAME:' + JSON.stringify(obj);
  let out = '0x';
  for (let i = 0; i < s.length; i++) out += s.charCodeAt(i).toString(16).padStart(2, '0');
  return out;
}

interface WalletState {
  address: string | null;
  chainId: string | null;
  connecting: boolean;
  balance: string | null;
  error: string | null;
  connect: () => Promise<void>;
  disconnect: () => void;
  refreshBalance: () => Promise<void>;
  setFromEvent: (addr: string | null, chain: string | null) => void;
}

export const useWallet = create<WalletState>((set, get) => ({
  address: null,
  chainId: null,
  connecting: false,
  balance: null,
  error: null,
  connect: async () => {
    const e = eth();
    if (!e) { set({ error: 'NO_WALLET' }); return; }
    set({ connecting: true, error: null });
    try {
      const accounts: string[] = await e.request({ method: 'eth_requestAccounts' });
      await ensureInjective();
      const chainId: string = await e.request({ method: 'eth_chainId' });
      set({ address: accounts[0] || null, chainId, connecting: false });
      await get().refreshBalance();
    } catch (err: any) {
      set({ connecting: false, error: err?.message || 'CONNECT_FAILED' });
    }
  },
  disconnect: () => set({ address: null, balance: null }),
  refreshBalance: async () => {
    const e = eth(); const addr = get().address;
    if (!e || !addr) return;
    try {
      const hex: string = await e.request({ method: 'eth_getBalance', params: [addr, 'latest'] });
      set({ balance: hex });
    } catch {}
  },
  setFromEvent: (addr, chain) => set((s) => ({ address: addr, chainId: chain ?? s.chainId })),
}));

/** 添加并切换到 Injective EVM 测试网 */
export async function ensureInjective(): Promise<void> {
  const e = eth();
  if (!e) throw new Error('NO_WALLET');
  try {
    await e.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: INJECTIVE_TESTNET.chainIdHex }] });
  } catch (err: any) {
    // 4902: 未添加该链 -> 添加
    if (err?.code === 4902 || /Unrecognized chain/i.test(err?.message || '')) {
      await e.request({
        method: 'wallet_addEthereumChain',
        params: [{
          chainId: INJECTIVE_TESTNET.chainIdHex,
          chainName: INJECTIVE_TESTNET.chainName,
          nativeCurrency: INJECTIVE_TESTNET.nativeCurrency,
          rpcUrls: INJECTIVE_TESTNET.rpcUrls,
          blockExplorerUrls: INJECTIVE_TESTNET.blockExplorerUrls,
        }],
      });
    } else {
      throw err;
    }
  }
}

/**
 * 发送真实交易并返回 txHash。
 * - 若提供 to（已部署合约地址）+ data，则调用合约；
 * - 否则发送 self-anchor 交易（to=自己，data 携带承诺哈希），同样是链上可验证的真实交易。
 */
export async function sendTx(opts: { to?: string; valueWei?: string; payload?: unknown; data?: string }): Promise<string> {
  const e = eth();
  const addr = useWallet.getState().address;
  if (!e || !addr) throw new Error('NOT_CONNECTED');
  await ensureInjective();
  const tx: any = {
    from: addr,
    to: opts.to || addr, // 默认自锚定到自己
    value: opts.valueWei || '0x0',
    data: opts.data || (opts.payload !== undefined ? toHexData(opts.payload) : '0x'),
  };
  const txHash: string = await e.request({ method: 'eth_sendTransaction', params: [tx] });
  return txHash;
}

export function explorerTx(hash: string): string {
  return `${INJECTIVE_TESTNET.blockExplorerUrls[0]}/tx/${hash}`;
}
export function explorerAddr(addr: string): string {
  return `${INJECTIVE_TESTNET.blockExplorerUrls[0]}/address/${addr}`;
}

function short(a?: string | null): string {
  return a ? a.slice(0, 6) + '…' + a.slice(-4) : '';
}

export function WalletButton() {
  const { address, chainId, connecting, connect } = useWallet();

  useEffect(() => {
    const e = eth();
    if (!e || !e.on) return;
    const onAcc = (accs: string[]) => useWallet.getState().setFromEvent(accs[0] || null, null);
    const onChain = (cid: string) => { useWallet.getState().setFromEvent(useWallet.getState().address, cid); };
    e.on('accountsChanged', onAcc);
    e.on('chainChanged', onChain);
    return () => { e.removeListener?.('accountsChanged', onAcc); e.removeListener?.('chainChanged', onChain); };
  }, []);

  const onInjective = chainId === INJECTIVE_TESTNET.chainIdHex;
  if (!hasWallet()) {
    return <a className="btn sm" href="https://metamask.io/" target="_blank" rel="noreferrer" title="需要注入式钱包">🦊 Wallet</a>;
  }
  if (!address) {
    return <button className="btn sm purple" disabled={connecting} onClick={connect}>{connecting ? '…' : '🔗 Connect'}</button>;
  }
  return (
    <button className={`btn sm ${onInjective ? 'green' : 'red'}`} onClick={connect} title={onInjective ? 'Injective EVM 1439' : '点击切换到 Injective 1439'}>
      {onInjective ? '⛓ ' : '⚠ '}{short(address)}
    </button>
  );
}
