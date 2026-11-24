import mongoose, { Schema, type InferSchemaType, type Types } from 'mongoose';
import { BOOKIES } from '../core/types.js';

const LegSchema = new Schema(
  {
    eventId: { type: String, required: true },
    homeTeam: { type: String, required: true },
    awayTeam: { type: String, required: true },
    league: String,
    market: { type: String, required: true },
    selection: { type: String, required: true },
    odds: { type: Number, required: true },
    kickoff: { type: Date, required: true },
    result: { type: String, enum: ['pending', 'won', 'lost', 'void'], default: 'pending' },
    closingOdds: Number,
  },
  { _id: false },
);

const SlipSchema = new Schema(
  { bookie: { type: String, enum: BOOKIES, required: true }, code: { type: String, required: true }, legs: [LegSchema] },
  { _id: false },
);

// ── Users & tipsters ─────────────────────────────────────────────────────────

const UserSchema = new Schema(
  {
    /** Firebase Auth uid. Sparse unique so older/dev users without one still work. */
    firebaseUid: { type: String, unique: true, sparse: true, index: true },
    phone: { type: String, unique: true, sparse: true },
    handle: { type: String, unique: true, sparse: true, lowercase: true, trim: true },
    displayName: String,
    role: { type: String, enum: ['user', 'tipster', 'admin'], default: 'user' },
    /** BVN/NIN check passed: required to rank on leaderboards or earn. */
    idVerified: { type: Boolean, default: false },
    /** Provider name + opaque reference — never store raw BVN/NIN. */
    idProvider: String,
    idProviderRef: String,
    over18Confirmed: { type: Boolean, default: false },
    mainBookie: { type: String, enum: BOOKIES },
    favouriteBookies: { type: [{ type: String, enum: BOOKIES }], default: [] },
    favouriteClubs: [String],
    /** What 1 unit means in naira for this user's own stake suggestions. */
    unitNaira: { type: Number, default: 1000 },
    onboardedAt: Date,
    expoPushTokens: { type: [String], default: [] },
    pushPrefs: {
      tipsterPick: { type: Boolean, default: true },
      betSettled: { type: Boolean, default: true },
      roomLive: { type: Boolean, default: true },
      mention: { type: Boolean, default: true },
      escrow: { type: Boolean, default: true },
      quietHoursStart: { type: Number, default: 1 },
      quietHoursEnd: { type: Number, default: 7 },
    },
  },
  { timestamps: true },
);

const FollowSchema = new Schema(
  {
    followerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    tipsterId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    alerts: { type: Boolean, default: true },
  },
  { timestamps: true },
);
FollowSchema.index({ followerId: 1, tipsterId: 1 }, { unique: true });

// ── Verified picks (commit–reveal) ───────────────────────────────────────────

const PickSchema = new Schema(
  {
    tipsterId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    bookie: { type: String, enum: BOOKIES },
    code: String,
    legs: { type: [LegSchema], required: true },
    totalOdds: { type: Number, required: true },
    stakeUnits: { type: Number, required: true, min: 0.1, max: 10 },
    note: { type: String, maxlength: 500 },
    visibility: { type: String, enum: ['public', 'vip'], default: 'public' },
    verification: { type: String, enum: ['pick', 'receipt', 'stake'], default: 'pick' },
    lockedAt: { type: Date, required: true },
    firstKickoff: { type: Date, required: true, index: true },
    commitHash: { type: String, required: true, unique: true },
    /** Secret until reveal; never returned by default queries. */
    salt: { type: String, required: true, select: false },
    revealed: { type: Boolean, default: false },
    /** Where the commit hash was anchored on-chain, once that is wired. */
    anchorTx: String,
    merkleRoot: String,
    merkleProof: [String],
    result: { type: String, enum: ['pending', 'won', 'lost', 'void'], default: 'pending', index: true },
    profitUnits: { type: Number, default: 0 },
    clv: Number,
    settledAt: Date,
    copyCount: { type: Number, default: 0 },
  },
  { timestamps: true },
);

const CopySchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    pickId: { type: Schema.Types.ObjectId, ref: 'Pick' },
    spottedSlipKey: String,
    bookie: { type: String, enum: BOOKIES },
    oddsAtCopy: Number,
  },
  { timestamps: true },
);

// ── Spotted codes from Telegram / X ──────────────────────────────────────────

const SightingSchema = new Schema(
  {
    source: { type: String, enum: ['telegram', 'x'], required: true },
    channel: { type: String, required: true },
    messageId: { type: String, required: true },
    url: String,
    postedAt: { type: Date, required: true },
    bookie: { type: String, enum: BOOKIES, required: true },
    code: { type: String, required: true },
  },
  { _id: false },
);

