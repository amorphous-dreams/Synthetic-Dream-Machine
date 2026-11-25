/**
 * pulama-verbs — the hand's verbs at the pūlama, as the operator types them inside the pūlama's own container.
 *
 *   light    read the route on a real terminal, hand it to the hand door: the one act that opens a key; `light --admit` also
 *            admits the reported image under that one route, so a struck fire asks the passphrase once
 *   admit    read the route on a real terminal, hand it to the hand door: the route PROVES against the lit holder (it opens
 *            nothing), and the image the host reports rests admitted, so a vessel raised from it wakes served
 *   lei      `lei kui|restring|unstring '<terms>'`: read the route on a real terminal, hand it to the hand door with the lei's
 *            terms (one JSON object: `face`, `rite`, `branch`, and `returns` · `reach` · `head` · `after` · `confirm` · `lei`
 *            as the act needs): the face root signs one record there, and the answer carries it for the vessel to land. Terms
 *            of `{ "faces": [ … ] }` (one terms object per face, `lares lei terms kui --all`) read the route ONCE and sign one
 *            record per face, each by that face's own root, stopping at the first face that refuses; the answer lists each
 *            face's (`faces`)
 *   publish  `publish '<terms>'`: the terms `lares nexus publish plugins --source <dir> --face N --terms` prints (`face` and the
 *            closed `offering` descriptor: offeror, pluginsCid, blobs). The descriptor's shape reads first (`offeringTermsOf`, the
 *            door's own check), then the door (an unlit pūlama asks no route), then the route on a real terminal, naming the face,
 *            the region and the blob count; the face root signs that one offering at the door, and the answer carries it for the
 *            vessel to land (`lares nexus publish plugins --source <dir> --land '<answer>'`)
 *   sign     `sign '<terms>'`: the terms a ward act's `--terms` prints under a pūlama (`lares kahua lift|withdraw|carry --terms`):
 *            the face, the record's kind (`pulama-sign`'s closed table) and the one record. The door checks every rule it holds
 *            first (`check`: the kind, the record's shape, the face's root and group), then the route reads on a real terminal,
 *            naming what the root signs; the root signs that one record, and the answer carries it for the vessel to land
 *            (`--land '<answer>'`)
 *   keep-seat  read the route on a real terminal, hand it to the hand door: the route proves against the lit holder and a fresh
 *            keep pair mints under it. The pūlama's container stands read-only with no config home, so the verb writes NOTHING:
 *            it prints exactly ONE stdout line (`keepSeatLine`) the host's shim writes to the house's `keep-seat.json` at 0600, or
 *            one refusal line and a nonzero exit
 *   name-successor <sha256:…>  THE HAND NAMES THE KEEPER'S SUCCESSOR: the door reads first (unlit, unreported or passing refuses
 *            before any prompt), the prompt names the successor closure it commits, and the route proves against the lit holder.
 *            The host's consent screen (`tools/lares-container.sh pulama name-successor`) prints that closure and the source tree, and
 *            offers the clean-tree re-check, before it lands here
 *   (internal, never a hand verb) `name-successor-lei '<json>'`: the commit the kukulu lei licenses, as the host testifies it from
 *            inside `lares rite kukulu`; it stays out of the usage line
 *   lock · status · tessera · keeper-offer · keeper-land · take-fire · closure <sha256:…> · keeper-vest '{"to","closure"}' ·
 *   keeper-receive '{"slot"}' · image <digest> | image '{"digest","seed","closure"}'   one frame each, no route
 *
 * ── A ROUTE RIDES A REAL TERMINAL AND NOTHING ELSE ──────────────────────────────────────────────
 * `readRoute` reads with no echo from a terminal, and refuses anything else by name: no pipe, no flag, no argument and no
 * environment variable carries a route here. The route crosses one socket, the hand door's, inside the pūlama; it reaches
 * no vessel and no session frame.
 *
 * ── ADMIT ASKS NOTHING IT CANNOT USE ────────────────────────────────────────────────────────────
 * `admit` reads the door's standing first. An unlit pūlama, or one the host reported no image to, refuses before any
 * prompt: a route typed then would prove nothing and admit nothing.
 * Meme: lar:///ha.ka.ba/lares/docs/pono/the-worn-house#/the-pulama
 */
