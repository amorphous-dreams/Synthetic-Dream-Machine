/**
 * dial-relation — THE OUTBOUND DIAL SEATS THE RELATION ITS OWN HELD RECORDS PROVE (road `P26`; controller transport
 * ruling 2026-10-31, and its fork ruling (b), settled at rung 1: each side decides what IT shares from ITS OWN held records;
 * "sync carries; verification decides").
 *
 * Since the house proved its islands by arrival, a dialed hearth reads as WIRE: right for the guard, yet the dial seated no
 * relation at all, so a joined leaf's `face-join` summons on its face's intents plane could not cross the dial to the founding
 * hearth (e2e meme-two-vessel-bag ⑨ red at e6d11928b). The gate's signed answer carries no class (`verified` reads
 * `["state"]`), and the dialer never takes its relation from the remote's word: the PIN carries its provenance, written by
 * the act that made it.
 *
 *   P1  RED: `fleet join land` tags the hearth pin it writes with its act and the face; the boot reads the tag back.
 *       CONTROL: a pin written without a tag reads none.
 *   P2  RED: the dial's choice names where its pin came from: the bootstrap's pin (with its tag) or a kept admit bundle.
 *   S1  RED: a dial whose pin `fleet join land` wrote for the WORN face seats a face view of that face: the intents plane
 *       (where the summons rides) and the persona plane cross to the dialed hearth.
 *   S2  CONTROL: a dial whose pin came from a kept admit bundle seats the contracted class and its standing, and shares no
 *       private plane.
 *   S3  RED: a pin with no provenance tag shares no private plane (the weakest relation, fail closed).
 *   S4  RED: a pin tagged for ANOTHER face than the worn one shares no private plane.
 *   S5  CONTROL: the unseat drops the class, the standing and the view.
 */
import { describe, expect, test } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { generateAutomergeUrl, interpretAsDocumentId, type DocumentId } from "@automerge/automerge-repo";
import {
  DAEMON_BAG_ID, DeterministicFederationGate, custodyRootDoor, deriveGateBundle, personaBagIdFor, personaMembershipEntries,
  personaSiblingBagIds, sovereignGateRoot, sovereignRoute, type GateBundlePin, type PeerClass,
} from "@lararium/mesh";
import { hearthDialTiddlers, readHearthDialPin } from "../src/hearth-dial-pin.js";
import { chooseHearthDial } from "../src/hearth-gate-pins.js";
import { faceFleetViews } from "../src/face-fleet-view.js";
import { selfSlotShareDecision } from "../src/self-slot-share.js";

