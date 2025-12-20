import { Router, Request, Response } from 'express';

import { getInvoiceByTxId, confirmInvoice } from '../mongo';

const router = Router();

function extractIdFromResult(result: any): string | null {
    // If result is a string Clarity form: (ok (tuple (id u42)))
    if (typeof result === 'string') {
        const m = result.match(/\(ok\s*\(tuple[^)]*\(id u(\d+)\)\)/);
        if (m) return m[1];
        // Try simpler patterns too
        const m2 = result.match(/\(id u(\d+)\)/);
        if (m2) return m2[1];
    }
    // If result is an object like { ok: { tuple: { id: { u: "42" } } } } or variations
    try {
        const walk = (obj: any): string | null => {
            if (!obj || typeof obj !== 'object') return null;
            // Common shapes
            if (obj.id && (typeof obj.id === 'string' || typeof obj.id === 'number')) return String(obj.id);
            if (obj.u && (typeof obj.u === 'string' || typeof obj.u === 'number')) return String(obj.u);
            if (obj.value && (typeof obj.value === 'string' || typeof obj.value === 'number')) return String(obj.value);
            for (const k of Object.keys(obj)) {
                const got = walk(obj[k]);
                if (got) return got;
            }
            return null;
        };
        const v = walk(result);
        if (v && /^\d+$/.test(v)) return v;
    } catch {}
    return null;
}

function extractIdFromEvents(events: any[]): string | null {
    for (const evt of events) {
        if (evt && evt.type === 'SmartContractEvent') {
            // value may be string or nested
            const val = evt.data?.value;
            if (typeof val === 'string') {
                const m = val.match(/\(id u(\d+)\)/);
                if (m) return m[1];
            } else if (val) {
                const json = JSON.stringify(val);
                const m2 = json.match(/\(id u(\d+)\)/);
                if (m2) return m2[1];
            }
        }
    }
    return null;
}

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

                        // Try receipt.result first (string or object)
                        const resultAny = tx.metadata.receipt?.result;
                        const idFromResult = extractIdFromResult(resultAny);
                        if (idFromResult) {
                            await confirmInvoice(name, idFromResult);
                            console.log(`[Mongo] Invoice confirmed via result: ${name} -> ID ${idFromResult}`);
                            continue; // next tx
                        }

                        // Fallback: parse SmartContractEvent print value
                        const events = tx.metadata.receipt?.events || [];
                        const idFromEvents = extractIdFromEvents(events);
                        if (idFromEvents) {
                            await confirmInvoice(name, idFromEvents);
                            console.log(`[Mongo] Invoice confirmed via print: ${name} -> ID ${idFromEvents}`);
                            continue;
                        }

                        console.warn(`[Webhook] Could not extract invoice ID for name=${name}, txId=${txId}. Add a print with id or share receipt structure.`);
                    }
                }
            }
        }
    }

    res.status(200).json({ message: 'Event received' });
});

export default router;
