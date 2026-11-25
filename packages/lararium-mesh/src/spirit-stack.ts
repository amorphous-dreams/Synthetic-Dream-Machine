/**
 * spirit-stack — ONE SPIRIT RECORD AND THE STACK OF WHAT IT HOLDS: the pure core under the spirit door's `#/has` slot.
 *
 * THE ONE RECORD. Every spirit answers at `lar:///ha.ka.ba/lares/spirit/<pet>`: a nameless entity the house names by its pet
 * name, holding a stack of what it holds, in the seed's own shape (`<<~ has entity=`spirit` name=`<pet>` params=`…`>>`). The three
 * kinds (familiar, tasked, masked) read as PROFILES off the caps a record holds, never as three record shapes; a spirit may hold
 * several at once. The records that stood before the one address (`familiar/<pet>`, `spirit/<pet>`, `spirit-card/<pet>`,
 * `mask-card/<pet>` on the memory stage) read through the same stack: each legacy address signs its profile's cap, and no
 * record moves.
 *
 * THE STACK, IN TWO GRAINS A FILTER CAN GATHER. A CAP rides as a three-term `lar:///` address in the record's `tags` and, where
 * the table below names one, a value in a field; every other field the record holds rides as plain metadata, so the stack
 * derives from the record and never from a list. TAGS GATHER, OCAPS AUTHORIZE (the affordance map's first law): a cap on the
 * stack names what the spirit holds and grants nothing; authority rides a lei the hand strings.
 *
 * THE SLOT. The stack reads and writes as the slot `#/has`, one cap per line (`<address> <value>`), so the door's own slot
 * verbs carry it: om reads it, `ah --add` strings one cap, `hum --fold` unstrings one.
 *
 * A SEALED HOLD NAMES ITSELF AND NOTHING MORE: a field named in `sealed` never rides the stack line.
 *
 * Platform-blind and pure: no door, no clock, no env.
 *
 * Design: lar:///ha.ka.ba/kahua/memory/research/alana-reweave · ruling: lar:///ha.ka.ba/kahua/memory/ruling/2026-11-25-one-spirit-record
 */

/** Where every spirit's one record stands. */
export const SPIRIT_PREFIX = "lar:///ha.ka.ba/lares/spirit/";
/** The one record a pet name answers at. */
export const spiritOf = (pet: string): string => `${SPIRIT_PREFIX}${pet}`;
/** The slot the stack reads and writes as. */
export const STACK_SLOT = "#/has";

export const SPIRIT_PROFILES = ["familiar", "tasked", "masked"] as const;
export type SpiritProfile = (typeof SPIRIT_PROFILES)[number];
/** Who strings a cap: a person's hand, the door's own act (never the slot verbs), or any body. */
export type CapHolder = "hand" | "door" | "body";

export interface SpiritCapKind {
  /** The cap's address: the tag a filter gathers by. */
  readonly cap: string;
  /** The field that carries the cap's value. */
  readonly field: string;
  /** The profile this cap signs, where it signs one. */
  readonly profile: SpiritProfile | null;
  readonly held: CapHolder;
}

/** THE CAPS THE HOUSE NAMES, in the order a stack reads them. Any other three-term address rides as a bare tag (a feed). */
export const SPIRIT_CAPS: readonly SpiritCapKind[] = Object.freeze([
  { cap: "lar:///spirit.face.serves", field: "face", profile: "familiar", held: "hand" },
  { cap: "lar:///spirit.lane.holds", field: "lane", profile: "tasked", held: "hand" },
  { cap: "lar:///spirit.canon.transcludes", field: "canon", profile: "masked", held: "hand" },
  { cap: "lar:///spirit.mandate.offers", field: "mandate-hash", profile: null, held: "door" },
  { cap: "lar:///spirit.grant.attenuates", field: "grant", profile: null, held: "hand" },
  { cap: "lar:///spirit.message.receives", field: "inbox", profile: null, held: "hand" },
  { cap: "lar:///spirit.message.sends", field: "outbox", profile: null, held: "hand" },
] as const);

const TERM = "[a-z0-9]+(?:-[a-z0-9]+)*";
/** A cap's address: a three-term root and no path (the root segment law). */
export const CAP_ADDRESS = new RegExp(`^lar:///${TERM}\\.${TERM}\\.${TERM}$`);
const kindOf = (cap: string): SpiritCapKind | undefined => SPIRIT_CAPS.find((k) => k.cap === cap);
/** Who strings this cap: the table's holder, and any body for a bare tag. */
export const capHolder = (cap: string): CapHolder => kindOf(cap)?.held ?? "body";

