/**
 * sealed-store-island-dir — the daemon island finds its own storage directory whichever way its manifest names it,
 * so the content-key holder's shore stands on a vessel whose island owns its document.
 *
 * A node vessel's daemon island owns its document and keeps no other store: its manifest names a directory under
 * `ownedDocument.storage` and none under `storage`. The shore reads the vessel's storage root off whichever
 * directory the manifest names, so the `sealed/`, `cad/` and `cas/` tiers rest in one place either way.
 *
 * Canon: lar:///ha.ka.ba/lararium/mesh/sealed-store#/the-store
 */
import { describe, expect, test } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { islandStorageDirOf, nodeSealedStoreShore } from "../src/sealed-store-island.js";
import { openDaemonVm } from "../src/open-daemon-vm.js";

describe("the island's own storage directory", () => {
  test("an island that keeps a store of its own names that store", () => {
    expect(islandStorageDirOf({ storage: { type: "nodefs", dir: "/root/vessel/daemon" } })).toBe("/root/vessel/daemon");
  });

  test("an island that owns its document and keeps no other store names the owned document's directory", () => {
    expect(islandStorageDirOf({ ownedDocument: { storage: { type: "nodefs", dir: "/root/vessel/daemon-owned" } } })).toBe("/root/vessel/daemon-owned");
  });

  test("an island with no directory of its own names none", () => {
    expect(islandStorageDirOf({})).toBeNull();
    expect(islandStorageDirOf({ storage: { type: "memory" } })).toBeNull();
    expect(islandStorageDirOf({ ownedDocument: {} })).toBeNull();
    expect(islandStorageDirOf({ storage: { type: "nodefs", dir: "" } })).toBeNull();
  });

  test("both spellings rest the sealed tiers under ONE storage root", async () => {
    const root = mkdtempSync(join(tmpdir(), "sealed-island-dir-"));
    try {
      const a = nodeSealedStoreShore(islandStorageDirOf({ storage: { type: "nodefs", dir: join(root, "daemon") } })!);
      const b = nodeSealedStoreShore(islandStorageDirOf({ ownedDocument: { storage: { type: "nodefs", dir: join(root, "daemon-owned") } } })!);
      const cid = await a.staged.write(new TextEncoder().encode("a staged body"));
      // The other spelling's shore reads what the first one rested.
      expect(Buffer.from((await b.staged.read(cid))!).toString()).toBe("a staged body");
    } finally { rmSync(root, { recursive: true, force: true }); }
  });

  test("the vessel's own daemon island boots under an owned document, the spelling the shore must read", () => {
    // The composition's call names `ownedDocument: true` with a storage directory; `openDaemonVm` refuses the
    // owned split without one, so every vessel island that owns its document carries a directory the shore finds.
    expect(typeof openDaemonVm).toBe("function");
    return expect(openDaemonVm({ repo: {} as never, daemonUrl: "automerge:x", coreHash: "", grants: [], ownedDocument: true } as never)).rejects.toThrow(/ownedDocument requires a storageDir/);
  });
});
