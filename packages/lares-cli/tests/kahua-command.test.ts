/**
 * `lares kahua` — the operator's door onto a face's kahua stage: mint the pin, propose, stage, lift and withdraw by hand,
 * read.
 *
 * Each act reaches the store door's matching row (`kahua-mint`, `kahua-propose`, `kahua-stage`, `kahua-lift`,
 * `kahua-withdraw`, `kahua-read`) with the arguments the row reads, and prints the row's answer as JSON. A malformed ask
 * refuses before the door. A LIFT HAS EYES: it reads the staged row's preview first and lifts only on its digest, typed
 * back at a terminal or named by `--digest`; a bare `--yes` lifts nothing. Meme: lar:///ha.ka.ba/lares/docs/pono/kahua-memory-stage
 */
import { beforeEach, describe, expect, test, vi } from "vitest";

const seam = vi.hoisted(() => ({ calls: [] as Array<[string, Record<string, unknown>]>, output: {} as Record<string, unknown>, preview: {} as Record<string, unknown>, refuse: null as string | null }));
vi.mock("../src/store-door.js", () => ({
  storeVerb: async (verb: string, args: Record<string, unknown>) => {
    seam.calls.push([verb, args]);
    if (seam.refuse && verb === "kahua-lift") throw new Error(seam.refuse);
    return { output: verb === "kahua-read" && args["action"] === "staged" ? seam.preview : seam.output };
  },
  StoreDoorRefusal: class extends Error {},
}));

import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { cmdKahua } from "../src/commands/kahua.js";
import { helpLines } from "../src/command-help.js";
import { parseArgs } from "../src/parse-args.js";

const run = (...argv: string[]) => cmdKahua(parseArgs(["kahua", ...argv]), null);
const CID = "c".repeat(64);
const DIGEST = "abcd1234" + "e".repeat(56);
const SOURCES = JSON.stringify([{ title: "daemon/T", revision: "r1" }]);
const STAGED_READ = ["kahua-read", { action: "staged", title: "T" }] as const;

