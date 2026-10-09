/**
 * sibling-fleet — one PersonaGroup's devices as the sibling tests stand them: a founded KEL, each device
 * enrolled (its edge and its sealed PersonaGroup secret), a rotation that re-enrols the devices it keeps, an
 * in-memory relay a test can turn hostile, and the CARRY instrument that reads every frame DECODED.
 */
import * as ed from "@noble/ed25519";
import { Repo, type PeerId } from "@automerge/automerge-repo";
import { base64UrlDecode, hex, hexToBytes } from "../../src/crypto.js";
import type { PersonaKelEvent } from "../../src/persona-kel.js";
import { provisionThresholdRecoveryAtFounding, attestAndRotate } from "../../src/recovery-keel-core.js";
import { guardianRecoveryRegistrationCard } from "../../src/recovery-registration.js";
import {
  enrolDevice, rollEnrolments, leafStandingUnder, groupSecretOpenerFromSeed, type PersonaGroupEnrolment,
} from "../../src/persona-group-secret.js";
import type { LeafPeerSelf } from "../../src/leaf-peer-proof.js";
import { shareConfigOf } from "../../src/federation-gate.js";
import {
  SiblingNetworkAdapter, type SiblingTransport, type SiblingWireFrame, type SiblingRefusal,
} from "../../src/sibling-channel.js";

export const SEEDS = {
  opA: new Uint8Array(32).fill(11), opB: new Uint8Array(32).fill(22), opC: new Uint8Array(32).fill(77), stranger: new Uint8Array(32).fill(9),
  deviceX: new Uint8Array(32).fill(33), deviceY: new Uint8Array(32).fill(44), deviceZ: new Uint8Array(32).fill(55),
  deviceW: new Uint8Array(32).fill(66),
  g1: new Uint8Array(32).fill(1), g2: new Uint8Array(32).fill(2), g3: new Uint8Array(32).fill(3),
};
export const pubOf    = (s: Uint8Array): Promise<string> => ed.getPublicKeyAsync(s).then(hex);
export const didOf    = async (s: Uint8Array): Promise<string> => `0x${await pubOf(s)}`;
export const signerOf = (s: Uint8Array) => async (bytes: Uint8Array): Promise<string> => hex(await ed.signAsync(bytes, s));

/** The founded PersonaGroup: an inception under opA with a 2-of-3 guardian set armed. */
export async function founded(): Promise<{ inception: PersonaKelEvent; guardianRecoveryKeys: string[]; recoveryThreshold: number }> {
  const guardianRecoveryKeys = await Promise.all([pubOf(SEEDS.g1), pubOf(SEEDS.g2), pubOf(SEEDS.g3)]);
  const slots = ["mine", "guardian-a", "guardian-b"] as const;
  const guardians = guardianRecoveryKeys.map((k, i) => guardianRecoveryRegistrationCard(slots[i]!, k, null));
  const prov = provisionThresholdRecoveryAtFounding({ foundingOpKeyDid: await didOf(SEEDS.opA), guardians, recoveryThreshold: 2 });
  return { inception: prov.inception, guardianRecoveryKeys, recoveryThreshold: prov.recoveryThreshold };
}

/** A root enrols a device: the edge and the sealed secret, under the KEL prefix. */
export async function enrol(root: Uint8Array, device: Uint8Array, prefix: string, boundEpoch = 0): Promise<PersonaGroupEnrolment> {
  return enrolDevice({ opSeed: root, prefix, deviceVerifyingKey: await pubOf(device), hearthTrueName: "", boundEpoch });
}

/** The KEL rotated to opB, re-enrolling exactly `keep` — a device left out is revoked by this rotation. */
export async function rotatedKeeping(keep: readonly Uint8Array[]): Promise<PersonaKelEvent[]> {
  const { inception, guardianRecoveryKeys, recoveryThreshold } = await founded();
  const guardianSigners = await Promise.all([SEEDS.g1, SEEDS.g2].map(async (s) => ({ signer: await pubOf(s), sign: signerOf(s) })));
  const rot = await attestAndRotate({ head: inception, freshOpKeyDid: await didOf(SEEDS.opB), guardianRecoveryKeys, recoveryThreshold, guardianSigners });
  if (!rot.ok) throw new Error(rot.reason);
  const devices = await Promise.all(keep.map(async (d) => ({ deviceVerifyingKey: await pubOf(d), hearthTrueName: "", boundEpoch: 0 })));
  return [inception, await rollEnrolments({ event: rot.event, opSeed: SEEDS.opB, devices })];
}

