import { rmSync } from "node:fs";
import { resolve } from "node:path";

for (const relativePath of process.argv.slice(2)) {
  rmSync(resolve(relativePath), { recursive: true, force: true });
}