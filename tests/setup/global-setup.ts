import { MongoMemoryServer } from "mongodb-memory-server";

let server: MongoMemoryServer | undefined;

// A standalone server starts much faster than a replica set; the app uses no transactions.
export async function setup() {
  server = await MongoMemoryServer.create();
  process.env.TEST_MONGO_BASE_URI = server.getUri();
}

export async function teardown() {
  await server?.stop();
}
