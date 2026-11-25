/**
 * THE DOCUMENT CENSUS READS EVERY NAME (`lares vessel census --docs`).
 *
 * A scratch house's store holds documents named each way the house names one, and documents nothing names: the census
 * reads each back in its class. A binding-mint census alone read zero over 79 orphan maps, so every reference kind is
 * planted here and must read; an island store's copy of a root document reads `duplicate`; a document no live name
 * reaches reads `orphan`, and one named only by an orphan reads orphan too; a document holding sync state alone reads
 * `last-version`; and a sealed document the vessel holds no key for reads `sealed-unread`, never guessed an orphan.
 *
 * Controls: the census removes nothing (every file stands after it), and a sealed document the door can open counts
 * its own references.
 */
import { afterEach, describe, expect, test } from "vitest";
import { cpSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Repo, type AutomergeUrl } from "@automerge/automerge-repo";
import { NodeFSStorageAdapter } from "@automerge/automerge-repo-storage-nodefs";
import * as A from "@automerge/automerge";
import { composeVessel, type CapModule } from "@lararium/mesh/cap-compose";
import { deterministicDocUrl } from "@lararium/mesh/deterministic-doc";
import { seatMintCensus } from "@lararium/mesh/mint-census";
import { type DocCensusRow } from "@lararium/mesh/doc-census";
import { readDocCensus, ROOT_STORE } from "../src/doc-census-door.js";

const dirs: string[] = [];
afterEach(() => { for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true }); });

const idOf = (url: string): string => url.replace(/^automerge:/, "");
const row = (fields: Record<string, unknown>) => ({ tiddler: fields, meta: {} });

/** Walk every file under `dir`, for the removes-nothing control. */
function files(dir: string): string[] {
  const out: string[] = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) out.push(...files(p)); else out.push(p);
  }
  return out.sort();
}

async function plantHouse() {
  const storageDir = mkdtempSync(join(tmpdir(), "doc-census-"));
  dirs.push(storageDir);
  const repo = new Repo({ storage: new NodeFSStorageAdapter(storageDir), network: [] });
  const doc = (tiddlers: Record<string, unknown> = {}): AutomergeUrl => repo.create({ tiddlers }).url;
  const mint = doc({ x: row({ text: "minted" }) });
  const bound = doc({ x: row({ text: "bound" }) });
  const bag = doc({ x: row({ text: "a bag" }) });
  const slot = doc({ x: row({ text: "a slot" }) });
  const ctlRow = doc({ x: row({ text: "a device" }) });
  const catRow = doc({ x: row({ text: "a bag's doc" }) });
  const control = doc({ "device/one": row({ text: ctlRow }) });
  const daemon = doc({
    [`personal-minted/fp1/${idOf(mint)}`]: row({ text: mint, kind: "binding-mint", "binding-kind": "personal-binding" }),
    "lar:///ha.ka.ba/bindings/fp2": row({ text: bound, kind: "personal-binding", fingerprint: "fp2" }),
    "lar:///ha.ka.ba/keyhive/bag-doc/vessel/abc": row({ text: "kh-doc", bag }),
    "lar:///ha.ka.ba/wikis/notes/personal": row({ text: slot }),
  });
  const catalog = doc({ "lar:///ha.ka.ba/bags/x": row({ text: catRow }) });
  const derivedUrl = deterministicDocUrl("lar:///ha.ka.ba/test/derived#a-key-never-labelled");
  const derived = repo.import(A.save(A.from({ tiddlers: {} })), { docId: idOf(derivedUrl) as never }).url;
  const second = doc({ y: row({ text: "named by an orphan" }) });
  const orphan = doc({ z: row({ text: second }) });
  await repo.flush();
  await repo.shutdown();
  // A SEALED DOCUMENT: bytes at rest that open as no Automerge chunk, and a key this test never hands the door.
  const sealedId = "5sea1edDocNoKeyHere1111111";
  mkdirSync(join(storageDir, sealedId.slice(0, 2), sealedId.slice(2), "snapshot"), { recursive: true });
  writeFileSync(join(storageDir, sealedId.slice(0, 2), sealedId.slice(2), "snapshot", "abc"), new TextEncoder().encode("lar-sealed-pointer v1 …"));
  // A SHELL: sync state alone, no chunk.
  const shellId = "4she11SyncStateOnly1111111";
  mkdirSync(join(storageDir, shellId.slice(0, 2), shellId.slice(2), "sync-state"), { recursive: true });
  writeFileSync(join(storageDir, shellId.slice(0, 2), shellId.slice(2), "sync-state", "peer-gone"), new Uint8Array([1, 2, 3]));
  // AN ISLAND STORE holding a copy of the mint document.
  const m = idOf(mint);
  cpSync(join(storageDir, m.slice(0, 2), m.slice(2)), join(storageDir, "notes", m.slice(0, 2), m.slice(2)), { recursive: true });
  return { storageDir, ids: Object.fromEntries(Object.entries({ mint, bound, bag, slot, ctlRow, catRow, control, daemon, catalog, derived, second, orphan }).map(([k, v]) => [k, idOf(v)])), sealedId, shellId };
}

