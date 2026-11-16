/**
 * rite-keep — the keep rite's vessel half: the house lays its authored memory into one of the operator's bound workspaces.
 *
 * A workspace stands as a directory the operator bound by hand (`<root>/workspaces/<name>`; the host shim binds it at
 * `/lar/workspaces/<name>`), here a clone of the operator's own private repo. The keep cuts a `lar-carry/1` bundle (the same
 * cut `lares export` makes: cleartext, keyed by pet-name, the one tree a new house imports) and rests it at `<workspace>/<into>`,
 * replacing the bundle an earlier keep left there, so the repo's history diffs file by file.
 *
 * THE LEI CARRIES THE GRANT. The operator strings a keep lei for the workspace by hand, under the ward
 * (`lares lei kui --rite keep --branch <workspace> --returns <n>`); each keep spends one return, and no seat keeps without one.
 * The rite runs behind two ports, in one order:
 *
 *   1. the dest     the workspace's name, its binding and the place inside it, each judged before anything reads
 *   2. swarm-show   IN THE VESSEL: the keep line for this workspace; a line with no standing lei refuses here, before any cut
 *   3. the cut      a bundle written beside the dest and read back whole (`verifyBundle`); its id names this keep's head
 *   4. the standing a dest that already holds this very bundle ends the rite: nothing spends and nothing moves
 *   5. rite-receipt IN THE VESSEL: the verify handed in as the receipt the return rests on (`receipt/<bundle id>`)
 *   6. rite-begin   IN THE VESSEL: name the staged bundle by its place inside the workspace; the vessel reads it back itself,
 *                   derives the bundle id, refuses a head the tree never derived, returns the keep lei at that head and rests
 *                   the guest half of a tessera (`rite-begun`)
 *   7. the move     the cut takes the dest's name; the bundle it replaces leaves whole
 *
 * THE RETURN COMES BEFORE THE MOVE, as every rite's does: a begin the vessel refuses leaves the workspace as it stood. A keep
 * that dies after its return leaves the begun half alone, and conferre reads it red until the host half lands it.
 *
 * THE HOST HALF lands the tessera: git runs on the host, so the commit and the push into the operator's repo belong there, and
 * the landing names the bundle id the pushed tree holds (`lares rite land --tessera <id> --head <bundle id>`).
 *
 * Meme: lar:///ha.ka.ba/lares/docs/pono/seat-harness
 */
