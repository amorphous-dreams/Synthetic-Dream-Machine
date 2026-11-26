/**
 * cap-stack — THE GRAMMAR EVERY `#/has` STACK SHARES: a cap rides as a three-term `lar:///` address, one per line, and a
 * record's `tags` read as TiddlyWiki reads a title list. The spirit stack (`spirit-stack.ts`) and the herm stack
 * (`herm-stack.ts`) both call this one core, so a cap reads the same whichever entity holds it.
 *
 * TAGS GATHER, OCAPS AUTHORIZE: nothing here grants; a cap on a stack names what its holder holds.
 *
 * Platform-blind and pure: no door, no clock, no env, and no import, so every module tiddler bundles it whole.
 */

const TERM = "[a-z0-9]+(?:-[a-z0-9]+)*";
/** A cap's address: a three-term root and no path (the root segment law). */
export const CAP_ADDRESS = new RegExp(`^lar:///${TERM}\\.${TERM}\\.${TERM}$`);

/** A value on one line: every run of whitespace reads as one space. */
export const oneLine = (value: string): string => value.replace(/\s+/g, " ").trim();

/** A `tags` field read as TiddlyWiki reads a title list: space-joined, a title holding a space double-bracketed. */
export function tagsOf(raw: string | undefined): string[] {
  const out: string[] = [];
  const re = /\[\[([^\]]+)\]\]|(\S+)/g;
  for (let m = re.exec(raw ?? ""); m !== null; m = re.exec(raw ?? "")) {
    const tag = m[1] ?? m[2]!;
    if (!out.includes(tag)) out.push(tag);
  }
  return out;
}
/** A title list written back as a `tags` field. */
export const tagsText = (tags: readonly string[]): string => tags.map((t) => (/\s/.test(t) ? `[[${t}]]` : t)).join(" ");

/** One `#/has` line read: a cap's address (`lar:///a.b.c`, or bare `a.b.c`) and the value that follows it. Null where it names none. */
export function capLine(line: string): { cap: string; value: string } | null {
  const m = /^(\S+)(?:\s+([\s\S]*))?$/.exec(line.trim());
  if (!m) return null;
  const cap = m[1]!.startsWith("lar:///") ? m[1]! : `lar:///${m[1]!}`;
  return CAP_ADDRESS.test(cap) ? { cap, value: oneLine(m[2] ?? "") } : null;
}
