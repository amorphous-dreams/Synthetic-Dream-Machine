/**
 * face-seat-summons — A JOINED, UNSEATED LEAF SUMMONS ITS OWN SEAT (the Founding Walk, W4; ruled 2026-10-29 from
 * "join = intent; idempotent": the person's `fleet join` IS the intent, so the leaf carrying it out starts nothing new).
 *
 * Measured before the cure: a browser leaf joined face h0, crossed, was sorted same-operator, read its face's planes, and
 * logged `pinned, not yet seated — bindings mint vessel-only until a face-join lands` forever: nothing in the browser issued
 * the face-join summons, and a node joinee needed a hand step (`lares intent issue face-join`).
 *
 * Reds: an unseated leaf holding its card and a standing edge, with a founding hearth admitted on the persona log and no
 * standing summons of its own, issues EXACTLY ONE summons pinned to that hearth. CONTROLS: a seated leaf issues none; a
 * leaf whose summons already stands on the plane (a second boot) issues no duplicate; a leaf whose edge stands aside
 * (kapae'd) or unknown issues none; a leaf with no card, no edge or no admitted hearth issues none.
 */
import { describe, expect, test } from "vitest";
import { faceIntentVerbs, intentEntryRecordsOfGroup, type DocHandle, type LarDoc } from "@lararium/mesh";
import { ed25519SignerFromSeed, ed25519VerifyingKeyFromSeed } from "@lararium/mesh";
import { makeSeatSummons, firstAdmittedDevice } from "../src/face-seat-summons.js";
import { makeFaceIntentReader } from "../src/face-intent-door.js";

const seedOf = (n: number): Uint8Array => new Uint8Array(32).fill(n);
const plane = () => {
  const doc = { tiddlers: {} } as LarDoc, listeners = new Set<() => void>();
  return { doc, handle: { doc: () => doc, change: (edit: (d: LarDoc) => void) => { edit(doc); for (const f of listeners) f(); },
    on: (_e: string, l: () => void) => { listeners.add(l); }, off: (_e: string, l: () => void) => { listeners.delete(l); } } as unknown as DocHandle<LarDoc> };
};
const GROUP = "0x" + "ab".repeat(32);
const HEARTH_KEY = "11".repeat(32);
const edge = { deviceVerifyingKey: "", personaRootDid: "0x" + "cd".repeat(32) } as never;

async function fixture(over: Partial<{ seated: boolean; card: boolean; edge: boolean; standing: "stands" | "aside" | "unknown"; hearth: boolean }> = {}) {
  const o = { seated: false, card: true, edge: true, standing: "stands" as const, hearth: true, ...over };
  const atom = { key: await ed25519VerifyingKeyFromSeed(seedOf(106)), sign: ed25519SignerFromSeed(seedOf(106)) };
  const shared = plane(), verbs = faceIntentVerbs();
  let seated = o.seated;
  const calls = { cards: 0 };
  const log: string[] = [];
  const records = o.hearth ? [{ body: { act: "admission", seq: 1, fields: { deviceKey: HEARTH_KEY } } }] : [];
  const summons = makeSeatSummons({
    group: GROUP, atom, plane: shared.handle, verbs,
    seated: async () => seated,
    contactCard: async () => { calls.cards++; return o.card ? new TextEncoder().encode('{"card":"j"}') : null; },
    deviceEdge: o.edge ? { ...edge, deviceVerifyingKey: atom.key } : null,
    standing: async () => o.standing,
    personaRecords: () => records,
    view: async () => (await makeFaceIntentReader({ group: GROUP, plane: shared.handle, atom, personaRecords: () => [], kelChain: [], standing: async () => "stands", verbs, log: () => {} } as never).read()).view,
    log: (m) => { log.push(m); },
  });
  return { summons, shared, atom, log, calls, seat: () => { seated = true; }, entries: () => intentEntryRecordsOfGroup(shared.doc, GROUP) };
}

describe("a joined, unseated leaf summons its own seat", () => {
  test("RED: exactly one summons, pinned to the founding hearth; a second pass and a second boot issue no duplicate", async () => {
    const f = await fixture();
    expect(await f.summons.summon()).toBe("issued");
    expect(f.entries()).toHaveLength(1);
    const entry = f.entries()[0] as { body: { verb: string; issuer: string; audience: { mode: string; atom: string }; args: { summons: { contactCard: string } } } };
    expect(entry.body.verb).toBe("face-join");
    expect(entry.body.issuer.toLowerCase()).toBe(f.atom.key.toLowerCase());
    expect(entry.body.audience).toEqual({ mode: "pinned", atom: HEARTH_KEY });
    expect(entry.body.args.summons.contactCard).toBe('{"card":"j"}');
    // A second pass over the same plane (and a second boot, which reads the same plane) finds the summons standing.
    expect(await f.summons.summon()).toBe("standing");
    expect(f.entries()).toHaveLength(1);
    expect(f.calls.cards).toBe(1);                 // the card derives once per issue, never per read
  });

  test("CONTROL: a seated leaf issues none, and the seat landing after a summons issues no more", async () => {
    const seatedFirst = await fixture({ seated: true });
    expect(await seatedFirst.summons.summon()).toBe("seated");
    expect(seatedFirst.entries()).toHaveLength(0);
    const f = await fixture();
    expect(await f.summons.summon()).toBe("issued");
    f.seat();
    expect(await f.summons.summon()).toBe("seated");
    expect(f.entries()).toHaveLength(1);
  });

  test("CONTROL: an edge set aside or unknown, no card, no edge, or no admitted hearth each issue none, by name", async () => {
    expect(await (await fixture({ standing: "aside" })).summons.summon()).toBe("aside");
    expect(await (await fixture({ standing: "unknown" })).summons.summon()).toBe("unknown");
    expect(await (await fixture({ card: false })).summons.summon()).toBe("no-card");
    expect(await (await fixture({ edge: false })).summons.summon()).toBe("no-edge");
    expect(await (await fixture({ hearth: false })).summons.summon()).toBe("no-hearth");
    const aside = await fixture({ standing: "aside" });
    await aside.summons.summon();
    expect(aside.entries()).toHaveLength(0);
  });

  test("firstAdmittedDevice reads the earliest admission act and nothing malformed", () => {
    expect(firstAdmittedDevice([{ body: { act: "admission", seq: 3, fields: { deviceKey: "b" } } }, { body: { act: "admission", seq: 1, fields: { deviceKey: "a" } } }, { body: { act: "founding", seq: 0 } }, null, "x"])).toBe("a");
    expect(firstAdmittedDevice([{ body: { act: "admission", seq: 1, fields: { deviceKey: 7 } } }])).toBeNull();
    expect(firstAdmittedDevice([])).toBeNull();
  });
});
