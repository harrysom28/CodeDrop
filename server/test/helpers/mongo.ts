import mongoose from 'mongoose';

const TEST_URI =
  process.env.MONGODB_TEST_URI ?? 'mongodb://127.0.0.1:27018/codedrop_test';

/** Connect mongoose to a dedicated test database (expects a local mongod). */
export async function startTestMongo() {
  await mongoose.connect(TEST_URI);
  return TEST_URI;
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
