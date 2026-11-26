/**
 * spirit-summons — the pure core of a mandate summons: the house starts its own arms.
 *
 * A coordinator lands a MANDATE (natural language inside a memetic carrier) on the worn face's memory stage; the house starts
 * the instance through a host launch cap with ONE line, and the instance reads everything else from the house. Three records
 * share one shape (research/spirit-talk-as-records): hash-keyed, idempotent on retry, parent-linked.
 *
 *   mandate   `kahua/memory/mandate/<id16>`   tag `mandate`; `mandate-hash` over its own fields and words; `parent` names
 *                                             the offering coordinator's mandate (`<uri>@<hash>`), absent where a hand offers
 *   edge      `kahua/memory/summons/<id16>`   tag `summons`; `parent` names the mandate; {offerer, instance, mandate-hash,
 *                                             face, launched, handback}: the ley-line inside the house
 *   hand-back any record the instance landed; the edge names it as `<uri>@<hash>`, and the lane it held frees
 *
 * `<id16>` reads the first 16 hex of the mandate's hash, so a retry finds the mandate and the edge standing and starts no
 * second instance. No clock decides here: order rides the parent links, and a stamp (`launched-at`) annotates alone.
 *
 * THE ONE LINE (`wakeLine`): `wake as <pet>#<n>: lares spirit om <pet> --mandate <uri>@<hash> [--face <N>]`. The launch cap
 * (`tools/summon-launch.mjs`) refuses any prompt outside that shape, so a host process starts only pointed at a hash-pinned
 * mandate.
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

/**
 * THE FIELDS A MANDATE'S HASH COVERS, in the order the hash reads them. `reads` (TW5 filters) and `links` (titles) hold one
 * entry per line; `paths`, `caps` and `grants` hold words. `lanes` names the arm-lane ceiling a COORDINATOR's mandate grants its
 * own summonses; `handback-shape` names what the instance hands back.
 */
export const MANDATE_FIELDS = ["pet", "instance", "offerer", "parent", "face", "model", "launch-cap", "reads", "links", "paths", "caps", "grants", "lanes", "handback-shape"] as const;
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
  readonly reads: readonly string[]; readonly links: readonly string[]; readonly paths: readonly string[]; readonly caps: readonly string[];
  readonly grants: readonly string[];
  /** The arm-lane ceiling this mandate grants its holder's own summonses; a mandate naming none reads zero. */
  readonly lanes: number;
  readonly handbackShape: string; readonly text: string;
}

/** The record a mandate lands as: its title, its fields (hash, tag and description among them) and its words. */
export function mandateWrite(covered: Readonly<Partial<Record<MandateField, string>>>, text: string): { uri: string; hash: string; text: string; fields: Record<string, string> } {
  const kept: Record<string, string> = {};
  for (const name of MANDATE_FIELDS) { const value = (covered[name] ?? "").trim(); if (value !== "") kept[name] = value; }
  const hash = mandateHashOf(kept, text);
  return {
    uri: mandateOf(hash), hash, text,
    fields: { ...kept, "mandate-hash": hash, tags: MANDATE_TAG, description: `mandate for ${kept["pet"] ?? "?"}#${kept["instance"] ?? "?"}, offered by ${kept["offerer"] ?? "?"}: the summons, its affordances and the hand-back it asks` },
  };
}

/**
 * A mandate read off its record, verified. `named` carries the hash the caller holds (the `@<hash>` of its ref). A record whose
 * words or covered fields moved since its hash landed, or whose hash names another than the caller's, refuses `mandate-moved`;
 * no record refuses `mandate-unknown`.
 */
