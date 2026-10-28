import mongoose, { Schema, type InferSchemaType, type Types } from 'mongoose';

const RoomSchema = new Schema(
  {
    kind: { type: String, enum: ['fixture', 'club', 'tipster', 'general'], required: true, index: true },
    key: { type: String, required: true }, // fixtureId | club slug | tipsterId | "general"
    title: { type: String, required: true },
    slowModeMs: { type: Number, default: 5000 },
    opensAt: Date,
    closesAt: Date,
    closed: { type: Boolean, default: false },
  },
  { timestamps: true },
);
RoomSchema.index({ kind: 1, key: 1 }, { unique: true });

const RoomMessageSchema = new Schema(
  {
    roomId: { type: Schema.Types.ObjectId, ref: 'Room', required: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    kind: { type: String, enum: ['text', 'slip', 'system', 'poll'], default: 'text' },
    text: { type: String, maxlength: 500 },
    pickId: { type: Schema.Types.ObjectId, ref: 'Pick' },
    poll: {
      question: String,
      options: [String],
      votes: [{ userId: Schema.Types.ObjectId, optionIndex: Number }],
    },
    agreeCount: { type: Number, default: 0 },
    agreedBy: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    hidden: { type: Boolean, default: false },
    reportCount: { type: Number, default: 0 },
    reportedBy: [{ type: Schema.Types.ObjectId, ref: 'User' }],
  },
  { timestamps: true },
);
// Match-room messages expire after 30 days.
RoomMessageSchema.index({ createdAt: 1 }, { expireAfterSeconds: 30 * 24 * 3600 });

const RoomBanSchema = new Schema(
  {
    roomId: { type: Schema.Types.ObjectId, ref: 'Room', required: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    mutedUntil: Date,
    banned: { type: Boolean, default: false },
    reason: String,
  },
  { timestamps: true },
);
RoomBanSchema.index({ roomId: 1, userId: 1 }, { unique: true });

export const Room = mongoose.model('Room', RoomSchema);
export const RoomMessage = mongoose.model('RoomMessage', RoomMessageSchema);
export const RoomBan = mongoose.model('RoomBan', RoomBanSchema);

export type RoomDoc = InferSchemaType<typeof RoomSchema> & { _id: Types.ObjectId };
