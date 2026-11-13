/**
 * console-door — the `lares` door a person reaches from the browser's console
 * (lar:///ha.ka.ba/lares/docs/pono/browser-vessel-lift#/the-console-door).
 *
 * ONE CALL FORM: the CLI's own argv, one word per string: `lares("vessel", "read")`, `lares("help")`. The page holds no
 * shell, so no quoting law stands here to parse a single string by; a spaced string refuses `usage` and names the form. The
 * door answers a Promise of the CLI's `--json` shape and never rejects, so a console prints the refusal as it prints the
 * answer. `--json` names what the door always answers and changes nothing.
 *
 * THE DOOR HOLDS NO LIST. Its rows come from two tables read at the call (`console-verbs.ts`): the page's own and the vessel
 * worker's, asked over the page's one port (`verb`, answered by `reply`). `help` prints both. A verb neither table holds
 * refuses by name; where the house knows why a browser vessel cannot hold it (the host shim's verbs, a verb that needs an
 * inbound socket, a verb that takes a hand), the refusal carries that reason.
 *
 * NO SECRET RIDES THE CONSOLE. The page's heap hosts the mirror and whatever a wiki's content runs, so the door takes no
 * passphrase, seed or key as a word: only a held verb's exact path crosses the port, a word past a path refuses `usage`,
 * and no refusal reads a caller's word back. A verb that needs a hand opens a ceremony ask or says where the hand goes.
 */
import { ConsoleRefused, type ConsoleHelp, type ConsoleResult, type ConsoleVerbTable } from "./console-verbs.js";

export interface ConsoleDoorEnv {
  /** The rows the page itself runs. A page row at a path the vessel also holds answers for both (the page composes). */
  readonly page: ConsoleVerbTable;
  /** The vessel worker's `verb` call over the page's port, or null where no vessel worker greets this tab. */
  readonly vessel: () => ((argv: readonly string[]) => Promise<unknown>) | null;
  /** Why no vessel worker greets this tab, in words. */
  readonly vesselAbsent: () => string;
}

export type ConsoleDoor = (...argv: unknown[]) => Promise<ConsoleResult>;

const FORM = "lares(\"vessel\", \"read\")";
const HELP_ROW = { verb: "help", summary: "list the verbs this browser vessel answers now, and the ones it holds and cannot run yet", holder: "page" } as const;

/**
 * WHY A BROWSER VESSEL HOLDS NO SUCH VERB, where the house knows. Each row names CLI paths and the one reason they share; a
 * path absent here refuses under the generic `verb-not-held`. A table's own row always answers first, so a verb the vessel
 * learns to hold needs no edit here to start answering.
 */
const NOT_HELD: readonly { readonly paths: readonly string[]; readonly code: string; readonly reason: (path: string) => string }[] = [
  { paths: ["up", "down", "build", "found", "logs"], code: "host-shim-verb",
    reason: (p) => `\`${p}\` belongs to the host shim: it stands, stops, builds, founds or reads a container on a host. A browser vessel stands when its page loads and founds from the page's own founding door.` },
  { paths: ["vessel stand", "vessel stop", "vessel found", "herm", "host", "intent-relay"], code: "needs-inbound-socket",
    reason: (p) => `\`${p}\` stands or tends a listening socket, and a browser opens none: this vessel dials a hearth's relay and serves nobody.` },
  { paths: ["vault unlock", "vault bind", "vault unbind", "vault rewrap", "vault backup", "vault restore", "raise", "rotate-place"], code: "hand-needed",
    reason: (p) => `\`${p}\` takes a person's hand and a secret, and the console takes neither. The vessel raises its ask at the top of the page, and the ceremony document it opens takes the secret.` },
  { paths: ["export", "import"], code: "syncs-by-join",
    reason: (p) => `\`${p}\` carries a house's authored memory across a re-founding. A browser vessel carries no bundle: what a face holds reaches it by sync once the face joins here.` },
  { paths: ["fleet"], code: "page-door-holds-it",
    reason: () => "a fleet join moves by carried files: the page's own fleet door (paste, file or QR, under identity & admit) takes and shows them." },
];

