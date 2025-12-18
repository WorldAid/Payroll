import { Router, Request, Response } from 'express';

import { getInvoiceByTxId, confirmInvoice } from '../db';

const router = Router();

router.post('/', (req: Request, res: Response) => {
    const event = req.body;
    console.log('Received Chainhook Event:', JSON.stringify(event, null, 2));

    if (event.apply && event.apply.length > 0) {
        for (const block of event.apply) {
            for (const tx of block.transactions) {
                if (tx.metadata && tx.metadata.kind === 'data') {
                    // Check for print events
                    // The chainhook is configured to capture prints: "prints_contains": ['"event":"invoice-created"']
                    // But the payload structure for 'data' kind might be different.
                    // Let's assume we can match by tx_id first.

                    const txId = tx.transaction_identifier.hash;

                    // Find invoice by txId in DB
                    const row = getInvoiceByTxId(txId);

                    if (row) {
                        const name = row.name;
                        // Try to extract the invoice ID from the print event or receipt
                        const events = tx.metadata.receipt?.events || [];
                        for (const evt of events) {
                            if (evt.type === 'SmartContractEvent' && evt.data && evt.data.value) {
                                const valueStr = JSON.stringify(evt.data.value);
                                if (valueStr.includes('invoice-created')) {
                                    const match = valueStr.match(/\(id u(\d+)\)/);
                                    if (match) {
                                        const newId = match[1];
                                        confirmInvoice(name, newId);
                                        console.log(`[DB] Invoice confirmed: ${name} -> ID ${newId}`);
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    res.status(200).json({ message: 'Event received' });
});

export default router;
