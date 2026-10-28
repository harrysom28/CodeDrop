import mongoose from 'mongoose';
import { randomBytes } from 'node:crypto';

/**
 * Each test file gets its own database so parallel node:test workers don't clobber each other.
 * Override the host with MONGODB_TEST_URI (database name in the URI is replaced).
 */
export async function startTestMongo(label = 'suite') {
  const base = process.env.MONGODB_TEST_URI ?? 'mongodb://127.0.0.1:27018/codedrop_test';
  const name = `cd_${label}_${process.pid}_${randomBytes(3).toString('hex')}`;
  const uri = base.replace(/\/[^/?]+(\?|$)/, `/${name}$1`);
  await mongoose.connect(uri);
  return uri;
}

export async function stopTestMongo() {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  }
}

export async function clearCollections() {
  const cols = mongoose.connection.collections;
  for (const col of Object.values(cols)) {
    await col.deleteMany({});
  }
}
