/**
 * ward-door — THE CLI'S ONE PLACE A WARD ACT'S ROUTE IS READ, and how it reaches the act.
 *
 * A ward act (seat-harness#/the-ward) opens the face's ward key fresh from a human route. Here the route comes from a TTY alone
 * (`readWardPassphrase`: an environment variable or a piped stdin refuses `ward-needs-tty`), or from a gatherer a test seated
 * explicitly; no file ever answers for it. It reaches the act one of two ways and never through a store verb's arguments (those
 * get hashed into a receipt): a standing vessel takes it over ONE custody frame and answers a one-use ticket the verb names; with no
 * vessel standing, the route parks in this process under the same kind of ticket. Nothing here keeps a route past its act.
 *
 * Meme: lar:///ha.ka.ba/lares/cli/vessel-door
 */
import type { Credential } from "@lararium/mesh";
import { gatherSeatedWardRoute, parkWardTicket, wardBindDigest, wardCredential, wardGathererSeated, storeVerbNeedsWard, type WardCredential } from "@lararium/node";
import { readWardPassphrase } from "./prompt-secret.js";
import { RoutedVerbRefused } from "./store-door.js";

/** One ward act's route, as this process asks it: the gatherer the process seated (the binary seats `ttyWardRoute`). */
export async function gatherWardRoute(verb: string): Promise<Credential[]> {
  return wardGathererSeated() ? [...await gatherSeatedWardRoute(verb)] : ttyWardRoute(verb);
}

/**
 * The terminal's own answer: a passphrase typed at a terminal, and nothing else. No file answers for it: a test harness that
 * drives the CLI with no terminal seats its route explicitly (`tools/test-ward-route.mjs`, loaded ahead of the binary).
 */
export async function ttyWardRoute(verb: string): Promise<Credential[]> {
  return [{ kind: "passphrase", passphrase: await readWardPassphrase(verb) }];
}

/** The token an in-process act takes (a direct row, the recovery split). */
export async function gatherWard(verb: string): Promise<WardCredential> {
  return wardCredential(await gatherWardRoute(verb));
}

/**
 * The `wardRef` a store verb names when it is a ward act, or nothing when it is not. The ref is bound to this verb and these
 * arguments, so only this act spends it. A standing vessel parks the route over its custody door; with none standing, the route
 * parks in this process, where the direct row takes it.
 */
export async function wardTicketFor(verb: string, args: Readonly<Record<string, unknown>>, daemonUp: boolean): Promise<Record<string, unknown>> {
  if (!storeVerbNeedsWard(verb, args)) return {};
  const route = await gatherWardRoute(`lares ${verb}`);
  if (!daemonUp) return { wardRef: parkWardTicket(wardCredential(route), { verb, args }) };
  const { sendCustodyFrame } = await import("./custody-door.js");
  const answer = await sendCustodyFrame({ op: "ward", credentials: route, verb, argsDigest: wardBindDigest({ verb, args }) });
  const ticket = answer && typeof (answer as { ref?: unknown }).ref === "string" ? (answer as { ref: string }).ref : null;
  if (ticket === null) throw new RoutedVerbRefused("the standing vessel did not take the ward route over its custody door; nothing acted", "ward-route-unparked");
  return { wardRef: ticket };
}
