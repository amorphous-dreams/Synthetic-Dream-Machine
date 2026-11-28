/**
 * msg-verbs — `msg`, THE DOOR THAT LANDS AN ENTRY (lar:///ha.ka.ba/kahua/memory/course/comms-ux-enacts landings 14 and 15; the
 * carrier lar:///ha.ka.ba/lares/afford/engine.msg.lands, address `lar:///engine.msg.lands`, a candidate).
 *
 *   msg { recipe, stream, note, to?, re?, about?, slug?, prev?, carry?, mode?, mood?, stance?, aperture?, driftWard?, seat?, model?, mandate?, dry? }
 *       → { recipe, stream, title, prev, root, founded, decision, … the put's receipt }       one entry lands
 *   msg { recipe, stream, read: "inbox" }   → { recipe, stream, inbox: [{ title, has, … }], total }   (`mu=?0`)
 *   msg { recipe, stream, retract: true, title? } → { recipe, stream, title, decision: "retracted", withheld }   (`mu=00`)
 *
 * ONE AFFORDANCE. A msg with no `to` lands on the caller's own stream (a thought, a note to self); with `to`, it addresses an
 * entity or one instance. A braid needs no verb: `re` takes several entries. A msg carries pointers, never prose briefs:
 * `about` names a title at its hash, `note` holds one line of 72 characters or fewer, and the entry's fields carry the writer's
 * `set` panel (`mode`, `mood`, `mu`, `stance`, `aperture`, `drift-ward`). The panel's tool-carry rides the `carry` param and
 * lands as the entry's `mu` field, since the call's own `mu` names the depth of the call (inbox, retract, dry).
 *
 * THE LOG GRAPH (`stream-entries`). The stream's root stands at `lar:///ha.ka.ba/kahua/memory/stream/<pet>-<n>` and names its
 * seat, face, model and mandate; the first msg founds it. Each entry lands at `<root>-<h8>-<slug>`, `h8` the first eight hex of
 * the SHA-256 over its birth fields (stream, prev, re, to, about, note), so its title never recomputes. `prev` takes the
 * stream's one head; a stream showing two heads refuses `stream-forked` and names each head as a call, and a `prev` naming no
 * entry of the stream refuses `prev-unknown`.
 *
 * SEEN, WITHOUT FLAGS OR CLOCKS. The inbox (`mu=?0`) reads the entries addressed to the stream (or its entity) that no entry of
 * the stream names directly in `re`, over the reader's view alone. A retract (`mu=00`) removes the caller's own entry, the
 * stream's one head where no `title` names it, while the view shows no record naming it in `re` (`msg-answered`) and no entry
 * of the stream naming it as `prev` (`msg-followed`); the answer counts the records behind another face's wall that name it
 * (`withheld`). Once answered, an entry stands in the history: a reply corrects it.
 *
 * EVERY WRITE RIDES THE PUT LAW. The root and the entry land through `tiddler-put` (`create`), so the cap, the Kahu predicate,
 * the receipt and the dry seat stand as they stand for any record; a retract rides `tiddler-delete`. A dry carry (`mu=_`) walks
 * the entry's put to the last step and lands nothing.
 *
 * Runs daemon-side (a plain module, never a plugin tiddler).
 *
 * Meme: lar:///ha.ka.ba/lares/afford/engine.msg.lands
 */
import { VerbRefusal } from "@lararium/mesh/verb-refusal";
import { canonicalJsonBytes, sha256HexBytesSync } from "@lararium/mesh/crypto";
import { parseTitleList, stringifyList } from "@lararium/mesh/carrier-form";
import type { VerbContext, VerbReactor } from "./verb-dispatcher.js";
import { makeTiddlerDeleteReactor, makeTiddlerPutReactor, readerViewOf, type ReaderViewWiki, type TiddlerVerbOptions } from "./tiddler-verbs.js";
import { CallRefusal, cureCall, type CallSeat } from "./modules/call.js";
import { dryDepthOf, muWordsOf } from "./modules/mu.js";
import { hasLine, param } from "./has-line.js";
import { NOTE_MAX, entryOf, entryTitleOf, headsOf, inboxOf, isAddress, noteFault, readStream, reOf, slugOf, streamRootOf, type StreamEntry } from "./stream-entries.js";

/** The msg carrier's address. */
export const MSG_ADDRESS = "lar:///engine.msg.lands";

/** The panel fields an entry carries, as the call names them and as the entry's fields hold them. */
const PANEL: ReadonlyArray<readonly [arg: string, field: string]> = [
  ["mode", "mode"], ["mood", "mood"], ["carry", "mu"], ["stance", "stance"], ["aperture", "aperture"], ["driftWard", "drift-ward"],
];
/** The root fields a msg may name: the stream's seat, model and mandate (its face reads off the session). */
const ROOT_FIELDS = ["seat", "model", "mandate"] as const;

