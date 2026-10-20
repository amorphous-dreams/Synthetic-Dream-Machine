/** The real worker assembly gives each house a private store and shuts it after its last session. */
import { describe, expect, test } from "vitest";
import { deviceEdgeDigest } from "../../lararium-mesh/src/device-delegation.js";
import type { HolderIsland, SharedHolderCore } from "../src/shared-holder-core.js";
import coreSource from "../src/shared-holder-core.ts?raw";
import { admitPort, faceFixture, fakePort, type Message } from "./holder-session-fixture.js";

type Runtime = { core: SharedHolderCore & { readonly houses: number }; storeName(group: string, root: string): Promise<string> };
async function runtime(env: unknown): Promise<Runtime> {
  const path = "../src/shared-holder-runtime.js";
  const module = await import(path).catch(() => null) as { makeHolderRuntime?: (env: unknown) => Runtime } | null;
  expect(module?.makeHolderRuntime, "makeHolderRuntime stands").toBeTypeOf("function");
  return module!.makeHolderRuntime!(env);
}
const settle = async () => { for (let i = 0; i < 10; i++) await Promise.resolve(); };

describe("the holder runtime", () => {
  test("two tabs share one house, then its last tab ends island and Repo once", async () => {
    const islands: Array<{ emit: (m: Message) => void; terminated: number }> = [];
    let shutdowns = 0; const stores: string[] = [];
    const env = {
      lockName: "runtime-test", locks: { request: async (_name: string, _options: unknown, callback: (lock: { name: string }) => unknown) => callback({ name: "runtime-test" }) },
      spawnIsland: (): HolderIsland => {
        const listeners = new Set<(m: unknown) => void>();
        const record = { emit: (m: Message) => { for (const listener of listeners) listener(m); }, terminated: 0 };
        islands.push(record);
        return { post: () => {}, listen: (listener) => { listeners.add(listener); return () => listeners.delete(listener); }, onError: () => () => {}, terminate: () => { record.terminated++; } };
      },
      openRepo: (storeName: string) => { stores.push(storeName); return { attachSide: (_port: MessagePort) => {}, shutdown: async () => { shutdowns++; } }; },
    };
    const r = await runtime(env);
    const face = await faceFixture("face:runtime", 41, 51);
    const first = fakePort(); await r.core.connect(first.endpoint);
    const opening = admitPort(first, face);
    await expect.poll(() => islands.length).toBe(1);
    islands[0]!.emit({ type: "gate:clear", edgeDigest: deviceEdgeDigest(face.edge), personaRoot: face.edge.personaRootDid });
    expect(await opening).toMatchObject({ kind: "holder:admitted" });
    const second = fakePort(); await r.core.connect(second.endpoint);
    expect(await admitPort(second, face)).toMatchObject({ kind: "holder:admitted" });
    expect(r.core.houses).toBe(1);
    expect(stores).toHaveLength(1);
    expect(stores[0]).not.toContain(face.group);
    expect(stores[0]).not.toContain(face.edge.personaRootDid);
    r.core.disconnect(first.endpoint); await settle();
    expect(islands[0]!.terminated).toBe(0);
    expect(shutdowns).toBe(0);
    r.core.disconnect(second.endpoint); await settle();
    expect(islands[0]!.terminated).toBe(1);
    expect(shutdowns).toBe(1);
    expect(r.core.houses).toBe(0);
    const other = await faceFixture("face:other", 42, 52);
    expect(await r.storeName(other.group, other.edge.personaRootDid)).not.toBe(await r.storeName(face.group, face.edge.personaRootDid));
  });

  test("the core holds no face key or face lock callback", () => {
    expect(coreSource, "the core takes no lockFace option").not.toMatch(/\blockFace\s*[?:]/);
    expect(coreSource, "the core drops no face lock fault").not.toContain('onDrop("face:lock"');
  });
});