describe("the document census reads every name", () => {
  test("★ each planted document reads back in its class, named by its kind ★", async () => {
    const { storageDir, ids, sealedId, shellId } = await plantHouse();
    // THE LIVE COMPOSITION: a Repo over the same store, a cap that mints at compose, and the pointers it reads back.
    const live = new Repo({ storage: new NodeFSStorageAdapter(storageDir), network: [] });
    seatMintCensus(live);
    let capMinted = "";
    const leak: CapModule = { id: "planted-cap", requires: [], build: () => { capMinted = live.create({ tiddlers: {} }).url; return {}; } };
    await composeVessel([leak]);
    await live.flush();
    const before = files(storageDir);
    const reading = await readDocCensus({
      storageDir,
      repo: live as never,
      roles: () => new Map([[ids.catalog!, "catalog"], [ids.control!, "control"], [ids.daemon!, "daemon"]]),
      pointers: () => [
        { id: ids.catalog!, kind: "catalog", by: "the catalog pointer" },
        { id: ids.daemon!, kind: "pointer", by: "the daemon document" },
        { id: ids.control!, kind: "control", by: "the control home" },
      ],
    });
    const of = (id: string, store = ROOT_STORE): DocCensusRow => reading.rows.find((r) => r.id === id && r.store === store)!;
    const kinds = (id: string): string[] => of(id).names.map((n) => n.kind);
    expect(of(ids.mint!).class).toBe("current");
    expect(kinds(ids.mint!)).toContain("binding-mint");
    expect(kinds(ids.bound!)).toContain("binding");
    expect(kinds(ids.bag!)).toContain("keyhive-bag");
    expect(kinds(ids.slot!)).toContain("slot");
    expect(kinds(ids.ctlRow!)).toContain("control");
    expect(kinds(ids.catRow!)).toContain("catalog");
    expect(kinds(ids.derived!)).toContain("derived");
    expect(of(ids.derived!).names.find((n) => n.kind === "derived")!.by).not.toContain("a-key-never-labelled");
    expect(kinds(idOf(capMinted))).toContain("cap-mint");
    for (const k of ["mint", "bound", "bag", "slot", "ctlRow", "catRow", "control", "daemon", "catalog", "derived"]) expect(of(ids[k]!).class, k).toBe("current");
    expect(of(ids.orphan!).class).toBe("orphan");
    expect(of(ids.orphan!).why).toBe("unnamed");
    expect(of(ids.second!).class).toBe("orphan");
    expect(of(ids.second!).why).toBe("named only by documents no live name reaches");
    expect(of(ids.mint!, "notes").class).toBe("duplicate");
    expect(of(shellId).class).toBe("last-version");
    expect(of(sealedId).class).toBe("sealed-unread");
    expect(of(sealedId).read).toBe("sealed-unread");
    expect(reading.unreadSealed).toBe(1);
    expect(reading.counts.orphan).toBe(2);
    expect(reading.counts.duplicate).toBe(1);
    expect(reading.stores.map((s) => s.name)).toEqual([ROOT_STORE, "notes"]);
    // CONTROL: the census removed and wrote nothing.
    expect(files(storageDir)).toEqual(before);
    await live.shutdown();
  });

  test("CONTROL: a sealed document the door opens counts its own references", async () => {
    const { storageDir, ids, sealedId } = await plantHouse();
    const opened = A.save(A.from({ tiddlers: { "lar:///ha.ka.ba/sealed/row": row({ text: `automerge:${ids.orphan}` }) } }));
    const reading = await readDocCensus({
      storageDir,
      repo: { handles: {} },
      roles: () => new Map(),
      pointers: () => [{ id: sealedId, kind: "pointer", by: "a sealed home" }],
      openSealed: async (id) => (id === sealedId ? [opened] : []),
    });
    const of = (id: string): DocCensusRow => reading.rows.find((r) => r.id === id && r.store === ROOT_STORE)!;
    expect(of(sealedId).read).toBe("opened");
    expect(of(sealedId).class).toBe("current");
    expect(of(ids.orphan!).class).toBe("current");
    expect(of(ids.orphan!).names.map((n) => n.from)).toContain(sealedId);
    expect(reading.unreadSealed).toBe(0);
  });

  test("a house with no island store reads its root alone", async () => {
    const storageDir = mkdtempSync(join(tmpdir(), "doc-census-bare-"));
    dirs.push(storageDir);
    const reading = await readDocCensus({ storageDir, repo: { handles: {} }, roles: () => new Map() });
    expect(reading.stores.map((s) => s.name)).toEqual([ROOT_STORE]);
    expect(reading.rows).toEqual([]);
  });
});
