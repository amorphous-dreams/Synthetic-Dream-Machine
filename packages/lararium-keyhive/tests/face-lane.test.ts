/**
 * face-lane — EACH HAT REACHED BY NAME on the daemon island: a store verb from a LIT sibling face's session runs on that
 * face's own lane (its own document, as the lit set resolves it for that face), and its answer names the face; a verb from
 * the mounted face runs as before and names the mounted face; a presenter neither mounted nor lit refuses `face-not-open`;
 * a sibling's container naming anything but its own lane refuses `face-lane-holds-its-own`.
 *
 * A LIT FACE RECEIVES VISITS (operator ruling 2026-11-20, the cross-face reach): a read naming another lit face as its `target`
 * keeps the session's worn face and answers from that face's CROSS-FACE VIEW with no lei, under the target's own standing read;
 * a private bag refuses first; a write naming another face refuses; a shut target refuses `face-not-open`. A visit binds to the
 * target's OPENING on this island and reads it again before it answers: a lock or a lock and re-light mid-read refuses
 * `face-not-open` and hands no body back (Sol H2); every visit's answer carries `visit: true`, which the vessel's receipt doors
 * read to withhold its body from any later retrieval.
 * Canon: lar:///ha.ka.ba/lararium/mesh/sealed-store#/the-lit-set
 */
import { describe, expect, it } from "vitest";
import { crossFaceReactor, faceEngineReactor, faceLaneReactor, FACE_ENGINE_VERBS, FACE_LANE_VERBS } from "../src/face-lane.js";

const MOUNT = "a".repeat(64), SIB = "b".repeat(64), SHUT = "c".repeat(64);
const LANE = "lar:///ha.ka.ba/bags/daemon-rel-b";
const laneStore = { documentId: "doc-b" };

function rig() {
  const ran: string[] = [];
  const ports = {
    mountedKey: () => MOUNT,
    mountedOrdinal: () => 0,
    lit: (key: string) => (key === SIB ? { handleIndex: 1 } : null),
    target: async (face: number, bag: string) => (face === 1 && bag === LANE ? { store: laneStore as never, owner: 1 } : bag === LANE ? { store: laneStore as never, owner: 2 } : null),
  };
  const reactor = faceLaneReactor("meme-put",
    async () => { ran.push("mounted"); return { decision: "ingest", bag: "lar:///ha.ka.ba/wikis/daemon/working" }; },
    (lane) => async () => { ran.push(`lane:${lane.bag}:${(lane.store as unknown as { documentId: string }).documentId}`); return { decision: "ingest", bag: lane.bag }; },
    ports);
  const ctx = (presenter?: string) => ({ ...(presenter !== undefined ? { presenter } : {}), local: true }) as never;
  return { reactor, ran, ctx };
}

