/**
 * gate-knock — the per-shrine KNOCK: the upgrade path a gate answers on, derived from its gate key.
 *
 * A gate answers a WebSocket upgrade only on `<route>/<knock>`, where the knock is an HMAC over the route
 * under a key derived from the gate's verifying key and `GATE_KNOCK_DOMAIN`. Every dialer pins the gate key
 * out of band, so every lawful dialer computes the path; a dialer that cannot compute it reaches an upgrade
 * path no face claims, and the vessel's dispatcher destroys that upgrade before any HTTP 101 — no byte of
 * the lares protocol reaches it (siege-resilience#/the-active-prober, the WireGuard mac1 shape).
 *
 * WHAT THE KNOCK DOES NOT HIDE. The path rides the HTTP upgrade in the clear on a plain `ws://` transport, so
 * a passive watcher of one lawful dial learns it — the same leak mac1 carries. The transport itself (TCP
 * accept, TLS) still confesses a listener. Client-proves-first in full is the Noise IK handshake, which the
 * re-found carries.
 *
 * Platform-blind: @noble/hashes only.
 *
 * Meme: lar:///ha.ka.ba/lararium/mesh/siege-resilience#/the-active-prober
 */

import { hmac } from "@noble/hashes/hmac.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { hex, hexToBytes, utf8Bytes } from "./crypto.js";
import { GATE_KNOCK_DOMAIN } from "./domains.js";

const KEY_RE = /^[0-9a-fA-F]{64}$/;

/** The route a URL's path names: its pathname without a trailing slash, `""` for the root. */
function routeOf(pathname: string): string {
  return pathname.replace(/\/+$/, "");
}

/**
 * The knock segment for `gatePubKey` on `route` (`/ws`, `/oracle`, …): 32 hex characters of
 * HMAC-SHA256(key = SHA-256(GATE_KNOCK_DOMAIN ‖ gatePubKey), route). Throws on a gate key that is not 32-byte
 * hex — a dialer with no lawful pin has no path to compute.
 */
export function knockSegment(gatePubKey: string, route: string): string {
  if (!KEY_RE.test(gatePubKey)) throw new Error("gate-knock: the gate key is not 32-byte hex");
  const domain = utf8Bytes(GATE_KNOCK_DOMAIN);
  const keyBytes = hexToBytes(gatePubKey.toLowerCase());
  const material = new Uint8Array(domain.length + keyBytes.length);
  material.set(domain, 0);
  material.set(keyBytes, domain.length);
  return hex(hmac(sha256, sha256(material), utf8Bytes(routeOf(route) || "/"))).slice(0, 32);
}

/** The exact upgrade pathname a gate keyed by `gatePubKey` answers on for `route`: `<route>/<knock>`. */
export function knockPath(gatePubKey: string, route: string): string {
  return `${routeOf(route)}/${knockSegment(gatePubKey, route)}`;
}

/**
 * The URL a dialer opens to reach the gate it pinned: `url` with the knock for its own path appended.
 * `ws://host/ws` pinned to key K dials `ws://host/ws/<knock(K, "/ws")>`. The pin is the dialer's own, never a
 * key the wire named.
 */
export function knockedUrl(url: string, gatePubKey: string): string {
  const u = new URL(url);
  u.pathname = knockPath(gatePubKey, u.pathname);
  return u.href;
}