export function mandateRead(uri: string, fields: Readonly<Record<string, string>>, named: string | null): SpiritMandate {
  const stored = fields["mandate-hash"];
  if (stored === undefined) {
    throw new SpiritRefusal("mandate-unknown", `mandate-unknown: no mandate stands at ${uri} under the face that answered; nothing started. List the mandates this face holds: \`lares wiki filter '[tag[${MANDATE_TAG}]]' --recipe default\``, 4);
  }
  const text = fields["text"] ?? "";
  const live = mandateHashOf(fields, text);
  if (!MANDATE_HASH.test(stored) || live !== stored || (named !== null && named !== stored) || mandateOf(stored) !== uri) {
    const why = live !== stored ? `its words or fields read ${live.slice(0, 12)} now, and its hash names ${String(stored).slice(0, 12)}`
      : named !== null && named !== stored ? `it holds ${stored.slice(0, 12)}, and the line names ${named.slice(0, 12)}`
      : `its hash ${String(stored).slice(0, 12)} names another address`;
    throw new SpiritRefusal("mandate-moved", `mandate-moved: ${uri} moved since its hash landed (${why}); nothing started. Its offerer lands the mandate again and names the ref that answer prints: \`lares spirit mandate ${fields["pet"] ?? "<pet>"}#${fields["instance"] ?? "<n>"} --file <carrier>\``, 4);
  }
  const tag = instanceTagOf(`${fields["pet"] ?? ""}#${fields["instance"] ?? ""}`);
  if (tag === null) {
    throw new SpiritRefusal("mandate-malformed", `mandate-malformed: ${uri} names no instance (\`pet\` and \`instance\` fields); nothing started. Land it again: \`lares spirit mandate <pet>#<n> --file <carrier>\``, 4);
  }
  const face = FACE_INDEX.test(fields["face"] ?? "") ? Number(fields["face"]) : null;
  const lanes = /^[0-9]{1,4}$/.test(fields["lanes"] ?? "") ? Number(fields["lanes"]) : 0;
  return {
    uri, hash: stored, ...tag, offerer: fields["offerer"] ?? "", parent: recordRefOf(fields["parent"]), face,
    model: (fields["model"] ?? "").trim() || null, launchCap: (fields["launch-cap"] ?? "").trim() || DEFAULT_LAUNCH_CAP,
    reads: linesOf(fields["reads"]), links: linesOf(fields["links"]), paths: wordsOf(fields["paths"]), caps: wordsOf(fields["caps"]),
    grants: wordsOf(fields["grants"]), lanes, handbackShape: fields["handback-shape"] ?? "", text,
  };
}

