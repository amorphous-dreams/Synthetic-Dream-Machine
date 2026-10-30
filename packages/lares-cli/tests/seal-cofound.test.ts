/**
 * seal-cofound — `lares nexus seal cofound open|join|seal` walks the two-founder act across two vaults, carrying
 * files alone. Each vault stands on its own staged scratch root with its own custody; the suite switches `LAR_ROOT`
 * between them, and every file crosses through the disk.
 *
 *   C1  THE WALK: A opens with a release manifest, B joins typing A's seat fingerprint as heard, A seals typing B's,
 *       B files the inception. Both answer one AID, both carried charters read it, both seeds stand byte-identical.
 *   C2  RED: the verbs refuse before anything moves: no release manifest, no `--out`, no fingerprint typed off a
 *       terminal, a misheard fingerprint, a file of the wrong kind; CONTROL: C1.
 *   C3  THE TERMINAL ROAD (W8): without `--json` on a staged root (the read-back stands in), `open` prints its
 *       cold-key card and writes the offer. A fresh joint Nexus holds no charter at `open`, so the card names the
 *       three fields the chair holds (purpose, chair, generation) and no charter line (`cold-key-card.ts`: a caller
 *       holding no charter fingerprint names the three it holds). CONTROL: `join` prints its card the same way;
 *       the JSON road (C1) carries the staged code and prints no card line.
 */
import { afterEach, describe, expect, test, vi } from "vitest";
import { createHash } from "node:crypto";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { cmdNexus } from "../src/commands/nexus.js";
import type { ParsedArgs } from "../src/parse-args.js";
import { larSealHome } from "../src/env.js";
import { carriedCharterHome, generateOrLoadPersonaGroupRoot, listSeatKeys, readFaceIndexSync, readNexusDoc } from "@lararium/node";
import { cidV1Sha256, cidV1Sha256FromHex, offerFingerprint, readFckCarrier, seatFingerprint, type CofoundOffer } from "@lararium/mesh";
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
  const root = mkdtempSync(join(tmpdir(), `lares-cofound-${label}-`));
  process.env["LAR_ROOT"] = root;
  const custody = await seatScratchCustody();
  await generateOrLoadPersonaGroupRoot(0);
  const v = { root, custody };
  vaults.push(v);
  return v;
}
const at = (v: Vault): void => { process.env["LAR_ROOT"] = v.root; };
const faceRow = (v: Vault, file: string): string => {
  const face = readFaceIndexSync(v.custody.homes.identity).faces[0];
  if (!face || !("fcid" in face)) throw new Error("founding face h0 does not stand");
  return join(v.custody.homes.identity, "faces", face.fcid, file);
};
const expectFoundingRows = (v: Vault, fingerprint: string, verifyingKey: string): void => {
  expect(readFckCarrier(readFileSync(faceRow(v, `cofound-h0-${fingerprint}.json`)))).toBe("sealed");
  const keyName = createHash("sha256").update(`cadence-key\n${verifyingKey.toLowerCase()}`).digest("hex").slice(0, 32);
  expect(readFckCarrier(readFileSync(faceRow(v, `cadence-key-h0-${keyName}.bin`)))).toBe("sealed");
};

const nexus = (positional: string[], options: Record<string, string> = {}, flags: Record<string, boolean> = { json: true }): ParsedArgs =>
  ({ command: "nexus", positional: ["seal", "cofound", ...positional], options: { face: "0", ...options }, flags } as unknown as ParsedArgs);
async function run(a: ParsedArgs): Promise<{ code: number; out: Record<string, any>; lines: string[]; said: string[] }> {
  const lines: string[] = [];
  const said: string[] = [];
  vi.spyOn(console, "log").mockImplementation((...parts: unknown[]) => { said.push(parts.map(String).join(" ")); });
  vi.spyOn(console, "error").mockImplementation((...parts: unknown[]) => { said.push(parts.map(String).join(" ")); });
  const write = vi.spyOn(process.stdout, "write").mockImplementation((chunk: unknown) => { lines.push(String(chunk)); return true; });
  const err = vi.spyOn(process.stderr, "write").mockImplementation((chunk: unknown) => { said.push(String(chunk)); return true; });
  try { const code = await cmdNexus(a); const json = lines.find((l) => l.trim().startsWith("{")); return { code, out: json ? JSON.parse(json) : {}, lines, said }; }
  finally { write.mockRestore(); err.mockRestore(); }
}
/** The card lines a run printed on the terminal road: the header and every indented line under it. */
const cardLines = (r: { lines: string[] }): string[] => r.lines.map((l) => l.replace(/\n$/, "")).filter((l) => l.startsWith("── cold-key card") || l.startsWith("  "));

