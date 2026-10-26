/**
 * nexus-doc-text — the ONE parser of a Nexus seal file's TEXT: its three fences (seal, kahu, practice) folded into a
 * composed `NexusDoc`, or null (FAIL CLOSED).
 *
 * Platform-blind: it reads a string and opens no file. The node's disk adapter (`lararium-node` `nexus-doc`) reads the
 * file and hands its body here; a browser leaf hands the charter text a root-signed fleet-join answer carried. One
 * parser, so a decision on incoming bytes and every later read of them agree on what they say.
 *
 * FAILS CLOSED: a missing seal or kahu block, torn JSON, or a wrong-kind payload read `null`, and the roster then folds
 * empty. A torn PRACTICE block never closes the doc, so the fastest-cadence joint can never take the slower ones down.
 *
 * Meme: lar:///ha.ka.ba/lararium/mesh/nexus-doc-text
 */
import { NEXUS_DOC_DOMAIN } from "./domains.js";
import type { QuorumSignature } from "./kapae-antigen.js";
import type { NexusCharterKahu, NexusDoc } from "./nexus-seal-seed.js";
import { readCharterInception, type SealEpoch, type SealKeySet, type SealRoll } from "./wax-stamp.js";

/** The seal file's three fences, one joint each. */
export const NEXUS_DOC_FENCES = Object.freeze({ seal: "nexus-seal", kahu: "nexus-kahu", practice: "nexus-practice" } as const);

/** The regex that finds one fence's payload in a seal file's text. */
export function nexusDocFenceRe(name: string): RegExp {
  return new RegExp("```json " + name + "\\r?\\n([\\s\\S]*?)\\r?\\n```");
}

/** Pull one fence's payload, or null when the fence stands absent or its JSON reads torn. */
export function readNexusDocFence(body: string, name: string): unknown | null {
  const m = nexusDocFenceRe(name).exec(body);
  if (!m) return null;
  try { return JSON.parse(m[1]!); } catch { return null; }
}


// ── coercion ──────────────────────────────────────────────────────────────────────────────────────

/**
 * Coerce a parsed seal-lineage payload: `undefined` when absent (a genesis-inception doc with no lineage
 * yet), the sentinel `"torn"` when malformed (which reads the WHOLE doc closed — the parser never guesses a
 * partial pre-rotation lineage into authority), or the typed `SealEpoch[]` when every epoch's shape holds.
 */
function coerceSealLineage(raw: unknown): SealEpoch[] | "torn" | undefined {
  if (raw === undefined || raw === null) return undefined;
  if (!Array.isArray(raw)) return "torn";
  const lineage: SealEpoch[] = [];
  for (const item of raw) {
    if (typeof item !== "object" || item === null) return "torn";
    const e = item as Record<string, unknown>;
    if (typeof e["epochCid"]      !== "string")    return "torn";
    if (typeof e["keySetHash"]    !== "string")    return "torn";
    // The previous charter shape had one commitment for the whole successor set. Keep it
    // distinguishable at the document boundary so callers can refuse it explicitly.
    if (Object.prototype.hasOwnProperty.call(e, "nextKeyCommit")) return "torn";
    // The earlier link shape named one `prevEpochCid`; a seal record names a set of predecessors.
    if (Object.prototype.hasOwnProperty.call(e, "prevEpochCid")) return "torn";
    if (!Array.isArray(e["nextKeyDigests"]) || !(e["nextKeyDigests"] as unknown[]).every((d) => typeof d === "string" && /^[0-9a-f]{64}$/.test(d))) return "torn";
    if (!Number.isInteger(e["nextThreshold"]) || (e["nextThreshold"] as number) < 0) return "torn";
    const preds = e["predecessors"];
    if (!Array.isArray(preds) || preds.length > 2 || !preds.every((p) => typeof p === "string")) return "torn";
    const epoch: SealEpoch = {
      epochCid:      e["epochCid"] as string,
      keySetHash:    e["keySetHash"] as string,
      nextKeyDigests: [...(e["nextKeyDigests"] as string[])],
      nextThreshold: e["nextThreshold"] as number,
      predecessors:  [...(preds as string[])],
    };
    if (e["roll"] !== undefined && e["inception"] !== undefined) return "torn";
    if (e["inception"] !== undefined) {
      // Shape only, through the mesh's strict reader: `verifySealLineage` judges the signatures.
      const inception = readCharterInception(e["inception"]);
      if (inception === null) return "torn";
      lineage.push({ ...epoch, inception });
      continue;
    }
    if (e["roll"] === undefined) { lineage.push(epoch); continue; }
    const roll = coerceSealRoll(e["roll"]);
    if (roll === "torn") return "torn";
    lineage.push({ ...epoch, roll });
  }
  return lineage;
}

