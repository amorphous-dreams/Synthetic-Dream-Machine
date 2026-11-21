/**
 * pulama-verbs — the hand's verbs at the pūlama, as the operator types them inside the pūlama's own container.
 *
 *   light    read the route on a real terminal, hand it to the hand door: the one act that opens a key
 *   admit    read the route on a real terminal, hand it to the hand door: the route PROVES against the lit holder (it opens
 *            nothing), and the image the host reports rests admitted, so a vessel raised from it wakes served
 *   lei      `lei kui|restring|unstring '<terms>'`: read the route on a real terminal, hand it to the hand door with the lei's
 *            terms (one JSON object: `face`, `rite`, `branch`, and `returns` · `reach` · `head` · `after` · `confirm` · `lei`
 *            as the act needs): the face root signs one record there, and the answer carries it for the vessel to land. Terms
 *            of `{ "faces": [ … ] }` (one terms object per face, `lares lei terms kui --all`) read the route ONCE and sign one
 *            record per face, each by that face's own root, stopping at the first face that refuses; the answer lists each
 *            face's (`faces`)
 *   keep-seat  read the route on a real terminal, hand it to the hand door: the route proves against the lit holder and a fresh
 *            keep pair mints under it. The pūlama's container stands read-only with no config home, so the verb writes NOTHING:
 *            it prints exactly ONE stdout line (`keepSeatLine`) the host's shim writes to the house's `keep-seat.json` at 0600, or
 *            one refusal line and a nonzero exit
 *   lock · status · tessera · image <digest> | image '{"digest","seed"}'   one frame each, no route
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
import { keepVerifyKeyOf } from "@lararium/mesh";
import type { PulamaHandAnswer } from "./pulama-hand.js";

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
      : "no route was given, so nothing reached the pūlama: it opened nothing and spent no attempt; run it again and type the route, then Enter");
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

export const PULAMA_VERB_USAGE = `usage: pulama-main.js serve | light | admit [face…] | unadmit <image digest> | rehive <face> | lei kui|restring|unstring '{"face":…,"rite":…,"branch":…,…}' | lei kui '{"faces":[…]}' | keep-seat | lock | status | image <digest> | image '{"digest":…,"seed":…}' | tessera`;

/** A verb line the hand door holds no act for. */
export class PulamaVerbUsage extends Error { override readonly name = "PulamaVerbUsage"; constructor() { super(PULAMA_VERB_USAGE); } }

/**
 * The exit a hand verb's answer leaves: a rehive that did not land (`face-open`, `face-refused`, `hand-act-only`, any reading
 * but `rehived`) exits 1, so a script reading the line's status never takes a refusal for a rehive. Every other verb exits 0.
 */
export function handVerbExit(verb: string, answer: PulamaHandAnswer): 0 | 1 {
  return verb === "rehive" && answer["reading"] !== "rehived" ? 1 : 0;
}

/**
 * Run one hand verb: `ask` sends one frame to the hand door, `route` reads the operator's route. Answers the door's answer.
 */
export async function runHandVerb(verb: string, arg: string | readonly string[] | undefined, ports: {
  readonly ask: (frame: Readonly<Record<string, unknown>>) => Promise<PulamaHandAnswer>;
  readonly route: (label: string, what: string) => Promise<string>;
}): Promise<PulamaHandAnswer> {
  if (verb === "light") {
    const passphrase = await ports.route("pūlama route: ", "the pūlama's light");
    return ports.ask({ op: "light", credentials: [{ kind: "passphrase", passphrase }] });
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
  if ((verb === "lock" || verb === "status" || verb === "tessera") && arg === undefined) return ports.ask({ op: verb });
  if (verb === "image" && typeof arg === "string") {
    // `image '{"digest":…,"seed":…}'`: the host's structured frame, the seed line beside the digest; `image <digest>` carries none.
    if (!arg.trimStart().startsWith("{")) return ports.ask({ op: "image", digest: arg });
    let frame: unknown;
    try { frame = JSON.parse(arg); } catch { throw new PulamaVerbUsage(); }
    const f = (typeof frame === "object" && frame !== null && !Array.isArray(frame) ? frame : {}) as Record<string, unknown>;
    if (typeof f["digest"] !== "string" || (f["seed"] !== undefined && typeof f["seed"] !== "string")) throw new PulamaVerbUsage();
    return ports.ask({ op: "image", digest: f["digest"], ...(typeof f["seed"] === "string" ? { seed: f["seed"] } : {}) });
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
