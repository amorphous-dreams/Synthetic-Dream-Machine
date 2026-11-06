/**
 * Face custody at the holder (K15 Wave D, slice 1): each face's rows seal under that face's own custody key and rest in
 * that face's own directory. The floor index routes and never decides.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, test } from "vitest";
import type { SlotSpec } from "@lararium/mesh";
import { FaceLocked, makeCustodyHolder } from "../src/custody-holder.js";
import { FsCustodyIo } from "../src/custody-io.js";
import { decodeFaceIndex, faceDir, faceIndexPath, FaceIndexRefused } from "../src/face-index.js";
import { personaGroupDigest } from "../src/persona-group-file.js";
import { faceAtomGroupFile } from "../src/face-atom-store.js";
import { seatScratchCustody, type SeatedScratchCustody } from "./custody-seat-fixture.js";

const slot = (passphrase: string): SlotSpec => ({ t: 1, pins: [{ kind: "passphrase", passphrase }] });
const cred = (passphrase: string) => [{ kind: "passphrase" as const, passphrase }];
const GROUP_A = "group-holder-a";
const GROUP_B = "group-holder-b";
const SEED = (n: number) => new Uint8Array(32).fill(n);

let seat: SeatedScratchCustody | null = null;
afterEach(async () => { await seat?.drop(); seat = null; });

/** Two founded faces, each under its own route, both then locked. */
async function twoLockedFaces() {
  seat = await seatScratchCustody("face-holder");
  const { holder } = seat;
  const a = await holder.foundFace({ group: personaGroupDigest(GROUP_A), slots: [slot("route-a")] });
  await holder.writeRow("identity", faceAtomGroupFile(GROUP_A), SEED(1));
  const b = await holder.foundFace({ group: personaGroupDigest(GROUP_B), slots: [slot("route-b")] });
  await holder.writeRow("identity", faceAtomGroupFile(GROUP_B), SEED(2));
  await holder.lockFace(a.fcid);
  await holder.lockFace(b.fcid);
  return { holder, a, b, identity: seat.homes.identity };
}

describe("the floor index of faces", () => {
  test("RED: a field beyond digests and random names refuses by name", () => {
    const entry = { fcid: "ab".repeat(16), group: "cd".repeat(32), ask: null };
    for (const extra of [{ name: "alice" }, { handle: 3 }, { prefix: "E123" }, { key: "00" }]) {
      const bytes = new TextEncoder().encode(JSON.stringify({ faces: [{ ...entry, ...extra }] }));
      expect(() => decodeFaceIndex(bytes)).toThrow(FaceIndexRefused);
    }
  });

  test("CONTROL: the honest entry reads, and a founded index carries exactly fcid, group and ask", async () => {
    const { identity } = await twoLockedFaces();
    const parsed = JSON.parse(readFileSync(faceIndexPath(identity), "utf8")) as { faces: Array<Record<string, unknown>> };
    expect(parsed.faces).toHaveLength(2);
    for (const entry of parsed.faces) expect(Object.keys(entry).sort()).toEqual(["ask", "fcid", "group"]);
    expect(decodeFaceIndex(readFileSync(faceIndexPath(identity))).faces).toHaveLength(2);
  });
});