import { keepVerifyKeyOf } from "@lararium/mesh/keep-seat-door";
import { offeringTermsOf, type PulamaHandAnswer } from "./pulama-hand.js";

/** The slice of a terminal a route reads through. */
export interface RouteTerminal {
  readonly input: Pick<NodeJS.ReadStream, "isTTY" | "setRawMode" | "resume" | "pause" | "setEncoding" | "on" | "removeListener">;
  readonly output: { write(text: string): unknown };
}

/** The refusal a route reader gives anything but a real terminal. */
export class RouteNeedsTerminal extends Error {
  override readonly name = "RouteNeedsTerminal";
  readonly reading = "route-needs-a-terminal";
  constructor(what: string) { super(`${what} reads its route from a real terminal alone: the route rides no pipe, no flag, no argument and no environment`); }
}

/**
 * The refusal a route reader gives when no route reaches the pūlama: an empty line, or Ctrl-C / Ctrl-D before Enter.
 * The reader knows only whether anything was typed, never whether it would have fit: nothing it read went to the hand
 * door, so the route opened nothing and spent no attempt. `typed` says whether a stop cut a typed route short.
 */
export class RouteNotGiven extends Error {
  override readonly name = "RouteNotGiven";
  readonly reading = "route-not-given";
  constructor(readonly typed: boolean) {
    super(typed
      ? "the route reading stopped (Ctrl-C or Ctrl-D) before Enter, so what you typed never reached the pūlama: it opened nothing and spent no attempt; run it again and end the route with Enter"
      : "no route came, so nothing reached the pūlama: it opened nothing and spent no attempt; run it again and type the route, then Enter");
  }
}

/** Read the operator's route from a real terminal, with no echo. Anything but a terminal refuses; an empty or cut-short reading refuses `RouteNotGiven`. */
export function readRoute(label: string, what: string, terminal: RouteTerminal = { input: process.stdin, output: process.stderr }): Promise<string> {
  const { input, output } = terminal;
  if (!input.isTTY) return Promise.reject(new RouteNeedsTerminal(what));
  return new Promise((resolve, reject) => {
    output.write(label);
    input.setRawMode(true);
    input.resume();
    input.setEncoding("utf8");
    let line = "";
    const done = (act: () => void): void => { input.setRawMode(false); input.pause(); input.removeListener("data", onData); output.write("\n"); act(); };
    const onData = (chunk: string): void => {
      for (const ch of chunk) {
        // A BARE ENTER sends no empty route to the door, where it would spend an attempt for nothing.
        if (ch === "\r" || ch === "\n") return done(() => line === "" ? reject(new RouteNotGiven(false)) : resolve(line));
        if (ch === "\u0003" || ch === "\u0004") return done(() => reject(new RouteNotGiven(line !== "")));
        if (ch === "\u007f" || ch === "\b") line = line.slice(0, -1);
        else if (ch >= " ") line += ch;
      }
    };
    input.on("data", onData);
  });
}

export const PULAMA_VERB_USAGE = `usage: pulama-main.js serve | light [--admit] | admit [face…] | unadmit <image digest> | rehive <face> | recard <face> | lei kui|restring|unstring '{"face":…,"rite":…,"branch":…,…}' | lei kui '{"faces":[…]}' | publish '{"face":…,"offering":{"offeror":…,"pluginsCid":…,"blobs":[…]}}' | sign '{"face":…,"kind":"kahua-act"|"plugin-offering","record":{…}}' | keep-seat | lock | status | image <digest> | image '{"digest":…,"seed":…,"closure":…}' | tessera | closure <sha256:…> | name-successor <sha256:…> [--devices <n>] [--cosign <json>] | keeper-offer | keeper-vest '{"to":…,"closure":…}' | keeper-receive '{"slot":…}' | keeper-land | take-fire`;

/** A verb line the hand door holds no act for. */
export class PulamaVerbUsage extends Error { override readonly name = "PulamaVerbUsage"; constructor() { super(PULAMA_VERB_USAGE); } }

/**
 * The exit a hand verb's answer leaves: a rehive that did not land (`face-open`, `face-refused`, `hand-act-only`, any reading
 * but `rehived`) exits 1, so a script reading the line's status never takes a refusal for a rehive (a recard, any reading but `granted`, alike); each keeper act that did not land
 * exits 1 the same way. Every other verb exits 0.
 */