const textArg = (args: Readonly<Record<string, unknown>>, key: string): string | null => {
  const v = args[key];
  return typeof v === "string" && v.trim() !== "" ? v.trim() : null;
};

/** A list arg: an array (the seat), or a TiddlyWiki list string (a terminal, a sigil). */
const listArg = (raw: unknown): string[] => {
  if (Array.isArray(raw)) return raw.map((v) => String(v).trim()).filter((v) => v !== "");
  return typeof raw === "string" ? [...(parseTitleList(raw) ?? [])] : [];
};

/** The container a write rides: the call's own (the face it wears already chose the engine these options answer in). */
const containerOf = (args: Readonly<Record<string, unknown>>): Record<string, unknown> => {
  const out: Record<string, unknown> = {};
  for (const key of ["recipe", "bag", "realm"]) if (args[key] !== undefined) out[key] = args[key];
  return out;
};

/** The stream a call names, read and checked; a call naming none refuses with a cure. */
function streamOf(args: Readonly<Record<string, unknown>>): string {
  const stream = textArg(args, "stream");
  if (stream === null) {
    throw new CallRefusal("stream-unnamed", "a msg names the stream it writes as (`<pet>#<n>`, the summoned instance's name)", cureCall("msg", { stream: "<pet>#<n>", note: "<one line>" }));
  }
  if (readStream(stream) === null) {
    throw new CallRefusal("stream-malformed", `"${stream}" reads no stream name: a stream reads <pet>#<n>, the pet lowercase and hyphen-joined, the instance lowercase letters and digits`, cureCall("msg", { stream: "<pet>#<n>", note: "<one line>" }));
  }
  return stream;
}

/** One line a panel or pointer field takes: never blank, never two lines. */
function lineOf(args: Readonly<Record<string, unknown>>, key: string, field: string): string | null {
  const value = textArg(args, key);
  if (value !== null && /[\r\n]/.test(value)) throw new VerbRefusal("field-one-line", `field-one-line: msg's ${field} holds one line; nothing landed`);
  return value;
}

/** Every entry the view holds, read once. */
function entriesIn(wiki: ReaderViewWiki): StreamEntry[] {
  const out: StreamEntry[] = [];
  wiki.each((tiddler, title) => { const entry = entryOf(title, tiddler.fields); if (entry !== null) out.push(entry); });
  return out;
}

/** The birth hash: the first eight hex of the SHA-256 over the entry's birth fields, canonical JSON. */
export function birthHashOf(birth: { stream: string; prev: string | null; re: readonly string[]; to: string | null; about: string | null; note: string }): string {
  return sha256HexBytesSync(canonicalJsonBytes({ stream: birth.stream, prev: birth.prev ?? "", re: [...birth.re], to: birth.to ?? "", about: birth.about ?? "", note: birth.note })).slice(0, 8);
}

/** An entry's has line: who wrote it, to whom, about what, its note as the tagline. */
function entryHas(title: string, fields: Readonly<Record<string, unknown>> | undefined): string {
  const at = (key: string): string => (typeof fields?.[key] === "string" ? String(fields[key]) : "");
  const params = [param("from", at("stream")), ...(at("to") ? [param("to", at("to"))] : []), ...(at("about") ? [param("about", at("about"))] : []), ...(at("prev") ? [param("prev", at("prev"))] : [])];
  return hasLine(title, params, at("note"));
}

/** The call a reader runs to name `prev` on a forked stream. */
const forkCure = (stream: string, heads: readonly string[], note: string): string => heads.map((head) => cureCall("msg", { stream, prev: head, note })).join(" · ");

/** THE INBOX (`mu=?0`): the entries addressed to the stream or its entity that no entry of the stream names in `re`. */
async function readInbox(opts: TiddlerVerbOptions, args: Readonly<Record<string, unknown>>, ctx: VerbContext): Promise<Record<string, unknown>> {
  const stream = streamOf(args);
  const { recipe, view } = await readerViewOf(opts, args, ctx, "msg");
  const entries = entriesIn(view);
  const titles = inboxOf(entries, entries, stream);
  const inbox = titles.map((title) => {
    const fields = view.getTiddler(title)?.fields;
    return { title, has: entryHas(title, fields), from: String(fields?.["stream"] ?? ""), note: String(fields?.["note"] ?? "") };
  });
  return {
    has: hasLine(streamRootOf(stream), [param("stream", stream), param("inbox", inbox.length)], inbox.length === 0 ? "the inbox stands empty" : `${inbox.length} unseen`),
    recipe, stream, inbox, total: inbox.length,
  };
}