/** The KEL rotated twice — opB re-enrolling `first`, then opC re-enrolling `second`. */
export async function rotatedTwice(first: readonly Uint8Array[], second: readonly Uint8Array[]): Promise<PersonaKelEvent[]> {
  const { guardianRecoveryKeys, recoveryThreshold } = await founded();
  const once = await rotatedKeeping(first);
  const guardianSigners = await Promise.all([SEEDS.g1, SEEDS.g2].map(async (s) => ({ signer: await pubOf(s), sign: signerOf(s) })));
  const rot = await attestAndRotate({ head: once[1]!, freshOpKeyDid: await didOf(SEEDS.opC), guardianRecoveryKeys, recoveryThreshold, guardianSigners });
  if (!rot.ok) throw new Error(rot.reason);
  const devices = await Promise.all(second.map(async (d) => ({ deviceVerifyingKey: await pubOf(d), hearthTrueName: "", boundEpoch: 0 })));
  return [...once, await rollEnrolments({ event: rot.event, opSeed: SEEDS.opC, devices })];
}

/** A leaf under a KEL: its standing read off its enrolment and every re-enrolment the KEL carries for it. */
export async function leafUnder(
  device: Uint8Array, enrolment: PersonaGroupEnrolment, kel: readonly PersonaKelEvent[], expectedEpoch?: number,
): Promise<LeafPeerSelf> {
  const deviceKey = await pubOf(device);
  const standing = await leafStandingUnder({ kel, deviceKey, enrolment, open: groupSecretOpenerFromSeed(device) });
  return {
    deviceKey, sign: signerOf(device), edge: standing.edge, kel, secrets: standing.secrets,
    ...(expectedEpoch !== undefined ? { expectedEpoch } : {}),
  };
}

/**
 * An in-memory relay: it stamps every frame with the key it "proved" for the sender and routes it to the
 * addressed key (or every other member). It keeps every frame it carried, as it carried it, and `inject` lets a
 * test stand a HOSTILE relay that injects, replays or forges.
 */
export function memoryRelay() {
  const members = new Map<string, { frame: Set<(from: string, f: unknown) => void>; close: Set<() => void> }>();
  const carried: string[] = [];
  const deliver = (from: string, to: string, frame: unknown): void => {
    const text = JSON.stringify(frame);
    carried.push(text);
    queueMicrotask(() => { for (const l of members.get(to)?.frame ?? []) l(from, JSON.parse(text)); });
  };
  const relay = {
    carried,
    /** Every frame the relay carried, with its sender and its addressee. */
    log: [] as Array<{ from: string; to: string; frame: SiblingWireFrame }>,
    /** Every sealed frame the relay carried from `from` to `to`, as it carried it. */
    sealedFrom: [] as Array<{ from: string; to: string; frame: SiblingWireFrame }>,
    inject(from: string, to: string, frame: unknown): void { deliver(from, to, frame); },
    transportFor(key: string): () => Promise<SiblingTransport> {
      return async () => {
        const m = { frame: new Set<(from: string, f: unknown) => void>(), close: new Set<() => void>() };
        members.set(key, m);
        return {
          join: () => { /* one room: every member of this relay shares it */ },
          send: (to, frame) => {
            if (frame.t === "seal" && to) relay.sealedFrom.push({ from: key, to, frame });
            for (const target of to ? [to] : [...members.keys()].filter((k) => k !== key)) {
              relay.log.push({ from: key, to: target, frame });
              deliver(key, target, frame);
            }
          },
          onFrame: (l) => { m.frame.add(l); return () => { m.frame.delete(l); }; },
          onClose: (l) => { m.close.add(l); return () => { m.close.delete(l); }; },
          close: () => { members.delete(key); },
        };
      };
    },
  };
  return relay;
}

export interface Leaf { repo: Repo; adapter: SiblingNetworkAdapter; refusals: SiblingRefusal[]; self: LeafPeerSelf; suffixes: PersonaKelEvent[][] }

