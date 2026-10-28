/**
 * The herm-mesh witnesses' readers, held to a KNOWN POSITIVE. The partition witness once read a pointer field
 * that no pointer carries, so every read fell to one default and "advanced" could never hold: a witness that
 * cannot read true is a silent zero. These pointers come from the real builder, so a field the builder stops
 * minting reds here before a mesh run ever reads it.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { buildFlowPointer } from "../packages/lararium-mesh/dist/flow-substrate.js";
import { mkdtempSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";
import { join } from "node:path";
import * as mesh from "../packages/lararium-mesh/dist/index.js";
import { CARRIAGE_PIN_ABSENT } from "../packages/lararium-mesh/dist/index.js";
import { actOf, dialsOf, pointerAdvanced, pullHop } from "./herm-mesh-reader.mjs";

const SEED = Uint8Array.from({ length: 32 }, (_, i) => i + 1);

/** A pointer from the real builder over a content address standing for one published state. */
async function publish(text, parents = []) {
  const cid = Buffer.from(text.padEnd(32, ".")).toString("hex").slice(0, 64);
  return buildFlowPointer({ snapshot: { cid, heads: [cid], bytes: new Uint8Array() }, parents, signer: mesh.placeSignerFromSeed(SEED) });
}

test("a re-published act reads as advanced (the known positive)", async () => {
  const first = await publish("one");
  const second = await publish("two", [first.actCid]);
  assert.equal(pointerAdvanced(first, second), true);
});

test("the same act reads as frozen (the control)", async () => {
  const first = await publish("one");
  assert.equal(pointerAdvanced(first, first), false);
});

test("a pointer without an act identity is refused, never read as one shared default", () => {
  assert.throws(() => actOf({ cid: "c" }), /no actCid/);
  assert.throws(() => pointerAdvanced({ version: 1 }, { version: 2 }), /no actCid/);
});

test("dialsOf reads the bearings a decoded FLOW-map carries", () => {
  const doc = { tiddlers: {
    "lar:///ha.ka.ba/bags/meshpalace/dial/alpha": { tiddler: { bearing: "lar:///ha.ka.ba/@oracle/node/alpha" } },
    "lar:///ha.ka.ba/bags/meshpalace/slot/x":     { tiddler: { bearing: "ignored" } },
  } };
  assert.deepEqual(dialsOf(doc), ["lar:///ha.ka.ba/@oracle/node/alpha"]);
});

test("RED: a reader carried nowhere holds no floor pin for the hop, so it knocks nowhere", async () => {
  // The reader is a founded place in a scratch root that took no carry: it stands carried at no Nexus, so its pair index
  // holds no floor pin for the hop and the pull dials nothing. Port 9 answers nothing: a dial would read as a dial failure.
  const root = mkdtempSync(join(tmpdir(), "herm-reader-"));
  for (const script of ["test-scratch-marker.mjs", "seed-test-custody.mjs"]) {
    const r = spawnSync(process.execPath, [fileURLToPath(new URL(script, import.meta.url)), root], { encoding: "utf8", env: { ...process.env, LAR_ROOT: root } });
    assert.equal(r.status, 0, `${script}: ${r.stderr}`);
  }
  process.env.LAR_ROOT = root;
  // The reader's vessel key mints inside the staged custody, held open for the read (as a founded reader's would be).
  const node = await import("../packages/lararium-node/dist/src/index.js");
  const { TEST_PASSPHRASE } = await import("./test-custody-route.mjs");
  const homes = node.vesselCustodyHomes();
  const holder = node.makeCustodyHolder({ io: new node.FsCustodyIo(homes), homes });
  assert.equal((await holder.unlock([{ kind: "passphrase", passphrase: TEST_PASSPHRASE }])).reading, "opens");
  node.seatCustody(holder);
  const ident = await import("../packages/lararium-node/dist/src/node-vessel-identity.js");
  await ident.generateOrLoadVesselIdentity();
  const r = await pullHop(`http://127.0.0.1:9#${"ab".repeat(32)}`);
  assert.equal(r.ok, false);
  assert.equal(r.reason, CARRIAGE_PIN_ABSENT);
  assert.doesNotMatch(r.reason, /pin-unreadable|carriage-peering-shut/);
});

test("CONTROL: a hop that names no key is refused for that, before any route is read", async () => {
  const r = await pullHop("http://127.0.0.1:9");
  assert.equal(r.ok, false);
  assert.match(r.reason, /names no gate key/);
});
