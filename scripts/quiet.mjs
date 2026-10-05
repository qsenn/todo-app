// Runs a command and prints its output only when it fails.
// Used by the Ralph feedback gate, whose fingerprinting treats every output line as a failure signature.
import { spawnSync } from "node:child_process";

const command = process.argv.slice(2).join(" ");
const result = spawnSync(command, { shell: true, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
if (result.status !== 0) {
  process.stdout.write(result.stdout ?? "");
  process.stderr.write(result.stderr ?? "");
  if (result.error) console.error(result.error.message);
  console.error(`quiet: command failed with exit ${result.status}: ${command}`);
}
process.exit(result.status ?? 1);
