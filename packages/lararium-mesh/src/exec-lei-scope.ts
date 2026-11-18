/**
 * exec-lei-scope — what an executable-record lei reaches (backlog-awakens "The executable-record lei").
 *
 * An `exec` lei carries a `scope`: the one wiki it reaches, the writer it was strung for (a seat, or a realm member's face), and,
 * within the wiki, either a title set or one class of the mesh's executable-class list; a scope naming neither reaches every
 * executable record of that writer in the wiki. The lei rests on its wiki's line: its branch derives from the wiki's name
 * (`execLeiBranch`), so a wiki's URI, which no ref name holds, still names one line. No other rite carries a scope.
 */
import { canonicalJsonBytes, sha256HexBytesSync } from "./crypto.js";
import { isExecutableClassName } from "./executable-class.js";

export interface ExecLeiScope {
  readonly wiki: string;
  readonly writer: string;
  readonly titles?: readonly string[];
  readonly class?: string;
}

/** The branch an exec lei rests at: one line per wiki, derived from the wiki's name. */
export const execLeiBranch = (wiki: string): string => `wiki-${sha256HexBytesSync(canonicalJsonBytes({ wiki })).slice(0, 32)}`;

const name = (x: unknown, max: number): x is string => typeof x === "string" && x.length > 0 && x.length <= max && !/[\u0000-\u001f\u007f]/.test(x);

/** Why a scope does not form, or null where it does. */
export function execLeiScopeRefusal(scope: unknown): string | null {
  if (typeof scope !== "object" || scope === null || Array.isArray(scope)) return "an exec lei names its scope: the wiki, the writer, and a title set or one class";
  const s = scope as Record<string, unknown>;
  if (Object.keys(s).some((k) => !["wiki", "writer", "titles", "class"].includes(k))) return "an exec lei's scope names its wiki, writer, titles or class, and nothing else";
  if (!name(s["wiki"], 512)) return "an exec lei's scope names its wiki";
  if (!name(s["writer"], 512)) return "an exec lei's scope names the writer it was strung for";
  if (s["titles"] !== undefined && s["class"] !== undefined) return "an exec lei's scope names a title set or one class, never both";
  if (s["titles"] !== undefined && (!Array.isArray(s["titles"]) || s["titles"].length === 0 || s["titles"].length > 256 || !s["titles"].every((t) => name(t, 1024)))) return "an exec lei's title set names at least one title";
  if (s["class"] !== undefined && !isExecutableClassName(s["class"])) return "an exec lei's class names one class of the executable-class list";
  return null;
}
