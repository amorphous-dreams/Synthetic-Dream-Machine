/**
 * dial-relation — THE OUTBOUND DIAL SEATS THE RELATION ITS OWN HELD RECORDS PROVE (road `P26`; controller transport
 * ruling 2026-10-31, and its fork ruling (b), settled at rung 1: each side decides what IT shares from ITS OWN held records;
 * "sync carries; verification decides").
 *
 * Since the house proved its islands by arrival, a dialed hearth reads as WIRE: right for the guard, yet the dial seated no
 * relation at all, so a joined leaf's `face-join` summons on its face's intents plane could not cross the dial to the founding
 * hearth (e2e meme-two-vessel-bag ⑨ red at e6d11928b). The gate's signed answer carries no class (`verified` reads
 * `["state"]`), and the dialer never takes its relation from the remote's word: its own sealed landing record names the
 * pin the act wrote.
 *
 *   REVISION (Sol's transport read; controller ruling): the provenance rests as a SEALED face custody row under that face's
 *   FCK, written by `fleet join land` and binding (face, pin digest): the face's join record names the landed pin's digest
 *   (road #/rulings 2026-10-19: "a face's custody rows seal under its own key"; "a face's secrets never rest clear"). A
 *   bootstrap tag counts for nothing: a pin whose digest no sealed landing record names reads untagged.
 *
 *   P1  RED: the sealed face join record keeps the landed hearth pin's digest and reads it back.
 *   P2  CONTROL: the dial's choice names where its pin came from: the bootstrap's pin or a kept admit bundle.
 *   S1  CONTROL: a dial whose pin digest the worn face's sealed landing record names seats a face view of that face: the
 *       intents plane (where the summons rides) and the persona plane cross to the dialed hearth.
 *   S2  CONTROL: a dial whose pin came from a kept admit bundle seats the contracted class and its standing, and shares no
 *       private plane.
 *   S3  RED (Sol BLOCKER 2): a bootstrap pin no sealed landing record names shares no private plane, whatever the clear
 *       bootstrap claims beside it: the relation reads no input but the sealed record and the pin's digest (the extra
 *       `provenance` property a forger would supply has no reader at all).
 *   S4  CONTROL: a landing record that names ANOTHER pin shares no private plane; no worn face shares none.
 *   S5  CONTROL: the unseat drops the class, the standing and the view.
 *   S6  RED (Sol BLOCKER 1): the realm's return lane names the hearth the dial SEATED: a kept pin at B names B's Nexus, never
 *       the bootstrap's hearth; the unseat clears it.
 */
import { describe, expect, test } from "vitest";
import { generateAutomergeUrl, interpretAsDocumentId, type DocumentId } from "@automerge/automerge-repo";
import {
  DAEMON_BAG_ID, DeterministicFederationGate, custodyRootDoor, deriveGateBundle, personaBagIdFor, personaMembershipEntries,
  admitGatePinDigest, personaSiblingBagIds, sovereignGateRoot, sovereignRoute, type GateBundlePin, type PeerClass,
} from "@lararium/mesh";
import { afterEach } from "vitest";
import { chooseHearthDial } from "../src/hearth-gate-pins.js";
import { keepFaceJoinRecord, readFaceJoinRecord } from "../src/fleet-join-custody.js";
import { seatScratchCustody, type SeatedScratchCustody } from "./custody-seat-fixture.js";
import { faceFleetViews } from "../src/face-fleet-view.js";
import { selfSlotShareDecision, NO_BANS, NOBODY_ASIDE, NOTHING_CLASSED } from "../src/self-slot-share.js";

type Relation = { readonly kind: string; readonly personaGroup?: string; readonly nexus?: string | null };
type DialRelationModule = {
  dialRelationOf(input: { source: "bootstrap" | "kept" | null; landedPin: string | null; pinDigest: string | null; pinNexus: string | null; wornGroup: string | null; provenance?: unknown }): Relation;
  seatDialPeer(maps: unknown, peerId: string, relation: Relation): void;
  unseatDialPeer(maps: unknown, peerId: string): void;
};
const dialRelation = async (): Promise<DialRelationModule | null> =>
  (await import("../src/dial-relation.js").catch(() => null)) as DialRelationModule | null;

