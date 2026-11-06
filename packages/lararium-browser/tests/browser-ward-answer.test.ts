/**
 * browser-ward-answer — THE BROWSER'S ANSWER DOOR (row 7, S3b; seat-harness#/the-swarm-slices), in chromium.
 *
 * A browser device of a face answers a ward ask through its own ward: an approve signs only inside a fresh unlock of this face's
 * ward on this browser (the per-act ward worker, opened from the passphrase typed for this one act and zeroed after), and carries
 * the ward signature over (the answer, the ask's digest, the fleet frontier it read) under the per-face ward key this browser's
 * admission into the face carries (its tag door's `wardKey`). A passkey never opens it.
 *
 * Reds: the browser holds no answer door, so its approve cannot land; a passkey route on the answer refuses `ward-passkey-refused`;
 * two faces of one browser present one ward key. Controls: a deny asks no route and carries no ward; an ask this browser cannot see
 * refuses `ward-ask-unseen`; a wrong passphrase opens nothing.
 * Meme: lar:///ha.ka.ba/lares/docs/pono/seat-harness#/the-swarm-slices
 */
import { expect, test } from "vitest";
import {
  buildAsks, buildIntent, faceIntentVerbs, intentEntryCid, intentEntryRecordsOfGroup, intentId, makeHandLineage, verifyEd25519, wardAnswerImage,
  cosignDigest, intentPlaneCosignPort, type LarDoc,
} from "@lararium/mesh";
import { sealBrowserKeystore } from "../src/browser-custody.js";
import { browserVesselFaceTagDoor } from "../src/browser-face-atom.js";
import { runWardAct } from "../src/ward-core.js";
import * as cosign from "../src/browser-ward-cosign.js";
import { keyed } from "../../lararium-mesh/tests/ward-cosign-table.js";

const G = "g-browser-answer", F = "f".repeat(64), PASS = "the route typed for this act";
const spawn = () => ({
  postMessage(_m: unknown, transfer: Transferable[]) { const port = transfer[0] as MessagePort; port.onmessage = async (m) => { port.postMessage(await runWardAct(m.data)); }; },
  terminate() {},
});

async function stand() {
  const idbName = `lares:answer-${globalThis.crypto.randomUUID()}`;
  await sealBrowserKeystore(idbName, { kind: "passphrase", passphrase: PASS });
  const issuer = await keyed(71), me = await keyed(72), root = await keyed(73);
  const wardKey = (await browserVesselFaceTagDoor(idbName)(G, me.key)).wardKey;
  const doc = { tiddlers: {} } as LarDoc;
  const plane = { doc: () => doc, change: (fn: (d: LarDoc) => void) => fn(doc) };
  const lineage = makeHandLineage([{ epoch: 0, signers: [root.key], threshold: 1 }])!;
  const port = intentPlaneCosignPort({ group: G, requester: me, verbs: faceIntentVerbs(), plane,
    face: () => ({ devices: [issuer.key, me.key], rosterCids: ["admit"], admittedAt: new Map([[issuer.key, "admit"], [me.key, "admit"]]), lineage }),
    standing: () => "stands", frontier: () => F, stoodAt: () => true, wardKey: (k: string) => (k === me.key ? wardKey ?? null : null) } as never);
  const detail = cosignDigest({ act: "ward-house-cap", face: G, wiki: "daemon", head: "h".repeat(64) });
  const call = await buildIntent({ group: G, signer: issuer, verb: "ward-house-cap", args: { wiki: "daemon", head: "h".repeat(64) }, nonce: detail, audience: { mode: "asks" }, verbs: faceIntentVerbs() });
  const ask = await buildAsks({ group: G, signer: issuer, intent: intentId(call.body as never), needs: "approval", detail });
  await port.write(call); await port.write(ask);
  const answer = (extra: { deny?: boolean; ask?: string; route?: () => Promise<unknown> } = {}) => (cosign as unknown as {
    browserWardAnswer(input: unknown): Promise<{ readonly body: Record<string, unknown>; readonly signer: string }>;
  }).browserWardAnswer({ idbName, group: G, atom: me, port, ask: extra.ask ?? intentEntryCid(ask), executor: issuer.key, deny: extra.deny === true,
    route: extra.route ?? (async () => PASS), spawn });
  return { idbName, issuer, me, wardKey, doc, ask: intentEntryCid(ask), detail, answer };
}

const codeOf = (p: Promise<unknown>): Promise<string | undefined> =>
  p.then(() => undefined, (e: { reading?: string; message: string }) => e.reading ?? /^[a-z-]+/.exec(e.message)?.[0] ?? e.message);

test("RED: the browser approves a ward ask through its own ward, the answer carrying its ward signature under the ward key its admission carries; CONTROL: the atom's key verifies nothing the ward signed", async () => {
  const s = await stand();
  expect(s.wardKey).toMatch(/^[0-9a-f]{64}$/);
  const landed = await s.answer();
  expect(landed.body).toMatchObject({ entry: "answer", verdict: "approve", executor: s.issuer.key.toLowerCase(), frontier: F });
  expect(landed.signer).toBe(s.me.key.toLowerCase());
  const image = wardAnswerImage({ group: G, ask: s.ask, detail: s.detail, verdict: "approve", executor: s.issuer.key, frontier: F });
  expect(verifyEd25519(landed.body["wardSig"], image, s.wardKey)).toBe(true);
  expect(verifyEd25519(landed.body["wardSig"], image, s.me.key)).toBe(false);
  // the answer landed on the plane the port writes
  expect(intentEntryRecordsOfGroup(s.doc, G)).toHaveLength(3);
});

test("RED: a passkey route on the browser's answer refuses `ward-passkey-refused` and lands nothing; CONTROL: a wrong passphrase opens no slot", async () => {
  const s = await stand();
  expect(await codeOf(s.answer({ route: async () => ({ kind: "passkey", credentialId: "c" }) }))).toBe("ward-passkey-refused");
  expect(intentEntryRecordsOfGroup(s.doc, G)).toHaveLength(2);
  expect(await codeOf(s.answer({ route: async () => "not the route" }))).toBe("ward-no-slot-opens");
});

test("CONTROL: a deny asks no route and carries no ward; an ask this browser cannot see refuses `ward-ask-unseen`", async () => {
  const s = await stand();
  const denied = await s.answer({ deny: true, route: async () => { throw new Error("a deny asked a route"); } });
  expect(denied.body).toMatchObject({ verdict: "deny" });
  expect(denied.body["wardSig"]).toBeUndefined();
  expect(await codeOf(s.answer({ ask: "a".repeat(64) }))).toBe("ward-ask-unseen");
});

test("RED: two faces of one browser present one ward key; CONTROL: a re-read of one face presents the same key", async () => {
  const s = await stand();
  const door = browserVesselFaceTagDoor(s.idbName);
  const other = (await door("g-browser-other", s.me.key)).wardKey;
  expect(other).toMatch(/^[0-9a-f]{64}$/);
  expect(other).not.toBe(s.wardKey);
  expect((await door(G, s.me.key)).wardKey).toBe(s.wardKey);
});
