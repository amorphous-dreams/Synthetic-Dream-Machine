/**
 * kahua-face-folders — the face rides the WIKI'S NAME, never a parent directory (operator-approved layout, 2026-11-02).
 *
 * One tree under the state root, no per-face root: a face's kahua wiki projects to `<state>/wikis/kahua-<tag>/` and its
 * stage to `<state>/bags/kahua-<tag>/`, where `<tag>` names the face's DERIVED persona tag, the same suffix its persona
 * plane wears (`personaBagIdFor(group)` = `bags/persona-<tag>`): stable across the face's devices, read off the group
 * alone, no stored map. Never the Handle, never a device-local custody id, never a handle-index ordinal.
 *
 * Reds: two faces on one device project two folders that never collide (a draft and a lift of ONE title under face A and
 * face B); the folder tag equals the persona-plane tag; a face standing no worn face projects no private kahua mirror.
 * Controls: nothing private reaches the workspace; no untagged `<state>/wikis/kahua` or `<state>/bags/kahua` stands; a
 * workspace canon dir shaped `kahua-<tag>` never sources a mirror; a key rotation under the fixed identifier moves no tag.
 *
 * Meme: lar:///ha.ka.ba/lares/docs/pono/kahua-memory-stage
 */
import { describe, test, expect, afterEach } from "vitest";
import { mkdirSync, mkdtempSync, rmSync, existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import { LarDiskProjector } from "../src/disk-projector.js";
import {
  daemonDiskMirrors, daemonWorkingMirror, kahuaStageMirror, kahuaFaceTag, kahuaFaceFolder, isKahuaFaceFolder, projectionRoots,
} from "../src/bag-paths.js";
import {
  CROSSROADS_DOC_URI, KAHUA_BAG, personaBagIdFor, personaTagFromBagId, wikiSlotUri,
  mintPersonaInception, mintPersonaRotation, personaRotationSigningBytes, sealKeySetHash, ed25519SignerFromSeed, ed25519VerifyingKeyFromSeed,
} from "@lararium/mesh";
import type { CarrierFile } from "@lararium/tw5";

type Flushable = { flush: (b: string, u: string) => Promise<void> };
const WORKING = wikiSlotUri("daemon", "working");
const GROUP_A = "2a1f0c9e4b7d3a5f6e8c1b2d4f6a8c0e";
const GROUP_B = "9c8b7a6f5e4d3c2b1a0f9e8d7c6b5a4f";
const TITLE = "lares-dev/notes/stage";

let base = "";
afterEach(() => { if (base) { rmSync(base, { recursive: true, force: true }); base = ""; } });

/** Each face writes its own body, so a collision reads as the wrong face's bytes. */
const carrierOf = (face: string) => async (uri: string): Promise<CarrierFile> =>
  ({ ext: ".tid", body: `title: ${uri}\n\nbody of ${uri} under ${face}\n`, defaultRelPath: `${uri.replace(/\/|\\/g, "_")}.tid` });

function house(): { state: string; workspace: string } {
  base = mkdtempSync(join(tmpdir(), "lar-kahua-face-"));
  const state = join(base, "state"), workspace = join(base, "workspace");
  for (const d of ["lares", "lararium", "crossroads"]) mkdirSync(join(workspace, "bags", d), { recursive: true });
  mkdirSync(join(workspace, "wikis"), { recursive: true });
  return { state, workspace };
}

/** The projector one session of `group` stands on this device: the very list the daemon VM hands its island. */
const sessionOf = (state: string, workspace: string, group: string | null, face: string): Flushable =>
  new LarDiskProjector({
    mirrors: daemonDiskMirrors({ rootDir: state, canonBags: join(workspace, "bags"), faceTag: group === null ? null : kahuaFaceTag(group) }),
    carrierFileFn: carrierOf(face),
  }) as unknown as Flushable;

function walk(dir: string): string[] {
  if (!existsSync(dir)) return [];
  const out: string[] = [];
  const step = (d: string): void => {
    for (const name of readdirSync(d)) {
      const at = join(d, name);
      out.push(relative(dir, at));
      if (statSync(at).isDirectory()) step(at);
    }
  };
  step(dir);
  return out;
}

describe("the face's tag names its kahua folders", () => {
  test("RED: the folder tag equals the face's persona-plane tag, derived from the group alone", () => {
    const tag = kahuaFaceTag(GROUP_A);
    expect(tag).toBe(personaTagFromBagId(personaBagIdFor(GROUP_A)));
    expect(kahuaFaceFolder(tag)).toBe(`kahua-${tag}`);
    expect(kahuaFaceTag(GROUP_A), "the same group derives the same tag on every device").toBe(tag);
    expect(kahuaFaceTag(GROUP_B), "CONTROL: another face derives another tag").not.toBe(tag);
    expect(tag.includes(GROUP_A.slice(0, 8)), "the tag carries no group material").toBe(false);
    expect(isKahuaFaceFolder(`kahua-${tag}`)).toBe(true);
    for (const bare of ["kahua", "kahua-", "kahua-the-gardener", `kahua-${tag.toUpperCase()}`, `kahua-${tag}0`, "kahua-h1"]) {
      expect(isKahuaFaceFolder(bare), `${bare} reads as a face folder`).toBe(false);
    }
  });

  test("RED: a Handle, a custody id or a handle ordinal never names a folder", () => {
    for (const notATag of ["the-gardener", "h1", "1", "fcid-0a1b2c3d", "", "../kahua"]) {
      expect(() => kahuaFaceFolder(notATag), `${JSON.stringify(notATag)} named a folder`).toThrow(/derived persona tag/);
    }
  });

  test("RED: the mirrors take the tag in the wiki's name, under one state tree", () => {
    const tag = kahuaFaceTag(GROUP_A);
    expect(daemonWorkingMirror("/s", tag)).toEqual({ bagId: WORKING, mirrorRoot: join("/s", "wikis", `kahua-${tag}`) });
    expect(kahuaStageMirror("/s", tag)).toEqual({ bagId: KAHUA_BAG, mirrorRoot: join("/s", "bags", `kahua-${tag}`), titlePaths: true });
    expect(daemonDiskMirrors({ rootDir: "/s", canonBags: "/absent", faceTag: tag }).map((m) => [m.bagId, m.mirrorRoot])).toEqual([
      [WORKING, join("/s", "wikis", `kahua-${tag}`)],
      [KAHUA_BAG, join("/s", "bags", `kahua-${tag}`)],
      [CROSSROADS_DOC_URI, join("/s", "bags", "crossroads")],
    ]);
  });

  test("RED: with no face worn the daemon VM mirrors no private kahua layer; crossroads still mirrors", () => {
    expect(daemonDiskMirrors({ rootDir: "/s", canonBags: "/absent", faceTag: null }).map((m) => [m.bagId, m.mirrorRoot])).toEqual([
      [CROSSROADS_DOC_URI, join("/s", "bags", "crossroads")],
    ]);
  });
});

describe("two faces on one device project side by side", () => {
  test("RED: a draft and a lift of ONE title under face A and face B land in kahua-<tagA> and kahua-<tagB>, never colliding", async () => {
    const { state, workspace } = house();
    // Each flush stands its own projector over the face's mirror list: a projector holding no store reads a title
    // flushed in a second bag as a carrier that moved, so the draft and the lift each stand a session of their own.
    for (const [group, face] of [[GROUP_A, "face A"], [GROUP_B, "face B"]] as const) {
      await sessionOf(state, workspace, group, face).flush(WORKING, TITLE);
      await sessionOf(state, workspace, group, face).flush(KAHUA_BAG, TITLE);
    }
    const tagA = kahuaFaceTag(GROUP_A), tagB = kahuaFaceTag(GROUP_B);
    const read = (...p: string[]): string => readFileSync(join(state, ...p), "utf8");
    expect(read("wikis", `kahua-${tagA}`, "lares-dev_notes_stage.tid")).toContain("under face A");
    expect(read("wikis", `kahua-${tagB}`, "lares-dev_notes_stage.tid")).toContain("under face B");
    expect(read("bags", `kahua-${tagA}`, "lares-dev", "notes", "stage.tid")).toContain("under face A");
    expect(read("bags", `kahua-${tagB}`, "lares-dev", "notes", "stage.tid")).toContain("under face B");
    expect(readdirSync(join(state, "wikis")).sort()).toEqual([`kahua-${tagA}`, `kahua-${tagB}`].sort());
    expect(readdirSync(join(state, "bags")).filter((d) => d.startsWith("kahua")).sort()).toEqual([`kahua-${tagA}`, `kahua-${tagB}`].sort());
  });

  test("CONTROL: nothing private under the workspace; no untagged <state>/wikis/kahua or <state>/bags/kahua", async () => {
    const { state, workspace } = house();
    await sessionOf(state, workspace, GROUP_A, "face A").flush(WORKING, TITLE);
    await sessionOf(state, workspace, GROUP_A, "face A").flush(KAHUA_BAG, TITLE);
    const faceless = sessionOf(state, workspace, null, "no face");
    await faceless.flush(WORKING, "Faceless Note");
    await faceless.flush(KAHUA_BAG, "lares-dev/notes/faceless");
    expect(walk(state).length, "the positive writes never landed: the zeros below prove nothing").toBeGreaterThan(0);
    expect(existsSync(join(state, "wikis", "kahua")), "an untagged wikis/kahua").toBe(false);
    expect(existsSync(join(state, "bags", "kahua")), "an untagged bags/kahua").toBe(false);
    expect(walk(state).filter((p) => p.includes("aceless")), "a faceless session projected a private layer").toEqual([]);
    expect(walk(join(workspace, "wikis")), "a private layer reached the workspace wikis/").toEqual([]);
    expect(walk(join(workspace, "bags")).filter((p) => p.includes("kahua")), "a private layer reached the workspace bags/").toEqual([]);
  });

  test("CONTROL: a workspace canon dir shaped kahua-<tag> sources no mirror; the stage stays under state", () => {
    const { state, workspace } = house();
    const tag = kahuaFaceTag(GROUP_A);
    mkdirSync(join(workspace, "bags", `kahua-${tag}`), { recursive: true });
    const roots = projectionRoots({ stateRoot: state, canonBags: join(workspace, "bags") });
    expect(roots.sourcedSlugs()).not.toContain(`kahua-${tag}`);
    expect(roots.bagRoot(`kahua-${tag}`)).toBe(join(state, "bags", `kahua-${tag}`));
    expect(roots.wikisRootFor(`kahua-${tag}`)).toBe(join(state, "wikis"));
    expect(roots.sourcedSlugs(), "CONTROL: an ordinary canon dir still sources").toContain("lares");
  });
});

describe("the tag holds across a key rotation under the fixed identifier", () => {
  test("CONTROL: a rotation turns the op-key and keeps the prefix; the tag, the plane name and the folders read the group alone", async () => {
    const seed = (n: number): Uint8Array => new Uint8Array(32).fill(n);
    const opKey = `0x${await ed25519VerifyingKeyFromSeed(seed(1))}`, recovery = await ed25519VerifyingKeyFromSeed(seed(2));
    const inception = mintPersonaInception(opKey, sealKeySetHash([recovery], 1));
    const fresh = `0x${await ed25519VerifyingKeyFromSeed(seed(3))}`;
    const sig = await ed25519SignerFromSeed(seed(2))(personaRotationSigningBytes(inception, fresh));
    const rotated = await mintPersonaRotation({ head: inception, freshOpKeyDid: fresh, recoveryRoster: [recovery], recoveryThreshold: 1, rotationSigs: [{ signer: recovery, sig }] });
    if (!rotated.ok) throw new Error(rotated.reason);
    expect(rotated.event.prefix, "the identifier stays fixed").toBe(inception.prefix);
    expect(rotated.event.opKeyDid).not.toBe(inception.opKeyDid);
    const before = { tag: kahuaFaceTag(GROUP_A), plane: personaBagIdFor(GROUP_A), mirrors: daemonDiskMirrors({ rootDir: "/s", canonBags: "/absent", faceTag: kahuaFaceTag(GROUP_A) }) };
    expect(JSON.stringify(rotated.event).includes(GROUP_A), "a rotation names the group, so it could move the tag").toBe(false);
    expect({ tag: kahuaFaceTag(GROUP_A), plane: personaBagIdFor(GROUP_A), mirrors: daemonDiskMirrors({ rootDir: "/s", canonBags: "/absent", faceTag: kahuaFaceTag(GROUP_A) }) }).toEqual(before);
  });
});
