import { describe, expect, test } from "vitest";
import { deriveRegisterBags } from "@lararium/mesh";
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
    veilArchive: async () => new Uint8Array([11]), registerBags: () => ["ground", "lar:///ha.ka.ba/wikis/mounted/working", "lar:///ha.ka.ba/lares"],
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
    expect(entries[0]).toEqual({ atom: { seed: "09", key: "ab" }, personaGroupId: "group-1", faceAnchor: anchor,
      personaKel: { prefix: "prefix-1", chain }, deviceEdge: edge, signerDid: "did-1", meshCabalDocIdHex: "cabal-1",
      faceAddressSecret: "0a", veilArchiveBytes: new Uint8Array([11]), registerBags: deriveRegisterBags({ fleets: [] }) });
    expect(entries[0]!.registerBags).not.toContain("lar:///ha.ka.ba/wikis/mounted/working");
  });
  test("an atom differing from its edge contributes nothing and names the sibling", async () => {
    const { ports, logs } = fixture();
    const entries = await joinedFaceAuth({ ...ports, atomKey: () => "different" });
    expect(entries).toEqual([]);
    expect(logs.join(" ")).toContain("h1");
  });
});
