/**
 * seal-cold-rehearse — `lares nexus seal cold rehearse` reads a cold-key card back against the charter head and
 * moves nothing.
 *
 * Driven through the real rite on a real vault and the charter doc on disk: the seat prints each chair's card (on a
 * staged root its answer carries each code), and the rehearsal takes the codes back.
 *
 *   R1  A CARD THE HEAD COMMITTED NAMES ITS CHAIR, AND NOTHING MOVES. Every printed card answers one distinct
 *       position and the chair the seat named for it; the charter bytes and the seat rows stay as they stood. One
 *       card alone answers, and the rest read as not rehearsed.
 *   R2  RED: A CARD THE HEAD NEVER COMMITTED REFUSES BY NAME, AND THE REFUSAL CARRIES NO BYTE OF IT. A mis-copied
 *       card refuses as unreadable; one card typed twice refuses as a repeat.    control: R1
 *   R3  RED: A SPENT CARD ANSWERS NO ROLLED HEAD. After a roll the genesis cards answer nothing; the rolled head's do.
 *   R4  RED: A COPIED MARKER STANDS IN FOR NO TERMINAL. The same root and charter, its custody founded again under
 *       another passphrase: `--cold-key` refuses.                                control: R1, the test route
 *   R5  Nothing to rehearse: no charter refuses by name; a terminal-less run without the flag refuses; an empty
 *       typing refuses.
 *   An unarmed head refuses `rotation-unarmed`: `seal-rotate-refusal-codes.test.ts`, which builds that head.
 */
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { cmdNexus } from "../src/commands/nexus.js";
import type { ParsedArgs } from "../src/parse-args.js";
import { larSealHome } from "../src/env.js";
import {
  FsCustodyIo, foundCustody, generateOrLoadPersonaGroupRoot, listSeatKeys, makeCustodyHolder, makeNodePersonaDeclarationStore,
  makeNodePersonaPetnameStore, nexusCharterDocPath, readNexusDoc, seatCustody, unseatCustody, vesselCustodyHomes,
} from "@lararium/node";
import { coldKeyCode, mintColdKey, renameOwnPersona, seatedKahuKeys, standForKahuSeat } from "@lararium/mesh";
import { seatScratchCustody, type ScratchCustody } from "./support/scratch-custody.js";
import { sealRite, type SealRite } from "./seal-rite-fixture.js";

// A founding derives a key and every seat seals a row, so a case here runs for seconds. No assertion reads a clock.
vi.setConfig({ testTimeout: 60_000, hookTimeout: 60_000 });

const rehearse = (options: Record<string, string> = {}): ParsedArgs =>
  ({ command: "nexus", positional: ["seal", "cold", "rehearse"], options, flags: { json: true } });
async function run(a: ParsedArgs): Promise<{ code: number; out: Record<string, any>; text: string }> {
  const lines: string[] = [];
  const write = vi.spyOn(process.stdout, "write").mockImplementation((chunk: unknown) => { lines.push(String(chunk)); return true; });
  try { const code = await cmdNexus(a); const json = lines.find((line) => line.trim().startsWith("{")); return { code, out: json ? JSON.parse(json) : {}, text: lines.join("") }; }
  finally { write.mockRestore(); }
}
const cards = (r: { out: Record<string, unknown> }): string[] =>
  ((r.out["data"] as { cards: Array<{ code: string }> }).cards).map((c) => c.code);

