import { makePortDelivery, makePortTransport } from "./port-transport.js";

/** The page's one port road: the vessel's reply door feeds `delivery`, and the root hands the binding it holds to the mirror explicitly. */
export const pagePortDelivery = makePortDelivery();

/** Stand the page's transport over the vessel's port doors once the vessel returns. */
export function standPagePort(doors: Parameters<typeof makePortTransport>[0]["doors"], surface: () => string | null): ReturnType<typeof makePortTransport> {
  const transport = makePortTransport({ doors, surface });
  pagePortDelivery.attach(transport);
  return transport;
}