const G1 = "0x" + "11".repeat(16), G2 = "0x" + "22".repeat(16);
const urls = (g: string) => ({ persona: generateAutomergeUrl(), identities: generateAutomergeUrl(), circles: generateAutomergeUrl(), sessions: generateAutomergeUrl(), intents: generateAutomergeUrl(), group: g });
const ONE = urls(G1);
const DAEMON = generateAutomergeUrl();
function bootstrap(...faces: Array<ReturnType<typeof urls>>): Record<string, { text?: string }> {
  const out: Record<string, { text?: string }> = { [DAEMON_BAG_ID]: { text: DAEMON } };
  for (const f of faces) {
    for (const e of personaMembershipEntries({ personaGroupId: f.group, url: f.persona })) out[e.title] = { text: e.text ?? undefined };
    const sib = personaSiblingBagIds(personaBagIdFor(f.group));
    out[sib.identities] = { text: f.identities }; out[sib.circles] = { text: f.circles };
    out[sib.sessions] = { text: f.sessions }; out[sib.intents] = { text: f.intents };
  }
  return out;
}
const idOf = (url: string) => interpretAsDocumentId(url as never) as DocumentId;
const shelf = new DeterministicFederationGate("ab".repeat(32));
const pinAt = (nexus: string, tag = 4): GateBundlePin =>
  deriveGateBundle(sovereignGateRoot(custodyRootDoor({ derive: () => new Uint8Array(32).fill(tag) })), new TextEncoder().encode(nexus), sovereignRoute("/ws")).pin;
let custody: SeatedScratchCustody | null = null;
afterEach(async () => { await custody?.drop(); custody = null; });

/** The composer's seat maps and the share verdict a dial peer meets: wire, its class, its face view. */
function seatRig() {
  const maps: { peerClassMap: Map<string, PeerClass>; peerNexus: Map<string, string | null>; faceViews: ReturnType<typeof faceFleetViews>; dialedHearth?: { pinned: boolean; aid: string | null } | null } =
    { peerClassMap: new Map<string, PeerClass>(), peerNexus: new Map<string, string | null>(), faceViews: faceFleetViews(() => bootstrap(ONE), () => G1), dialedHearth: null };
  const verdict = (peerId: string, url: string) => selfSlotShareDecision({
    hasWsSocket: true, peerClass: maps.peerClassMap.get(peerId), selfSlotFedGate: shelf, antigenRing: NO_BANS, membership: null, planeSeal: null,
    peerId, documentId: idOf(url), sessionFace: maps.faceViews.gateFor(peerId),
    shadow: NOBODY_ASIDE, protectedDocs: NOTHING_CLASSED,
  } as Parameters<typeof selfSlotShareDecision>[0]);
  return { maps, verdict };
}

