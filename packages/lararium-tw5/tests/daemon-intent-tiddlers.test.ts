import { describe, expect, test, vi } from "vitest";
import { buildCancel, buildIntent, buildOutcome, ed25519SignerFromSeed, ed25519VerifyingKeyFromSeed,
  faceIntentVerbs, intentEntryCid, intentId, intentPaneModel, makeHandLineage, readIntentPlane,
  type IntentPaneModel } from "@lararium/mesh";
import type { TW5Engine } from "../src/tw5-vm.js";
import type { VerbContext } from "../src/verb-dispatcher.js";
import { DAEMON_INTENT_TIDDLERS, INTENT_PANE_TITLE, INTENT_STATE_TITLE, INTENT_VIEW_CAP, makeIntentViewReactor, seedDaemonIntentTiddlers } from "../src/daemon-intent-tiddlers.js";
import { seedDaemonProtocol } from "../src/daemon-protocol-seed.js";
import { HULLS_TS_ONLY } from "@lararium/mesh";
import { bootTestWiki, wikiSkip, skipNote } from "./test-wiki.js";

const pane: IntentPaneModel = { rows: [{ id: "1234567890abcdef", verb: "MOVE", status: "unknown-frontier", winner: null,
  winners: [], duplicates: ["duplicate1", "duplicate2"], unknownOutcomes: [], voidAfterAct: ["voidreceipt"], unknown: true,
  unknownReason: "outcome signer standing missing", outcomeCount: "unknown" }],
  refusedCount: 1, strayAnswerCount: 1, refused: ["signature"], strayAnswers: ["strayanswer"] };

const fakeWiki = () => {
  const fields = new Map<string, Record<string, string>>();
  return { fields, tw5: { setTiddler: (row: Record<string, string>) => fields.set(row.title!, row) } as unknown as TW5Engine };
};
const context = (ok: boolean) => ({ cap: vi.fn(async () => ({ ok })) }) as unknown as VerbContext;
const signer = async (n: number) => ({ key: await ed25519VerifyingKeyFromSeed(new Uint8Array(32).fill(n)), sign: ed25519SignerFromSeed(new Uint8Array(32).fill(n)) });

async function seededPane() {
  const group = "synthetic-face", root = await signer(9), issuer = await signer(1), executor = await signer(2), missing = await signer(3), verbs = faceIntentVerbs();
  const make = (name: string, hand = issuer) => buildIntent({ group, signer: hand, verb: "MOVE", args: { title: name }, nonce: "",
    audience: { mode: "pinned", atom: executor.key }, verbs });
  const duplicated = await make("duplicated"), voided = await make("voided"), uncertain = await make("uncertain", missing);
  const idOf = (entry: typeof duplicated) => intentId(entry.body as unknown as { issuer: string; verb: string; args: unknown; nonce: string });
  const duplicateA = await buildOutcome({ group, signer: executor, cause: idOf(duplicated), result: { n: 1 } });
  const duplicateB = await buildOutcome({ group, signer: executor, cause: idOf(duplicated), result: { n: 2 } });
  const afterAct = await buildOutcome({ group, signer: executor, cause: idOf(voided), result: { n: 1 } });
  const cancel = await buildCancel({ group, signer: root, intent: idOf(voided), epoch: 0 });
  const lineage = makeHandLineage([{ epoch: 0, signers: [root.key], threshold: 1 }]);
  if (!lineage) throw new Error("fixture lineage refused");
  const view = readIntentPlane({ group, records: [duplicated, voided, uncertain, duplicateA, duplicateB, afterAct, cancel],
    face: { devices: [issuer.key, executor.key, missing.key], rosterCids: [], admittedAt: new Map(), lineage },
    standing: (atom) => atom === missing.key ? "unknown" : "stands", verbs });
  return { pane: intentPaneModel(view), duplicateCids: [intentEntryCid(duplicateA), intentEntryCid(duplicateB)], afterCid: intentEntryCid(afterAct) };
}

describe("face intent pane", () => {
  test("RED: source dispatches only a read refresh; CONTROL: the state reactor fills from a granted read", async () => {
    const source = DAEMON_INTENT_TIDDLERS.map((t) => t.text).join("\n");
    expect([...source.matchAll(/\$action-setfield[^>]*\$tiddler="([^"]+)"/g)].map((m) => m[1]))
      .toEqual(["lar:///lararium.local.vm/verb/intent-view", "$:/temp/lares/surface"]);
    expect(source).not.toMatch(/face-join|\/summons\//);
    const wiki = fakeWiki(), read = vi.fn(async () => pane);
    await makeIntentViewReactor(wiki.tw5, "intent-bag", read)({}, context(true));
    expect(read).toHaveBeenCalledTimes(1);
    expect(wiki.fields.get(INTENT_STATE_TITLE)?.["duplicates-0"]).toBe("duplicate1 duplicate2");
  });

  test("RED: no read cap refuses by name and leaves no data; CONTROL: a granted read fills local state", async () => {
    const wiki = fakeWiki(), read = vi.fn(async () => pane), reactor = makeIntentViewReactor(wiki.tw5, "intent-bag", read);
    const denied = context(false);
    await expect(reactor({}, denied)).rejects.toThrow("intent-view-no-capability");
    expect(denied.cap).toHaveBeenCalledWith("read", "intent-bag");
    expect(wiki.fields.get(INTENT_STATE_TITLE)?.list).toBe("");
    expect(read).not.toHaveBeenCalled();
    await reactor({}, context(true));
    expect(wiki.fields.get(INTENT_VIEW_CAP)?.text).toBe("1");
    expect(wiki.fields.get(INTENT_STATE_TITLE)?.list).toBe("0");
  });

  test("RED: a floor seeds no intent pane; CONTROL: a faced seed places both pane tiddlers", () => {
    const floor = fakeWiki(), face = fakeWiki();
    seedDaemonProtocol(floor.tw5, HULLS_TS_ONLY, false);
    seedDaemonProtocol(face.tw5, HULLS_TS_ONLY, true);
    expect(floor.fields.has(INTENT_PANE_TITLE)).toBe(false);
    expect(face.fields.has(INTENT_PANE_TITLE)).toBe(true);
    expect(face.fields.has("$:/lares/ui/PageControls/face-intents")).toBe(true);
  });
});

describe.skipIf(!!wikiSkip)(`face intent pane renders in TW5${skipNote}`, () => {
  test("RED: duplicate, void-after-act, and unknown frontier paint distinct rows; CONTROL: no cap paints only the gate", async () => {
    const engine = await bootTestWiki();
    seedDaemonIntentTiddlers(engine);
    const gated = engine.wiki.renderTiddler("text/html", INTENT_PANE_TITLE);
    expect(gated).toContain("hold the intent-view capability");
    expect(gated).not.toContain("duplicate1");
    const seeded = await seededPane();
    await makeIntentViewReactor(engine, "intent-bag", async () => seeded.pane)({}, context(true));
    const html = engine.wiki.renderTiddler("text/html", INTENT_PANE_TITLE);
    expect(seeded.pane.rows.some((row) => row.duplicates.length === 1)).toBe(true);
    expect(seeded.pane.rows.some((row) => row.voidAfterAct.length === 1)).toBe(true);
    expect(html).toContain("duplicate");
    expect(html).toContain(seeded.afterCid);
    expect(html).toContain("unknown");
    expect(html).toContain("issuer standing missing");
    expect(html).toContain("winner");
  });
});
