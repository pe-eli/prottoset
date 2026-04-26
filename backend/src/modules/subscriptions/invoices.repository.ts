import { systemQuery, userQuery } from '../../db/pool';

interface InvoiceRow {
  id: string;
  user_id: string;
  stripe_invoice_id: string;
  amount: number;
  currency: string;
  status: string;
  hosted_invoice_url: string | null;
  invoice_pdf: string | null;
  paid_at: Date | null;
  created_at: Date;
}

export interface Invoice {
  id: string;
  userId: string;
  stripeInvoiceId: string;
  amount: number;
  currency: string;
  status: string;
  hostedInvoiceUrl: string | null;
  invoicePdf: string | null;
  paidAt: string | null;
  createdAt: string;
}

function toInvoice(row: InvoiceRow): Invoice {
  return {
    id: row.id,
    userId: row.user_id,
    stripeInvoiceId: row.stripe_invoice_id,
    amount: row.amount,
    currency: row.currency,
    status: row.status,
    hostedInvoiceUrl: row.hosted_invoice_url,
    invoicePdf: row.invoice_pdf,
    paidAt: row.paid_at ? row.paid_at.toISOString() : null,
    createdAt: row.created_at.toISOString(),
  };
}

export const invoicesRepository = {
  async upsert(data: {
    userId: string;
    stripeInvoiceId: string;
    amount: number;
    currency: string;
    status: string;
    hostedInvoiceUrl?: string | null;
    invoicePdf?: string | null;
    paidAt?: Date | null;
  }): Promise<Invoice> {
    const { rows } = await systemQuery<InvoiceRow>(
      `INSERT INTO invoices (
        user_id, stripe_invoice_id, amount, currency, status,
        hosted_invoice_url, invoice_pdf, paid_at
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
      ON CONFLICT (stripe_invoice_id) DO UPDATE SET
        status             = EXCLUDED.status,
        hosted_invoice_url = COALESCE(EXCLUDED.hosted_invoice_url, invoices.hosted_invoice_url),
        invoice_pdf        = COALESCE(EXCLUDED.invoice_pdf, invoices.invoice_pdf),
        paid_at            = COALESCE(EXCLUDED.paid_at, invoices.paid_at)
      RETURNING *`,
      [
        data.userId,
        data.stripeInvoiceId,
        data.amount,
        data.currency,
        data.status,
        data.hostedInvoiceUrl ?? null,
        data.invoicePdf ?? null,
        data.paidAt ?? null,
      ],
    );
    return toInvoice(rows[0]);
  },

  async listByUserId(userId: string, limit = 20): Promise<Invoice[]> {
    const { rows } = await userQuery<InvoiceRow>(
      userId,
      `SELECT * FROM invoices
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT $2`,
      [userId, limit],
    );
    return rows.map(toInvoice);
  },
};
