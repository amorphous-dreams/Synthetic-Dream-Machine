import { describe, expect, test } from "vitest";
import { deriveRegisterBags, litFaceOwnBags, daemonFaceCanonBag, wikiSlotUri } from "@lararium/mesh";
import { joinedFaceAuth, type JoinedFaceAuthPorts } from "../src/joined-face-auth.js";

const edge = { deviceVerifyingKey: "ab" } as NonNullable<Awaited<ReturnType<JoinedFaceAuthPorts["anchors"]>>>["deviceEdge"];
const anchor = {} as NonNullable<Awaited<ReturnType<JoinedFaceAuthPorts["anchor"]>>>;
const chain = [{}] as NonNullable<Awaited<ReturnType<JoinedFaceAuthPorts["chain"]>>>;
function fixture() {
  const logs: string[] = [];
  const seeds: Uint8Array[] = [];
  const ports: JoinedFaceAuthPorts = {
    ordinals: () => [0, 1, 2, 3, 4], mounted: 0,
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
      faceAddressSecret: "0a", veilArchiveBytes: new Uint8Array([11]), registerBags: deriveRegisterBags({ fleets: [], wikiBags: litFaceOwnBags(null) }) });
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
  test("THE VESSEL TIER: a lit sibling's hive registers the checkout canon the floor names, so it writes it under its own registration", async () => {
    const { ports } = fixture();
    const [one] = await joinedFaceAuth({ ...ports, vesselBags: () => ["lar:///ha.ka.ba/bags/sdm", "lar:///ha.ka.ba/bags/elyncia"] });
    expect(one!.registerBags).toEqual(expect.arrayContaining(["lar:///ha.ka.ba/bags/sdm", "lar:///ha.ka.ba/bags/elyncia"]));
    expect(one!.registerBags).not.toContain("lar:///ha.ka.ba/bags/lares");
  });
  test("an atom differing from its edge contributes nothing and names the sibling", async () => {
    const { ports, logs } = fixture();
    const entries = await joinedFaceAuth({ ...ports, atomKey: () => "different" });
    expect(entries).toEqual([]);
    expect(logs.join(" ")).toContain("h1");
  });
});
