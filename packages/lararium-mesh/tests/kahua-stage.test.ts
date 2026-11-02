/**
 * kahua-stage — the face's fleet stage: lift and withdraw acts under the operator's grant, the fold that reads them, the pin.
 *
 * The reader decides; the doc carries. Every red pairs with a CONTROL that passes the same door.
 * Meme: lar:///ha.ka.ba/lares/docs/pono/kahua-memory-stage
 */
import { describe, expect, test } from "vitest";
import type { LarDoc } from "../src/base-doc.js";
import { ed25519SignerFromSeed, ed25519VerifyingKeyFromSeed } from "../src/ed25519-door.js";
import { fixtureIntentVerbs, faceIntentVerbs } from "../src/intent-verbs.js";
import { intentEntryCid, readIntentEntry } from "../src/intent-entry.js";
import {
  KAHUA_PLANE, KAHUA_PROPOSE_VERB, buildKahuaProposal, kahuaActCid, kahuaActRecords, kahuaItemTiddlers, kahuaPlaneUrl,
  readKahuaAct, readKahuaProposal, readKahuaStage, signKahuaLift, signKahuaWithdraw, writeKahuaAct, kahuaStageDocUrl,
} from "../src/kahua-stage.js";

const signer = async (n: number) => ({ key: await ed25519VerifyingKeyFromSeed(new Uint8Array(32).fill(n)), sign: ed25519SignerFromSeed(new Uint8Array(32).fill(n)) });
const doc = (): LarDoc => ({ tiddlers: {} } as LarDoc);
const GROUP = "face-group";

async function fixture() {
  const root = await signer(1), atom = await signer(2), other = await signer(3);
  const grant = (key: string) => key === root.key;
  const origin = { seat: atom.key, device: atom.key, session: "s-1" };
  const lift = (title: string, text: string, parent: string | null, by = root, extra: Record<string, unknown> = {}) => signKahuaLift({
    group: GROUP, epoch: 0, title, text, fields: { type: "text/vnd.tiddlywiki" }, parent, origin, taint: [], sources: [{ title: `daemon/${title}`, revision: "r1" }], ...extra,
  }, by);
  return { root, atom, other, grant, origin, lift };
}

describe("kahua lift and withdraw acts", () => {
  test("RED: a lift signed by the device atom (the AI seat's hand) refuses `grant`; CONTROL: the root's lift reads", async () => {
    const { atom, root, grant, lift } = await fixture();
    expect(readKahuaAct(await lift("t", "x", null, atom), { group: GROUP, grant })).toEqual({ ok: false, refusal: "grant" });
    const ok = readKahuaAct(await lift("t", "x", null, root), { group: GROUP, grant });
    expect(ok.ok).toBe(true);
  });

  test("RED: a lift carrying no origin, no taint list or no source pointer refuses by name; a changed body breaks the signature", async () => {
    const { root, grant, origin } = await fixture();
    const base = { group: GROUP, epoch: 0, title: "t", text: "x", fields: {}, parent: null, origin, taint: [] as string[], sources: [{ title: "d", revision: "r" }] };
    const { origin: _o, ...noOrigin } = base;
    const { taint: _t, ...noTaint } = base;
    await expect(signKahuaLift(noOrigin as never, root)).rejects.toThrow(/origin/);
    await expect(signKahuaLift(noTaint as never, root)).rejects.toThrow(/taint/);
    await expect(signKahuaLift({ ...base, sources: [] }, root)).rejects.toThrow(/sources/);
    // A forged record that skips the signer's check still refuses at the reader.
    const signed = await signKahuaLift(base, root);
    const strip = (field: string) => { const body = { ...signed.body } as Record<string, unknown>; delete body[field]; return { ...signed, body }; };
    expect(readKahuaAct(strip("origin"), { group: GROUP, grant })).toEqual({ ok: false, refusal: "origin" });
    expect(readKahuaAct(strip("taint"), { group: GROUP, grant })).toEqual({ ok: false, refusal: "taint" });
    expect(readKahuaAct({ ...signed, body: { ...signed.body, sources: [] } }, { group: GROUP, grant })).toEqual({ ok: false, refusal: "sources" });
    expect(readKahuaAct({ ...signed, body: { ...signed.body, text: "y" } }, { group: GROUP, grant })).toEqual({ ok: false, refusal: "signature" });
    expect(readKahuaAct(signed, { group: "other-face", grant })).toEqual({ ok: false, refusal: "group" });
    expect(readKahuaAct(signed, { group: GROUP, grant }).ok).toBe(true);
  });
});

