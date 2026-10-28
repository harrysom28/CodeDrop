import mongoose from 'mongoose';
import { config } from './config.js';
import { CodeCache, SpottedSlip } from './models/index.js';
import type { SlipCache } from './core/bookies/registry.js';
import type { SpottedRecord, SpottedStore } from './services/ingest.js';
import type { Slip } from './core/types.js';

export async function connectDb(uri = config.MONGODB_URI) {
  mongoose.set('strictQuery', true);
  await mongoose.connect(uri);
  return mongoose.connection;
}

export function mongoSlipCache(): SlipCache {
  return {
    async get(bookie, code) {
      const doc = await CodeCache.findOne({ bookie, code }).lean();
      if (!doc) return undefined;
      return (doc.slip as Slip | null) ?? null;
    },
    async set(bookie, code, slip) {
      await CodeCache.updateOne({ bookie, code }, { $set: { slip } }, { upsert: true });
    },
  };
}

export function mongoSpottedStore(): SpottedStore {
  return {
    async findBySlipKey(slipKey) {
      return (await SpottedSlip.findOne({ slipKey }).lean()) as SpottedRecord | null;
    },
    async create(rec) {
      // Two channels posting the same slip at the same instant: the unique index keeps one, the other becomes a sighting.
      try {
        await SpottedSlip.create(rec);
      } catch (err) {
        if ((err as { code?: number }).code !== 11000) throw err;
        await SpottedSlip.updateOne({ slipKey: rec.slipKey }, { $addToSet: { sightings: rec.firstSighting } });
      }
    },
    async addSighting(slipKey, s) {
      await SpottedSlip.updateOne({ slipKey }, { $push: { sightings: s } });
    },
  };
}
