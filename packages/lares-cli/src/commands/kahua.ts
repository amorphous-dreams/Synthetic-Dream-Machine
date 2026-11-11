/**
 * kahua — the operator's door onto one face's kahua stage: adopt the pin its founding act signed (`mint`; a face whose
 * log names none refuses `kahua-mint-outside-founding`), propose, stage, lift and withdraw by hand, read.
 *
 * Each act rides the store door's matching face row (`kahua-mint`, `kahua-propose`, `kahua-stage`, `kahua-lift`,
 * `kahua-withdraw`, `kahua-read`), through the standing vessel's session when one stands, and prints the row's answer as
 * JSON. MEMORY CLIMBS IN TWO CROSSINGS (kahua-memory-stage#/the-recipe): `stage` writes a row into the face's local canon
 * `bags/daemon-<F>` (local, unsigned), and `lift` carries one staged row to the fleet.
 *
 * LIFT WITH EYES. A lift reads the staged row back first (`kahua-read` `staged`) and prints its preview (title, digest,
 * fields, body); it lifts only on that digest typed back at a terminal, or `--digest <hex>` naming the digest the preview
 * printed. A bare `--yes` names no digest and lifts nothing. The door re-reads the row and refuses `kahua-lift-unstaged` or
 * `kahua-lift-digest-moved`, so the signed lift carries exactly the row the person read. A lift names its taint list
 * (`--taint none` when every input came from inside the face); the row reads the lōkahi cap off the vessel's island and
 * the operator's grant out of sealed custody, and refuses by name. After a root rotation the earlier items read in
 * history alone until the operator's hand `carry`s them (named cids, or `--all`): one root-signed act at the current
 * epoch. An AI seat proposes and stages (`propose`, `stage`, or the MCP's `kahua_propose`); its session never runs a
 * lift, a withdraw or a carry, and no MCP tool carries.
 *
 * Meme: lar:///ha.ka.ba/lares/docs/pono/kahua-memory-stage
 */
import { readFileSync } from "node:fs";
import { createInterface } from "node:readline/promises";
import type { ParsedArgs } from "../parse-args.js";
import { helpLines } from "../command-help.js";
import { refuseUsage } from "../render.js";
import { storeVerb, StoreDoorRefusal } from "../store-door.js";

const ACTS = new Set(["mint", "propose", "stage", "lift", "withdraw", "carry", "list", "get"]);

function faceOf(args: ParsedArgs): { face?: number } {
  const raw = args.options["face"];
  if (args.flags["face"] !== undefined) throw new Error("face-malformed: --face needs a whole persona index");
  if (raw === undefined) return {};
  if (!/^(?:0|[1-9][0-9]*)$/.test(raw) || !Number.isSafeInteger(Number(raw))) throw new Error("face-malformed: --face needs a whole persona index from 0");
  return { face: Number(raw) };
}

function json(raw: string | undefined, key: string): unknown {
  if (raw === undefined) return undefined;
  try { return JSON.parse(raw) as unknown; }
  catch { throw new Error(`${key}-malformed: --${key} needs JSON`); }
}

function stageArgs(args: ParsedArgs, title: string): Record<string, unknown> {
  const text = args.options["text"], file = args.options["file"];
  if ((text === undefined) === (file === undefined)) throw new Error("kahua-stage-text: name the row's body by --text or --file (one of them)");
  const fields = json(args.options["fields"], "fields");
  return { title, text: text ?? readFileSync(file!, "utf8"), ...(fields !== undefined ? { fields } : {}) };
}

function liftArgs(args: ParsedArgs, title: string): Record<string, unknown> {
  const taint = args.options["taint"];
  if (taint === undefined) throw new Error("kahua-act-refused: taint: name --taint (`none` when every input came from inside the face)");
  if (args.options["text"] !== undefined || args.options["file"] !== undefined || args.options["fields"] !== undefined) {
    throw new Error("kahua-lift-unstaged: a lift carries a staged row's own body and fields; stage them first (`lares kahua stage`)");
  }
  const parent = args.options["parent"];
  const sources = json(args.options["sources"], "sources");
  return {
    title,
    taint: taint === "none" ? [] : taint.split(",").map((t) => t.trim()).filter((t) => t.length > 0),
    ...(sources !== undefined ? { sources } : {}),
    ...(parent !== undefined ? { parent: parent === "none" ? null : parent } : {}),
    ...(args.options["proposal"] !== undefined ? { proposal: args.options["proposal"] } : {}),
  };
}

/** The staged row's preview as `kahua-read` `staged` answers it. */
export interface KahuaStagedPreview {
  readonly title: string; readonly digest: string; readonly relation: string; readonly text: string;
  readonly fields: Readonly<Record<string, string>>; readonly heads: ReadonlyArray<{ readonly cid: string; readonly carries: boolean }>;
}