describe("each hat reached by name: the island's per-face lane", () => {
  it("the lane carries the meme verbs and the tiddler door's engine verbs", () => {
    expect([...FACE_ENGINE_VERBS].sort()).toEqual(["oracle-cast", "tiddler-delete", "tiddler-get", "tiddler-put", "wiki-filter", "wiki-render", "wiki-status"]);
    expect([...FACE_LANE_VERBS].sort()).toEqual(["meme-delete", "meme-get", "meme-list", "meme-put", ...FACE_ENGINE_VERBS].sort());
  });

  it("LIT SIBLING: its put runs on its own lane (its own document) and the answer names its face", async () => {
    const r = rig();
    const out = await r.reactor({ uri: "lar:///t/x", bag: LANE, text: "t" }, r.ctx(`0x${SIB}`));
    expect(out).toEqual({ decision: "ingest", bag: LANE, face: 1 });
    expect(r.ran).toEqual([`lane:${LANE}:doc-b`]);
  });

  it("MOUNTED: its put runs as before and the answer names the mounted face; no presenter reads as the mount", async () => {
    const r = rig();
    expect(await r.reactor({ uri: "lar:///t/x", recipe: "default", text: "t" }, r.ctx(`0x${MOUNT}`))).toMatchObject({ face: 0 });
    expect(await r.reactor({ uri: "lar:///t/x", recipe: "default", text: "t" }, r.ctx())).toMatchObject({ face: 0 });
    expect(r.ran).toEqual(["mounted", "mounted"]);
  });

  it("SHUT: a presenter neither mounted nor lit refuses face-not-open, and nothing runs", async () => {
    const r = rig();
    await expect(r.reactor({ uri: "lar:///t/x", bag: LANE, text: "t" }, r.ctx(`0x${SHUT}`))).rejects.toMatchObject({ reason: "face-not-open" });
    expect(r.ran).toEqual([]);
  });

  it("ITS OWN LANE ALONE: a sibling naming a recipe, another bag, or a lane another face owns refuses face-lane-holds-its-own", async () => {
    const r = rig();
    for (const args of [{ recipe: "default" }, { bag: "lar:///ha.ka.ba/bags/daemon-rel-a" }, { bag: LANE, realm: "r" }]) {
      await expect(r.reactor({ uri: "lar:///t/x", text: "t", ...args }, r.ctx(`0x${SIB}`)), JSON.stringify(args)).rejects.toMatchObject({ reason: "face-lane-holds-its-own" });
    }
    const other = faceLaneReactor("meme-put", async () => ({}), () => async () => ({}), {
      mountedKey: () => MOUNT, mountedOrdinal: () => 0, lit: () => ({ handleIndex: 1 }),
      target: async () => ({ store: laneStore as never, owner: 2 }),
    });
    await expect(other({ uri: "lar:///t/x", bag: LANE, text: "t" }, r.ctx(`0x${SIB}`))).rejects.toMatchObject({ reason: "face-lane-holds-its-own" });
    expect(r.ran).toEqual([]);
  });
});

describe("each hat reached by name: a lit sibling's own engine answers the tiddler door", () => {
  function engineRig() {
    const ran: string[] = [];
    const engines = new Map([[1, { tw5: { name: "engine-h1" }, composite: { name: "composite-h1" } }]]);
    const reactor = faceEngineReactor("tiddler-put",
      async () => { ran.push("mounted"); return { decision: "put", bag: "lar:///ha.ka.ba/wikis/daemon/working" }; },
      (engine) => async () => { ran.push(`engine:${(engine.tw5 as unknown as { name: string }).name}:${(engine.composite as unknown as { name: string }).name}`); return { decision: "put", bag: "lar:///ha.ka.ba/wikis/daemon/working" }; },
      {
        mountedKey: () => MOUNT, mountedOrdinal: () => 0,
        lit: (key: string) => (key === SIB ? { handleIndex: 1 } : null),
        engine: async (face: number) => (engines.get(face) as never) ?? null,
      });
    const ctx = (presenter?: string) => ({ ...(presenter !== undefined ? { presenter } : {}), local: true }) as never;
    return { reactor, ran, ctx };
  }

  it("LIT SIBLING: its tiddler verb on its own daemon wiki (recipe default) runs in ITS engine over ITS composition, and names its face", async () => {
    const r = engineRig();
    expect(await r.reactor({ recipe: "default", title: "T" }, r.ctx(`0x${SIB}`))).toEqual({ decision: "put", bag: "lar:///ha.ka.ba/wikis/daemon/working", face: 1 });
    expect(r.ran).toEqual(["engine:engine-h1:composite-h1"]);
  });

  it("MOUNTED: the mount's engine answers as before and names the mounted face; no presenter reads as the mount", async () => {
    const r = engineRig();
    expect(await r.reactor({ recipe: "default", title: "T" }, r.ctx(`0x${MOUNT}`))).toMatchObject({ face: 0 });
    expect(await r.reactor({ recipe: "default", title: "T" }, r.ctx())).toMatchObject({ face: 0 });
    expect(r.ran).toEqual(["mounted", "mounted"]);
  });

  it("SHUT: a presenter neither mounted nor lit refuses face-not-open, and no engine runs", async () => {
    const r = engineRig();
    await expect(r.reactor({ recipe: "default", title: "T" }, r.ctx(`0x${SHUT}`))).rejects.toMatchObject({ reason: "face-not-open" });
    expect(r.ran).toEqual([]);
  });

  it("ITS OWN WIKI ALONE: a sibling naming another wiki, a bag or a realm refuses face-lane-holds-its-own before any engine runs", async () => {
    const r = engineRig();
    for (const args of [{ recipe: "garden" }, { bag: "lar:///ha.ka.ba/bags/daemon-rel-b" }, { recipe: "default", realm: "r" }, {}]) {
      await expect(r.reactor({ title: "T", ...args }, r.ctx(`0x${SIB}`)), JSON.stringify(args)).rejects.toMatchObject({ reason: "face-lane-holds-its-own" });
    }
    expect(r.ran).toEqual([]);
  });
});