/** A key-set read off disk: string keys and a whole threshold, or `"torn"`. */
function coerceKeySet(raw: unknown): SealKeySet | "torn" {
  if (typeof raw !== "object" || raw === null) return "torn";
  const r = raw as Record<string, unknown>;
  if (!Array.isArray(r["keys"]) || !r["keys"].every((k) => typeof k === "string")) return "torn";
  if (!Number.isInteger(r["threshold"])) return "torn";
  return { keys: [...(r["keys"] as string[])], threshold: r["threshold"] as number };
}

/**
 * Coerce an epoch's signed roll. Shape only — `verifySealLineage` judges the signatures. Only the known
 * fields are copied, so a field smuggled onto the roll never reaches a verifier.
 */
function coerceSealRoll(raw: unknown): SealRoll | "torn" {
  const seated = coerceKeySet(raw);
  if (seated === "torn") return "torn";
  const r = raw as Record<string, unknown>;
  const sigs = r["signatures"];
  if (!Array.isArray(sigs)) return "torn";
  const signatures: QuorumSignature[] = [];
  for (const s of sigs) {
    if (typeof s !== "object" || s === null) return "torn";
    const q = s as Record<string, unknown>;
    if (typeof q["signer"] !== "string" || typeof q["sig"] !== "string") return "torn";
    signatures.push({ signer: q["signer"], sig: q["sig"] });
  }
  if (Object.prototype.hasOwnProperty.call(r, "revealed")) return "torn";
  // The genesis seats a first roll reveals: shape here; the roll law binds them to the genesis's key-set hash.
  if (r["genesis"] === undefined) return { ...seated, signatures };
  const genesis = coerceKeySet(r["genesis"]);
  if (genesis === "torn") return "torn";
  return { ...seated, signatures, genesis };
}

/** Fold the three read blocks into one composed `NexusDoc`, or null when seal or kahu fails its guards. */
function composeDoc(seal: unknown, kahu: unknown, practice: unknown): NexusDoc | null {
  if (typeof seal !== "object" || seal === null) return null;
  const s = seal as Record<string, unknown>;
  if (s["kind"] !== NEXUS_DOC_DOMAIN) return null;
  const epoch = s["sealEpochCid"];
  const sealEpochCid = typeof epoch === "string" && epoch.length > 0 ? epoch : null;
  const lineage = coerceSealLineage(s["sealLineage"]);
  if (lineage === "torn") return null;                            // a torn lineage reads the whole doc closed

  if (typeof kahu !== "object" || kahu === null) return null;
  const k = kahu as Record<string, unknown>;
  if (!Number.isInteger(k["threshold"]) || (k["threshold"] as number) < 1) return null;
  if (!Array.isArray(k["kahu"])) return null;
  const seats: NexusCharterKahu[] = [];
  for (const raw of k["kahu"]) {
    if (typeof raw !== "object" || raw === null) return null;     // a torn seat reads the whole doc closed
    const seat = raw as Record<string, unknown>;
    if (typeof seat["chairLabel"] !== "string") return null;
    const treeKey = seat["verifyingKey"];
    seats.push({
      chairLabel:   seat["chairLabel"] as string,
      verifyingKey: typeof treeKey === "string" && treeKey.length > 0 ? treeKey : null,
    });
  }

  // PRACTICE never closes the doc — a torn dial folds to its fail-closed default downstream, so the
  // fastest-cadence joint can never take the slow-cadence joints with it. The posture reads only the exact
  // literal "open"; anything else folds PRIVATE via `federationPostureFromDoc`, because a torn posture must
  // never silently open the mesh.
  const p = (typeof practice === "object" && practice !== null ? practice : {}) as Record<string, unknown>;
  const posture = p["federationPosture"] === "open" ? ("open" as const) : undefined;

  const base: NexusDoc = { kind: NEXUS_DOC_DOMAIN, threshold: k["threshold"] as number, sealEpochCid, kahu: seats };
  const withLineage = lineage === undefined ? base : { ...base, sealLineage: lineage };
  return posture === undefined ? withLineage : { ...withLineage, federationPosture: posture };
}

/**
 * Parse charter TEXT into a composed `NexusDoc`, or null (FAIL CLOSED) when it carries no seal or kahu block, or either
 * reads torn.
 */
export function parseNexusDoc(body: string): NexusDoc | null {
  return composeDoc(readNexusDocFence(body, NEXUS_DOC_FENCES.seal), readNexusDocFence(body, NEXUS_DOC_FENCES.kahu), readNexusDocFence(body, NEXUS_DOC_FENCES.practice));
}
