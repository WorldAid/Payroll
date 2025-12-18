import express from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';
import webhookRoutes from './routes/webhook';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json());

app.get('/', (req, res) => {
    res.send('Chainhooks Backend is running!');
});

app.use('/webhook', webhookRoutes);

// In-memory store for invoices
// Mapping: Name -> { txId, invoiceId, status }
export const invoiceStore: Record<string, { txId: string; invoiceId?: string; status: 'pending' | 'confirmed' }> = {};

app.post('/invoices', (req, res) => {
    const { name, txId } = req.body;
    if (!name || !txId) {
        return res.status(400).json({ error: 'Name and txId are required' });
    }
    invoiceStore[name] = { txId, status: 'pending' };
    console.log(`[Store] Invoice pending: ${name} -> ${txId}`);
    res.status(201).json({ message: 'Invoice stored' });
});

app.get('/invoices/:name', (req, res) => {
    const { name } = req.params;
    const invoice = invoiceStore[name];
    if (!invoice) {
        return res.status(404).json({ error: 'Invoice not found' });
    }
    res.json(invoice);
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