/** THE RETRACT (`mu=00`): the caller's own entry leaves while nothing names it. */
async function retract(opts: TiddlerVerbOptions, del: VerbReactor, args: Readonly<Record<string, unknown>>, ctx: VerbContext): Promise<Record<string, unknown>> {
  const stream = streamOf(args);
  const { recipe, view, wiki, visible } = await readerViewOf(opts, args, ctx, "msg");
  const entries = entriesIn(view);
  const mine = entries.filter((entry) => entry.stream === stream);
  const headOf = (): string => {
    const heads = headsOf(mine, entries, stream);
    if (heads.length === 0) throw new CallRefusal("msg-absent", `stream ${stream} holds no entry to withdraw`, cureCall("msg", { stream, mu: "?0" }));
    if (heads.length > 1) {
      throw new CallRefusal("stream-forked", `stream ${stream} shows ${heads.length} heads; name the entry the retract withdraws`, heads.map((head) => cureCall("msg", { stream, mu: "00", title: head })).join(" · "));
    }
    return heads[0]!;
  };
  const title = textArg(args, "title") ?? headOf();
  const entry = entries.find((e) => e.title === title);
  if (entry === undefined) throw new CallRefusal("msg-absent", `"${title}" names no entry this view holds`, cureCall("get", { filter: `[lares.heads[${stream}]]` }));
  if (entry.stream !== stream) {
    throw new CallRefusal("msg-not-yours", `"${title}" stands in stream ${entry.stream}; a retract withdraws the caller's own entry, and a reply answers another's`, cureCall("msg", { stream, re: title, note: "<one line>" }));
  }
  const answered: string[] = [];
  view.each((tiddler, held) => { if (held !== title && reOf(tiddler.fields).includes(title)) answered.push(held); });
  if (answered.length > 0) {
    throw new CallRefusal("msg-answered", `${answered.length} record${answered.length === 1 ? "" : "s"} name${answered.length === 1 ? "s" : ""} "${title}" in re (${answered.slice(0, 3).join(", ")}), so it stands in the history; a reply corrects it`, cureCall("msg", { stream, re: title, note: "<the correction>" }));
  }
  const followed = mine.filter((e) => e.prev === title).map((e) => e.title);
  if (followed.length > 0) {
    throw new CallRefusal("msg-followed", `"${title}" stands before ${followed.join(", ")} in its stream; withdraw the head first`, followed.map((next) => cureCall("msg", { stream, mu: "00", title: next })).join(" · "));
  }
  let withheld = 0;
  wiki.each((tiddler, held) => { if (held !== title && !visible(held) && reOf(tiddler.fields).includes(title)) withheld++; });
  const receipt = await del({ ...containerOf(args), title }, ctx);
  const decision = receipt["decision"] === "removed" ? "retracted" : receipt["decision"];
  return {
    ...receipt,
    has: hasLine(title, [param("stream", stream), param("decision", String(decision)), param("withheld", withheld)], "a msg withdrawn before any reply named it"),
    recipe, stream, title, decision, withheld,
  };
}

