/**
 * secrets-registry — the secrets registry rests in the face's own sealed catalog (reach-plane#/the-vault-reads-as-a-bag).
 *
 *   S1 — before the face's catalog binds (the restart window), every reading and every registration refuses
 *        `secrets-registry-unread`, never reading a doc as no secret
 *   S2 — a bound, blank catalog refuses `secrets-registry-uninitialized` until its init act lands; initialized-empty then
 *        reads empty
 *   S3 — a catalog that does not map sealed takes no row: init and register refuse `secrets-registry-unsealed` and write
 *        nothing
 *   S4 — a registration survives a restart: a fresh Repo over the same rest reads the doc back as a secrets plane once the
 *        catalog binds, and a floor that also reads it public floors it CONTRACT; before the bind, the floor refuses
 *   S5 — a catalog whose open failed refuses `secrets-registry-unreadable`, whatever rows a stale handle still holds
 *   S6 — a torn registry refuses `secrets-registry-malformed`: plane rows with no init row (and init then writes nothing),
 *        an init row of another version, a plane row whose title and field disagree
 *   S7 — a registration answers only once its row rests: the flush runs over the face's catalog before the answer
 *   CONTROL — a held reading stays live (a later registration reads at once); init twice holds one row; a doc never
 *        registered keeps the floor its other readings give it
 */
import { describe, expect, test } from "vitest";
import { Repo, type Chunk, type DocHandle, type StorageAdapterInterface, type StorageKey } from "@automerge/automerge-repo";
import type { LarDoc } from "../src/base-doc.js";
import { storedLarRecord } from "../src/stored-record.js";
import { faceCatalogDocUrl, openFaceCatalog } from "../src/catalog-view.js";
import { makeTierFloorSource, structuralFloorFor } from "../src/cap-tier.js";
import {
  makeFaceSecretsRegistry, SecretsRegistryRefusal, SECRETS_REGISTRY_ROW, secretsPlaneRow, type FaceSecretsCatalog,
} from "../src/secrets-registry.js";

const SECRET = new Uint8Array(32).fill(0x5e);
const CREDS = "creds-doc";
const OTHER = "other-doc";

function memoryAdapter(): StorageAdapterInterface {
  const bytes = new Map<string, Uint8Array>();
  const name = (key: StorageKey): string => key.join("\u0000");
  const starts = (key: string, prefix: StorageKey): boolean => key.split("\u0000").slice(0, prefix.length).join("\u0000") === name(prefix);
  return {
    async load(key) { const got = bytes.get(name(key)); return got ? Uint8Array.from(got) : undefined; },
    async save(key, data) { bytes.set(name(key), Uint8Array.from(data)); },
    async remove(key) { bytes.delete(name(key)); },
    async loadRange(prefix): Promise<Chunk[]> { return [...bytes].filter(([k]) => starts(k, prefix)).map(([k, data]) => ({ key: k.split("\u0000"), data: Uint8Array.from(data) })); },
    async removeRange(prefix) { for (const k of [...bytes.keys()]) if (starts(k, prefix)) bytes.delete(k); },
  };
}

interface Cells { face: DocHandle<LarDoc> | null; sealed: boolean; failure: string | null; flushed: string[] }

function catalogOver(repo: Repo, cells: Cells): FaceSecretsCatalog {
  return {
    face: () => cells.face,
    sealed: () => cells.sealed,
    failure: () => cells.failure,
    flush: async (documentId) => { await repo.flush([documentId as never]); cells.flushed.push(documentId); },
  };
}

async function stand(storage: StorageAdapterInterface = memoryAdapter()) {
  const repo = new Repo({ storage, network: [] });
  const face = await openFaceCatalog(repo, faceCatalogDocUrl(SECRET), SECRET);
  const cells: Cells = { face: null, sealed: true, failure: null, flushed: [] };
  const registry = makeFaceSecretsRegistry(catalogOver(repo, cells));
  return { repo, face, cells, registry, storage };
}

const reasonOf = (act: () => unknown): string | null => {
  try { act(); return null; } catch (e) { return e instanceof SecretsRegistryRefusal ? e.reason : `foreign: ${String(e)}`; }
};
const asyncReasonOf = async (act: () => Promise<unknown>): Promise<string | null> => {
  try { await act(); return null; } catch (e) { return e instanceof SecretsRegistryRefusal ? e.reason : `foreign: ${String(e)}`; }
};
const rowTitles = (face: DocHandle<LarDoc>): string[] => Object.keys(face.doc()?.tiddlers ?? {}).filter((t) => t.startsWith(SECRETS_REGISTRY_ROW)).sort();

