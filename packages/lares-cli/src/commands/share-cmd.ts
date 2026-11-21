/**
 * `lares bag share` · `lares wiki share` — THE SHARE CONFIG's one door (sealed-store#/the-share-config).
 *
 *   lares bag share <bag> [--read <names>] [--write <names>] [--read-remove <names>] [--write-remove <names>] [--note <why>] [--face N]
 *   lares wiki share <wiki> [--read <names>] [--write <names>] [--read-remove <names>] [--write-remove <names>] [--note <why>] [--workspace <name>]
 *
 * A LINE NAMES ITS DELTA: `--read`/`--write` add names beside the row's standing ones, `--read-remove`/`--write-remove` take
 * names out, and what the line leaves unnamed (the other list, the note, the workspace, the owner) stands. The same line run
 * twice writes the same row; the echo prints the resolved row.
 *   lares bag share --list        every row, and the one resolver's answer per bag: who reads, who writes, who waits
 *   lares bag share --list --json each row AS WRITTEN (its read and write title lists, `*` kept, its note, workspace and
 *                                 owner), beside the resolver's answer (`resolved`): a re-grant reads the row's own policy here
 *   lares bag share <bag> --remove · lares wiki share <wiki> --remove   unshare: the row leaves the file and the control document
 *
 * ONE ROW PER SLUG: a share of the other kind over a standing row refuses `share-kind-standing` and writes nothing; unshare
 * that row first through its own kind's door (`--remove`).
 *
 * Names are face PET-NAMES as a title list (`a b [[c d]]`), `*` for every face, or empty; `hN` (and `--face N`, which adds
 * face N to the readers) resolve to that face's pet-name, so a row always names faces by pet-name. The row writes through
 * to `$LAR_ROOT/config/share.tid` (it survives a re-founding; a person edits it by hand, and the next boot reconciles it in,
 * the file winning) and, with a vessel standing, into the control document (`share-set`); then the operator's hand lands it
 * (`share-apply`): each lit grantee takes the bag's row by reference and a delegation from the owner's hive, and a grant whose
 * face stands shut waits behind an opaque flag until it lights.
 *
 * A WIKI'S SHARE RIDES A PRIVATE CABAL (cabal-realm#/the-workbench): the landing founds (once) a cabal realm of the faces the
 * row names, whose workbench (the wiki's shared working layer, one CRDT) every member face syncs. `--workspace <name>` rests
 * the workbench's plaintext mirror in the operator-configured directory the host shim binds at `/lar/workspaces/<name>`, else
 * under `<projections>/wikis/<slug>`. The daemon wiki refuses (`share-face-private`).
 *
 * Meme: lar:///ha.ka.ba/lararium/mesh/sealed-store#/the-share-config
 */
import {
  assertShareKindFree, parseShareFile, parseShareFilter, resolveShare, serializeShareFile, shareEntryBag, ShareConfigRefusal, SHARE_CONFIG_FILE,
  type ShareFace, type ShareEntry,
} from "@lararium/mesh";
import type { ParsedArgs } from "../parse-args.js";
import { LIVE_SHARE_DOORS, landShares, shareSetArgs, type ShareDoors } from "../share-doors.js";

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
  return filterOf(parsed.all, names);
}

/** A title list from its parts: `*` first, each name once (a name given by pet-name and by `hN` reads once), bracketed where it holds a space. */
function filterOf(all: boolean, names: readonly string[]): string {
  const quoted = [...new Set(names)].map((n) => (/\s/.test(n) ? `[[${n}]]` : n));
  return [...(all ? ["*"] : []), ...quoted].join(" ");
}

/**
 * THE DELTA A SHARE LINE NAMES, laid over the standing filter: `add` joins its names (and `*`), `drop` takes its names (and `*`)
 * out, and every name the line leaves unnamed stands. The same line over its own result changes nothing.
 */
