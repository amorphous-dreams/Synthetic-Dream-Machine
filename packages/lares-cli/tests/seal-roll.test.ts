/**
 * seal-roll — `lares nexus seal roll open|join|sign|file` rolls a joint Nexus across two vaults, carrying one circle
 * file alone. Founded by the cofound verbs; each vault stands on its own staged scratch root and custody.
 *
 *   L1  THE WALK: A opens with its cold card, B joins with its card, B and A sign, both file. Both carried charters
 *       read one new head, and each answer prints the fresh successor card.
 *   L2  RED: the verbs refuse before anything moves: no --nexus, no --threshold, no --out, --out naming the input,
 *       a file of the wrong kind, a card typed off a staged root; CONTROL: L1.
 */
import { afterEach, describe, expect, test, vi } from "vitest";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { cmdNexus } from "../src/commands/nexus.js";
import type { ParsedArgs } from "../src/parse-args.js";
import { larSealHome } from "../src/env.js";
import { carriedCharterHome, generateOrLoadPersonaGroupRoot, listSeatKeys, readNexusDoc } from "@lararium/node";
import { cidV1Sha256, cidV1Sha256FromHex, seatFingerprint } from "@lararium/mesh";
import { seatScratchCustody, type ScratchCustody } from "./support/scratch-custody.js";

vi.setConfig({ testTimeout: 120_000, hookTimeout: 120_000 });

const cidOf = (text: string): string => cidV1Sha256(new TextEncoder().encode(text));
const seedHex = "5e".repeat(32);
const RELEASE = {
  format: "lararium-release-manifest/v1",
  image: { digest: `sha256:${"ab".repeat(32)}`, platforms: ["linux/amd64"] },
  genesis: { seedCid: seedHex }, engine: { cid: cidOf("engine") }, grammar: { cid: cidOf("grammar") },
};

interface Vault { readonly root: string; readonly custody: ScratchCustody }
const vaults: Vault[] = [];
let prior: string | undefined;
afterEach(async () => {
  for (const v of vaults.splice(0).reverse()) { process.env["LAR_ROOT"] = v.root; await v.custody.drop(); rmSync(v.root, { recursive: true, force: true }); }
  if (prior === undefined) delete process.env["LAR_ROOT"]; else process.env["LAR_ROOT"] = prior;
  vi.restoreAllMocks();
});

async function vault(label: string): Promise<Vault> {
  if (vaults.length === 0) prior = process.env["LAR_ROOT"];
  const root = mkdtempSync(join(tmpdir(), `lares-roll-${label}-`));
  process.env["LAR_ROOT"] = root;
  const custody = await seatScratchCustody();
  await generateOrLoadPersonaGroupRoot(0);
  const v = { root, custody };
  vaults.push(v);
  return v;
}
const at = (v: Vault): void => { process.env["LAR_ROOT"] = v.root; };

const nexus = (positional: string[], options: Record<string, string> = {}, flags: Record<string, boolean> = {}): ParsedArgs =>
  ({ command: "nexus", positional: ["seal", ...positional], options: { face: "0", ...options }, flags: { json: true, ...flags } } as unknown as ParsedArgs);
async function run(a: ParsedArgs): Promise<{ code: number; out: Record<string, any> }> {
  const lines: string[] = [];
  vi.spyOn(console, "log").mockImplementation(() => {}); vi.spyOn(console, "error").mockImplementation(() => {});
  const write = vi.spyOn(process.stdout, "write").mockImplementation((chunk: unknown) => { lines.push(String(chunk)); return true; });
  try { const code = await cmdNexus(a); const json = lines.find((l) => l.trim().startsWith("{")); return { code, out: json ? JSON.parse(json) : {} }; }
  finally { write.mockRestore(); }
}
const cofound = (step: string[], options: Record<string, string> = {}) => run(nexus(["cofound", ...step], options));
const roll = (step: string[], options: Record<string, string> = {}, flags: Record<string, boolean> = {}) => run(nexus(["roll", ...step], options, flags));
const anchor = (options: Record<string, string>) => run(nexus(["anchor"], options));

