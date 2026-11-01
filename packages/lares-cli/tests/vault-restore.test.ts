/**
 * vault-restore — the command's half of one face's restore: read the bundle, open its slot tree under the route a
 * person presents, and hand the body still SEALED, beside the bundle key, to ONE act of the custody door.
 *
 *   V1  a restore sends `bundle.restore` with the sealed body and the opened key, and `--as` where a person named
 *       one; `--memory` sends `bundle.import` and no index. The route itself never rides the act.
 *   V2  a file that reads as no bundle refuses `bundle-malformed`, a missing file `bundle-unreadable`, and a route
 *       that opens no slot `no-slot-opens`: each before any act leaves.
 *   V3  a refusal the vessel answers keeps its own name.
 *   V4  the lines a restore prints say that the face took a NEW seat, name the head the key history check read and
 *       where it read it, and say the sealed bytes must survive elsewhere; an import prints one line per version.
 *   C1  `--cards`: the split's two off-device cards build the face's body in this process; the act carries it SEALED
 *       under a fresh key, beside that key and the index, and no card code rides the act. The body names the root
 *       the cards rebuild, at the index, with no names, proof key, handle-book record or memory entry.
 *   C2  the card reader's refusals keep their names and send no act: one card, no face named, another face's root.
 *
 * Synthetic names and keys. Canon: lar:///ha.ka.ba/lararium/mesh/custody#/the-restore
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { webcrypto } from "node:crypto";
import * as ed from "@noble/ed25519";
import { bindBundleRoutes, encodeFaceBundle, hex, mintBundleKey, openFaceBundleBody, readFaceBundleBody, sealFaceBundleBody, splitRootAtFounding, hexToBytes } from "@lararium/mesh";
import { SEALED_BYTES_LINE } from "../src/vault-backup.js";
import { importLines, restoreFromBundle, restoreFromCards, restoreLines, type RestoreLanded, type RunAct } from "../src/vault-restore.js";
import { nativeKdf } from "@lararium/mesh/node";

vi.setConfig({ testTimeout: 120_000 });

const ROUTE = "the-bundle-route-for-a-restore-test";
const credentials = [{ kind: "passphrase", passphrase: ROUTE }] as const;
const BODY = new TextEncoder().encode("a body a vessel sealed for this test");
const FACE = { handleIndex: 0, verifyingKey: "ab".repeat(32) };
const HOLD = { bagId: "lar:///ha.ka.ba/@test/bags/garden-notes", founding: "11".repeat(32), keyVersion: "22".repeat(32) };
const RESTORED = { face: FACE, prefix: "E-test-prefix-0123456789", resumed: false, checked: { seq: 0, from: "bundle" }, recoveryContactSet: "none", provisional: { couldConfirm: ["a chair seated in a charter this face stands in, with its own view"] }, landed: { faceProofKeys: 1, petname: true, handle: false, handleBook: { landed: 2, kept: 1 } }, holds: [HOLD] };

let dir: string;
let file: string;
let bundleKey: Uint8Array;
beforeEach(async () => {
  dir = mkdtempSync(join(tmpdir(), "vault-restore-"));
  file = join(dir, "face.bundle");
  bundleKey = mintBundleKey();
  const tree = await bindBundleRoutes(bundleKey, [{ t: 1, pins: [{ kind: "passphrase", passphrase: ROUTE }] }], nativeKdf);
  writeFileSync(file, encodeFaceBundle(tree, sealFaceBundleBody(BODY, bundleKey)));
});
afterEach(() => { rmSync(dir, { recursive: true, force: true }); });

/** A door that keeps the acts it heard and answers `result`. */
function door(result: Record<string, unknown>) {
  const acts: Array<{ act: string; args: Readonly<Record<string, unknown>> }> = [];
  const run: RunAct = async (act, args) => { acts.push({ act, args }); return { result, via: "vessel" }; };
  return { acts, run };
}

