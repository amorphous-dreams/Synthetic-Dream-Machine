/**
 * The platform-blind Pronaos inventory.
 *
 * A Pronaos names a finite public first face.  This module only describes and
 * validates that face; it does not serve bytes, interpret HTTP, or grant a
 * capability.  Carriers (Node, a static host, or a reverse proxy) consume the
 * validated inventory in their own platform layer.
 */

export const PRONAOS_ROUTE_KINDS = [
  "web-artifact",
  "genesis-seed",
  "genesis-member",
  "public-projection",
  "live-transport",
] as const;

export type PronaosRouteKind = (typeof PRONAOS_ROUTE_KINDS)[number];

/** Cache behavior belongs to delivery, never to authority or causal order. */
export type PronaosCacheClass = "immutable" | "revalidate" | "no-store";

/**
 * Refusal causes that a carrier may expose for an already-known route.
 * Undeclared/private/traversal routes share the uniform class in the policy
 * below so the boundary does not become an existence oracle.
 */
export type PronaosRefusalClass = "integrity" | "unavailable" | "uniform";

export interface PronaosRefusalPolicy {
  readonly undeclared: "uniform";
  readonly private: "uniform";
  readonly traversal: "uniform";
  readonly integrity: "integrity";
  readonly unavailable: "unavailable";
}

export const DEFAULT_PRONAOS_REFUSALS: PronaosRefusalPolicy = {
  undeclared: "uniform",
  private: "uniform",
  traversal: "uniform",
  integrity: "integrity",
  unavailable: "unavailable",
};

interface PronaosRouteBase {
  /** Canonical absolute path, without query or fragment. */
  readonly path: string;
  readonly cache: PronaosCacheClass;
  /** Refusal for a known route after its declared target cannot be delivered. */
  readonly refusal: PronaosRefusalClass;
}

export interface PronaosWebArtifactRoute extends PronaosRouteBase {
  readonly kind: "web-artifact";
  /** Opaque content identifier; the carrier preserves it byte-for-byte. */
  readonly artifactCid: string;
  /** Exact integrity identifier for the artifact bytes. */
  readonly integrity: string;
}

export interface PronaosGenesisSeedRoute extends PronaosRouteBase {
  readonly kind: "genesis-seed";
  readonly seedCid: string;
  readonly integrity: string;
}

export interface PronaosGenesisMemberRoute extends PronaosRouteBase {
  readonly kind: "genesis-member";
  /** The member CID also names the required path segment. */
  readonly cid: string;
}

export interface PronaosPublicProjectionRoute extends PronaosRouteBase {
  readonly kind: "public-projection";
  /** Stable operator-selected projection name, not a filesystem path or CID query. */
  readonly projection: string;
}

export interface PronaosLiveTransportRoute extends PronaosRouteBase {
  readonly kind: "live-transport";
  /** Carrier-local upstream reference; mesh does not interpret its syntax. */
  readonly target: string;
}

export type PronaosRoute =
  | PronaosWebArtifactRoute
  | PronaosGenesisSeedRoute
  | PronaosGenesisMemberRoute
  | PronaosPublicProjectionRoute
  | PronaosLiveTransportRoute;

export interface PronaosRouteInventory {
  readonly routes: readonly PronaosRoute[];
  readonly refusals: PronaosRefusalPolicy;
}

export interface ValidatePronaosRouteInventoryOptions {
  /** Startup requires `/` and `/genesis/seed.json` by default. */
  readonly requireStartup?: boolean;
}

