import { describe, expect, test } from "vitest";
import { deriveRegisterBags, litFaceOwnBags, daemonFaceCanonBag, wikiSlotUri, selvesRecordOf } from "@lararium/mesh";
import { joinedFaceAuth, unlitServedFaces, unservedLitFaces, siblingFaceWork, litSiblingOrdinals, dropSiblingInOrder, type JoinedFaceAuthPorts } from "../src/joined-face-auth.js";

const edge = { deviceVerifyingKey: "ab" } as NonNullable<NonNullable<Awaited<ReturnType<JoinedFaceAuthPorts["anchors"]>>>["deviceEdge"]>;
const anchor = {} as NonNullable<Awaited<ReturnType<JoinedFaceAuthPorts["anchor"]>>>;
const chain = [{}] as unknown as NonNullable<Awaited<ReturnType<JoinedFaceAuthPorts["chain"]>>>;
function fixture() {
  const logs: string[] = [];
  const seeds: Uint8Array[] = [];
  const ports: JoinedFaceAuthPorts = {
    ordinals: () => [0, 1, 2, 3, 4], mounted: 0, current: () => true,
    unlocked: async (n) => n !== 2,
    anchors: async (n) => n === 3 ? null : ({ personaGroupId: `group-${n}`, meshCabalDocIdHex: `cabal-${n}`, signerDid: `did-${n}`, personaKelPrefix: `prefix-${n}`, deviceEdge: edge }),
    anchor: async () => anchor, chain: async () => chain,
    atomSeed: async () => { const s = new Uint8Array([9]); seeds.push(s); return s; },
    atomKey: () => "ab", addressSecret: async () => new Uint8Array([10]),
    veilArchive: async () => new Uint8Array([11]),
    log: (line) => logs.push(line),
  };
  return { ports, logs, seeds };
}
describe("joined face authentication", () => {
  test("opens only unlocked siblings, skips a torn sibling and continues", async () => {
    const { ports, logs, seeds } = fixture();
    const entries = await joinedFaceAuth(ports);
    expect(entries.map((e) => e.personaGroupId)).toEqual(["group-1", "group-4"]);
    expect(logs.join(" ")).toContain("h3");
    expect(seeds.every((s) => s.every((b) => b === 0))).toBe(true);
    expect(entries[0]).toEqual({ atom: { seed: "09", key: "ab" }, personaGroupId: "group-1", faceAnchor: anchor, handleIndex: 1,
      personaKel: { prefix: "prefix-1", chain }, deviceEdge: edge, signerDid: "did-1", meshCabalDocIdHex: "cabal-1",
      faceAddressSecret: "0a", veilArchiveBytes: new Uint8Array([11]), registerBags: deriveRegisterBags({ fleets: [], wikiBags: litFaceOwnBags(null, "group-1") }) });
    expect(entries[0]!.registerBags).not.toContain("lar:///ha.ka.ba/wikis/mounted/working");
  });
  test("THE LIT SET: a sibling names its handle index and relation, and its hive registers the bags it owns (daemon slots, its canon, its catalog), never a user wiki", async () => {
    const { ports } = fixture();
    const relation = "11111111-1111-4111-8111-111111111111";
    const [one] = await joinedFaceAuth({ ...ports, relation: async (g) => (g === "group-1" ? relation : null) });
    expect(one!.handleIndex).toBe(1);
    expect(one!.faceRelation).toBe(relation);
    expect(one!.registerBags).toEqual(expect.arrayContaining([wikiSlotUri("daemon", "working"), wikiSlotUri("daemon", "draft"), wikiSlotUri("daemon", "personal"), daemonFaceCanonBag(relation)]));
    expect(one!.registerBags.some((b) => /\/wikis\/(?!daemon\/)/.test(b))).toBe(false);
  });
  test("RED: a lit sibling's hive registers its OWN selves record's bag, so the record the bag map files under that face seals under that face's own session; CONTROL: never another face's record", async () => {
    const { ports } = fixture();
    const [one, four] = await joinedFaceAuth(ports);
    expect(one!.registerBags, "h1's selves record seals under h1's own hive").toContain(selvesRecordOf("group-1").bagId);
    expect(one!.registerBags, "h1's hive never registers h4's record").not.toContain(selvesRecordOf("group-4").bagId);
    expect(one!.registerBags, "nor the worn face's").not.toContain(selvesRecordOf("group-0").bagId);
    expect(four!.registerBags).toContain(selvesRecordOf("group-4").bagId);
  });
  test("an atom differing from its edge contributes nothing and names the sibling", async () => {
    const { ports, logs } = fixture();
    const entries = await joinedFaceAuth({ ...ports, atomKey: () => "different" });
    expect(entries).toEqual([]);
    expect(logs.join(" ")).toContain("h1");
  });
});

