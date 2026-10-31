/**
 * wiki-act-mounts-its-wiki — W27: "An act aimed at a wiki no island mounts asks the vessel to mount it, and refuses
 * gracefully, naming the cause, when the mount cannot stand." A working slot's cap mints at the wiki's FIRST MOUNT, and
 * the keyholder gate clears the cap BEFORE the wiki-act handler mounts anything, so an unmounted wiki's act refused
 * `bag not registered` and the mount that would register it never ran (the seed read 2/6 on a fresh root).
 *
 * Proven: an act on an unmounted wiki asks main to mount it (wiki-switch) and then lands; a presenter the fence
 * refuses triggers no mount (control: no wiki-switch recorded); a mount that cannot stand refuses by the name
 * `wiki-mount-refused: <cause>`; a daemon-slug or non-slot act asks no mount.
 */
import { describe, test, expect } from "vitest";
import { CompositeStore, DAEMON_BAG_ID, OUTCOME_URI_PREFIX, type CapabilityVerifier } from "@lararium/mesh";
import { MemoryTiddlerStore } from "../src/memory-store.js";
import { VerbDispatcher, VerbTable } from "../src/verb-dispatcher.js";
import type { TW5Engine } from "../src/tw5-vm.js";
import { routedWikiSlug } from "../src/verb-local-dispatch.js";

type F = Record<string, unknown>;
class FakeWiki {
  private readonly records = new Map<string, F>();
  private listeners: Array<(c: Record<string, { deleted?: boolean }>) => void> = [];
  readonly wiki = {
    addTiddler: (t: { fields?: F } | F): void => {
      const f = (t && "fields" in t && t.fields ? t.fields : t) as F;
      const title = String(f["title"]);
      this.records.set(title, { ...f });
      for (const l of this.listeners) l({ [title]: {} });
    },
    getTiddler: (title: string) => { const f = this.records.get(title); return f ? { fields: { ...f } } : undefined; },
    deleteTiddler: (title: string): void => { if (this.records.delete(title)) for (const l of this.listeners) l({ [title]: { deleted: true } }); },
    addEventListener: (type: string, fn: never): void => { if (type === "change") this.listeners.push(fn); },
    removeEventListener: (type: string, fn: unknown): void => { if (type === "change") this.listeners = this.listeners.filter((l) => l !== fn); },
  };
  readonly $tw = { Tiddler: class { fields: F; constructor(f: F) { this.fields = f; } }, wiki: this.wiki };
}
const makeDaemon = (): CompositeStore => {
  const c = new CompositeStore();
  c.addLayer({ bagId: DAEMON_BAG_ID, store: new MemoryTiddlerStore(DAEMON_BAG_ID), writable: true });
  return c;
};
const settle = async (): Promise<void> => { for (let i = 0; i < 20; i++) await new Promise((r) => setTimeout(r, 0)); };
const outcomeOf = async (daemon: CompositeStore, id: string) => (await daemon.getLive(OUTCOME_URI_PREFIX + id))?.tiddler;

const WORKING = "lar:///ha.ka.ba/wikis/orchard/working";
function stand(opts: { switchAnswer?: Record<string, unknown> | Error; fence?: boolean; deny?: string } = {}) {
  const daemon = makeDaemon();
  const routed: string[] = [];
  let mounted = false;
  // The working slot's cap mints at the first mount, as resolveBinding does.
  const verifier: CapabilityVerifier = {
    verify: async ({ bagUrl }) => opts.deny ? { ok: false, reason: opts.deny } : bagUrl === WORKING && !mounted ? { ok: false, reason: `bag not registered: ${bagUrl}` } : { ok: true },
  };
  const registry = new VerbTable();
  if (opts.fence) registry.fence({ open: {}, check: (verb, context) => {
    if (context.presenter !== "did:key:mounted") throw Object.assign(new Error(`${verb}: fenced`), { reason: "content-mounted-only" });
  } });
  const dispatcher = new VerbDispatcher({
    daemonVm: new FakeWiki() as unknown as TW5Engine, daemon, registry, verifier, localOf: () => true,
    routeFn: async (inv) => {
      routed.push(inv.action);
      if (inv.action === "wiki-switch") {
        if (opts.switchAnswer instanceof Error) throw opts.switchAnswer;
        const answer = opts.switchAnswer ?? { active: true };
        if (answer["active"] === true) mounted = true;
        return answer;
      }
      return { landed: true };
    },
  });
  dispatcher.start();
  const act = (requestedBy: string, to = WORKING, requestId = "r1") => dispatcher.placeVerb({
    verb: "wiki-act", args: { verb: "LOAD", args: { "to-bag": to, "source-uri": "/x" } }, requestedBy, requestId,
  });
  return { daemon, routed, act, dispatcher };
}

