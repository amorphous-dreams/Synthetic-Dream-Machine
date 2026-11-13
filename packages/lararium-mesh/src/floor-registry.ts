/**
 * floor-registry — THE FLOOR'S REGISTRY as the daemon island reads and writes it: the rows of the place's daemon document
 * that name the floor's own documents (`device-daemon-docs` `FLOOR_REGISTRY_ROOT`).
 *
 * THE GATE NAMES THE FLOOR KEY (the-veil-ladder#/the-base-model, in-house ruling 7). A floor row names a document that seals
 * under the floor's rest key (`held-rest-key` `floorRestKey`), so every read and write here passes only where that key
 * stands on the vessel. A locked hearth holds the key shut (`vessel-locked`); a herm never unlocks, so it derives none and
 * registers none (`floor-unkeyed`). Either refuses by name before any row moves: a floor that cannot seal writes nothing.
 *
 * NO CONTROL DOCUMENT STANDS HERE. A place holds no control document until a face lands (operator ruling 2026-11-09). The
 * rows rest in the daemon document, which the place founds with itself, rests clear and mirrors nowhere; each names a
 * document id and nothing of its content.
 *
 * Meme: lar:///ha.ka.ba/lararium/mesh/control-home
 */
import { DAEMON_BAG_ID } from "./lar-uris.js";
import { mutableLarRecord, tiddlerText } from "./base-doc.js";
import { FLOOR_REGISTRY_ROOT } from "./device-daemon-docs.js";
import type { CompositeStore } from "./composite-store.js";
import type { ChangeOrigin, LarTiddlerRecord } from "./tiddler-store.js";

/** The refusal of a floor whose rest key does not stand: the key stays shut, or the place derives none at all. */
export const FLOOR_UNKEYED = "floor-unkeyed";
export type FloorKeyRefusal = "vessel-locked" | typeof FLOOR_UNKEYED;

const WHY: Record<FloorKeyRefusal, string> = {
  "vessel-locked": "the vessel's key stays shut, so the floor's rest key derives from nothing until `lares vault unlock` opens it",
  [FLOOR_UNKEYED]: "this place derives no floor key (a herm never unlocks), so it stands no floor document and registers none",
};

/** The name a floor act refuses under, ahead of the floor's own refusal (`floor-unavailable: <refusal>: <why>`). */
export const FLOOR_UNAVAILABLE = "floor-unavailable";

/** A floor act refused because the floor's rest key does not stand. */
export class FloorUnavailable extends Error {
  override readonly name = "FloorUnavailable";
  constructor(readonly refusal: FloorKeyRefusal) { super(`${FLOOR_UNAVAILABLE}: ${refusal}: ${WHY[refusal]}`); }
}

/** The floor's refusal a message carries across a worker boundary (where the error arrives as its message alone), or null. */
export function floorRefusalOf(message: string): FloorKeyRefusal | null {
  const named = /^floor-unavailable: (vessel-locked|floor-unkeyed):/.exec(message);
  return named ? named[1] as FloorKeyRefusal : null;
}

export interface FloorRegistry {
  /** The refusal this floor answers now, or null where its rest key stands. */
  refusal(): FloorKeyRefusal | null;
  /** The document url a floor row names, or null where it names none. Refuses by name where the floor key does not stand. */
  get(title: string): Promise<string | null>;
  /** Name a floor document (its url) under `title`. Refuses by name where the floor key does not stand. */
  put(title: string, fields: Readonly<Record<string, string>> & { readonly text: string }, tag: string): Promise<void>;
  /** A floor row leaves the registry. */
  remove(title: string, tag: string): Promise<void>;
  /** Every live floor row. */
  entries(): Promise<readonly { readonly title: string; readonly record: LarTiddlerRecord }[]>;
}

const originFor = (tag: string): ChangeOrigin => ({ kind: "lares-verb", requestId: tag.slice(0, 32) });

/**
 * The floor's registry over the daemon island's composite (`daemonStore`, whose daemon bag layer rests in the place's
 * daemon document). `refusal` reads the vessel's answer for this composition: null where the floor's rest key stands.
 * Absent, the registry fails closed as a floor that derives no key.
 */
export function floorRegistryOf(daemonStore: CompositeStore, refusal: (() => FloorKeyRefusal | null) | undefined): FloorRegistry {
  const read = (): FloorKeyRefusal | null => refusal ? refusal() : FLOOR_UNKEYED;
  const open = (): void => { const refused = read(); if (refused !== null) throw new FloorUnavailable(refused); };
  const rowOf = (title: string): string => {
    if (!title.startsWith(FLOOR_REGISTRY_ROOT)) throw new TypeError(`floor-registry: ${JSON.stringify(title)} names no floor row`);
    return title;
  };
  return {
    refusal: read,
    get: async (title) => { open(); return tiddlerText(await daemonStore.get(rowOf(title))); },
    put: async (title, fields, tag) => {
      open();
      await daemonStore.put(mutableLarRecord(rowOf(title), { ...fields, kind: "oracle", "face-reach": "vessel-only" }, tag), originFor(tag), { bag: DAEMON_BAG_ID });
    },
    remove: async (title, tag) => { open(); await daemonStore.removeInBag(DAEMON_BAG_ID, rowOf(title), originFor(tag)); },
    entries: async () => {
      open();
      return (await daemonStore.entries()).filter((e) => e.title.startsWith(FLOOR_REGISTRY_ROOT) && e.bagId === DAEMON_BAG_ID).map((e) => ({ title: e.title, record: e.record }));
    },
  };
}
