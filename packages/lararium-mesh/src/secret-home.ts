/**
 * secret-home — the vessel's SECRET document: where group-secret seals, dyads and Keyhive cap event bytes rest.
 *
 * PLACEMENT, NEVER PATTERN (operator ruling 2026-11-09). These records reach no plaintext disk because of where they
 * rest: one vessel-held document that no page recipe mounts, no disk mirror projects, no peer replicates, and whose rest
 * seals every value under the vessel's held key (`held-rest-key`).
 *
 * ENROLLED BEFORE ITS FIRST WRITE. The store's one holder (the direct holder of a founding, or the standing vessel) binds
 * its rest to its Repo (`bindSecretHomeRest`). Enrollment maps the document's id onto that rest under its held key FIRST,
 * and only then does the document's first byte move; the address (id and key) persists in the vessel's custody after the
 * document rests, so a pointer never names a document no rest holds. Opening a standing home maps it the same way before
 * the Repo reads a byte of it.
 *
 * NO FALLBACK. A Repo whose holder bound no rest, a home whose rest does not answer sealed, or a home that will not open
 * refuses `secret-home-unavailable` by name. Nothing here ever writes the document through an unsealed rest.
 *
 * Canon: lar:///ha.ka.ba/lararium/mesh/sealed-store#/owed
 */
import * as A from "@automerge/automerge";
import { generateAutomergeUrl, parseAutomergeUrl, type AutomergeUrl, type DocHandle, type DocumentId, type Repo } from "@automerge/automerge-repo";
import { sha256 } from "@noble/hashes/sha2.js";
import { hex, hexToBytes, utf8Bytes, type RandomProvider } from "./crypto.js";
import { emptyLarDoc, type LarDoc } from "./base-doc.js";
import { mintHeldRestKey, readHeldRestKey, type HeldRestKey } from "./held-rest-key.js";
import { AutomergeDocStore } from "./automerge-doc-store.js";
import { SECRET_HOME_ID } from "./lar-uris.js";
import type { LarTiddlerStore } from "./tiddler-store.js";

/** The rest a store's one holder binds to its Repo: it maps the secret home sealed under its held key, and answers whether
 *  it holds a document sealed. */
export interface SecretHomeRest {
  /** Map `documentId` as the vessel's secret home, resting sealed under `key`, before any byte of it moves. */
  enroll(documentId: string, key: HeldRestKey): void;
  /** Does this rest hold `documentId` sealed? Only the rest itself answers; no caller asserts it. */
  restsSealed(documentId: string): Promise<boolean>;
}

/** The capability a Keyhive writer asks before every secret write: true only once the rest confirms sealed rest. */
export interface SecretRestAnswer {
  assertSealed(): Promise<boolean>;
}

/** The secret home's address: its document and the key its rest seals it under. It rests in the vessel's custody alone. */
export interface SecretHomeAddress {
  readonly documentId: string;
  readonly key: HeldRestKey;
}

/** A standing secret home: its handle, and the rest's sealed-rest answer for it. */
export interface SecretHome {
  readonly url: AutomergeUrl;
  readonly handle: DocHandle<LarDoc>;
  readonly rest: SecretRestAnswer;
}

export class SecretHomeUnavailable extends Error {
  override readonly name = "SecretHomeUnavailable";
  constructor(why: string) { super(`secret-home-unavailable: ${why}`); }
}

const rests = new WeakMap<object, SecretHomeRest>();

/** The store's one holder binds its rest to its Repo. One rest per Repo: a second bind refuses. */
export function bindSecretHomeRest(repo: Repo, rest: SecretHomeRest): void {
  if (rests.has(repo)) throw new Error("secret-home: this Repo's holder already bound its rest");
  rests.set(repo, rest);
}

/** The rest bound to `repo`, or null: that Repo holds no secret home. */
export function secretHomeRestOf(repo: Repo): SecretHomeRest | null {
  return rests.get(repo) ?? null;
}

/** Mint a fresh address: a new document id and a fresh held key. */
export function mintSecretHomeAddress(random?: Pick<RandomProvider, "getRandomValues">): SecretHomeAddress {
  return { documentId: parseAutomergeUrl(generateAutomergeUrl()).documentId, key: mintHeldRestKey(random) };
}

const ADDRESS_MAGIC = "lares-secret-home/v1";

/** The address as its custody row keeps it. */
export function encodeSecretHomeAddress(address: SecretHomeAddress): Uint8Array {
  return utf8Bytes(JSON.stringify({ kind: ADDRESS_MAGIC, documentId: address.documentId, key: hex(address.key) }));
}

