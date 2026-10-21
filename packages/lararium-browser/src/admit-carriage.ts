/**
 * admit-carriage — encode and decode the tab-local carriage of a `device-admit/v1` payload.
 *
 * The fleet-join landing writes the admit it carries into a carriage string; the next boot reads that
 * string back into a payload. The admit verifies on its own (the founder's root signed it), so the
 * carriage needs no trusted channel: a carrier may withhold it, never forge it.
 *
 * `parseAdmitCarriage` takes the carriage as a STRING and returns a payload or nothing. It touches no
 * platform: no `location`, no `history`, no clock, no network. Same bytes in, same payload out, so the
 * crossing tests without standing a relay up.
 */
import type { CarriedAdmitPayload } from "@lararium/keyhive";

/** The kind this carriage admits. A payload announcing anything else gets refused, never guessed at. */
export const ADMIT_KIND = "device-admit/v1" as const;

/** Base64url → the bytes it encodes. Throws on a malformed input; the caller decides what that means. */
function fromBase64Url(b64url: string): string {
  const b64 = b64url.replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(b64);
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

/**
 * Decode `#admit=<base64url>` from a carriage string.
 *
 * Returns the payload, or `null` when the carriage holds none, holds a malformed one, or holds something
 * that is not a device-admit. A refusal is never a throw: a garbled carriage means the admit DID NOT
 * ARRIVE — the vessel then founds its own group and stands at the floor as an anon, which is a correct
 * outcome. A vessel that crashed on a bad paste would fail a human's typo as if it were an attack.
 */
export function parseAdmitCarriage(carriage: string): CarriedAdmitPayload | null {
  const m = /^#admit=([A-Za-z0-9_-]+)$/.exec(carriage);
  if (!m?.[1]) return null;
  let payload: unknown;
  try {
    payload = JSON.parse(fromBase64Url(m[1]));
  } catch {
    return null;
  }
  if (!payload || typeof payload !== "object") return null;
  const p = payload as Record<string, unknown>;
  if (p["kind"] !== ADMIT_KIND) return null;
  // The BINDING is the joinee's whole authority, so a payload missing any of it gets refused HERE rather
  // than half-applied downstream. `runApplyAdmitPayload` fails closed on the same fields; this only moves
  // the refusal to the door, where the carriage can still be re-carried. The persona-KEL PREFIX is part of
  // that authority now — the joinee's Binding Gate pins it and walks the KEL to the head.
  if (typeof p["signerDid"] !== "string" || !p["signerDid"]) return null;
  if (typeof p["personaKelPrefix"] !== "string" || !p["personaKelPrefix"]) return null;
  if (typeof p["hearthTrueName"] !== "string" || !p["hearthTrueName"]) return null;
  if (!p["deviceEdge"] || typeof p["deviceEdge"] !== "object") return null;
  if (!Array.isArray(p["personaActs"])) return null;
  return payload as CarriedAdmitPayload;
}

/** Encode a payload into the carriage form that the boot reads. The round-trip inverse. */
export function toAdmitCarriage(payload: CarriedAdmitPayload): string {
  const json = JSON.stringify(payload);
  const bytes = new TextEncoder().encode(json);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  const b64url = btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  return `#admit=${b64url}`;
}