const CID_SEGMENT = /^[^/\\?#%\s]+$/;
const OPAQUE_VALUE = /^\S+$/;

function fail(message: string): never {
  throw new TypeError(`[pronaos] ${message}`);
}

function exactOpaque(value: unknown, label: string): asserts value is string {
  if (typeof value !== "string" || value.length === 0 || value.trim() !== value || !OPAQUE_VALUE.test(value)) {
    fail(`${label} must be a non-empty exact identifier`);
  }
}

function exactCidSegment(value: unknown, label: string): asserts value is string {
  exactOpaque(value, label);
  if (!CID_SEGMENT.test(value)) fail(`${label} must be one canonical path segment`);
}

function validatePath(path: unknown): asserts path is string {
  if (typeof path !== "string" || path.length === 0 || path[0] !== "/") {
    fail("route path must be an absolute path");
  }
  if (path === "/") return;
  if (path.trim() !== path || path.includes("\\") || path.includes("?") || path.includes("#") || path.includes("%")) {
    fail(`route path is not canonical: ${path}`);
  }
  if (path.endsWith("/") || path.includes("//") || path.includes("*") || path.includes("{") || path.includes("}")) {
    fail(`route path is not a finite file/endpoint path: ${path}`);
  }
  const segments = path.slice(1).split("/");
  if (segments.some((segment) => segment === "." || segment === ".." || segment.length === 0 || segment.startsWith(":"))) {
    fail(`route path contains traversal or a dynamic segment: ${path}`);
  }
}

function validateBase(route: PronaosRoute): void {
  validatePath(route.path);
  if (!["immutable", "revalidate", "no-store"].includes(route.cache)) {
    fail(`route ${route.path} has an unknown cache class`);
  }
  if (!["integrity", "unavailable", "uniform"].includes(route.refusal)) {
    fail(`route ${route.path} has an unknown refusal class`);
  }
}

function validateRoute(route: PronaosRoute): void {
  if (!route || typeof route !== "object" || !PRONAOS_ROUTE_KINDS.includes(route.kind)) {
    fail("route has an unknown kind");
  }
  validateBase(route);
  switch (route.kind) {
    case "web-artifact":
      if (route.refusal !== "integrity") fail(`Web artifact ${route.path} must be integrity-refusing`);
      exactCidSegment(route.artifactCid, `artifactCid for ${route.path}`);
      exactOpaque(route.integrity, `integrity for ${route.path}`);
      return;
    case "genesis-seed":
      if (route.path !== "/genesis/seed.json") fail("genesis seed must use /genesis/seed.json");
      if (route.refusal !== "integrity") fail("genesis seed must be integrity-refusing");
      exactCidSegment(route.seedCid, "seedCid");
      exactOpaque(route.integrity, "genesis seed integrity");
      return;
    case "genesis-member":
      if (route.refusal !== "integrity") fail(`genesis member ${route.path} must be integrity-refusing`);
      exactCidSegment(route.cid, `cid for ${route.path}`);
      if (route.path !== `/genesis/cas/${route.cid}`) {
        fail(`genesis member path must name its CID exactly: ${route.path}`);
      }
      return;
    case "public-projection":
      if (route.refusal === "uniform") fail(`public projection ${route.path} needs a delivery refusal class`);
      exactOpaque(route.projection, `projection for ${route.path}`);
      return;
    case "live-transport":
      if (route.cache !== "no-store" || route.refusal !== "unavailable") {
        fail(`live transport ${route.path} must be no-store and unavailable-refusing`);
      }
      exactOpaque(route.target, `transport target for ${route.path}`);
      return;
  }
}

function validateRefusals(refusals: PronaosRefusalPolicy): void {
  if (!refusals || refusals.undeclared !== "uniform" || refusals.private !== "uniform" ||
      refusals.traversal !== "uniform" || refusals.integrity !== "integrity" ||
      refusals.unavailable !== "unavailable") {
    fail("refusal policy must keep undeclared, private, and traversal uniform");
  }
}

/** Validate a finite, carrier-neutral Pronaos route inventory. */
export function validatePronaosRouteInventory(
  inventory: PronaosRouteInventory,
  options: ValidatePronaosRouteInventoryOptions = {},
): void {
  if (!inventory || !Array.isArray(inventory.routes)) fail("routes must be a finite array");
  validateRefusals(inventory.refusals);
  const paths = new Set<string>();
  for (const route of inventory.routes) {
    validateRoute(route);
    if (paths.has(route.path)) fail(`conflicting route ownership at ${route.path}`);
    paths.add(route.path);
  }
  if (options.requireStartup !== false) {
    const root = inventory.routes.find((route) => route.path === "/");
    if (!root || root.kind !== "web-artifact") fail("startup requires a web artifact at /");
    const seed = inventory.routes.find((route) => route.path === "/genesis/seed.json");
    if (!seed || seed.kind !== "genesis-seed") fail("startup requires /genesis/seed.json");
  }
}

/** Boolean boundary for callers inspecting untrusted inventory data. */
export function isPronaosRouteInventory(value: unknown): value is PronaosRouteInventory {
  try {
    validatePronaosRouteInventory(value as PronaosRouteInventory);
    return true;
  } catch {
    return false;
  }
}
