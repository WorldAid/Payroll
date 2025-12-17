import React, { useEffect, useMemo, useState } from 'react';
import { ChainhooksClient, CHAINHOOKS_BASE_URL, type Chainhook, type ChainhookDefinition } from '@hirosystems/chainhooks-client';
import { AppConfig, UserSession } from '@stacks/connect';

const ENV_DEFAULT_BASE = (import.meta as any).env?.VITE_CHAINHOOKS_BASE_URL as string | undefined;
const ENV_API_KEY = (import.meta as any).env?.VITE_CHAINHOOKS_API_KEY as string | undefined;
const ENV_JWT = (import.meta as any).env?.VITE_CHAINHOOKS_JWT as string | undefined;
const ENV_DEFAULT_NETWORK = ((import.meta as any).env?.VITE_DEFAULT_NETWORK as 'mainnet' | 'testnet' | undefined) ?? 'mainnet';

type Network = 'mainnet' | 'testnet';

function useClient(baseUrl: string, apiKey?: string, jwt?: string) {
  return useMemo(() => new ChainhooksClient({ baseUrl, apiKey, jwt }), [baseUrl, apiKey, jwt]);
}

const DEFAULT_DEFINITION_TEMPLATE = (contractId: string, network: Network) => ({
  name: 'Stacks Payroll Invoices',
  chain: 'stacks',
  network,
  filters: {
    contract_id: contractId,
    calls: [{ function_name: 'create-invoice' }, { function_name: 'pay-invoice' }],
    prints_contains: ['"event":"invoice-created"', '"event":"invoice-paid"'],
  },
  options: {},
  action: {
    type: 'webhook',
    url: 'https://example.com/chainhooks/webhook',
  },
});

const appConfig = new AppConfig(['store_write', 'publish_data']);
const userSession = new UserSession({ appConfig });