/** The memory-stage addresses that stood before the one record, each with the cap its address signs. */
const STAGE = "lar:///ha.ka.ba/kahua/memory/";
export const LEGACY_SEATS: ReadonlyArray<{ readonly prefix: string; readonly signs: string }> = Object.freeze([
  { prefix: `${STAGE}familiar/`, signs: "lar:///spirit.face.serves" },
  { prefix: `${STAGE}spirit/`, signs: "lar:///spirit.lane.holds" },
  { prefix: `${STAGE}spirit-card/`, signs: "lar:///spirit.lane.holds" },
  { prefix: `${STAGE}mask-card/`, signs: "lar:///spirit.canon.transcludes" },
]);
/** The cap a record's own address signs: a legacy address signs its profile's; the one address signs none. */
export const seatedCap = (uri: string): string | null => LEGACY_SEATS.find((s) => uri.startsWith(s.prefix))?.signs ?? null;
/** The mask card a pet name's fields rest on, before the one record. */
export const maskCardOf = (pet: string): string => `${STAGE}mask-card/${pet}`;

// ── the tags ───────────────────────────────────────────────────────────────────────────────────────────────────────

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

// ── the stack ──────────────────────────────────────────────────────────────────────────────────────────────────────

export interface SpiritHold {
  readonly cap: string;
  /** The field that carries the value; null for a bare tag. */
  readonly field: string | null;
  readonly value: string;
  /** Does the cap's address stand in `tags` (so a filter gathers it)? A legacy field or seat alone reads untagged. */
  readonly tagged: boolean;
  /** The record's own address signs this cap (a legacy seat): it leaves when the record moves, never by an unstring. */
  readonly seated: boolean;
  readonly held: CapHolder;
  readonly profile: SpiritProfile | null;
}

const oneLine = (value: string): string => value.replace(/\s+/g, " ").trim();

/**
 * THE STACK A RECORD HOLDS, read off its fields and its address: each named cap stands where its tag stands, its field holds
 * a value, or the record's own (legacy) address signs it; every other three-term address in `tags` stands as a bare cap.
 */
export function stackOf(fields: Readonly<Record<string, string>>, uri: string): SpiritHold[] {
  const tags = tagsOf(fields["tags"]);
  const seat = seatedCap(uri);
  const named = SPIRIT_CAPS.flatMap((k): SpiritHold[] => {
    const value = String(fields[k.field] ?? "");
    const tagged = tags.includes(k.cap);
    const seated = seat === k.cap;
    return tagged || seated || value.trim() !== "" ? [{ cap: k.cap, field: k.field, value, tagged, seated, held: k.held, profile: k.profile }] : [];
  });
  const bare = tags.filter((t) => CAP_ADDRESS.test(t) && kindOf(t) === undefined)
    .map((cap): SpiritHold => ({ cap, field: null, value: "", tagged: true, seated: false, held: "body", profile: null }));
  return [...named, ...bare];
}

/** The profiles a stack signs, in the house's order; a spirit may hold several. */
export const profilesOf = (stack: readonly SpiritHold[]): SpiritProfile[] =>
  SPIRIT_PROFILES.filter((p) => stack.some((h) => h.profile === p));

/** The stack as the `#/has` slot's body: one cap per line, its address and its value on one line. */
export const stackBody = (stack: readonly SpiritHold[]): string =>
  stack.map((h) => (oneLine(h.value) === "" ? h.cap : `${h.cap} ${oneLine(h.value)}`)).join("\n");

/** One `#/has` line read: a cap's address (`lar:///a.b.c`, or bare `a.b.c`) and the value that follows it. Null where it names none. */
export function capLine(line: string): { cap: string; value: string } | null {
  const m = /^(\S+)(?:\s+([\s\S]*))?$/.exec(line.trim());
  if (!m) return null;
  const cap = m[1]!.startsWith("lar:///") ? m[1]! : `lar:///${m[1]!}`;
  return CAP_ADDRESS.test(cap) ? { cap, value: oneLine(m[2] ?? "") } : null;
}

export type StackRefusal = { readonly code: "spirit-cap-malformed" | "spirit-cap-seated"; readonly why: string };
export interface StackWrite { readonly patch: Record<string, string>; readonly unset: string[] }

/**
 * THE WRITE A `#/has` BODY ASKS over the fields read: each line's cap gains its tag and (a named cap) its field; a cap the
 * body leaves out loses both. A later line for one cap wins, so an `--add` over a standing cap trues its value. Null where the
 * body asks nothing new; a refusal where a line names no cap, a bare cap carries a value, or the body drops a cap the
 * record's own address signs.
 */
