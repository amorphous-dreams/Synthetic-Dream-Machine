/**
 * harness/placement-mirrors — what a staged hearth's disk mirrors hold, read the way the placement contract states it.
 *
 * PLACEMENT DECIDES RESIDENCY (lar:///ha.ka.ba/lararium/mesh/control-home). The worn face's daemon wiki projects its working
 * top to `<projections>/wikis/daemon-<F>` and its canon `bags/daemon-<F>` to `<projections>/bags/daemon-<F>`; the daemon
 * document (`bags/daemon`) and the control document (`bags/control`) name no mirror, and neither does the secret home. So a
 * witness reads every file the projections tree holds and asks which titles name a private home: none may.
 *
 * A title reads off the file itself (a `.tid` or `.meta` header's `title:` line, a meme's `title = "…"` meta row) and, for a
 * file that names none, off its path under the mirror root, the siting law's inverse.
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, sep } from "node:path";
import { CONTROL_HOME_ID, DAEMON_BAG_ID, SECRET_HOME_ID, SWARM_URI_PREFIX } from "../../packages/lararium-mesh/src/lar-uris.js";
import { daemonFaceFolder } from "../../packages/lararium-node/src/bag-paths.js";
import { stagedHearthRelation } from "./instance.js";

/** The worn face's two daemon mirrors on a staged hearth: its working top and its canon. */
export function faceDaemonMirrors(root: string): { readonly working: string; readonly canon: string } {
  const folder = daemonFaceFolder(stagedHearthRelation(root));
  return { working: join(root, "projections", "wikis", folder), canon: join(root, "projections", "bags", folder) };
}

/** Every file under `dir`, relative to it; an absent dir holds none. */
export function filesUnder(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return (readdirSync(dir, { recursive: true }) as string[]).filter((p) => statSync(join(dir, p)).isFile());
}

/** The titles the files under `dir` carry: each file's own title rows, else the title its path sites. */
export function titlesUnder(dir: string): string[] {
  const titles = new Set<string>();
  for (const rel of filesUnder(dir)) {
    let text = "";
    try { text = readFileSync(join(dir, rel), "utf8"); } catch { /* unreadable: the path still names it */ }
    const named = [...text.matchAll(/^title:\s*(.+)$/gm), ...text.matchAll(/^title\s*=\s*"([^"\n]+)"\s*$/gm)].map((m) => m[1]!.trim());
    if (named.length > 0) for (const t of named) titles.add(t);
    else if (!rel.endsWith(".meta")) titles.add(`lar:///${rel.split(sep).join("/").replace(/\.[^/.]+$/, "")}`);
  }
  return [...titles];
}

const PRIVATE_HOMES = [CONTROL_HOME_ID, SECRET_HOME_ID, DAEMON_BAG_ID];

/** True for a title of a private home's families: the control document's, the secret home's, the daemon document's, the swarm's. */
export function namesPrivateHome(title: string): boolean {
  if (title.startsWith(SWARM_URI_PREFIX)) return true;
  return PRIVATE_HOMES.some((home) => title === home || title.startsWith(`${home}/`));
}

/** Every title under the hearth's projections tree that names a private home: placement keeps the list empty. */
export function privateTitlesProjected(root: string): string[] {
  return titlesUnder(join(root, "projections")).filter(namesPrivateHome);
}