describe("the stage fold", () => {
  test("RED: two lifts naming one parent surface as siblings in either arrival order; CONTROL: a descendant replaces its parent", async () => {
    const { grant, lift } = await fixture();
    const first = await lift("t", "v1", null);
    const second = await lift("t", "v2", kahuaActCid(first));
    const chain = readKahuaStage([second, first], { group: GROUP, grant });
    expect(chain.get("t")).toMatchObject({ status: "standing", heads: [{ cid: kahuaActCid(second), text: "v2" }] });
    expect(chain.history("t").map((r) => r.cid).sort()).toEqual([kahuaActCid(first), kahuaActCid(second)].sort());
    const rival = await lift("t", "v2-other", kahuaActCid(first));
    for (const order of [[first, second, rival], [rival, second, first]]) {
      const read = readKahuaStage(order, { group: GROUP, grant });
      expect(read.get("t")?.status).toBe("siblings");
      expect(read.get("t")?.heads.map((h) => h.cid).sort()).toEqual([kahuaActCid(second), kahuaActCid(rival)].sort());
    }
  });

  test("RED: a withdraw drops the revision from list and get on every reader while history keeps it; CONTROL: an unwithdrawn item lists", async () => {
    const { root, atom, grant, lift } = await fixture();
    const kept = await lift("keep", "k", null), gone = await lift("gone", "g", null);
    const withdraw = await signKahuaWithdraw({ group: GROUP, epoch: 0, target: kahuaActCid(gone) }, root);
    const read = readKahuaStage([kept, gone, withdraw], { group: GROUP, grant });
    expect(read.list().map((i) => i.title)).toEqual(["keep"]);
    expect(read.get("gone")).toBeNull();
    expect(read.history("gone")).toMatchObject([{ cid: kahuaActCid(gone), withdrawn: true }]);
    // An AI seat's withdraw grants nothing: the item stands.
    const forged = await signKahuaWithdraw({ group: GROUP, epoch: 0, target: kahuaActCid(kept) }, atom);
    const after = readKahuaStage([kept, forged], { group: GROUP, grant });
    expect(after.list().map((i) => i.title)).toEqual(["keep"]);
    expect(after.refused).toContainEqual(expect.objectContaining({ refusal: "grant" }));
  });

  test("RED: an ungranted lift never folds and a parent the reader lacks reads orphan, never head; CONTROL: the granted root lift stands", async () => {
    const { atom, grant, lift } = await fixture();
    const forged = await lift("t", "evil", null, atom);
    const orphan = await lift("u", "x", "f".repeat(64));
    const good = await lift("v", "y", null);
    const read = readKahuaStage([forged, orphan, good], { group: GROUP, grant });
    expect(read.list().map((i) => i.title)).toEqual(["v"]);
    expect(read.orphans.map((o) => o.cid)).toEqual([kahuaActCid(orphan)]);
  });

  test("the doc carries acts under their prefix; the item fields read only verified heads and drop a withdrawn one", async () => {
    const { root, atom, grant, lift } = await fixture();
    const stage = doc();
    const a = await lift("a", "A", null), b = await lift("b", "B", null);
    for (const act of [a, b]) writeKahuaAct(stage, act);
    // A rogue hand writes an item tiddler straight into the doc: the reading never reads it.
    stage.tiddlers["rogue"] = { title: "rogue", text: "bad" } as never;
    writeKahuaAct(stage, await lift("c", "C", null, atom));
    writeKahuaAct(stage, await signKahuaWithdraw({ group: GROUP, epoch: 0, target: kahuaActCid(b) }, root));
    expect(kahuaActRecords(stage, GROUP)).toHaveLength(4);
    const reading = readKahuaStage(kahuaActRecords(stage, GROUP), { group: GROUP, grant });
    const items = kahuaItemTiddlers(reading);
    expect(Object.keys(items)).toEqual(["a"]);
    expect(items["a"]).toMatchObject({ title: "a", text: "A", "kahua-cid": kahuaActCid(a), "kahua-origin-seat": atom.key });
  });
});

describe("the pin and the proposal", () => {
  test("RED: the stage url reads only from the face's verified plane act; CONTROL: an absent act names none", () => {
    expect(kahuaPlaneUrl({ planes: { intents: "automerge:x" } }, GROUP)).toBeNull();
    expect(kahuaPlaneUrl({ planes: { [KAHUA_PLANE]: kahuaStageDocUrl(GROUP) } }, GROUP)).toBe(kahuaStageDocUrl(GROUP));
  });

  test("RED: a proposal rides the intents plane as one signed batch pinned to the proposing device, content never inside; CONTROL: the verb stands declared", async () => {
    const { atom } = await fixture();
    expect(faceIntentVerbs().classOfVerb(KAHUA_PROPOSE_VERB)).not.toBeNull();
    const entry = await buildKahuaProposal({ group: GROUP, signer: atom, session: "s-1", nonce: "n1", verbs: fixtureIntentVerbs({}),
      proposals: [{ title: "t", revision: "r1", digest: "a".repeat(64), taint: ["web"] }, { title: "u", revision: "r2", digest: "b".repeat(64), taint: [] }] });
    expect(entry.body).toMatchObject({ entry: "intent", verb: KAHUA_PROPOSE_VERB, audience: { mode: "pinned", atom: atom.key } });
    expect(JSON.stringify(entry.body)).not.toContain("\"text\"");
    expect(readIntentEntry(entry, { group: GROUP, authorize: () => true }).ok).toBe(true);
    expect(readKahuaProposal(entry)?.proposals.map((p) => p.title)).toEqual(["t", "u"]);
    expect(intentEntryCid(entry)).toMatch(/^[0-9a-f]{64}$/);
    await expect(buildKahuaProposal({ group: GROUP, signer: atom, session: "s", nonce: "n", verbs: fixtureIntentVerbs({}), proposals: [] })).rejects.toThrow(/proposals/);
    await expect(buildKahuaProposal({ group: GROUP, signer: atom, session: "s", nonce: "n", verbs: fixtureIntentVerbs({}), proposals: [{ title: "t", revision: "r", digest: "a".repeat(64) } as never] })).rejects.toThrow(/taint/);
  });
});
