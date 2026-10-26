/**
 * seal-cofound — `lares nexus seal cofound open|join|seal` walks the two-founder act across two vaults, carrying
 * files alone. Each vault stands on its own staged scratch root with its own custody; the suite switches `LAR_ROOT`
 * between them, and every file crosses through the disk.
 *
 *   C1  THE WALK: A opens with a release manifest, B joins typing A's seat fingerprint as heard, A seals typing B's,
 *       B files the inception. Both answer one AID, both carried charters read it, both seeds stand byte-identical.
 *   C2  RED: the verbs refuse before anything moves: no release manifest, no `--out`, no fingerprint typed off a
 *       terminal, a misheard fingerprint, a file of the wrong kind; CONTROL: C1.
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

const nexus = (positional: string[], options: Record<string, string> = {}): ParsedArgs =>
  ({ command: "nexus", positional: ["seal", "cofound", ...positional], options: { face: "0", ...options }, flags: { json: true } } as unknown as ParsedArgs);
async function run(a: ParsedArgs): Promise<{ code: number; out: Record<string, any> }> {
  const lines: string[] = [];
  vi.spyOn(console, "log").mockImplementation(() => {}); vi.spyOn(console, "error").mockImplementation(() => {});
  const write = vi.spyOn(process.stdout, "write").mockImplementation((chunk: unknown) => { lines.push(String(chunk)); return true; });
  try { const code = await cmdNexus(a); const json = lines.find((l) => l.trim().startsWith("{")); return { code, out: json ? JSON.parse(json) : {} }; }
  finally { write.mockRestore(); }
}

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
});