describe("a restore hands the vessel a sealed body and the bundle's own key", () => {
  it("V1 — the act carries the body still sealed, the opened key, and the index a person named; the route never rides it", async () => {
    const d = door(RESTORED);
    const out = await restoreFromBundle({ file, credentials, as: 3, memory: false, run: d.run });
    expect(out).toMatchObject({ ok: true, kind: "restore", via: "vessel", face: FACE, prefix: RESTORED.prefix, holds: [HOLD] });
    expect(d.acts).toHaveLength(1);
    expect(d.acts[0]!.act).toBe("bundle.restore");
    expect(Object.keys(d.acts[0]!.args).sort()).toEqual(["as", "body", "key"]);
    expect(d.acts[0]!.args["as"]).toBe(3);
    expect(d.acts[0]!.args["key"]).toBe(hex(bundleKey));
    // The body rides sealed: it opens under the key the act carries, and holds no clear word of the body.
    const sealed = Uint8Array.from(Buffer.from(String(d.acts[0]!.args["body"]), "base64"));
    expect(Buffer.from(sealed).toString("latin1")).not.toContain("a body a vessel sealed");
    expect(Buffer.from(openFaceBundleBody(sealed, hexToBytes(String(d.acts[0]!.args["key"])))!).toString()).toBe("a body a vessel sealed for this test");
    expect(JSON.stringify(d.acts)).not.toContain(ROUTE);
    // With no index named, the act names none: the vessel takes the index the bundle's own roster line named.
    const plain = door(RESTORED);
    await restoreFromBundle({ file, credentials, memory: false, run: plain.run });
    expect(Object.keys(plain.acts[0]!.args).sort()).toEqual(["body", "key"]);
  });

  it("V1 — `--memory` sends the import, and no index", async () => {
    const d = door({ face: FACE, results: [{ bagId: HOLD.bagId, keyVersion: HOLD.keyVersion, outcome: "imported" }] });
    const out = await restoreFromBundle({ file, credentials, memory: true, run: d.run });
    expect(out).toEqual({ ok: true, kind: "import", face: FACE, results: [{ bagId: HOLD.bagId, keyVersion: HOLD.keyVersion, outcome: "imported" }] });
    expect(d.acts[0]!.act).toBe("bundle.import");
    expect(Object.keys(d.acts[0]!.args).sort()).toEqual(["body", "key"]);
  });

  it("V2 — no bundle, a malformed file and a route that opens no slot each refuse before any act leaves", async () => {
    const d = door(RESTORED);
    expect(await restoreFromBundle({ file: join(dir, "absent.bundle"), credentials, memory: false, run: d.run })).toMatchObject({ ok: false, reason: "bundle-unreadable" });
    const bent = join(dir, "bent.bundle");
    writeFileSync(bent, "something that reads as no bundle at all");
    expect(await restoreFromBundle({ file: bent, credentials, memory: false, run: d.run })).toMatchObject({ ok: false, reason: "bundle-malformed" });
    expect(await restoreFromBundle({ file, credentials: [{ kind: "passphrase", passphrase: "another-route" }], memory: false, run: d.run })).toMatchObject({ ok: false, reason: "no-slot-opens" });
    expect(d.acts).toEqual([]);
    // CONTROL: the right route over the whole file sends the act.
    await restoreFromBundle({ file, credentials, memory: false, run: d.run });
    expect(d.acts).toHaveLength(1);
  });

  it("V3 — a refusal the vessel answers keeps its own name", async () => {
    for (const reason of ["root-superseded", "face-already-held", "another-face", "signer-unavailable"]) {
      const d = door({ refused: reason, message: `the vessel said ${reason}` });
      expect(await restoreFromBundle({ file, credentials, memory: reason === "another-face", run: d.run })).toEqual({ ok: false, reason, message: `the vessel said ${reason}` });
    }
  });

  it("V4 — a restore's lines name the new seat, the head the check read and the half the bundle lacks", () => {
    const landed = { ok: true, kind: "restore", via: "vessel", ...RESTORED } as unknown as RestoreLanded;
    const text = restoreLines(landed).join("\n");
    expect(text).toContain("took a NEW seat");
    expect(text).toContain("the check read the bundle's own log, as far as its cut");
    expect(text).toContain("every reader that holds the newer head refuses this seat");
    expect(text).toContain("--memory");
    expect(text).toContain(SEALED_BYTES_LINE);
    expect(text).toContain("lares vessel stand --restart");
    expect(text).toContain("PROVISIONAL");
    expect(text).toContain("a chair seated in a charter this face stands in");
    const boarded = restoreLines({ ...landed, via: "direct", checked: { seq: 4, from: "board" }, holds: [], resumed: true }).join("\n");
    expect(boarded).toContain("this vessel's own board held the face's history");
    expect(boarded).toContain("sequence 4");
    expect(boarded).toContain("stood pending completed");
    expect(boarded).toContain("carries no content key");
    expect(boarded).not.toContain("--restart");
    const imported = importLines({ ok: true, kind: "import", face: FACE, results: [{ bagId: HOLD.bagId, keyVersion: HOLD.keyVersion, outcome: "imported" }, { bagId: "lar:///x", keyVersion: "33".repeat(32), outcome: "key-forged", cause: "why" }] }).join("\n");
    expect(imported).toContain("imported");
    expect(imported).toContain("key-forged");
    expect(imported).toContain(HOLD.bagId);
    expect(imported).toContain(SEALED_BYTES_LINE);
  });
});

