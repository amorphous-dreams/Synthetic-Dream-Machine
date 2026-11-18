// A process that answers at the path given as argv[2] and nothing else: the shape of a live holder this caller
// cannot see any other way (another container on the same bind mount). SIGTERM leaves cleanly; SIGKILL leaves a corpse.
// It says `held` once it answers, and `asked` each time a caller reaches it, so a test reads both facts off its
// stdout and waits on neither by the clock. A caller that WRITES on its connection asks for a drain: the holder says
// `drained` once it reaches that caller, and it takes callers in the order they connected, so every caller before it
// has been said by then (a holder told to leave drops any caller it has not yet reached, unsaid).
import { createServer } from "node:net";
import { mkdirSync, unlinkSync } from "node:fs";
import { dirname } from "node:path";

const path = process.argv[2];
mkdirSync(dirname(path), { recursive: true });
const srv = createServer((s) => {
  process.stdout.write("asked\n");
  s.once("data", () => process.stdout.write("drained\n"));
  s.on("error", () => { /* a caller that hung up first */ });
  s.end();
});
srv.listen(path, () => process.stdout.write("held\n"));
process.on("SIGTERM", () => { srv.close(() => { try { unlinkSync(path); } catch { /* gone */ } process.exit(0); }); });
setInterval(() => {}, 1000);
