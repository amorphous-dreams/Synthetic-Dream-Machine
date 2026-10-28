import { makePortDelivery, makePortTransport } from "./port-transport.js";

/** The page's one port road: the vessel's reply door feeds `delivery`, and the glass adaptor reads `pagePort()`. */
export const pagePortDelivery = makePortDelivery();
let transport: ReturnType<typeof makePortTransport> | null = null;

/** Stand the page's transport over the vessel's port doors once the vessel returns. */
export function standPagePort(doors: Parameters<typeof makePortTransport>[0]["doors"], surface: () => string | null): ReturnType<typeof makePortTransport> {
  transport = makePortTransport({ doors, surface });
  pagePortDelivery.attach(transport);
  return transport;
}

/** The page's transport, or null before the vessel stands. */
export function pagePort(): ReturnType<typeof makePortTransport> | null { return transport; }
