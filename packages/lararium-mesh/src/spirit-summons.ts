/**
 * spirit-summons — the pure core of a mandate summons: the house starts its own arms.
 *
 * A coordinator lands a MANDATE (natural language inside a memetic carrier) on the worn face's memory stage; the house starts
 * the instance through a host launch cap with ONE line, and the instance reads everything else from the house. Three records
 * share one shape (research/spirit-talk-as-records): hash-keyed, idempotent on retry, parent-linked.
 *
 *   mandate   `kahua/memory/mandate/<id16>`   tag `mandate`; `mandate-hash` over its own fields and words; `parent` names
 *                                             the offering coordinator's mandate (`<uri>@<hash>`), absent where a hand offers
 *                                             A CARRIER MANDATE FOUNDS ITS FAMILY as any carrier does: its fields ride the
 *                                             carrier's own `toml meta`, `mandate-seed` (the offer's hash) names its address,
 *                                             and its hash reads the recomposed carrier: the family's canonical hash
 *   edge      `kahua/memory/summons/<id16>`   tag `summons`; `parent` names the mandate; {offerer, instance, mandate-hash,
 *                                             face, launched, handback}: the ley-line inside the house
 *   lanes     `kahua/memory/lanes/<pet>/<n>`  tag `summons-lanes`; `holds` lists the edges holding a coordinator's arm lanes, one
 *                                             per line. Every claim and release rides the door's compare-and-set (`create`
 *                                             where none stands, `base` where one does), so two summonses never share a lane
 *   hand-back any record the instance landed; the edge names it as `<uri>@<hash>`, and the lane it held frees
 *
 * `<id16>` reads the first 16 hex of the mandate's hash, so a retry finds the mandate and the edge standing and starts no
 * second instance. No clock decides here: order rides the parent links, and a stamp (`launched-at`) annotates alone.
 *
 * THE ONE LINE (`wakeLine`): `wake as <pet>#<n>: lares spirit om <pet> mandate=<uri>@<hash> [face=<N>]`. The launch cap
 * (`tools/summon-launch.mjs`) refuses any prompt outside that shape, so a host process starts only pointed at a hash-pinned
 * mandate. `WAKE_LINE` holds the shape; the host tool carries the same pattern, and a weld test in each suite reads the other's
 * (the tool's suite imports this built core, this core's suite runs `wakeLine` through the tool).
 *
 * Plans: lar:///ha.ka.ba/kahua/memory/plan/mandate-summons · lar:///ha.ka.ba/kahua/memory/plan/companion-context
 */
import { sha256HexSync } from "./crypto.js";
import { INSTANCE_ID, MANDATE_HASH, MEMORY_PREFIX, PET_NAME, SpiritRefusal, shq } from "./spirit-shrine.js";

export const MANDATE_WORD = "mandate" as const;
export const SUMMONS_WORD = "summons" as const;
/** The tag each record gathers under. */
export const MANDATE_TAG = MANDATE_WORD;
export const SUMMONS_TAG = SUMMONS_WORD;
/** The grant a coordinator's mandate carries before a seat starts a process under it. */
export const SUMMONS_GRANT = "summons" as const;
/** The launch caps the house names; the host tool holds the same table. */
export const LAUNCH_CAPS = ["claude-cli"] as const;
export type LaunchCap = (typeof LAUNCH_CAPS)[number];
export const DEFAULT_LAUNCH_CAP: LaunchCap = "claude-cli";
/** A model's slug as a launch cap takes it: it leads with a letter or digit, so it never reads as a flag. */
export const MODEL_SLUG = /^[A-Za-z0-9][A-Za-z0-9._:[\]-]{0,63}$/;
/** A face a mandate names: a handle index. */
export const FACE_INDEX = /^(0|[1-9][0-9]{0,5})$/;
/** A host path a mandate names (`workdir`, `log`): absolute, one word, so it rides an argv and a field whole. */
export const HOST_PATH = /^\/[^\s\0]{0,1023}$/;
/**
 * THE GUEST'S REACH: what a summoned instance holds where its mandate names nothing, the one table the operator widens. A guest
 * at the hearth receives what a spirit on a bench already works with: the house's doors, the ordinary file tools, and the shell
 * for git, node and pnpm in its workdir. Hand acts (a route, a lei's stringing, a promote, a kāpae's y, the vault) sit outside
 * every seat already, so no entry here reaches them: the doors read custody on each act.
 */
