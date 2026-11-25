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
import type { Credential } from "@lararium/mesh/keyslot-door";
import { seatWardGatherer, gatherSeatedWardRoute, parkWardTicket, wardBindDigest, wardCredential, wardGathererSeated, storeVerbNeedsWard, type WardCredential } from "@lararium/node";
import { readWardPassphrase } from "./prompt-secret.js";
import { RoutedVerbRefused } from "./store-door.js";

/** One ward act's route, as this process asks it: the gatherer the process seated (the binary seats `ttyWardRoute`). */
export async function gatherWardRoute(verb: string, face?: number): Promise<Credential[]> {
  return wardGathererSeated() ? [...await gatherSeatedWardRoute(verb, face)] : ttyWardRoute(verb, face);
}

/**
 * The terminal's own answer: a passphrase typed at a terminal, and nothing else. No file answers for it: a test harness that
 * drives the CLI with no terminal seats its route explicitly (`tools/test-ward-route.mjs`, loaded ahead of the binary).
 */
export async function ttyWardRoute(verb: string, face?: number): Promise<Credential[]> {
  return [{ kind: "passphrase", passphrase: await readWardPassphrase(verb, face !== undefined ? { face } : {}) }];
}

/** Seat the terminal gatherer, carrying the face a ward act names through, so the prompt names that face's passphrase. */
export function seatTtyWardGatherer(): void { if (!wardGathererSeated()) seatWardGatherer((what, face) => ttyWardRoute(what, face)); }

/** The token an in-process act takes (a direct row, the recovery split). */
export async function gatherWard(verb: string, face?: number): Promise<WardCredential> {
  return wardCredential(await gatherWardRoute(verb, face));
}

/**
 * The `wardRef` a store verb names when it is a ward act, or nothing when it is not. The ref is bound to this verb and these
 * arguments, so only this act spends it. A standing vessel parks the route over its custody door; with none standing, the route
 * parks in this process, where the direct row takes it. A caller that already gathered the person's route in this same act (the
 * unlock that strings a keep lei, `./keep-at-unlock.ts`) hands it in as `route`, and nothing asks again.
 */
export async function wardTicketFor(verb: string, args: Readonly<Record<string, unknown>>, daemonUp: boolean, handed?: readonly Credential[]): Promise<Record<string, unknown>> {
  if (!storeVerbNeedsWard(verb, args)) return {};
  // The act names its face where the row carries one; else the prompt asks the worn face's route.
  const face = typeof args["face"] === "number" ? args["face"] : undefined;
  const route = handed !== undefined ? [...handed] : await gatherWardRoute(`lares ${verb}`, face);
  if (!daemonUp) return { wardRef: parkWardTicket(wardCredential(route), { verb, args }) };
  const { sendCustodyFrame } = await import("./custody-door.js");
  const answer = await sendCustodyFrame({ op: "ward", credentials: route, verb, argsDigest: wardBindDigest({ verb, args }) });
  const ticket = answer && typeof (answer as { ref?: unknown }).ref === "string" ? (answer as { ref: string }).ref : null;
  if (ticket === null) throw new RoutedVerbRefused("the standing vessel did not take the ward route over its custody door; nothing acted", "ward-route-unparked");
  return { wardRef: ticket };
}
