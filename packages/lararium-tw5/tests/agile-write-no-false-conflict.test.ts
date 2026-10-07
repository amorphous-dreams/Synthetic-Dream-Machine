/**
 * agile-write — the Confluence's echo gate reads TAGGED digests only.
 *
 * The producers that feed the gate — `carrierHash` (the disk `diskHash` + the projector's synced-tree
 * `obsHash`) and the render leg (`currentRenderHash`) — emit `sha256:<hex>`. A bare hex names no
 * algorithm, so a synced-tree anchor holding one matches nothing:
 *
 *   1. The producer emits tagged (`sha256:hex`).
 *   2. A byte-identical carrier against a TAGGED anchor reads `noop` (disk-matches-synced).
 *   3. A BARE anchor is never a merge base the gate trusts: where the records moved it reads CONFLICT
 *      (surfaced, never a silent noop that would hide the move), and where the disk moved alone it reads
 *      CONFLICT too, never a clean ingest. A disk that already says what the records say still reads
 *      `noop` by canonical equivalence — the next projection then records the tagged anchor.
 *   4. The mirror: a genuinely changed carrier against a tagged anchor still reads `ingest`.
 *
 * The gate is driven by an IDENTITY-render congruence (the native-carrier shape the
 * action-handler uses): deserialize → the record, render → the disk join, ∅ structure,
 * never graded. That isolates the proof to the DIGEST tag behavior alone — the render
 * shore never colors the result.
 */

import { describe, test, expect } from "vitest";
import { carrierHash, parseDigest, SHA256_ALGO } from "@lararium/mesh";
import { decideIngest } from "../src/ingest-gate.js";
import type { IngestOps } from "../src/ingest-gate.js";

// A minimal carrier: a `.meta` sidecar + body, exactly the surface `carrierHash`
// folds (meta + blank line + body). Its render leg is byte-identical to the disk.
const META = "type: text/plain\ntags: canary";
const BODY = "the byte-identical carrier that must never phantom-conflict";
const URI  = "lar:///agile.write.canary";
const join = (meta: string, body: string) => `${meta}\n\n${body}`;

// The gate's injected candidate-render hash — the SAME tagged producer the projector
// and disk use, so `candidateHash === currentRenderHash` stays tag-consistent inside
// the gate. A native carrier folds its `.meta` into the render, so this hashes the
// whole `meta\n\nbody` join.
function carrierHashOf(text: string): string {
  const at = text.indexOf("\n\n");
  return at >= 0 ? carrierHash(text.slice(at + 2), text.slice(0, at)) : carrierHash(text);
}

// The identity congruence: the disk text IS the canonical render (native shape).
const identityOps: IngestOps<{ text: string }> = {
  deserialize: (_uri, text) => ({ records: [{ text }], diagnostics: [], declared: new Set<string>() }),
  render: (_uri, records) => records[0]!.text,
  declaredStructure: () => new Set<string>(),
  grade: () => "clean",
};

// The freshly-computed disk digest rides TAGGED.
const diskHash = carrierHash(BODY, META);
// A bare anchor: the same content's hex with no algorithm named.
const bareStored = parseDigest(diskHash).hex;
// What the projector's `obsHash` writes: the same tagged value.
const taggedStored = diskHash;
// A records render that moved past the last projection.
const movedRender = carrierHash(`${BODY} (records moved)`, META);

describe("agile-write — the producer tags", () => {
  test("carrierHash emits an algorithm-tagged digest, not bare hex", () => {
    const p = parseDigest(diskHash);
    expect(p.algo).toBe(SHA256_ALGO);         // sha256
    expect(diskHash).toBe(`${p.algo}:${p.hex}`);
    expect(() => parseDigest(bareStored)).toThrow(/names no algorithm/);
  });
});

describe("agile-write — the echo gate reads tagged anchors only", () => {
  test("CONTROL: byte-identical carrier vs a tagged anchor → noop echo", () => {
    const d = decideIngest({
      uri: URI, diskText: join(META, BODY),
      diskHash, syncedHash: taggedStored,
      currentRenderHash: diskHash, hash: carrierHashOf,
    }, identityOps);
    expect(d).toEqual({ kind: "noop", reason: "disk-matches-synced" });
  });

  test("CONTROL: records moved, disk unmoved, tagged anchor → noop echo (the projection leg writes)", () => {
    const d = decideIngest({
      uri: URI, diskText: join(META, BODY),
      diskHash, syncedHash: taggedStored,
      currentRenderHash: movedRender, hash: carrierHashOf,
    }, identityOps);
    expect(d).toEqual({ kind: "noop", reason: "disk-matches-synced" });
  });

  test("★ the same state against a BARE anchor never reads noop — it reads CONFLICT ★", () => {
    const d = decideIngest({
      uri: URI, diskText: join(META, BODY),
      diskHash, syncedHash: bareStored,
      currentRenderHash: movedRender, hash: carrierHashOf,
    }, identityOps);
    expect(d.kind).toBe("conflict");
  });

  test("★ disk moved alone against a BARE anchor reads CONFLICT, never a clean ingest ★", () => {
    const editedBody = `${BODY} (edited on disk)`;
    const d = decideIngest({
      uri: URI, diskText: join(META, editedBody),
      diskHash: carrierHash(editedBody, META), syncedHash: bareStored,
      currentRenderHash: diskHash, hash: carrierHashOf,
    }, identityOps);
    expect(d.kind).toBe("conflict");
  });

  test("a disk that already says what the records say reads noop by equivalence, even over a bare anchor", () => {
    const d = decideIngest({
      uri: URI, diskText: join(META, BODY),
      diskHash, syncedHash: bareStored,
      currentRenderHash: diskHash, hash: carrierHashOf,
    }, identityOps);
    expect(d).toEqual({ kind: "noop", reason: "canonical-equivalent" });
  });

  test("mirror invariant — a genuinely CHANGED carrier still ingests (tag never masks an edit)", () => {
    const changedBody = `${BODY} — a real content change`;
    const changedDisk = carrierHash(changedBody, META);
    expect(changedDisk).not.toBe(diskHash);
    const d = decideIngest({
      uri: URI, diskText: join(META, changedBody),
      diskHash: changedDisk, syncedHash: taggedStored,     // synced = the OLD content
      currentRenderHash: taggedStored, hash: carrierHashOf,
    }, identityOps);
    expect(d.kind).toBe("ingest");
  });
});
