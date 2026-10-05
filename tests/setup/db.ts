import mongoose from "mongoose";
import { afterAll, afterEach, beforeAll, beforeEach } from "vitest";
import { connectDB } from "@/lib/db";
import { loginAs, testAuth } from "./session";

// One database per worker so parallel test files never share collections.
beforeAll(async () => {
  const base = process.env.TEST_MONGO_BASE_URI;
  if (!base) throw new Error("TEST_MONGO_BASE_URI missing: global setup did not run");
  const url = new URL(base);
  url.pathname = `/kgt-test-${process.env.VITEST_POOL_ID ?? "0"}`;
  process.env.MONGODB_URI = url.toString();
  await connectDB();
  await Promise.all(Object.values(mongoose.models).map((model) => model.syncIndexes()));
});

// Every test starts logged in as a fresh default user.
beforeEach(async () => {
  Object.assign(testAuth, await loginAs("tester"));
});

afterEach(async () => {
  const collections = await mongoose.connection.db?.collections();
  await Promise.all((collections ?? []).map((collection) => collection.deleteMany({})));
});

// Keep the connection open: the worker (and its cached connection) is reused by the next file.
afterAll(async () => {
  await mongoose.connection.dropDatabase();
});
