/**
 * secrets-registry — which documents hold SECRETS whose whole value rests on staying unpublished, read off a durable
 * record in the face's own sealed catalog (reach-plane#/the-vault-reads-as-a-bag).
 *
 * A reach credential stops meaning anything the moment it goes world-readable, so its plane floors at CONTRACT and the
 * keystone meets every declaration back down to it. The floor reads that property off this registry, FIRST
 * (`structuralFloorFor`). A registry held in memory alone forgot every plane at a restart, and a forgotten plane on the
 * public shelf floored PUBLIC; so the registry rests as rows in the per-face catalog D, which rests sealed under the
 * face's content key and hydrates only through the holder (sealed-store#/owed).
 *
 * THE ROWS. One init row (`SECRETS_REGISTRY_ROW`, `kind: secrets-registry`, `version: 1`) and one row per plane
 * (`secretsPlaneRow(id)`, `kind: secrets-plane`, `document-id: <id>`). The act that stands a secrets store writes its
 * row through `register`; the store itself never does, and no doc labels itself.
 *
 * FAIL CLOSED, BY NAME. Until the registry reads, every reading THROWS `SecretsRegistryRefusal` rather than answering
 * false: `secrets-registry-unread` before D binds (the restart window), `secrets-registry-unreadable` once D's open
 * failed, `secrets-registry-uninitialized` before the init row lands, `secrets-registry-malformed` for a torn record.
 * Initialized-empty reads as its own act (`initialize`), so a missing record never reads as an empty set.
 *
 * DURABLE BEFORE IT ANSWERS. `initialize` and `register` write only while D maps sealed (`secrets-registry-unsealed`
 * otherwise: a face with no Nexus chain maps nothing sealed, and an expected face holds its rows in memory alone), and
 * answer only once the Repo flushed D to rest. The store stands, and serves a byte, only after that answer.
 *
 * Meme: lar:///ha.ka.ba/lararium/mesh/reach-plane#/the-vault-reads-as-a-bag
 */
import type { DocHandle } from "@automerge/automerge-repo";
import type { LarDoc } from "./base-doc.js";
import { FACE_CATALOG_BAG_ID } from "./register-bags.js";
import { storedLarRecord } from "./stored-record.js";
import { plainField, type StoredLarRecord } from "./stored-value.js";

/** The floor's reading: does this doc hold contract-floored secrets? Throws while it cannot answer. */
export interface ContractSecretsPlane {
  isContractSecretsPlane(documentId: string): boolean;
}

/**
 * No plane holds secrets. Pass it only where absence stands ESTABLISHED (cap-tier#/the-keystone): a composition that
 * can hold no face's sealed bag. Anywhere a face could stand a store, the face's registry answers instead.
 */
export const NO_CONTRACT_SECRETS_PLANE: ContractSecretsPlane = {
  isContractSecretsPlane(_documentId: string): boolean { return false; },
};

/** The init row: the registry stands initialized under this face. */
export const SECRETS_REGISTRY_ROW = `${FACE_CATALOG_BAG_ID}/secrets`;
export const SECRETS_REGISTRY_KIND = "secrets-registry";
export const SECRETS_PLANE_KIND = "secrets-plane";
export const SECRETS_REGISTRY_VERSION = "1";
const AUTHORITY = "secrets-registry";

/** The row that records one document as a secrets plane. */
export function secretsPlaneRow(documentId: string): string {
  return `${SECRETS_REGISTRY_ROW}/${documentId}`;
}

export type SecretsRegistryReason =
  | "secrets-registry-unread"
  | "secrets-registry-unreadable"
  | "secrets-registry-uninitialized"
  | "secrets-registry-malformed"
  | "secrets-registry-unsealed";

/** The registry cannot answer, or cannot take a row: every reading refuses by this name. */
export class SecretsRegistryRefusal extends Error {
  override readonly name = "SecretsRegistryRefusal";
  constructor(readonly reason: SecretsRegistryReason, detail: string) { super(`${reason}: ${detail}`); }
}

