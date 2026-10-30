/**
 * card-print-standing — THE CARD-PRINT STANDING CHECK (walk ledger W9, ruled a standing check by Lares 2026-10-29).
 *
 * Every cold-key card verb runs once WITHOUT `--json` on a staged root, where the read-back stands in, so the road a
 * person walks on a terminal (the card printing before the act moves) is seen by the harness at all. Before this file
 * the card roads ran by hand alone, and `cofound open` broke on a terminal for every walk while every JSON test read
 * green (`seal-cofound` C3 holds that verb's terminal road now; this file cites it and runs the rest).
 *
 * Per verb, what a terminal shows: the header `── cold-key card · <chair> ──`, one line per field the chair holds
 * (purpose · chair · generation, and `charter:` only where a charter stands), the code in rows of six groups, and the
 * confirm phrase; then the act's own answer (JSON here, since this runner's stdout is no TTY: `render.wantsJson`).
 * A refusal naming a card field, or a card that never prints, reads red. The founding runbook's X0 readiness red
 * cites this row.
 *
 *   found    `vessel found --hearth --name …` (a staged root with genesis): the chair's card, charter standing.
 *   place    `vessel found` then `vessel rotate --cold-key <place card>`: the place's card, then its replacement.
 *   charter  `nexus seal seat` over three standing chairs, then `seal rotate --face 0 --cold-key <cards>`, then
 *            `seal cold rehearse --face 0 --cold-key <cards>` (a rehearsal prints no new card and moves nothing).
 */
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { cpSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { cmdNexus } from "../src/commands/nexus.js";
import { cmdVessel } from "../src/commands/vessel.js";
import type { ParsedArgs } from "../src/parse-args.js";
import { generateOrLoadPersonaGroupRoot, makeNodePersonaDeclarationStore, makeNodePersonaPetnameStore } from "@lararium/node";
import { renameOwnPersona, standForKahuSeat } from "@lararium/mesh";
import { seatScratchCustody, type ScratchCustody } from "./support/scratch-custody.js";

vi.setConfig({ testTimeout: 120_000, hookTimeout: 120_000 });

const ROW = /^(?:[0-9a-f]{4}-){5}[0-9a-f]{4}$/;

/** Everything one verb put on the terminal, stdout and the console alike, in order. */
interface Shown { readonly code: number; readonly lines: string[]; readonly answer: Record<string, any> }
async function show(run: () => Promise<number>): Promise<Shown> {
  const lines: string[] = [];
  const push = (chunk: unknown): void => { for (const l of String(chunk).split("\n")) if (l.length > 0) lines.push(l); };
  const write = vi.spyOn(process.stdout, "write").mockImplementation((chunk: unknown) => { push(chunk); return true; });
  const log = vi.spyOn(console, "log").mockImplementation((...a: unknown[]) => push(a.map(String).join(" ")));
  const err = vi.spyOn(console, "error").mockImplementation((...a: unknown[]) => push(a.map(String).join(" ")));
  try {
    const code = await run();
    const json = lines.filter((l) => l.trim().startsWith("{")).at(-1);
    return { code, lines, answer: json ? JSON.parse(json) : {} };
  } finally { write.mockRestore(); log.mockRestore(); err.mockRestore(); }
}
/** The cards a run showed: each header with the indented lines under it. */
function cardsShown(s: Shown): Array<{ chair: string; fields: string[]; rows: string[]; confirm: string | undefined }> {
  const cards: Array<{ chair: string; fields: string[]; rows: string[]; confirm: string | undefined }> = [];
  for (const raw of s.lines) {
    const header = /^── cold-key card · (.+) ──$/.exec(raw);
    if (header) { cards.push({ chair: header[1]!, fields: [], rows: [], confirm: undefined }); continue; }
    const card = cards.at(-1);
    if (!card || !raw.startsWith("  ")) continue;
    const line = raw.trim();
    if (ROW.test(line)) card.rows.push(line);
    else if (line.startsWith("confirm: ")) card.confirm = line.slice("confirm: ".length);
    else if (/^[a-z]+: /.test(line)) card.fields.push(line.slice(0, line.indexOf(":")));
  }
  return cards;
}
/** A card a person could copy: the fields it holds, three code rows, a confirm phrase; no refusal in the run. */
function expectCardStands(s: Shown, charterStands: boolean, context: string): string[] {
  expect(s.lines.join("\n"), context).not.toMatch(/cold-key-card-field-/);
  expect(s.code, `${context}: ${s.lines.join(" | ")}`).toBe(0);
  const cards = cardsShown(s);
  expect(cards.length, `${context}: no card printed`).toBeGreaterThan(0);
  for (const card of cards) {
    expect(card.fields.slice(0, 3), context).toEqual(["purpose", "chair", "generation"]);
    expect(card.fields.includes("charter"), `${context}: charter line`).toBe(charterStands);
    expect(card.rows, context).toHaveLength(3);
    expect(card.confirm, context).toMatch(/^[a-z]+-[a-z]+-[a-z]+$/);
  }
  return cards.map((c) => c.rows.join("-"));
}

describe("every cold-key card verb prints its card on the terminal road (staged root, read-back stands in)", () => {
  let root: string;
  let prior: string | undefined;
  let custody: ScratchCustody | undefined;
  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "lares-card-print-"));
    prior = process.env["LAR_ROOT"];
    process.env["LAR_ROOT"] = root;
    writeFileSync(join(root, ".lar-test-scratch"), "");
  });
  afterEach(async () => {
    await custody?.drop(); custody = undefined;
    vi.restoreAllMocks();
    if (prior === undefined) delete process.env["LAR_ROOT"]; else process.env["LAR_ROOT"] = prior;
    rmSync(root, { recursive: true, force: true });
  });
  const vessel = (positional: string[], options: Record<string, string> = {}, flags: Record<string, boolean> = {}): ParsedArgs =>
    ({ command: "vessel", positional, options, flags });
  const seal = (positional: string[], options: Record<string, string> = {}): ParsedArgs =>
    ({ command: "nexus", positional: ["seal", ...positional], options, flags: {} });

  test("found: `vessel found --hearth` prints the chair's card with its charter line", async () => {
    cpSync(join(import.meta.dirname, "..", "..", "..", "genesis"), join(root, "genesis"), { recursive: true });
    const shown = await show(() => cmdVessel(vessel(["found"], { name: "keeper" }, { hearth: true })));
    expectCardStands(shown, true, "found --hearth");
  });

  test("place: `vessel found` prints the place's card, and `vessel rotate` prints its replacement", async () => {
    cpSync(join(import.meta.dirname, "..", "..", "..", "genesis"), join(root, "genesis"), { recursive: true });
    const founded = await show(() => cmdVessel(vessel(["found"])));
    expect(founded.code, founded.lines.join(" | ")).toBe(0);
    const placeRows = founded.lines.map((l) => l.trim()).filter((l) => ROW.test(l));
    expect(placeRows, "the place card's three code rows").toHaveLength(3);
    const rotated = await show(() => cmdVessel(vessel(["rotate"], { "cold-key": placeRows.join("-") })));
    expect(rotated.code, rotated.lines.join(" | ")).toBe(0);
    expect(rotated.lines.join("\n")).not.toMatch(/cold-key-card-field-/);
    const replacement = rotated.lines.map((l) => l.trim()).filter((l) => ROW.test(l));
    expect(replacement, "the replacement card's three code rows").toHaveLength(3);
    expect(replacement.join("-")).not.toBe(placeRows.join("-"));
  });

  test("charter: `seal seat` prints three chairs' cards, `seal rotate` the rolled three, `seal cold rehearse` none", async () => {
    custody = await seatScratchCustody();
    const petnames = await makeNodePersonaPetnameStore(); const declarations = await makeNodePersonaDeclarationStore();
    for (let i = 0; i < 3; i++) { await generateOrLoadPersonaGroupRoot(i); await renameOwnPersona(petnames, i, `veil-${i}`); await standForKahuSeat(declarations, i, true, `Chair ${i}`); }
    const seated = await show(() => cmdNexus(seal(["seat"])));
    const seatCodes = expectCardStands(seated, true, "seal seat");
    expect(seatCodes).toHaveLength(3);
    const rolled = await show(() => cmdNexus(seal(["rotate"], { "cold-key": seatCodes.join(","), face: "0" })));
    const rolledCodes = expectCardStands(rolled, true, "seal rotate");
    expect(rolledCodes).toHaveLength(3);
    expect(new Set(rolledCodes).size).toBe(3);
    const rehearsed = await show(() => cmdNexus(seal(["cold", "rehearse"], { "cold-key": rolledCodes.join(","), face: "0" })));
    expect(rehearsed.code, rehearsed.lines.join(" | ")).toBe(0);
    expect(cardsShown(rehearsed), "a rehearsal mints no card").toHaveLength(0);
  });
});
