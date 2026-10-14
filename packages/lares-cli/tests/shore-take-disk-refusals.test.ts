/**
 * TAKE-DISK TAKES NOTHING IT CANNOT PROVE.
 *
 * The door lands a file's words only where its key still names the state on both sides. Two shapes carry
 * no such proof, and each refuses by name before or after the wave, never with a false "landed":
 *
 *   · a POINTER carrier (an image, a flagged blob): the island weighs a pointer by content address and
 *     never against the records the key folded, so the door sends no wave at all;
 *   · a PACK file: the island settles it member by member, each against its own base, so where a member
 *     stands off the answer says how many landed and names the ones that did not.
 */
import { afterEach, describe, test, expect } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { carrierHash, VERB_RESULT_KEY } from "@lararium/mesh";
import { SyncedTree } from "@lararium/node";
import { takeDisk, type TakeDiskDeps } from "../src/shore-take-disk.js";
import type { ShoreAnswer } from "../src/shore-core.js";
import type { SubmitIngestOpts } from "../src/ingest-core.js";
import type { SubmitResult } from "../src/verb-result.js";

const BAG = "lar:///ha.ka.ba/bags/x";
const KEY = "a".repeat(24);
let tmp = "";
afterEach(() => { if (tmp) { rmSync(tmp, { recursive: true, force: true }); tmp = ""; } });

/** A scratch file, and a shore that names one `sides` standoff for it under KEY with the file's own hash. */
function standing(name: string, body: string, uri: string): { path: string; deps: (submit: TakeDiskDeps["submit"]) => TakeDiskDeps; waves: SubmitIngestOpts[] } {
  tmp = mkdtempSync(join(tmpdir(), "take-disk-"));
  const dir = join(tmp, "bags", "x", "ha.ka.ba", "x");
  mkdirSync(dir, { recursive: true });
  const path = join(dir, name);
  writeFileSync(path, body);
  const waves: SubmitIngestOpts[] = [];
  const ask = async (): Promise<ShoreAnswer> => ({
    ok: true, refusal: null, why: null,
    output: { ok: true, standoffs: [{ bagId: BAG, uri, standoff: KEY, kind: "sides", reason: "r", path, disk: carrierHash(body), records: "sha256:" + "0".repeat(64) }], standoffCount: 1 },
  });
  return { path, waves, deps: (submit) => ({ ask, tree: new SyncedTree(join(tmp, "synced")), root: tmp, did: "did:test", submit: async (o) => { waves.push(o); return submit!(o); } }) };
}

describe("lares shore take-disk — an answer that cannot prove its state takes nothing", () => {
  test("★ a pointer carrier refuses by name, and no wave leaves the door ★", async () => {
    const uri = "lar:///ha.ka.ba/x/photo";
    const s = standing("photo.png", "not really a png, and the type alone decides", uri);
    const taken = await takeDisk({ uri, key: KEY }, s.deps(async () => { throw new Error("no wave may ride for a pointer"); }));
    expect(taken).toMatchObject({ ok: false, refusal: "pointer-body-holds-no-key-proof" });
    expect((taken as { why: string }).why).toContain("lares ingest");
    expect(s.waves).toEqual([]);
  });

  test("★ a pack whose member stands off answers how many landed and names the ones that did not ★", async () => {
    const uri = "lar:///ha.ka.ba/x/pack";
    const s = standing("pack.json", JSON.stringify([{ title: "A", text: "a" }, { title: "B", text: "b" }]), uri);
    const submit = async (): Promise<SubmitResult> => ({
      status: "done", requestId: "req-pack",
      results: { [VERB_RESULT_KEY]: { ok: true, output: { carriers: [{ uri, decision: "conflict", pack: "ha.ka.ba/x/pack.json", landed: 1, members: [{ title: "A", decision: "ingest" }, { title: "B", decision: "conflict", reason: "both-moved" }] }] } } },
    }) as SubmitResult;
    const taken = await takeDisk({ uri, key: KEY }, s.deps(submit));
    expect(taken).toMatchObject({ ok: false, refusal: "pack-members-stand-off" });
    expect((taken as { why: string }).why).toMatch(/1 member\(s\) landed/);
    expect((taken as { why: string }).why).toContain("B");
    expect(s.waves).toHaveLength(1);
  });

  test("CONTROL: a plain text carrier under the same key rides one wave whose base names the records the key folded", async () => {
    const uri = "lar:///ha.ka.ba/x/note";
    const s = standing("note.md", "a hand's words\n", uri);
    const submit = async (o: SubmitIngestOpts): Promise<SubmitResult> => ({
      status: "done", requestId: "req-note",
      results: { [VERB_RESULT_KEY]: { ok: true, output: { carriers: o.candidates.map((c) => ({ uri: c.uri, decision: "ingest", grade: "clean", landed: 1 })) } } },
    }) as SubmitResult;
    const taken = await takeDisk({ uri, key: KEY }, s.deps(submit));
    expect(taken).toMatchObject({ ok: true, uri, bag: BAG, key: KEY, path: s.path });
    expect(s.waves).toHaveLength(1);
    expect(s.waves[0]!.candidates.map((c) => [c.uri, c.syncedHash, c.syncedRecordsHash])).toEqual([[uri, "sha256:" + "0".repeat(64), undefined]]);
    expect(s.waves[0]!.unattended).toBeUndefined();
  });
});
