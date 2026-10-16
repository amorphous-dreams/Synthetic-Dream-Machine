/**
 * founder-self-certificate — the founding vessel certifies itself under its face's root, as a joined vessel holds the
 * certificate its answer carried.
 *
 * A joined vessel opens its session on the certificate the root holder issued over its face-scoped key and on the
 * face's record. The founder holds the root and so issues that certificate to itself, through the SAME doors a join
 * uses: it mints its own face-scoped key into custody (`vessel-face-key`), requests a certificate over it
 * (`requestCertificate`), issues it under the face's per-Nexus key (`issueCertificate`, over the face's withdrawal
 * history at its genesis), signs the root's grant over the face key, and keeps both in the face's record
 * (`keepFaceJoinRecord`). `readJoinedFaceProof` then reads the founder's proof as it reads a joiner's, so the
 * founder's session needs no second path and the removal law sees one chain.
 *
 * WHERE IT IS CALLED. LAZILY, at the first gate open at a scope (`readFounderFaceProof`), and never at founding: a
 * per-Nexus face key mints when a Nexus is first used, so a certificate cannot be issued at founding for a scope that
 * has no key yet, and a vessel founded before this door stands has no certificate at all. The lazy door covers both.
 * An already-founded vessel therefore needs nothing run by hand: its first gate open at each scope issues and keeps the
 * certificate, and every later open finds it standing.
 *
 * WHAT IT CHECKS, BY NAME. A face standing provisional (a restored root adds no vessel to its authority), a face whose
 * anchors do not name the PersonaGroup the grant would name (face B's root never signs a grant for group A, and so
 * never keeps a record under group A), a vessel that holds no root (a joiner is certified by its root holder, never
 * by itself), a record kept under another root,
 * a face key this vessel does not hold at the scope, a history that does not fold, an issue the mesh refuses, a
 * certificate that names another key than this vessel's custody row, and a grant the root's own key does not read.
 * Nothing is kept until every check passed. The chain itself (the face key's signature, the withdrawal memory) is
 * checked again at the session open by `openJoinedFaceSession`.
 *
 * Node-main only. Canon: lar:///ha.ka.ba/lares/docs/stable-founding-road#/rulings ("The founder's certificate")
 */
import { mkdirSync } from "node:fs";
import * as ed25519 from "@noble/ed25519";
import {
  faceKeyGrantImage, foldWithdrawals, hex, issueCertificate, mintVesselFaceKey, readFaceKeyGrant, requestCertificate,
  type FaceScope,
} from "@lararium/mesh";
import { CustodyRowUnavailable } from "./custody-holder.js";
import { nodeFaceKeyCustody, nodeVesselFaceKeyCustody, readVesselFaceKeyPublic, storeVesselFaceKey } from "./face-key-custody.js";
import { FaceProvisional, refuseWhileProvisional } from "./face-provisional.js";
import { updateCustodyRow } from "./custody-seat.js";
import { faceJoinRecordFile, readFaceJoinRecord } from "./fleet-join-custody.js";
import { larIdentityDir } from "./vessel-paths.js";
import { loadIdentityAnchors } from "./identity-anchors.js";
import { readJoinedFaceProof, type JoinedFaceAbsence, type JoinedFaceProof } from "./joined-face-proof.js";
import { loadPersonaGroupRootSeed, loadPersonaGroupRootVerifyingKey, loadVesselVerifyingKey } from "./node-vessel-identity.js";

export const FOUNDER_CERTIFICATE_REFUSALS = [
  "face-provisional",           // a restored face adds no vessel to its authority until a party confirms its head
  "root-other-group",           // the face whose root would sign does not own the PersonaGroup the grant names
  "root-absent",                // this vessel holds no root for the face: a joiner is certified by its root holder
  "record-other",               // the face's record stands under another root key
  "face-key-absent",            // no face key at the scope in custody, or one that answers another key
  "history-unfolded",           // the face's withdrawal history does not fold
  "certificate-refused",        // the mesh refused the request or the issue
  "certificate-other-vessel",   // a certificate stands at the scope over a key this vessel's custody row does not hold
  "grant-unread",               // the root's grant over the face key does not read under the root key
] as const;
export type FounderCertificateRefusal = (typeof FOUNDER_CERTIFICATE_REFUSALS)[number];

export class FounderCertificateRefused extends Error {
  override readonly name = "FounderCertificateRefused";
  constructor(readonly refusal: FounderCertificateRefusal, detail: string, override readonly cause?: unknown) {
    super(`[founder self-certificate] ${refusal}: ${detail}`);
  }
}

