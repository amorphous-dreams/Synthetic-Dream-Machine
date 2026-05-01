#!/usr/bin/env tsx
/**
 * Build a lararium-web JSON snapshot from the live lares/ tree.
 * Output: lares/lararium-node/snapshot.json
 */

import { writeFileSync } from "fs";
import { join } from "path";
import { createLarariumRuntime, LARES_ROOT } from "../src/node-host.js";
import { buildSnapshot } from "./build-snapshot-lib.js";

const runtime = createLarariumRuntime({ writeback: false });
const snapshot = await buildSnapshot(runtime);

const out = join(LARES_ROOT, "lararium-node", "snapshot.json");
writeFileSync(out, JSON.stringify(snapshot, null, 2));

console.log(`Snapshot written: ${out}`);
console.log(`  Memes: ${Object.keys(snapshot.memes).length}`);
