import { afterEach, expect, test, vi } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { FACE_NEUTRAL_VERBS, operatorDaemonOptions } from "@lararium/keyhive/operator-daemon-behavior";
import { VerbDispatcher, VerbTable } from "@lararium/tw5";
import { standFoundedIsland } from "./stand-founded-island.js";
import { nodeSealedStoreShore } from "../src/sealed-store-island.js";
import { realmFeedSlotUri } from "@lararium/mesh";

vi.setConfig({ testTimeout: 900_000, hookTimeout: 900_000 });
const teardown: Array<() => void> = [];
afterEach(() => { while (teardown.length) { try { teardown.pop()!(); } catch { /* best-effort */ } } });
const BAG = "lar:///ha.ka.ba/@test/bags/fence";
const entry = (auth: any) => {
  const { atom, personaGroupId, faceAnchor, personaKel, deviceEdge, signerDid, meshCabalDocIdHex, veilArchiveBytes, faceAddressSecret, registerBags } = auth;
  return { atom, personaGroupId, faceAnchor, personaKel, deviceEdge, signerDid, meshCabalDocIdHex, veilArchiveBytes, faceAddressSecret, registerBags };
};

/** One founded island with a sibling face lit beside the mounted one, and the daemon's verbs wired onto a table. */
async function standTwoFaces() {
  const a = await standFoundedIsland(teardown);
  const b = await standFoundedIsland(teardown, { seedOffset: 10 });
  const root = mkdtempSync(join(tmpdir(), "content-fence-")); teardown.push(() => rmSync(root, { recursive: true, force: true }));
  const opts = operatorDaemonOptions({ daemonAuth: { ...a.daemonAuth, joinedFaces: [entry(b.daemonAuth)] } } as never,
    { dyadReading: () => "clear", sealedStore: nodeSealedStoreShore(join(root, "daemon")), persistArchive: () => {}, persistVeilArchive: () => {} });
  const kh = await opts.verifierFactory!(a.ctx) as { dispose?: () => Promise<void> };
  teardown.push(() => { void kh.dispose?.(); });
  const registry = new VerbTable();
  opts.wireWorkerVerbs!(registry, a.ctx);
  const ctxOf = (presenter?: string, local = false) => ({ daemon: {} as never, invocation: { requestId: "r1", args: {} } as never, cap: async () => ({ ok: true }), local, ...(presenter === undefined ? {} : { presenter }) }) as never;
  const call = (verb: string, presenter: string | undefined, args: Record<string, unknown>, local = false) =>
    Promise.resolve().then(() => registry.get(verb)!(args, ctxOf(presenter, local))).then(() => null, (e: { reason?: string }) => e);
  return { registry, call, composite: (a.ctx as any).composite, sibling: `0x${b.daemonAuth.atom.key}`, mounted: `0x${a.daemonAuth.atom.key}` };
}

test("a sibling feeds only its own slot through the wired daemon fence", async () => {
  const { registry, call, composite, sibling, mounted } = await standTwoFaces();
  const realm = "ab".repeat(32);
  const own = sibling.replace(/^0x/, "");
  const other = mounted.replace(/^0x/, "");
  expect(registry.has("realm-feed")).toBe(true);
  // RED today: the fence refuses the sibling before its own offering reaches the reactor.
  expect(await call("realm-feed", sibling, { realm, writer: own })).toBeNull();
  expect((await composite.get(realmFeedSlotUri(realm, own)))?.tiddler.text).toBe("1");
  expect(await call("realm-feed", sibling, { realm, writer: other })).toMatchObject({ reason: "writer-not-presenter" });
  expect(await composite.get(realmFeedSlotUri(realm, other))).toBeNull();
});

test("a routed wiki-act crosses the same presenter fence before routing", async () => {
  const { registry, composite, sibling, mounted } = await standTwoFaces();
  const routed: string[] = [];
  const dispatcher = new VerbDispatcher({ daemon: composite, registry, verifier: { verify: async () => ({ ok: true }) },
    routeFn: async (invocation) => { routed.push(invocation.requestedBy); return {}; } } as never);
  const invocation = (requestedBy: string) => ({ requestId: requestedBy, title: "t", action: "wiki-act", requestedBy,
    args: { wiki: "home", verb: "CLEAR", args: { bag: "lar:///ha.ka.ba/wikis/home/working" } } });
  // CONTROL: a mounted presenter reaches main.
  await expect((dispatcher as any).runHandler(invocation(mounted))).resolves.toEqual({});
  expect(routed).toEqual([mounted]);
  // RED today: the routed path checks only capabilities and skips the table's fence.
  await expect((dispatcher as any).runHandler(invocation(sibling))).rejects.toMatchObject({ reason: "content-mounted-only" });
  expect(routed).toEqual([mounted]);
});