export const GUEST_REACH = ["Bash(lares:*)", "Bash(git:*)", "Bash(node:*)", "Bash(pnpm:*)", "Read", "Edit", "Write", "Grep", "Glob"] as const;
/** A mandate's `allowed-tools` leading with this mark WIDENS the guest's reach (the union); a bare list names the reach exactly. */
export const REACH_WIDENS = "+" as const;
/** A reach as a launch carries it: comma-joined `Tool` or `Tool(spec)`; the host launch tool matches the same source. */
export const ALLOWED_TOOLS = /^[A-Za-z][A-Za-z0-9_]{0,63}(?:\([^(),\n]{1,200}\))?(?:,[A-Za-z][A-Za-z0-9_]{0,63}(?:\([^(),\n]{1,200}\))?){0,63}$/;
/** The one line a launch carries, as a pattern: `wakeLine` writes it and the host launch tool matches the same source. */
export const WAKE_LINE = /^wake as ([a-z0-9][a-z0-9-]{0,62})#([A-Za-z0-9_-]{1,128}): lares spirit om ([a-z0-9][a-z0-9-]{0,62}) mandate=(lar:\/\/\/[^\s@]+)@([0-9a-f]{64})(?: face=(0|[1-9][0-9]{0,5}))?$/;

/**
 * THE FIELDS A MANDATE'S HASH COVERS, in the order the hash reads them. `reads` (TW5 filters) and `links` (titles) hold one
 * entry per line; `paths`, `caps` and `grants` hold words. `lanes` names the arm-lane ceiling a COORDINATOR's mandate grants its
 * own summonses; `handback-shape` names what the instance hands back. `workdir` names the host directory the instance starts in and
 * `log` the host file its stream appends to: both ride the hash, so the same mandate starts in the same place. `allowed-tools`
 * shapes the reach the launch grants: none named, the instance holds `GUEST_REACH`; a bare list names the reach exactly (a
 * coordinator narrows for a reader); a list led by `+` widens the guest's reach by its rules (a coordinator widens for a builder).
 */
export const MANDATE_FIELDS = ["pet", "instance", "offerer", "parent", "face", "model", "launch-cap", "allowed-tools", "workdir", "log", "reads", "links", "paths", "caps", "grants", "lanes", "handback-shape"] as const;
export type MandateField = (typeof MANDATE_FIELDS)[number];