export function handVerbExit(verb: string, answer: PulamaHandAnswer): 0 | 1 {
  const lands = HAND_VERB_LANDS[verb];
  return lands !== undefined && answer["reading"] !== lands ? 1 : 0;
}
/** The one reading each act that must land answers; any other reading exits 1, so the host shim never reads a refusal as done. */
const HAND_VERB_LANDS: Readonly<Record<string, string>> = {
  rehive: "rehived", recard: "granted", publish: "signed", sign: "signed", "name-successor": "named", "name-successor-lei": "named", "keeper-offer": "offered", "keeper-vest": "vested", "keeper-receive": "landed", "keeper-land": "landed", "take-fire": "taken",
};

/**
 * Run one hand verb: `ask` sends one frame to the hand door, `route` reads the operator's route. Answers the door's answer.
 */
export async function runHandVerb(verb: string, arg: string | readonly string[] | undefined, ports: {
  readonly ask: (frame: Readonly<Record<string, unknown>>) => Promise<PulamaHandAnswer>;
  readonly route: (label: string, what: string) => Promise<string>;
}): Promise<PulamaHandAnswer> {
  if (verb === "light") {
    // `light --admit`: ONE ROUTE lights the keeper and admits the image the host reports (the struck fire's one proof).
    if (arg !== undefined && arg !== "--admit") throw new PulamaVerbUsage();
    const passphrase = await ports.route(arg === "--admit" ? "pūlama route, to light and admit the reported image: " : "pūlama route: ", "the pūlama's light");
    return ports.ask({ op: "light", credentials: [{ kind: "passphrase", passphrase }], ...(arg === "--admit" ? { admit: true } : {}) });
  }
  if (verb === "admit") {
    const args = arg === undefined ? [] : typeof arg === "string" ? [arg] : arg;
    if (args.some((a) => !/^(0|[1-9]\d*)$/.test(a) || !Number.isSafeInteger(Number(a)))) throw new PulamaVerbUsage();
    // THE DOOR READS FIRST: an unlit pūlama or an unreported image refuses here, before anybody types a route.
    const standing = await ports.ask({ op: "status" });
    if (standing["lit"] !== true) return { op: "admit", reading: "pulama-locked", detail: "the pūlama stands unlit: light it first (`light`), then admit" };
    if (typeof standing["image"] !== "string") return { op: "admit", reading: "image-unreported", detail: "the host reported no image digest to this pūlama, so no image stands to admit" };
    // The seed the image offers rides the prompt beside it, so the hand reads what waits before it admits (admission moves nothing).
    const offered = typeof standing["seed"] === "string" ? ` (${standing["seed"]})` : "";
    const passphrase = await ports.route(`pūlama route, to admit ${standing["image"]}${offered}: `, "an admission");
    return ports.ask({ op: "admit", credentials: [{ kind: "passphrase", passphrase }], faces: args.map(Number) });
  }
  if (verb === "rehive") {
    if (typeof arg !== "string" || !/^(0|[1-9]\d*)$/.test(arg) || !Number.isSafeInteger(Number(arg))) throw new PulamaVerbUsage();
    const face = Number(arg);
    // THE FACE'S OWN ROUTE, read on this terminal: it opens that face's key for the rehive alone.
    const passphrase = await ports.route(`face h${face} route, to rehive it: `, "a rehive");
    return ports.ask({ op: "rehive", face, credentials: [{ kind: "passphrase", passphrase }] });
  }
  if (verb === "recard") {
    if (typeof arg !== "string" || !/^(0|[1-9]\d*)$/.test(arg) || !Number.isSafeInteger(Number(arg))) throw new PulamaVerbUsage();
    const face = Number(arg);
    // THE DOOR READS FIRST: an unlit pūlama refuses here, before anybody types a route.
    const standing = await ports.ask({ op: "status" });
    if (standing["lit"] !== true) return { op: "recard", reading: "pulama-locked", face, detail: `the pūlama stands unlit: light it first (tools/lares-container.sh pulama light), then tools/lares-container.sh pulama recard ${face}` };
    // THE FACE'S OWN ROUTE, read on this terminal: it opens that face's key for the proof alone, never the vessel's.
    const passphrase = await ports.route(`face h${face} route, to recard it: `, "a recard");
    return ports.ask({ op: "recard", face, credentials: [{ kind: "passphrase", passphrase }] });
  }
  if (verb === "unadmit") {
    if (typeof arg !== "string" || arg === "") throw new PulamaVerbUsage();
    // THE DOOR READS FIRST: an unlit pūlama refuses here, before anybody types a route.
    const standing = await ports.ask({ op: "status" });
    if (standing["lit"] !== true) return { op: "unadmit", reading: "pulama-locked", detail: "the pūlama stands unlit: light it first (`light`), then unadmit" };
    const passphrase = await ports.route(`pūlama route, to unadmit ${arg}: `, "an unadmission");
    return ports.ask({ op: "unadmit", image: arg, credentials: [{ kind: "passphrase", passphrase }] });
  }
  if (verb === "lei") {
    // THE LINE: an act and one JSON object of terms, nothing more; a route never rides it.
    if (!Array.isArray(arg) || arg.length !== 2) throw new PulamaVerbUsage();
    const [act, raw] = arg as readonly string[];
    if (act !== "kui" && act !== "restring" && act !== "unstring") throw new PulamaVerbUsage();
    let terms: unknown;
    try { terms = JSON.parse(raw!); } catch { throw new PulamaVerbUsage(); }
    const termsOk = (x: unknown): x is Record<string, unknown> => typeof x === "object" && x !== null && !Array.isArray(x) && !("credentials" in x) && !("op" in x) && !("act" in x);
    if (!termsOk(terms)) throw new PulamaVerbUsage();
    // ONE STRINGING FOR EVERY FACE: `faces` lists one terms object per face, each signed by that face's own hand under ONE route.
    const every = terms["faces"];
    if (every !== undefined && (!Array.isArray(every) || every.length === 0 || !every.every(termsOk))) throw new PulamaVerbUsage();
    const each: readonly Record<string, unknown>[] = every === undefined ? [terms] : every as Record<string, unknown>[];
    const t = each[0]!;
    // THE DOOR READS FIRST: an unlit pūlama refuses here, before anybody types a route.
    const standing = await ports.ask({ op: "status" });
    if (standing["lit"] !== true) return { op: "lei", reading: "pulama-locked", detail: "the pūlama stands unlit: light it first (`light`), then string the lei" };
    const what = act === "unstring" ? `unstring the ${String(t["rite"])} lei ${String(t["lei"])}` : `${act} a ${String(t["rite"])} lei`;
    const passphrase = await ports.route(`pūlama route, to ${what} at "${String(t["branch"])}" for ${each.map((f) => `h${String(f["face"])}`).join(", ")}: `, "a lei");
    const credentials = [{ kind: "passphrase", passphrase }];
    if (every === undefined) return ports.ask({ op: "lei", act, ...t, credentials });
    // The signing stops at the first face that refuses, so a mistyped route spends one attempt, never one per face.
    const faces: PulamaHandAnswer[] = [];
    for (const f of each) {
      const answer = await ports.ask({ op: "lei", act, ...f, credentials });
      faces.push(answer);
      if (answer["reading"] !== "signed") return { op: "lei", act, reading: answer["reading"], faces };
    }
    return { op: "lei", act, reading: "signed", faces };
  }
  if (verb === "publish") {
    // THE LINE: one JSON object of terms (the face and the closed descriptor), nothing more; a route never rides it.
    if (typeof arg !== "string") throw new PulamaVerbUsage();
    let terms: unknown;
    try { terms = JSON.parse(arg); } catch { throw new PulamaVerbUsage(); }
    if (typeof terms !== "object" || terms === null || Array.isArray(terms) || Object.keys(terms).some((k) => k !== "face" && k !== "offering")) throw new PulamaVerbUsage();
    const face = (terms as Record<string, unknown>)["face"];
    if (typeof face !== "number" || !Number.isSafeInteger(face) || face < 0) throw new PulamaVerbUsage();
    // THE DESCRIPTOR READS FIRST, by the door's own check: a shape the root would never sign asks no route.
    const read = await offeringTermsOf((terms as Record<string, unknown>)["offering"]);
    if ("reading" in read) return { op: "publish", face, ...read };
    // THE DOOR READS NEXT, every check it holds short of the route (`check`): an unlit pūlama, an unopened face, an offeror
    // naming another key each refuse here, before anybody types a route.
    const ready = await ports.ask({ op: "publish", face, offering: read.terms, check: true });
    if (ready["reading"] !== "ready") return ready;
    const passphrase = await ports.route(`pūlama route, to sign the plugin offering ${read.terms.pluginsCid} (${read.terms.blobs.length} blob(s)) for h${face}: `, "a plugin offering");
    return ports.ask({ op: "publish", face, offering: read.terms, credentials: [{ kind: "passphrase", passphrase }] });
  }
  if (verb === "sign") {
    // THE LINE: one JSON object of terms (the face, the record's kind, the one record), nothing more; a route never rides it.
    if (typeof arg !== "string") throw new PulamaVerbUsage();
    let terms: unknown;
    try { terms = JSON.parse(arg); } catch { throw new PulamaVerbUsage(); }
    if (typeof terms !== "object" || terms === null || Array.isArray(terms) || Object.keys(terms).some((k) => k !== "face" && k !== "kind" && k !== "record")) throw new PulamaVerbUsage();
    const t = terms as Record<string, unknown>;
    if (typeof t["face"] !== "number" || !Number.isSafeInteger(t["face"]) || t["face"] < 0 || typeof t["kind"] !== "string") throw new PulamaVerbUsage();
    // EVERY CHECK THE DOOR HOLDS RUNS BEFORE THE ROUTE (`check`): the kind, the record's closed shape, the face's root and group.
    const ready = await ports.ask({ op: "sign", face: t["face"], kind: t["kind"], record: t["record"], check: true });
    if (ready["reading"] !== "ready") return ready;
    const what = typeof ready["describe"] === "string" ? ready["describe"] : t["kind"];
    const passphrase = await ports.route(`pūlama route, to sign ${what} for h${t["face"]}: `, String(what));
    return ports.ask({ op: "sign", face: t["face"], kind: t["kind"], record: t["record"], credentials: [{ kind: "passphrase", passphrase }] });
  }
  if (verb === "name-successor") {
    // `name-successor <sha256:…> [--devices <n>] [--cosign <json>]`: the host shim names the most devices any lit face holds, as the
    // vessel read it, and the co-sign the vessel spent over this commit (`lares intent keeper-cosign`: its nonce and each face's proof).
    const words = typeof arg === "string" ? [arg] : Array.isArray(arg) ? [...arg] : [];
    const digest = words[0];
    if (typeof digest !== "string" || !/^sha256:[0-9a-f]{64}$/.test(digest)) throw new PulamaVerbUsage();
    const extra: Record<string, unknown> = {};
    for (let i = 1; i < words.length; i += 2) {
      const flag = words[i], value = words[i + 1];
      if (typeof value !== "string") throw new PulamaVerbUsage();
      if (flag === "--devices" && !("devices" in extra) && /^[1-9]\d{0,3}$/.test(value)) extra["devices"] = Number(value);
      else if (flag === "--cosign" && !("cosign" in extra)) { try { extra["cosign"] = JSON.parse(value); } catch { throw new PulamaVerbUsage(); } }
      else throw new PulamaVerbUsage();
    }
    const devices = extra;
    // THE DOOR READS FIRST: an unlit, unreported or passing keeper refuses here, before anybody types a route.
    const standing = await ports.ask({ op: "status" });
    if (standing["lit"] !== true) return { op: "name-successor", reading: "pulama-locked", detail: "the pūlama stands unlit: light it first (`light`), then commit its successor" };
    if (standing["passing"] === true) return { op: "name-successor", reading: "fire-passing", detail: "this keeper vested its fire already" };
    if (typeof standing["closure"] !== "string") return { op: "name-successor", reading: "closure-unreported", detail: "the host reported no closure for this keeper; `tools/lares-container.sh up` reports it" };
    const passphrase = await ports.route(`pūlama route, to hand this keeper's fire to the successor closure ${digest}: `, "a successor");
    return ports.ask({ op: "name-successor", next: digest, ...devices, credentials: [{ kind: "passphrase", passphrase }] });
  }
  if (verb === "closure" && typeof arg === "string") return ports.ask({ op: "closure", digest: arg });
  if ((verb === "keeper-vest" || verb === "keeper-receive" || verb === "name-successor-lei") && typeof arg === "string") {
    let terms: unknown;
    try { terms = JSON.parse(arg); } catch { throw new PulamaVerbUsage(); }
    if (typeof terms !== "object" || terms === null || Array.isArray(terms) || "op" in terms || "credentials" in terms) throw new PulamaVerbUsage();
    return ports.ask({ op: verb, ...(terms as Record<string, unknown>) });
  }
  if ((verb === "lock" || verb === "status" || verb === "tessera" || verb === "keeper-offer" || verb === "keeper-land" || verb === "take-fire") && arg === undefined) return ports.ask({ op: verb });
  if (verb === "image" && typeof arg === "string") {
    // `image '{"digest":…,"seed":…}'`: the host's structured frame, the seed line beside the digest; `image <digest>` carries none.
    if (!arg.trimStart().startsWith("{")) return ports.ask({ op: "image", digest: arg });
    let frame: unknown;
    try { frame = JSON.parse(arg); } catch { throw new PulamaVerbUsage(); }
    const f = (typeof frame === "object" && frame !== null && !Array.isArray(frame) ? frame : {}) as Record<string, unknown>;
    if (typeof f["digest"] !== "string" || (f["seed"] !== undefined && typeof f["seed"] !== "string") || (f["closure"] !== undefined && typeof f["closure"] !== "string")) throw new PulamaVerbUsage();
    return ports.ask({ op: "image", digest: f["digest"], ...(typeof f["seed"] === "string" ? { seed: f["seed"] } : {}), ...(typeof f["closure"] === "string" ? { closure: f["closure"] } : {}) });
  }
  throw new PulamaVerbUsage();
}

