/**
 * e2e/face-catalog-split — the catalog splits by face on a running node vessel (lar:///ha.ka.ba/lararium/mesh/sealed-store#/owed,
 * U1): the floor's catalog names public rows alone, the lit face's own catalog names that face's rows, and a locked vessel
 * boots and serves on the floor with no face row to read.
 *
 *   S1 — a lit vessel CREATEs a user bag: the floor's catalog, decoded off its rest, names no face-class row at all
 *        (POSITIVE FIRST: the floor decodes to its public rows); the face's own catalog rests at its shard SEALED: it
 *        decodes to no clear row, and the opened reader (tools/opened-store.mjs) reads the bag's row there
 *   S2 — CONTROL, the floor: the same root restarts LOCKED, reaches live, opens no face's catalog and binds its rendezvous
 *   S3 — the locked floor's catalog, decoded at rest after its boot, still names no face-class row: nothing at the floor
 *        wrote one
 *
 * One staged vessel; scratch LAR_ROOT; no LAR_BAGS. A lone vessel dials no Nexus, yet its worn face stands at its own
 * place: the place session seals the face's catalog from boot (session-contract#/the-hands), so its rest reads sealed.
 */
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { cpSync, mkdtempSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Repo, type AutomergeUrl } from "@automerge/automerge-repo";
import { NodeFSStorageAdapter } from "@automerge/automerge-repo-storage-nodefs";
import { awaitRendezvous, bootDocUrl, openStaged, stagedTarget, vesselStorageDir, type LarInstance } from "../harness/instance.js";
import { catalogRowHalf } from "../../packages/lararium-mesh/src/catalog-view.js";
import { openedStoredApart } from "../../tools/opened-store.mjs";

const BAG = `lar:///ha.ka.ba/bags/split-${process.pid}`;
let A: LarInstance | null = null;
let root = "";
let port = 0;
const said = (r: { stdout: string; stderr: string }): string => `${r.stdout}\n${r.stderr}`;

/** The live titles one document's rest decodes to, read by a fresh Repo over a copy of its shard alone; null: no shard. */
async function titlesAtRest(store: string, url: string): Promise<string[] | null> {
  const id = url.replace(/^automerge:/, "");
  const shard = join(store, id.slice(0, 2), id.slice(2));
  if (!statSync(shard, { throwIfNoEntry: false })?.isDirectory()) return null;
  const copy = mkdtempSync(join(tmpdir(), "split-rest-"));
  cpSync(shard, join(copy, id.slice(0, 2), id.slice(2)), { recursive: true });
  const repo = new Repo({ storage: new NodeFSStorageAdapter(copy), network: [] });
  try {
    const handle = await Promise.race([
      repo.find<{ tiddlers?: Record<string, unknown> }>(url as AutomergeUrl),
      new Promise<null>((r) => setTimeout(() => r(null), 15_000)),
    ]);
    return handle ? Object.keys(handle.doc()?.tiddlers ?? {}) : [];
  } catch { return []; }
  finally { await repo.shutdown().catch(() => undefined); }
}
const faceCatalogOf = (v: LarInstance): string | null => /\[catalog\] the face's own catalog stands: (automerge:[A-Za-z0-9]+)/.exec(v.bootLog())?.[1] ?? null;

beforeAll(async () => {
  if (!stagedTarget) return;
  A = await openStaged({ tag: "face-catalog-split" });
  root = A.root; port = A.port;
}, 400_000);
afterAll(async () => { await A?.stop(); });

describe.skipIf(!stagedTarget)("the catalog splits by face on a running node vessel", () => {
  test("S1 — a lit vessel's user bag rests in the face's own catalog, sealed; the floor's names no face-class row", async () => {
    const mint = await A!.cli(["act", "CREATE", "--bag", BAG, "--yes", "--json"]);
    expect(mint.json?.["ok"], said(mint)).toBe(true);
    const faceUrl = faceCatalogOf(A!);
    const floorUrl = bootDocUrl(A!, "catalog");
    expect(faceUrl, A!.bootLog().slice(-3000)).not.toBeNull();
    expect(floorUrl).not.toBeNull();
    await A!.stopDaemonOnly();
    // barrier: the stand-down's own exit.
    const store = vesselStorageDir(A!);
    const floor = await titlesAtRest(store, floorUrl!);
    expect(floor?.length ?? 0, "POSITIVE: the floor decodes to its public rows").toBeGreaterThan(0);
    expect(floor!.filter((t) => catalogRowHalf(t) === "face")).toEqual([]);
    expect(floor).not.toContain(BAG);
    // barrier: the face's catalog rests at its own shard (a scan of nothing proves nothing), and rests sealed.
    const face = await titlesAtRest(store, faceUrl!);
    expect(face, `the face catalog's rest at ${faceUrl}`).not.toBeNull();
    expect(face, "the face catalog decodes to no clear row at rest").toEqual([]);
    // The vessel's own reading opens it: the sealed catalog names the bag the face minted.
    const opened = await openedStoredApart(root);
    const faceId = faceUrl!.replace(/^automerge:/, "");
    expect(opened.sealedIds, "the face catalog rests sealed").toContain(faceId);
    const faceDoc = opened.docs.find((d) => d.id === faceId)?.doc as { tiddlers?: Record<string, unknown> } | undefined;
    expect(Object.keys(faceDoc?.tiddlers ?? {}), "the opened face catalog names the bag").toContain(BAG);
  }, 240_000);

  test("S2 — CONTROL: the same root restarts locked, reaches live, opens no face catalog and binds its rendezvous", async () => {
    A = await openStaged({ tag: "face-catalog-split-locked", root, port, locked: true, found: async () => {} });
    expect(faceCatalogOf(A), "a locked floor opens no face's catalog").toBeNull();
    // It serves: its rendezvous binds and answers.
    expect(await awaitRendezvous(A), A.bootLog().slice(-2000)).toBe(true);
  }, 240_000);

  test("S3 — the locked floor's catalog, at rest after its boot, still names no face-class row", async () => {
    const floorUrl = bootDocUrl(A!, "catalog");
    await A!.stopDaemonOnly();
    const floor = await titlesAtRest(vesselStorageDir(A!), floorUrl!);
    expect(floor?.length ?? 0).toBeGreaterThan(0);
    expect(floor!.filter((t) => catalogRowHalf(t) === "face")).toEqual([]);
  }, 120_000);
});
