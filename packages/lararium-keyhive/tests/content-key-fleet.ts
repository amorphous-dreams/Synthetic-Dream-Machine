/**
 * content-key-fleet — a fleet of REAL Keyhive identities in one PersonaGroup, each device with its own content-key seat,
 * rest, sealed values and session signer. Shared by the suites that seal a bag on one device and read it on another
 * (`content-key-seat.test.ts`, the node's cross-vessel sealed-bag witness).
 *
 * Nothing stands in for Keyhive: the founder creates the group, adds every other device, and ships it the group's
 * events, so each device holds a seat in the face's key group on its own replica.
 *
 * Canon: lar:///ha.ka.ba/lararium/mesh/sealed-store#/the-store
 */
import {
  ScriptedSeatRolls, memorySealedStoreRest,
  type EdgeStanding, type RecordSigner, type RollOutcome, type SealedAddress, type SealedStoreRest,
} from "@lararium/mesh";
import { KeyhiveProvider, InMemoryEventStore, seatContentKeys, type ContentKeySeat } from "../src/index.js";
import { sessionSignatureImage } from "../../lararium-mesh/src/face-proof-subjects.js";
import { chain, signHex, type Chain } from "../../lararium-mesh/tests/face-proof-fixture.js";

export const FLEET_BAG = "lar:///ha.ka.ba/@test/bags/garden-notes";
export const FLEET_SCOPE = "ab".repeat(32);                           // a fleet root, as a seat roll names its scope
export const FLEET_NEXUS = "nexus-test-one";
const bare = (id: string) => id.toLowerCase().replace(/^0x/, "");

export interface Device {
  readonly name: string;
  readonly seed: number;
  readonly events: InMemoryEventStore;
  provider: KeyhiveProvider;
  readonly id: string;
  readonly archives: Uint8Array[];
  readonly rest: SealedStoreRest;
  readonly values: Map<SealedAddress, Uint8Array>;
  readonly chain: Chain;
  readonly signer: RecordSigner;
  readonly rolls: ScriptedSeatRolls;
  readonly standing: Map<string, EdgeStanding>;
  readonly raises: Set<string>;
  readonly reports: RollOutcome[];
  standingOf?: (member: string) => Promise<EdgeStanding>;
  signs: boolean;
  seat: ContentKeySeat;
  /** Stand the seat afresh over the same rest. */
  reseat(): ContentKeySeat;
}

export interface FleetOptions {
  /** The bags each seat holds under the face's key group (default: `FLEET_BAG`). */
  readonly bags?: readonly string[];
  /** Each device's face chain; the founder's chain rides in for the devices after it (default: a chain of its own). */
  readonly chainFor?: (name: string, founder: Chain | null) => Promise<Chain>;
  /** Found the group (default) or leave every device outside any group (`group: false`): a seat with no key group. */
  readonly group?: boolean;
}

/** A session signer over one chain. */
export function signerOf(c: Chain): RecordSigner {
  return {
    certificate: c.sessionCertificate,
    sign: async (purpose, payload) => ({ signature: await signHex(sessionSignatureImage(purpose, c.scope, c.sessionCertificate.sessionKey, payload), c.session) }),
  };
}

/** A fleet of devices in one PersonaGroup: `names[0]` creates the group and seats the rest. */
export async function fleet(base: number, names: readonly string[], opts: FleetOptions = {}): Promise<{ group: string; devices: Device[]; ship(from: Device, to: Device): Promise<void>; everything(from: Device): Promise<Uint8Array[]> }> {
  const devices: Device[] = [];
  const bags = opts.bags ?? [FLEET_BAG];
  let group = "";
  for (const [i, name] of names.entries()) {
    const events = new InMemoryEventStore();
    const provider = new KeyhiveProvider();
    await provider.init({ seed: new Uint8Array(32).fill(base + i), eventStore: events });
    const c = opts.chainFor ? await opts.chainFor(name, devices[0]?.chain ?? null) : await chain(`${name}-${base}`, FLEET_NEXUS);
    const signer = signerOf(c);
    const d: Device = {
      name, seed: base + i, events, provider, id: await provider.vesselIdentifierHex(), archives: [], rest: memorySealedStoreRest(), values: new Map(),
      chain: c, signer, rolls: new ScriptedSeatRolls(), standing: new Map(), raises: new Set(), reports: [], signs: true,
      seat: undefined as unknown as ContentKeySeat,
      reseat() {
        d.seat = seatContentKeys({
          providers: [d.provider], rest: d.rest,
          values: { read: async (a) => d.values.get(a) ?? null, write: async (a, bytes) => { d.values.set(a, Uint8Array.from(bytes)); } },
          restArchive: async (p) => { d.archives.push(await (p as KeyhiveProvider).exportArchive()); },
          group: opts.group === false ? null : { groupId: group, scope: FLEET_SCOPE },
          bags: () => bags,
          standingOf: (member) => d.standingOf ? d.standingOf(member) : d.standing.get(bare(member)) ?? "clear",
          countedRaises: () => d.raises,
          session: { signer: () => (d.signs ? d.signer : null), standing: { holdsWrite: () => true } },
          report: (o) => { d.reports.push(o); },
          subscribe: (sink) => d.rolls.subscribe(sink),
        });
        return d.seat;
      },
    };
    devices.push(d);
  }
  for (const a of devices) for (const b of devices) if (a !== b) await a.provider.receiveContactCard(await b.provider.contactCard());
  const founder = devices[0]!;
  const ship = async (from: Device, to: Device): Promise<void> => { await to.provider.ingestPeerEvents(await from.provider.eventsForPeer(to.id)); };
  if (opts.group !== false) {
    group = (await founder.provider.createGroup()).groupId;
    for (const d of devices.slice(1)) await founder.provider.addGroupMember(d.id, group);
    for (const d of devices.slice(1)) await ship(founder, d);
  }
  for (const d of devices) d.reseat();
  return { group, devices, ship, everything: async (from) => { await from.provider.settleEvents(); return (await from.events.list()).map((r) => r.bytes); } };
}