export function stackWrite(fields: Readonly<Record<string, string>>, uri: string, body: string): StackWrite | StackRefusal | null {
  const wanted = new Map<string, string>();
  for (const raw of body.split("\n")) {
    if (raw.trim() === "") continue;
    const read = capLine(raw);
    if (read === null) return { code: "spirit-cap-malformed", why: `"${oneLine(raw).slice(0, 80)}" names no cap: a line reads \`<a.b.c> <value>\`, a three-term address then its value` };
    if (kindOf(read.cap) === undefined && read.value !== "") return { code: "spirit-cap-malformed", why: `${read.cap} rides as a bare tag and carries no value; a value rides one of ${SPIRIT_CAPS.map((k) => k.cap).join(" ")}` };
    wanted.set(read.cap, read.value);
  }
  const standing = stackOf(fields, uri);
  const tags = tagsOf(fields["tags"]);
  const next = [...tags];
  const patch: Record<string, string> = {};
  const unset: string[] = [];
  for (const [cap, value] of wanted) {
    const kind = kindOf(cap);
    if (!next.includes(cap)) next.push(cap);
    if (kind !== undefined && oneLine(String(fields[kind.field] ?? "")) !== value) {
      if (value === "") { if (fields[kind.field] !== undefined) unset.push(kind.field); } else patch[kind.field] = value;
    }
  }
  for (const hold of standing) {
    if (wanted.has(hold.cap)) continue;
    if (hold.seated) return { code: "spirit-cap-seated", why: `${hold.cap} rides the record's own address (${uri}); it leaves when the record moves to ${SPIRIT_PREFIX}<pet>, never by an unstring` };
    const at = next.indexOf(hold.cap);
    if (at >= 0) next.splice(at, 1);
    if (hold.field !== null && fields[hold.field] !== undefined) unset.push(hold.field);
  }
  if (tagsText(next) !== tagsText(tags)) {
    if (next.length === 0) unset.push("tags"); else patch["tags"] = tagsText(next);
  }
  return Object.keys(patch).length === 0 && unset.length === 0 ? null : { patch, unset };
}

// ── the stack line ─────────────────────────────────────────────────────────────────────────────────────────────────

/** The fields a stack line never carries as metadata: the record's envelope, the door's bookkeeping, and every cap's own field. */
const ENVELOPE: ReadonlySet<string> = new Set([
  "title", "text", "tags", "type", "pet", "description", "role", "created", "modified", "creator", "modifier", "revision", "bag",
  "cacheable", "l-space", "namespace", "status", "uri-path", "spirit-id", "slot-budget", "record-budget", "true-up-every", "distilled", "aliases", "sealed", "offer-seq", "offered-by",
  ...SPIRIT_CAPS.map((k) => k.field),
]);
/** A metadata value past this many characters cuts in the stack line; the record keeps it whole. */
export const STACK_VALUE_CHARS = 72;

const quoted = (value: string): string => (value.includes("`") ? `\`\`\`${value}\`\`\`` : `\`${value}\``);
const cut = (value: string): string => { const v = oneLine(value); return v.length <= STACK_VALUE_CHARS ? v : `${v.slice(0, STACK_VALUE_CHARS - 1)}…`; };
const param = (key: string, value: string): string => { const v = cut(value); return `${key}/${/\s/.test(v) ? `[[${v}]]` : v}`; };
/** A cap's short name in the stack line: its facet and its verb (`spirit.lane.holds` -> `lane.holds`), a foreign domain's whole. */
const capName = (cap: string): string => { const root = cap.slice("lar:///".length); return root.startsWith("spirit.") ? root.slice("spirit.".length) : root; };

/**
 * THE WHOLE STACK AS ONE LINE, in the seed's own shape: `<<~ has entity=`spirit` name=`<pet>` params=`…`>>`. The params read
 * the profiles (`kind/…`), each cap with its value, then every other field the record holds as plain metadata; a field the
 * record seals (`sealed` names them) rides as its name alone, so the line never carries a sealed value.
 */
export function stackLine(pet: string, fields: Readonly<Record<string, string>>, uri: string): string {
  const stack = stackOf(fields, uri);
  const sealed = new Set(tagsOf(fields["sealed"]));
  const profiles = profilesOf(stack);
  const caps = stack.map((h) => (h.field !== null && sealed.has(h.field) ? `${capName(h.cap)}/sealed` : oneLine(h.value) === "" ? capName(h.cap) : param(capName(h.cap), h.value)));
  const meta = Object.keys(fields).filter((k) => !ENVELOPE.has(k) && !k.startsWith("$") && !k.startsWith("writer-") && !sealed.has(k) && String(fields[k] ?? "").trim() !== "")
    .sort().map((k) => param(k, String(fields[k])));
  const tail = oneLine(String(fields["role"] ?? fields["description"] ?? ""));
  const params = [
    ...(profiles.length > 0 ? [`kind/${profiles.join("+")}`] : []), ...caps, ...meta, ...[...sealed].sort().map((k) => `${k}/sealed`),
    ...(tail === "" ? [] : [`~ ${tail.length > 160 ? `${tail.slice(0, 157)}...` : tail}`]),
  ].join(" ");
  return `<<~ has entity=\`spirit\` name=\`${pet}\` params=${quoted(params)}>>`;
}