/** THE LANDING: the root where none stands, then the entry, both through the put law; a dry carry lands nothing. */
async function land(opts: TiddlerVerbOptions, put: VerbReactor, args: Readonly<Record<string, unknown>>, ctx: VerbContext): Promise<Record<string, unknown>> {
  const stream = streamOf(args);
  const note = typeof args["note"] === "string" ? args["note"].trim() : "";
  const fault = noteFault(note);
  if (fault !== null) {
    const cut = [...note.replace(/[\r\n]+/g, " ")].slice(0, NOTE_MAX).join("").trim();
    const why = fault === "note-needed" ? "a msg lands one line of note" : fault === "note-one-line" ? "a note holds one line" : `a note holds ${NOTE_MAX} characters or fewer (this one holds ${[...note].length}); a longer thought rides about= as a pointer`;
    throw new CallRefusal(fault, why, cureCall("msg", { stream, note: cut === "" ? "<one line>" : cut }));
  }
  const to = textArg(args, "to");
  if (to !== null && !isAddress(to)) {
    throw new CallRefusal("to-malformed", `"${to}" reads no address: to names an entity (lares-alpha) or one instance (lares-alpha#00003)`, cureCall("msg", { stream, to: "<pet>", note }));
  }
  const about = lineOf(args, "about", "about");
  const re = listArg(args["re"]);
  const { recipe, view } = await readerViewOf(opts, args, ctx, "msg");
  const entries = entriesIn(view);
  const mine = entries.filter((entry) => entry.stream === stream);
  let prev = textArg(args, "prev");
  if (prev !== null) {
    if (!mine.some((entry) => entry.title === prev)) {
      throw new CallRefusal("prev-unknown", `"${prev}" names no entry of stream ${stream} this view holds`, cureCall("get", { filter: `[lares.heads[${stream}]]` }));
    }
  } else {
    const heads = headsOf(mine, entries, stream);
    if (heads.length > 1) throw new CallRefusal("stream-forked", `stream ${stream} shows ${heads.length} heads (${heads.join(", ")}); name the one this msg follows`, forkCure(stream, heads, note));
    prev = heads[0] ?? null;
  }
  const h8 = birthHashOf({ stream, prev, re, to, about, note });
  const title = entryTitleOf(stream, h8, slugOf(textArg(args, "slug") ?? note));
  const fields: Record<string, string> = { stream, note };
  if (prev !== null) fields["prev"] = prev;
  if (re.length > 0) fields["re"] = stringifyList(re);
  if (to !== null) fields["to"] = to;
  if (about !== null) fields["about"] = about;
  for (const [arg, field] of PANEL) { const value = lineOf(args, arg, field); if (value !== null) fields[field] = value; }
  const root = streamRootOf(stream);
  const founds = view.getTiddler(root) === undefined;
  const rootFields: Record<string, string> = { stream };
  const worn = ctx.worn?.group ?? ctx.worn?.presenter ?? ctx.presenter;
  if (typeof worn === "string" && worn !== "") rootFields["face"] = worn;
  for (const key of ROOT_FIELDS) { const value = lineOf(args, key, key); if (value !== null) rootFields[key] = value; }
  const container = containerOf(args);
  const dry = typeof args["dry"] === "string" ? args["dry"] : null;
  const answer = (receipt: Record<string, unknown>, extra: Record<string, unknown> = {}): Record<string, unknown> => ({
    ...receipt,
    has: hasLine(title, [param("stream", stream), ...(prev !== null ? [param("prev", prev)] : []), ...(to !== null ? [param("to", to)] : []), param("h8", h8)], note),
    recipe, stream, title, prev, root, founded: founds && dry === null, ...extra,
  });
  if (dry !== null) {
    const receipt = await put({ ...container, title, fields, create: true, dry }, ctx);
    return answer(receipt, { founds });
  }
  // THE ROOT FIRST, where none stands: a second writer racing the founding meets `exists`, and the entry lands beside it.
  if (founds) await put({ ...container, title: root, fields: rootFields, create: true }, ctx);
  else if (ROOT_FIELDS.some((key) => rootFields[key] !== undefined)) {
    const named = Object.fromEntries(ROOT_FIELDS.filter((key) => rootFields[key] !== undefined).map((key) => [key, rootFields[key]!]));
    await put({ ...container, title: root, fields: named }, ctx);
  }
  return answer(await put({ ...container, title, fields, create: true }, ctx));
}

/** The msg door over one wiki's engine: inbox, retract, or a landing, as the call's depth names it. */
export function makeMsgReactor(opts: TiddlerVerbOptions): VerbReactor {
  const put = makeTiddlerPutReactor(opts);
  const del = makeTiddlerDeleteReactor(opts);
  return async (args, ctx) => {
    if (args["read"] === "inbox") return readInbox(opts, args, ctx);
    if (args["retract"] === true) return retract(opts, del, args, ctx);
    return land(opts, put, args, ctx);
  };
}

/**
 * THE MSG DOOR'S SEAT IN THE CALL REGISTRY: `lar:///engine.msg.lands` answers through the daemon verb `msg`. The depth folds into
 * the reactor's args: `?` reads the inbox, `0` retracts, a dry carry (`_`, `_?`, `_!`) walks the landing dry. Any other carry a
 * layer above tables refuses `mu-cell-empty` and names the plain call, so a depth never lands as a write.
 */
export const MSG_CALL_SEATS: Readonly<Record<string, CallSeat>> = Object.freeze({
  [MSG_ADDRESS]: {
    verb: "msg",
    dry: true,
    fold: ({ mu, ...rest }) => {
      if (typeof mu !== "string") return rest;
      const depth = dryDepthOf(mu);
      if (depth !== null) return { ...rest, dry: depth };
      if (mu === "?") return { ...rest, read: "inbox" };
      if (mu === "0") return { ...rest, retract: true };
      const stream = typeof rest["stream"] === "string" ? { stream: rest["stream"] } : {};
      throw new CallRefusal("mu-cell-empty", `the msg door answers ?0 (the inbox), 00 (a retract) and the dry depths, and ${mu} (${muWordsOf(mu)}) names none, so it lands nothing`, cureCall("msg", stream));
    },
  },
});