/** The preview lines a person reads before a lift: what the row carries, and whether a head already carries it. */
export function kahuaPreviewLines(p: KahuaStagedPreview): string[] {
  const body = p.text.length > 600 ? `${p.text.slice(0, 600)}… (${p.text.length} chars)` : p.text;
  return [
    `lift preview — ${p.title}`,
    `  from    bags/daemon-${p.relation}`,
    `  digest  ${p.digest}`,
    ...Object.entries(p.fields).sort(([a], [b]) => (a < b ? -1 : 1)).map(([k, v]) => `  field   ${k}: ${v}`),
    `  heads   ${p.heads.length === 0 ? "none (a first lift)" : p.heads.map((h) => `${h.cid.slice(0, 12)}${h.carries ? " (carries this row: the lift lands nothing)" : " (differs)"}`).join(", ")}`,
    "  body:",
    ...body.split("\n").map((l) => `    ${l}`),
  ];
}

/**
 * THE CONFIRM: the digest a lift names. `--digest` must name the preview's digest; else a terminal asks for the digest's
 * first eight hex typed back; else nothing confirms, and the lift refuses `kahua-lift-unconfirmed` (a bare --yes too).
 */
export async function confirmedDigest(preview: KahuaStagedPreview, named: string | undefined, ask: ((prompt: string) => Promise<string>) | null): Promise<string> {
  if (named !== undefined) {
    if (named !== preview.digest) throw new Error(`kahua-lift-digest-moved: the staged row reads digest ${preview.digest}, not the ${named} named; read its preview again`);
    return named;
  }
  if (ask === null) throw new Error("kahua-lift-unconfirmed: a lift needs eyes: read the preview and name --digest <hex> as it printed it, or run at a terminal and type the digest back (a bare --yes lifts nothing)");
  const typed = (await ask(`type the first 8 hex of the digest (${preview.digest.slice(0, 8)}…) to lift "${preview.title}", anything else lifts nothing: `)).trim().toLowerCase();
  if (typed.length < 8 || !preview.digest.startsWith(typed)) throw new Error("kahua-lift-unconfirmed: the typed digest did not match; nothing lifted");
  return preview.digest;
}

/** A terminal's line reader, or null where either end stands no TTY. */
function ttyAsk(): ((prompt: string) => Promise<string>) | null {
  if (!process.stdin.isTTY || !process.stdout.isTTY) return null;
  return async (prompt) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    try { return await rl.question(prompt); } finally { rl.close(); }
  };
}

export async function cmdKahua(args: ParsedArgs, ask: ((prompt: string) => Promise<string>) | null = ttyAsk()): Promise<number> {
  const [act, target] = args.positional;
  if (!act || !ACTS.has(act)) return refuseUsage(args, "kahua", helpLines("kahua"));
  try {
    const face = faceOf(args);
    const need = (what: string): string => { if (!target) throw new Error(`${act}: name ${what}`); return target; };
    let door: "kahua-mint" | "kahua-propose" | "kahua-stage" | "kahua-lift" | "kahua-withdraw" | "kahua-carry" | "kahua-read";
    let payload: Record<string, unknown>;
    switch (act) {
      case "mint": door = "kahua-mint"; payload = {}; break;
      case "propose": {
        const proposals = json(args.options["proposals"], "proposals");
        if (!Array.isArray(proposals)) throw new Error("kahua-proposal-proposals: name --proposals as a JSON list of {title, revision, text|digest, taint}");
        door = "kahua-propose"; payload = { proposals };
        break;
      }
      case "stage": door = "kahua-stage"; payload = stageArgs(args, need("a title")); break;
      case "lift": {
        const lift = liftArgs(args, need("a title"));
        // LIFT WITH EYES: the preview first, then the digest the person confirms; the door re-reads the row at the act.
        const { output } = await storeVerb("kahua-read", { ...face, action: "staged", title: lift["title"] });
        const preview = output as unknown as KahuaStagedPreview;
        for (const line of kahuaPreviewLines(preview)) console.error(line);
        const digest = await confirmedDigest(preview, args.options["digest"], ask);
        door = "kahua-lift"; payload = { ...lift, digest };
        break;
      }
      case "withdraw": door = "kahua-withdraw"; payload = { target: need("a revision cid") }; break;
      case "carry": {
        const cids = args.positional.slice(1), all = args.flags["all"] === true;
        if (all === (cids.length > 0)) throw new Error("carry: name the revision cids that keep standing, or --all (never both)");
        door = "kahua-carry"; payload = all ? { all: true } : { cids };
        break;
      }
      case "list": door = "kahua-read"; payload = { action: "list" }; break;
      default: door = "kahua-read"; payload = { action: "get", title: need("a title"), ...(args.flags["history"] === true ? { history: true } : {}) };
    }
    const { output } = await storeVerb(door, { ...face, ...payload });
    console.log(JSON.stringify(output));
    return 0;
  } catch (err) {
    if (err instanceof StoreDoorRefusal || err instanceof Error) { console.error(`[lares kahua] refused: ${err.message}`); return 1; }
    throw err;
  }
}