/** Found the joint Nexus across two vaults, keeping each founder's cold card code from the JSON answers. */
async function found(courier: string): Promise<{ A: Vault; B: Vault; aid: string; aCode: string; bCode: string }> {
  const A = await vault("a"), B = await vault("b");
  const release = join(courier, "release.json"), offerPath = join(courier, "offer.json"), joinPath = join(courier, "join.json"), inceptionPath = join(courier, "inception.json");
  writeFileSync(release, JSON.stringify(RELEASE));
  at(A);
  const opened = await cofound(["open"], { release, out: offerPath });
  expect(opened.code, JSON.stringify(opened.out)).toBe(0);
  const aCode = opened.out["data"]["cards"][0]["code"] as string;
  at(B);
  const joined = await cofound(["join", offerPath], { out: joinPath, heard: seatFingerprint(opened.out["data"]["seat"]) });
  expect(joined.code, JSON.stringify(joined.out)).toBe(0);
  const bCode = joined.out["data"]["cards"][0]["code"] as string;
  at(A);
  const sealed = await cofound(["seal", joinPath], { out: inceptionPath, heard: seatFingerprint(joined.out["data"]["seat"]) });
  expect(sealed.code, JSON.stringify(sealed.out)).toBe(0);
  at(B);
  expect((await cofound(["seal", inceptionPath])).code).toBe(0);
  return { A, B, aid: joined.out["data"]["aid"] as string, aCode, bCode };
}
const head = (v: Vault, aid: string) => { at(v); return readNexusDoc(carriedCharterHome(larSealHome(), aid))?.sealEpochCid; };

