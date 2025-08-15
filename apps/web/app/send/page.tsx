
'use client';

import { http, createPublicClient, parseUnits } from 'viem';
import { baseSepolia } from 'viem/chains';
import { useState } from 'react';

export default function SendPage() {
  const [to, setTo] = useState('');
  const [amount, setAmount] = useState('1.00');
  const [status, setStatus] = useState<string>('idle');

  // Placeholder: in real app use WalletConnect + wagmi for signer
  async function simulate() {
    setStatus('simulating...');
    setTimeout(() => setStatus('tx simulated (connect wallet in real app)'), 800);
  }

  return (
    <main style={{ padding: 24 }}>
      <h2>USDC Send — Base Sepolia (mock)</h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxWidth: 420 }}>
        <input placeholder="Recipient address (0x...)" value={to} onChange={e => setTo(e.target.value)} />
        <input placeholder="Amount USDC (e.g., 1.00)" value={amount} onChange={e => setAmount(e.target.value)} />
        <button onClick={simulate}>Send (Mock)</button>
        <div>Status: {status}</div>
      </div>
    </main>
  );
}
