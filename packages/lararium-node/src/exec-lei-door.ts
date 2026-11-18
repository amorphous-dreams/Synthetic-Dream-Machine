/**
 * exec-lei-door — the node vessel's main-thread half of the exec-lei port (backlog-awakens "The executable-record lei").
 *
 * The daemon island holds no key, so its port (`islandExecLeiPort`) routes `exec-lei-spend` here; this reactor spends one return
 * of the standing exec lei over the control document's swarm wiki, under the mounted face's trust and the vessel's own signer
 * (`execLeiPortOver`). A refusal throws as the lei grammar names it (`<code>: <detail>`), and the island reads its code back, so
 * the door offers by the lei's own reading.
 */
import { SwarmRefused, execLeiPortOver, type SwarmSignerPort, type SwarmTrust, type SwarmWikiPort } from "@lararium/mesh";

export interface ExecLeiSpendDeps {
  readonly wiki: SwarmWikiPort;
  /** The mounted face's group and trust, and the vessel's own signer (this device's atom in the face), read at each spend. */
  readonly face: () => Promise<{ readonly group: string; readonly trust: SwarmTrust; readonly spender: SwarmSignerPort }>;
}

export function makeExecLeiSpendReactor(deps: ExecLeiSpendDeps): (args: Readonly<Record<string, unknown>>) => Promise<Record<string, unknown>> {
  return async (args) => {
    const fields = args["fields"];
    if (typeof args["wiki"] !== "string" || typeof args["title"] !== "string" || typeof fields !== "object" || fields === null || Array.isArray(fields)) {
      throw new SwarmRefused("swarm-lei-malformed", "an exec spend names its wiki, its record's title and the record's fields");
    }
    const face = await deps.face();
    const spent = await execLeiPortOver({ wiki: deps.wiki, trust: face.trust, group: face.group, spender: face.spender })
      .spend({ wiki: args["wiki"], title: args["title"], fields: fields as Record<string, unknown>, ...(typeof args["writer"] === "string" ? { writer: args["writer"] } : {}) });
    return { lei: spent.lei, n: spent.n };
  };
}