const SEALED = ["sealed-seal", "sealed-open", "sealed-reading", "sealed-choose-head", "sealed-hand-over", "sealed-admit", "sealed-parcels", "sealed-receive", "sealed-serve", "sealed-memory-cut", "sealed-memory-door", "sealed-memory-import", "sealed-rolls", "seat-duties"];
// The verbs that close over the mounted face's mint, slot documents or catalog (Aftermath M1 on PR #110).
const MOUNTED_MATERIAL = ["add-bag", "remove-bag", "prune-stale", "bag-compact", "rotate-recipe", "meme-put", "meme-delete", "draft", "pin", "register-cold"];

test("a content verb refuses a presenter that is not the mounted face, by name", async () => {
  const { registry, call, sibling, mounted } = await standTwoFaces();
  const args = { sealed: { bag: BAG, text: "x", ref: "" }, create: { bag: BAG, plane: "persona" }, wiki: { slug: "fence" }, bag: { bag: BAG, wiki: "fence", slug: "fence" } };
  // Silent-zero guard: this fixture lights a face with a catalog and an oracle, so EVERY named verb stands.
  expect(SEALED.filter((verb) => registry.has(verb))).toEqual(SEALED);
  expect(MOUNTED_MATERIAL.filter((verb) => registry.has(verb))).toEqual(MOUNTED_MATERIAL);
  const cases = [["CREATE", args.create], ["init-wiki", args.wiki], ...SEALED.map((v) => [v, args.sealed] as const), ...MOUNTED_MATERIAL.map((v) => [v, args.bag] as const)] as const;
  for (const [verb, a2] of cases) {
    expect(await call(verb, sibling, a2), verb).toMatchObject({ reason: "content-mounted-only" });
    // The fence fails closed: a call that names no presenter refuses too.
    expect(await call(verb, undefined, a2), `${verb} no presenter`).toMatchObject({ reason: "content-mounted-only" });
    // CONTROL: the mounted face's call passes the fence (it may refuse for another reason).
    expect(await call(verb, mounted, a2), `${verb} mounted`).not.toMatchObject({ reason: "content-mounted-only" });
    // A sibling's DID on the vessel's own channel refuses too; the channel lends no face.
    expect(await call(verb, sibling, a2, true), `${verb} local sibling`).toMatchObject({ reason: "content-mounted-only" });
  }
});

test("the vessel's own channel pushes under a label that names no face: it passes the fence, and the same label synced refuses", async () => {
  const { registry, call } = await standTwoFaces();
  for (const verb of ["switcher-state", "persona-state", "ward-alert", "pin"]) {
    expect(registry.has(verb), verb).toBe(true);
    expect(await call(verb, "persona", {}, true), `${verb} local label`).not.toMatchObject({ reason: "content-mounted-only" });
    expect(await call(verb, "persona", {}, false), `${verb} synced label`).toMatchObject({ reason: "content-mounted-only" });
    expect(await call(verb, "did:key:z6MkStranger", {}, true), `${verb} local stranger DID`).toMatchObject({ reason: "content-mounted-only" });
  }
});

test("THE CENSUS: every daemon verb is fenced unless it stands on the named neutral list, and a new verb is fenced by default", async () => {
  const { registry, call, sibling } = await standTwoFaces();
  const neutral: Readonly<Record<string, string>> = FACE_NEUTRAL_VERBS ?? {};
  // A verb registered after the wiring (the intent door's `intent-view` arrives this way) and named nowhere.
  registry.register("planted-unlisted", async () => ({ verb: "planted-unlisted" }));
  const verbs = registry.list();
  // Silent-zero guard: the census must see the wired registry, every named content verb and the plant among it.
  for (const verb of [...SEALED, ...MOUNTED_MATERIAL, "CREATE", "init-wiki", "planted-unlisted"]) expect(verbs, verb).toContain(verb);
  // Each neutral entry names a verb this daemon registers, and carries its one-line reason.
  for (const [verb, why] of Object.entries(neutral)) {
    expect(verbs, `neutral ${verb} registers`).toContain(verb);
    expect(why, `neutral ${verb} reason`).toMatch(/^[^\n]{12,}$/);
  }
  // Each neutral verb runs WHOLE for the sibling on arguments it accepts: a refusal of any kind reads as a fence.
  // RED today: realm-feed remains fenced even when its writer names the presenter.
  expect(neutral).toHaveProperty("realm-feed");
  const neutralArgs: Record<string, Record<string, unknown>> = { "realm-clock": { realm: "ab".repeat(32) }, "realm-feed": { realm: "ab".repeat(32), writer: sibling.replace(/^0x/, "") } };
  const open: string[] = [];
  const unfenced: string[] = [];
  for (const verb of verbs) {
    if (Object.hasOwn(neutral, verb)) {
      const refusal = await call(verb, sibling, neutralArgs[verb] ?? {});
      if (refusal !== null) open.push(`${verb}: ${String((refusal as { message?: string }).message ?? refusal)}`);
    } else if ((await call(verb, sibling, {}))?.reason !== "content-mounted-only") unfenced.push(verb);
  }
  expect(unfenced, "verbs neither fenced nor named neutral").toEqual([]);
  expect(open, "neutral verbs that refused the sibling").toEqual([]);
});
