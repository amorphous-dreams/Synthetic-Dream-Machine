import { openMirror } from "@lararium/tw5/glass";
import type { GlassBootInputs, GlassDoor, GlassTransport, MirrorSeams } from "@lararium/tw5/glass";
import type { PortWidthName, PortWireRecord } from "@lararium/mesh/record-port";
import type { ReturnTypeOfPagePort } from "./transport-type.js";

export type GlassWidth = Extract<PortWidthName, "full" | "skinny" | "story">;

export function bootGlass({ shadowRoot, inputs, port, wikiUri, actor, width, transport, seams, deferPaint, portId, opened, door }: {
  shadowRoot: ShadowRoot; inputs: GlassBootInputs; port: ReturnTypeOfPagePort;
  wikiUri: string; actor: string; width: GlassWidth; transport?: GlassTransport; deferPaint?: boolean;
  /** The port the boot's handoff already opened, and the first whole snapshot it read: the engine boots with those records. */
  portId?: string; opened?: { records: readonly PortWireRecord[] };
  /** The surface's host doors, lent to the engine's root. */
  door?: GlassDoor;
  seams?: MirrorSeams;
}) {
  const binding: GlassTransport = transport ?? {
    send: message => port.send(message),
    onMessage: listener => port.onMessage(message => {
      if (message.type.startsWith("port:")) listener(message as unknown as Parameters<typeof listener>[0]);
    }),
  };
  return openMirror({ transport: binding, inputs, shadowRoot, wikiUri, actor, width, ...(deferPaint ? { deferPaint } : {}),
    ...(opened ? { opened } : {}), ...(door ? { door } : {}), portId: portId ?? crypto.randomUUID(), mintTx: () => crypto.randomUUID() }, seams);
}