describe("lares kahua", () => {
  let lines: string[];
  beforeEach(() => {
    seam.calls = []; seam.output = { cid: CID, parent: null }; lines = [];
    seam.preview = { title: "T", digest: DIGEST, relation: "6f1c2b9e-4d3a-4e5f-8a7b-0c1d2e3f4a5b", text: "body", fields: {}, heads: [] };
    vi.spyOn(console, "log").mockImplementation((line: unknown) => { lines.push(String(line)); });
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  test("RED: a lift reads the staged row's preview, then reaches the lift row with the digest it names, its taint list and sources, and prints the row's answer as JSON", async () => {
    expect(await run("lift", "T", "--face", "1", "--digest", DIGEST, "--taint", "web:example,tool:search", "--sources", SOURCES)).toBe(0);
    expect(seam.calls).toEqual([["kahua-read", { face: 1, action: "staged", title: "T" }], ["kahua-lift", { face: 1, title: "T", digest: DIGEST, taint: ["web:example", "tool:search"], sources: [{ title: "daemon/T", revision: "r1" }] }]]);
    expect(JSON.parse(lines.join("\n"))).toEqual({ cid: CID, parent: null });
  });

  test("RED: lift with eyes: no digest named and no terminal lifts nothing, a bare --yes lifts nothing, and a digest other than the preview's refuses moved; CONTROL: the preview's digest lifts", async () => {
    expect(await run("lift", "T", "--taint", "none")).toBe(1);
    expect(await run("lift", "T", "--taint", "none", "--yes")).toBe(1);
    expect(await run("lift", "T", "--taint", "none", "--digest", "f".repeat(64))).toBe(1);
    expect(seam.calls).toEqual([STAGED_READ, STAGED_READ, STAGED_READ]);
    expect(await run("lift", "T", "--taint", "none", "--digest", DIGEST)).toBe(0);
    expect(seam.calls.at(-1)).toEqual(["kahua-lift", { title: "T", digest: DIGEST, taint: [] }]);
  });

  test("RED: the lift's texts name the ROW digest apart from a proposal's BODY digest, and say a lift always asks the face's passphrase at a terminal", async () => {
    const errs: string[] = [];
    vi.spyOn(console, "error").mockImplementation((line: unknown) => { errs.push(String(line)); });
    // The preview labels its digest as the row's; the unconfirmed refusal says what --digest spares and what it never spares.
    expect(await run("lift", "T", "--taint", "none")).toBe(1);
    expect(errs.join("\n")).toMatch(/^  row digest  abcd1234/m);
    expect(errs.join("\n")).toMatch(/kahua-lift-unconfirmed:.*--digest <hex>.*spares the typed-back digest alone.*passphrase at a terminal/);
    // A ward refusal on a lift that named --digest says the same: the passphrase still comes from a terminal.
    errs.length = 0;
    seam.refuse = "ward-needs-tty: kahua-lift is a ward act; its route comes from a person at a terminal";
    expect(await run("lift", "T", "--taint", "none", "--digest", DIGEST)).toBe(1);
    expect(errs.join("\n")).toMatch(/ward-needs-tty.*\n.*a lift always asks the face's passphrase at a terminal; `--digest` names the preview's row digest in place of typing it back, and spares nothing else/);
    seam.refuse = null;
    // The help says both, and names the two digests apart.
    const help = helpLines("kahua").join("\n");
    expect(help).toMatch(/row digest/);
    expect(help).toMatch(/body digest/);
    expect(help).toMatch(/a lift always asks the face's passphrase at a terminal/);
    // CONTROL: a stage answer names its digest as the row's on stderr, and the JSON on stdout stays the door's own answer.
    errs.length = 0;
    seam.output = { title: "T", digest: DIGEST, staged: true };
    expect(await run("stage", "T", "--text", "body")).toBe(0);
    expect(JSON.parse(lines.at(-1)!)).toEqual(seam.output);
    expect(errs.join("\n")).toMatch(/row digest.*body and fields.*A proposal's `digest` names the body digest/);
  });

  test("RED: at a terminal the person types the digest back: a wrong prefix lifts nothing; CONTROL: the first eight hex lift", async () => {
    expect(await cmdKahua(parseArgs(["kahua", "lift", "T", "--taint", "none"]), async () => "00000000")).toBe(1);
    expect(seam.calls).toEqual([STAGED_READ]);
    expect(await cmdKahua(parseArgs(["kahua", "lift", "T", "--taint", "none"]), async () => "abcd1234")).toBe(0);
    expect(seam.calls.at(-1)).toEqual(["kahua-lift", { title: "T", digest: DIGEST, taint: [] }]);
  });

  test("RED: a lift carries no body or fields from the hand (stage them first); `--taint none` names an empty taint list, `--parent none` a first lift, and a proposal rides by id; CONTROL: a lift naming no taint refuses before the door", async () => {
    expect(await run("lift", "T", "--digest", DIGEST)).toBe(1);
    expect(await run("lift", "T", "--text", "body", "--taint", "none", "--digest", DIGEST)).toBe(1);
    expect(await run("lift", "T", "--taint", "none", "--digest", DIGEST, "--fields", "{\"tags\":\"a b\"}")).toBe(1);
    expect(seam.calls).toEqual([]);
    expect(await run("lift", "T", "--digest", DIGEST, "--taint", "none", "--parent", "none", "--proposal", "p".repeat(8))).toBe(0);
    expect(seam.calls[1]).toEqual(["kahua-lift", { title: "T", digest: DIGEST, taint: [], parent: null, proposal: "p".repeat(8) }]);
  });

  test("RED: stage reaches the stage row with the row's body (--text or --file) and fields; CONTROL: neither or both refuse before the door", async () => {
    expect(await run("stage", "T", "--face", "1", "--text", "body", "--fields", "{\"tags\":\"a b\"}")).toBe(0);
    const file = join(mkdtempSync(join(tmpdir(), "lar-kahua-stage-")), "body.tid");
    writeFileSync(file, "from a file", "utf8");
    expect(await run("stage", "T", "--file", file)).toBe(0);
    expect(seam.calls).toEqual([["kahua-stage", { face: 1, title: "T", text: "body", fields: { tags: "a b" } }], ["kahua-stage", { title: "T", text: "from a file" }]]);
    seam.calls = [];
    expect(await run("stage", "T")).toBe(1);
    expect(await run("stage", "T", "--text", "a", "--file", file)).toBe(1);
    expect(seam.calls).toEqual([]);
  });

  test("RED: mint, propose, withdraw, list and get reach their rows; CONTROL: malformed JSON and a bare act refuse before the door", async () => {
    expect(await run("mint", "--face", "0")).toBe(0);
    const proposals = [{ title: "T", revision: "r1", text: "body", taint: [] }];
    expect(await run("propose", "--proposals", JSON.stringify(proposals))).toBe(0);
    expect(await run("withdraw", CID)).toBe(0);
    expect(await run("list")).toBe(0);
    expect(await run("get", "T", "--history")).toBe(0);
    expect(seam.calls).toEqual([
      ["kahua-mint", { face: 0 }],
      ["kahua-propose", { proposals }],
      ["kahua-withdraw", { target: CID }],
      ["kahua-read", { action: "list" }],
      ["kahua-read", { action: "get", title: "T", history: true }],
    ]);
    seam.calls = [];
    expect(await run("propose", "--proposals", "{not json")).toBe(1);
    expect(await run("withdraw")).toBe(1);
    expect(await run("get")).toBe(1);
    expect(await run("burn")).toBe(2);   // an unknown act answers the usage refusal
    expect(await run("lift", "T", "--taint", "none", "--sources", "[oops")).toBe(1);
    expect(seam.calls).toEqual([]);
  });

  test("RED: `carry` reaches the carry row with the cids it names, or `--all` for every earlier head; CONTROL: a carry naming neither, or both, refuses before the door", async () => {
    const CID2 = "d".repeat(64);
    expect(await run("carry", CID, CID2, "--face", "1")).toBe(0);
    expect(await run("carry", "--all")).toBe(0);
    expect(seam.calls).toEqual([["kahua-carry", { face: 1, cids: [CID, CID2] }], ["kahua-carry", { all: true }]]);
    seam.calls = [];
    expect(await run("carry")).toBe(1);
    expect(await run("carry", CID, "--all")).toBe(1);
    expect(seam.calls).toEqual([]);
  });
});