describe("a lit face receives visits: a read names another lit face as its target", () => {
  function visitRig(verb = "tiddler-get") {
    const ran: string[] = [];
    const caps: string[] = [];
    const views = new Map([[1, { tw5: { name: "view-h1" }, composite: { name: "view-composite-h1" } }], [0, { tw5: { name: "view-h0" }, composite: { name: "view-composite-h0" } }]]);
    const openings = new Map<number, string>([[0, "mount"], [1, "h1:1"]]);
    const during: Array<() => void> = [];
    const reactor = crossFaceReactor(verb,
      async (args) => { ran.push(`routed:${JSON.stringify(args)}`); return { decision: "read", face: 0 }; },
      (view) => async (args, ctx) => {
        ran.push(`view:${(view.tw5 as unknown as { name: string }).name}:${JSON.stringify(args)}`);
        for (const act of during.splice(0)) act();
        caps.push(JSON.stringify(await ctx.cap("read", "lar:///ha.ka.ba/wikis/daemon/working")), JSON.stringify(await ctx.cap("admin", "lar:///ha.ka.ba/wikis/daemon/working")));
        return { decision: "read" };
      },
      {
        mountedKey: () => MOUNT, mountedOrdinal: () => 0,
        lit: (key: string) => (key === SIB ? { handleIndex: 1 } : null),
        opening: (face: number) => openings.get(face) ?? null,
        view: async (face: number) => (views.get(face) as never) ?? null,
        readAs: (face: number) => async (access) => (access === "read" ? { ok: true, reason: `read as h${face}` } : { ok: false, reason: "cross-face read" }),
      });
    const ctx = (presenter?: string) => ({ ...(presenter !== undefined ? { presenter } : {}), local: true, cap: async () => ({ ok: true, reason: "worn" }) }) as never;
    return { reactor, ran, caps, ctx, openings, during };
  }

  it("V1 RED: the worn face reads a lit sibling's daemon wiki through ITS cross-face view, under its standing read, and the answer names both", async () => {
    const r = visitRig();
    expect(await r.reactor({ recipe: "default", title: "T", target: 1 }, r.ctx(`0x${MOUNT}`))).toEqual({ decision: "read", face: 1, worn: 0, visit: true });
    expect(r.ran, "the view answers, never the worn engine or the sibling's own; the target leaves the args").toEqual([`view:view-h1:${JSON.stringify({ recipe: "default", title: "T" })}`]);
    expect(r.caps, "the door asks the target's standing read, and no admin passes").toEqual([JSON.stringify({ ok: true, reason: "read as h1" }), JSON.stringify({ ok: false, reason: "cross-face read" })]);
  });

  it("V2 RED: a sibling's session reads the mount the same way; a target naming the face worn reads as no target", async () => {
    const r = visitRig();
    expect(await r.reactor({ recipe: "default", title: "T", target: "h0" }, r.ctx(`0x${SIB}`))).toMatchObject({ face: 0, worn: 1 });
    expect(await r.reactor({ recipe: "default", title: "T", target: 0 }, r.ctx(`0x${MOUNT}`))).toEqual({ decision: "read", face: 0 });
    expect(r.ran).toEqual([`view:view-h0:${JSON.stringify({ recipe: "default", title: "T" })}`, `routed:${JSON.stringify({ recipe: "default", title: "T" })}`]);
  });

  it("V3 RED: PRIVATE FIRST: a bag naming a private layer refuses `cross-face-private` before the verb, the lit set or a view is read", async () => {
    const r = visitRig("meme-get");
    for (const target of [1, 7]) {
      await expect(r.reactor({ uri: "lar:///t/x", bag: "lar:///ha.ka.ba/wikis/daemon/personal", target }, r.ctx(`0x${MOUNT}`))).rejects.toMatchObject({ reason: "cross-face-private" });
    }
    const write = visitRig("meme-put");
    await expect(write.reactor({ uri: "lar:///t/x", bag: "lar:///ha.ka.ba/wikis/garden/personal", target: 1 }, write.ctx(`0x${MOUNT}`))).rejects.toMatchObject({ reason: "cross-face-private" });
    expect([...r.ran, ...write.ran]).toEqual([]);
  });

  it("V4 RED: a write naming another face refuses `cross-face-write-refused`, and nothing runs", async () => {
    for (const verb of ["tiddler-put", "tiddler-delete", "meme-put", "meme-delete"]) {
      const r = visitRig(verb);
      await expect(r.reactor({ recipe: "default", title: "T", target: 1 }, r.ctx(`0x${MOUNT}`)), verb).rejects.toMatchObject({ reason: "cross-face-write-refused" });
      expect(r.ran).toEqual([]);
    }
  });

  it("V5 RED: a shut target refuses `face-not-open`; an unresolved target and a named wiki refuse by name; nothing runs", async () => {
    const r = visitRig();
    await expect(r.reactor({ recipe: "default", title: "T", target: 7 }, r.ctx(`0x${MOUNT}`))).rejects.toMatchObject({ reason: "face-not-open" });
    await expect(r.reactor({ recipe: "default", title: "T", target: "sibling-face" }, r.ctx(`0x${MOUNT}`))).rejects.toMatchObject({ reason: "target-unresolved" });
    await expect(r.reactor({ recipe: "garden", title: "T", target: 1 }, r.ctx(`0x${MOUNT}`))).rejects.toMatchObject({ reason: "cross-face-wiki-unreached" });
    await expect(r.reactor({ recipe: "default", title: "T", target: 1 }, r.ctx(`0x${SHUT}`))).rejects.toMatchObject({ reason: "face-not-open" });
    expect(r.ran).toEqual([]);
  });

  it("V6: no target runs the face's own route unchanged", async () => {
    const r = visitRig();
    expect(await r.reactor({ recipe: "default", title: "T" }, r.ctx(`0x${SIB}`))).toEqual({ decision: "read", face: 0 });
    expect(r.ran).toEqual([`routed:${JSON.stringify({ recipe: "default", title: "T" })}`]);
  });

  it("V7 RED (Sol H2): a lock, or a lock and re-light, while the visit reads refuses face-not-open and hands no body back", async () => {
    const shut = visitRig();
    shut.during.push(() => shut.openings.delete(1));
    await expect(shut.reactor({ recipe: "default", title: "T", target: 1 }, shut.ctx(`0x${MOUNT}`))).rejects.toMatchObject({ reason: "face-not-open" });
    const relit = visitRig();
    relit.during.push(() => relit.openings.set(1, "h1:2"));
    await expect(relit.reactor({ recipe: "default", title: "T", target: 1 }, relit.ctx(`0x${MOUNT}`))).rejects.toMatchObject({ reason: "face-not-open" });
    // CONTROL: an opening that stands through the read answers, marked a visit.
    const steady = visitRig();
    expect(await steady.reactor({ recipe: "default", title: "T", target: 1 }, steady.ctx(`0x${MOUNT}`))).toMatchObject({ face: 1, visit: true });
  });
});
