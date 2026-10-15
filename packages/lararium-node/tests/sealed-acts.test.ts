/**
 * sealed-acts — THE TABLE OF ACTS over a vessel's sealed rows, on a founded scratch custody.
 *
 *   T1  the table bounds the acts: a name outside it refuses `unknown-act`; an argument a row does not name
 *       refuses `bad-args`; both refuse BEFORE any row opens (a locked seat would otherwise answer first).
 *                                                                 control: a sound call at a locked seat reads CustodyLocked
 *   T2  no row takes a credential of this vessel: no act's shape names one, and a credential handed in refuses by
 *       its key's name. The restore's two rows take a BUNDLE's own key, as 64 lower hex and nothing else: the one
 *       stated exception, and it opens nothing this vessel holds.
 *   T3  the roster reads as one answer and opens no root. `seal.sign` signs as a seat this vessel holds a key
 *       for, never as a persona root, and it signs no image a caller hands it on the
 *       image's form alone: with no charter standing a well-formed roll refuses, and so does every other image
 *       (bytes that spell no record, a record of another name, a crossing record, a roll out of its canonical
 *       spelling). The license itself, and the lawful signature, read in `seal-ceremony.test.ts`.
 *   T4  NO ACT HANDS OUT A SEED, and none hands out what rebuilds one: every answer of every act that takes no
 *       carriage, searched whole, holds neither the persona root seed nor the vessel's signing seed, and the table
 *       names no recovery split.                                  control: the search finds a seed laid in on purpose
 *   T5  the pet-name, declaration and handle-book rows round-trip through their acts, and rest sealed.
 *   T6  an act that meets a row it cannot open refuses under the row's own name, never an empty answer.
 *   T7  the restore's two rows answer a named refusal as an ANSWER (`refused`), never a thrown fault: a body that
 *       fails its tag, an import with no composition standing. A restore with no store to land on refuses the act.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, test, vi } from "vitest";
import { RESERVE_TRANSITION_DOMAIN, canonicalJsonBytes, hex, readVkCarrier, sealRollBytes } from "@lararium/mesh";
import { CustodyLocked, CustodyRowUnavailable } from "../src/custody-holder.js";
import { HANDLE_BOOK_FILE } from "../src/node-circle-store.js";
import { generateOrLoadPersonaGroupRoot, generateOrLoadVesselIdentity, loadPersonaGroupRootSeed, loadVesselSigningSeed } from "../src/node-vessel-identity.js";
import { LABEL_ARG_LIMIT, SEALED_ACTS, SEALED_ACT_NAMES, SIGN_IMAGE_LIMIT, SNAPSHOT_ARG_LIMIT, SealedActRefused, runSealedAct, type SealedActContext } from "../src/sealed-acts.js";
import { seatScratchCustody, type SeatedScratchCustody } from "./custody-seat-fixture.js";
import { seatChairs } from "./seat-fixture.js";

vi.setConfig({ testTimeout: 180_000, hookTimeout: 180_000 });

const ctx: SealedActContext = { kelHead: null, personaSelves: null, walk: null, hosting: null, backup: null };
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
    expect(await reasonOf(runSealedAct("seal.sign", { seat: "ab".repeat(32), image: "zz" }, ctx))).toBe("bad-args");
    expect(await reasonOf(runSealedAct("seal.sign", { seat: "ab".repeat(32), image: "ab".repeat(SIGN_IMAGE_LIMIT + 1) }, ctx))).toBe("bad-args");
    expect(await reasonOf(runSealedAct("seal.sign", { handleIndex: 0, image: "ab" }, ctx))).toBe("bad-args");   // a hand names a seat, never a face
    expect(await reasonOf(runSealedAct("seat.retire", { keys: ["AB".repeat(32)] }, ctx))).toBe("bad-args");
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
    // ONE STATED EXCEPTION, and it names no credential of this vessel: the restore's two rows take a BUNDLE's own
    // key, which the person's route already opened in the command's process. It opens that one bundle's body and
    // nothing this vessel holds (custody#/the-restore).
    expect(named.filter((n) => credentialish.test(n.split(":")[1]!))).toEqual(["bundle.restore:key", "bundle.import:key"]);
    for (const row of ["bundle.restore", "bundle.import"] as const) {
      const body = Buffer.from("a sealed body").toString("base64");
      // A bundle row reads a key as 64 lower hex and nothing else, and takes no route beside it.
      for (const key of ["a-passphrase-not-a-key", "AB".repeat(32), "ab".repeat(31), 7, ["ab".repeat(32)]]) {
        expect(await reasonOf(runSealedAct(row, { body, key }, ctx)), `${row} ${String(key).slice(0, 12)}`).toBe("bad-args");
      }
      for (const stray of ["credentials", "passphrase", "sheets"]) {
        expect(await reasonOf(runSealedAct(row, { body, key: "ab".repeat(32), [stray]: "a-synthetic-credential" }, ctx))).toBe("bad-args");
      }
      expect(await reasonOf(runSealedAct(row, { body: "not base64 !", key: "ab".repeat(32) }, ctx))).toBe("bad-args");
    }
    for (const key of ["credentials", "passphrase", "sheets"]) {
      const refusal = await runSealedAct("persona.roots", { [key]: "a-synthetic-credential" }, ctx).catch((e: unknown) => e);
      expect(refusal).toBeInstanceOf(SealedActRefused);
      expect((refusal as Error).message).toContain(`"${key}"`);
      expect((refusal as Error).message).not.toContain("a-synthetic-credential");
    }
  });

  test("T3 — the roster reads as one answer, and seal.sign signs no image on its form alone", async () => {
    await vessel("acts-t3");
    const root = await generateOrLoadPersonaGroupRoot(0);
    const roots = await runSealedAct("persona.roots", {}, ctx);
    expect(roots).toEqual({ roots: [{ handleIndex: 0, verifyingKey: root.verifyingKey }], active: null, orphans: [] });
    const [seat] = (await seatChairs([0])).keys as [string];
    const sign = (args: Record<string, unknown>) => runSealedAct("seal.sign", { seat, ...args }, ctx) as Promise<{ signer: string; sig: string }>;
    // A WELL-FORMED ROLL SIGNS ONLY UNDER A CHARTER THAT LICENSES IT (`seal-ceremony.test.ts` walks the license).
    // No charter stands here: the roll the parent commit's row signed for any caller refuses.
    const roll = sealRollBytes({ prevEpochCid: "nexus-" + "ab".repeat(32), keys: [seat], threshold: 1, nextKeyDigests: ["cd".repeat(32)], nextThreshold: 1 });
    expect(await reasonOf(sign({ image: hex(roll) }))).toBe("act-refused");
    // EVERY OTHER IMAGE REFUSES TOO, a crossing record among them: the crossing's hands mark through the rite's own acts.
    const crossing = canonicalJsonBytes({ domain: RESERVE_TRANSITION_DOMAIN, fromEpochCid: "a", toEpochCid: "b" });
    const foreign: Array<[string, Record<string, unknown>]> = [
      ["bytes that spell no record", { image: hex(new TextEncoder().encode("a synthetic image to sign")) }],
      ["a record of another name", { image: hex(canonicalJsonBytes({ kind: "lar:///ha.ka.ba/api/v0.1/pono/persona-grant", personaRef: {} })) }],
      ["a record with no name", { image: hex(canonicalJsonBytes({ prevEpochCid: "x" })) }],
      ["a crossing record", { image: hex(crossing) }],
      ["a list", { image: hex(canonicalJsonBytes([{ domain: RESERVE_TRANSITION_DOMAIN }])) }],
      ["a roll out of its canonical spelling", { image: hex(new TextEncoder().encode(new TextDecoder().decode(roll).replace("{", "{ "))) }],
    ];
    for (const [why, args] of foreign) expect(await reasonOf(sign(args)), why).toBe("act-refused");
    expect(await reasonOf(sign({ image: hex(roll), note: "what stood observed" }))).toBe("bad-args");   // the roll row takes no note
    expect(await reasonOf(runSealedAct("seal.sign", { seat: root.verifyingKey.toLowerCase(), image: hex(roll) }, ctx))).toBe("act-refused");   // a root holds no seat row
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
      ["crossing.state", {}],
      ["petname.entries", {}], ["declaration.entries", {}], ["handle-book.load", {}],
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

  test("T7 — the restore's rows answer a named refusal, and a restore with no store refuses the act", async () => {
    await vessel("acts-t7");
    const key = "ab".repeat(32);
    const body = Buffer.from(new Uint8Array(64).fill(7)).toString("base64");
    // No store stands to land on: the act refuses before the body opens.
    expect(await reasonOf(runSealedAct("bundle.restore", { body, key }, ctx))).toBe("act-refused");
    // With a store lent, a body that fails its tag answers its own name and moves nothing.
    const lent: SealedActContext = { ...ctx, hosting: { withRepo: async () => { throw new Error("no restore reaches the store before its body opens"); }, rolled: async () => {} } };
    expect(await runSealedAct("bundle.restore", { body, key }, lent)).toMatchObject({ refused: "bundle-refused" });
    expect(await runSealedAct("bundle.import", { body, key }, ctx)).toMatchObject({ refused: "bundle-refused" });
    // An answer names no key and no body.
    const said = JSON.stringify([await runSealedAct("bundle.restore", { body, key }, lent), await runSealedAct("bundle.import", { body, key }, ctx)]);
    expect(said).not.toContain(key);
    expect(said).not.toContain(body);
  });
});