describe("lares nexus seal cold rehearse", () => {
  let root: string;
  let prior: string | undefined;
  let custody: ScratchCustody;
  let rite: SealRite;
  beforeEach(async () => {
    root = mkdtempSync(join(tmpdir(), "lares-cold-rehearse-")); prior = process.env["LAR_ROOT"]; process.env["LAR_ROOT"] = root;
    vi.spyOn(console, "log").mockImplementation(() => {}); vi.spyOn(console, "error").mockImplementation(() => {});
    custody = await seatScratchCustody();
    rite = sealRite();
  });
  afterEach(async () => {
    await custody.drop();
    vi.restoreAllMocks();
    if (prior === undefined) delete process.env["LAR_ROOT"]; else process.env["LAR_ROOT"] = prior;
    rmSync(root, { recursive: true, force: true });
  });
  async function stand(): Promise<void> {
    const petnames = await makeNodePersonaPetnameStore(); const declarations = await makeNodePersonaDeclarationStore();
    for (let i = 0; i < 3; i++) { await generateOrLoadPersonaGroupRoot(i); await renameOwnPersona(petnames, i, `veil-${i}`); await standForKahuSeat(declarations, i, true, `Chair ${i}`); }
  }

  test("R1 — each card the head committed names its chair, and nothing moves", async () => {
    await stand();
    const seated = await rite.seat();
    expect(seated.code).toBe(0);
    const codes = cards(seated);
    expect(codes).toHaveLength(3);
    const path = nexusCharterDocPath(larSealHome());
    const before = readFileSync(path);
    const rows = listSeatKeys();
    // Every row file's BYTES, not only its name: a rehearsal reseals nothing.
    const identity = custody.homes.identity;
    const rowBytes = (): string[] => readdirSync(identity).filter((n) => n.startsWith("seat-key-")).sort()
      .map((n) => `${n}:${readFileSync(join(identity, n)).toString("hex")}`);
    const rowsBefore = rowBytes();
    expect(rowsBefore).toHaveLength(3);
    const doc = readNexusDoc(larSealHome())!;
    const chairOf = new Map(doc.kahu.map((k) => [k.verifyingKey!.toLowerCase(), k.displayName]));
    const sorted = seatedKahuKeys(doc);

    const all = await run(rehearse({ "cold-key": codes.join(",") }));
    expect(all.code).toBe(0);
    expect(all.out.data.moved).toBe(false);
    expect(all.out.data.unrehearsed).toEqual([]);
    const answered = all.out.data.answered as Array<{ card: number; position: number; chair: string }>;
    expect(new Set(answered.map((a) => a.position)).size).toBe(3);
    for (const a of answered) expect(a.chair).toBe(chairOf.get(sorted[a.position - 1]!));
    // NO CODE RIDES THE ANSWER: a rehearsal hands back positions and chairs alone.
    for (const code of codes) expect(all.text).not.toContain(code);

    const one = await run(rehearse({ "cold-key": codes[1]! }));
    expect(one.code).toBe(0);
    expect(one.out.data.answered).toHaveLength(1);
    expect(one.out.data.unrehearsed).toHaveLength(2);

    expect(readFileSync(path).equals(before)).toBe(true);
    expect(listSeatKeys()).toEqual(rows);
    expect(rowBytes()).toEqual(rowsBefore);
  });

  test("R2 — RED: a card the head never committed refuses by name and carries no byte of it; a mis-copied card reads unreadable", async () => {
    await stand();
    const codes = cards(await rite.seat());
    const path = nexusCharterDocPath(larSealHome());
    const before = readFileSync(path);
    const stranger = await mintColdKey();
    const strangerCode = coldKeyCode(stranger.seed);
    const refused = await run(rehearse({ "cold-key": `${codes[0]},${strangerCode}` }));
    expect(refused.code).not.toBe(0);
    expect(refused.out.error.code).toBe("cold-card-answers-no-digest");
    expect(refused.out.error.message).toMatch(/^card 2 answers no digest/);
    expect(refused.text).not.toContain(strangerCode.slice(0, 9));
    // One group of the paper copied wrong: the checksum catches it before any digest reads.
    const groups = codes[0]!.split("-");
    groups[3] = groups[3] === "0000" ? "0001" : "0000";
    const slipped = await run(rehearse({ "cold-key": groups.join("-") }));
    expect(slipped.code).toBe(2);
    expect(slipped.out.error.message).toMatch(/cold-key-card-unreadable: checksum/);
    // One card typed twice: a roll takes one card per chair, so the repeat refuses by name.
    const twice = await run(rehearse({ "cold-key": `${codes[2]},${codes[0]},${codes[2]}` }));
    expect(twice.out.error.code).toBe("cold-card-repeated");
    expect(twice.out.error.message).toMatch(/^card 3 answers the same chair as card 1/);
    expect(readFileSync(path).equals(before)).toBe(true);
  });

  test("R3 — RED: a spent card answers no rolled head; the rolled head's cards do", async () => {
    await stand();
    const genesis = cards(await rite.seat());
    const rolled = await rite.rotate();
    expect(rolled.code).toBe(0);
    const spent = await run(rehearse({ "cold-key": genesis[0]! }));
    expect(spent.out.error.code).toBe("cold-card-answers-no-digest");
    const fresh = await run(rehearse({ "cold-key": cards(rolled).join(",") }));
    expect(fresh.code).toBe(0);
    expect(fresh.out.data.answered).toHaveLength(3);
  });

  test("R4 — RED: a copied marker over custody sealed under another passphrase stands in for no terminal", async () => {
    await stand();
    const codes = cards(await rite.seat());
    expect((await run(rehearse({ "cold-key": codes[0]! }))).code).toBe(0);         // CONTROL: the test route
    // The same root, marker and charter; its custody founded again under a passphrase no harness publishes.
    await custody.drop();
    const homes = vesselCustodyHomes();
    rmSync(homes.identity, { recursive: true, force: true });
    mkdirSync(homes.identity, { recursive: true, mode: 0o700 });
    const io = new FsCustodyIo(homes);
    const founded = await foundCustody({ io, homes, slots: [{ t: 1, pins: [{ kind: "passphrase", passphrase: "a-household-passphrase" }] }] });
    const holder = makeCustodyHolder({ io, homes });
    await holder.adopt(founded.vk);
    seatCustody(holder);
    custody = { homes, holder, async drop() { await holder.lock(); unseatCustody(holder); } };
    const refused = await run(rehearse({ "cold-key": codes[0]! }));
    expect(refused.code).toBe(2);
    expect(refused.out.error.message).toMatch(/--cold-key stands in for the terminal on a staged test root alone/);
  });

  test("R5 — no charter refuses by name; a run with no terminal and no flag refuses", async () => {
    const none = await run(rehearse({ "cold-key": coldKeyCode((await mintColdKey()).seed) }));
    expect(none.code).toBe(2);
    expect(none.out.error.message).toMatch(/no charter stands here — nothing to rehearse/);
    await stand();
    expect((await rite.seat()).code).toBe(0);
    const blind = await run(rehearse());
    expect(blind.code).toBe(2);
    expect(blind.out.error.message).toMatch(/on a terminal/);
    const empty = await run(rehearse({ "cold-key": " , " }));
    expect(empty.code).toBe(2);
    expect(empty.out.error.message).toMatch(/no card typed/);
  });
});