describe("a wiki-act aimed at a wiki no island mounts asks the vessel to mount it", () => {
  test("RED: the act mounts the wiki (wiki-switch), then its working cap clears and the act lands", async () => {
    const s = stand();
    s.act("did:key:mounted");
    await settle();
    const out = await outcomeOf(s.daemon, "r1");
    expect(out?.["status"], String(out?.["results"])).toBe("done");
    expect(s.routed).toEqual(["wiki-switch", "wiki-act"]);
    s.dispatcher.stop();
  });

  test("RED: a presenter the fence refuses triggers no mount, and the act refuses by the fence's name", async () => {
    const s = stand({ fence: true });
    s.act("did:key:sibling");
    await settle();
    const out = await outcomeOf(s.daemon, "r1");
    expect(out?.["status"]).toBe("error");
    expect(String(out?.["results"])).toContain("fenced");
    expect(s.routed).toEqual([]);
    s.dispatcher.stop();
  });

  test("RED: a mount that cannot stand refuses by name, never `bag not registered`", async () => {
    const s = stand({ switchAnswer: { active: false, cause: "no-such-wiki", detail: "orchard holds no spec" } });
    s.act("did:key:mounted");
    await settle();
    const out = await outcomeOf(s.daemon, "r1");
    expect(out?.["status"]).toBe("error");
    const text = String(out?.["results"]);
    expect(text).toContain("wiki-mount-refused: no-such-wiki");
    expect(text).not.toContain("bag not registered");
    expect(s.routed).toEqual(["wiki-switch"]);
    s.dispatcher.stop();
  });

  test("RED: a mount that throws refuses by the same name", async () => {
    const s = stand({ switchAnswer: new Error("island down") });
    s.act("did:key:mounted");
    await settle();
    expect(String((await outcomeOf(s.daemon, "r1"))?.["results"])).toContain("wiki-mount-refused: island down");
    s.dispatcher.stop();
  });

  test("RED (Copilot's read): a verb spelled in a case the main handler would not match aims at no wiki here either", async () => {
    const s = stand();
    s.dispatcher.placeVerb({ verb: "wiki-act", args: { verb: "load", args: { "to-bag": WORKING } }, requestedBy: "did:key:mounted", requestId: "r2" });
    await settle();
    expect(s.routed).not.toContain("wiki-switch");
    s.dispatcher.stop();
  });

  test("RED (Sol's read): a presenter the verifier denies for any reason but `bag not registered` triggers no mount, even with an explicit wiki", async () => {
    const s = stand({ deny: "no face provider for this label" });
    s.dispatcher.placeVerb({ verb: "wiki-act", args: { wiki: "orchard", verb: "LOAD", args: { "to-bag": WORKING } }, requestedBy: "did:key:label", requestId: "r3" });
    await settle();
    expect(s.routed).toEqual([]);
    expect(String((await outcomeOf(s.daemon, "r3"))?.["results"])).toContain("no face provider");
    s.dispatcher.stop();
  });

  test("RED (Sol's read): an explicit wiki with a malformed inner act mounts nothing (the denied bag names no slot of that wiki)", async () => {
    const s = stand();
    s.dispatcher.placeVerb({ verb: "wiki-act", args: { wiki: "orchard", verb: "NOPE", args: {} }, requestedBy: "did:key:mounted", requestId: "r4" });
    await settle();
    expect(s.routed).not.toContain("wiki-switch");
    s.dispatcher.stop();
  });

  test("RED (Sol's read): a MOVE out of the daemon wiki's slot into an unmounted wiki's slot aims at the destination wiki", () => {
    const inv = { requestId: "r5", title: "t", action: "wiki-act", requestedBy: "x", args: { verb: "MOVE", args: { "from-bag": "lar:///ha.ka.ba/wikis/daemon/working", "to-bag": WORKING } } } as never;
    expect(routedWikiSlug(inv)).toBe("orchard");
  });

  test("CONTROL: an act on a bag that names no non-daemon wiki slot asks no mount", async () => {
    const s = stand();
    s.act("did:key:mounted", "lar:///ha.ka.ba/bags/orchard");
    await settle();
    expect(s.routed).toEqual(["wiki-act"]);
    s.dispatcher.stop();
  });
});
