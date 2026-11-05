/**
 * ward-door — THE CLI'S ONE PLACE A WARD ACT'S ROUTE IS READ, and how it reaches the act.
 *
 * A ward act (seat-harness#/the-ward) opens the face's ward key fresh from a human route. Here the route comes from a TTY alone
 * (`readWardPassphrase`: an environment variable or a piped stdin refuses `ward-needs-tty`), or, under a root a harness staged, from
 * the published test route named in the open. It reaches the act one of two ways and never through a store verb's arguments (those
 * get hashed into a receipt): a standing vessel takes it over ONE custody frame and answers a one-use ticket the verb names; with no
 * vessel standing, the route parks in this process under the same kind of ticket. Nothing here keeps a route past its act.
 *
 * Meme: lar:///ha.ka.ba/lares/cli/vessel-door
 */
import type { Credential } from "@lararium/mesh";
import { parkWardTicket, wardCredential, storeVerbNeedsWard, type WardCredential } from "@lararium/node";
import { readWardPassphrase } from "./prompt-secret.js";
import { TEST_ROUTE_PASSPHRASE, testScratchRoot } from "./offline-custody.js";

/** One ward act's route: the published test route on a staged root, else a passphrase typed at a terminal. */
export async function gatherWardRoute(verb: string): Promise<Credential[]> {
  if (testScratchRoot()) {
    process.stderr.write(`[ward] TEST SCRATCH ROOT: ${verb} opens the face's ward under the published test route\n`);
    return [{ kind: "passphrase", passphrase: TEST_ROUTE_PASSPHRASE }];
  }
  return [{ kind: "passphrase", passphrase: await readWardPassphrase(verb) }];
}

/** The token an in-process act takes (a direct row, the recovery split). */
export async function gatherWard(verb: string): Promise<WardCredential> {
  return wardCredential(await gatherWardRoute(verb));
}

/**
 * The `wardTicket` a store verb names when it is a ward act, or nothing when it is not. A standing vessel parks the route over its
 * custody door; with none standing, the route parks in this process, where the direct row takes it.
 */
export async function wardTicketFor(verb: string, args: Readonly<Record<string, unknown>>, daemonUp: boolean): Promise<Record<string, unknown>> {
  if (!storeVerbNeedsWard(verb, args)) return {};
  const route = await gatherWardRoute(`lares ${verb}`);
  if (!daemonUp) return { wardTicket: parkWardTicket(wardCredential(route)) };
  const { sendCustodyFrame } = await import("./custody-door.js");
  const answer = await sendCustodyFrame({ op: "ward", credentials: route });
  const ticket = answer && typeof (answer as { ticket?: unknown }).ticket === "string" ? (answer as { ticket: string }).ticket : null;
  if (ticket === null) throw new Error("the standing vessel did not take the ward route over its custody door; nothing acted");
  return { wardTicket: ticket };
}