describe("a root split's cards restore a root through the same act", () => {
  const seed = Uint8Array.from({ length: 32 }, (_, i) => (i * 13 + 5) & 0xff);
  const split = splitRootAtFounding(seed, webcrypto as never);
  const cards = [{ code: split.recordedCode, custodian: "recorded-code" as const }, { code: split.escrowCarrier, custodian: "escrow-peer" as const }];

  it("C1 — the cards build the body here, and the act carries it sealed beside a fresh key; no code rides it", async () => {
    const rootKey = hex(await ed.getPublicKeyAsync(seed));
    const d = door(RESTORED);
    const out = await restoreFromCards({ cards, face: { verifyingKey: `0x${rootKey}` }, as: 2, run: d.run });
    expect(out).toMatchObject({ ok: true, kind: "restore", face: FACE });
    expect(d.acts).toHaveLength(1);
    expect(d.acts[0]!.act).toBe("bundle.restore");
    expect(Object.keys(d.acts[0]!.args).sort()).toEqual(["as", "body", "key"]);
    expect(d.acts[0]!.args["as"]).toBe(2);
    const said = JSON.stringify(d.acts);
    for (const c of cards) expect(said).not.toContain(c.code);
    expect(said).not.toContain(hex(seed));
    const plain = openFaceBundleBody(Uint8Array.from(Buffer.from(String(d.acts[0]!.args["body"]), "base64")), hexToBytes(String(d.acts[0]!.args["key"])))!;
    const body = readFaceBundleBody(plain)!;
    expect(body.root.verifyingKey).toBe(rootKey);
    expect(body.rosterLine).toEqual({ handleIndex: 2, verifyingKey: rootKey });
    expect(body).toMatchObject({ names: {}, faceProofKeys: [], handleBook: { records: [] }, recoveryContactSet: null, memory: { holds: [] } });
  });

  it("C2 — the card reader's refusals keep their names and send no act", async () => {
    const d = door(RESTORED);
    const other = hex(await ed.getPublicKeyAsync(new Uint8Array(32).fill(9)));
    expect(await restoreFromCards({ cards: [cards[0]!], face: { verifyingKey: other }, as: 1, run: d.run })).toMatchObject({ ok: false, reason: "cards-too-few" });
    expect(await restoreFromCards({ cards, face: {}, as: 1, run: d.run })).toMatchObject({ ok: false, reason: "face-unnamed" });
    expect(await restoreFromCards({ cards, face: { verifyingKey: other }, as: 1, run: d.run })).toMatchObject({ ok: false, reason: "cards-another-root" });
    expect(d.acts).toHaveLength(0);
  });
});
