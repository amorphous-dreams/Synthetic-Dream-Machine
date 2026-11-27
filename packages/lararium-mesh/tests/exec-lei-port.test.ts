/**
 * exec-lei-port — the vessel's exec-lei port, one composition for every vessel (backlog-awakens "The executable-record lei").
 *
 * `execLeiPortOver` binds the swarm wiki, the face's trust and the vessel's own signer over `spendExecLei`; a node and a browser
 * vessel each compose it from their own control document (`docSwarmWiki`) and their own atom. A refusal crosses the island's
 * delegation as its message, and `swarmRefusedFromMessage` reads its code back, so a door offers by the lei's own reading.
 * Every red pairs with a CONTROL.
 */
import { describe, expect, test } from "vitest";
import { ed25519SignerFromSeed, ed25519VerifyingKeyFromSeed } from "../src/ed25519-door.js";
import { swarmCommand, type SwarmDoorDeps } from "../src/swarm-door.js";
import { SwarmRefused, type SwarmWikiPort } from "../src/swarm-tiddlers.js";
import { EXEC_LEI_SPEND_VERB, execLeiBranch, execLeiPortOver, swarmRefusedFromMessage } from "../src/exec-lei.js";
import { soloCosign } from "./ward-cosign-table.js";

const GROUP = "face-group", WIKI = "notes";
const keyed = async (n: number) => ({ key: await ed25519VerifyingKeyFromSeed(new Uint8Array(32).fill(n)), sign: ed25519SignerFromSeed(new Uint8Array(32).fill(n)) });

function wikiPort(): SwarmWikiPort {
  const rows = new Map<string, string>();
  return { read: async (t) => rows.get(t) ?? null, write: async (t, text) => { rows.set(t, text); }, writeNew: async (t, text) => { if (rows.has(t)) return false; rows.set(t, text); return true; },
    list: async (prefix) => [...rows.keys()].filter((t) => t.startsWith(prefix)) };
}

describe("exec-lei-port — one composition for every vessel", () => {
  test("RED: the port spends the standing lei's returns over the vessel's own signer, and past them refuses by the lei's code; CONTROL: a data record refuses not-executable", async () => {
    const hand = await keyed(1), vessel = await keyed(2), wiki = wikiPort();
    const trust = { hand: (k: string) => k === hand.key, vessel: (k: string) => k === vessel.key, place: () => false, lead: () => false };
    const deps: SwarmDoorDeps = { group: GROUP, face: { grant: (k: string) => k === hand.key, group: GROUP }, signer: hand, trust, epoch: () => 1,
      board: { records: async () => [], land: async () => {} }, wiki, who: { kind: "hand", id: "operator" }, cosign: () => soloCosign(GROUP, hand) };
    await swarmCommand({ action: "lei-kui", rite: "exec", branch: execLeiBranch(WIKI), after: null, reach: "wide", returns: 1, scope: { wiki: WIKI, writer: "seat" } }, deps);
    const port = execLeiPortOver({ wiki, trust, group: GROUP, spender: vessel });
    const land = { wiki: WIKI, title: "Boot", fields: { tags: "$:/tags/StartupAction" }, writer: "seat" };
    await expect(port.spend(land)).resolves.toMatchObject({ n: 1 });
    await expect(port.spend(land)).rejects.toMatchObject({ code: "swarm-lei-returns-spent" });
    await expect(port.spend({ ...land, fields: { text: "data" } })).rejects.toMatchObject({ code: "swarm-lei-not-executable" });
  });

  test("RED: a refusal read back off its message keeps its code; CONTROL: any other message reads as the port unanswered", () => {
    const back = swarmRefusedFromMessage("swarm-lei-absent: the exec lei for \"x\" does not stand (absent)");
    expect(back).toBeInstanceOf(SwarmRefused);
    expect(back.code).toBe("swarm-lei-absent");
    expect(swarmRefusedFromMessage("no handler registered for \"exec-lei-spend\"").code).toBe("swarm-lei-port-unanswered");
    expect(EXEC_LEI_SPEND_VERB).toBe("exec-lei-spend");
  });
});