/** One `keep-seat` line and the exit it leaves. */
export interface KeepSeatLine { readonly line: string; readonly code: number }

/**
 * `pulama-main.js keep-seat`: the door first (an unlit pūlama asks no route), then the route on the pūlama's real terminal, then
 * one keep-seat frame. Answers exactly ONE line and its exit: seated,
 * `{"op":"keep-seat","reading":"seated","seat":{"publicKey","stretchSalt","tree","verifyKey"},"signer"}` (the tree as the house's
 * keep-seat.json holds it, the signer the signing seed in hex) with exit 0; else
 * `{"op":"keep-seat","reading":"refused","code","message"}` with exit 1. The shim writes the seated line verbatim to
 * `keep-seat.json` (0600), which the house's CLI reads as its seat; nothing else of this verb reaches stdout.
 */
export async function keepSeatLine(ports: {
  readonly ask: (frame: Readonly<Record<string, unknown>>) => Promise<PulamaHandAnswer>;
  readonly route: (label: string, what: string) => Promise<string>;
}): Promise<KeepSeatLine> {
  const refused = (code: string, message: string): KeepSeatLine => ({ line: JSON.stringify({ op: "keep-seat", reading: "refused", code, message }), code: 1 });
  try {
    const standing = await ports.ask({ op: "status" });
    if (standing["lit"] !== true) return refused("pulama-locked", "the pūlama stands unlit: light it first (`light`), then seat the keep");
    let passphrase: string;
    try { passphrase = await ports.route("pūlama route, to seat the house's keep pair: ", "a keep seat"); }
    catch (e) {
      const err = e as { reading?: unknown; name?: unknown; message?: unknown };
      return refused(typeof err.reading === "string" ? err.reading : typeof err.name === "string" ? err.name : "route-unread", typeof err.message === "string" ? err.message : String(e));
    }
    const answer = await ports.ask({ op: "keep-seat", credentials: [{ kind: "passphrase", passphrase }] });
    if (answer["reading"] !== "seated" || typeof answer["seat"] !== "string" || typeof answer["signingSeed"] !== "string") {
      const code = typeof answer["reading"] === "string" ? answer["reading"] : "keep-seat-refused";
      return refused(code, typeof answer["detail"] === "string" ? answer["detail"] : code === "no-slot-opens" ? "the route proves nothing against the pūlama's custody; nothing seated" : `the hand door seated nothing (${code})`);
    }
    const seat = JSON.parse(answer["seat"]) as { publicKey: string; stretchSalt: string; slots: unknown };
    const verifyKey = Buffer.from(keepVerifyKeyOf(Uint8Array.from(Buffer.from(answer["signingSeed"], "hex")))).toString("hex");
    return { line: JSON.stringify({ op: "keep-seat", reading: "seated", seat: { publicKey: seat.publicKey, stretchSalt: seat.stretchSalt, tree: seat.slots, verifyKey }, signer: answer["signingSeed"] }), code: 0 };
  } catch (e) {
    return refused("hand-door-unread", e instanceof Error ? e.message : String(e));
  }
}
