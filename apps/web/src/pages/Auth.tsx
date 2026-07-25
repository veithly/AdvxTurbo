import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useAccount, useSignMessage } from 'wagmi';
import { useT } from '../i18n/index.js';
import { useAuth } from '../store.js';
import { api } from '../api.js';
import { useToast } from '../ui.js';
import { sfx } from '../audio.js';

// 登录方式：① RainbowKit 连接钱包 + 签名；② 无钱包一键创建内置托管钱包（服务端保管，自动发 gas）。
// 用户 = 钱包地址；NFT / INJ 奖励 / 装饰品全部落在这个钱包上。
export function Auth() {
  const t = useT();
  const nav = useNavigate();
  const toast = useToast();
  const { walletAuth } = useAuth();
  const { address, isConnected } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const [busy, setBusy] = useState(false);
  const [custodialBusy, setCustodialBusy] = useState(false);

  async function signIn() {
    if (!address) return;
    setBusy(true);
    sfx('click');
    try {
      const message = `Advx Turbo login\naddress=${address}\nts=${Date.now()}`;
      const signature = await signMessageAsync({ message });
      const { user, token } = await api.post('/api/auth/wallet', { address, message, signature });
      walletAuth(user, token);
      sfx('success');
      nav('/office');
    } catch (e: any) {
      toast.show(e.data?.code || e.message, 'err');
      sfx('error');
    } finally {
      setBusy(false);
    }
  }

  // 无钱包：服务端创建托管钱包（私钥加密保管），relayer 自动注资 0.01 INJ gas
  async function custodialSignIn() {
    setCustodialBusy(true);
    sfx('click');
    try {
      const { user, token, custodialWallet } = await api.post('/api/auth/custodial', {});
      walletAuth(user, token);
      sfx('success');
      const addr = custodialWallet?.address || '';
      toast.show(`🪄 托管钱包已创建 ${addr.slice(0, 8)}…${custodialWallet?.fundTx ? ' · 已注资 0.01 INJ' : ''}`);
      nav('/office');
    } catch (e: any) {
      toast.show(e.data?.code || e.message, 'err');
      sfx('error');
    } finally {
      setCustodialBusy(false);
    }
  }

  return (
    <div className="content" style={{ maxWidth: 480 }}>
      <div className="card center">
        <h2 className="page-title">⚡ 进入 Advx 极速版</h2>
        <p className="small muted" style={{ marginBottom: 16 }}>
          连接钱包即报名。你的选手身份 NFT（ERC-8004）、装饰品 NFT 与 INJ 奖励都会发到这个钱包（Injective EVM Testnet · 1439）。
        </p>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 14 }}>
          <ConnectButton showBalance={false} chainStatus="icon" />
        </div>
        {isConnected && (
          <button className="btn primary block" disabled={busy} onClick={signIn}>
            {busy ? '✍️ 等待签名…' : '✍️ 钱包签名登录 →'}
          </button>
        )}
        <div className="row" style={{ alignItems: 'center', gap: 8, margin: '12px 0 6px' }}>
          <span style={{ flex: 1, borderTop: '1px solid var(--border, #444)' }} />
          <span className="small muted">没有钱包？</span>
          <span style={{ flex: 1, borderTop: '1px solid var(--border, #444)' }} />
        </div>
        <button className="btn block" disabled={custodialBusy} onClick={custodialSignIn}>
          {custodialBusy ? '🪄 创建中…' : '🪄 一键创建内置托管钱包（自动送 0.01 INJ gas）'}
        </button>
        <p className="small muted" style={{ marginTop: 6 }}>托管钱包由服务端加密保管，NFT 与奖励同样真实上链可查。</p>
        <p className="small muted" style={{ marginTop: 14 }}>
          登录即同意：全程遵守 Advx 极速版规则；被逮到偷开热点后果自负。
        </p>
      </div>
    </div>
  );
}
