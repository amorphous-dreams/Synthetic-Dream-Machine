import { afterEach, expect, test, vi } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { operatorDaemonOptions } from "@lararium/keyhive/operator-daemon-behavior";
import { VerbTable } from "@lararium/tw5";
import { standFoundedIsland } from "./stand-founded-island.js";
import { nodeSealedStoreShore } from "../src/sealed-store-island.js";

vi.setConfig({ testTimeout: 900_000, hookTimeout: 900_000 });
const teardown: Array<() => void> = [];
afterEach(() => { while (teardown.length) { try { teardown.pop()!(); } catch { /* best-effort */ } } });
const BAG = "lar:///ha.ka.ba/@test/bags/fence";
const entry = (auth: any) => {
  const { atom, personaGroupId, faceAnchor, personaKel, deviceEdge, signerDid, meshCabalDocIdHex, veilArchiveBytes, faceAddressSecret, registerBags } = auth;
  return { atom, personaGroupId, faceAnchor, personaKel, deviceEdge, signerDid, meshCabalDocIdHex, veilArchiveBytes, faceAddressSecret, registerBags };
};

test("a content verb refuses a presenter that is not the mounted face, by name", async () => {
  const a = await standFoundedIsland(teardown);
  const b = await standFoundedIsland(teardown, { seedOffset: 10 });
  const root = mkdtempSync(join(tmpdir(), "content-fence-")); teardown.push(() => rmSync(root, { recursive: true, force: true }));
  const opts = operatorDaemonOptions({ daemonAuth: { ...a.daemonAuth, joinedFaces: [entry(b.daemonAuth)] } } as never,
    { dyadReading: () => "clear", sealedStore: nodeSealedStoreShore(join(root, "daemon")), persistArchive: () => {}, persistVeilArchive: () => {} });
  const kh = await opts.verifierFactory!(a.ctx) as { dispose?: () => Promise<void> };
  teardown.push(() => { void kh.dispose?.(); });
  const registry = new VerbTable();
  opts.wireWorkerVerbs!(registry, a.ctx);
  const ctxOf = (presenter: string) => ({ daemon: {} as never, invocation: { requestId: "r1", args: {} } as never, cap: async () => ({ ok: true }), presenter }) as never;
  const call = (verb: string, presenter: string, args: Record<string, unknown>) =>
    Promise.resolve().then(() => registry.get(verb)!(args, ctxOf(presenter))).then(() => null, (e: { reason?: string }) => e);
  const sibling = `0x${b.daemonAuth.atom.key}`;
  const mounted = `0x${a.daemonAuth.atom.key}`;
  const args = { sealed: { bag: BAG, text: "x", ref: "" }, create: { bag: BAG, plane: "persona" }, wiki: { slug: "fence" } };
  const more = ["sealed-reading", "sealed-choose-head", "sealed-hand-over", "sealed-admit", "sealed-parcels", "sealed-receive", "sealed-serve", "sealed-memory-cut", "sealed-memory-door", "sealed-memory-import", "sealed-rolls", "seat-duties"];
  const stood = more.filter((verb) => registry.has(verb));
  // Silent-zero guard: the sweep must find the sealed verbs it names, or it proves nothing.
  expect(stood.length).toBeGreaterThanOrEqual(8);
  for (const [verb, a2] of [["sealed-seal", args.sealed], ["sealed-open", args.sealed], ["CREATE", args.create], ["init-wiki", args.wiki], ...stood.map((v) => [v, args.sealed] as const)] as const) {
    expect(registry.has(verb), verb).toBe(true);
    expect(await call(verb, sibling, a2), verb).toMatchObject({ reason: "content-mounted-only" });
    // CONTROL: the mounted face's call passes the fence (it may refuse for another reason).
    expect(await call(verb, mounted, a2), `${verb} mounted`).not.toMatchObject({ reason: "content-mounted-only" });
  }
});