/** The doors this module reaches beyond custody; a vector replaces them, a vessel uses the defaults. */
export interface FounderCertificateDoors {
  readonly guard?:    (face: number, act: string) => Promise<void>;
  readonly loadRoot?: (face: number) => Promise<{ readonly seed: Uint8Array; readonly verifyingKey: string } | null>;
  readonly vesselKey?: () => Promise<string>;
  /** The PersonaGroup face `face` owns (its anchors' `personaGroupId`), or null where it owns none. */
  readonly groupOf?:  (face: number) => Promise<string | null>;
}

const defaultGroupOf = async (face: number): Promise<string | null> => (await loadIdentityAnchors(face))?.personaGroupId ?? null;

const defaultRoot = async (face: number): Promise<{ seed: Uint8Array; verifyingKey: string } | null> => {
  const key = (await loadPersonaGroupRootVerifyingKey(face))?.toLowerCase().replace(/^0x/, "");
  if (!key) return null;
  return { seed: await loadPersonaGroupRootSeed(face), verifyingKey: key };
};

const atScope = (value: unknown, scope: FaceScope): boolean => {
  try {
    const at = (value as { scope?: { faceKey?: unknown; nexus?: unknown } }).scope;
    return at?.faceKey === scope.faceKey && at?.nexus === scope.nexus;
  } catch { return false; }
};

/**
 * Make sure this founder's certificate and grant stand in the face's record at `scope`. Idempotent: a certificate
 * that stands over this vessel's own key is left as it is.
 */
export async function ensureFounderCertificate(
  args: { readonly face: number; readonly personaGroup: string; readonly scope: FaceScope },
  doors: FounderCertificateDoors = {},
): Promise<{ readonly state: "issued" | "standing" }> {
  const { face, personaGroup, scope } = args;
  try { await (doors.guard ?? refuseWhileProvisional)(face, "founder self-certificate"); }
  catch (error) {
    if (error instanceof FaceProvisional) throw new FounderCertificateRefused("face-provisional", error.message, error);
    throw error;
  }
  const owns = await (doors.groupOf ?? defaultGroupOf)(face);
  if (owns !== personaGroup) {
    throw new FounderCertificateRefused("root-other-group", `face h${face} does not own the PersonaGroup this grant would name; its root signs nothing for another face.`);
  }
  const root = await (doors.loadRoot ?? defaultRoot)(face);
  if (root === null) throw new FounderCertificateRefused("root-absent", "this vessel holds no root for the face; its root holder certifies a joiner.");
  try {
    const record = await readFaceJoinRecord(personaGroup);
    if (record !== null && record.rootKey !== root.verifyingKey) {
      throw new FounderCertificateRefused("record-other", "this face's record stands under another root key.");
    }
    const standingKey = await readVesselFaceKeyPublic(scope);
    const standingCertificate = record?.certificates.find((c) => atScope(c, scope));
    const standingGrant = record?.grants.map((g) => readFaceKeyGrant(g, root.verifyingKey)).find((g) => g !== null && atScope(g, scope));
    if (standingCertificate !== undefined) {
      const over = (standingCertificate as { vesselFaceKey?: unknown }).vesselFaceKey;
      if (standingKey === null || typeof over !== "string" || over.toLowerCase() !== standingKey.toLowerCase()) {
        throw new FounderCertificateRefused("certificate-other-vessel", "a certificate stands at this scope over a key this vessel's custody does not hold.");
      }
      if (standingGrant) return { state: "standing" };
    }

    // The certificate first, so a refusal here keeps nothing; the key rests in custody before it is certified.
    let certificate: unknown = standingCertificate;
    if (certificate === undefined) {
      let vesselFaceKey = standingKey;
      if (vesselFaceKey === null) {
        const minted = await mintVesselFaceKey();
        try { await storeVesselFaceKey(scope, minted.secret); } finally { minted.secret.fill(0); }
        vesselFaceKey = minted.publicKey;
      }
      const apart = [root.verifyingKey, (await (doors.vesselKey ?? loadVesselVerifyingKey)()).toLowerCase()];
      const requested = await requestCertificate({ scope, vesselFaceKey: vesselFaceKey as never, apart, custody: nodeVesselFaceKeyCustody });
      if (!("request" in requested)) throw new FounderCertificateRefused("certificate-refused", `the request over this vessel's own key was refused: ${requested.refusal}.`);
      const fold = foldWithdrawals(scope);
      if (!("memory" in fold)) throw new FounderCertificateRefused("history-unfolded", `the face's withdrawal history does not fold: ${fold.refusal}.`);
      const issued = await issueCertificate({ request: requested.request, history: fold.memory, apart, custody: nodeFaceKeyCustody });
      if (!("certificate" in issued)) throw new FounderCertificateRefused("certificate-refused", `no certificate issued: ${issued.refusal}.`);
      if (issued.certificate.vesselFaceKey.toLowerCase() !== vesselFaceKey.toLowerCase()) {
        throw new FounderCertificateRefused("certificate-other-vessel", "the issued certificate names another key than this vessel's custody row.");
      }
      certificate = issued.certificate;
    }

    let grant: unknown = record?.grants.find((g) => atScope(g, scope) && readFaceKeyGrant(g, root.verifyingKey) !== null);
    if (grant === undefined) {
      const signature = hex(await ed25519.signAsync(faceKeyGrantImage(personaGroup, scope), root.seed));
      grant = { personaGroup, scope, signature };
      if (readFaceKeyGrant(grant, root.verifyingKey) === null) throw new FounderCertificateRefused("grant-unread", "the root's grant over the face key does not read under the root key.");
    }

    await mergeAtScope({ personaGroup, rootKey: root.verifyingKey, scope, certificate, grant });
    return { state: "issued" };
  } catch (error) {
    if (error instanceof CustodyRowUnavailable && (error.reading === "absent" || error.reading === "names-another-key")) {
      throw new FounderCertificateRefused("face-key-absent", `this vessel's custody holds no usable face key at ${scope.nexus} (${error.reading}).`, error);
    }
    throw error;
  } finally { root.seed.fill(0); }
}

