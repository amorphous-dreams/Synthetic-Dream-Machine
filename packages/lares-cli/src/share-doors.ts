/**
 * share-doors — the doors the share config's CLI side reaches (the file under `$LAR_ROOT/config`, the faces' pet-names off
 * custody, the standing vessel's verbs), apart from any command's flags, so the unlock door lands the shares as a face lights
 * (`landShares`) as the share door does.
 *
 * Meme: lar:///ha.ka.ba/lararium/mesh/sealed-store#/the-share-config
 */
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { larConfigHome } from "@lararium/node";
import { SHARE_CONFIG_FILE, type ShareFace } from "@lararium/mesh";
import { vesselDid } from "./env.js";
import { runVerb } from "./verb-call.js";
import { summaryOutput } from "./verb-result.js";
import { readPersonaRoots, sealedPetnameStore } from "./sealed-rows.js";
import { makeFleetPetnameStore } from "./daemon-persona-store.js";

/** The doors the share door reaches, injectable so a test drives it with no vessel. */
export interface ShareDoors {
  readonly faces: () => Promise<readonly ShareFace[]>;
  readonly file: { read(): string | null; write(text: string): void };
  /** Ask the standing vessel; null where none answers. */
  readonly verb: (name: string, args: Record<string, unknown>) => Promise<Record<string, unknown> | null>;
  readonly out: (line: string) => void;
  readonly err: (line: string) => void;
}

const shareFilePath = (): string => join(larConfigHome(), SHARE_CONFIG_FILE);

export const LIVE_SHARE_DOORS: ShareDoors = {
  faces: async () => {
    const petnames = makeFleetPetnameStore(sealedPetnameStore());
    const out: ShareFace[] = [];
    for (const { handleIndex } of (await readPersonaRoots()).roots) out.push({ handleIndex, petname: (await petnames.get(handleIndex)) ?? null });
    return out;
  },
  file: {
    read: () => (existsSync(shareFilePath()) ? readFileSync(shareFilePath(), "utf8") : null),
    write: (text) => {
      mkdirSync(larConfigHome(), { recursive: true });
      const tmp = `${shareFilePath()}.tmp`;
      writeFileSync(tmp, text, { mode: 0o600 });
      renameSync(tmp, shareFilePath());
    },
  },
  verb: async (name, args) => {
    try {
      const r = await runVerb(name, args, await vesselDid());
      if (r.status === "error") throw new Error(r.errorMessage ?? `${name} refused`);
      return (summaryOutput(r) ?? {}) as Record<string, unknown>;
    } catch (e) {
      if (/daemon-unreachable|ECONNREFUSED|ENOENT|no vessel/i.test(e instanceof Error ? e.message : String(e))) return null;
      throw e;
    }
  },
  out: (line) => console.log(line),
  err: (line) => console.error(line),
};


/**
 * THE OPERATOR'S HAND LANDS THE SHARES (`share-apply`): each lit grantee takes a shared bag's row by reference and a delegation
 * from its owner's hive; a grant whose face stands shut waits behind an opaque flag. Null where no vessel answers.
 */
export async function landShares(doors: Pick<ShareDoors, "verb">, faces: readonly ShareFace[]): Promise<Record<string, unknown> | null> {
  return doors.verb("share-apply", { faces: faces.map((f) => ({ handleIndex: f.handleIndex, petname: f.petname })) });
}