describe("the outbound dial seats the relation its own held records prove", () => {
  test("P1 — RED: the sealed face join record keeps the landed hearth pin's digest", async () => {
    custody = await seatScratchCustody("dial-relation");
    const pin = pinAt("nexus-a.synthetic");
    await keepFaceJoinRecord({ personaGroup: G1, rootKey: "ab".repeat(32), certificates: [], grants: [], hearthPin: admitGatePinDigest(pin) } as Parameters<typeof keepFaceJoinRecord>[0]);
    expect((await readFaceJoinRecord(G1) as { hearthPin?: unknown } | null)?.hearthPin, "P1: the landed pin's digest reads back").toBe(admitGatePinDigest(pin));
  });

  test("P2 — CONTROL: the dial's choice names the bootstrap's pin as its source", () => {
    const pin = pinAt("nexus-a.synthetic");
    const choice = chooseHearthDial({ hearthPin: { syncUrl: "ws://127.0.0.1:4242/ws", gatePin: pin }, kept: [] });
    expect(choice.source, "P2: the source").toBe("bootstrap");
  });

  test("S1–S5 — the dial's seat: same face crosses its planes; kept bundle contracted; untagged and foreign-face none", async () => {
    const mod = await dialRelation();
    expect(mod, "dial-relation stands").not.toBeNull();
    const { dialRelationOf, seatDialPeer, unseatDialPeer } = mod!;
    const nexusHex = Buffer.from("nexus-a.synthetic", "utf8").toString("hex");
    const { maps, verdict } = seatRig();

    const landed = admitGatePinDigest(pinAt("nexus-a.synthetic"));
    const other = admitGatePinDigest(pinAt("nexus-a.synthetic", 9));
    seatDialPeer(maps, "same-face", dialRelationOf({ source: "bootstrap", landedPin: landed, pinDigest: landed, pinNexus: nexusHex, wornGroup: G1 }));
    expect(await verdict("same-face", ONE.intents), "S1: the intents plane (the summons) crosses").toBe(true);
    expect(await verdict("same-face", ONE.persona), "S1: the persona plane crosses").toBe(true);

    const contracted = dialRelationOf({ source: "kept", landedPin: null, pinDigest: other, pinNexus: nexusHex, wornGroup: G1 });
    expect(contracted.kind, "S2: a kept bundle's pin reads contracted").toBe("contracted");
    seatDialPeer(maps, "contracted", contracted);
    expect(maps.peerClassMap.get("contracted"), "S2: the class").toBe("contracted");
    expect(maps.peerNexus.get("contracted"), "S2: the standing names the pin's Nexus").toBe("nexus-a.synthetic");
    expect(await verdict("contracted", ONE.intents), "S2: no private plane").toBe(false);
    expect(await verdict("contracted", ONE.persona), "S2: no private plane").toBe(false);

    const forged = dialRelationOf({ source: "bootstrap", landedPin: null, pinDigest: other, pinNexus: nexusHex, wornGroup: G1, provenance: { act: "fleet-join-land", personaGroup: G1 } });
    expect(forged.kind, "S3: a bootstrap tag alone grants nothing").toBe("untagged");
    seatDialPeer(maps, "forged", forged);
    expect(await verdict("forged", ONE.intents), "S3: no private plane").toBe(false);
    expect(maps.peerClassMap.get("forged"), "S3: no class").toBeUndefined();

    seatDialPeer(maps, "foreign", dialRelationOf({ source: "bootstrap", landedPin: landed, pinDigest: other, pinNexus: nexusHex, wornGroup: G1 }));
    expect(await verdict("foreign", ONE.intents), "S4: a landing record naming another pin shares no private plane").toBe(false);
    expect(dialRelationOf({ source: "bootstrap", landedPin: landed, pinDigest: landed, pinNexus: nexusHex, wornGroup: null }).kind, "S4: no worn face").toBe("untagged");

    unseatDialPeer(maps, "same-face");
    expect(maps.peerClassMap.has("same-face"), "S5: the class drops").toBe(false);
    expect(maps.faceViews.gateFor("same-face"), "S5: the view drops").toBeNull();
    expect(await verdict("same-face", ONE.intents), "S5: nothing crosses after the unseat").toBe(false);
  });

  test("S6 — RED: the realm's return lane names the hearth the dial seated, and the unseat clears it", async () => {
    const mod = await dialRelation();
    const { dialRelationOf, seatDialPeer, unseatDialPeer } = mod!;
    const { maps } = seatRig();
    const atB = Buffer.from("nexus-b.synthetic", "utf8").toString("hex");
    seatDialPeer(maps, "hearth-b", dialRelationOf({ source: "kept", landedPin: null, pinDigest: "d".repeat(64), pinNexus: atB, wornGroup: G1 }));
    expect(maps.dialedHearth, "S6: the seated dial names B's Nexus").toEqual({ pinned: true, aid: "nexus-b.synthetic" });
    unseatDialPeer(maps, "hearth-b");
    expect(maps.dialedHearth ?? null, "S6: the unseat clears it").toBeNull();
    seatDialPeer(maps, "untagged-b", dialRelationOf({ source: "bootstrap", landedPin: null, pinDigest: "d".repeat(64), pinNexus: atB, wornGroup: G1 }));
    expect(maps.dialedHearth, "S6: an untagged dial still names its own hearth for the return lane").toEqual({ pinned: true, aid: "nexus-b.synthetic" });
  });
});
