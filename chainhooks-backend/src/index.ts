import express from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';
import webhookRoutes from './routes/webhook';
import { saveInvoice, getInvoice } from './db';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json());

app.get('/', (req, res) => {
    res.send('Chainhooks Backend is running!');
});

app.use('/webhook', webhookRoutes);

app.post('/invoices', (req, res) => {
    const { name, txId } = req.body;
    if (!name || !txId) {
        return res.status(400).json({ error: 'Name and txId are required' });
    }
    // Persist to SQLite
    saveInvoice(name, txId);
    console.log(`[DB] Invoice pending: ${name} -> ${txId}`);
    res.status(201).json({ message: 'Invoice stored' });
});

app.get('/invoices/:name', (req, res) => {
    const { name } = req.params;
    const invoice = getInvoice(name);
    if (!invoice) {
        return res.status(404).json({ error: 'Invoice not found' });
    }
    res.json({ txId: invoice.tx_id, invoiceId: invoice.invoice_id, status: invoice.status });
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
