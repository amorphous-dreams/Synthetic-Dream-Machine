/**
 * face-device-book — the D4 binding a gate reads: which device a presenting face-scoped key was certified to.
 *
 * A vessel face certificate names its scope and its face-scoped key and no device (`FACE_PROOF_SUBJECT_FIELDS`
 * forbids one on the wire). The binding therefore comes off this vessel's own records, and from two carriers alone:
 *
 *   · THIS VESSEL'S OWN CERTIFICATES. Every certificate in a face's record (`face-join-record`) that this vessel
 *     landed or issued to itself certifies one of ITS OWN face-scoped keys, so it maps to this vessel's own key.
 *     The founder's self-certificate (`founder-self-certificate`) is one of them.
 *   · THE ROOT HOLDER'S ISSUED BOOK. Each fleet-join answer the root holder signed noted, before it left, each
 *     certificate beside the request's vessel key: the device the answer's device edge names (`noteIssuedFaceKeys`).
 *
 * A joined vessel holds no other vessel's certificate, so at a joinee every other presenter reads unbound; only the
 * root holder maps its fleet's faces. A key two carriers map to two devices reads ambiguous. Unbound and ambiguous
 * read UNREADABLE, and the shadow ring sets an unreadable presenter fleet-aside (`gate-shadow-ring`): the gate then
 * sorts it no further than its admit earns.
 *
 * The gate's consult is synchronous, so the book reads its records at `refresh` and answers from what it read. It
 * answers unbound until the first refresh lands, and again after a refresh that failed.
 *
 * Canon: lar:///ha.ka.ba/lares/docs/stable-founding-road#/rulings ("A device set aside")
 */
import type { FaceScope, VesselFaceKey } from "@lararium/mesh";
import type { FaceJoinRecord } from "./fleet-join-custody.js";
import type { FaceDeviceReading } from "./gate-shadow-ring.js";

/** Where the book reads its carriers. Each reader answers this vessel's own state as it stands at the call. */
export interface FaceDeviceSources {
  /** Every face record this vessel keeps: its own certificates, and on the root holder the issued book. */
  readonly records:      () => Promise<readonly FaceJoinRecord[]>;
  /** This vessel's own verifying key. */
  readonly ownVesselKey: () => Promise<string>;
}

export interface FaceDeviceBook {
  /** The device a presenter's face-scoped key was certified to, as of the last refresh. */
  deviceOf(presenter: { readonly scope: FaceScope; readonly vesselFaceKey: VesselFaceKey }): FaceDeviceReading;
  /** Read the carriers again. A refresh that fails leaves the book unbound and throws. */
  refresh(): Promise<void>;
}

const HEX64 = /^[0-9a-f]{64}$/;
const bindingKey = (nexus: string, faceKey: string, vesselFaceKey: string): string =>
  `${nexus}\n${faceKey.toLowerCase()}\n${vesselFaceKey.toLowerCase()}`;

/** The certificate's scope and key, read whole, or null: a record holds certificates as their bytes rode. */
function certified(c: unknown): { nexus: string; faceKey: string; vesselFaceKey: string } | null {
  try {
    const r = c as { scope?: { faceKey?: unknown; nexus?: unknown }; vesselFaceKey?: unknown };
    const faceKey = r.scope?.faceKey, nexus = r.scope?.nexus, vesselFaceKey = r.vesselFaceKey;
    if (typeof faceKey !== "string" || typeof nexus !== "string" || typeof vesselFaceKey !== "string" || nexus.length === 0) return null;
    if (!HEX64.test(faceKey.toLowerCase()) || !HEX64.test(vesselFaceKey.toLowerCase())) return null;
    return { nexus, faceKey, vesselFaceKey };
  } catch { return null; }
}

/** Fold the carriers into one binding: key → device, or null where two carriers name two devices. Pure. */
export function faceDeviceBindings(records: readonly FaceJoinRecord[], ownVesselKey: string): ReadonlyMap<string, string | null> {
  const own = ownVesselKey.trim().toLowerCase();
  const out = new Map<string, string | null>();
  const bind = (key: string, device: string): void => {
    const standing = out.get(key);
    if (standing === undefined) out.set(key, device);
    else if (standing !== device) out.set(key, null);
  };
  for (const record of records) {
    if (HEX64.test(own)) for (const c of record.certificates) {
      const at = certified(c);
      if (at) bind(bindingKey(at.nexus, at.faceKey, at.vesselFaceKey), own);
    }
    for (const e of record.issued ?? []) bind(bindingKey(e.nexus, e.faceKey, e.vesselFaceKey), e.device.toLowerCase());
  }
  return out;
}

export function faceDeviceBook(sources: FaceDeviceSources): FaceDeviceBook {
  let bindings: ReadonlyMap<string, string | null> = new Map();
  let asked = 0;
  return Object.freeze({
    deviceOf(presenter: { readonly scope: FaceScope; readonly vesselFaceKey: VesselFaceKey }): FaceDeviceReading {
      const device = bindings.get(bindingKey(presenter.scope.nexus, presenter.scope.faceKey, presenter.vesselFaceKey));
      if (device === undefined) return { unreadable: "face-device-unbound" };
      if (device === null) return { unreadable: "face-device-ambiguous" };
      return { device };
    },
    async refresh(): Promise<void> {
      // Two refreshes in flight: the one asked last decides, so an older read never lands over a newer one.
      const mine = ++asked;
      try {
        const [records, own] = await Promise.all([sources.records(), sources.ownVesselKey()]);
        if (mine === asked) bindings = faceDeviceBindings(records, own);
      } catch (error) {
        if (mine === asked) bindings = new Map();
        throw error;
      }
    },
  });
}
