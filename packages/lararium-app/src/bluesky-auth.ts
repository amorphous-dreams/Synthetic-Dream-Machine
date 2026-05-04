/**
 * bluesky-auth — AT Protocol OAuth client for the browser.
 *
 * Bluesky is the primary login for all end-users.
 *
 * AT Proto OAuth law:
 *   - PKCE + DPoP handled entirely by @atproto/oauth-client-browser.
 *   - client_id for localhost dev = "http://localhost" (AT Proto loopback special case).
 *   - client_id for production    = "https://elyncia.app/oauth/client-metadata.json"
 *   - After the callback, the session's DID is the user's Automerge peer identity.
 *   - The DID is stored in the LarAuthReceipt and seeded into the social Automerge docs.
 *
 * Boot flow:
 *   initBlueSkyClient() → call once at app start
 *   tryResumeBlueSkySession() → returns receipt if a session exists (return visit / callback)
 *   startBlueSkyLogin(handle) → redirects to AT Proto authorization server
 */

import { BrowserOAuthClient } from "@atproto/oauth-client-browser";
import type { LarAuthReceipt } from "@lararium/core";

// ---------------------------------------------------------------------------
// Client metadata
// ---------------------------------------------------------------------------

function resolveClientId(): string {
  if (typeof location === "undefined") return "http://localhost";
  const { protocol, hostname } = location;
  if (hostname === "localhost" || hostname === "127.0.0.1") return "http://localhost";
  return `${protocol}//${hostname}/oauth/client-metadata.json`;
}

function resolveRedirectUri(): string {
  if (typeof location === "undefined") return "http://localhost:4321/auth/bluesky/callback";
  const { protocol, hostname, port } = location;
  const portPart = port ? `:${port}` : "";
  return `${protocol}//${hostname}${portPart}/auth/bluesky/callback`;
}

// ---------------------------------------------------------------------------
// Singleton client
// ---------------------------------------------------------------------------

let _client: BrowserOAuthClient | null = null;

export function initBlueSkyClient(): BrowserOAuthClient {
  if (_client) return _client;
  _client = new BrowserOAuthClient({
    clientMetadata: {
      client_id:     resolveClientId(),
      client_name:   "Lararium",
      redirect_uris: [resolveRedirectUri()],
      scope:         "atproto transition:generic",
      grant_types:   ["authorization_code", "refresh_token"],
      response_types: ["code"],
      token_endpoint_auth_method: "none",
      application_type: "web",
      dpop_bound_access_tokens: true,
    },
    handleResolver: "https://bsky.social",
  });
  return _client;
}

// ---------------------------------------------------------------------------
// Session → LarAuthReceipt
// ---------------------------------------------------------------------------

function sessionToReceipt(session: {
  did: string;
  info?: { handle?: string; displayName?: string; };
}): LarAuthReceipt {
  const now    = new Date();
  const expires = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24h
  const handle  = session.info?.handle;
  const display = session.info?.displayName ?? handle ?? session.did;

  return {
    provider:    "bluesky-oauth",
    subject:     session.did,
    displayName: display,
    issuedAt:    now.toISOString(),
    expiresAt:   expires.toISOString(),
    scopes:      [{ with: "lararium:*", can: "*" }],
    principal: {
      provider: "bluesky-oauth",
      did:      session.did,
      ...(handle !== undefined && { handle }),
    },
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Try to resume an existing Bluesky session (page load / OAuth callback).
 * Returns null if no active session.
 */
export async function tryResumeBlueSkySession(): Promise<LarAuthReceipt | null> {
  const client = initBlueSkyClient();
  try {
    const result = await client.init();
    if (!result) return null;
    const { session } = result;
    const info = (session as { info?: { handle?: string; displayName?: string } }).info;
    return sessionToReceipt({ did: String(session.did), ...(info !== undefined && { info }) });
  } catch {
    return null;
  }
}

/**
 * Initiate Bluesky login for a given handle or DID.
 * Redirects the browser to the AT Proto authorization server.
 */
export async function startBlueSkyLogin(handleOrDid: string): Promise<void> {
  const client = initBlueSkyClient();
  await client.signIn(handleOrDid, { prompt: "login" });
}

/** Sign out and clear the Bluesky session. */
export async function signOutBluesky(): Promise<void> {
  if (!_client) return;
  const result = await _client.init();
  if (result?.session) await result.session.signOut?.();
}