export function shareDelta(standing: string, add: string, drop: string): string {
  const s = parseShareFilter(standing), a = parseShareFilter(add), d = parseShareFilter(drop);
  const gone = new Set(d.names);
  return filterOf((s.all || a.all) && !d.all, [...s.names, ...a.names].filter((n) => !gone.has(n)));
}

/**
 * What `--list --json` prints: each row as `config/share.tid` holds it (the policy a re-grant keeps: `*` stays `*`, a pet-name
 * no face carries yet stays named, the note, workspace and owner ride), and beside it the resolver's answer by handle index.
 */
export function shareListJson(rows: readonly ShareEntry[], faces: readonly ShareFace[]): { rows: Array<ShareEntry & { resolved: { read: number[]; write: number[]; waiting: string[] } }> } {
  return {
    rows: rows.map((row) => {
      const a = resolveShare({ bag: shareEntryBag(row), rows, faces });
      return { ...row, resolved: { read: [...a.read], write: [...a.write], waiting: [...a.waiting] } };
    }),
  };
}

/** The lines `--list` prints: each row and the one resolver's answer. */
/** The resolver's answer for one row, each face by pet-name and handle (`the referee (h2)`). */
function resolvedOf(row: ShareEntry, rows: readonly ShareEntry[], faces: readonly ShareFace[]): { read: string; write: string; waiting: readonly string[] } {
  const label = (i: number): string => { const f = faces.find((x) => x.handleIndex === i); return f?.petname ? `${f.petname} (h${i})` : `h${i}`; };
  const a = resolveShare({ bag: shareEntryBag(row), rows, faces });
  return { read: a.read.map(label).join(", ") || "(none named)", write: a.write.map(label).join(", ") || "(none named)", waiting: a.waiting };
}

export function shareListLines(rows: readonly ShareEntry[], faces: readonly ShareFace[]): string[] {
  if (rows.length === 0) return ["share: no row stands; house canon reads the floor for every face, and every other bag stays its owner's"];
  const out: string[] = [];
  for (const row of rows) {
    const a = resolvedOf(row, rows, faces);
    out.push(`${row.kind} ${row.slug}: read ${a.read} · write ${a.write}${row.note ? ` · ${row.note}` : ""}`);
    for (const w of a.waiting) out.push(`  waits: "${w}" names no face here; it lands when a face carries that pet-name`);
  }
  return out;
}