/** Stand a leaf on the relay: a repo whose only network is the sibling channel, sharing every doc. */
export function standLeaf(
  device: Uint8Array, enrolment: PersonaGroupEnrolment, self: LeafPeerSelf, relay: ReturnType<typeof memoryRelay>,
  opts: {
    readonly sharePolicy?: (peerId: PeerId, documentId?: string) => Promise<boolean>;
    /** An edge the leaf presents whatever its KEL re-delegated — an impostor's. */
    readonly presents?: LeafPeerSelf["edge"];
  } = {},
): Leaf {
  const sharePolicy = opts.sharePolicy ?? (async () => true);
  const refusals: SiblingRefusal[] = [];
  const suffixes: PersonaKelEvent[][] = [];
  const adapter = new SiblingNetworkAdapter({
    transport: relay.transportFor(self.deviceKey),
    kel: self.kel,
    leaf: async (kel) => ({ ...(await leafUnder(device, enrolment, kel, self.expectedEpoch)), ...(opts.presents ? { edge: opts.presents } : {}) }),
    onKelSuffix: (events) => { suffixes.push([...events]); },
    onRefusal: (r) => refusals.push(r),
  });
  // The verdict seats on announce AND access (`shareConfigOf`), as every vessel's does: a legacy `sharePolicy`
  // fills announce alone and leaves a request by id wide open.
  const repo = new Repo({ network: [adapter], shareConfig: shareConfigOf(async (peerId, documentId) => sharePolicy(peerId, documentId)) });
  return { repo, adapter, refusals, self, suffixes };
}

export async function until(cond: () => boolean, label: string, ms = 3000): Promise<void> {
  const start = Date.now();
  while (!cond()) {
    if (Date.now() - start > ms) throw new Error(`timed out waiting for ${label}`);
    await new Promise((r) => setTimeout(r, 10));
  }
}
export const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));
export const peersOf = (l: Leaf): PeerId[] => l.repo.peers;
export const shutdown = async (...leaves: Leaf[]): Promise<void> => { for (const l of leaves) await l.repo.shutdown(); };

// ── THE CARRY INSTRUMENT: every frame read DECODED ─────────────────────────────────────────────────────────────

const B64URL_RE = /^[A-Za-z0-9_-]+$/;
const HEX_RE = /^(?:[0-9a-fA-F]{2})+$/;

/** Every byte view a carried string can hold: its own UTF-8, its base64url decoding, its hex decoding — and,
 *  where a view reads as JSON, every view of every string inside it. */
function viewsOf(text: string, depth: number, out: Uint8Array[]): void {
  out.push(new TextEncoder().encode(text));
  const decoded: Uint8Array[] = [];
  if (HEX_RE.test(text)) decoded.push(hexToBytes(text.toLowerCase()));
  if (B64URL_RE.test(text) && text.length >= 4) { try { decoded.push(base64UrlDecode(text)); } catch { /* not base64url */ } }
  for (const bytes of decoded) {
    out.push(bytes);
    if (depth <= 0) continue;
    let inner: unknown;
    try { inner = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)); } catch { continue; }
    walk(inner, depth - 1, out);
  }
}

function walk(value: unknown, depth: number, out: Uint8Array[]): void {
  if (typeof value === "string") { viewsOf(value, depth, out); return; }
  if (Array.isArray(value)) { for (const v of value) walk(v, depth, out); return; }
  if (value && typeof value === "object") for (const [k, v] of Object.entries(value)) { viewsOf(k, 0, out); walk(v, depth, out); }
}

function contains(hay: Uint8Array, needle: Uint8Array): boolean {
  outer: for (let i = 0; i + needle.length <= hay.length; i++) {
    for (let j = 0; j < needle.length; j++) if (hay[i + j] !== needle[j]) continue outer;
    return true;
  }
  return false;
}

/** Does any carried frame, DECODED — base64url, hex, nested JSON — hold `needle`'s bytes anywhere? */
export function carriedReads(carried: readonly string[], needle: string): boolean {
  const bytes = new TextEncoder().encode(needle);
  for (const text of carried) {
    let parsed: unknown;
    try { parsed = JSON.parse(text); } catch { parsed = text; }
    const views: Uint8Array[] = [];
    walk(parsed, 3, views);
    if (views.some((v) => contains(v, bytes))) return true;
  }
  return false;
}
