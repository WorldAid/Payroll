import express from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';
import webhookRoutes from './routes/webhook';
import { saveInvoice, getInvoice, getDb } from './mongo';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json());

app.get('/', (req, res) => {
    res.send('Chainhooks Backend is running!');
});

app.use('/webhook', webhookRoutes);

app.post('/invoices', async (req, res) => {
    const { name, txId } = req.body;
    if (!name || !txId) {
        return res.status(400).json({ error: 'Name and txId are required' });
    }
    try {
        await saveInvoice(name, txId);
        console.log(`[Mongo] Invoice pending: ${name} -> ${txId}`);
        res.status(201).json({ message: 'Invoice stored' });
    } catch (e: any) {
        console.error('Error saving invoice:', e);
        res.status(500).json({ error: 'Failed to store invoice' });
    }
});

app.get('/invoices/:name', async (req, res) => {
    const { name } = req.params;
    try {
        const invoice = await getInvoice(name);
        if (!invoice) {
            return res.status(404).json({ error: 'Invoice not found' });
        }
        res.json({ txId: invoice.tx_id, invoiceId: invoice.invoice_id, status: invoice.status });
    } catch (e: any) {
        console.error('Error fetching invoice:', e);
        res.status(500).json({ error: 'Failed to fetch invoice' });
    }
});

(async () => {
    try {
        await getDb();
        app.listen(PORT, () => {
            console.log(`Server is running on port ${PORT}`);
        });
    } catch (e) {
        console.error('Failed to initialize MongoDB:', e);
        process.exit(1);
    }
})();