export function cmdShare(kind: "bag" | "wiki", doors: ShareDoors = LIVE_SHARE_DOORS): (args: ParsedArgs) => Promise<number> {
  return async (args) => {
    const text = doors.file.read();
    let rows: ShareEntry[];
    try { rows = text === null ? [] : parseShareFile(text); }
    catch (e) { doors.err(`lares ${kind} share: ${e instanceof Error ? e.message : String(e)} (in ${SHARE_CONFIG_FILE})`); return 2; }
    const faces = await doors.faces().catch(() => [] as ShareFace[]);
    if (args.flags["list"] === true) {
      if (args.flags["json"] === true) { doors.out(JSON.stringify(shareListJson(rows, faces))); return 0; }
      for (const line of shareListLines(rows, faces)) doors.out(line);
      return 0;
    }
    const slug = args.positional[0];
    if (!slug) { doors.err(`lares ${kind} share: name the ${kind} (\`lares ${kind} share <${kind}> --read <names> [--write <names>]\`), or --list`); return 2; }
    const standing = rows.find((r) => r.slug === slug);
    if (args.flags["remove"] === true) {
      if (!standing) { doors.err(`lares ${kind} share: no row stands for ${slug}; nothing to unshare`); return 2; }
      if (standing.kind !== kind) { doors.err(`lares ${kind} share: ${slug} stands shared as a ${standing.kind} row; unshare it through its door (\`lares ${standing.kind} share ${slug} --remove\`)`); return 2; }
      // THE UNSHARE TAKES THE LANDED GRANTS BACK, with the row still standing in the control document (the landing reads it
      // there): the owner's hive revokes each reader the row delegated to. A grant it cannot revoke here (an owner or grantee
      // face stands shut) still reads, so the door refuses to answer "unshared", names the slug, and leaves the row where it stands.
      const taken = await doors.verb("share-apply", { faces: faces.map((f) => ({ handleIndex: f.handleIndex, petname: f.petname })), unshare: [slug] });
      const stillReads = Array.isArray(taken?.["standing"]) ? taken["standing"] as string[] : [];
      if (stillReads.includes(slug)) {
        doors.err(`lares ${kind} share: ${slug} stays shared. A grant its row landed still reads, and this vessel cannot revoke it while the owner's face or a grantee's face stands shut here.`);
        doors.err(`  The row stays in config/${SHARE_CONFIG_FILE} and the control document. Light the faces (\`lares vault unlock --face N\`), then run \`lares ${kind} share ${slug} --remove\` again.`);
        return 1;
      }
      const rest = rows.filter((r) => r.slug !== slug);
      doors.file.write(serializeShareFile(rest));
      doors.out(`share: ${kind} ${slug} unshared; its row leaves config/${SHARE_CONFIG_FILE}`);
      if (taken !== null) doors.out(`  revoked: ${Number(taken["revoked"] ?? 0)} grant(s) the row had landed`);
      const removed = await doors.verb("share-set", { slug, remove: true });
      if (removed === null) doors.out("  no vessel stands: the next boot reconciles the file into the control document, the file winning");
      return 0;
    }
    try { assertShareKindFree(slug, kind, standing?.kind); } catch (e) { doors.err(`lares ${kind} share: ${e instanceof Error ? e.message : String(e)}`); return 2; }
    // A SHARE NAMES ITS DELTA (idempotent and isomorphic by intent): `--read`/`--write` add names beside the standing ones,
    // `--read-remove`/`--write-remove` take names out, and every part the line leaves unnamed (the other list, the note, the
    // workspace, the owner) stands as the row held it. The same line run again writes the same row.
    const prior = rows.find((r) => r.slug === slug && r.kind === kind);
    const removing = args.options["read-remove"] !== undefined || args.options["write-remove"] !== undefined;
    if (removing && !prior) { doors.err(`lares ${kind} share: no row stands for ${slug}; --read-remove and --write-remove take names out of a standing row`); return 2; }
    let read: string, write: string;
    try {
      const faceOpt = args.options["face"];
      const sugar = faceOpt !== undefined ? ` h${Number(faceOpt)}` : "";
      read = shareDelta(prior?.read ?? "", petnamesOf(`${args.options["read"] ?? ""}${sugar}`, faces), petnamesOf(args.options["read-remove"] ?? "", faces));
      write = shareDelta(prior?.write ?? "", petnamesOf(args.options["write"] ?? "", faces), petnamesOf(args.options["write-remove"] ?? "", faces));
    } catch (e) { doors.err(`lares ${kind} share: ${e instanceof Error ? e.message : String(e)}`); return 2; }
    const note = args.options["note"] ?? prior?.note;
    const workspace = kind === "wiki" ? args.options["workspace"] ?? prior?.workspace : undefined;
    if (kind === "bag" && args.options["workspace"] !== undefined) { doors.err("lares bag share: --workspace names where a WIKI's workbench rests; a bag takes none"); return 2; }
    const row: ShareEntry = { slug, kind, read, write, ...(workspace ? { workspace } : {}), ...(prior?.owner ? { owner: prior.owner } : {}), ...(note ? { note } : {}) };
    // The row keeps its place in the file, so a line that changes nothing writes the very bytes it read.
    const next = prior ? rows.map((r) => (r === prior ? row : r)) : [...rows.filter((r) => r.slug !== slug), row];
    try { serializeShareFile(next); } catch (e) { doors.err(`lares ${kind} share: ${e instanceof Error ? e.message : String(e)}`); return 2; }
    const unchanged = prior !== undefined && serializeShareFile([prior]) === serializeShareFile([row]);
    doors.file.write(serializeShareFile(next));
    // THE ECHO READS THE RESOLVED ROW, each face once (the answer `--list` gives).
    const resolved = resolvedOf(row, next, faces);
    doors.out(`share: ${kind} ${slug} reads for ${resolved.read}, writes for ${resolved.write}; ${unchanged ? "unchanged in" : "written to"} config/${SHARE_CONFIG_FILE}`);
    const set = await doors.verb("share-set", shareSetArgs(row));
    if (set === null) { doors.out("  no vessel stands: the next boot reconciles the file into the control document, the file winning"); return 0; }
    // THE OPERATOR'S HAND LANDS IT: each lit grantee takes the row by reference and a delegation from the owner's hive.
    const applied = await landShares(doors, faces);
    if (applied !== null) {
      const carried = Number(applied["carried"] ?? 0), pending = Number(applied["pending"] ?? 0);
      doors.out(`  landed: ${Number(applied["granted"] ?? 0)} grant(s)`
        + (carried > 0 ? `; ${carried} of them reach the grantee's catalog when the daemon mount next runs under that face (\`lares vault unlock --face N\`)` : "")
        + (pending > 0 ? `; ${pending} wait for a shut face (\`lares vault unlock --face N\`, then share again)` : ""));
      for (const w of Array.isArray(applied["workbenches"]) ? applied["workbenches"] as Array<Record<string, unknown>> : []) {
        doors.out(`  workbench: wiki ${String(w["slug"])} rides realm ${String(w["realmId"]).slice(0, 12)}… (${Number(w["members"] ?? 0)} member face(s)${w["founded"] === true ? ", founded now" : ""})`);
        if (w["restsUnderOwner"] === true && Number(w["members"] ?? 0) > 0) doors.out(`    its document rests sealed under its owner face on this vessel, so each seated face here writes its own personal layer of ${String(w["slug"])} and offers from there; the seats stand for the wire and for each face's own vessels`);
      }
      // THE ROW KEEPS ITS OWNER, by pet-name, in the vessel-local file: after a re-founding the seed re-stands the wiki at
      // that face's wear. The name is the human's own label, so it rests here and in the control document.
      const landedOwners = new Map<string, string>();
      for (const w of Array.isArray(applied["workbenches"]) ? applied["workbenches"] as Array<Record<string, unknown>> : []) {
        const pet = faces.find((f) => f.handleIndex === w["owner"])?.petname;
        if (typeof w["slug"] === "string" && pet) landedOwners.set(w["slug"], pet);
      }
      const owned = next.map((r) => (r.kind === "wiki" && landedOwners.has(r.slug) && r.owner !== landedOwners.get(r.slug) ? { ...r, owner: landedOwners.get(r.slug)! } : r));
      if (owned.some((r, i) => r !== next[i])) {
        doors.file.write(serializeShareFile(owned));
        // ...AND IN THE CONTROL DOCUMENT, which share-apply reads: the file reaches it only at the vessel's next boot.
        for (const r of owned.filter((r, i) => r !== next[i])) await doors.verb("share-set", shareSetArgs(r));
      }
      for (const w of Array.isArray(applied["waiting"]) ? applied["waiting"] as string[] : []) doors.out(`  waits: "${w}" names no face here`);
      for (const slug of Array.isArray(applied["unowned"]) ? applied["unowned"] as string[] : []) doors.out(`  waits: "${slug}" stands in no catalog the daemon mount reads: run the daemon mount under the face that owns it (\`lares vault unlock --face N\`) and share again, or stand it first (\`lares wiki init ${slug}\`)`);
    }
    for (const w of resolveShare({ bag: shareEntryBag(row), rows: next, faces }).waiting) doors.err(`  "${w}" names no face here; the row keeps it, and it lands when a face carries that pet-name`);
    return 0;
  };
}
