/**
 * custody-shape.test — the custody shape reader reads every home before any write and names one of four
 * shapes: `fresh` · `floor-only` · `slotted` · `old-shape`.
 *
 * A home holding a secret with no slot tree to guard it, a carrier under an envelope this build cannot open,
 * or a cleartext secret beside a slot tree reads as a shape nothing here writes over, and the reader names
 * every offender. The reader writes nothing: a recursive hash of every home reads identical before and after.
 *
 * The VK envelope's recognizer arrives as an input (`sealed`); these tests stand a fixture recognizer that
 * answers for a fixture magic. The house envelope reader (`readVkCarrier`) names a frame no unlock here opens.
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
/** A seal of the house family under a scheme this build does not frame: the family prefix, a scheme name, a frame. */
const otherSchemeBytes = (scheme: string): Buffer => Buffer.concat([Buffer.from(`lares-${scheme}-seal`), Buffer.alloc(48, 7)]);
/** The house VK magic with two bytes damaged, over a frame long enough to hold a nonce and a tag. */
const damagedMagicBytes = (): Buffer => { const b = Buffer.concat([Buffer.from("lares-vk-seal"), Buffer.alloc(48, 9)]); b[2] = 0x58; b[7] = 0x58; return b; };

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

describe("readCustodyShape — the custody shape refusal reads before any write", () => {
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

  test("RED — a seal of another house scheme reads UNKNOWN-ENVELOPE even beside a slot tree, and even when a recognizer would call it sealed", () => {
    const { homes, root } = freshHomes();
    try {
      sow(homes, {
        "identity/.vessel-key.json": "{}",
        "identity/vk-slots.bin": "slots",
        "identity/keyhive-archive.bin": otherSchemeBytes("kh"),
      });
      for (const r of [reading, { sealed: () => true }]) {
        const shape = readCustodyShape(homes, r);
        expect(shape.kind).toBe("old-shape");
        if (shape.kind === "old-shape") {
          expect(shape.offenders).toEqual([{ home: "identity", file: "keyhive-archive.bin", row: "keyhive-archive", reason: "unknown-envelope" }]);
        }
      }
    } finally { rmSync(root, { recursive: true, force: true }); }
  });

  test("RED — a damaged house magic reads UNKNOWN-ENVELOPE (the frame decides, never the recognizer)", () => {
    const { homes, root } = freshHomes();
    try {
      sow(homes, { "identity/vk-slots.bin": "slots", "identity/recovery-device-share-h0.bin": damagedMagicBytes() });
      for (const r of [reading, { sealed: () => true }]) {
        const shape = readCustodyShape(homes, r);
        expect(shape.kind === "old-shape" && shape.offenders.map((o) => o.reason)).toEqual(["unknown-envelope"]);
      }
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

  test("CONTROL: a herm-shaped home (a tree guarding its custody root) reads SLOTTED", () => {
    const { homes, root } = freshHomes();
    try {
      sow(homes, {
        "identity/.vessel-key.json": "{}",
        "identity/.vessel-kel.json": "{}",
        "identity/vk-slots.bin": "slots",
        "identity/custody-root.bin": sealedBytes("root"),
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