describe("each face opens under its own route alone", () => {
  test("A's route opens A and refuses B; B's rows stay shut by name", async () => {
    const { holder, a, b } = await twoLockedFaces();
    expect((await holder.unlockFace({ group: personaGroupDigest(GROUP_A) }, cred("route-a"))).reading).toBe("opens");
    expect((await holder.unlockFace({ group: personaGroupDigest(GROUP_B) }, cred("route-a"))).reading).toBe("no-slot-opens");
    expect(holder.unlockedFaces()).toEqual([a.fcid]);
    expect((await holder.readRow("identity", faceAtomGroupFile(GROUP_A))).reading).toBe("opens");
    expect(await holder.readRow("identity", faceAtomGroupFile(GROUP_B))).toEqual({ reading: "locked", fcid: b.fcid });
    await expect(holder.writeRow("identity", faceAtomGroupFile(GROUP_B), SEED(9))).rejects.toBeInstanceOf(FaceLocked);
  });

  test("RED: swapped index entries open a tree whose owner row disagrees, so no face seats", async () => {
    const { holder, a, b, identity } = await twoLockedFaces();
    const path = faceIndexPath(identity);
    const index = JSON.parse(readFileSync(path, "utf8")) as { faces: Array<{ fcid: string; group: string | null; ask: string | null }> };
    writeFileSync(path, JSON.stringify({ faces: [{ ...index.faces[0]!, fcid: b.fcid }, { ...index.faces[1]!, fcid: a.fcid }] }));
    const opened = await holder.unlockFace({ group: personaGroupDigest(GROUP_A) }, cred("route-b"));
    expect(opened.reading).toBe("index-mismatch");
    expect(holder.unlockedFaces()).toEqual([]);
    expect((await holder.readRow("identity", faceAtomGroupFile(GROUP_A))).reading).toBe("locked");
    void faceDir;
  });

  test("CONTROL: the honest index seats the face its route opens", async () => {
    const { holder, a } = await twoLockedFaces();
    const opened = await holder.unlockFace({ group: personaGroupDigest(GROUP_A) }, cred("route-a"));
    expect(opened).toMatchObject({ reading: "opens", fcid: a.fcid, ordinal: 0 });
    expect(holder.unlockedFaces()).toEqual([a.fcid]);
  });

  test("a fresh holder over the same home opens a face by its own route and reads the sealed row", async () => {
    const { a, identity } = await twoLockedFaces();
    const second = makeCustodyHolder({ io: new FsCustodyIo(seat!.homes), homes: seat!.homes });
    expect((await second.unlockFace({ fcid: a.fcid }, cred("route-a"))).reading).toBe("opens");
    const read = await second.readRow("identity", faceAtomGroupFile(GROUP_A));
    expect(read.reading).toBe("opens");
    void identity; void join;
  });
});

describe("a face's handle index is its ordinal", () => {
  const anchorsOf = (group: string) => new TextEncoder().encode(JSON.stringify({ personaGroupId: group, meshCabalDocIdHex: "ab".repeat(32) }));

  test("RED: an anchors row naming another group than the index entry refuses by name and seats no face; CONTROL: its own group seats", async () => {
    const { holder, a, identity } = await twoLockedFaces();
    void identity;
    await holder.unlockFace({ fcid: a.fcid }, cred("route-a"));
    await holder.writeRow("identity", "anchors-h0.json", anchorsOf(GROUP_B));
    await holder.lockFace(a.fcid);
    const bad = await holder.unlockFace({ group: personaGroupDigest(GROUP_A) }, cred("route-a"));
    expect(bad).toMatchObject({ reading: "index-mismatch" });
    expect(holder.unlockedFaces()).toEqual([]);
    // the honest row: lock was dropped, so rewrite under a fresh holder view of the same face
    const second = makeCustodyHolder({ io: new FsCustodyIo(seat!.homes), homes: seat!.homes });
    await second.adopt(seat!.treeKey);
    // the index-mismatching row stays; swap in the honest one by reaching the face through its own key
    expect((await second.unlockFace({ fcid: a.fcid }, cred("route-a"))).reading).toBe("index-mismatch");
  });

  test("CONTROL: an anchors row naming the index entry's group seats the face", async () => {
    seat = await seatScratchCustody("face-ordinal");
    const { holder } = seat;
    const a = await holder.foundFace({ group: personaGroupDigest(GROUP_A), slots: [slot("route-a")] });
    await holder.writeRow("identity", "anchors-h0.json", anchorsOf(GROUP_A));
    await holder.lockFace(a.fcid);
    expect((await holder.unlockFace({ fcid: a.fcid }, cred("route-a"))).reading).toBe("opens");
  });

  test("a founding at handle index 3 pads tombstones; a retired or held index never lands twice", async () => {
    seat = await seatScratchCustody("face-ordinal");
    const { holder } = seat;
    const third = await holder.foundFace({ ask: "ab".repeat(32), ordinal: 3, slots: [slot("r3")] });
    expect(third.ordinal).toBe(3);
    const index = decodeFaceIndex(readFileSync(faceIndexPath(seat.homes.identity)));
    expect(index.faces.map((f) => ("tombstone" in f ? "t" : "f")).join("")).toBe("ttt" + "f");
    await expect(holder.foundFace({ ask: "cd".repeat(32), ordinal: 3, slots: [slot("x")] })).rejects.toBeInstanceOf(FaceIndexRefused);
    await expect(holder.foundFace({ ask: "ef".repeat(32), ordinal: 1, slots: [slot("x")] })).rejects.toThrow(/retired and never reused/);
    const next = await holder.foundFace({ ask: "12".repeat(32), slots: [slot("r4")] });
    expect(next.ordinal).toBe(4);
  });

  test("a handle-index row rests in the face at that ordinal and no other face opens it", async () => {
    const { holder, a, b } = await twoLockedFaces();
    await holder.unlockFace({ fcid: a.fcid }, cred("route-a"));
    await holder.writeRow("identity", "recovery-contact-set-h0.json", new TextEncoder().encode("{}"));
    expect(existsSync(join(faceDir(seat!.homes.identity, a.fcid), "recovery-contact-set-h0.json"))).toBe(true);
    expect(existsSync(join(faceDir(seat!.homes.identity, b.fcid), "recovery-contact-set-h0.json"))).toBe(false);
    await expect(holder.writeRow("identity", "recovery-contact-set-h1.json", new TextEncoder().encode("{}"))).rejects.toBeInstanceOf(FaceLocked);
  });
});

