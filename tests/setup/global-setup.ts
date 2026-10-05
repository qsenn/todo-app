import { MongoMemoryReplSet } from "mongodb-memory-server";

let replSet: MongoMemoryReplSet | undefined;

export async function setup() {
  replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  process.env.TEST_MONGO_BASE_URI = replSet.getUri();
}

export async function teardown() {
  await replSet?.stop();
}