/** What the registry reads its face's catalog through. The composition that binds D supplies each cell. */
export interface FaceSecretsCatalog {
  /** The face's catalog once bound; null while the face stands expected or no face stands. */
  face(): DocHandle<LarDoc> | null;
  /** True while D maps sealed now (the face's Nexus chain stands, the sealed rest names D). */
  sealed(): boolean;
  /** Why D's open failed, or null. A failure outranks any handle a stale bind still holds. */
  failure(): string | null;
  /** Flush D's document to rest; resolves once its bytes rest. */
  flush(documentId: string): Promise<void>;
}

export type SecretsRegistryReading =
  | { readonly state: "ready"; readonly planes: readonly string[] }
  | { readonly state: "refused"; readonly reason: SecretsRegistryReason };

export interface SecretsRegistry {
  /** The reading a floor holds: live over D's current rows; throws `SecretsRegistryRefusal` until the registry reads. */
  readonly plane: ContractSecretsPlane;
  /** The registry's state, without throwing (status, audit, a composer's readiness check). */
  reading(): SecretsRegistryReading;
  /** Write the init row on a D that holds no registry row at all; `held` where it already stands. */
  initialize(): Promise<"initialized" | "held">;
  /** Record `documentId` as a secrets plane, sealed and at rest before this answers. The store-standing act alone calls it. */
  register(documentId: string): Promise<void>;
}

type Parsed = { readonly ok: true; readonly planes: ReadonlySet<string> } | { readonly ok: false; readonly reason: SecretsRegistryReason; readonly detail: string };

function parse(doc: LarDoc | undefined): Parsed {
  if (!doc) return { ok: false, reason: "secrets-registry-unread", detail: "the face's catalog holds no document yet" };
  const prefix = `${SECRETS_REGISTRY_ROW}/`;
  const planes = new Set<string>();
  let init: StoredLarRecord | undefined;
  for (const [title, record] of Object.entries(doc.tiddlers ?? {})) {
    if (title === SECRETS_REGISTRY_ROW) { init = record; continue; }
    if (!title.startsWith(prefix)) continue;
    const id = title.slice(prefix.length);
    if (plainField(record, "kind") !== SECRETS_PLANE_KIND || plainField(record, "document-id") !== id || id.length === 0) {
      return { ok: false, reason: "secrets-registry-malformed", detail: `the plane row ${title} names another document or kind` };
    }
    planes.add(id);
  }
  if (init === undefined) {
    return planes.size > 0
      ? { ok: false, reason: "secrets-registry-malformed", detail: `${planes.size} plane row(s) stand with no init row` }
      : { ok: false, reason: "secrets-registry-uninitialized", detail: "the face's catalog holds no registry yet" };
  }
  if (plainField(init, "kind") !== SECRETS_REGISTRY_KIND || plainField(init, "version") !== SECRETS_REGISTRY_VERSION) {
    return { ok: false, reason: "secrets-registry-malformed", detail: `the init row reads another kind or version (${String(plainField(init, "version"))})` };
  }
  return { ok: true, planes };
}