/** Read an address off its custody row's bytes; null: the bytes name no address of this kind. */
export function decodeSecretHomeAddress(bytes: Uint8Array): SecretHomeAddress | null {
  try {
    const v = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)) as Record<string, unknown>;
    if (v["kind"] !== ADDRESS_MAGIC || typeof v["documentId"] !== "string" || typeof v["key"] !== "string" || !/^[0-9a-f]{64}$/.test(v["key"])) return null;
    const key = readHeldRestKey(hexToBytes(v["key"] as string));
    if (key === null) return null;
    parseAutomergeUrl(`automerge:${v["documentId"]}` as AutomergeUrl);
    return { documentId: v["documentId"] as string, key };
  } catch { return null; }
}

/** The seed every secret home's history begins with: one deterministic change, so a seed imported twice merges as one. */
function seedBytes(documentId: string): Uint8Array {
  const actor = hex(sha256(utf8Bytes(`lares-secret-home-seed\u0000${documentId}`))).slice(0, 32);
  return A.save(A.change(A.init<LarDoc>({ actor }), { time: 0, message: "secret-home" }, (d) => { Object.assign(d, emptyLarDoc()); }));
}

function restAnswer(rest: SecretHomeRest, documentId: string): SecretRestAnswer {
  return { assertSealed: () => rest.restsSealed(documentId) };
}

function requireRest(repo: Repo): SecretHomeRest {
  const rest = secretHomeRestOf(repo);
  if (rest === null) throw new SecretHomeUnavailable("this Repo's holder bound no sealed rest for the secret home");
  return rest;
}

/**
 * ENROLL a fresh secret home: map its id onto the rest under its held key, confirm the rest answers sealed, and only then
 * write its seed. The caller persists the address (`encodeSecretHomeAddress`) after the Repo flushes the document.
 */
export async function enrollSecretHome(repo: Repo, address: SecretHomeAddress): Promise<SecretHome> {
  const rest = requireRest(repo);
  rest.enroll(address.documentId, address.key);
  if (!await rest.restsSealed(address.documentId)) throw new SecretHomeUnavailable("the rest does not hold the enrolled document sealed");
  const handle = repo.import<LarDoc>(seedBytes(address.documentId), { docId: address.documentId as DocumentId });
  return { url: handle.url, handle, rest: restAnswer(rest, address.documentId) };
}

/** OPEN a standing secret home: map it under its held key before the Repo reads a byte, then find it. A home the rest
 *  cannot open refuses by name; nothing writes a fresh one in its place. */
export async function openSecretHome(repo: Repo, address: SecretHomeAddress): Promise<SecretHome> {
  const rest = requireRest(repo);
  rest.enroll(address.documentId, address.key);
  if (!await rest.restsSealed(address.documentId)) throw new SecretHomeUnavailable("the rest does not hold the secret home sealed");
  let handle: DocHandle<LarDoc>;
  try { handle = await repo.find<LarDoc>(`automerge:${address.documentId}` as AutomergeUrl); }
  catch (e) { throw new SecretHomeUnavailable(`the secret home did not open: ${e instanceof Error ? e.message : String(e)}`); }
  return { url: handle.url, handle, rest: restAnswer(rest, address.documentId) };
}

/** What a Keyhive event store reads and writes of the secret home: three verbs of a tiddler store, nothing composed. */
export type SecretHomeStore = Pick<LarTiddlerStore, "get" | "put" | "listVisible">;

/**
 * THE DAEMON ISLAND'S DOOR TO THE SECRET HOME. The island holds its own Repo, which reaches the home by sync from the
 * vessel's (the vessel's share verdict passes it to the house's own islands alone) and rests no byte of it (the island's
 * rest guard asks the vessel, which holds it sealed). The store resolves the home at its first use, so an island never
 * waits on it to stand; `rest` asks the vessel's rest itself (`restsAtVessel`) before every write and read the Keyhive
 * event store makes. No recipe, composite or mirror ever names this store.
 */
export function islandSecretHome(repo: Repo, secretUrl: string, restsAtVessel: (documentId: string) => Promise<boolean>): { readonly store: SecretHomeStore; readonly rest: SecretRestAnswer } {
  const documentId = parseAutomergeUrl(secretUrl as AutomergeUrl).documentId;
  let opened: Promise<AutomergeDocStore> | null = null;
  const home = (): Promise<AutomergeDocStore> => (opened ??= repo.find<LarDoc>(secretUrl as AutomergeUrl)
    .then((handle) => new AutomergeDocStore(handle, SECRET_HOME_ID))
    .catch((e: unknown) => { opened = null; throw new SecretHomeUnavailable(`the island could not reach the secret home: ${e instanceof Error ? e.message : String(e)}`); }));
  return {
    store: {
      get: async (title) => (await home()).get(title),
      put: async (record, origin, options) => (await home()).put(record, origin, options),
      listVisible: async () => (await home()).listVisible(),
    },
    rest: { assertSealed: () => restsAtVessel(documentId) },
  };
}
