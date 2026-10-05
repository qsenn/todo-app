import mongoose from "mongoose";
import { afterEach, beforeAll, beforeEach } from "vitest";
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
  // Indexes survive between files (collections are emptied, never dropped), so sync each model once per worker.
  const worker = globalThis as typeof globalThis & { __kgtSynced?: Set<string> };
  const synced = (worker.__kgtSynced ??= new Set());
  const pending = Object.values(mongoose.models).filter((model) => !synced.has(model.modelName));
  await Promise.all(pending.map((model) => model.syncIndexes()));
  for (const model of pending) synced.add(model.modelName);
});

// Every test starts logged in as a fresh default user.
beforeEach(async () => {
  Object.assign(testAuth, await loginAs("tester"));
});

afterEach(async () => {
  const collections = await mongoose.connection.db?.collections();
  await Promise.all((collections ?? []).map((collection) => collection.deleteMany({})));
});
// The connection stays open: the worker (and its cached connection) is reused by the next file.