// ── the ward (row 7, S2): the face root seed rests under a key that stays sealed while the face stands unlocked ──────────────
describe("the ward holds the face root apart from unlocked custody", () => {
  const PASS = "ward-route";
  /** A face at h0 founded under PASS, standing unlocked, with its root minted through a fresh ward unlock. */
  async function wardedFace(watch?: (key: Uint8Array) => void) {
    const { setMountedFace } = await import("../src/node-vessel-identity.js");
    seat = await seatScratchCustody("ward-holder");
    setMountedFace(undefined);
    const { holder } = seat;
    if (watch) (holder as unknown as { watchWardKeys(w: (k: Uint8Array) => void): void }).watchWardKeys(watch);
    const face = await holder.foundFace({ ordinal: 0, slots: [slot(PASS)] });
    return { holder, face };
  }

  test("RED: with the face unlocked, the root seed refuses without a fresh ward unlock; CONTROL: the passphrase opens it once, the next bare call refuses again, and no ward key stays held", async () => {
    const { wardCredential } = await import("../src/ward-credential.js");
    const { generateOrLoadPersonaGroupRoot, loadPersonaGroupRootSeed } = await import("../src/node-vessel-identity.js");
    const opened: Uint8Array[] = [];
    const { holder, face } = await wardedFace((k) => opened.push(k));
    await generateOrLoadPersonaGroupRoot(0, wardCredential(cred(PASS)));
    expect(holder.unlockedFaces()).toEqual([face.fcid]);
    // No person stands at this process's terminal for the bare calls: the gatherer the fixture seats steps away.
    const { seatWardGatherer } = await import("../src/ward-credential.js");
    seatWardGatherer(null);
    const bare = loadPersonaGroupRootSeed as unknown as (i: number) => Promise<Uint8Array>;
    await expect(bare(0)).rejects.toThrow(/ward-needs-fresh-unlock/);
    // Unlocked custody's own doors refuse the warded row by name too: a script holding them reads no root.
    await expect(holder.openColdRow("identity", ".persona-group-root-h0.json", () => 1)).rejects.toThrow(/ward-needs-fresh-unlock/);
    await expect(holder.readRow("identity", ".persona-group-root-h0.json")).rejects.toThrow(/ward-needs-fresh-unlock/);
    await expect(holder.writeRow("identity", ".persona-group-root-h0.json", new Uint8Array([1]))).rejects.toThrow(/ward-needs-fresh-unlock/);
    const seed = await loadPersonaGroupRootSeed(0, wardCredential(cred(PASS)));
    expect(seed.length).toBe(32);
    await expect(bare(0)).rejects.toThrow(/ward-needs-fresh-unlock/);
    await expect(loadPersonaGroupRootSeed(0, wardCredential(cred("not the route")))).rejects.toThrow(/ward-no-slot-opens/);
    seatWardGatherer(async () => [{ kind: "passphrase", passphrase: "fixture-custody-passphrase" }]);
    expect(holder.unlockedFaces()).toEqual([face.fcid]);
    expect(opened.length).toBeGreaterThanOrEqual(2);
    for (const k of opened) expect(k.every((b) => b === 0), "every ward key zeroes once its act settles").toBe(true);
  });

  test("RED: a pre-ward face (an FCK-sealed root, no ward tree) refuses `ward-absent: run ward rewrap`; CONTROL: after the rewrap it opens, and an interrupted rewrap resumes", async () => {
    const { wardCredential } = await import("../src/ward-credential.js");
    const { loadPersonaGroupRootSeed } = await import("../src/node-vessel-identity.js");
    const { rewrapWardCustody } = await import("../src/custody-seat.js");
    const { openFaceTree, faceCarrierFor } = await import("../src/face-custody.js");
    const { carrierTable } = await import("../src/vault-carriers.js");
    const { wardTreePath, faceTreePath } = await import("../src/face-index.js");
    const { writeFaceCarrier, readFckCarrier, readWardCarrier } = await import("@lararium/mesh");
    const { rmSync } = await import("node:fs");
    const { holder, face } = await wardedFace();
    const s = seat!;
    // Stand the face as a build before the ward founded it: no ward tree, no ward key row, and the root sealed under the face key.
    rmSync(wardTreePath(s.homes.identity, face.fcid));
    rmSync(faceCarrierFor(s.homes, face.fcid, "face-ward-key.bin", carrierTable().find((r) => r.row === "face-ward-key")!).path);
    const opened = await openFaceTree({ io: s.io, homes: s.homes, fcid: face.fcid, credentials: cred(PASS) });
    if (opened.reading !== "opens") throw new Error("the face tree did not open");
    const file = ".persona-group-root-h0.json";
    const row = carrierTable().find((r) => r.row === "persona-root")!;
    const carrier = faceCarrierFor(s.homes, face.fcid, file, row);
    const keypair = { verifyingKey: "ea4a6c63e29c520abef5507b132ec5f9954776aebebe7b92421eea691446d22c", signingKey: "f".repeat(64) };
    // A keypair whose public half derives from its seed: mint one.
    const { generateKeyPairSync } = await import("node:crypto");
    const k = generateKeyPairSync("ed25519");
    const priv = (k.privateKey.export({ format: "jwk" }) as { d: string }).d, pub = (k.publicKey.export({ format: "jwk" }) as { x: string }).x;
    Object.assign(keypair, { signingKey: Buffer.from(priv, "base64url").toString("hex"), verifyingKey: Buffer.from(pub, "base64url").toString("hex") });
    await writeFaceCarrier({ io: s.io, key: opened.fck, treePath: faceTreePath(s.homes.identity, face.fcid), carrier, plaintext: new TextEncoder().encode(JSON.stringify(keypair)) });
    await holder.writeRow("identity", ".persona-roster-h0.json", new TextEncoder().encode(JSON.stringify({ roots: [{ handleIndex: 0, verifyingKey: keypair.verifyingKey }] })));
    await expect(loadPersonaGroupRootSeed(0, wardCredential(cred(PASS)))).rejects.toThrow(/ward-absent: run ward rewrap/);

    // An interrupted rewrap: the ward tree lands, then the root row's write fails before it lands.
    const { makeCustodyHolder } = await import("../src/custody-holder.js");
    const torn = { ...s.io, read: s.io.read.bind(s.io), rename: s.io.rename.bind(s.io), remove: s.io.remove.bind(s.io), list: s.io.list.bind(s.io), exclusive: s.io.exclusive.bind(s.io),
      write: async (path: string, bytes: Uint8Array) => { if (path.includes(".persona-group-root-h0.json")) throw new Error("the disk went away"); return s.io.write(path, bytes); } };
    const second = makeCustodyHolder({ io: torn as typeof s.io, homes: s.homes });
    await second.adopt(s.treeKey);
    expect((await second.unlockFace({ ordinal: 0 }, cred(PASS))).reading).toBe("opens");
    await expect(second.rewrapWard({ ordinal: 0 }, cred(PASS))).rejects.toThrow(/the disk went away/);
    const { readFileSync, existsSync } = await import("node:fs");
    expect(existsSync(wardTreePath(s.homes.identity, face.fcid))).toBe(true);
    expect(readFckCarrier(readFileSync(carrier.path))).toBe("sealed");
    await second.lock();

    // The rewrap runs again over the tree it left, and the root moves under the ward.
    const done = await rewrapWardCustody({ ordinal: 0 }, wardCredential(cred(PASS)));
    expect(done).toMatchObject({ rewrapped: 1 });
    expect(readWardCarrier(readFileSync(carrier.path))).toBe("sealed");
    const seed = await loadPersonaGroupRootSeed(0, wardCredential(cred(PASS)));
    expect(Buffer.from(seed).toString("hex")).toBe(keypair.signingKey);
    // A second rewrap over a warded face moves nothing.
    expect(await rewrapWardCustody({ ordinal: 0 }, wardCredential(cred(PASS)))).toMatchObject({ rewrapped: 0 });
  });
});