/**
 * THE MERGE UNDER THE HOLD. Two certifications of one face at two scopes read the record apart and write it back; a write
 * from what it read once dropped the other's certificate. This merge reads the record AS IT STANDS under the custody
 * hold and replaces only the entries at its own scope: every other scope's certificate and grant, and the issued book,
 * stand. A record under another root refuses, and so does a certificate at this scope over another face-scoped key.
 */
async function mergeAtScope(args: { readonly personaGroup: string; readonly rootKey: string; readonly scope: FaceScope; readonly certificate: unknown; readonly grant: unknown }): Promise<void> {
  const file = faceJoinRecordFile(args.personaGroup);
  const ours = String((args.certificate as { vesselFaceKey?: unknown }).vesselFaceKey ?? "").toLowerCase();
  mkdirSync(larIdentityDir(), { recursive: true, mode: 0o700 });
  await updateCustodyRow("identity", file, (standing) => {
    let held: Record<string, unknown> = { certificates: [], grants: [] };
    if (standing !== null) {
      try { held = JSON.parse(new TextDecoder().decode(standing)) as Record<string, unknown>; }
      catch { throw new CustodyRowUnavailable("identity", file, "malformed"); }
      if (held["rootKey"] !== args.rootKey) throw new FounderCertificateRefused("record-other", "this face's record stands under another root key.");
      if (!Array.isArray(held["certificates"]) || !Array.isArray(held["grants"])) throw new CustodyRowUnavailable("identity", file, "malformed");
    }
    const certificates = held["certificates"] as unknown[], grants = held["grants"] as unknown[];
    const standingHere = certificates.find((c) => atScope(c, args.scope)) as { vesselFaceKey?: unknown } | undefined;
    if (standingHere !== undefined && String(standingHere.vesselFaceKey ?? "").toLowerCase() !== ours) {
      throw new FounderCertificateRefused("certificate-other-vessel", "a certificate stands at this scope over a key this vessel's custody does not hold.");
    }
    const issued = held["issued"];
    const bytes = new TextEncoder().encode(JSON.stringify({
      personaGroup: args.personaGroup, rootKey: args.rootKey,
      certificates: [...certificates.filter((c) => !atScope(c, args.scope)), args.certificate],
      grants: [...grants.filter((g) => !atScope(g, args.scope)), args.grant],
      ...(Array.isArray(issued) && issued.length > 0 ? { issued } : {}),
    }));
    if (standing !== null && standing.length === bytes.length && standing.every((v, i) => v === bytes[i])) return { plaintext: null, value: undefined };
    return { plaintext: bytes, value: undefined };
  });
}

/**
 * The founder's proof at `scope`, as `openJoinedFaceSession` takes it: the certificate and grant made sure first, then
 * read through the one reader a joiner's proof uses. This is the lazy call a gate open makes.
 */
export async function readFounderFaceProof(
  args: { readonly face: number; readonly personaGroup: string; readonly scope: FaceScope },
  doors: FounderCertificateDoors = {},
): Promise<JoinedFaceProof | JoinedFaceAbsence> {
  await ensureFounderCertificate(args, doors);
  return readJoinedFaceProof({ personaGroup: args.personaGroup, scope: args.scope });
}
