import { describe, expect, test } from "vitest";
import { deriveRegisterBags, litFaceOwnBags } from "@lararium/mesh/register-bags";
import { personaScopedBagIds } from "@lararium/mesh/persona-scope";
import { daemonFaceCanonBag, wikiSlotUri } from "@lararium/mesh/wiki-recipe";
import { selvesRecordOf } from "@lararium/mesh/persona-planes";
import { joinedFaceAuth, unlitServedFaces, type JoinedFaceAuthPorts } from "../src/joined-face-auth.js";
import { faceLives } from "../src/face-lifecycle.js";

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
  test("L2 RED: a sibling with no proven pair carries no planes and registers neither plane bag; CONTROL: a proven pair rides the entry and its two bags, and no other plane kind", async () => {
    const { ports } = fixture();
    const pair = { persona: "automerge:p1", intents: "automerge:t1" };
    const [one, four] = await joinedFaceAuth({ ...ports, planes: async (g) => (g === "group-1" ? pair : null) });
    const ids = personaScopedBagIds("group-1");
    expect(one!.facePlanes).toEqual(pair);
    expect(one!.registerBags).toEqual(expect.arrayContaining([ids.persona, ids.intents]));
    for (const other of [ids.circles, ids.identities, ids.sessions]) expect(one!.registerBags).not.toContain(other);
    expect(four!.facePlanes).toBeUndefined();
    expect(four!.registerBags).not.toContain(personaScopedBagIds("group-4").intents);
    expect(four!.registerBags).not.toContain(personaScopedBagIds("group-4").persona);
  });
  test("L3 RED: a face that closes while its planes prove carries nothing and mounts nothing; CONTROL: a face still lit mounts its pair once, after its last check", async () => {
    const { ports } = fixture();
    const pair = { persona: "automerge:p1", intents: "automerge:t1" };
    let open = true;
    const mounted: string[] = [];
    // The proof answers after the face closed: the mount, which the port names apart from the proof, never lands.
    const entries = await joinedFaceAuth({ ...ports, ordinals: () => [1], current: () => open,
      planes: async () => { open = false; return pair; }, mountPlanes: (group) => { mounted.push(group); } });
    expect(entries).toEqual([]);
    expect(mounted, "a closed face's proof mounts nothing").toEqual([]);
    // Lit through its last check, the face mounts its proven pair once, and the mount reads the face lit at that moment.
    let checks = 0;
    const lit = await joinedFaceAuth({ ...ports, ordinals: () => [1], current: () => { checks++; return true; },
      planes: async () => pair, mountPlanes: (group, planes) => { mounted.push(`${group} ${planes.intents} after ${checks} checks`); } });
    expect(lit).toHaveLength(1);
    expect(mounted).toEqual([`group-1 automerge:t1 after ${checks} checks`]);
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
});

describe("each face's one life replaces the generation ledger (`face-lifecycle`)", () => {
  const island = () => {
    const lights: Array<{ resolve: (lit: { atomKey: string | null; custody: string | null }) => void; reject: (e: unknown) => void; live: () => boolean }> = [];
    const lives = faceLives({
      light: (_o, _opening, live) => new Promise((resolve, reject) => { lights.push({ resolve, reject, live }); }),
      drainSaves: async () => {}, dropWorker: async () => {}, teardownHost: () => {}, recompose: async () => {}, log: () => {},
    }, { nonce: "jfa" });
    return { lives, lights };
  };

  test("a failed light answers refused and an explicit light retries under a fresh opening", async () => {
    const { lives, lights } = island();
    const first = lives.light(1);
    lights[0]!.reject(new Error("custody locked"));
    expect(await first).toBe("refused");
    const retry = lives.light(1);
    lights[1]!.resolve({ atomKey: "k1", custody: null });
    expect(await retry).toBe("lit");
  });

  test("a close voids the light in flight at once, and a detached sidecar reading live() installs nothing after it", async () => {
    const { lives, lights } = island();
    void lives.light(1);
    const closing = lives.close(1, "drop");
    expect(lights[0]!.live()).toBe(false);
    lights[0]!.resolve({ atomKey: "k1", custody: null });
    await closing;
    expect(lights[0]!.live()).toBe(false);
  });

  test("another face lights independently of a face whose light still waits", async () => {
    const { lives, lights } = island();
    void lives.light(1);
    const other = lives.light(2);
    lights[1]!.resolve({ atomKey: "k2", custody: null });
    expect(await other).toBe("lit");
    expect(lives.state(1).kind).toBe("lighting");
  });
});
