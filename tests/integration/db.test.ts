import mongoose from "mongoose";
import { describe, expect, it } from "vitest";
import { connectDB } from "@/lib/db";

describe("connectDB", () => {
  it("reuses the cached connection", async () => {
    const first = await connectDB();
    const second = await connectDB();
    expect(second).toBe(first);
    expect(mongoose.connection.readyState).toBe(1);
  });
});

describe("connectDB without MONGODB_URI", () => {
  it("throws a clear error", async () => {
    const g = globalThis as typeof globalThis & { _mongoose?: unknown };
    const savedCache = g._mongoose;
    const savedUri = process.env.MONGODB_URI;
    g._mongoose = undefined;
    delete process.env.MONGODB_URI;
    try {
      const { vi } = await import("vitest");
      vi.resetModules();
      const fresh = await import("@/lib/db");
      await expect(fresh.connectDB()).rejects.toThrow(/MONGODB_URI is not set/);
    } finally {
      g._mongoose = savedCache;
      process.env.MONGODB_URI = savedUri;
    }
  });
});
