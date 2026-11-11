/**
 * `lares bag share` · `lares wiki share` — THE SHARE CONFIG's one door (sealed-store#/the-share-config).
 *
 *   lares bag share <bag> --read <names> [--write <names>] [--note <why>] [--face N]
 *   lares wiki share <wiki> --read <names> [--write <names>] [--note <why>]
 *   lares bag share --list        every row, and the one resolver's answer per bag: who reads, who writes, who waits
 *
 * Names are face PET-NAMES as a title list (`a b [[c d]]`), `*` for every face, or empty; `hN` (and `--face N`, which adds
 * face N to the readers) resolve to that face's pet-name, so a row always names faces by pet-name. The row writes through
 * to `$LAR_ROOT/config/share.tid` (it survives a re-founding; a person edits it by hand, and the next boot reconciles it in,
 * the file winning) and, with a vessel standing, into the control document (`share-set`); then the operator's hand lands it
 * (`share-apply`): each lit grantee takes the bag's row by reference and a delegation from the owner's hive, and a grant whose
 * face stands shut waits behind an opaque flag until it lights.
 *
 * Meme: lar:///ha.ka.ba/lararium/mesh/sealed-store#/the-share-config
 */
import {
  parseShareFile, parseShareFilter, resolveShare, serializeShareFile, shareRowBag, ShareConfigRefusal, SHARE_CONFIG_FILE,
  type ShareFace, type ShareRow,
} from "@lararium/mesh";
import type { ParsedArgs } from "../parse-args.js";
import { LIVE_SHARE_DOORS, landShares, type ShareDoors } from "../share-doors.js";

/** Resolve `hN` tokens to face N's pet-name (bracketed where it holds a space); every other token stands as written. */
export function petnamesOf(filter: string, faces: readonly ShareFace[]): string {
  const parsed = parseShareFilter(filter);
  const names = parsed.names.map((n) => {
    const m = /^h(0|[1-9]\d*)$/.exec(n);
    if (!m) return n;
    const face = faces.find((f) => f.handleIndex === Number(m[1]));
    if (!face?.petname) throw new ShareConfigRefusal("share-filter-unsupported", `${n} names no face carrying a pet-name here`);
    return face.petname;
  });
  const quoted = names.map((n) => (/\s/.test(n) ? `[[${n}]]` : n));
  return [...(parsed.all ? ["*"] : []), ...quoted].join(" ");
}

/** The lines `--list` prints: each row and the one resolver's answer. */
export function shareListLines(rows: readonly ShareRow[], faces: readonly ShareFace[]): string[] {
  if (rows.length === 0) return ["share: no row stands; vessel-tier canon reads for every face, and every other bag stays its owner's"];
  const label = (i: number): string => { const f = faces.find((x) => x.handleIndex === i); return f?.petname ? `${f.petname} (h${i})` : `h${i}`; };
  const out: string[] = [];
  for (const row of rows) {
    const a = resolveShare({ bag: shareRowBag(row), rows, faces });
    out.push(`${row.kind} ${row.slug}: read ${a.read.map(label).join(", ") || "(none named)"} · write ${a.write.map(label).join(", ") || "(none named)"}${row.note ? ` · ${row.note}` : ""}`);
    for (const w of a.waiting) out.push(`  waits: "${w}" names no face here; it lands when a face carries that pet-name`);
  }
  return out;
}

export function cmdShare(kind: "bag" | "wiki", doors: ShareDoors = LIVE_SHARE_DOORS): (args: ParsedArgs) => Promise<number> {
  return async (args) => {
    const text = doors.file.read();
    let rows: ShareRow[];
    try { rows = text === null ? [] : parseShareFile(text); }
    catch (e) { doors.err(`lares ${kind} share: ${e instanceof Error ? e.message : String(e)} (in ${SHARE_CONFIG_FILE})`); return 2; }
    const faces = await doors.faces().catch(() => [] as ShareFace[]);
    if (args.flags["list"] === true) {
      for (const line of shareListLines(rows, faces)) doors.out(line);
      return 0;
    }
    const slug = args.positional[0];
    if (!slug) { doors.err(`lares ${kind} share: name the ${kind} (\`lares ${kind} share <${kind}> --read <names> [--write <names>]\`), or --list`); return 2; }
    let read: string, write: string;
    try {
      const faceOpt = args.options["face"];
      const sugar = faceOpt !== undefined ? ` h${Number(faceOpt)}` : "";
      read = petnamesOf(`${args.options["read"] ?? ""}${sugar}`, faces);
      write = petnamesOf(args.options["write"] ?? "", faces);
    } catch (e) { doors.err(`lares ${kind} share: ${e instanceof Error ? e.message : String(e)}`); return 2; }
    const note = args.options["note"];
    const row: ShareRow = { slug, kind, read, write, ...(note ? { note } : {}) };
    const next = [...rows.filter((r) => r.slug !== slug), row];
    try { serializeShareFile(next); } catch (e) { doors.err(`lares ${kind} share: ${e instanceof Error ? e.message : String(e)}`); return 2; }
    doors.file.write(serializeShareFile(next));
    doors.out(`share: ${kind} ${slug} reads for ${read || "(none named)"}, writes for ${write || "(none named)"}; written to config/${SHARE_CONFIG_FILE}`);
    const set = await doors.verb("share-set", { slug, kind, read, write, ...(note ? { note } : {}) });
    if (set === null) { doors.out("  no vessel stands: the next boot reconciles the file into the control document, the file winning"); return 0; }
    // THE OPERATOR'S HAND LANDS IT: each lit grantee takes the row by reference and a delegation from the owner's hive.
    const applied = await landShares(doors, faces);
    if (applied !== null) {
      doors.out(`  landed: ${Number(applied["granted"] ?? 0)} grant(s); ${Number(applied["pending"] ?? 0)} wait for a shut face (\`lares vault unlock --face N\`, then share again)`);
      for (const w of Array.isArray(applied["waiting"]) ? applied["waiting"] as string[] : []) doors.out(`  waits: "${w}" names no face here`);
    }
    for (const w of resolveShare({ bag: shareRowBag(row), rows: next, faces }).waiting) doors.err(`  "${w}" names no face here; the row keeps it, and it lands when a face carries that pet-name`);
    return 0;
  };
}
