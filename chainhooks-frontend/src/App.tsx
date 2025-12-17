import React, { useEffect, useMemo, useState } from 'react';
import { ChainhooksClient, CHAINHOOKS_BASE_URL, type Chainhook, type ChainhookDefinition } from '@hirosystems/chainhooks-client';

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
    // Provide your filters per Chainhooks schema.
    // The following is a starting point — adjust to your needs or paste a full filters object.
    contract_id: contractId,
    calls: [{ function_name: 'create-invoice' }, { function_name: 'pay-invoice' }],
    prints_contains: ['"event":"invoice-created"', '"event":"invoice-paid"'],
  },
  options: {
    // start_at_block_height: 1000000,
  },
  action: {
    // Example webhook action; replace with your endpoint and any headers/secrets as required.
    type: 'webhook',
    url: 'https://example.com/chainhooks/webhook',
    // headers: [{ key: 'X-Secret', value: '...' }],
  },
});

export function App() {
  const [network, setNetwork] = useState<Network>(ENV_DEFAULT_NETWORK);
  const [customBase, setCustomBase] = useState<string>(ENV_DEFAULT_BASE ?? '');
  const baseUrl = network === 'mainnet' ? CHAINHOOKS_BASE_URL.mainnet : CHAINHOOKS_BASE_URL.testnet;
  const finalBaseUrl = customBase || baseUrl;

  const [apiKey, setApiKey] = useState<string>(ENV_API_KEY ?? '');
  const [jwt, setJwt] = useState<string>(ENV_JWT ?? '');
  const client = useClient(finalBaseUrl, apiKey || undefined, jwt || undefined);

  const [status, setStatus] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [hooks, setHooks] = useState<Chainhook[]>([]);

  const [name, setName] = useState<string>('Stacks Payroll Invoices');
  const [contractId, setContractId] = useState<string>('');
  const [definitionJSON, setDefinitionJSON] = useState<string>('');

  // Initialize definition template when contractId or network changes
  useEffect(() => {
    try {
      const def = DEFAULT_DEFINITION_TEMPLATE(contractId, network);
      setDefinitionJSON(JSON.stringify(def, null, 2));
    } catch {}
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    <div style={{ fontFamily: 'system-ui, sans-serif', margin: '2rem', maxWidth: 1000 }}>
      <h1>Stacks Chainhooks Manager</h1>

      <section style={{ marginBottom: '1.5rem' }}>
        <h2>Configuration</h2>
        <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr', gap: '0.5rem 1rem', alignItems: 'center' }}>
          <label>Network</label>
          <div>
            <select value={network} onChange={(e) => setNetwork(e.target.value as Network)}>
              <option value="mainnet">mainnet ({CHAINHOOKS_BASE_URL.mainnet})</option>
              <option value="testnet">testnet ({CHAINHOOKS_BASE_URL.testnet})</option>
            </select>
          </div>

          <label>Custom Base URL</label>
          <input placeholder="Override base URL (optional)" value={customBase} onChange={(e) => setCustomBase(e.target.value)} />

          <label>API Key</label>
          <input placeholder="api key (optional)" value={apiKey} onChange={(e) => setApiKey(e.target.value)} />

          <label>JWT</label>
          <input placeholder="jwt (optional)" value={jwt} onChange={(e) => setJwt(e.target.value)} />
        </div>
      </section>

      <section style={{ marginBottom: '1.5rem' }}>
        <h2>Status</h2>
        {loading ? <p>Loading…</p> : status ? (
          <pre style={{ background: '#f6f8fa', padding: '0.75rem', borderRadius: 6 }}>
            {JSON.stringify(status, null, 2)}
          </pre>
        ) : (
          <p>No status yet.</p>
        )}
        {error && <p style={{ color: 'crimson' }}>Error: {error}</p>}
        <button onClick={refresh}>Refresh</button>
      </section>

      <section style={{ marginBottom: '1.5rem' }}>
        <h2>Register Payroll Chainhook</h2>
        <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr', gap: '0.5rem 1rem', alignItems: 'start' }}>
          <label>Name</label>
          <input value={name} onChange={(e) => setName(e.target.value)} />

          <label>Contract ID</label>
          <input placeholder="SP… .chainhook-contract" value={contractId} onChange={(e) => setContractId(e.target.value)} />

          <label>Definition (JSON)</label>
          <textarea rows={12} value={definitionJSON} onChange={(e) => setDefinitionJSON(e.target.value)} style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }} />
        </div>
        <div style={{ marginTop: '0.75rem' }}>
          <button onClick={register}>Register</button>
        </div>
      </section>

      <section>
        <h2>Existing Chainhooks</h2>
        {hooks.length === 0 ? <p>No chainhooks.</p> : (
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
                    <button onClick={() => remove(h.uuid)} style={{ color: 'crimson' }}>Delete</button>
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