import { existsSync, lstatSync, mkdirSync, readFileSync, realpathSync, renameSync, rmSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { basename, dirname, join, relative, sep } from "node:path";
import { repoRoot } from "@lararium/mesh/node";
import { WORKSPACE_NAME_RE } from "@lararium/mesh";
import { larHearthHome, larWorkspacesHome } from "@lararium/node";
import { CARRY_SCHEMA, MANIFEST_FILE, sha256Hex, unsafeRelPath, verifyBundle, type CarryManifest } from "./carry-manifest.js";
import type { RiteRowAnswer } from "./rite-kukulu.js";

export const RITE_KEEP = "keep";
/** The check a keep's receipt names: the bundle read back whole against its manifest. */
export const KEEP_CHECK = "carry-verify";
/** Where a keep rests inside its workspace where the line names no other place. */
export const KEEP_INTO = "house";

/** A refusal the keep raises by name; the message carries the cure. */
export class KeepRefused extends Error {
  override readonly name = "KeepRefused";
  constructor(readonly code: string, message: string) { super(`${code}: ${message}`); }
}

export interface KeepPorts {
  /** One store row, answered by the vessel that stands. */
  row(verb: "swarm-show" | "rite-receipt" | "rite-begin", args: Record<string, unknown>): Promise<RiteRowAnswer>;
  /** Cut a bundle at `dest`, a fresh path inside `workspace`, and answer its manifest (`carryExport`). */
  cut(dest: string, opts: { readonly workspace: string; readonly acceptOmissions: boolean }): Promise<CarryManifest>;
}

export interface KeepOptions { readonly workspace: string; readonly into?: string; readonly acceptOmissions?: boolean; readonly face?: number }

export type KeepResult =
  | { readonly kept: true; readonly workspace: string; readonly into: string; readonly dest: string; readonly bundleId: string; readonly tessera: string; readonly lei: string; readonly n: number;
      readonly faces: readonly string[]; readonly counts: CarryManifest["counts"]; readonly omissions: CarryManifest["omissions"] }
  | { readonly kept: false; readonly standing: true; readonly workspace: string; readonly into: string; readonly dest: string; readonly bundleId: string };

const within = (child: string, parent: string): boolean => child === parent || child.startsWith(parent.endsWith(sep) ? parent : parent + sep);
const real = (p: string): string | null => { try { return realpathSync(p); } catch { return null; } };

/** The bound directory a workspace name resolves to, or a refusal by name: the grammar, the binding, then where it resolves. */
export function keepWorkspaceDir(name: string): string {
  if (typeof name !== "string" || !WORKSPACE_NAME_RE.test(name) || name === "." || name === "..") throw new KeepRefused("keep-workspace-malformed", `${JSON.stringify(name)} names no workspace (lower-case letters, digits, '.', '_' and '-')`);
  const bound = join(larWorkspacesHome(), name);
  const dir = real(bound);
  if (dir === null || !lstatSync(dir).isDirectory()) throw new KeepRefused("keep-workspace-unbound", `the workspace "${name}" stands unbound (no directory at ${bound}); bind it at \`up\` (\`--workspace ${name}=<dir>\`, or LARES_WORKSPACES)`);
  const hearth = real(larHearthHome()) ?? larHearthHome(), checkout = real(repoRoot) ?? repoRoot;
  if (within(dir, hearth)) throw new KeepRefused("keep-workspace-refused", `the workspace "${name}" resolves inside the hearth (${dir})`);
  if (within(dir, checkout)) throw new KeepRefused("keep-workspace-refused", `the workspace "${name}" resolves inside the checkout (${dir}); a bundle holds private memory and never rests in a tracked tree`);
  return dir;
}

/** The bundle id a standing directory holds whole, or null where it holds none that verifies. */
function standingBundle(dir: string): string | null {
  try { return verifyBundle(dir).manifest.bundleId; } catch { return null; }
}

export async function riteKeep(ports: KeepPorts, opts: KeepOptions): Promise<KeepResult> {
  const name = opts.workspace, into = opts.into ?? KEEP_INTO;
  const wsDir = keepWorkspaceDir(name);
  const unsafe = unsafeRelPath(into);
  // No dotted segment: the workspace's own `.git` and every hidden place beside it stay the operator's.
  if (unsafe !== null || into.split("/").some((s) => s.startsWith("."))) throw new KeepRefused("keep-into-unsafe", `--into ${JSON.stringify(into)} names ${unsafe ?? "a dotted segment"}; it names a plain relative place inside the workspace`);
  const target = join(wsDir, ...into.split("/"));
  if (existsSync(target)) {
    // A KEEP REPLACES A KEEP ALONE: a directory that holds no bundle manifest belongs to the operator, and so does a file.
    let schema: unknown = null;
    try { schema = lstatSync(target).isDirectory() ? (JSON.parse(readFileSync(join(target, MANIFEST_FILE), "utf8")) as { schema?: unknown }).schema : null; } catch { schema = null; }
    if (schema !== CARRY_SCHEMA) throw new KeepRefused("keep-dest-foreign", `${target} stands and holds no ${CARRY_SCHEMA} bundle; a keep replaces only the bundle an earlier keep left, so name another place with --into`);
  }
  const face = opts.face === undefined ? {} : { face: opts.face };

  // THE LINE FIRST: with no lei standing, no byte of memory leaves its mirror.
  const line = await ports.row("swarm-show", { rite: RITE_KEEP, branch: name, ...face });
  if (!line.ok) throw new KeepRefused(line.code, line.message);
  const lei = line.output["lei"] as { standing?: boolean; refusal?: string } | undefined;
  if (lei?.standing !== true) {
    throw new KeepRefused(`swarm-lei-${lei?.refusal ?? "absent"}`, `no keep lei stands for the workspace "${name}" (${lei?.refusal ?? "absent"}); the hand strings one: \`lares lei kui --rite keep --branch ${name} --returns <n>\``);
  }

  const parent = dirname(target);
  mkdirSync(parent, { recursive: true });
  if (!within(real(parent) ?? parent, wsDir)) throw new KeepRefused("keep-into-unsafe", `--into ${JSON.stringify(into)} resolves outside the workspace (${real(parent) ?? parent})`);
  const tag = randomBytes(6).toString("hex");
  const staging = join(parent, `.${basename(target)}.keep-${tag}`);
  try {
    await ports.cut(staging, { workspace: wsDir, acceptOmissions: opts.acceptOmissions === true });
    // The keep's own reading of what it cut: every byte against the manifest, and the id over the file list.
    const manifest = verifyBundle(staging).manifest;
    const bundleId = manifest.bundleId;
    if (existsSync(target) && standingBundle(target) === bundleId) {
      rmSync(staging, { recursive: true, force: true });
      return { kept: false, standing: true, workspace: name, into, dest: target, bundleId };
    }
    const receipt = await ports.row("rite-receipt", { tree: bundleId, checks: [KEEP_CHECK], verdict: "pass", definitions: sha256Hex(CARRY_SCHEMA), ...face });
    if (!receipt.ok) throw new KeepRefused(receipt.code, receipt.message);
    // THE VESSEL READS THE TREE ITSELF: the begin names where the cut stands, never only the id this seat heard.
    const staged = relative(wsDir, staging).split(sep).join("/");
    const begun = await ports.row("rite-begin", { rite: RITE_KEEP, branch: name, head: bundleId, staged, ...face });
    if (!begun.ok) throw new KeepRefused(begun.code, begun.message);
    // THE MOVE: the earlier bundle steps aside, the cut takes the name, and the earlier one leaves whole.
    const aside = join(parent, `.${basename(target)}.kept-${tag}`);
    const stood = existsSync(target);
    if (stood) renameSync(target, aside);
    renameSync(staging, target);
    if (stood) rmSync(aside, { recursive: true, force: true });
    return {
      kept: true, workspace: name, into, dest: target, bundleId,
      tessera: String(begun.output["tessera"]), lei: String(begun.output["lei"]), n: Number(begun.output["n"]),
      faces: manifest.faces.map((f) => f.petname), counts: manifest.counts, omissions: manifest.omissions,
    };
  } catch (e) {
    rmSync(staging, { recursive: true, force: true });
    throw e;
  }
}
