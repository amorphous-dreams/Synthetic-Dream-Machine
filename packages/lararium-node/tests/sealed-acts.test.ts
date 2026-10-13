/**
 * sealed-acts — THE TABLE OF ACTS over a vessel's sealed rows, on a founded scratch custody.
 *
 *   T1  the table bounds the acts: a name outside it refuses `unknown-act`; an argument a row does not name
 *       refuses `bad-args`; both refuse BEFORE any row opens (a locked seat would otherwise answer first).
 *                                                                 control: a sound call at a locked seat reads CustodyLocked
 *   T2  no row takes a credential: no act's shape names one, and a credential handed in refuses by its key's name.
 *   T3  the roster reads as one answer and opens no root. `seal.sign` signs the seal ceremony's two images alone (a
 *       charter roll; a crossing record, with a witness's note after it) and every other image refuses: bytes
 *       that spell no record, a record of another name, a record out of its canonical spelling, a note on a roll.
 *                                                                 control: each lawful signature verifies under the roster's key
 *   T4  NO ACT HANDS OUT A SEED, and none hands out what rebuilds one: every answer of every act that takes no
 *       carriage, searched whole, holds neither the persona root seed nor the vessel's signing seed, and the table
 *       names no recovery split.                                  control: the search finds a seed laid in on purpose
 *   T5  the pet-name, declaration and handle-book rows round-trip through their acts, and rest sealed.
 *   T6  an act that meets a row it cannot open refuses under the row's own name, never an empty answer.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, test, vi } from "vitest";
import { RESERVE_TRANSITION_DOMAIN, canonicalJsonBytes, hex, readVkCarrier, sealRollBytes, verifyEd25519 } from "@lararium/mesh";
import { CustodyLocked, CustodyRowUnavailable } from "../src/custody-holder.js";
import { HANDLE_BOOK_FILE } from "../src/node-circle-store.js";
import { generateOrLoadPersonaGroupRoot, generateOrLoadVesselIdentity, loadPersonaGroupRootSeed, loadVesselSigningSeed } from "../src/node-vessel-identity.js";
import { LABEL_ARG_LIMIT, SEALED_ACTS, SEALED_ACT_NAMES, SIGN_IMAGE_LIMIT, SNAPSHOT_ARG_LIMIT, SealedActRefused, runSealedAct, type SealedActContext } from "../src/sealed-acts.js";
import { seatScratchCustody, type SeatedScratchCustody } from "./custody-seat-fixture.js";

vi.setConfig({ testTimeout: 180_000, hookTimeout: 180_000 });

const ctx: SealedActContext = { kelHead: null };
const drops: SeatedScratchCustody[] = [];
async function vessel(label: string): Promise<SeatedScratchCustody> {
  const c = await seatScratchCustody(label);
  drops.push(c);
  return c;
}
afterEach(async () => { for (const c of drops.splice(0).reverse()) await c.drop(); });

const reasonOf = async (run: Promise<unknown>): Promise<string> => {
  try { await run; return "ran"; }
  catch (e) { return e instanceof SealedActRefused ? e.reason : (e as Error).constructor.name; }
};

describe("the sealed-act table", () => {
  test("T1 — a name outside the table and an argument outside a row refuse before any row opens", async () => {
    const c = await vessel("acts-t1");
    await c.holder.lock();                                            // locked: any refusal below that reached a row reads CustodyLocked
    expect(await reasonOf(runSealedAct("persona.export-seed", {}, ctx))).toBe("unknown-act");
    expect(await reasonOf(runSealedAct("toString", {}, ctx))).toBe("unknown-act");          // an inherited name names no act
    expect(await reasonOf(runSealedAct("__proto__", {}, ctx))).toBe("unknown-act");
    expect(await reasonOf(runSealedAct(7, {}, ctx))).toBe("unknown-act");
    for (const name of SEALED_ACT_NAMES) {
      expect(await reasonOf(runSealedAct(name, { "an-argument-no-row-names": 1 }, ctx)), name).toBe("bad-args");
      expect(await reasonOf(runSealedAct(name, [1], ctx)), name).toBe("bad-args");
    }
    expect(await reasonOf(runSealedAct("petname.set", { handleIndex: 0.5, petname: "x" }, ctx))).toBe("bad-args");
    expect(await reasonOf(runSealedAct("petname.set", { handleIndex: 0, petname: "" }, ctx))).toBe("bad-args");
    expect(await reasonOf(runSealedAct("seal.sign", { handleIndex: 0, image: "zz" }, ctx))).toBe("bad-args");
    expect(await reasonOf(runSealedAct("seal.sign", { handleIndex: 0, image: "ab".repeat(SIGN_IMAGE_LIMIT + 1) }, ctx))).toBe("bad-args");
    expect(await reasonOf(runSealedAct("petname.set", { handleIndex: 0, petname: "x".repeat(LABEL_ARG_LIMIT + 1) }, ctx))).toBe("bad-args");
    expect(await reasonOf(runSealedAct("declaration.set", { handleIndex: 0, declaration: { chair: "x".repeat(LABEL_ARG_LIMIT + 1) } }, ctx))).toBe("bad-args");
    expect(await reasonOf(runSealedAct("handle-book.save", { snapshot: { era: 1, records: ["x".repeat(SNAPSHOT_ARG_LIMIT)] } }, ctx))).toBe("bad-args");
    expect(await reasonOf(runSealedAct("declaration.set", { handleIndex: 0, declaration: { handle: "x", extra: 1 } }, ctx))).toBe("bad-args");
    // CONTROL: a sound call reaches the seat, and the locked seat answers by its own name.
    await expect(runSealedAct("persona.roots", {}, ctx)).rejects.toBeInstanceOf(CustodyLocked);
    await expect(runSealedAct("petname.set", { handleIndex: 0, petname: "x" }, ctx)).rejects.toBeInstanceOf(CustodyLocked);
  });

  test("T2 — no row takes a credential", async () => {
    const credentialish = /credential|passphrase|password|sheet|secret|seed|vk\b|key$/i;
    const named = SEALED_ACT_NAMES.flatMap((name) => Object.keys(SEALED_ACTS[name].shape).map((arg) => `${name}:${arg}`));
    expect(named.length).toBeGreaterThan(8);                           // CONTROL: the scan read real shapes
    expect(named.filter((n) => credentialish.test(n.split(":")[1]!))).toEqual([]);
    for (const key of ["credentials", "passphrase", "sheets"]) {
      const refusal = await runSealedAct("persona.roots", { [key]: "a-synthetic-credential" }, ctx).catch((e: unknown) => e);
      expect(refusal).toBeInstanceOf(SealedActRefused);
      expect((refusal as Error).message).toContain(`"${key}"`);
      expect((refusal as Error).message).not.toContain("a-synthetic-credential");
    }
  });

  test("T3 — the roster reads as one answer, and persona.sign signs under the key it names", async () => {
    await vessel("acts-t3");
    const root = await generateOrLoadPersonaGroupRoot(0);
    const roots = await runSealedAct("persona.roots", {}, ctx);
    expect(roots).toEqual({ roots: [{ handleIndex: 0, verifyingKey: root.verifyingKey }], active: null, orphans: [] });
    const sign = (args: Record<string, unknown>) => runSealedAct("seal.sign", { handleIndex: 0, ...args }, ctx) as Promise<{ signer: string; sig: string }>;
    // A charter roll, as the roll itself spells it.
    const roll = sealRollBytes({ prevEpochCid: "epoch0-" + "ab".repeat(32), keys: [root.verifyingKey], threshold: 1, nextKeyCommit: "cd".repeat(32) });
    const rolled = await sign({ image: hex(roll) });
    expect(rolled.signer).toBe(root.verifyingKey);
    expect(verifyEd25519(rolled.sig, roll, rolled.signer)).toBe(true);
    // A crossing record, and a witness's mark over it with a note.
    const crossing = canonicalJsonBytes({ domain: RESERVE_TRANSITION_DOMAIN, fromEpochCid: "a", toEpochCid: "b" });
    expect(verifyEd25519((await sign({ image: hex(crossing) })).sig, crossing, root.verifyingKey)).toBe(true);
    const note = "what stood observed";
    const marked = Uint8Array.from([...crossing, ...new TextEncoder().encode(note)]);
    const witness = await sign({ image: hex(crossing), note });
    expect(verifyEd25519(witness.sig, marked, root.verifyingKey)).toBe(true);
    expect(verifyEd25519(witness.sig, crossing, root.verifyingKey)).toBe(false);            // CONTROL: the note rides the signed bytes
    // EVERY OTHER IMAGE REFUSES, and nothing signs.
    const foreign: Array<[string, Record<string, unknown>]> = [
      ["bytes that spell no record", { image: hex(new TextEncoder().encode("a synthetic image to sign")) }],
      ["a record of another name", { image: hex(canonicalJsonBytes({ kind: "lar:///ha.ka.ba/api/v0.1/pono/persona-grant", personaRef: {} })) }],
      ["a record with no name", { image: hex(canonicalJsonBytes({ prevEpochCid: "x" })) }],
      ["a list", { image: hex(canonicalJsonBytes([{ domain: RESERVE_TRANSITION_DOMAIN }])) }],
      ["a roll out of its canonical spelling", { image: hex(new TextEncoder().encode(new TextDecoder().decode(roll).replace("{", "{ "))) }],
      ["a crossing record with bytes after it", { image: hex(Uint8Array.from([...crossing, 0x20])) }],
      ["a record that claims both names", { image: hex(canonicalJsonBytes({ domain: RESERVE_TRANSITION_DOMAIN, kind: "lar:///ha.ka.ba/api/v0.1/pono/seal-roll" })) }],
      ["a note on a roll", { image: hex(roll), note }],
    ];
    for (const [why, args] of foreign) expect(await reasonOf(sign(args)), why).toBe("act-refused");
    expect(await reasonOf(runSealedAct("seal.sign", { handleIndex: 3, image: hex(roll) }, ctx))).toBe("act-refused");   // no root held there
    await runSealedAct("persona.wear", { handleIndex: 0 }, ctx);
    expect((await runSealedAct("persona.roots", {}, ctx))["active"]).toBe(0);
    await expect(runSealedAct("persona.wear", { handleIndex: 5 }, ctx)).rejects.toThrow();  // wearing needs a held root
  });

  test("T4 — no act hands out a seed", async () => {
    await vessel("acts-t4");
    await generateOrLoadVesselIdentity();
    await generateOrLoadPersonaGroupRoot(0);
    const seeds = [hex(await loadPersonaGroupRootSeed(0)), hex(await loadVesselSigningSeed())];
    expect(seeds.every((s) => s.length === 64)).toBe(true);
    await runSealedAct("petname.set", { handleIndex: 0, petname: "the-first-face" }, ctx);
    await runSealedAct("declaration.set", { handleIndex: 0, declaration: { handle: "Synthetic", seat: true, chair: "first chair" } }, ctx);
    const answers: Record<string, unknown> = {};
    const calls: Array<[Parameters<typeof runSealedAct>[0], Record<string, unknown>]> = [
      ["persona.roots", {}], ["persona.wear", { handleIndex: 0 }],
      ["seal.sign", { handleIndex: 0, image: hex(canonicalJsonBytes({ domain: RESERVE_TRANSITION_DOMAIN })) }],
      ["petname.entries", {}], ["declaration.entries", {}], ["admit.offer", {}], ["admit.list", {}], ["admit.reset", {}],
      ["admit.withdraw-offer", { target: "all" }], ["handle-book.load", {}],
    ];
    for (const [name, args] of calls) answers[name as string] = await runSealedAct(name, args, ctx);
    const spoken = JSON.stringify(answers).toLowerCase();
    for (const seed of seeds) expect(spoken.includes(seed)).toBe(false);
    expect(Object.keys(answers).length).toBe(calls.length);
    // No row names a recovery split: its shares rebuild a root, so it runs in a command's own process alone.
    expect(SEALED_ACT_NAMES.filter((n) => /recover|share|split|export|seed/i.test(n))).toEqual([]);
    // CONTROL: the same search finds a seed laid into an answer on purpose.
    expect(JSON.stringify({ ...answers, laid: seeds[0] }).toLowerCase().includes(seeds[0]!)).toBe(true);
  });

  test("T5 — pet-names, declarations and the handle-book round-trip through their acts and rest sealed", async () => {
    const c = await vessel("acts-t5");
    await runSealedAct("petname.set", { handleIndex: 1, petname: "the-burner" }, ctx);
    await runSealedAct("petname.set", { handleIndex: 0, petname: "home" }, ctx);
    expect(await runSealedAct("petname.entries", {}, ctx)).toEqual({ entries: [[0, "home"], [1, "the-burner"]] });
    await runSealedAct("petname.clear", { handleIndex: 1 }, ctx);
    expect(await runSealedAct("petname.entries", {}, ctx)).toEqual({ entries: [[0, "home"]] });
    await runSealedAct("declaration.set", { handleIndex: 0, declaration: { handle: "Synthetic", seat: true } }, ctx);
    expect(await runSealedAct("declaration.entries", {}, ctx)).toEqual({ entries: [[0, { handle: "Synthetic", seat: true }]] });
    await runSealedAct("declaration.clear", { handleIndex: 0 }, ctx);
    expect(await runSealedAct("declaration.entries", {}, ctx)).toEqual({ entries: [] });
    const { snapshot } = await runSealedAct("handle-book.load", {}, ctx) as { snapshot: { era: unknown; records: unknown[] } };
    expect(snapshot.records).toEqual([]);                              // nothing at the path: a book that recognises nobody
    await runSealedAct("handle-book.save", { snapshot }, ctx);
    expect(readVkCarrier(readFileSync(join(c.homes.identity, HANDLE_BOOK_FILE)))).toBe("sealed");
    expect(await runSealedAct("handle-book.load", {}, ctx)).toEqual({ snapshot });
  });

  test("T6 — an act that meets a row it cannot open refuses under the row's name", async () => {
    const c = await vessel("acts-t6");
    writeFileSync(join(c.homes.identity, HANDLE_BOOK_FILE), "{\"cleartext\":true}");
    const refusal = await runSealedAct("handle-book.load", {}, ctx).catch((e: unknown) => e);
    expect(refusal).toBeInstanceOf(CustodyRowUnavailable);
    expect(refusal).toMatchObject({ home: "identity", file: HANDLE_BOOK_FILE });
    await expect(runSealedAct("handle-book.save", { snapshot: { era: 1, records: [] } }, ctx)).rejects.toBeInstanceOf(CustodyRowUnavailable);
    expect(readFileSync(join(c.homes.identity, HANDLE_BOOK_FILE), "utf8")).toBe("{\"cleartext\":true}");
  });
});
