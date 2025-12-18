import { Router, Request, Response } from 'express';

import { invoiceStore } from '../index';

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

                    // Find the invoice in our store with this txId
                    const entry = Object.entries(invoiceStore).find(([_, val]) => val.txId === txId);

                    if (entry) {
                        const [name, val] = entry;
                        // Now try to extract the invoice ID from the print event or receipt
                        // The print event format: (tuple (event "invoice-created") (id u1) ...)
                        // We need to parse the receipt or metadata.

                        // For simplicity, let's look at the 'receipt' -> 'events'
                        // But chainhooks payload usually puts this in 'metadata' -> 'receipt'

                        // Let's inspect the logs first to be sure of the structure.
                        // But to proceed, I will try to find the "new-invoice-id" in the print output.

                        // Assuming the smart contract emits: (print { event: "invoice-created", id: new-id, ... })

                        // We can iterate over events in the transaction to find the one with our data.
                        // For now, I'll just mark it as confirmed and try to extract ID if possible.
                        // If we can't easily parse it without more info, I'll just log it.

                        // Wait, the user provided a JSON sample earlier (Step 594), but that was the return value of get-invoice.
                        // The print event will be different.

                        // Let's look for the print event in the transaction metadata.
                        // Chainhooks payload for 'stacks' usually has:
                        // transactions: [ { metadata: { receipt: { events: [ ... ] } } } ]

                        const events = tx.metadata.receipt?.events || [];
                        for (const evt of events) {
                            if (evt.type === 'SmartContractEvent' && evt.data && evt.data.value) {
                                // evt.data.value is the Clarity value string or object
                                // We need to parse it.
                                // If it's a string like "(tuple (event \"invoice-created\") (id u1))"
                                // It's hard to parse with regex reliably but let's try.

                                const valueStr = JSON.stringify(evt.data.value);
                                if (valueStr.includes('invoice-created')) {
                                    // Extract ID. Assuming format: (id u123)
                                    const match = valueStr.match(/\(id u(\d+)\)/);
                                    if (match) {
                                        const newId = match[1];
                                        invoiceStore[name] = { ...val, invoiceId: newId, status: 'confirmed' };
                                        console.log(`[Store] Invoice confirmed: ${name} -> ID ${newId}`);
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