describe("lares nexus seal roll", () => {
  test("L1 — open, join, sign, sign, file, file across two vaults: both charters read one new head", async () => {
    const courier = mkdtempSync(join(tmpdir(), "lares-roll-courier-"));
    try {
      const { A, B, aid, aCode, bCode } = await found(courier);
      const head0 = head(A, aid);
      expect(head(B, aid)).toBe(head0);
      const c1 = join(courier, "c1.json"), c2 = join(courier, "c2.json"), c3 = join(courier, "c3.json"), c4 = join(courier, "c4.json");

      at(A);
      const opened = await roll(["open"], { nexus: aid, threshold: "2", "cold-key": aCode, out: c1 });
      expect(opened.code, JSON.stringify(opened.out)).toBe(0);
      expect(opened.out["data"]["verdict"]).toBe("ready");
      expect(opened.out["data"]["cards"]).toHaveLength(1);
      at(B);
      const joined = await roll(["join", c1], { "cold-key": bCode, out: c2 });
      expect(joined.code, JSON.stringify(joined.out)).toBe(0);
      expect(JSON.parse(readFileSync(c2, "utf8"))["chairs"]).toHaveLength(2);
      // Each signer types what it heard: the rule, and the other chair's seat fingerprint.
      const aSeat = (JSON.parse(readFileSync(c1, "utf8"))["chairs"] as Array<{ seat: string }>)[0]!.seat;
      const bSeat = (JSON.parse(readFileSync(c2, "utf8"))["chairs"] as Array<{ seat: string }>).find((c) => c.seat !== aSeat)!.seat;
      expect((await roll(["sign", c2], { out: c3 })).out["error"]["message"]).toMatch(/--heard-threshold <n> --heard/);
      expect((await roll(["sign", c2], { out: c3, "heard-threshold": "2", heard: seatFingerprint(bSeat) })).out["error"]["message"]).toMatch(/type every other chair's seat fingerprint/);
      const bSigned = await roll(["sign", c2], { out: c3, "heard-threshold": "2", heard: seatFingerprint(aSeat) });
      expect(bSigned.code, JSON.stringify(bSigned.out)).toBe(0);
      expect(bSigned.out["data"]["verdict"]).toBe("ready");
      at(A);
      const aSigned = await roll(["sign", c3], { out: c4, "heard-threshold": "2", heard: seatFingerprint(bSeat) });
      expect(aSigned.out["data"]["verdict"]).toBe("complete");

      for (const v of [A, B]) {
        at(v);
        const filed = await roll(["file", c4]);
        expect(filed.code, JSON.stringify(filed.out)).toBe(0);
        expect(filed.out["data"]["outcome"]).toBe("extended");
        expect(filed.out["data"]["aid"]).toBe(aid);
      }
      const newHead = head(A, aid);
      expect(newHead).not.toBe(head0);
      expect(head(B, aid)).toBe(newHead);
      // Filed, no circle stands open here: abandon moves nothing.
      expect((await roll(["abandon"], { nexus: aid })).out["data"]).toMatchObject({ abandoned: false, retired: [] });

      // A ROLL WAITS ON ITS PRIOR ANCHOR: the filed head stands with no anchor, so a next circle refuses by name
      // on either vault, before any card reads and with no circle file written.
      const c5 = join(courier, "c5.json");
      const aNext = opened.out["data"]["cards"][0]["code"] as string;
      at(A);
      const seats = listSeatKeys().length;
      const waits = await roll(["open"], { nexus: aid, threshold: "2", "cold-key": aNext, out: c5 });
      expect(waits.code).not.toBe(0);
      expect(waits.out["error"]["message"]).toMatch(/prior-roll-unanchored/);
      expect(existsSync(c5)).toBe(false);
      expect(listSeatKeys().length).toBe(seats);
    } finally { rmSync(courier, { recursive: true, force: true }); }
  });

  test("L2 — each verb refuses before anything moves", async () => {
    const courier = mkdtempSync(join(tmpdir(), "lares-roll-courier-"));
    try {
      const { A, B, aid, aCode, bCode } = await found(courier);
      const c1 = join(courier, "c1.json"), c2 = join(courier, "c2.json");
      const msg = (r: { out: Record<string, any> }): string => r.out["error"]?.["message"] ?? "ran";
      at(A);
      const seats = listSeatKeys().length;
      expect(msg(await roll(["open"], { threshold: "2", "cold-key": aCode, out: c1 }))).toMatch(/--nexus/);
      expect(msg(await roll(["open"], { nexus: aid, "cold-key": aCode, out: c1 }))).toMatch(/--threshold/);
      expect(msg(await roll(["open"], { nexus: aid, threshold: "2", "cold-key": aCode }))).toMatch(/--out/);
      expect(msg(await roll(["open"], { nexus: aid, threshold: "2", out: c1 }))).toMatch(/cold-key|terminal/);
      expect(msg(await roll(["open"], { nexus: aid, threshold: "2", "cold-key": `${aCode},${aCode}`, out: c1 }))).toMatch(/one/);
      expect(existsSync(c1)).toBe(false);
      expect(listSeatKeys().length).toBe(seats);

      const opened = await roll(["open"], { nexus: aid, threshold: "2", "cold-key": aCode, out: c1 });
      expect(opened.code, JSON.stringify(opened.out)).toBe(0);
      at(B);
      expect(msg(await roll(["join", c1], { "cold-key": bCode, out: c1 }))).toMatch(/--out names the input/);
      expect(msg(await roll(["join", c1], { "cold-key": bCode }))).toMatch(/--out/);
      expect(msg(await roll(["sign", c1], { out: c1 }))).toMatch(/--out names the input/);
      expect(msg(await roll(["sign", c1]))).toMatch(/--out/);
      writeFileSync(join(courier, "offer.json"), JSON.stringify({ kind: "another" }));
      for (const step of ["join", "sign", "file"]) {
        expect(msg(await roll([step, join(courier, "offer.json")], { "cold-key": bCode, out: c2 }))).toMatch(/no roll circle/);
      }
      expect(existsSync(c2)).toBe(false);
      // CONTROL: the same join, honestly asked, runs.
      expect((await roll(["join", c1], { "cold-key": bCode, out: c2 })).code).toBe(0);
      expect((await roll(["nonsense"])).code).not.toBe(0);
    } finally { rmSync(courier, { recursive: true, force: true }); }
  });

  test("L3 — `seal anchor` refuses an --out its write could not take, and a missing file, before any act runs", async () => {
    const courier = mkdtempSync(join(tmpdir(), "lares-anchor-courier-"));
    try {
      await vault("anc");
      const p1 = join(courier, "p1.json");
      writeFileSync(p1, "{}");
      expect((await anchor({ out: join(courier, "no-such-dir", "p.json") })).out["error"]["message"]).toMatch(/its directory does not exist/);
      expect((await anchor({ out: courier })).out["error"]["message"]).toMatch(/names a directory/);
      expect((await anchor({ from: p1, out: p1 })).out["error"]["message"]).toMatch(/--out names the partial you carried/);
      expect((await anchor({ from: join(courier, "absent.json") })).out["error"]["message"]).toMatch(/cannot read .* as a partial file/);
      // CONTROL: a carried file that reads as no partial reaches the door, which names it.
      expect((await anchor({ from: p1 })).out["error"]["message"]).toMatch(/reads as no roll-anchor partial/);
    } finally { rmSync(courier, { recursive: true, force: true }); }
  });
});
