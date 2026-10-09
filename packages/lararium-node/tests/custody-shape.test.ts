/**
 * custody-shape.test — the old-shape reader reads every home before any write and names one of four
 * shapes: `fresh` · `floor-only` · `slotted` · `old-shape`.
 *
 * A home holding a secret with no slot tree to guard it, a carrier under the retired `LARK` envelope, or a
 * cleartext secret beside a slot tree reads OLD SHAPE, and the reader names every offender. The reader
 * writes nothing: a recursive hash of every home reads identical before and after.
 *
 * The VK envelope's recognizer arrives as an input (`sealed`), so the reader names no envelope of its own;
 * these tests stand a fixture recognizer that answers for a fixture magic.
 */
import { describe, test, expect } from "vitest";
import { createHash } from "node:crypto";
import { existsSync, mkdtempSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { readCustodyShape, oldShapeRefusal, FRESH_START_RUNBOOK } from "../src/custody-shape.js";
import type { CustodyHomes } from "../src/vault-carriers.js";

const FIXTURE_MAGIC = Buffer.from("FIXTURE-VK-SEAL:");
/** The fixture recognizer: bytes that open with the fixture magic read sealed. */
const reading = { sealed: (head: Uint8Array): boolean => Buffer.from(head).subarray(0, FIXTURE_MAGIC.length).equals(FIXTURE_MAGIC) };
const sealedBytes = (body: string): Buffer => Buffer.concat([FIXTURE_MAGIC, Buffer.from(body)]);
/** A carrier under the retired passphrase envelope: `LARK`, a version byte, then a frame. */
const larkBytes = (version: number): Buffer => Buffer.from([0x4c, 0x41, 0x52, 0x4b, version, 1, 0, 0, 0]);

function freshHomes(): { homes: CustodyHomes; root: string } {
  const root = mkdtempSync(join(tmpdir(), "lar-shape-"));
  return { root, homes: { identity: join(root, "identity"), storage: join(root, "vessel"), seal: join(root, "nexus") } };
}

function sow(homes: CustodyHomes, files: Record<string, string | Buffer>): void {
  for (const [rel, body] of Object.entries(files)) {
    const [home, ...rest] = rel.split("/");
    const key = home === "identity" ? "identity" : home === "vessel" ? "storage" : "seal";
    const path = join(homes[key], ...rest);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, body);
  }
}

/** Every directory and file under `root` with its bytes, hashed: the write-nothing witness. */
function treeHash(root: string): string {
  const h = createHash("sha256");
  const walk = (dir: string): void => {
    if (!existsSync(dir)) return;
    for (const name of readdirSync(dir).sort()) {
      const p = join(dir, name);
      if (statSync(p).isDirectory()) { h.update(`d:${p}\n`); walk(p); }
      else h.update(`f:${p}:`).update(readFileSync(p)).update("\n");
    }
  };
  walk(root);
  return h.digest("hex");
}