describe("lares nexus seal cofound", () => {
  test("C1 — open, join, seal, accept across two vaults: one AID, both seeds untouched", async () => {
    const A = await vault("a"), B = await vault("b");
    const courier = mkdtempSync(join(tmpdir(), "lares-cofound-courier-"));
    try {
      const release = join(courier, "release.json"), offerPath = join(courier, "offer.json"), joinPath = join(courier, "join.json"), inceptionPath = join(courier, "inception.json");
      writeFileSync(release, JSON.stringify(RELEASE));
      at(A);
      const opened = await run(nexus(["open"], { release, out: offerPath }));
      expect(opened.code, JSON.stringify(opened.out)).toBe(0);
      const aSeat = opened.out["data"]["seat"] as string;
      expect(opened.out["data"]["cards"]).toHaveLength(1);
      const offer = JSON.parse(readFileSync(offerPath, "utf8")) as CofoundOffer;
      expect(offer.manifest.genesis).toBe(cidV1Sha256FromHex(seedHex));
      const fingerprint = offerFingerprint(offer);
      expectFoundingRows(A, fingerprint, offer.cadence.key);

      at(B);
      const joined = await run(nexus(["join", offerPath], { out: joinPath, heard: seatFingerprint(aSeat) }));
      expect(joined.code, JSON.stringify(joined.out)).toBe(0);
      const bSeat = joined.out["data"]["seat"] as string;
      const aid = joined.out["data"]["aid"] as string;
      const joinedFile = JSON.parse(readFileSync(joinPath, "utf8")) as { cadence: { key: string } };
      expectFoundingRows(B, fingerprint, joinedFile.cadence.key);

      at(A);
      const sealed = await run(nexus(["seal", joinPath], { out: inceptionPath, heard: seatFingerprint(bSeat) }));
      expect(sealed.code, JSON.stringify(sealed.out)).toBe(0);
      expect(sealed.out["data"]["aid"]).toBe(aid);

      at(B);
      const accepted = await run(nexus(["seal", inceptionPath]));
      expect(accepted.code, JSON.stringify(accepted.out)).toBe(0);
      expect(accepted.out["data"]["aid"]).toBe(aid);

      for (const v of [A, B]) {
        at(v);
        expect(readNexusDoc(carriedCharterHome(larSealHome(), aid))?.sealEpochCid).toBe(aid);
        expect(existsSync(join(larSealHome(), "founding-roster.mem"))).toBe(false);
      }
    } finally { rmSync(courier, { recursive: true, force: true }); }
  });

  test("C2 — each verb refuses before anything moves", async () => {
    const A = await vault("c2a"), B = await vault("c2b");
    const courier = mkdtempSync(join(tmpdir(), "lares-cofound-courier-"));
    try {
      const release = join(courier, "release.json"), offerPath = join(courier, "offer.json"), joinPath = join(courier, "join.json");
      writeFileSync(release, JSON.stringify(RELEASE));
      at(A);
      expect((await run(nexus(["open"], { out: offerPath }))).out["error"]["message"]).toMatch(/--release/);
      expect((await run(nexus(["open"], { release }))).out["error"]["message"]).toMatch(/--out/);
      writeFileSync(join(courier, "bad-release.json"), JSON.stringify({ ...RELEASE, format: "another" }));
      expect((await run(nexus(["open"], { release: join(courier, "bad-release.json"), out: offerPath }))).out["error"]["message"]).toMatch(/no release manifest/);
      expect(listSeatKeys()).toHaveLength(0);
      const opened = await run(nexus(["open"], { release, out: offerPath }));
      const aSeat = opened.out["data"]["seat"] as string;

      at(B);
      const before = listSeatKeys().length;
      expect((await run(nexus(["join", offerPath], { out: joinPath }))).out["error"]["message"]).toMatch(/--heard/);
      expect((await run(nexus(["join", offerPath], { out: joinPath, heard: "0000-1111" }))).out["error"]["message"]).toMatch(/as heard/);
      expect((await run(nexus(["join", release], { out: joinPath, heard: seatFingerprint(aSeat) }))).out["error"]["message"]).toMatch(/no cofound offer/);
      expect(listSeatKeys().length).toBe(before);
      const joined = await run(nexus(["join", offerPath], { out: joinPath, heard: seatFingerprint(aSeat) }));
      expect(joined.code).toBe(0);

      at(A);
      expect((await run(nexus(["seal", joinPath], { out: join(courier, "i.json"), heard: seatFingerprint(aSeat) }))).out["error"]["message"]).toMatch(/as heard/);
      expect((await run(nexus(["seal", offerPath], { out: join(courier, "i.json") }))).out["error"]["message"]).toMatch(/neither a cofound join nor/);
      expect(existsSync(join(courier, "i.json"))).toBe(false);
      expect((await run(nexus(["nonsense"]))).code).not.toBe(0);
    } finally { rmSync(courier, { recursive: true, force: true }); }
  });

  test("C3 — the terminal road: `open` prints its card (three fields, no charter line) and writes the offer; CONTROL: `join` prints its card; the JSON road prints none", async () => {
    const A = await vault("c3a"), B = await vault("c3b");
    const courier = mkdtempSync(join(tmpdir(), "lares-cofound-courier-"));
    try {
      const release = join(courier, "release.json"), offerPath = join(courier, "offer.json"), joinPath = join(courier, "join.json");
      writeFileSync(release, JSON.stringify(RELEASE));
      at(A);
      const opened = await run(nexus(["open"], { release, out: offerPath }, {}));
      expect({ code: opened.code, said: opened.said, lines: opened.lines }).toMatchObject({ code: 0 });
      const card = cardLines(opened);
      expect(card[0]).toBe("── cold-key card · your seat in the joint Nexus ──");
      expect(card.some((l) => /^  purpose: /.test(l))).toBe(true);
      expect(card.some((l) => /^  chair: your seat in the joint Nexus$/.test(l))).toBe(true);
      expect(card.some((l) => /^  generation: 1$/.test(l))).toBe(true);
      expect(card.some((l) => /^  charter: /.test(l)), "a fresh joint Nexus holds no charter at open").toBe(false);
      expect(card.filter((l) => /^  (?:[0-9a-f]{4}-){5}[0-9a-f]{4}$/.test(l)).length, "the code prints in rows of six groups").toBeGreaterThan(0);
      expect(card.some((l) => /^  confirm: /.test(l))).toBe(true);
      // The answer names the offer: as the human lines on a TTY, as the JSON answer where stdout is no TTY (this runner).
      expect(opened.said.some((l) => /cofound offer → /.test(l)) || opened.out["data"]?.["path"] === offerPath).toBe(true);
      expect(existsSync(offerPath)).toBe(true);
      const offer = JSON.parse(readFileSync(offerPath, "utf8")) as CofoundOffer;
      expectFoundingRows(A, offerFingerprint(offer), offer.cadence.key);
      // The answer carries the card's digest and confirm phrase (and, on a staged root alone, the staged code for the harness).
      expect(opened.out["data"]?.["cards"]?.[0]).toMatchObject({ chair: "your seat in the joint Nexus", confirm: expect.stringMatching(/^[a-z]+-[a-z]+-[a-z]+$/) });
      const aSeat = offer.seat;

      at(B);
      const joined = await run(nexus(["join", offerPath], { out: joinPath, heard: seatFingerprint(aSeat) }, {}));
      expect({ code: joined.code, said: joined.said }).toMatchObject({ code: 0 });
      const joinCard = cardLines(joined);
      expect(joinCard[0]).toBe("── cold-key card · your seat in the joint Nexus ──");
      expect(joinCard.some((l) => /^  confirm: /.test(l))).toBe(true);
      expect(joinCard.some((l) => /^  charter: /.test(l))).toBe(false);
      expect(existsSync(joinPath)).toBe(true);

      const C = await vault("c3c");
      at(C);
      const jsonOpened = await run(nexus(["open"], { release, out: join(courier, "offer-json.json") }));
      expect(jsonOpened.code).toBe(0);
      expect(cardLines(jsonOpened)).toHaveLength(0);
      expect(jsonOpened.out["data"]["cards"][0]["code"]).toMatch(/^(?:[0-9a-f]{4}-)+[0-9a-f]{4}$/);
    } finally { rmSync(courier, { recursive: true, force: true }); }
  });
});
