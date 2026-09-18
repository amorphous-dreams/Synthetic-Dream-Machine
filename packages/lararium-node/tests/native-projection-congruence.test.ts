/**
 * native-projection-congruence — the CONGRUENCE half of native-file-write parity
 * (the operator's 2026-09-18 ruling, dimension 2). `LarDiskProjector.flush` gated
 * its `≈` clause on `file.ext === MEME_EXT` alone — a native carrier's
 * `diskCanonicalHash` was ALWAYS null, so a native both-move that merely
 * REFRAMED (reordered JSON keys) read `conflict` exactly like a genuine
 * divergence. This wires `canonicalizeNativeFn` (mirroring the ingest leg's
 * proven `nativeRender`) into the SAME `decideProjection` gate `.mem` carriers
 * already read through, and measures the wiring — not just the pure function —
 * against the real `LarDiskProjector.flush`.
 *
 * RED-FIRST: every "reads canonical-equivalent" test here fails on the
 * pre-existing wiring (would read `conflict`) and passes once
 * `canonicalizeNativeFn` is threaded through `flush`. The CONTROL proves a
 * genuine divergence still conflicts with the wiring live.
 *
 * Meme: lar:///ha.ka.ba/lararium/node/native-projection-congruence
 */

import { describe, test, expect, afterEach } from "vitest";
import { mkdtempSync, rmSync, writeFileSync, readFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { LarDiskProjector } from "../src/disk-projector.js";
import { SyncedTree, syncedTreeKey } from "../src/synced-tree.js";
import { carrierHash } from "@lararium/mesh";
import { canonicalizeNativeCarrierText } from "@lararium/tw5";
import type { Tw5Deserializer } from "@lararium/tw5";
import type { CarrierFile } from "@lararium/tw5";

let root = "";
afterEach(() => { if (root) { rmSync(root, { recursive: true, force: true }); root = ""; } });

/** A minimal but faithful native JSON congruence: TW5's own `application/json`
 *  file-info always re-serializes to ONE canonical (sorted-key, 2-space) form,
 *  whatever the disk bytes' key order/whitespace — exactly what makes reordered
 *  JSON keys a framing-only edit, never a semantic one. */
function jsonDeserializer(): Tw5Deserializer {
  return {
    deserialize: (_ext, text) => {
      try { return [JSON.parse(text) as Record<string, unknown>]; } catch { throw new Error("bad json"); }
    },
    parseFields: (metaText) => {
      const fields: Record<string, unknown> = {};
      for (const line of metaText.split("\n")) {
        const m = /^([^:\s]+):\s*(.*)$/.exec(line);
        if (m) fields[m[1]!] = m[2];
      }
      return fields;
    },
    renderCarrier: (_uri, fields) => {
      const sorted: Record<string, unknown> = {};
      for (const k of Object.keys(fields).sort()) sorted[k] = fields[k];
      return { body: JSON.stringify(sorted, null, 2) };
    },
    serializeBundle: () => { throw new Error("not used"); },
    contentTypeFromExt: () => undefined,
  };
}

/** A projector wired exactly as `island-behaviors.ts` wires the live one — a
 *  `canonicalizeNativeFn` closing over the real `canonicalizeNativeCarrierText`
 *  door, the SAME function the memetic clause reads through `canonicalizeFn`. */
function rig(recordsFields: Record<string, unknown>, syncedHash: string | null): { projector: LarDiskProjector; root: string; syncedTree: SyncedTree } {
  root = mkdtempSync(join(tmpdir(), "lar-native-congruence-"));
  const uri = String(recordsFields["title"]);
  const deserializer = jsonDeserializer();
  const recordsRendered = deserializer.renderCarrier(uri, recordsFields);
  const syncedTree = new SyncedTree(join(root, "synced-tree.json"));
  if (syncedHash !== null) syncedTree.set(syncedTreeKey("wiki", uri), syncedHash);
  const file: CarrierFile = { ext: ".json", body: recordsRendered.body, defaultRelPath: `${uri.replace(/[:/]/g, "_")}.json` };
  const projector = new LarDiskProjector({
    mirrors: [{ bagId: "wiki", mirrorRoot: root }],
    carrierFileFn: async () => file,
    debounceMs: 1,
    syncedTree,
    canonicalizeNativeFn: (u, ext, diskBody, diskMeta) => canonicalizeNativeCarrierText(deserializer, u, ext, diskBody, diskMeta),
  });
  return { projector, root, syncedTree };
}

describe("the projecting leg's native congruence, wired into LarDiskProjector.flush", () => {
  // A FOREIGN title (no `lar:` uri-path) so the flattened default sites the file at the path this
  // rig computes directly — the loci law governs a `lar:///…` name instead, which is exercised by
  // `native-canonical.test.ts` and `foreign-title-projection.test.ts` already.
  const URI = "My JSON Doc";

  test("★ RED-FIRST: a native both-move that only REFRAMED (reordered JSON keys) projects canonical-equivalent — NOT conflict ★", async () => {
    // The records' render (sorted, 2-space) — what the projector WOULD write.
    const records = { title: URI, type: "application/json", a: "1", b: "2" };
    const anchor = carrierHash(jsonDeserializer().renderCarrier(URI, { title: URI, type: "application/json", a: "0", b: "0" }).body, undefined);
    const { projector, root } = rig(records, anchor);
    // The disk holds the SAME meaning, reordered + differently whitespaced —
    // NOT the anchor's bytes (so it reads as "moved" on the byte hashes alone).
    const diskPath = join(root, `${URI.replace(/[:/]/g, "_")}.json`);
    mkdirSync(dirname(diskPath), { recursive: true });
    writeFileSync(diskPath, `{"b":"2","type":"application/json","a":"1","title":"${URI}"}`, "utf-8");
    const conflicts: string[] = [];
    (projector as unknown as { onConflict: (i: { reason: string }) => void }).onConflict = (i) => conflicts.push(i.reason);
    await projector.flush("wiki", URI);
    // GREEN once wired: the write NORMALIZES the disk to the canonical form; no conflict fired.
    expect(conflicts).toEqual([]);
    expect(readFileSync(diskPath, "utf-8")).toBe(JSON.stringify({ a: "1", b: "2", title: URI, type: "application/json" }, null, 2));
  });

  test("CONTROL — a genuine native both-move (real divergence, not reframing) STILL conflicts", async () => {
    const records = { title: URI, type: "application/json", a: "1", b: "2" };
    const anchor = carrierHash(jsonDeserializer().renderCarrier(URI, { title: URI, type: "application/json", a: "0", b: "0" }).body, undefined);
    const { projector, root } = rig(records, anchor);
    const diskPath = join(root, `${URI.replace(/[:/]/g, "_")}.json`);
    mkdirSync(dirname(diskPath), { recursive: true });
    // A REAL semantic divergence: the disk says `a: "99"`, the records say `a: "1"`.
    writeFileSync(diskPath, JSON.stringify({ title: URI, type: "application/json", a: "99", b: "2" }), "utf-8");
    const conflicts: string[] = [];
    const before = readFileSync(diskPath, "utf-8");
    (projector as unknown as { onConflict: (i: { reason: string }) => void }).onConflict = (i) => conflicts.push(i.reason);
    await projector.flush("wiki", URI);
    expect(conflicts.length).toBe(1);
    // Surfaced, never overwritten — the operator's disk bytes survive untouched.
    expect(readFileSync(diskPath, "utf-8")).toBe(before);
  });

  test("CONTROL — with NO canonicalizeNativeFn injected, the same reframing-only both-move conflicts (fail-closed baseline)", async () => {
    root = mkdtempSync(join(tmpdir(), "lar-native-congruence-"));
    const uri = URI;
    const deserializer = jsonDeserializer();
    const anchor = carrierHash(deserializer.renderCarrier(uri, { title: uri, type: "application/json", a: "0", b: "0" }).body, undefined);
    const syncedTree = new SyncedTree(join(root, "synced-tree.json"));
    syncedTree.set(syncedTreeKey("wiki", uri), anchor);
    const recordsRendered = deserializer.renderCarrier(uri, { title: uri, type: "application/json", a: "1", b: "2" });
    const file: CarrierFile = { ext: ".json", body: recordsRendered.body, defaultRelPath: `${uri.replace(/[:/]/g, "_")}.json` };
    const projector = new LarDiskProjector({
      mirrors: [{ bagId: "wiki", mirrorRoot: root }],
      carrierFileFn: async () => file,
      debounceMs: 1,
      syncedTree,
      // NO canonicalizeNativeFn — the pre-existing wiring.
    });
    const diskPath = join(root, `${uri.replace(/[:/]/g, "_")}.json`);
    writeFileSync(diskPath, `{"b":"2","type":"application/json","a":"1","title":"${uri}"}`, "utf-8");
    const conflicts: string[] = [];
    (projector as unknown as { onConflict: (i: { reason: string }) => void }).onConflict = (i) => conflicts.push(i.reason);
    await projector.flush("wiki", uri);
    expect(conflicts.length).toBe(1);   // the gap this whole file exists to close
  });
});
