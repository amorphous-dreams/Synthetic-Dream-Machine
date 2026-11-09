import { afterEach, describe, expect, test, vi } from "vitest";
import { Repo } from "@automerge/automerge-repo";
import { daemonFaceCanonBag, emptyLarDoc, ownEntry, tiddlerText, type LarDoc } from "@lararium/mesh";
import { standFaceDaemonCanon } from "../src/face-daemon-canon.js";
import { openBrowserDaemonVm } from "../src/open-browser-daemon-vm.js";

vi.mock("@lararium/tw5", async (importOriginal) => ({
  ...await importOriginal<typeof import("@lararium/tw5")>(),
  openDaemonVmCore: vi.fn(async (_host, options) => options),
}));

describe("browser daemon face canon", () => {
  const repo = new Repo();
  afterEach(() => vi.clearAllMocks());
  const relation = "123e4567-e89b-42d3-a456-426614174000";

  test("carries the worn face's canon in the daemon recipe and grants", async () => {
    const catalog = repo.create<LarDoc>(emptyLarDoc());
    const daemon = repo.create<LarDoc>(emptyLarDoc());
    const canon = await standFaceDaemonCanon({ repo, control: catalog, faceRelation: relation });
    const result = await openBrowserDaemonVm({ repo, daemonUrl: daemon.url, coreHash: null,
      recipe: { wikiSlug: "daemon" }, grants: { islandUrl: catalog.url, wikiUrl: daemon.url, canonUrl: canon.url },
      faceRelation: relation, workerScriptUrl: new URL("./fixture.js", import.meta.url), caps: {} });
    expect((result as any).recipe.canonBag).toBe(daemonFaceCanonBag(relation));
    expect((result as any).grants.canonUrl).toBe(canon.url);
  });

  test("leaves the floor without a canon", async () => {
    const daemon = repo.create<LarDoc>(emptyLarDoc());
    const result = await openBrowserDaemonVm({ repo, daemonUrl: daemon.url, coreHash: null,
      recipe: { wikiSlug: "daemon" }, grants: { islandUrl: daemon.url, wikiUrl: daemon.url },
      workerScriptUrl: new URL("./fixture.js", import.meta.url), caps: {} });
    expect((result as any).recipe.canonBag).toBeUndefined();
    expect((result as any).grants.canonUrl).toBeUndefined();
  });

  test("reopens the document named in the face catalog", async () => {
    const catalog = repo.create<LarDoc>(emptyLarDoc());
    const first = await standFaceDaemonCanon({ repo, control: catalog, faceRelation: relation });
    const second = await standFaceDaemonCanon({ repo, control: catalog, faceRelation: relation });
    expect(second.url).toBe(first.url);
    expect(second.handle.url).toBe(first.handle.url);
  });
  test("control names a vessel's canon separately from another device and the face catalog", async () => {
    const deviceRepo = new Repo();
    const otherRepo = new Repo();
    const catalog = deviceRepo.create<LarDoc>(emptyLarDoc());
    const control = deviceRepo.create<LarDoc>(emptyLarDoc());
    const otherControl = otherRepo.create<LarDoc>(emptyLarDoc());
    const faceRelation = "123e4567-e89b-42d3-a456-426614174000";
    const first = await standFaceDaemonCanon({ repo: deviceRepo, control, faceRelation });
    const again = await standFaceDaemonCanon({ repo: deviceRepo, control, faceRelation });
    const other = await standFaceDaemonCanon({ repo: otherRepo, control: otherControl, faceRelation });
    const title = `lar:///ha.ka.ba/bags/control/daemon-canon/${encodeURIComponent(faceRelation)}`;
    expect(tiddlerText(ownEntry(control.doc()?.tiddlers, title))).toBe(first.url);
    expect(catalog.doc()?.tiddlers[title]).toBeUndefined();
    expect(catalog.doc()?.tiddlers[first.bagId]).toBeUndefined();
    expect(again.url).toBe(first.url);
    expect(other.url).not.toBe(first.url);
    await deviceRepo.shutdown(); await otherRepo.shutdown();
  });

});