const SpottedSlipSchema = new Schema(
  {
    slipKey: { type: String, required: true, unique: true },
    slip: { type: SlipSchema, required: true },
    totalOdds: { type: Number, required: true },
    firstKickoff: { type: Date, required: true, index: true },
    firstSighting: { type: SightingSchema, required: true },
    sightings: { type: [SightingSchema], default: [] },
    result: { type: String, enum: ['pending', 'won', 'lost', 'void'], default: 'pending', index: true },
    settledAt: Date,
  },
  { timestamps: true },
);
SpottedSlipSchema.index({ 'sightings.channel': 1, result: 1 });

const ChannelSchema = new Schema(
  {
    source: { type: String, enum: ['telegram', 'x'], default: 'telegram' },
    username: { type: String, required: true, lowercase: true, trim: true },
    title: String,
    enabled: { type: Boolean, default: true },
    joinedAt: Date,
    /** Set when the owner claims the channel through the claim flow. */
    claimedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    /** User who started the claim; promoted to claimedBy when the verify line is seen. */
    claimRequestedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    claimToken: String,
    /** Owner asked to be removed: never ingest or show again. */
    optedOut: { type: Boolean, default: false },
  },
  { timestamps: true },
);
ChannelSchema.index({ source: 1, username: 1 }, { unique: true });
ChannelSchema.index({ claimToken: 1 }, { sparse: true });

const CodeCacheSchema = new Schema(
  {
    bookie: { type: String, enum: BOOKIES, required: true },
    code: { type: String, required: true },
    slip: { type: SlipSchema, default: null },
  },
  { timestamps: true },
);
CodeCacheSchema.index({ bookie: 1, code: 1 }, { unique: true });
// Codes expire once games are played; keep misses and hits for 7 days.
CodeCacheSchema.index({ createdAt: 1 }, { expireAfterSeconds: 7 * 24 * 3600 });

const UserBetSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    bookie: { type: String, enum: BOOKIES, required: true },
    code: String,
    legs: { type: [LegSchema], required: true },
    stakeNaira: { type: Number, required: true, min: 1 },
    source: { type: String, enum: ['copied', 'own', 'imported'], required: true },
    pickId: { type: Schema.Types.ObjectId, ref: 'Pick' },
    result: { type: String, enum: ['pending', 'won', 'lost', 'void'], default: 'pending', index: true },
    returnNaira: { type: Number, default: 0 },
    firstKickoff: { type: Date, required: true, index: true },
    settledAt: Date,
  },
  { timestamps: true },
);
UserBetSchema.index({ userId: 1, settledAt: -1 });

const NotificationSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    type: {
      type: String,
      enum: ['channel_claimed', 'tipster_pick', 'bet_settled', 'room_live', 'mention', 'escrow'],
      required: true,
    },
    title: { type: String, required: true },
    body: { type: String, required: true },
    data: Schema.Types.Mixed,
    readAt: Date,
    pushedAt: Date,
  },
  { timestamps: true },
);

const OddsSnapshotSchema = new Schema(
  {
    pickId: { type: Schema.Types.ObjectId, ref: 'Pick', required: true, index: true },
    bookie: { type: String, enum: BOOKIES, required: true },
    code: { type: String, required: true },
    capturedAt: { type: Date, required: true },
    legs: [
      {
        eventId: String,
        market: String,
        selection: String,
        odds: Number,
        kickoff: Date,
      },
    ],
  },
  { timestamps: true },
);
OddsSnapshotSchema.index({ capturedAt: 1 }, { expireAfterSeconds: 30 * 24 * 3600 });

const JobRunSchema = new Schema(
  {
    job: { type: String, required: true, index: true },
    finishedAt: { type: Date, required: true },
    ok: { type: Boolean, required: true },
    detail: Schema.Types.Mixed,
  },
  { timestamps: true },
);

export const User = mongoose.model('User', UserSchema);
export const Follow = mongoose.model('Follow', FollowSchema);
export const PickModel = mongoose.model('Pick', PickSchema);
export const Copy = mongoose.model('Copy', CopySchema);
export const SpottedSlip = mongoose.model('SpottedSlip', SpottedSlipSchema);
export const Channel = mongoose.model('Channel', ChannelSchema);
export const CodeCache = mongoose.model('CodeCache', CodeCacheSchema);
export const UserBet = mongoose.model('UserBet', UserBetSchema);
export const Notification = mongoose.model('Notification', NotificationSchema);
export const OddsSnapshot = mongoose.model('OddsSnapshot', OddsSnapshotSchema);
export const JobRun = mongoose.model('JobRun', JobRunSchema);

export type PickDoc = InferSchemaType<typeof PickSchema> & { _id: Types.ObjectId };
export type SpottedSlipDoc = InferSchemaType<typeof SpottedSlipSchema> & { _id: Types.ObjectId };
