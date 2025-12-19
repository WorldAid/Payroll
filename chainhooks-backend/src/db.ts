import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';

// Ensure data directory exists relative to backend CWD
const dataDir = path.join(process.cwd(), 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'app.db');
const db = new Database(dbPath);

db.exec(`
CREATE TABLE IF NOT EXISTS invoices (
  name TEXT PRIMARY KEY,
  tx_id TEXT NOT NULL,
  invoice_id TEXT,
  status TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
`);

export type InvoiceRow = {
  name: string;
  tx_id: string;
  invoice_id?: string | null;
  status: 'pending' | 'confirmed';
  created_at?: string;
};

export function saveInvoice(name: string, txId: string): void {
  const stmt = db.prepare(
    `INSERT INTO invoices (name, tx_id, status)
     VALUES (?, ?, 'pending')
     ON CONFLICT(name) DO UPDATE SET tx_id=excluded.tx_id, status='pending'`
  );
  stmt.run(name, txId);
}

export function getInvoice(name: string): InvoiceRow | undefined {
  const row = db.prepare(`SELECT * FROM invoices WHERE name = ?`).get(name) as InvoiceRow | undefined;
  return row;
}

export function getInvoiceByTxId(txId: string): InvoiceRow | undefined {
  const row = db.prepare(`SELECT * FROM invoices WHERE tx_id = ?`).get(txId) as InvoiceRow | undefined;
  return row;
}

export function confirmInvoice(name: string, invoiceId: string): void {
  const stmt = db.prepare(
    `UPDATE invoices SET invoice_id = ?, status = 'confirmed' WHERE name = ?`
  );
  stmt.run(invoiceId, name);
}

export default db;
