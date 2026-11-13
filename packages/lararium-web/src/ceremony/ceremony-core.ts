/**
 * ceremony-core — the ceremony document's own parts, pure where they can stand pure
 * (lar:///ha.ka.ba/lares/docs/pono/browser-vessel-lift#/the-ceremony).
 *
 * The ceremony document stands only where it can keep its promise: a secure context (a service worker and WebAuthn need
 * one), a top-level window (never a frame), its strict policy in force (no eval, so no injected string runs), and a broker
 * to hand it the vessel's port. Each failure refuses by name and the document paints no form.
 *
 * This module imports nothing; the reach witness (`tools/ceremony-entry-witness.mjs`) holds the document's graph to its own
 * directory and the protocol's types.
 */
import type { CeremonyAnswer, CeremonyPasskey, CeremonyToVessel } from "../ceremony-protocol.js";

export interface CeremonyEnv {
  readonly isSecureContext: boolean;
  readonly framed: boolean;
  readonly hasServiceWorker: boolean;
  /** True when a string compiles as code here: the policy forbids it, so true names a policy out of force. */
  readonly evalRuns: boolean;
}

/** The first refusal this document stands under, or null where it may ask. */
export function ceremonyRefusal(env: CeremonyEnv): string | null {
  if (!env.isSecureContext) return "ceremony-needs-secure-context";
  if (env.framed) return "ceremony-framed";
  if (env.evalRuns) return "ceremony-csp-absent";
  if (!env.hasServiceWorker) return "ceremony-broker-absent";
  return null;
}

/** Whether a string compiles as code in this document. Under the ceremony's policy (no `unsafe-eval`) it throws. */
export function evalRuns(): boolean {
  try { return (new Function("return 1") as () => number)() === 1; } catch { return false; }
}

/** The ask id the page's navigation names (`#ask=<id>`), or null. */
export function askIdOf(hash: string): string | null {
  const id = new URLSearchParams(hash.replace(/^#/, "")).get("ask");
  return id && /^[0-9a-f-]{36}$/i.test(id) ? id : null;
}

/** A field the ceremony reads: its value, and the clear it takes. */
export interface SecretField { value: string }

/**
 * Send the passphrase down the vessel's port: its UTF-8 bytes on a fresh ArrayBuffer, transferred (it detaches here as it
 * leaves), and every field cleared before the post. Answers the buffer, so a witness can read it detached.
 */
export function sendPassphrase(port: Pick<MessagePort, "postMessage">, askId: string, fields: readonly SecretField[]): ArrayBuffer {
  const encoded = new TextEncoder().encode(fields[0]?.value ?? "");
  for (const field of fields) field.value = "";
  const buffer = new ArrayBuffer(encoded.byteLength);
  new Uint8Array(buffer).set(encoded);
  encoded.fill(0);
  const answer: CeremonyAnswer = { kind: "passphrase", bytes: buffer };
  port.postMessage({ t: "answer", askId, answer } satisfies CeremonyToVessel, [buffer]);
  return buffer;
}

/** Decline: the vessel's ask reads null. */
export function sendDecline(port: Pick<MessagePort, "postMessage">, askId: string): void {
  port.postMessage({ t: "answer", askId, answer: null } satisfies CeremonyToVessel);
}

const b64url = (bytes: Uint8Array): string => btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

/**
 * One WebAuthn assertion with the PRF extension over each passkey pin's salt; the output and the credential id leave on
 * transferred buffers. A custody ask alone offers this route (the ward refuses a passkey on the vessel's side as well).
 */
export async function sendPasskey(port: Pick<MessagePort, "postMessage">, askId: string, passkeys: readonly CeremonyPasskey[], credentials: Pick<CredentialsContainer, "get">): Promise<void> {
  const evalByCredential: Record<string, { first: Uint8Array<ArrayBuffer> }> = {};
  for (const p of passkeys) evalByCredential[b64url(p.credentialId)] = { first: Uint8Array.from(p.prfSalt) };
  const challenge = crypto.getRandomValues(new Uint8Array(32));
  const got = await credentials.get({
    publicKey: {
      challenge,
      allowCredentials: passkeys.map((p) => ({ type: "public-key" as const, id: Uint8Array.from(p.credentialId) })),
      userVerification: "required",
      extensions: { prf: { evalByCredential } } as AuthenticationExtensionsClientInputs,
    },
  }) as PublicKeyCredential | null;
  const first = (got?.getClientExtensionResults() as { prf?: { results?: { first?: ArrayBuffer } } } | undefined)?.prf?.results?.first;
  if (!got || !(first instanceof ArrayBuffer)) throw new Error("ceremony-passkey-no-prf");
  const credentialId = got.rawId.slice(0);
  const prfOutput = first.slice(0);
  new Uint8Array(first).fill(0);
  const answer: CeremonyAnswer = { kind: "passkey", credentialId, prfOutput };
  port.postMessage({ t: "answer", askId, answer } satisfies CeremonyToVessel, [credentialId, prfOutput]);
}
