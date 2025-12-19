import { MongoClient, Db, Collection } from 'mongodb';
import dotenv from 'dotenv';

dotenv.config();

export type InvoiceDoc = {
  name: string;
  tx_id: string;
  invoice_id?: string | null;
  status: 'pending' | 'confirmed';
  created_at?: Date;
};

const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017';
const dbName = process.env.MONGODB_DB || 'chainhooks';

let client: MongoClient | null = null;
let db: Db | null = null;
let invoices: Collection<InvoiceDoc> | null = null;

export async function getDb(): Promise<Db> {
  if (!client) {
    client = new MongoClient(uri);
    await client.connect();
  }
  if (!db) {
    db = client.db(dbName);
  }
  if (!invoices) {
    invoices = db.collection<InvoiceDoc>('invoices');
    await invoices.createIndex({ name: 1 }, { unique: true });
    await invoices.createIndex({ tx_id: 1 });
  }
  return db;
}

function getInvoicesCollection(): Collection<InvoiceDoc> {
  if (!invoices) throw new Error('Mongo not initialized. Call getDb() first.');
  return invoices;
}

export async function saveInvoice(name: string, txId: string): Promise<void> {
  await getDb();
  const col = getInvoicesCollection();
  await col.updateOne(
    { name },
    { $set: { name, tx_id: txId, status: 'pending' }, $setOnInsert: { created_at: new Date() } },
    { upsert: true }
  );
}

export async function getInvoice(name: string): Promise<InvoiceDoc | null> {
  await getDb();
  const col = getInvoicesCollection();
  return col.findOne({ name });
}

export async function getInvoiceByTxId(txId: string): Promise<InvoiceDoc | null> {
  await getDb();
  const col = getInvoicesCollection();
  return col.findOne({ tx_id: txId });
}

export async function confirmInvoice(name: string, invoiceId: string): Promise<void> {
  await getDb();
  const col = getInvoicesCollection();
  await col.updateOne({ name }, { $set: { invoice_id: invoiceId, status: 'confirmed' } });
}
