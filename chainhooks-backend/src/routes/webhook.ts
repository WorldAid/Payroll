import { Router, Request, Response } from 'express';

import { getInvoiceByTxId, confirmInvoice } from '../mongo';

const router = Router();

router.post('/', async (req: Request, res: Response) => {
    const event = req.body;
    console.log('Received Chainhook Event:', JSON.stringify(event, null, 2));

    if (event.apply && event.apply.length > 0) {
        for (const block of event.apply) {
            for (const tx of block.transactions) {
                if (tx.metadata && tx.metadata.kind === 'data') {
                    const txId = tx.transaction_identifier.hash;

                    // Find invoice by txId in DB
                    const row = await getInvoiceByTxId(txId);

                    if (row) {
                        const name = row.name;

                        // 1) Try to extract ID from receipt.result (when contract returns (ok (tuple (id uN))))
                        const resultStr: string | undefined = tx.metadata.receipt?.result;
                        if (typeof resultStr === 'string') {
                            // Examples:
                            //  - "(ok (tuple (id u42)))"
                            //  - "(ok (tuple (id u1) (other u2)))"
                            const match = resultStr.match(/\(ok\s*\(tuple[^)]*\(id u(\d+)\)\)/);
                            if (match) {
                                const newId = match[1];
                                await confirmInvoice(name, newId);
                                console.log(`[Mongo] Invoice confirmed via result: ${name} -> ID ${newId}`);
                                continue; // proceed to next tx
                            }
                        }

                        // 2) Fallback: parse SmartContractEvent print value
                        const events = tx.metadata.receipt?.events || [];
                        for (const evt of events) {
                            if (evt.type === 'SmartContractEvent' && evt.data && evt.data.value) {
                                const valueStr = JSON.stringify(evt.data.value);
                                if (valueStr.includes('invoice-created')) {
                                    const match = valueStr.match(/\(id u(\d+)\)/);
                                    if (match) {
                                        const newId = match[1];
                                        await confirmInvoice(name, newId);
                                        console.log(`[Mongo] Invoice confirmed via print: ${name} -> ID ${newId}`);
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
