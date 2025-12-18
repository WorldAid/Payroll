import React from 'react';

interface InvoiceData {
    type: string;
    value: {
        type: string;
        value: {
            amount: { type: string; value: string };
            'created-height': { type: string; value: string };
            creator: { type: string; value: string };
            'paid-height': { type: string; value: string | null };
            payer: { type: string; value: string | null };
            recipient: { type: string; value: string };
            status: { type: string; value: string };
        };
    };
    success: boolean;
}

interface InvoiceCardProps {
    data: any;
}

export function InvoiceCard({ data }: InvoiceCardProps) {
    if (!data || !data.success || !data.value || !data.value.value) {
        return <div className="error-message">Invalid invoice data</div>;
    }

    const invoice = data.value.value;
    const status = invoice.status.value === '1' ? 'PAID' : 'UNPAID';
    const isPaid = status === 'PAID';

    return (
        <div className={`invoice-card ${isPaid ? 'paid' : 'unpaid'}`}>
            <div className="invoice-header">
                <h3>Invoice Document</h3>
                <span className={`status-badge ${isPaid ? 'paid' : 'unpaid'}`}>{status}</span>
            </div>

            <div className="invoice-body">
                <div className="invoice-row">
                    <span className="label">Amount:</span>
                    <span className="value highlight">{invoice.amount.value} microSTX</span>
                </div>

                <div className="invoice-row">
                    <span className="label">Recipient:</span>
                    <span className="value mono">{invoice.recipient.value}</span>
                </div>

                <div className="invoice-row">
                    <span className="label">Creator:</span>
                    <span className="value mono">{invoice.creator.value}</span>
                </div>

                <div className="divider"></div>

                <div className="invoice-row">
                    <span className="label">Created at Block:</span>
                    <span className="value">{invoice['created-height'].value}</span>
                </div>

                {isPaid && (
                    <>
                        <div className="invoice-row">
                            <span className="label">Paid at Block:</span>
                            <span className="value">{invoice['paid-height'].value}</span>
                        </div>
                        <div className="invoice-row">
                            <span className="label">Payer:</span>
                            <span className="value mono">{invoice.payer.value}</span>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