describe("a face the lend serves after the composition stood", () => {
  test("RED: every served face neither mounted nor lit stands unlit, in ordinal order, so the composition lights it before a session on it reads; CONTROL: the mount and the lit faces need nothing, and no mount lights nothing", () => {
    expect(unlitServedFaces([2, 0, 1], 0, new Set([2]))).toEqual([1]);
    expect(unlitServedFaces([0, 2], 0, new Set([2]))).toEqual([]);
    expect(unlitServedFaces([0, 1, 2], null, new Set())).toEqual([]);
  });

  test("RED (Sol 407c): a lit sibling the lend no longer serves (a pūlama lock narrowed it) stands to drop, in ordinal order; the mount never drops here, and a face still served stays", () => {
    expect(unservedLitFaces([0], 0, new Set([1, 2]))).toEqual([1, 2]);
    expect(unservedLitFaces([0, 2], 0, new Set([1, 2]))).toEqual([1]);
    expect(unservedLitFaces([0, 1, 2], 0, new Set([1, 2]))).toEqual([]);
    expect(unservedLitFaces([], 0, new Set([0]))).toEqual([]);
  });
});

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => { resolve = done; });
  return { promise, resolve };
}

describe("sibling generation ownership", () => {
  test("removing an owning entry makes its served ordinal eligible for automatic lighting", () => {
    const entries = new Map([["sibling", { ordinal: 1 }]]);
    expect(unlitServedFaces([0, 1], 0, litSiblingOrdinals(entries.values()))).toEqual([]);
    entries.delete("sibling");
    expect(unlitServedFaces([0, 1], 0, litSiblingOrdinals(entries.values()))).toEqual([1]);
  });

  test("a failed mint rejects its awaited light and an explicit light retries", async () => {
    const work = siblingFaceWork();
    await expect(work.run(1, async () => { throw new Error("custody locked"); })).rejects.toThrow("custody locked");
    let retries = 0;
    await work.run(1, async (live) => { if (live()) retries++; });
    expect(retries).toBe(1);
  });

  test("drop invalidates work immediately, drains its provider admission, then permits a new light", async () => {
    const work = siblingFaceWork(), gate = deferred(), entered = deferred();
    const events: string[] = [];
    const first = work.run(1, async (live) => {
      entered.resolve();
      await gate.promise;
      events.push("provider admitted");
      if (live()) events.push("session seated");
    });
    await entered.promise;
    const dropping = work.remove(1, async () => { events.push("provider dropped"); });
    const next = work.run(1, async (live) => { if (live()) events.push("replacement seated"); });
    gate.resolve();
    await Promise.all([first, dropping, next]);
    expect(events).toEqual(["provider admitted", "provider dropped", "replacement seated"]);
  });

  test("a completed light's detached sidecar cannot install a keeper after drop or teardown", async () => {
    for (const ending of ["drop", "teardown"]) {
      const work = siblingFaceWork(), gate = deferred();
      let sidecar!: Promise<void>, keepers = 0;
      await work.run(1, async (live) => {
        sidecar = gate.promise.then(() => { if (live()) keepers++; });
      });
      if (ending === "drop") await work.remove(1, async () => {});
      else work.close();
      gate.resolve();
      await sidecar;
      await work.run(2, async (live) => { if (ending === "teardown" && live()) keepers++; });
      expect(keepers).toBe(0);
    }
  });

  test("an open event overtaken during custody enumeration cannot start a new generation", async () => {
    const work = siblingFaceWork(), gate = deferred();
    const eventGeneration = work.capture(1);
    let lights = 0;
    const event = (async () => {
      await gate.promise;
      if (eventGeneration()) await work.run(1, async () => { lights++; });
    })();
    await work.remove(1, async () => {});
    gate.resolve();
    await event;
    expect(lights).toBe(0);
    await work.run(1, async () => { lights++; });
    expect(lights).toBe(1);
  });

  test("an obsolete failure cannot clear its replacement flight, and another face lights independently", async () => {
    const work = siblingFaceWork(), gate = deferred(), entered = deferred();
    const replacementGate = deferred(), replacementEntered = deferred();
    const first = work.run(1, async () => { entered.resolve(); await gate.promise; throw new Error("mint failed"); });
    const rejected = expect(first).rejects.toThrow("mint failed");
    await entered.promise;
    const dropping = work.remove(1, async () => {});
    let calls = 0;
    const replacement = work.run(1, async () => { calls++; replacementEntered.resolve(); await replacementGate.promise; });
    let other = false;
    await work.run(2, async () => { other = true; });
    expect(other).toBe(true);
    gate.resolve();
    await rejected;
    await dropping;
    await replacementEntered.promise;
    expect(work.run(1, async () => { calls++; })).toBe(replacement);
    replacementGate.resolve();
    await replacement;
    expect(calls).toBe(1);
  });

  test("proof stops after an overtaken await and wipes secrets already read", async () => {
    const { ports, seeds } = fixture();
    let live = true, archiveReads = 0;
    const entries = await joinedFaceAuth({ ...ports, ordinals: () => [1], current: () => live,
      addressSecret: async () => { live = false; return new Uint8Array([10]); },
      veilArchive: async () => { archiveReads++; return null; },
    });
    expect(entries).toEqual([]);
    expect(archiveReads).toBe(0);
    expect(seeds.every((seed) => seed.every((byte) => byte === 0))).toBe(true);
  });
});

