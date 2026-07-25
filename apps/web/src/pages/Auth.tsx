import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useAccount, useSignMessage } from 'wagmi';
import { useT } from '../i18n/index.js';
import { useAuth } from '../store.js';
import { api } from '../api.js';
import { useToast } from '../ui.js';
import { sfx } from '../audio.js';

// 登录方式只有一种：RainbowKit 连接钱包 + 签名。
// 用户 = 钱包地址；NFT / INJ 奖励 / 装饰品全部落在这个钱包上。
export function Auth() {
  const t = useT();
  const nav = useNavigate();
  const toast = useToast();
  const { walletAuth } = useAuth();
  const { address, isConnected } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const [busy, setBusy] = useState(false);

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
        {!isConnected && <p className="small muted">未安装钱包？先装 MetaMask / Rainbow 再回来。</p>}
        <p className="small muted" style={{ marginTop: 14 }}>
          登录即同意：全程遵守 Advx 极速版规则；被逮到偷开热点后果自负。
        </p>
      </div>
    </div>
  );
}
