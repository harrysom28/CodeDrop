import mongoose, { Schema } from 'mongoose';

const LedgerEntrySchema = new Schema(
  {
    account: { type: String, required: true, index: true },
    debit: { type: Number, default: 0, min: 0 },
    credit: { type: Number, default: 0, min: 0 },
    ref: { type: String, required: true, index: true },
    memo: String,
    idempotencyKey: { type: String },
  },
  { timestamps: true },
);
LedgerEntrySchema.index(
  { idempotencyKey: 1 },
  { unique: true, partialFilterExpression: { idempotencyKey: { $type: 'string' } } },
);

const SubscriptionSchema = new Schema(
  {
    subscriberId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    tipsterId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    amountNaira: { type: Number, required: true },
    periodStart: { type: Date, required: true },
    periodEnd: { type: Date, required: true },
    status: {
      type: String,
      enum: ['escrow', 'released', 'partial_refund', 'cancelled'],
      default: 'escrow',
    },
  },
  { timestamps: true },
);

const SpendLimitSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    weeklyLimitNaira: { type: Number, required: true, default: 50_000 },
    pendingLimitNaira: Number,
    pendingLimitEffectiveAt: Date,
  },
  { timestamps: true },
);

export const LedgerEntry = mongoose.model('LedgerEntry', LedgerEntrySchema);
export const Subscription = mongoose.model('Subscription', SubscriptionSchema);
export const SpendLimit = mongoose.model('SpendLimit', SpendLimitSchema);
