/**
 * Quotation — a priced offer to a client, made of labour and/or trading line
 * items. The money totals are COMPUTED and stored (see quotation.service),
 * never accepted from the client, so they can't be tampered with and the M10
 * dashboard can sum them cheaply.
 *
 * Schema choices, justified:
 *  - `lineItems` are EMBEDDED — they have no life outside their quotation and
 *    are always read with it (the embed rule; same as quotation line items in
 *    the project brief).
 *  - `client` is a REFERENCE (independent entity); `clientName` is a SNAPSHOT
 *    so a printed/duplicated quotation keeps the name it was issued under even
 *    if the client is later renamed or removed.
 *  - `quotationNumber` is a human-facing sequential id from the atomic counter.
 */
import mongoose from 'mongoose';

export const QUOTATION_STATUSES = ['Draft', 'Approved', 'Rejected'];
export const QUOTATION_LINE_TYPES = ['Labour', 'Trading'];

/** One priced line. Discount and tax are PERCENTAGES. _id disabled (value object). */
const lineItemSchema = new mongoose.Schema(
  {
    type: { type: String, enum: QUOTATION_LINE_TYPES, required: true },
    description: { type: String, required: true, trim: true },
    quantity: { type: Number, required: true, min: 0 },
    unitPrice: { type: Number, required: true, min: 0 },
    discount: { type: Number, default: 0, min: 0, max: 100 }, // percent
    taxRate: { type: Number, default: 15, min: 0, max: 100 }, // percent (KSA VAT = 15)
  },
  { _id: false }
);

const quotationSchema = new mongoose.Schema(
  {
    quotationNumber: { type: String, required: true, unique: true },
    client: { type: mongoose.Schema.Types.ObjectId, ref: 'Client', required: true },
    clientName: { type: String, required: true }, // snapshot for durable PDFs/history
    date: { type: Date, default: Date.now },
    validUntil: { type: Date, default: null },
    status: { type: String, enum: QUOTATION_STATUSES, default: 'Draft' },
    lineItems: {
      type: [lineItemSchema],
      validate: [(v) => v.length > 0, 'A quotation needs at least one line item.'],
    },
    notes: { type: String, trim: true, maxlength: 2000 },
    // Computed on every write from lineItems — the client never sets these.
    subtotal: { type: Number, default: 0 }, // sum of qty × unitPrice (before discount)
    discountTotal: { type: Number, default: 0 },
    taxTotal: { type: Number, default: 0 },
    grandTotal: { type: Number, default: 0 },
  },
  { timestamps: true }
);

quotationSchema.index({ client: 1 });
quotationSchema.index({ status: 1 });
quotationSchema.index({ createdAt: -1 });

export default mongoose.model('Quotation', quotationSchema);