describe("a face that leaves: its saves seal first, the worker drops, the host side last (Sol 407d, 407e)", () => {
  const rig = (fail: { worker?: boolean; flush?: boolean; host?: boolean } = {}) => {
    const steps: string[] = [];
    const run = () => dropSiblingInOrder({
      workers: ["atom-1", "atom-1"], groups: ["group-1"],
      flushSaves: async (group) => { steps.push(`flush:${group}`); if (fail.flush) throw new Error("flush failed"); },
      dropWorker: async (key) => { steps.push(`worker:${key}`); if (fail.worker) throw new Error("worker drop failed"); },
      acknowledged: (key) => steps.push(`ack:${key}`),
      teardownHost: (group) => { steps.push(`host:${group}`); if (fail.host) throw new Error("host teardown failed"); },
      log: (line) => steps.push(`log:${line.split(":")[0]}`),
    });
    return { steps, run };
  };

  test("RED (407e): the face's queued saves seal while its seat and ownership still stand, then the worker drops (from memory) and acknowledges, then the host side drops", async () => {
    const r = rig();
    await r.run();
    expect(r.steps).toEqual(["flush:group-1", "worker:atom-1", "ack:atom-1", "host:group-1"]);
  });

  test("RED (407e): a worker drop that fails keeps its retry key (no acknowledgement) and still tears the host side down; a failed host teardown leaves the worker dropped; a failed flush logs and the drop goes on", async () => {
    const worker = rig({ worker: true });
    await expect(worker.run()).rejects.toThrow("worker drop failed");
    expect(worker.steps).toEqual(["flush:group-1", "worker:atom-1", "host:group-1"]);
    const host = rig({ host: true });
    await expect(host.run()).rejects.toThrow("host teardown failed");
    expect(host.steps).toEqual(["flush:group-1", "worker:atom-1", "ack:atom-1", "host:group-1"]);
    const flush = rig({ flush: true });
    await flush.run();
    expect(flush.steps).toEqual(["flush:group-1", "log:[lit-set] face group-1's queued saves did not flush before it dropped", "worker:atom-1", "ack:atom-1", "host:group-1"]);
  });
});
