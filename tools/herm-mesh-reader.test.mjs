/**
 * The herm-mesh witnesses' readers, held to a KNOWN POSITIVE. The partition witness once read a pointer field
 * that no pointer carries, so every read fell to one default and "advanced" could never hold: a witness that
 * cannot read true is a silent zero. These pointers come from the real builder, so a field the builder stops
 * minting reds here before a mesh run ever reads it.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { buildOraclePointer } from "../packages/lararium-mesh/dist/oracle-substrate.js";
import { actOf, dialsOf, pointerAdvanced } from "./herm-mesh-reader.mjs";

const SEED = Uint8Array.from({ length: 32 }, (_, i) => i + 1);

/** A pointer from the real builder over a content address standing for one published state. */
async function publish(text, parents = []) {
  const cid = Buffer.from(text.padEnd(32, ".")).toString("hex").slice(0, 64);
  return buildOraclePointer({ snapshot: { cid, heads: [cid], bytes: new Uint8Array() }, parents, signerSeed: SEED });
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