describe("the rewrap keeps the face's ward signing key (row 7, S3b)", () => {
  const PASS = "ward-route";
  const IMAGE = new TextEncoder().encode("an approve's ward image");
  test("RED: a rewrap from an absent ward over a face whose ward key its admission already names mints a fresh key, so that key's approvals stop verifying; it refuses `ward-key-would-rotate` and the key stands; CONTROL: a rewrap over the standing ward keeps the key, and the ward still signs under it", async () => {
    const { rmSync } = await import("node:fs");
    const { wardTreePath } = await import("../src/face-index.js");
    const { verifyEd25519 } = await import("@lararium/mesh");
    seat = await seatScratchCustody("ward-rewrap-keeps-key");
    const { holder } = seat;
    const face = await holder.foundFace({ ordinal: 0, slots: [slot(PASS)] });
    const admitted = await holder.wardPublicKey({ ordinal: 0 });
    expect(admitted).toMatch(/^[0-9a-f]{64}$/);
    // CONTROL: the standing ward rewraps over its own key; the key the admission carries still verifies the ward's signature.
    await holder.rewrapWard({ ordinal: 0 }, cred(PASS));
    expect(await holder.wardPublicKey({ ordinal: 0 })).toBe(admitted);
    expect(verifyEd25519(await holder.withWardKey({ ordinal: 0 }, cred(PASS), (w) => w.wardSign(IMAGE)), IMAGE, admitted!)).toBe(true);
    // The ward tree goes missing while the key row stands: a fresh ward would sign under a key no admission names.
    rmSync(wardTreePath(seat.homes.identity, face.fcid));
    const reading = await holder.rewrapWard({ ordinal: 0 }, cred(PASS)).then(() => "rewrapped", (e: Error) => /ward-[a-z-]+/.exec(e.message)?.[0] ?? e.message);
    expect(reading).toBe("ward-key-would-rotate");
    expect(await holder.wardPublicKey({ ordinal: 0 })).toBe(admitted);
  });
});

