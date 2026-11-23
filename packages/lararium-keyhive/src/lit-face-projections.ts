/**
 * lit-face-projections — EVERY LIT FACE PROJECTS ITS OWN WRITES (course item sibling-writes-wait-unprojected).
 *
 * The daemon island projects the worn face's records through the projector its boot mounts. A sibling that stands lit beside it
 * writes into its OWN documents, through its own engine (`face-engine`); without a projector of its own those writes rested in
 * the vessel alone until the face was worn again. This seat keeps one projection per lit face, mounted by the shore (keyhive
 * stays fs-blind: the node entry mounts the projector over the face's engine, under the mirror grants the vessel named for that
 * face alone):
 *
 *   · a face lights carrying its own grants → its projection mounts over its own engine;
 *   · a face that carries no grant (no pet name, no folder), or whose engine composes none (a shut face) → nothing mounts;
 *   · a face drops → its projection stops, before its engine closes;
 *   · a light again over a face whose projection stands keeps the one that stands.
 *
 * A mount that faults never holds the face's light: the fault names itself and the face stands unprojected.
 *
 * Canon: lar:///ha.ka.ba/lararium/mesh/sealed-store#/the-lit-set
 */
import type { FaceEngine } from "@lararium/tw5";
import type { IslandMsg_Manifest } from "@lararium/mesh";

/** What a lit face's projection reads off its light: its handle index and the grants the vessel named for it. */
export interface LitFaceProjectionEntry {
  readonly handleIndex?: number;
  readonly diskMirrors?: IslandMsg_Manifest["diskMirrors"];
}

/** The shore's mount: one projector over the face's own engine, or undefined where none mounts. */
export type LitFaceProjectionMount = (
  face: LitFaceProjectionEntry & { readonly handleIndex: number },
  engine: Pick<FaceEngine, "tw5" | "composite">,
) => (() => Promise<void>) | undefined | Promise<(() => Promise<void>) | undefined>;

export interface LitFaceProjections {
  /** Mount the face's projection, keyed by its bare atom key; resolves once the mount stood or declined. */
  light(key: string, face: LitFaceProjectionEntry): Promise<void>;
  /** Stop the face's projection, if one stands. */
  drop(key: string): Promise<void>;
  /** The faces whose projection stands now, by bare atom key. */
  standing(): readonly string[];
}

export function litFaceProjections(ports: {
  readonly mount: LitFaceProjectionMount;
  /** The face's own engine (`face-engine`), or null where none composes. */
  readonly engine: (handleIndex: number) => Promise<Pick<FaceEngine, "tw5" | "composite"> | null>;
  readonly log?: (line: string) => void;
}): LitFaceProjections {
  const log = ports.log ?? (() => {});
  /** Each face's mount by its key: the token names this light's own mount, so a drop during it reads as a drop. */
  const held = new Map<string, { readonly mounting: Promise<(() => Promise<void>) | undefined> }>();
  return {
    light: async (key, face) => {
      const standing = held.get(key);
      if (standing !== undefined) { await standing.mounting; return; }
      const handleIndex = face.handleIndex;
      if (typeof handleIndex !== "number" || !face.diskMirrors?.length) return;
      const seat: { mounting: Promise<(() => Promise<void>) | undefined> } = { mounting: Promise.resolve(undefined) };
      held.set(key, seat);
      seat.mounting = (async () => {
        const engine = await ports.engine(handleIndex);
        if (engine === null) { log(`face h${handleIndex} composes no engine; it projects nothing`); return undefined; }
        // A drop that came while the engine composed leaves nothing to mount.
        if (held.get(key) !== seat) return undefined;
        return await ports.mount({ ...face, handleIndex }, engine);
      })().catch((error: unknown) => {
        log(`face h${handleIndex}'s projection did not mount: ${error instanceof Error ? error.message : String(error)}`);
        return undefined;
      });
      const stop = await seat.mounting;
      if (stop === undefined && held.get(key) === seat) held.delete(key);
      else if (stop !== undefined) log(`face h${handleIndex} projects its own writes under its own root`);
    },
    drop: async (key) => {
      const seat = held.get(key);
      if (seat === undefined) return;
      held.delete(key);
      const stop = await seat.mounting;
      await stop?.();
    },
    standing: () => [...held.keys()],
  };
}