/** The mandate names another instance than the line does. */
export function mandateNames(mandate: SpiritMandate, pet: string, instance: string | null): SpiritRefusal | null {
  if (mandate.pet === pet && (instance === null || mandate.instance === instance)) return null;
  return new SpiritRefusal("mandate-names-another", `mandate-names-another: ${mandate.uri} summons ${mandate.tag}, and the line names ${pet}${instance === null ? "" : `#${instance}`}; nothing started. Name the instance the mandate names: \`lares spirit summon ${shq(mandate.tag)} --mandate ${refLine(mandate.uri, mandate.hash)}\``, 4);
}

/** The mandate echoes one face, and another answered: the instance wakes under the face its mandate names, never re-homed. */
export function mandateFaceTurned(mandate: SpiritMandate, answered: number | null, line: string): SpiritRefusal | null {
  if (mandate.face === null || answered === null || mandate.face === answered) return null;
  return new SpiritRefusal("mandate-face-turned", `mandate-face-turned: ${mandate.uri} echoes face h${mandate.face}, and h${answered} answered; nothing started. Name the face: \`${line} --face ${mandate.face}\``, 4);
}

/** The launch cap and the model a mandate names, checked before any process starts. */
export function launchHolds(mandate: SpiritMandate): SpiritRefusal | null {
  if (!(LAUNCH_CAPS as readonly string[]).includes(mandate.launchCap)) {
    return new SpiritRefusal("launch-cap-unknown", `launch-cap-unknown: ${mandate.uri} names the launch cap "${mandate.launchCap}", and this house holds ${LAUNCH_CAPS.join(", ")}; nothing started. Land the mandate again naming one: \`lares spirit mandate ${shq(mandate.tag)} --file <carrier> --cap ${DEFAULT_LAUNCH_CAP}\``, 4);
  }
  if (mandate.model !== null && !MODEL_SLUG.test(mandate.model)) {
    return new SpiritRefusal("mandate-model-malformed", `mandate-model-malformed: ${mandate.uri} names a model no launch cap takes as a slug; nothing started. Land the mandate again: \`lares spirit mandate ${shq(mandate.tag)} --file <carrier> --model <slug>\``, 4);
  }
  return null;
}

/**
 * CUSTODY AT HAND-VS-SEAT. A person's hand summons on a receipt. A seat starts a process only under a coordinator's mandate that
 * grants summonses in writing: no parent, or a parent whose `grants` holds no `summons`, refuses `summons-ungranted`.
 */
export function summonsGranted(hand: boolean, mandate: SpiritMandate, coordinator: SpiritMandate | null): SpiritRefusal | null {
  if (hand) return null;
  const line = `lares spirit summon ${shq(mandate.tag)} --mandate ${refLine(mandate.uri, mandate.hash)}`;
  if (coordinator === null) {
    return new SpiritRefusal("summons-ungranted", `summons-ungranted: ${mandate.uri} names no coordinator's mandate (offered by ${mandate.offerer || "none"}), and a seat starts a process only under a written grant; nothing started. A person's hand runs the line at a terminal: \`${line}\``, 4);
  }
  if (coordinator.tag !== mandate.offerer) {
    return new SpiritRefusal("summons-ungranted", `summons-ungranted: ${mandate.uri} names ${mandate.offerer || "no offerer"}, and its parent ${coordinator.uri} holds ${coordinator.tag}; nothing started. The coordinator lands the mandate under its own: \`lares spirit mandate ${shq(mandate.tag)} --file <carrier> --parent ${refLine(coordinator.uri, coordinator.hash)}\``, 4);
  }
  if (!coordinator.grants.includes(SUMMONS_GRANT)) {
    return new SpiritRefusal("summons-ungranted", `summons-ungranted: ${coordinator.tag}'s mandate ${coordinator.uri} grants no ${SUMMONS_GRANT}, and a seat starts a process only under that written grant; nothing started. A person's hand runs the line at a terminal: \`${line}\` (or lands ${coordinator.tag} a mandate carrying \`--grants ${SUMMONS_GRANT} --lanes <n>\`)`, 4);
  }
  return null;
}

/** The filter listing every edge a coordinator holds open: its summonses with no hand-back yet. */
export const openLanesFilter = (coordinator: string): string => `[tag[${SUMMONS_TAG}]field:offerer[${coordinator}]!has[handback]]`;

/**
 * THE LANE CEILING. A coordinator's mandate names how many arm lanes it holds; a summons past it refuses by name. `open` lists
 * the coordinator's open edges (this summons's own edge left out, so a retry never counts itself). A ceiling of zero reads as
 * no lane granted, never as unlimited.
 */
export function lanesHold(coordinator: SpiritMandate, open: readonly string[], own: string): SpiritRefusal | null {
  const held = open.filter((title) => title !== own);
  if (held.length < coordinator.lanes) return null;
  const cure = coordinator.lanes === 0
    ? `${coordinator.tag}'s mandate names no lanes, which reads as zero. A hand lands it a mandate naming a ceiling: \`lares spirit mandate ${shq(coordinator.tag)} --file <carrier> --grants ${SUMMONS_GRANT} --lanes <n>\``
    : `Wait for a hand-back, which frees its lane: \`lares wiki filter '${openLanesFilter(coordinator.tag)}' --recipe default\` lists the arms still out, and each hands back by \`lares spirit handback <pet>#<n> --record <uri>\``;
  return new SpiritRefusal("coordinator-lanes-full", `coordinator-lanes-full: ${coordinator.tag} holds ${held.length} of ${coordinator.lanes} arm lane(s) open; nothing started. ${cure}`, 4);
}

/** The one line a launch cap carries: who wakes, and the om that unfolds everything else from the house. */
export function wakeLine(mandate: SpiritMandate): string {
  return `wake as ${mandate.tag}: lares spirit om ${mandate.pet} --mandate ${refLine(mandate.uri, mandate.hash)}${mandate.face === null ? "" : ` --face ${mandate.face}`}`;
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

const faceFlag = (face: number | null): string => (face === null ? "" : ` --face ${face}`);

/**
 * WHAT A WAKE UNDER A MANDATE HANDS THE INSTANCE AHEAD OF ITS CARD (om → ah → hum): the mandate by ref, the seed's read, each
 * affordance as the one command that opens it (a filter collapsed to titles and descriptions, a link read skinny), the file
 * paths and caps it holds, the hand-back it owes, then the mandate's own words.
 */
export function mandateWakeLines(mandate: SpiritMandate, cut = 2400): string {
  const face = faceFlag(mandate.face);
  const words = mandate.text.length <= cut ? mandate.text : `${mandate.text.slice(0, cut)}\n… cut at ${cut} chars; the whole mandate: lares tiddler get ${shq(mandate.uri)} --recipe default${face}`;
  return [
    `mandate: ${refLine(mandate.uri, mandate.hash)} · you wake as ${mandate.tag}, offered by ${mandate.offerer || "hand"}${mandate.face === null ? "" : ` · face h${mandate.face}`}${mandate.model === null ? "" : ` · model ${mandate.model}`}`,
    `om (the seed, then the card below): lares tiddler get 'lar:///ha.ka.ba/lares/api/noosphere-boot' --recipe default${face} --meme --all`,
    ...mandate.reads.map((f) => `reads: lares wiki filter ${shq(f)} --recipe default${face} --collapse --fields title,description`),
    ...mandate.links.map((l) => `link: lares tiddler get ${shq(l)} --recipe default${face} --meme --skinny`),
    ...(mandate.paths.length === 0 ? [] : [`paths: ${mandate.paths.join(" ")}`]),
    ...(mandate.caps.length === 0 ? [] : [`caps: ${mandate.caps.join(" ")}`]),
    ...(mandate.grants.length === 0 ? [] : [`grants: ${mandate.grants.join(" ")}${mandate.grants.includes(SUMMONS_GRANT) ? ` · ${mandate.lanes} arm lane(s)` : ""}`]),
    `hand back${mandate.handbackShape === "" ? "" : ` (${mandate.handbackShape})`}: land the record, then free the lane: lares spirit handback ${shq(mandate.tag)} --record <uri>${face}`,
    "",
    words,
  ].join("\n");
}