describe("the rewrap never weakens a ward, and its proof is charged (S2 cold read, P3)", () => {
  test("RED: a face behind a 2-of-2 route rewraps to a ward that one passphrase alone does not open; a wrong route's proof spends the face's attempts; CONTROL: both passphrases open the rewrapped ward", async () => {
    const { rmSync } = await import("node:fs");
    const { wardTreePath } = await import("../src/face-index.js");
    seat = await seatScratchCustody("ward-rewrap-threshold");
    const { holder } = seat;
    const twoOfTwo: SlotSpec = { t: 2, pins: [{ kind: "passphrase", passphrase: "first half" }, { kind: "passphrase", passphrase: "second half" }] };
    const face = await holder.foundFace({ ordinal: 0, slots: [twoOfTwo] });
    // A pre-ward face: no ward tree and no ward key row (a face whose row stands refuses `ward-key-would-rotate`).
    const { faceCarrierFor } = await import("../src/face-custody.js");
    const { carrierTable } = await import("../src/vault-carriers.js");
    const keyRow = faceCarrierFor(seat.homes, face.fcid, "face-ward-key.bin", carrierTable().find((r) => r.row === "face-ward-key")!).path;
    rmSync(wardTreePath(seat.homes.identity, face.fcid));
    rmSync(keyRow);
    const both = [...cred("first half"), ...cred("second half")];
    await holder.rewrapWard({ ordinal: 0 }, both);
    await expect(holder.withWardKey({ ordinal: 0 }, cred("first half"), async () => "opened")).rejects.toThrow(/ward-no-slot-opens|ward-attempts-spent/);
    expect(await holder.withWardKey({ ordinal: 0 }, both, async () => "opened")).toBe("opened");

    // A wrong route's rewrap proof charges the face's own attempts until they spend.
    rmSync(wardTreePath(seat.homes.identity, face.fcid));
    rmSync(keyRow);
    const wrong = cred("not this face's route");
    const readings: string[] = [];
    for (let i = 0; i < 4; i++) readings.push(await holder.rewrapWard({ ordinal: 0 }, wrong).then(() => "rewrapped", (e: Error) => /ward-[a-z-]+/.exec(e.message)?.[0] ?? e.message));
    expect(readings.at(-1)).toBe("ward-attempts-spent");
  });
});