type Relation = { readonly kind: string; readonly personaGroup?: string; readonly nexus?: string | null };
type DialRelationModule = {
  dialRelationOf(input: { source: "bootstrap" | "kept" | null; provenance?: unknown; pinNexus: string | null; wornGroup: string | null }): Relation;
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
const bootstrapWith = (tiddlers: Record<string, unknown>): string => {
  const dir = mkdtempSync(join(tmpdir(), "lares-dial-relation-"));
  const path = join(dir, "social-bootstrap.json");
  writeFileSync(path, JSON.stringify({ title: "$:/plugins/lares/bootstrap", text: JSON.stringify({ tiddlers }) }));
  return path;
};

/** The composer's seat maps and the share verdict a dial peer meets: wire, its class, its face view. */
function seatRig() {
  const maps = { peerClassMap: new Map<string, PeerClass>(), peerNexus: new Map<string, string | null>(), faceViews: faceFleetViews(() => bootstrap(ONE), () => G1) };
  const verdict = (peerId: string, url: string) => selfSlotShareDecision({
    hasWsSocket: true, peerClass: maps.peerClassMap.get(peerId), selfSlotFedGate: shelf, antigenRing: null, membership: null, planeSeal: null,
    federationPosture: "private", peerId, documentId: idOf(url), sessionFace: maps.faceViews.gateFor(peerId),
  } as Parameters<typeof selfSlotShareDecision>[0]);
  return { maps, verdict };
}

describe("the outbound dial seats the relation its own held records prove", () => {
  test("P1 — RED: fleet join land tags the hearth pin with its act and face; CONTROL: an untagged pin reads none", () => {
    const pin = pinAt("nexus-a.synthetic");
    const tagged = bootstrapWith({ ...(hearthDialTiddlers as (...a: unknown[]) => Record<string, unknown>)("ws://127.0.0.1:4242/ws", pin.signingKey, null, pin, null, { act: "fleet-join-land", personaGroup: G1 }) });
    const plain = bootstrapWith({ ...hearthDialTiddlers("ws://127.0.0.1:4242/ws", pin.signingKey, null, pin) });
    try {
      expect((readHearthDialPin(tagged) as { provenance?: unknown } | null)?.provenance, "P1: the tag reads back").toEqual({ act: "fleet-join-land", personaGroup: G1 });
      expect((readHearthDialPin(plain) as { provenance?: unknown } | null)?.provenance, "CONTROL: no tag").toBeUndefined();
    } finally { for (const p of [tagged, plain]) rmSync(join(p, ".."), { recursive: true, force: true }); }
  });

  test("P2 — RED: the dial's choice names the bootstrap's pin as its source, with its tag", () => {
    const pin = pinAt("nexus-a.synthetic");
    const provenance = { act: "fleet-join-land", personaGroup: G1 };
    const choice = chooseHearthDial({ hearthPin: { syncUrl: "ws://127.0.0.1:4242/ws", gatePin: pin, provenance } as never, kept: [] }) as unknown as { source?: unknown; provenance?: unknown };
    expect(choice.source, "P2: the source").toBe("bootstrap");
    expect(choice.provenance, "P2: the tag rides the choice").toEqual(provenance);
  });

  test("S1–S5 — the dial's seat: same face crosses its planes; kept bundle contracted; untagged and foreign-face none", async () => {
    const mod = await dialRelation();
    expect(mod, "dial-relation stands").not.toBeNull();
    const { dialRelationOf, seatDialPeer, unseatDialPeer } = mod!;
    const nexusHex = Buffer.from("nexus-a.synthetic", "utf8").toString("hex");
    const { maps, verdict } = seatRig();

    seatDialPeer(maps, "same-face", dialRelationOf({ source: "bootstrap", provenance: { act: "fleet-join-land", personaGroup: G1 }, pinNexus: nexusHex, wornGroup: G1 }));
    expect(await verdict("same-face", ONE.intents), "S1: the intents plane (the summons) crosses").toBe(true);
    expect(await verdict("same-face", ONE.persona), "S1: the persona plane crosses").toBe(true);

    const contracted = dialRelationOf({ source: "kept", pinNexus: nexusHex, wornGroup: G1 });
    expect(contracted.kind, "S2: a kept bundle's pin reads contracted").toBe("contracted");
    seatDialPeer(maps, "contracted", contracted);
    expect(maps.peerClassMap.get("contracted"), "S2: the class").toBe("contracted");
    expect(maps.peerNexus.get("contracted"), "S2: the standing names the pin's Nexus").toBe("nexus-a.synthetic");
    expect(await verdict("contracted", ONE.intents), "S2: no private plane").toBe(false);
    expect(await verdict("contracted", ONE.persona), "S2: no private plane").toBe(false);

    seatDialPeer(maps, "untagged", dialRelationOf({ source: "bootstrap", pinNexus: nexusHex, wornGroup: G1 }));
    expect(await verdict("untagged", ONE.intents), "S3: an untagged pin shares no private plane").toBe(false);
    expect(maps.peerClassMap.get("untagged"), "S3: no class").toBeUndefined();

    seatDialPeer(maps, "foreign", dialRelationOf({ source: "bootstrap", provenance: { act: "fleet-join-land", personaGroup: G2 }, pinNexus: nexusHex, wornGroup: G1 }));
    expect(await verdict("foreign", ONE.intents), "S4: a pin tagged for another face shares no private plane").toBe(false);

    unseatDialPeer(maps, "same-face");
    expect(maps.peerClassMap.has("same-face"), "S5: the class drops").toBe(false);
    expect(maps.faceViews.gateFor("same-face"), "S5: the view drops").toBeNull();
    expect(await verdict("same-face", ONE.intents), "S5: nothing crosses after the unseat").toBe(false);
  });
});
