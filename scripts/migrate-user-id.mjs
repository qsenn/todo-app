// One-off migration for GitHub login: data created before accounts existed has no userId.
// It cannot be attributed to anyone, so (by decision) it is deleted.
//
//   npm run migrate:user-id                       # dry run: prints the target and what would be deleted
//   npm run migrate:user-id -- --confirm=<dbName> # deletes it (irreversible); the name must match the target
import { pathToFileURL } from "node:url";
import mongoose from "mongoose";

export const OWNED_COLLECTIONS = ["todos", "weeklyplans", "yeargoals"];
const WITHOUT_OWNER = { $or: [{ userId: { $exists: false } }, { userId: null }] };

/** Counts (and with confirm, deletes) owned documents that have no userId. */
export async function migrateUserId(db, { confirm = false, log = console.log } = {}) {
  const result = {};
  for (const name of OWNED_COLLECTIONS) {
    const collection = db.collection(name);
    const count = await collection.countDocuments(WITHOUT_OWNER);
    result[name] = confirm ? (await collection.deleteMany(WITHOUT_OWNER)).deletedCount : count;
    log(`${name}: ${count}건 userId 없음${confirm ? ` → ${result[name]}건 삭제` : ""}`);
  }
  return result;
}

/** The --confirm=<dbName> value, or undefined when absent. */
export function confirmTarget(argv) {
  const arg = argv.find((a) => a === "--confirm" || a.startsWith("--confirm="));
  return arg === undefined ? undefined : arg.slice("--confirm=".length);
}

/** host[:port] of a connection string, without credentials. */
export function describeHost(uri) {
  try {
    return new URL(uri.replace(/^mongodb(\+srv)?:/, "http:")).host;
  } catch {
    return "(알 수 없음)";
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error("MONGODB_URI가 설정되지 않았습니다 (.env 또는 .env.local).");
    process.exit(1);
  }
  await mongoose.connect(uri);
  try {
    const dbName = mongoose.connection.name;
    console.log(`대상: ${describeHost(uri)} / DB ${dbName}`);
    const target = confirmTarget(process.argv);
    if (target !== undefined && target !== dbName) {
      console.error(`--confirm=${target}이(가) 대상 DB(${dbName})와 다릅니다. 아무것도 삭제하지 않았습니다.`);
      process.exitCode = 1;
    } else {
      await migrateUserId(mongoose.connection.db, { confirm: target === dbName });
      if (target === undefined) {
        console.log(`미리 보기만 했습니다. 실제로 삭제하려면: npm run migrate:user-id -- --confirm=${dbName}`);
      }
    }
  } finally {
    await mongoose.disconnect();
  }
}