describe("readCustodyShape — the old-shape refusal reads before any write", () => {
  test("RED — a cleartext persona root with no slot tree reads OLD SHAPE, and every home stays byte-identical", () => {
    const { homes, root } = freshHomes();
    try {
      sow(homes, {
        "identity/.vessel-key-joshua.json": "{}",
        "identity/.persona-group-root-joshua-h0.json": '{"seed":"00"}',
        "nexus/founding-roster.mem": "charter",
      });
      const before = treeHash(root);
      const shape = readCustodyShape(homes, reading);
      expect(shape.kind).toBe("old-shape");
      if (shape.kind !== "old-shape") return;
      expect(shape.offenders).toEqual([
        { home: "identity", file: ".persona-group-root-joshua-h0.json", row: "persona-root", reason: "unslotted-secret" },
      ]);
      expect(treeHash(root)).toBe(before);
      const refusal = oldShapeRefusal(shape);
      expect(refusal).toContain(".persona-group-root-joshua-h0.json");
      expect(refusal).toContain(FRESH_START_RUNBOOK);
    } finally { rmSync(root, { recursive: true, force: true }); }
  });

  test("RED — a LARK carrier reads OLD SHAPE even beside a slot tree, and even when a recognizer would call it sealed", () => {
    const { homes, root } = freshHomes();
    try {
      sow(homes, {
        "identity/.vessel-key.json": "{}",
        "identity/vk-slots.bin": "slots",
        "identity/keyhive-archive.bin": larkBytes(1),
      });
      for (const r of [reading, { sealed: () => true }]) {
        const shape = readCustodyShape(homes, r);
        expect(shape.kind).toBe("old-shape");
        if (shape.kind === "old-shape") {
          expect(shape.offenders).toEqual([{ home: "identity", file: "keyhive-archive.bin", row: "keyhive-archive", reason: "retired-envelope" }]);
        }
      }
    } finally { rmSync(root, { recursive: true, force: true }); }
  });

  test("RED — a LARK carrier under a version byte nothing knows still reads OLD SHAPE (the magic decides, never the version)", () => {
    const { homes, root } = freshHomes();
    try {
      sow(homes, { "identity/vk-slots.bin": "slots", "identity/recovery-device-share-h0.bin": larkBytes(2) });
      const shape = readCustodyShape(homes, reading);
      expect(shape.kind === "old-shape" && shape.offenders.map((o) => o.reason)).toEqual(["retired-envelope"]);
    } finally { rmSync(root, { recursive: true, force: true }); }
  });

  test("RED — a cleartext secret beside a slot tree reads OLD SHAPE, in any home", () => {
    const { homes, root } = freshHomes();
    try {
      sow(homes, {
        "identity/vk-slots.bin": "slots",
        "identity/custody-root.bin": sealedBytes("root"),
        "vessel/walk/0123456789abcdef0123456789abcdef.json": '{"wallet":"plain"}',
        "nexus/transitions.json": "{}",
      });
      const shape = readCustodyShape(homes, reading);
      expect(shape.kind).toBe("old-shape");
      if (shape.kind === "old-shape") {
        expect(shape.offenders).toEqual([
          { home: "storage", file: "walk/0123456789abcdef0123456789abcdef.json", row: "walk", reason: "cleartext-beside-tree" },
          { home: "seal", file: "transitions.json", row: "transitions", reason: "cleartext-beside-tree" },
        ]);
      }
    } finally { rmSync(root, { recursive: true, force: true }); }
  });

  test("CONTROL: empty homes, and absent ones, read FRESH — the founding may write", () => {
    const { homes, root } = freshHomes();
    try {
      expect(readCustodyShape(homes, reading)).toEqual({ kind: "fresh" });
      mkdirSync(homes.identity); mkdirSync(homes.storage); mkdirSync(homes.seal);
      sow(homes, { "vessel/3f/chunk": "automerge", "identity/notes.txt": "x" });
      expect(readCustodyShape(homes, reading)).toEqual({ kind: "fresh" });
    } finally { rmSync(root, { recursive: true, force: true }); }
  });

  test("CONTROL: a home holding only floor carriers and no tree reads FLOOR-ONLY", () => {
    const { homes, root } = freshHomes();
    try {
      sow(homes, {
        "identity/.vessel-key.json": "{}",
        "identity/.vessel-kel.json": "{}",
        "identity/.vessel-card.json": "{}",
        "nexus/founding-roster.mem": "charter",
        "nexus/nexus/carriage-admit/AID1.json": "{}",
      });
      expect(readCustodyShape(homes, reading)).toEqual({ kind: "floor-only" });
    } finally { rmSync(root, { recursive: true, force: true }); }
  });

  test("CONTROL: a herm-shaped home (a tree guarding its cold next seed) reads SLOTTED", () => {
    const { homes, root } = freshHomes();
    try {
      sow(homes, {
        "identity/.vessel-key.json": "{}",
        "identity/.vessel-kel.json": "{}",
        "identity/vk-slots.bin": "slots",
        "identity/.vessel-next.json": sealedBytes("next"),
      });
      expect(readCustodyShape(homes, reading)).toEqual({ kind: "slotted" });
    } finally { rmSync(root, { recursive: true, force: true }); }
  });

  test("CONTROL: a hearth-shaped slotted home, every secret sealed in every home, reads SLOTTED and stays byte-identical", () => {
    const { homes, root } = freshHomes();
    try {
      sow(homes, {
        "identity/.vessel-key.json": "{}",
        "identity/vk-slots.bin": "slots",
        "identity/custody-root.bin": sealedBytes("root"),
        "identity/.persona-group-root-h0.json": sealedBytes("seed"),
        "identity/.handle-book.json": sealedBytes("book"),
        "vessel/hosting/0123456789abcdef0123456789abcdef/state.json": sealedBytes("state"),
        "nexus/founding-roster.mem": "charter",
        "nexus/transitions.json": sealedBytes("[]"),
      });
      const before = treeHash(root);
      expect(readCustodyShape(homes, reading)).toEqual({ kind: "slotted" });
      expect(treeHash(root)).toBe(before);
    } finally { rmSync(root, { recursive: true, force: true }); }
  });
});
