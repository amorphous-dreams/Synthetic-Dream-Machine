/**
 * Lararium authority map — slate-clean auth model.
 *
 * This file deliberately contains no provider SDK, UCAN implementation, token
 * verifier, browser redirect machinery, or VS Code command wiring. It only names
 * the seams that the next auth architecture will fill.
 *
 * Two first-class auth routes:
 *
 * 1. BlueSky OAuth (`bluesky-oauth`)
 *    - Browser/public route for elyncia.app once the domain can host OAuth
 *      metadata and callbacks.
 *    - Principal shape should center an ATProto DID / handle.
 *    - The web app receives an auth receipt before content docs hydrate.
 *
 * 2. GitHub via local VS Code (`github-vscode`)
 *    - Local/dev route for VS Code or VS Code Insiders as the operator UX.
 *    - The extension or local app owns GitHub sign-in and hands Lararium a local
 *      auth receipt over loopback / command bridge.
 *    - Principal shape should center a GitHub login plus the local editor host.
 *
 * Authorization doctrine:
 *
 *   Auth identifies the operator/device/session.
 *   Catalog policy maps that identity to rooms, corpora, recipes, and actions.
 *   Automerge doc URLs locate data; they do not grant authority.
 *   Sync sharePolicy asks this registry only whether a peer has an accepted
 *   auth receipt. Later policy checks decide read/write/promote/admin.
 *
 * The old UCAN/did:key peer gate has been removed rather than half-kept. If
 * capability chains return later, they should wrap these provider sessions,
 * not replace the provider identity layer.
 */

// ---------------------------------------------------------------------------
// Provider and principal model
// ---------------------------------------------------------------------------

export type LarAuthProvider = "bluesky-oauth" | "github-vscode" | "local-dev";

export type LarAuthAbility =
  | "auth/session"
  | "catalog/read"
  | "room/read"
  | "room/write"
  | "corpus/read"
  | "corpus/write"
  | "canon/promote"
  | "admin";

export interface LarAuthScope {
  /** Resource id or prefix: `lararium:*`, `room:altar-fire`, `corpus:sdm`. */
  readonly with: string;
  readonly can: LarAuthAbility | "*";
}

export interface LarBlueSkyPrincipal {
  readonly provider: "bluesky-oauth";
  /** ATProto DID, for example `did:plc:...` or `did:web:...`. */
  readonly did: string;
  readonly handle?: string;
}

export interface LarGitHubVsCodePrincipal {
  readonly provider: "github-vscode";
  readonly login: string;
  readonly githubId?: string;
  readonly editor: "vscode" | "vscode-insiders";
  /** Local app/extension instance that vouched for this session. */
  readonly localInstanceId: string;
}

export interface LarLocalDevPrincipal {
  readonly provider: "local-dev";
  readonly label: string;
}

export type LarAuthPrincipal =
  | LarBlueSkyPrincipal
  | LarGitHubVsCodePrincipal
  | LarLocalDevPrincipal;

export interface LarAuthReceipt {
  readonly provider: LarAuthProvider;
  readonly subject: string;
  readonly displayName?: string;
  readonly issuedAt: string;
  readonly expiresAt?: string;
  readonly scopes: readonly LarAuthScope[];
  readonly principal: LarAuthPrincipal;
  /** Provider/session envelope retained for future verification, never parsed here. */
  readonly proof?: unknown;
}

export interface LarAuthClaim {
  readonly provider: LarAuthProvider;
  readonly peerId?: string;
  readonly receipt?: LarAuthReceipt;
  /** Raw provider artifact: OAuth callback payload, VS Code handoff, or local dev marker. */
  readonly proof?: unknown;
}

export type LarAuthVerifyResult =
  | { readonly ok: true; readonly receipt: LarAuthReceipt }
  | { readonly ok: false; readonly reason: string };

// ---------------------------------------------------------------------------
// Provider stub points — intentionally no heavy work yet
// ---------------------------------------------------------------------------

export function authProviderEntry(provider: LarAuthProvider): string {
  switch (provider) {
    case "bluesky-oauth":
      return "/auth/bluesky/start";
    case "github-vscode":
      return "/auth/github-vscode/claim";
    case "local-dev":
      return "/auth/local-dev/claim";
  }
}

/**
 * Placeholder verifier. Real implementations live at the edge that owns each
 * UX: web server for BlueSky OAuth, VS Code extension/local app for GitHub.
 */
export async function verifyAuthClaim(claim: LarAuthClaim): Promise<LarAuthVerifyResult> {
  if (claim.receipt) return { ok: true, receipt: claim.receipt };

  if (claim.provider === "local-dev") {
    return {
      ok: true,
      receipt: createLocalDevReceipt("local-operator"),
    };
  }

  return {
    ok: false,
    reason: `${claim.provider}:verifier-not-implemented`,
  };
}

export function createLocalDevReceipt(label: string, now = new Date()): LarAuthReceipt {
  const issuedAt = now.toISOString();
  return {
    provider: "local-dev",
    subject: `local-dev:${label}`,
    displayName: label,
    issuedAt,
    scopes: [{ with: "lararium:*", can: "*" }],
    principal: { provider: "local-dev", label },
  };
}

export function receiptAllows(
  receipt: LarAuthReceipt,
  resource: string,
  ability: LarAuthAbility,
  now = new Date(),
): boolean {
  if (receipt.expiresAt && Date.parse(receipt.expiresAt) < now.getTime()) return false;
  return receipt.scopes.some((scope) => {
    const resourceOk = scope.with === "lararium:*" || scope.with === resource || resource.startsWith(scope.with.replace(/\*$/, ""));
    const abilityOk = scope.can === "*" || scope.can === ability;
    return resourceOk && abilityOk;
  });
}

// ---------------------------------------------------------------------------
// Peer session registry — provider-neutral replacement for UcanPeerRegistry
// ---------------------------------------------------------------------------

export class LarAuthSessionRegistry {
  private peers = new Map<string, LarAuthReceipt>();

  registerPeer(peerId: string, receipt: LarAuthReceipt): void {
    this.peers.set(peerId, receipt);
  }

  getPeer(peerId: string): LarAuthReceipt | null {
    const receipt = this.peers.get(peerId);
    if (!receipt) return null;
    if (receipt.expiresAt && Date.parse(receipt.expiresAt) < Date.now()) {
      this.peers.delete(peerId);
      return null;
    }
    return receipt;
  }

  isAuthorized(peerId: string, resource = "lararium:*", ability: LarAuthAbility = "auth/session"): boolean {
    const receipt = this.getPeer(peerId);
    if (!receipt) return false;
    return receiptAllows(receipt, resource, ability) || receiptAllows(receipt, resource, "admin");
  }

  evictExpired(now = new Date()): void {
    for (const [id, receipt] of this.peers) {
      if (receipt.expiresAt && Date.parse(receipt.expiresAt) < now.getTime()) this.peers.delete(id);
    }
  }
}