/** `<pet>#<n>`: an instance by its tag. */
export interface InstanceTag { readonly pet: string; readonly instance: string; readonly tag: string }
export function instanceTagOf(word: string | null | undefined): InstanceTag | null {
  const m = /^([^#\s]+)#([^#\s]+)$/.exec(String(word ?? ""));
  if (!m || !PET_NAME.test(m[1]!) || !INSTANCE_ID.test(m[2]!)) return null;
  return { pet: m[1]!, instance: m[2]!, tag: `${m[1]}#${m[2]}` };
}

/** `<uri>@<hash>`: a record named with the hash its reader holds; the hash rides optional on a line a hand types. */
export interface RecordRef { readonly uri: string; readonly hash: string | null }
export function recordRefOf(word: string | null | undefined): RecordRef | null {
  const raw = String(word ?? "").trim();
  const at = raw.lastIndexOf("@");
  const uri = at > 0 ? raw.slice(0, at) : raw;
  const hash = at > 0 ? raw.slice(at + 1) : null;
  if (!uri.startsWith("lar:///") || /\s/.test(uri) || (hash !== null && !MANDATE_HASH.test(hash))) return null;
  return { uri, hash };
}
export const refLine = (uri: string, hash: string): string => `${uri}@${hash}`;

/**
 * The words a mandate's hash reads: each covered field that holds a value, in `MANDATE_FIELDS` order, then the words with their
 * trailing whitespace left out (a store that trims a text's tail moves no hash).
 */
export function mandateCanon(fields: Readonly<Record<string, string | undefined>>, text: string): string {
  const lines = MANDATE_FIELDS.flatMap((name) => {
    const value = (fields[name] ?? "").trim();
    return value === "" ? [] : [`${name}=${JSON.stringify(value)}`];
  });
  return `${lines.join("\n")}\n\n${text.replace(/\s+$/, "")}`;
}
/** A mandate's hash: the sha256 of its covered fields and its words. Same mandate, same hash, same wake. */
export const mandateHashOf = (fields: Readonly<Record<string, string | undefined>>, text: string): string => sha256HexSync(mandateCanon(fields, text));
/**
 * THE FIELD A CARRIER MANDATE'S ADDRESS KEYS ON: the offer's own hash (`mandateHashOf` over the covered fields and the carrier
 * as offered), written into the carrier's meta. A carrier names its own address in its head and meta, so no hash over the
 * landed carrier could also name that address; the seed names where the family stands, and the family's canonical hash names
 * what it holds.
 */
export const MANDATE_SEED = "mandate-seed" as const;
/**
 * The affordances a carrier's own meta may name (a flag naming the same one outranks it). Who the mandate summons, who offers
 * it, under which coordinator and face stay the door's to write: `pet`, `instance`, `offerer`, `parent`, `face`.
 */
export const MANDATE_AFFORDANCES: readonly MandateField[] = ["model", "launch-cap", "allowed-tools", "workdir", "log", "reads", "links", "paths", "caps", "grants", "lanes", "handback-shape"];
/** Where a mandate rests: keyed by its own hash. */
export const mandateOf = (hash: string): string => `${MEMORY_PREFIX}${MANDATE_WORD}/${hash.slice(0, 16)}`;
/** Where the edge of a summons rests: keyed by the mandate's hash. */
export const summonsOf = (hash: string): string => `${MEMORY_PREFIX}${SUMMONS_WORD}/${hash.slice(0, 16)}`;

const wordsOf = (raw: string | undefined): string[] => String(raw ?? "").split(/\s+/).filter((w) => w !== "");
const linesOf = (raw: string | undefined): string[] => String(raw ?? "").split("\n").map((l) => l.trim()).filter((l) => l !== "");

export interface SpiritMandate {
  readonly uri: string; readonly hash: string; readonly pet: string; readonly instance: string; readonly tag: string;
  /** `hand`, or the coordinator's instance tag (`<pet>#<n>`). */
  readonly offerer: string;
  /** The coordinator's own mandate, `<uri>@<hash>`; null where a hand offered. */
  readonly parent: RecordRef | null;
  /** The face the mandate echoes (a handle index); null where it names none. */
  readonly face: number | null;
  readonly model: string | null; readonly launchCap: string;
  /** The mandate's own word on its reach: a bare list (exact), a `+` list (widens the guest's reach), or null (the guest's reach). `launchReach` resolves it. */
  readonly allowedTools: string | null;
  /** The host directory the instance starts in; null: the summoner's own. */
  readonly workdir: string | null;
  /** The host file the instance's stream appends to; null: the stream lands nowhere. */
  readonly log: string | null;
  readonly reads: readonly string[]; readonly links: readonly string[]; readonly paths: readonly string[]; readonly caps: readonly string[];
  readonly grants: readonly string[];
  /** The arm-lane ceiling this mandate grants its holder's own summonses; a mandate naming none reads zero. */
  readonly lanes: number;
  readonly handbackShape: string; readonly text: string;
  /** True where the mandate stands as a carrier family: `hash` names the family's canonical hash and `text` the recomposed carrier. */
  readonly family: boolean;
}

/**
 * A carrier mandate's family as the meme lens answers it: the recomposed carrier (`text`), the canonical hash the door names
 * for it, and whether `text` holds the whole carrier (a carrier past one page answers its first page, and the door's hash
 * speaks for the rest).
 */
export interface MandateCarrier { readonly text: string; readonly canonicalHash: string; readonly whole: boolean }
/** The 64 hex of a canonical hash (`sha256:<hex>`, a partial or card base that ends in one); empty where the word names none. */
const canonicalHex = (base: string): string => /sha256[:-]([0-9a-f]{64})$/.exec(base)?.[1] ?? "";
/** The hash a carrier mandate reads by: the sha256 of the recomposed carrier, which the family's canonical hash also names. */
export const mandateCarrierHash = (carrier: MandateCarrier): string => (carrier.whole ? sha256HexSync(carrier.text) : canonicalHex(carrier.canonicalHash));

/** The record a mandate lands as: its title, its fields (hash, tag and description among them) and its words. */
export function mandateWrite(covered: Readonly<Partial<Record<MandateField, string>>>, text: string): { uri: string; hash: string; text: string; fields: Record<string, string> } {
  const kept: Record<string, string> = {};
  for (const name of MANDATE_FIELDS) { const value = (covered[name] ?? "").trim(); if (value !== "") kept[name] = value; }
  const hash = mandateHashOf(kept, text);
  return {
    uri: mandateOf(hash), hash, text,
    fields: { ...kept, "mandate-hash": hash, tags: MANDATE_TAG, description: mandateDescription(kept) },
  };
}

/**
 * WHERE A CARRIER MANDATE FOUNDS ITS FAMILY, and the fields its meta carries. `offered` reads the carrier as the offerer gave
 * it; the seed hashes the covered fields and those bytes, so the same offer finds the same address. The door binds the
 * carrier's head and meta to `uri`, writes `meta` into its `toml meta` block and puts the carrier alone: the put founds the
 * family, and no field rides beside it (`carrier-speaks-whole`).
 */
export function mandateFound(covered: Readonly<Partial<Record<MandateField, string>>>, offered: string): { uri: string; seed: string; meta: Record<string, string> } {
  const kept: Record<string, string> = {};
  for (const name of MANDATE_FIELDS) { const value = (covered[name] ?? "").trim(); if (value !== "") kept[name] = value; }
  const seed = mandateHashOf(kept, offered);
  return { uri: mandateOf(seed), seed, meta: { ...kept, [MANDATE_SEED]: seed } };
}
/** The description a mandate's record carries. */
export const mandateDescription = (fields: Readonly<Record<string, string | undefined>>): string =>
  `mandate for ${fields["pet"] ?? "?"}#${fields["instance"] ?? "?"}, offered by ${fields["offerer"] ?? "?"}: the summons, its affordances and the hand-back it asks`;

/**
 * A mandate read off its record, verified. `named` carries the hash the caller holds (the `@<hash>` of its ref). A record whose
 * words or covered fields moved since its hash landed, or whose hash names another than the caller's, refuses `mandate-moved`;
 * no record refuses `mandate-unknown`.
 *
 * A CARRIER MANDATE READS AS ITS FAMILY (`mandate-seed` on the root): `carrier` hands the recomposed carrier the meme lens
 * answered, and the mandate's hash reads that carrier's own sha256, the hash the family holds as its canonical one. A slot
 * that moved, a field that moved in the meta, a slot that joined or left: each moves the recompose, so the hash the caller
 * names stops answering and the read refuses `mandate-moved`. A line naming no hash reads the family as it stands now.
 */
export function mandateRead(uri: string, fields: Readonly<Record<string, string>>, named: string | null, carrier: MandateCarrier | null = null): SpiritMandate {
  const stored = fields["mandate-hash"];
  const seed = fields[MANDATE_SEED];
  if (stored === undefined && seed === undefined) {
    throw new SpiritRefusal("mandate-unknown", `mandate-unknown: no mandate stands at ${uri} under the face that answered; nothing started. List the mandates this face holds: \`lares get filter='[tag[${MANDATE_TAG}]]'\``, 4);
  }
  const again = `Its offerer lands the mandate again and names the ref that answer prints: \`lares spirit mandate ${fields["pet"] ?? "<pet>"}#${fields["instance"] ?? "<n>"} file=<carrier>\``;
  let hash: string;
  let text: string;
  if (seed !== undefined) {
    // THE FAMILY'S OWN TRUTH: the recomposed carrier, hashed as the family hashes it.
    const live = carrier === null ? "" : mandateCarrierHash(carrier);
    if (carrier === null || !MANDATE_HASH.test(live) || !MANDATE_HASH.test(seed) || mandateOf(seed) !== uri || (named !== null && named !== live)) {
      const why = carrier === null || !MANDATE_HASH.test(live) ? "its root no longer reads as a carrier family"
        : !MANDATE_HASH.test(seed) || mandateOf(seed) !== uri ? `its seed ${String(seed).slice(0, 12)} names another address`
        : `its family reads ${live.slice(0, 12)} now, and the line names ${named!.slice(0, 12)}`;
      throw new SpiritRefusal("mandate-moved", `mandate-moved: ${uri} moved since its hash landed (${why}); nothing started. ${again}`, 4);
    }
    hash = live;
    text = carrier.text;
  } else {
    text = fields["text"] ?? "";
    const live = mandateHashOf(fields, text);
    if (stored === undefined || !MANDATE_HASH.test(stored) || live !== stored || (named !== null && named !== stored) || mandateOf(stored) !== uri) {
      const why = live !== stored ? `its words or fields read ${live.slice(0, 12)} now, and its hash names ${String(stored).slice(0, 12)}`
        : named !== null && named !== stored ? `it holds ${String(stored).slice(0, 12)}, and the line names ${named.slice(0, 12)}`
        : `its hash ${String(stored).slice(0, 12)} names another address`;
      throw new SpiritRefusal("mandate-moved", `mandate-moved: ${uri} moved since its hash landed (${why}); nothing started. ${again}`, 4);
    }
    hash = stored;
  }
  const tag = instanceTagOf(`${fields["pet"] ?? ""}#${fields["instance"] ?? ""}`);
  if (tag === null) {
    throw new SpiritRefusal("mandate-malformed", `mandate-malformed: ${uri} names no instance (\`pet\` and \`instance\` fields); nothing started. Land it again: \`lares spirit mandate <pet>#<n> file=<carrier>\``, 4);
  }
  const face = FACE_INDEX.test(fields["face"] ?? "") ? Number(fields["face"]) : null;
  const lanes = /^[0-9]{1,4}$/.test(fields["lanes"] ?? "") ? Number(fields["lanes"]) : 0;
  return {
    uri, hash, ...tag, offerer: fields["offerer"] ?? "", parent: recordRefOf(fields["parent"]), face,
    model: (fields["model"] ?? "").trim() || null, launchCap: (fields["launch-cap"] ?? "").trim() || DEFAULT_LAUNCH_CAP,
    allowedTools: (fields["allowed-tools"] ?? "").trim() || null, workdir: (fields["workdir"] ?? "").trim() || null, log: (fields["log"] ?? "").trim() || null,
    reads: linesOf(fields["reads"]), links: linesOf(fields["links"]), paths: wordsOf(fields["paths"]), caps: wordsOf(fields["caps"]),
    grants: wordsOf(fields["grants"]), lanes, handbackShape: fields["handback-shape"] ?? "", text, family: seed !== undefined,
  };
}

/** The mandate names another instance than the line does. */
export function mandateNames(mandate: SpiritMandate, pet: string, instance: string | null): SpiritRefusal | null {
  if (mandate.pet === pet && (instance === null || mandate.instance === instance)) return null;
  return new SpiritRefusal("mandate-names-another", `mandate-names-another: ${mandate.uri} summons ${mandate.tag}, and the line names ${pet}${instance === null ? "" : `#${instance}`}; nothing started. Name the instance the mandate names: \`lares spirit summon ${shq(mandate.tag)} mandate=${refLine(mandate.uri, mandate.hash)}\``, 4);
}

/** The mandate echoes one face, and another answered: the instance wakes under the face its mandate names, never re-homed. */
export function mandateFaceTurned(mandate: SpiritMandate, answered: number | null, line: string): SpiritRefusal | null {
  if (mandate.face === null || answered === null || mandate.face === answered) return null;
  return new SpiritRefusal("mandate-face-turned", `mandate-face-turned: ${mandate.uri} echoes face h${mandate.face}, and h${answered} answered; nothing started. Name the face: \`${line} face=${mandate.face}\``, 4);
}

/** A mandate's `allowed-tools` split into whether it widens and the rules it names. */
const reachWords = (named: string): { widens: boolean; rules: string } =>
  (named.startsWith(REACH_WIDENS) ? { widens: true, rules: named.slice(REACH_WIDENS.length) } : { widens: false, rules: named });
/**
 * THE REACH AN INSTANCE LAUNCHES WITH, comma-joined: the guest's reach where the mandate names none; exactly the mandate's list
 * where it names a bare one; the guest's reach then the mandate's rules it lacks where the list leads with `+`.
 */
export function launchReach(mandate: Pick<SpiritMandate, "allowedTools">): string {
  if (mandate.allowedTools === null) return GUEST_REACH.join(",");
  const { widens, rules } = reachWords(mandate.allowedTools);
  if (!widens) return rules;
  const held: string[] = [...GUEST_REACH];
  for (const rule of rules.split(",")) if (!held.includes(rule)) held.push(rule);
  return held.join(",");
}

/** The launch cap, the model and the host paths a mandate names, checked before any process starts. */
export function launchHolds(mandate: SpiritMandate): SpiritRefusal | null {
  if (!(LAUNCH_CAPS as readonly string[]).includes(mandate.launchCap)) {
    return new SpiritRefusal("launch-cap-unknown", `launch-cap-unknown: ${mandate.uri} names the launch cap "${mandate.launchCap}", and this house holds ${LAUNCH_CAPS.join(", ")}; nothing started. Land the mandate again naming one: \`lares spirit mandate ${shq(mandate.tag)} file=<carrier> cap=${DEFAULT_LAUNCH_CAP}\``, 4);
  }
  if (mandate.model !== null && !MODEL_SLUG.test(mandate.model)) {
    return new SpiritRefusal("mandate-model-malformed", `mandate-model-malformed: ${mandate.uri} names a model no launch cap takes as a slug; nothing started. Land the mandate again: \`lares spirit mandate ${shq(mandate.tag)} file=<carrier> model=<slug>\``, 4);
  }
  if (mandate.allowedTools !== null && !ALLOWED_TOOLS.test(reachWords(mandate.allowedTools).rules)) {
    return new SpiritRefusal("mandate-allowed-tools-malformed", `mandate-allowed-tools-malformed: ${mandate.uri} names allowed tools no launch cap takes as comma-joined rules (\`Tool\` or \`Tool(spec)\`, a leading \`${REACH_WIDENS}\` to widen the guest's reach); nothing started. Land the mandate again: \`lares spirit mandate ${shq(mandate.tag)} file=<carrier> allowed-tools='Bash(lares:*)'\` (or leave the param out for the guest's reach)`, 4);
  }
  for (const [flag, path] of [["workdir", mandate.workdir], ["log", mandate.log]] as const) {
    if (path !== null && !HOST_PATH.test(path)) {
      return new SpiritRefusal("mandate-path-malformed", `mandate-path-malformed: ${mandate.uri} names a ${flag} no host takes as one absolute path with no blank; nothing started. Land the mandate again: \`lares spirit mandate ${shq(mandate.tag)} file=<carrier> ${flag}=/absolute/path\``, 4);
    }
  }
  return null;
}

/**
 * CUSTODY AT HAND-VS-SEAT. A person's hand summons on a receipt. A seat starts a process only under a coordinator's mandate that
 * grants summonses in writing: no parent, or a parent whose `grants` holds no `summons`, refuses `summons-ungranted`.
 */
export function summonsGranted(hand: boolean, mandate: SpiritMandate, coordinator: SpiritMandate | null): SpiritRefusal | null {
  if (hand) return null;
  const line = `lares spirit summon ${shq(mandate.tag)} mandate=${refLine(mandate.uri, mandate.hash)}`;
  if (coordinator === null) {
    return new SpiritRefusal("summons-ungranted", `summons-ungranted: ${mandate.uri} names no coordinator's mandate (offered by ${mandate.offerer || "none"}), and a seat starts a process only under a written grant; nothing started. A person's hand runs the line at a terminal: \`${line}\``, 4);
  }
  if (coordinator.tag !== mandate.offerer) {
    return new SpiritRefusal("summons-ungranted", `summons-ungranted: ${mandate.uri} names ${mandate.offerer || "no offerer"}, and its parent ${coordinator.uri} holds ${coordinator.tag}; nothing started. The coordinator lands the mandate under its own: \`lares spirit mandate ${shq(mandate.tag)} file=<carrier> parent=${refLine(coordinator.uri, coordinator.hash)}\``, 4);
  }
  if (!coordinator.grants.includes(SUMMONS_GRANT)) {
    return new SpiritRefusal("summons-ungranted", `summons-ungranted: ${coordinator.tag}'s mandate ${coordinator.uri} grants no ${SUMMONS_GRANT}, and a seat starts a process only under that written grant; nothing started. A person's hand runs the line at a terminal: \`${line}\` (or lands ${coordinator.tag} a mandate carrying \`grants=${SUMMONS_GRANT} lanes=<n>\`)`, 4);
  }
  return null;
}

/** The filter listing every edge a coordinator holds open: its summonses with no hand-back yet. */
export const openLanesFilter = (coordinator: string): string => `[tag[${SUMMONS_TAG}]field:offerer[${coordinator}]!has[handback]]`;

/**
 * THE LANE CEILING. A coordinator's mandate names how many arm lanes it holds; a summons past it refuses by name. `open` lists
 * the edges its lane ledger holds (this summons's own edge left out, so a retry never counts itself). A ceiling of zero reads as
 * no lane granted, never as unlimited.
 */
export function lanesHold(coordinator: SpiritMandate, open: readonly string[], own: string): SpiritRefusal | null {
  const held = open.filter((title) => title !== own);
  if (held.length < coordinator.lanes) return null;
  const cure = coordinator.lanes === 0
    ? `${coordinator.tag}'s mandate names no lanes, which reads as zero. A hand lands it a mandate naming a ceiling: \`lares spirit mandate ${shq(coordinator.tag)} file=<carrier> grants=${SUMMONS_GRANT} lanes=<n>\``
    : `Wait for a hand-back, which frees its lane: \`lares get filter='${openLanesFilter(coordinator.tag)}'\` lists the arms still out, and each hands back by \`lares spirit handback <pet>#<n> record=<uri>\``;
  return new SpiritRefusal("coordinator-lanes-full", `coordinator-lanes-full: ${coordinator.tag} holds ${held.length} of ${coordinator.lanes} arm lane(s) open; nothing started. ${cure}`, 4);
}

/** The tag a coordinator's lane ledger gathers under. */
export const LANES_TAG = "summons-lanes" as const;
/** Where a coordinator's lane ledger rests: keyed by its instance tag, so a coordinator mandated again keeps the arms it holds out. */
export const lanesOf = (coordinator: Pick<InstanceTag, "pet" | "instance">): string => `${MEMORY_PREFIX}lanes/${coordinator.pet}/${coordinator.instance}`;
/** The edges a ledger names as holding lanes, one per line. */
export const lanesHeld = (fields: Readonly<Record<string, string>>): string[] => linesOf(fields["holds"]);
/** The ledger as it lands: the coordinator, and the edges holding its lanes. */
export function lanesWrite(coordinator: Pick<InstanceTag, "pet" | "instance" | "tag">, held: readonly string[]): { uri: string; fields: Record<string, string> } {
  return {
    uri: lanesOf(coordinator),
    fields: { tags: LANES_TAG, coordinator: coordinator.tag, holds: held.join("\n"), description: `arm lanes ${coordinator.tag} holds out: ${held.length} edge(s)` },
  };
}
/** How many times a claim or release reads the ledger again after another writer moved it; a count, never a wait. */
export const LANE_ROUNDS = 8;

/**
 * ONE STEP OF A LANE CLAIM, pure: given the edges the ledger holds, either this edge already holds its lane (`held`, a retry),
 * or the ceiling refuses (`full`), or the ledger's next `holds` carries it (`claim`). The door lands `claim` under the hash this
 * step read, so a summons that raced another reads the ledger again and meets the ceiling the other already filled.
 */
export type LaneStep = { readonly decision: "held" } | { readonly decision: "full"; readonly refusal: SpiritRefusal } | { readonly decision: "claim"; readonly held: readonly string[] };
export function laneClaim(coordinator: SpiritMandate, held: readonly string[], own: string): LaneStep {
  if (held.includes(own)) return { decision: "held" };
  const refusal = lanesHold(coordinator, held, own);
  return refusal !== null ? { decision: "full", refusal } : { decision: "claim", held: [...held, own] };
}
/** The ledger's next `holds` with this edge's lane freed; null where it holds none (a release run twice moves nothing). */
export const laneRelease = (held: readonly string[], own: string): readonly string[] | null => (held.includes(own) ? held.filter((title) => title !== own) : null);
/** The ledger kept moving under every read: nothing claimed, and the same line claims once the other summonses settle. */
export function laneUnsettled(coordinator: Pick<InstanceTag, "pet" | "instance" | "tag">, line: string): SpiritRefusal {
  return new SpiritRefusal("lane-claim-unsettled", `lane-claim-unsettled: ${coordinator.tag}'s lane ledger ${lanesOf(coordinator)} moved under ${LANE_ROUNDS} reads in a row, so this summons claimed no lane and started nothing. Run the line again once the other summonses settle: \`${line}\``, 4);
}

/** The one line a launch cap carries: who wakes, and the om that unfolds everything else from the house. */
export function wakeLine(mandate: SpiritMandate): string {
  return `wake as ${mandate.tag}: lares spirit om ${mandate.pet} mandate=${refLine(mandate.uri, mandate.hash)}${mandate.face === null ? "" : ` face=${mandate.face}`}`;
}

/** The edge a summons lands before the launch: who offered, which instance, under which face, echoing which mandate. */
export function edgeWrite(mandate: SpiritMandate): { uri: string; fields: Record<string, string> } {
  return {
    uri: summonsOf(mandate.hash),
    fields: {
      tags: SUMMONS_TAG, offerer: mandate.offerer, instance: mandate.tag, pet: mandate.pet, mandate: mandate.uri, "mandate-hash": mandate.hash,
      parent: refLine(mandate.uri, mandate.hash), ...(mandate.face === null ? {} : { face: String(mandate.face) }),
      description: `summons: ${mandate.offerer || "hand"} → ${mandate.tag} under mandate ${mandate.hash.slice(0, 12)}`,
    },
  };
}

export interface SummonsEdge { readonly uri: string; readonly mandateHash: string; readonly offerer: string; readonly instance: string; readonly launched: string | null; readonly handback: string | null }
/** The edge read off its record; null where none stands. */
export function edgeRead(uri: string, fields: Readonly<Record<string, string>>): SummonsEdge | null {
  if (fields["mandate-hash"] === undefined) return null;
  return { uri, mandateHash: fields["mandate-hash"], offerer: fields["offerer"] ?? "", instance: fields["instance"] ?? "", launched: fields["launched"] || null, handback: fields["handback"] || null };
}

/** The call's own face param: `face=N` rides a call as any other param. */
const faceParam = (face: number | null): string => (face === null ? "" : ` face=${face}`);
/** A door's face param: `lares spirit <verb>` takes `face=N`. */
const faceFlag = (face: number | null): string => (face === null ? "" : ` face=${face}`);

/**
 * WHAT A WAKE UNDER A MANDATE HANDS THE INSTANCE AHEAD OF ITS CARD (om → ah → hum): the mandate by ref, the seed's read, each
 * affordance as the one command that opens it (a filter collapsed to titles and descriptions, a link read skinny), the file
 * paths and caps it holds, the hand-back it owes, then the mandate's own words.
 */
export function mandateWakeLines(mandate: SpiritMandate, cut = 2400): string {
  const face = faceParam(mandate.face);
  const words = mandate.text.length <= cut ? mandate.text : `${mandate.text.slice(0, cut)}\n… cut at ${cut} chars; the whole mandate: lares get title=${shq(mandate.uri)} recipe=default${face}${mandate.family ? " aperture=arc" : ""}`;
  return [
    `mandate: ${refLine(mandate.uri, mandate.hash)} · you wake as ${mandate.tag}, offered by ${mandate.offerer || "hand"}${mandate.face === null ? "" : ` · face h${mandate.face}`}${mandate.model === null ? "" : ` · model ${mandate.model}`}`,
    `om (the seed, then the card below): lares get title=lar:///ha.ka.ba/lares/api/noosphere-boot recipe=default${face} aperture=arc`,
    ...mandate.reads.map((f) => `reads: lares get filter=${shq(f)} recipe=default${face} aperture=measure fields=title,description`),
    ...mandate.links.map((l) => `link: lares get title=${shq(l)} recipe=default${face} aperture=measure`),
    `reach: ${launchReach(mandate).split(",").join(" ")}`,
    ...(mandate.workdir === null ? [] : [`workdir: ${mandate.workdir}`]),
    ...(mandate.log === null ? [] : [`log: ${mandate.log}`]),
    ...(mandate.paths.length === 0 ? [] : [`paths: ${mandate.paths.join(" ")}`]),
    ...(mandate.caps.length === 0 ? [] : [`caps: ${mandate.caps.join(" ")}`]),
    ...(mandate.grants.length === 0 ? [] : [`grants: ${mandate.grants.join(" ")}${mandate.grants.includes(SUMMONS_GRANT) ? ` · ${mandate.lanes} arm lane(s)` : ""}`]),
    `hand back${mandate.handbackShape === "" ? "" : ` (${mandate.handbackShape})`}: land the record, then free the lane: lares spirit handback ${shq(mandate.tag)} record=<uri>${faceFlag(mandate.face)}`,
    "",
    words,
  ].join("\n");
}
