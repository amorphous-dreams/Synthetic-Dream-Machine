// A process that answers at the path given as argv[2] and nothing else: the shape of a live holder this caller
// cannot see any other way (another container on the same bind mount). SIGTERM leaves cleanly; SIGKILL leaves a corpse.
import { createServer } from "node:net";
import { mkdirSync, unlinkSync } from "node:fs";
import { dirname } from "node:path";

const path = process.argv[2];
mkdirSync(dirname(path), { recursive: true });
const srv = createServer((s) => s.end());
srv.listen(path, () => process.stdout.write("held\n"));
process.on("SIGTERM", () => { srv.close(() => { try { unlinkSync(path); } catch { /* gone */ } process.exit(0); }); });
setInterval(() => {}, 1000);
