/**
 * browser-relay-pin — a browser vessel crosses to a relay only under a gate key it PINNED.
 *
 * The relay answers an upgrade only on the knock its own gate key derives (`gate-knock`), and its verdict
 * reads as a pass only under that key. A vessel handed a relay URL and no gate key has nothing to knock with
 * and nothing to verify against, so it does not dial — and says so, loudly, instead of dialing a path no gate
 * claims and sitting dark. Its own key is never a stand-in: a browser's key is never the node's gate key.
 *
 * Meme: lar:///ha.ka.ba/lararium/mesh/siege-resilience#/the-active-prober
 */

/** The pin a relay dial rides under, or why there is none. */
export type RelayPin =
  | { readonly dial: true;  readonly gatePubKey: string }
  | { readonly dial: false; readonly reason: string | null };

const KEY_RE = /^[0-9a-fA-F]{64}$/;

/** Decide the relay pin: no URL → no dial (and nothing to say); a URL with a well-formed key → dial; else refuse aloud. */
export function relayPinFor(relayUrl: string | undefined | null, relayGatePubKey: string | undefined | null): RelayPin {
  if (!relayUrl) return { dial: false, reason: null };
  if (!relayGatePubKey || !KEY_RE.test(relayGatePubKey)) {
    return {
      dial: false,
      reason: `no gate key pinned for ${relayUrl} — the relay answers only on the knock its gate key derives, `
        + "so this vessel does not cross. Pin the node's gate key (?gate=<hex>, printed by the node as `gate key:`).",
    };
  }
  return { dial: true, gatePubKey: relayGatePubKey.toLowerCase() };
}