/** Stand the door over the page's table and the vessel's port. */
export function standConsoleDoor(env: ConsoleDoorEnv): ConsoleDoor {
  const refuse = (code: string, reason: string): ConsoleResult => ({ ok: false, error: { code, message: `${code}: ${reason}` } });
  const refusalOf = (err: unknown): ConsoleResult => {
    if (err instanceof ConsoleRefused) return { ok: false, error: { code: err.refusal, message: err.message } };
    // A refusal the vessel named crosses the port with its name (`VesselRefused.refusal`).
    const refusal = (err as { refusal?: unknown } | null)?.refusal;
    return { ok: false, error: { code: typeof refusal === "string" ? refusal : "error", message: err instanceof Error ? err.message : String(err) } };
  };
  /** The vessel's own rows as it stands now, or why it names none. */
  const vesselRows = async (): Promise<{ readonly help: ConsoleHelp; readonly why: null } | { readonly help: null; readonly why: string }> => {
    const verb = env.vessel();
    if (!verb) return { help: null, why: env.vesselAbsent() };
    try {
      const help = await verb(["help"]) as ConsoleHelp | null;
      if (!help || !Array.isArray(help.entries) || !Array.isArray(help.waits)) return { help: null, why: "the vessel worker answered no help" };
      return { help, why: null };
    } catch (err) {
      return { help: null, why: `the vessel worker answered no help (${err instanceof Error ? err.message : String(err)})` };
    }
  };

  return async (...argv: unknown[]): Promise<ConsoleResult> => {
    try {
      if (!argv.every((word): word is string => typeof word === "string" && /^\S+$/.test(word))) {
        return refuse("usage", `the door takes the CLI's own argv, one word per string: ${FORM}`);
      }
      const words = argv.filter((word) => word !== "--json");
      const verb = words.join(" ");
      const held = await vesselRows();
      const page = await env.page.help();
      const pagePaths = new Set([...page.entries, ...page.waits].map((row) => row.verb));
      const vesselPaths = new Set(held.help ? [...held.help.entries, ...held.help.waits].map((row) => row.verb) : []);

      if (words.length === 0 || verb === "help") {
        const fromVessel = <T extends { readonly verb: string }>(rows: readonly T[]): (T & { holder: string })[] =>
          rows.filter((row) => !pagePaths.has(row.verb)).map((row) => ({ ...row, holder: "vessel" }));
        const byVerb = (a: { readonly verb: string }, b: { readonly verb: string }): number => a.verb.localeCompare(b.verb);
        return { ok: true, data: {
          form: FORM,
          entries: [HELP_ROW, ...page.entries.map((row) => ({ ...row, holder: "page" })), ...fromVessel(held.help?.entries ?? [])].sort(byVerb),
          waits: [...page.waits.map((row) => ({ ...row, holder: "page" })), ...fromVessel(held.help?.waits ?? [])].sort(byVerb),
          vessel: held.why ?? "answers",
        } };
      }
      if (pagePaths.has(verb)) return { ok: true, data: await env.page.run(words) };
      const cross = env.vessel();
      if (vesselPaths.has(verb) && cross) return { ok: true, data: await cross(words) };

      const under = ["help", ...pagePaths, ...vesselPaths].find((path) => verb.startsWith(`${path} `));
      if (under) return refuse("usage", `\`${under}\` takes no argument here. A secret never rides the console: a verb that needs one raises its ask on the page, and the ceremony document takes it.`);
      for (const row of NOT_HELD) {
        const path = row.paths.find((p) => verb === p || verb.startsWith(`${p} `));
        if (path) return refuse(row.code, row.reason(path));
      }
      return refuse("verb-not-held", `this browser vessel holds no such verb${held.why ? ` (${held.why}, so its own rows read absent)` : ""}; lares("help") lists what it answers.`);
    } catch (err) {
      return refusalOf(err);
    }
  };
}

/** Seat the door on the page's global as `lares`: read-only, so no later script replaces the door a person calls. */
export function installConsoleDoor(target: object, door: ConsoleDoor): void {
  Object.defineProperty(target, "lares", { value: door, writable: false, configurable: false, enumerable: false });
}
