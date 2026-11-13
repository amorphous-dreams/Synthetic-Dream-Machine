#!/usr/bin/env node
// unbind-test-custody — a TEST HARNESS door: change the human routes of a STAGED root's custody under the published
// test routes. The product has no such door: `lares vault bind` and `lares vault unbind` read every route on a TTY
// alone, and no flag, env var or pipe carries one.
//
// THE MARKER. The root must carry `.lar-test-scratch` (`tools/test-scratch-marker.mjs`). A root without it refuses
// by name (TestDoorRefusal), rc 2, and NOTHING is read or written.
//
// The door runs the command's own acts, the ones `lares vault bind` and `lares vault unbind` call in the built
// node package (`bindCustodySlot`, `unbindCustodySlot`):
//   --bind                       open the vessel key under the first test route and bind a slot under the second
//   --unbind <slot-id>           open under the first test route and remove that slot
//   --unbind <slot-id> --rotate  the same removal as ONE act with the rotation: a new vessel key seals every
//                                carrier, and the first test route binds over it
// No vessel stands on the root while the door runs: a standing vessel holds the key a rotation retires.
//
// Usage: node tools/unbind-test-custody.mjs <LAR_ROOT> (--bind | --unbind <slot-id> [--rotate])
//   rc 0  the act landed (the answer prints as JSON on stdout)
//   rc 1  the act refused by name (the refusal prints as JSON on stdout)
//   rc 2  the root carries no marker · bad usage
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { hasMarker, MARKER_NAME } from "./test-scratch-marker.mjs";
import { TEST_PASSPHRASE, TEST_PASSPHRASE_SECOND } from "./test-custody-route.mjs";

const here = new URL(".", import.meta.url).pathname;
const slotOf = (passphrase) => ({ t: 1, pins: [{ kind: "passphrase", passphrase }] });

/** The staged root's custody, opened under the first test route. Refuses an unmarked root before any read. */
async function opened(root) {
  const dir = resolve(root);
  if (!hasMarker(dir)) {
    const err = new Error(`TestDoorRefusal: ${dir} carries no ${MARKER_NAME} marker — the test door acts only on a root a harness staged (node tools/test-scratch-marker.mjs <root>)`);
    err.name = "TestDoorRefusal";
    throw err;
  }
  const prior = process.env.LAR_ROOT;
  process.env.LAR_ROOT = dir;
  try {
    const node = await import(pathToFileURL(resolve(here, "../packages/lararium-node/dist/src/index.js")).href);
    const homes = { identity: node.larIdentityDir(), storage: node.larDataDir(), seal: node.larSealHome() };
    const io = new node.FsCustodyIo(homes);
    const unlock = await node.unlockCustody({ io, homes, credentials: [{ kind: "passphrase", passphrase: TEST_PASSPHRASE }] });
    return { node, homes, io, unlock };
  } finally {
    if (prior === undefined) delete process.env.LAR_ROOT; else process.env.LAR_ROOT = prior;
  }
}

const refused = (e) => ({ ok: false, reason: e?.name ?? "Error", message: String(e?.message ?? e) });

/** Bind a slot under the second test route. Answers the new slot's id and the count that stands. */
export async function bindTestCustody(root) {
  const { node, homes, io, unlock } = await opened(root);
  if (unlock.reading !== "opens") return { ok: false, reason: unlock.reading };
  try {
    const out = await node.bindCustodySlot({ io, homes, treeKey: unlock.treeKey, spec: slotOf(TEST_PASSPHRASE_SECOND) });
    return { ok: true, slotId: out.slotId, slots: out.tree.slots.length };
  } catch (e) { return refused(e); }
}

/** Remove `slotId`; with `rotate`, as one act with the rotation that re-binds the first test route alone. */
export async function unbindTestCustody(root, { slotId, rotate = false }) {
  const { node, homes, io, unlock } = await opened(root);
  if (unlock.reading !== "opens") return { ok: false, reason: unlock.reading };
  try {
    const out = await node.unbindCustodySlot({ io, homes, treeKey: unlock.treeKey, slotId, ...(rotate ? { rotate: [slotOf(TEST_PASSPHRASE)] } : {}) });
    return { ok: true, rotated: out.rotated, slots: out.tree.slots.map((s) => s.id) };
  } catch (e) { return refused(e); }
}

/** Which test route opens the staged root's tree: a reading for each, and the ids that stand. */
export async function routesOfTestCustody(root) {
  const { node, homes, io, unlock } = await opened(root);
  const second = await node.unlockCustody({ io, homes, credentials: [{ kind: "passphrase", passphrase: TEST_PASSPHRASE_SECOND }] });
  const status = await node.custodyStatus({ io, homes });
  return { first: unlock.reading, second: second.reading, slots: status.tree.reading === "readable" ? status.tree.slots.map((s) => s.id) : [] };
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(new URL(import.meta.url).pathname)) {
  const argv = process.argv.slice(2);
  const root = argv[0] && !argv[0].startsWith("--") ? argv[0] : "";
  const at = argv.indexOf("--unbind");
  const slotId = at >= 0 ? argv[at + 1] : undefined;
  const bind = argv.includes("--bind");
  if (!root || bind === (at >= 0) || (at >= 0 && (!slotId || slotId.startsWith("--")))) {
    console.error("usage: unbind-test-custody.mjs <LAR_ROOT> (--bind | --unbind <slot-id> [--rotate])");
    process.exit(2);
  }
  let answer;
  try { answer = bind ? await bindTestCustody(root) : await unbindTestCustody(root, { slotId, rotate: argv.includes("--rotate") }); }
  catch (e) {
    if (e?.name === "TestDoorRefusal") { console.error(e.message); process.exit(2); }
    throw e;
  }
  console.log(JSON.stringify(answer));
  process.exit(answer.ok ? 0 : 1);
}