/** Stand the face's secrets registry over its catalog's cells. It holds no set of its own: every reading reads D. */
export function makeFaceSecretsRegistry(catalog: FaceSecretsCatalog): SecretsRegistry {
  // One parse per document state: an Automerge doc stands immutable until its next change, so the object names the state.
  let cachedDoc: LarDoc | undefined;
  let cached: Parsed | null = null;
  const read = (): { handle: DocHandle<LarDoc> | null; parsed: Parsed } => {
    const failure = catalog.failure();
    if (failure !== null) return { handle: null, parsed: { ok: false, reason: "secrets-registry-unreadable", detail: failure } };
    const handle = catalog.face();
    if (handle === null) return { handle: null, parsed: { ok: false, reason: "secrets-registry-unread", detail: "the face's catalog has not bound" } };
    const doc = handle.doc();
    if (cached === null || doc !== cachedDoc) { cachedDoc = doc; cached = parse(doc); }
    return { handle, parsed: cached };
  };
  const refuse = (parsed: Extract<Parsed, { ok: false }>): never => { throw new SecretsRegistryRefusal(parsed.reason, parsed.detail); };
  const writable = (): DocHandle<LarDoc> => {
    const { handle, parsed } = read();
    if (handle === null) return refuse(parsed as Extract<Parsed, { ok: false }>);
    if (!catalog.sealed()) throw new SecretsRegistryRefusal("secrets-registry-unsealed", "the face's catalog does not map sealed now, so no row may rest");
    return handle;
  };

  return {
    plane: {
      isContractSecretsPlane(documentId: string): boolean {
        const { parsed } = read();
        if (!parsed.ok) return refuse(parsed);
        return parsed.planes.has(documentId);
      },
    },
    reading(): SecretsRegistryReading {
      const { parsed } = read();
      return parsed.ok ? { state: "ready", planes: [...parsed.planes].sort() } : { state: "refused", reason: parsed.reason };
    },
    async initialize(): Promise<"initialized" | "held"> {
      const handle = writable();
      const parsed = read().parsed;
      if (parsed.ok) return "held";
      if (parsed.reason !== "secrets-registry-uninitialized") return refuse(parsed);
      handle.change((d) => {
        d.tiddlers[SECRETS_REGISTRY_ROW] = storedLarRecord(SECRETS_REGISTRY_ROW, { kind: SECRETS_REGISTRY_KIND, version: SECRETS_REGISTRY_VERSION }, AUTHORITY);
      });
      await catalog.flush(handle.documentId);
      return "initialized";
    },
    async register(documentId: string): Promise<void> {
      if (typeof documentId !== "string" || documentId.length === 0 || documentId.includes("/")) {
        throw new SecretsRegistryRefusal("secrets-registry-malformed", "a secrets plane names one document id");
      }
      const handle = writable();
      const parsed = read().parsed;
      if (!parsed.ok) return refuse(parsed);
      if (!parsed.planes.has(documentId)) {
        const title = secretsPlaneRow(documentId);
        handle.change((d) => {
          d.tiddlers[title] = storedLarRecord(title, { kind: SECRETS_PLANE_KIND, "document-id": documentId }, AUTHORITY);
        });
      }
      await catalog.flush(handle.documentId);
    },
  };
}

/**
 * faceScopedSecrets — the registry gates only its OWN face's documents (operator clarification 2026-11-06). A doc
 * the face does not own (the public shelf, genesis) answers false without asking the registry, so a locked or unread
 * registry never withholds them; a doc the face owns asks the registry and refuses while it cannot read. An `owns`
 * that cannot answer throws, and the crossing refuses.
 */
export function faceScopedSecrets(plane: ContractSecretsPlane, owns: (documentId: string) => boolean): ContractSecretsPlane {
  return {
    isContractSecretsPlane(documentId: string): boolean {
      return owns(documentId) ? plane.isContractSecretsPlane(documentId) : false;
    },
  };
}

/** The verbs that stand or onboard a secrets store. The store's one door stands on the node vessel (reach-plane#/cred-onboarding). */
const SECRETS_DOOR_PATTERNS: readonly RegExp[] = [
  /\bexport\b[^\n;=(]*?\b\w*(?:onboard|reach-?vault|vault-?stand|stand-?vault|secrets-?store|paste-?token|reach-?cred)\w*/gi,
  /["'`][^"'`\n]*(?:onboard|reach-?vault|vault-?stand|stand-?vault|secrets-?store|paste-?token|reach-?cred)[^"'`\n]*["'`]/gi,
  /\b\w*secrets\w*\s*\.\s*(?:register|initialize)\s*\(/gi,
];

/**
 * secretsDoorsIn — every onboarding or vault-stand door a module's source text holds: an exported verb, a routed verb
 * string, a secrets registry `register` / `initialize` call. The static witness reads the browser through it.
 */
export function secretsDoorsIn(source: string): string[] {
  return SECRETS_DOOR_PATTERNS.flatMap((pattern) => [...source.matchAll(pattern)].map((m) => m[0]));
}
