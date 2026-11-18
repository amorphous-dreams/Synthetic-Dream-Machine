/**
 * exec-lei-route — the daemon island's half of the exec-lei port (backlog-awakens "The executable-record lei").
 *
 * The island holds no key, so a write door's spend (`ctx.execLei`) routes one internal verb, `exec-lei-spend`, to the vessel's
 * main thread, which spends under its own signer (node: `exec-lei-door.ts`). A refusal crosses back as its message and reads back
 * by its code (`swarmRefusedFromMessage`); a route that answers nothing reads `swarm-lei-port-unanswered`, so the door offers.
 */
import { EXEC_LEI_SPEND_VERB, swarmRefusedFromMessage, type ExecLeiPort, type Verb } from "@lararium/mesh";

export function islandExecLeiPort(route: (invocation: Verb) => Promise<Record<string, unknown>>, newId: () => string): ExecLeiPort {
  return { spend: async (land) => {
    const requestId = `exec-lei-${newId()}`;
    const invocation = {
      title: `exec-lei/${requestId}`, requestId, action: EXEC_LEI_SPEND_VERB, requestedBy: "island", requestedAt: "",
      args: { wiki: land.wiki, title: land.title, fields: { ...land.fields }, ...(land.writer !== undefined ? { writer: land.writer } : {}) },
      targets: [], batchMode: "best-effort", status: "pending",
    } as unknown as Verb;
    let answer: Record<string, unknown>;
    try { answer = await route(invocation); }
    catch (error) { throw swarmRefusedFromMessage(error instanceof Error ? error.message : String(error)); }
    if (typeof answer["lei"] !== "string" || typeof answer["n"] !== "number") throw swarmRefusedFromMessage("the vessel answered the spend with no return");
    return { lei: answer["lei"], n: answer["n"] };
  } };
}
