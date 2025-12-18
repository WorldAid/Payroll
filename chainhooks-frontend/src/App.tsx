import React, { useEffect, useMemo, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { ChainhooksClient, CHAINHOOKS_BASE_URL, type Chainhook, type ChainhookDefinition } from '@hirosystems/chainhooks-client';
import { AppConfig, UserSession, openContractCall, authenticate } from '@stacks/connect';
import * as StacksConnect from '@stacks/connect';
import { fetchCallReadOnlyFunction, uintCV, standardPrincipalCV, cvToJSON } from '@stacks/transactions';
import { STACKS_MAINNET, STACKS_TESTNET } from '@stacks/network';
import toast, { Toaster } from 'react-hot-toast';
import './App.css';
import { LandingPage } from './LandingPage';

console.log('StacksConnect imports:', StacksConnect);
console.log('authenticate:', authenticate);

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

function Dashboard() {
  const navigate = useNavigate();
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
  const [contractId, setContractId] = useState('SP2A8V93XXB43Q8JXQNCS9EBFHZJ6A2HVXHC4F4ZB.chainhook-contract');
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

  const handleConnect = () => {
    authenticate({
      appDetails: {
        name: 'Stacks Chainhooks Manager',
        icon: window.location.origin + '/vite.svg',
      },
      redirectTo: '/',
      onFinish: () => {
        const userData = userSession.loadUserData();
        const addr = userData?.profile?.stxAddress?.[network];
        setIsSignedIn(true);
        setUserAddress(addr || '');
        toast.success('Wallet connected!');
      },
      onCancel: () => {
        // Fallback to manual
        setError('No wallet selected. Please connect manually below.');
        setShowManualInput(true);
        toast.error('Connection cancelled. Try manual mode.');
      },
      userSession,
    });
  };

  const handleManualConnect = () => {
    if (manualAddress.trim()) {
      setIsSignedIn(true);
      setUserAddress(manualAddress.trim());
      setShowManualInput(false);
      setError(null);
      toast.success('Manual address set!');
    }
  };

  const handleDisconnect = () => {
    userSession.signUserOut();
    setIsSignedIn(false);
    setUserAddress('');
    setManualAddress('');
    setError(null);
    toast('Disconnected', { icon: '👋' });
  };

  const copyAddress = () => {
    try {
      navigator.clipboard.writeText(userAddress);
      toast.success('Address copied!');
    } catch (e) {
      console.error('Copy failed:', e);
      toast.error('Failed to copy address');
    }
  };

  useEffect(() => {
    try {
      const def = DEFAULT_DEFINITION_TEMPLATE(contractId, network);
      setDefinitionJSON(JSON.stringify(def, null, 2));
    } catch { }
  }, [contractId, network]);

  async function refresh() {
    console.log('Refreshing status...');
    setLoading(true);
    setError(null);
    try {
      console.log('Fetching status from:', finalBaseUrl);
      const s = await client.getStatus();
      console.log('Status response:', s);
      setStatus(s);
      console.log('Fetching chainhooks...');
      const { results } = await client.getChainhooks({ limit: 50, offset: 0 });
      console.log('Chainhooks response:', results);
      setHooks(results);
    } catch (e: any) {
      console.error('Refresh error:', e);
      setError(e?.message ?? String(e));
      toast.error('Failed to refresh status');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, [finalBaseUrl, apiKey, jwt]);

  async function register() {
    console.log('Register button clicked');
    setError(null);
    const toastId = toast.loading('Registering chainhook...');
    try {
      console.log('Parsing definition JSON:', definitionJSON);
      const parsed = JSON.parse(definitionJSON) as ChainhookDefinition;
      if (!parsed.name && name) parsed.name = name;
      console.log('Sending registration request:', parsed);
      const res = await client.registerChainhook(parsed);
      console.log('Registration response:', res);
      await refresh();
      toast.success(`Registered: ${res.uuid}`, { id: toastId });
    } catch (e: any) {
      console.error('Registration error:', e);
      setError(e?.message ?? String(e));
      toast.error(`Registration failed: ${e?.message}`, { id: toastId });
    }
  }

  async function toggleEnabled(uuid: string, enabled: boolean) {
    setError(null);
    const toastId = toast.loading(enabled ? 'Enabling...' : 'Disabling...');
    try {
      await client.enableChainhook(uuid, enabled);
      await refresh();
      toast.success(enabled ? 'Chainhook enabled' : 'Chainhook disabled', { id: toastId });
    } catch (e: any) {
      setError(e?.message ?? String(e));
      toast.error(`Failed to update: ${e?.message}`, { id: toastId });
    }
  }

  async function remove(uuid: string) {
    if (!confirm('Delete this chainhook?')) return;
    setError(null);
    const toastId = toast.loading('Deleting chainhook...');
    try {
      await client.deleteChainhook(uuid);
      await refresh();
      toast.success('Chainhook deleted', { id: toastId });
    } catch (e: any) {
      setError(e?.message ?? String(e));
      toast.error(`Deletion failed: ${e?.message}`, { id: toastId });
    }
  }

  // Smart Contract Interaction State
  const [recipient, setRecipient] = useState('');
  const [amount, setAmount] = useState('');
  const [invoiceId, setInvoiceId] = useState('');
  const [invoiceDetails, setInvoiceDetails] = useState<any>(null);

  const isManualMode = !((typeof window !== 'undefined' && (window as any).btc) || (typeof window !== 'undefined' && (window as any).StacksProvider));

  const handleCreateInvoice = async () => {
    if (!contractId) {
      toast.error('Please set the Contract ID first.');
      return;
    }

    if (isManualMode) {
      const mockTxId = `0x${Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join('')}`;
      toast(`[SIMULATION] Transaction broadcasted: ${mockTxId}`, {
        icon: '🧪',
        duration: 5000,
      });
      return;
    }

    const [contractAddress, contractName] = contractId.split('.');

    const options = {
      network: network === 'mainnet' ? STACKS_MAINNET : STACKS_TESTNET,
      contractAddress,
      contractName,
      functionName: 'create-invoice',
      functionArgs: [standardPrincipalCV(recipient), uintCV(amount)],
      appDetails: {
        name: 'Stacks Chainhooks Manager',
        icon: window.location.origin + '/vite.svg',
      },
      onFinish: (data: any) => {
        console.log('Transaction finished:', data);
        toast.success(`Transaction broadcasted: ${data.txId}`);
      },
    };
    console.log('openContractCall options (create-invoice):', options);
    await openContractCall(options);
  };

  const handlePayInvoice = async () => {
    if (!contractId) {
      toast.error('Please set the Contract ID first.');
      return;
    }

    if (isManualMode) {
      const mockTxId = `0x${Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join('')}`;
      toast(`[SIMULATION] Transaction broadcasted: ${mockTxId}`, {
        icon: '🧪',
        duration: 5000,
      });
      return;
    }

    const [contractAddress, contractName] = contractId.split('.');

    const options = {
      network: network === 'mainnet' ? STACKS_MAINNET : STACKS_TESTNET,
      contractAddress,
      contractName,
      functionName: 'pay-invoice',
      functionArgs: [uintCV(invoiceId)],
      appDetails: {
        name: 'Stacks Chainhooks Manager',
        icon: window.location.origin + '/vite.svg',
      },
      onFinish: (data: any) => {
        console.log('Transaction finished:', data);
        toast.success(`Transaction broadcasted: ${data.txId}`);
      },
    };
    console.log('openContractCall options (pay-invoice):', options);
    await openContractCall(options);
  };

  const handleGetInvoice = async () => {
    if (!contractId) {
      toast.error('Please set the Contract ID first.');
      return;
    }
    const [contractAddress, contractName] = contractId.split('.');

    const toastId = toast.loading('Fetching invoice...');
    try {
      const result = await fetchCallReadOnlyFunction({
        network: network === 'mainnet' ? STACKS_MAINNET : STACKS_TESTNET,
        contractAddress,
        contractName,
        functionName: 'get-invoice',
        functionArgs: [uintCV(invoiceId)],
        senderAddress: userAddress || contractAddress,
      });
      setInvoiceDetails(cvToJSON(result));
      toast.success('Invoice fetched', { id: toastId });
    } catch (e: any) {
      console.error('Error fetching invoice:', e);
      setError(e?.message ?? String(e));
      toast.error(`Error fetching invoice: ${e?.message}`, { id: toastId });
    }
  };

  return (
    <div className="app-container">
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: '#112240',
            color: '#e6f1ff',
            border: '1px solid rgba(100, 255, 218, 0.1)',
          },
          success: {
            iconTheme: {
              primary: '#64ffda',
              secondary: '#112240',
            },
          },
          error: {
            iconTheme: {
              primary: '#ff5555',
              secondary: '#112240',
            },
          },
        }}
      />
      <button className="btn secondary" onClick={() => navigate('/')} style={{ marginBottom: '1rem' }}>
        &larr; Back to Home
      </button>
      <h1>Stacks Chainhooks Manager</h1>

      <section className="card">
        <h2>Wallet</h2>
        {isSignedIn ? (
          <div className="flex-row">
            <p style={{ margin: 0, marginRight: '1rem' }}>Connected: {userAddress || 'Unknown address'}</p>
            <button onClick={copyAddress}>
              Copy
            </button>
            <button onClick={handleDisconnect} className="danger">
              Disconnect
            </button>
          </div>
        ) : (
          <div>
            <div className="flex-row">
              <button onClick={handleConnect}>Connect Stacks Wallet</button>
              <button onClick={() => setShowManualInput(!showManualInput)} className="secondary">
                {showManualInput ? 'Cancel Manual' : 'Connect Manually'}
              </button>
            </div>

            {showManualInput && (
              <div className="manual-input-container">
                <label>Enter Stacks Address:</label>
                <input
                  type="text"
                  value={manualAddress}
                  onChange={(e) => setManualAddress(e.target.value)}
                  placeholder="ST..."
                />
                <button onClick={handleManualConnect} disabled={!manualAddress}>
                  Set Address
                </button>
              </div>
            )}
          </div>
        )}
      </section>

      <section className="card">
        <h2>Configuration</h2>
        <div className="grid-2">
          <div>
            <label>Network</label>
            <select value={network} onChange={(e) => setNetwork(e.target.value as Network)}>
              <option value="mainnet">mainnet ({CHAINHOOKS_BASE_URL.mainnet})</option>
              <option value="testnet">testnet ({CHAINHOOKS_BASE_URL.testnet})</option>
            </select>
          </div>
          <div>
            <label>Custom Base URL</label>
            <input type="text" value={customBase} onChange={(e) => setCustomBase(e.target.value)} />
          </div>
          <div>
            <label>API Key</label>
            <input type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} />
          </div>
          <div>
            <label>JWT</label>
            <input type="password" value={jwt} onChange={(e) => setJwt(e.target.value)} />
          </div>
        </div>
      </section>

      <section className="card">
        <div className="flex-between">
          <h2>Status</h2>
          <button onClick={refresh} className="secondary">
            Refresh
          </button>
        </div>

        {loading ? (
          <div style={{ marginTop: '1rem' }}>Loading…</div>
        ) : status ? (
          <pre className="status-box" style={{ marginTop: '1rem' }}>
            {JSON.stringify(status, null, 2)}
          </pre>
        ) : (
          <p style={{ marginTop: '1rem' }}>No status yet.</p>
        )}
        {error && <div className="error-message">Error: {error}</div>}
      </section>

      <section className="card">
        <h2>Register Payroll Chainhook</h2>
        <div className="grid-2">
          <div>
            <label>Name</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <label>Contract ID</label>
            <input type="text" value={contractId} onChange={(e) => setContractId(e.target.value)} />
          </div>
        </div>
        <div>
          <label>Definition (JSON)</label>
          <textarea
            value={definitionJSON}
            onChange={(e) => setDefinitionJSON(e.target.value)}
            rows={15}
            className="code-input"
            style={{ fontFamily: 'monospace' }}
          />
        </div>
        <div style={{ marginTop: '1rem' }}>
          <button onClick={register}>Register</button>
        </div>
      </section>

      <section className="card">
        <h2>Smart Contract Interactions</h2>

        <div style={{ marginBottom: '2rem' }}>
          <h3>Create Invoice</h3>
          <div className="grid-2">
            <div>
              <label>Recipient Address</label>
              <input type="text" value={recipient} onChange={(e) => setRecipient(e.target.value)} placeholder="ST..." />
            </div>
            <div>
              <label>Amount (microSTX)</label>
              <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="1000000" />
            </div>
          </div>
          <button onClick={handleCreateInvoice}>Create Invoice</button>
        </div>

        <div style={{ marginBottom: '2rem', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '2rem' }}>
          <h3>Pay Invoice</h3>
          <div>
            <label>Invoice ID</label>
            <input type="number" value={invoiceId} onChange={(e) => setInvoiceId(e.target.value)} placeholder="1" />
          </div>
          <button onClick={handlePayInvoice}>Pay Invoice</button>
        </div>

        <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '2rem' }}>
          <h3>Get Invoice Details</h3>
          <div className="flex-row" style={{ alignItems: 'flex-end' }}>
            <div style={{ flex: 1 }}>
              <label>Invoice ID</label>
              <input type="number" value={invoiceId} onChange={(e) => setInvoiceId(e.target.value)} placeholder="1" style={{ marginBottom: 0 }} />
            </div>
            <button onClick={handleGetInvoice}>Get Invoice</button>
          </div>

          {invoiceDetails && (
            <pre className="status-box" style={{ marginTop: '1rem' }}>
              {JSON.stringify(invoiceDetails, null, 2)}
            </pre>
          )}
        </div>
      </section>

      <section className="card">
        <h2>Existing Chainhooks</h2>
        {hooks.length === 0 ? (
          <p>No chainhooks.</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>UUID</th>
                  <th>Enabled</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {hooks.map((h) => (
                  <tr key={h.uuid}>
                    <td>{h.definition?.name ?? '(no name)'}</td>
                    <td>{h.uuid}</td>
                    <td>{String(h.status.enabled)}</td>
                    <td>
                      <div className="flex-row">
                        <button onClick={() => toggleEnabled(h.uuid, !h.status.enabled)} className="secondary">
                          {h.status.enabled ? 'Disable' : 'Enable'}
                        </button>
                        <button onClick={() => remove(h.uuid)} className="danger">
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}