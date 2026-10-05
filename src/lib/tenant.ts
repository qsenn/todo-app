// Per-request owner scoping. Every query, aggregation and save on an owned model is limited to the
// user the request runs as, so the service layer stays unaware of users. Missing context fails closed.
import { AsyncLocalStorage } from "node:async_hooks";
import { Schema, Types, type Document } from "mongoose";

type Scope = { userId: Types.ObjectId } | { unscoped: true };

const storage = new AsyncLocalStorage<Scope>();

// The result is awaited inside the scope: mongoose queries are lazy, so a returned query would
// otherwise execute after the scope has ended.
export function runAsUser<T>(userId: string | Types.ObjectId, fn: () => T): Promise<Awaited<T>> {
  return storage.run({ userId: new Types.ObjectId(String(userId)) }, async (): Promise<Awaited<T>> => await fn());
}

/** Maintenance only (migrations): owned models see every user's documents. */
export function runUnscoped<T>(fn: () => T): Promise<Awaited<T>> {
  return storage.run({ unscoped: true }, async (): Promise<Awaited<T>> => await fn());
}

/** The scoped user, null when running unscoped; throws outside any scope. */
function scopedUserId(): Types.ObjectId | null {
  const scope = storage.getStore();
  if (!scope) throw new Error("No user context: owned models must be used inside runAsUser().");
  return "unscoped" in scope ? null : scope.userId;
}

const QUERY_HOOKS = [
  "countDocuments",
  "deleteMany",
  "deleteOne",
  "distinct",
  "find",
  "findOne",
  "findOneAndDelete",
  "findOneAndReplace",
  "findOneAndUpdate",
  "replaceOne",
  "updateMany",
  "updateOne",
] as const;

const UPDATE_HOOKS = ["findOneAndReplace", "findOneAndUpdate", "replaceOne", "updateMany", "updateOne"] as const;

// Stages that read another collection would bypass the owner filter, so scoped pipelines may not use them.
const CROSS_COLLECTION_STAGES = ["$lookup", "$unionWith", "$graphLookup"];

type Stage = Record<string, unknown>;

function usesCrossCollectionStage(pipeline: Stage[]): boolean {
  return pipeline.some(
    (stage) =>
      CROSS_COLLECTION_STAGES.some((name) => name in stage) ||
      ("$facet" in stage && Object.values(stage.$facet as Record<string, Stage[]>).some(usesCrossCollectionStage)),
  );
}

/**
 * True when an update could change userId. Aggregation-pipeline updates ($replaceWith, $unset "x", …)
 * can rewrite any field in ways that are not inspectable, so they always count.
 */
function updatesOwner(update: unknown): boolean {
  if (Array.isArray(update)) return true;
  if (!update || typeof update !== "object") return false;
  return Object.entries(update).some(([key, value]) => {
    if (key === "userId") return true;
    if (!key.startsWith("$") || value === null || typeof value !== "object") return false;
    return "userId" in value || (key === "$rename" && Object.values(value).includes("userId"));
  });
}

/** Adds a required userId to the schema and confines every operation to the scoped user. */
export function ownedByUser(schema: Schema) {
  schema.add({ userId: { type: Schema.Types.ObjectId, ref: "User", required: true } });

  schema.pre([...QUERY_HOOKS], function () {
    const userId = scopedUserId();
    if (userId) this.where({ userId });
  });

  // Ownership never changes through an update; replacements keep the scoped owner.
  schema.pre([...UPDATE_HOOKS], function () {
    if (!scopedUserId()) return;
    if (updatesOwner(this.getUpdate())) {
      throw new Error("userId cannot be changed by an update (pipeline updates are not allowed on owned models).");
    }
  });
  // A replacement document replaces userId too, so put the owner back (runs after the check above).
  schema.pre(["replaceOne", "findOneAndReplace"], function () {
    const userId = scopedUserId();
    if (userId) this.setUpdate({ ...this.getUpdate(), userId });
  });

  // These cannot be filtered per user, so they are refused inside a user scope.
  schema.pre("estimatedDocumentCount", function () {
    if (scopedUserId()) throw new Error("estimatedDocumentCount is not available on owned models; use countDocuments.");
  });
  schema.pre("bulkWrite", function () {
    if (scopedUserId()) throw new Error("bulkWrite is not available on owned models inside a user scope.");
  });

  // The owner $match goes first; pipelines that must start with $geoNear or $search are not supported.
  schema.pre("aggregate", function () {
    const userId = scopedUserId();
    if (!userId) return;
    if (usesCrossCollectionStage(this.pipeline() as unknown as Stage[])) {
      throw new Error("$lookup, $unionWith and $graphLookup are not allowed on owned models inside a user scope.");
    }
    this.pipeline().unshift({ $match: { userId } });
  });

  schema.pre("validate", function (this: Document & { userId?: Types.ObjectId }) {
    const userId = scopedUserId();
    if (!userId) return;
    if (!this.userId) this.userId = userId;
    else if (!this.userId.equals(userId)) throw new Error("Cannot save a document owned by another user.");
  });
}
