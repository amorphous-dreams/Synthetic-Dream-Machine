/**
 * daemon-island-reopen — the node's daemon island stands through ONE seam, so an in-process re-open re-resolves its boot inputs.
 *
 * `standDaemonIsland({ resolvePlugins, open })` resolves the plugin CIDs through the shared resolver, opens the island with
 * them, and returns the holder (`@lararium/tw5` `holdDaemonVm`) whose `reopen` runs the same two steps again. The resolver
 * runs in `prepare`, so a refusal leaves the old island standing. Scripted fakes stand in for the resolver and the island.
 */
import { describe, expect, test } from "vitest";
import type { DaemonVmCore } from "@lararium/tw5";
import { KAPAE_EMERGENCY_REASON } from "@lararium/tw5";
import { standDaemonIsland } from "../src/daemon-island-reopen.js";

interface Fake extends DaemonVmCore { readonly cids: readonly string[]; readonly auth: object; downs: number }
function fakeVm(cids: readonly string[], auth: object): Fake {
  const vm = {
    cids, auth, downs: 0,
    syncLegReady: async () => `leg:${cids.join(",")}`,
    shutdown: async () => { vm.downs += 1; return { acked: true }; },
    dispose: () => { vm.downs += 1; },
  };
  return vm as unknown as Fake;
}

describe("the node's daemon island re-opens through the shared plugin resolver", () => {
  test("a plugin CID added before the restart loads after it, and a removed one is gone; the auth object is the same one", async () => {
    let offered = ["cid-a", "cid-b"];
    const auth = { unlocked: true };              // the closure the vessel built once: custody stays unlocked, nothing re-prompts
    let resolutions = 0;
    const held = await standDaemonIsland({
      readJoinedFaces: async () => [],
      resolvePlugins: async () => { resolutions += 1; return { ok: true as const, pluginCids: [...offered] }; },
      open: async (inputs) => fakeVm(inputs.pluginCids, auth),
    });
    expect((held.vm as unknown as Fake).cids).toEqual(["cid-a", "cid-b"]);
    offered = ["cid-a", "cid-b", "cid-c"];
    await held.restart("kapae-add");
    expect((held.vm as unknown as Fake).cids).toEqual(["cid-a", "cid-b", "cid-c"]);
    offered = ["cid-a", "cid-c"];
    await held.restart("kapae-remove");
    expect((held.vm as unknown as Fake).cids).toEqual(["cid-a", "cid-c"]);
    expect((held.vm as unknown as Fake).auth).toBe(auth);
    expect(resolutions).toBe(3);                  // CONTROL: one resolution per open, none memoized
  });

  test("a resolution that refuses at boot throws the boot error by name; at restart it leaves the old island standing", async () => {
    await expect(standDaemonIsland({
      readJoinedFaces: async () => [],
      resolvePlugins: async () => ({ ok: false as const, error: "offering absent" }),
      open: async () => { throw new Error("must not open"); },
    })).rejects.toThrow(/the daemon island's plugin resolution refused: offering absent/);
    let refuse = false;
    const opened: Fake[] = [];
    const held = await standDaemonIsland({
      readJoinedFaces: async () => [],
      resolvePlugins: async () => (refuse ? { ok: false as const, error: "offering gone" } : { ok: true as const, pluginCids: ["cid-a"] }),
      open: async (inputs) => { const vm = fakeVm(inputs.pluginCids, {}); opened.push(vm); return vm; },
    });
    refuse = true;
    await expect(held.restart("operator")).rejects.toThrow(/plugin resolution refused: offering gone/);
    expect(opened).toHaveLength(1);
    expect(opened[0]!.downs).toBe(0);
    expect(await held.vm.syncLegReady()).toBe("leg:cid-a");
    refuse = false;
    await held.restart("again");                  // CONTROL: the same seam recovers once the resolver answers
    expect(opened).toHaveLength(2);
    expect(opened[0]!.downs).toBe(1);
  });

  test("#1 each open reads every joined face's CURRENT standing: a sibling that locked since boot stays dark after a restart", async () => {
    let standing: Array<{ atom: { key: string } }> = [{ atom: { key: "sib-a" } }, { atom: { key: "sib-b" } }];
    const opened: string[][] = [];
    const held = await standDaemonIsland({
      readJoinedFaces: async () => standing as never,
      resolvePlugins: async () => ({ ok: true as const, pluginCids: [] }),
      open: async (inputs) => { opened.push((inputs.joinedFaces as unknown as typeof standing).map((f) => f.atom.key)); return fakeVm([], {}); },
    });
    standing = [{ atom: { key: "sib-a" } }];             // sib-b locked since boot
    await held.restart("operator");
    expect(opened).toEqual([["sib-a", "sib-b"], ["sib-a"]]);
    standing = [];                                       // every sibling locked: the island re-opens faceless
    await held.restart("operator");
    expect(opened.at(-1)).toEqual([]);
  });

  test("#5 the seam arms the emergency by the ONE exported reason, never by prose: that restart, with its plugin resolution refusing, closes the old island; every other reason keeps it", async () => {
    let refuse = false;
    const opened: Fake[] = [];
    const held = await standDaemonIsland({
      readJoinedFaces: async () => [],
      resolvePlugins: async () => (refuse ? { ok: false as const, error: "floor blob corrupt" } : { ok: true as const, pluginCids: [] }),
      open: async (inputs) => { const vm = fakeVm(inputs.pluginCids, {}); opened.push(vm); return vm; },
    });
    refuse = true;
    await expect(held.restart("operator")).rejects.toThrow(/floor blob corrupt/);
    expect(opened[0]!.downs).toBe(0);
    await expect(held.restart("kapae-raise")).rejects.toThrow(/floor blob corrupt/);   // prose never arms the brake
    await expect(held.restart("promote: kapae raised over a loaded rite ")).rejects.toThrow(/floor blob corrupt/);   // nor a near miss
    expect(opened[0]!.downs).toBe(0);
    await expect(held.restart(KAPAE_EMERGENCY_REASON)).rejects.toThrow(/floor blob corrupt/);
    expect(opened[0]!.downs).toBe(1);
    await expect(held.vm.syncLegReady()).rejects.toThrow(/daemon-down/);
  });
});