describe("the secrets registry rests in the face's own sealed catalog", () => {
  test("S1 — before the catalog binds, every reading and every registration refuses unread", async () => {
    const { registry } = await stand();
    expect(reasonOf(() => registry.plane.isContractSecretsPlane(CREDS))).toBe("secrets-registry-unread");
    expect(registry.reading()).toEqual({ state: "refused", reason: "secrets-registry-unread" });
    expect(await asyncReasonOf(() => registry.register(CREDS))).toBe("secrets-registry-unread");
    expect(await asyncReasonOf(() => registry.initialize())).toBe("secrets-registry-unread");
  });

  test("S2 — a blank catalog refuses uninitialized until its init act; initialized-empty then reads empty", async () => {
    const { registry, face, cells } = await stand();
    cells.face = face;
    expect(reasonOf(() => registry.plane.isContractSecretsPlane(CREDS))).toBe("secrets-registry-uninitialized");
    expect(await asyncReasonOf(() => registry.register(CREDS))).toBe("secrets-registry-uninitialized");
    expect(await registry.initialize()).toBe("initialized");
    expect(rowTitles(face)).toEqual([SECRETS_REGISTRY_ROW]);
    expect(registry.plane.isContractSecretsPlane(CREDS)).toBe(false);
    expect(registry.reading()).toEqual({ state: "ready", planes: [] });
  });

  test("S3 — a catalog that does not map sealed takes no row", async () => {
    const { registry, face, cells } = await stand();
    cells.face = face;
    cells.sealed = false;
    expect(await asyncReasonOf(() => registry.initialize())).toBe("secrets-registry-unsealed");
    expect(rowTitles(face)).toEqual([]);
    cells.sealed = true;
    await registry.initialize();
    cells.sealed = false;
    expect(await asyncReasonOf(() => registry.register(CREDS))).toBe("secrets-registry-unsealed");
    expect(rowTitles(face)).toEqual([SECRETS_REGISTRY_ROW]);
    expect(registry.plane.isContractSecretsPlane(CREDS)).toBe(false);
  });

  test("S4 — a registration survives a restart, and the floor refuses until the catalog binds again", async () => {
    const first = await stand();
    first.cells.face = first.face;
    await first.registry.initialize();
    await first.registry.register(CREDS);
    expect(first.registry.plane.isContractSecretsPlane(CREDS)).toBe(true);
    await first.repo.shutdown();

    const again = await stand(first.storage);
    const floor = makeTierFloorSource({ federatable: () => true, sealed: () => false, secrets: (d) => again.registry.plane.isContractSecretsPlane(d) });
    // The restart window: the catalog has not bound, so the floor answers nothing at all, never PUBLIC.
    expect(() => structuralFloorFor(floor, CREDS)).toThrow(/secrets-registry-unread/);
    again.cells.face = again.face;
    expect(again.registry.plane.isContractSecretsPlane(CREDS)).toBe(true);
    expect(structuralFloorFor(floor, CREDS)).toBe("contract");
    expect(structuralFloorFor(floor, OTHER)).toBe("public");
    expect(again.registry.reading()).toEqual({ state: "ready", planes: [CREDS] });
    await again.repo.shutdown();
  });

  test("S5 — a catalog whose open failed refuses unreadable, whatever a stale handle holds", async () => {
    const { registry, face, cells } = await stand();
    cells.face = face;
    await registry.initialize();
    await registry.register(CREDS);
    cells.failure = "sealed-open-refused: writer-face-foreign";
    expect(reasonOf(() => registry.plane.isContractSecretsPlane(CREDS))).toBe("secrets-registry-unreadable");
    expect(reasonOf(() => registry.plane.isContractSecretsPlane(OTHER))).toBe("secrets-registry-unreadable");
    expect(await asyncReasonOf(() => registry.register(OTHER))).toBe("secrets-registry-unreadable");
  });

  test("S6 — a torn registry refuses malformed and never reads as an empty set", async () => {
    const orphan = await stand();
    orphan.cells.face = orphan.face;
    orphan.face.change((d) => { d.tiddlers[secretsPlaneRow(CREDS)] = storedLarRecord(secretsPlaneRow(CREDS), { kind: "secrets-plane", "document-id": CREDS }, "test"); });
    expect(reasonOf(() => orphan.registry.plane.isContractSecretsPlane(OTHER))).toBe("secrets-registry-malformed");
    expect(await asyncReasonOf(() => orphan.registry.initialize())).toBe("secrets-registry-malformed");
    expect(rowTitles(orphan.face)).toEqual([secretsPlaneRow(CREDS)]);

    const versioned = await stand();
    versioned.cells.face = versioned.face;
    versioned.face.change((d) => { d.tiddlers[SECRETS_REGISTRY_ROW] = storedLarRecord(SECRETS_REGISTRY_ROW, { kind: "secrets-registry", version: "2" }, "test"); });
    expect(reasonOf(() => versioned.registry.plane.isContractSecretsPlane(OTHER))).toBe("secrets-registry-malformed");

    const swapped = await stand();
    swapped.cells.face = swapped.face;
    await swapped.registry.initialize();
    swapped.face.change((d) => { d.tiddlers[secretsPlaneRow(CREDS)] = storedLarRecord(secretsPlaneRow(CREDS), { kind: "secrets-plane", "document-id": OTHER }, "test"); });
    expect(reasonOf(() => swapped.registry.plane.isContractSecretsPlane(OTHER))).toBe("secrets-registry-malformed");
  });

  test("S7 — a registration answers only once its row rests", async () => {
    const { registry, face, cells } = await stand();
    cells.face = face;
    await registry.initialize();
    cells.flushed.length = 0;
    await registry.register(CREDS);
    expect(cells.flushed).toEqual([face.documentId]);
  });

  test("CONTROL — a held reading stays live, init holds one row, an unregistered doc keeps its other readings", async () => {
    const { registry, face, cells } = await stand();
    cells.face = face;
    const held = registry.plane;
    expect(await registry.initialize()).toBe("initialized");
    expect(await registry.initialize()).toBe("held");
    expect(held.isContractSecretsPlane(CREDS)).toBe(false);
    await registry.register(CREDS);
    await registry.register(CREDS);
    expect(held.isContractSecretsPlane(CREDS)).toBe(true);
    expect(held.isContractSecretsPlane(OTHER)).toBe(false);
    expect(rowTitles(face)).toEqual([SECRETS_REGISTRY_ROW, secretsPlaneRow(CREDS)].sort());
  });
});