export function App() {
  const [network, setNetwork] = useState<Network>(ENV_DEFAULT_NETWORK);
  const [customBase, setCustomBase] = useState(ENV_DEFAULT_BASE ?? '');
  const baseUrl = network === 'mainnet' ? CHAINHOOKS_BASE_URL.mainnet : CHAINHOOKS_BASE_URL.testnet;
  const finalBaseUrl = customBase || baseUrl;
  const [apiKey, setApiKey] = useState(ENV_API_KEY ?? '');
  const [jwt, setJwt] = useState(ENV_JWT ?? '');
  const client = useClient(finalBaseUrl, apiKey || undefined, jwt || undefined);

  const [status, setStatus] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hooks, setHooks] = useState<Chainhook[]>([]);
  const [name, setName] = useState('Stacks Payroll Invoices');
  const [contractId, setContractId] = useState('');
  const [definitionJSON, setDefinitionJSON] = useState('');
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [userAddress, setUserAddress] = useState<string>('');

  // Check auth status
  useEffect(() => {
    if (userSession.isUserSignedIn()) {
      setIsSignedIn(true);
      try {
        const userData = userSession.loadUserData();
        const addr = userData?.profile?.stxAddress?.[network];
        setUserAddress(addr || '');
      } catch (e) {
        console.error('Error loading user data:', e);
      }
    }
  }, [network]);

  const [manualAddress, setManualAddress] = useState('');
  const [showManualInput, setShowManualInput] = useState(false);

  const handleConnect = async () => {
    try {
      // Simple wallet extension detection and connection
      if (typeof window !== 'undefined' && (window as any).btc) {
        // Leather wallet
        const response = await (window as any).btc.request('getAddresses');
        if (response?.result?.addresses) {
          const stxAddress = response.result.addresses.find((a: any) => a.type === 'stacks');
          if (stxAddress) {
            setIsSignedIn(true);
            setUserAddress(stxAddress.address);
            return;
          }
        }
      } else if (typeof window !== 'undefined' && (window as any).StacksProvider) {
        // Hiro wallet
        const addresses = await (window as any).StacksProvider.getAddresses();
        if (addresses?.length > 0) {
          setIsSignedIn(true);
          setUserAddress(addresses[0]);
          return;
        }
      }

      // Fallback: open Hiro wallet website
      alert('Please install a Stacks wallet extension (Leather or Hiro Wallet) to connect.');
    } catch (e) {
      console.error('Auth error:', e);
      setError('Failed to connect wallet. Please make sure you have a Stacks wallet installed.');
    }
  };

  const handleManualConnect = () => {
    if (manualAddress.trim()) {
      setIsSignedIn(true);
      setUserAddress(manualAddress.trim());
      setShowManualInput(false);
    }
  };

  const handleDisconnect = () => {
    userSession.signUserOut();
    setIsSignedIn(false);
    setUserAddress('');
    setManualAddress('');
    // window.location.reload(); // Removed reload to keep state for manual testing
  };

  const copyAddress = () => {
    try {
      navigator.clipboard.writeText(userAddress);
    } catch (e) {
      console.error('Copy failed:', e);
    }
  };

  useEffect(() => {
    try {
      const def = DEFAULT_DEFINITION_TEMPLATE(contractId, network);
      setDefinitionJSON(JSON.stringify(def, null, 2));
    } catch { }
  }, [contractId, network]);

  async function refresh() {
    setLoading(true);
    setError(null);
    try {
      const s = await client.getStatus();
      setStatus(s);
      const { results } = await client.getChainhooks({ limit: 50, offset: 0 });
      setHooks(results);
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, [finalBaseUrl, apiKey, jwt]);

  async function register() {
    setError(null);
    try {
      const parsed = JSON.parse(definitionJSON) as ChainhookDefinition;
      if (!parsed.name && name) parsed.name = name;
      const res = await client.registerChainhook(parsed);
      await refresh();
      alert(`Registered: ${res.uuid}`);
    } catch (e: any) {
      setError(e?.message ?? String(e));
    }
  }

  async function toggleEnabled(uuid: string, enabled: boolean) {
    setError(null);
    try {
      await client.enableChainhook(uuid, enabled);
      await refresh();
    } catch (e: any) {
      setError(e?.message ?? String(e));
    }
  }

  async function remove(uuid: string) {
    if (!confirm('Delete this chainhook?')) return;
    setError(null);
    try {
      await client.deleteChainhook(uuid);
      await refresh();
    } catch (e: any) {
      setError(e?.message ?? String(e));
    }
  }

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '2rem', fontFamily: 'system-ui, sans-serif' }}>
      <h1>Stacks Chainhooks Manager</h1>

      <section style={{ marginBottom: '2rem', padding: '1rem', border: '1px solid #ddd', borderRadius: '8px' }}>
        <h2>Wallet</h2>
        {isSignedIn ? (
          <div>
            <p>Connected: {userAddress || 'Unknown address'}</p>
            <button onClick={copyAddress} style={{ marginRight: '8px' }}>
              Copy
            </button>
            <button onClick={handleDisconnect} style={{ color: 'crimson' }}>
              Disconnect
            </button>
          </div>
        ) : (
          <div>
            <button onClick={handleConnect} style={{ marginRight: '10px' }}>Connect Stacks Wallet</button>
            <button onClick={() => setShowManualInput(!showManualInput)}>
              {showManualInput ? 'Cancel Manual' : 'Connect Manually'}
            </button>

            {showManualInput && (
              <div style={{ marginTop: '1rem', padding: '1rem', background: '#f9f9f9', borderRadius: '4px' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem' }}>Enter Stacks Address:</label>
                <input
                  type="text"
                  value={manualAddress}
                  onChange={(e) => setManualAddress(e.target.value)}
                  placeholder="ST..."
                  style={{ width: '100%', marginBottom: '0.5rem', padding: '0.5rem' }}
                />
                <button onClick={handleManualConnect} disabled={!manualAddress}>
                  Set Address
                </button>
              </div>
            )}
          </div>
        )}
      </section>

      <section style={{ marginBottom: '2rem', padding: '1rem', border: '1px solid #ddd', borderRadius: '8px' }}>
        <h2>Configuration</h2>
        <div style={{ marginBottom: '1rem' }}>
          <label style={{ display: 'block', marginBottom: '0.5rem' }}>Network</label>
          <select value={network} onChange={(e) => setNetwork(e.target.value as Network)}>
            <option value="mainnet">mainnet ({CHAINHOOKS_BASE_URL.mainnet})</option>
            <option value="testnet">testnet ({CHAINHOOKS_BASE_URL.testnet})</option>
          </select>
        </div>
        <div style={{ marginBottom: '1rem' }}>
          <label style={{ display: 'block', marginBottom: '0.5rem' }}>Custom Base URL</label>
          <input type="text" value={customBase} onChange={(e) => setCustomBase(e.target.value)} style={{ width: '100%' }} />
        </div>
        <div style={{ marginBottom: '1rem' }}>
          <label style={{ display: 'block', marginBottom: '0.5rem' }}>API Key</label>
          <input type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} style={{ width: '100%' }} />
        </div>
        <div style={{ marginBottom: '1rem' }}>
          <label style={{ display: 'block', marginBottom: '0.5rem' }}>JWT</label>
          <input type="password" value={jwt} onChange={(e) => setJwt(e.target.value)} style={{ width: '100%' }} />
        </div>
      </section>

      <section style={{ marginBottom: '2rem', padding: '1rem', border: '1px solid #ddd', borderRadius: '8px' }}>
        <h2>Status</h2>
        {loading ? (
          <div>Loading…</div>
        ) : status ? (
          <pre style={{ background: '#f5f5f5', padding: '1rem', borderRadius: '4px', overflow: 'auto' }}>
            {JSON.stringify(status, null, 2)}
          </pre>
        ) : (
          <p>No status yet.</p>
        )}
        {error && <div style={{ color: 'crimson', marginTop: '1rem' }}>Error: {error}</div>}
        <button onClick={refresh} style={{ marginTop: '1rem' }}>
          Refresh
        </button>
      </section>

      <section style={{ marginBottom: '2rem', padding: '1rem', border: '1px solid #ddd', borderRadius: '8px' }}>
        <h2>Register Payroll Chainhook</h2>
        <div style={{ marginBottom: '1rem' }}>
          <label style={{ display: 'block', marginBottom: '0.5rem' }}>Name</label>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} style={{ width: '100%' }} />
        </div>
        <div style={{ marginBottom: '1rem' }}>
          <label style={{ display: 'block', marginBottom: '0.5rem' }}>Contract ID</label>
          <input type="text" value={contractId} onChange={(e) => setContractId(e.target.value)} style={{ width: '100%' }} />
        </div>
        <div style={{ marginBottom: '1rem' }}>
          <label style={{ display: 'block', marginBottom: '0.5rem' }}>Definition (JSON)</label>
          <textarea
            value={definitionJSON}
            onChange={(e) => setDefinitionJSON(e.target.value)}
            rows={15}
            style={{ width: '100%', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}
          />
        </div>
        <div style={{ marginTop: '0.75rem' }}>
          <button onClick={register}>Register</button>
        </div>
      </section>

      <section>
        <h2>Existing Chainhooks</h2>
        {hooks.length === 0 ? (
          <p>No chainhooks.</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd', padding: 6 }}>Name</th>
                <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd', padding: 6 }}>UUID</th>
                <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd', padding: 6 }}>Enabled</th>
                <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd', padding: 6 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {hooks.map((h) => (
                <tr key={h.uuid}>
                  <td style={{ borderBottom: '1px solid #eee', padding: 6 }}>{h.definition?.name ?? '(no name)'}</td>
                  <td style={{ borderBottom: '1px solid #eee', padding: 6 }}>{h.uuid}</td>
                  <td style={{ borderBottom: '1px solid #eee', padding: 6 }}>{String(h.enabled)}</td>
                  <td style={{ borderBottom: '1px solid #eee', padding: 6 }}>
                    <button onClick={() => toggleEnabled(h.uuid, !h.enabled)} style={{ marginRight: 8 }}>
                      {h.enabled ? 'Disable' : 'Enable'}
                    </button>
                    <button onClick={() => remove(h.uuid)} style={{ color: 'crimson' }}>
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}