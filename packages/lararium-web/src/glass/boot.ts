import { openMirror } from "@lararium/tw5/glass";
import type { GlassTransport, MirrorSeams } from "@lararium/tw5/glass";
import type { PortWidthName } from "@lararium/mesh/record-port";
import type { GlassBootInputs } from "./cas.js";
import type { ReturnTypeOfPagePort } from "./transport-type.js";

export type GlassWidth = Extract<PortWidthName, "full" | "skinny" | "story">;

export function bootGlass({ shadowRoot, inputs, port, wikiUri, actor, width, transport, seams, deferPaint }: {
  shadowRoot: ShadowRoot; inputs: GlassBootInputs; port: ReturnTypeOfPagePort;
  wikiUri: string; actor: string; width: GlassWidth; transport?: GlassTransport; deferPaint?: boolean;
  seams?: MirrorSeams;
}) {
  const binding: GlassTransport = transport ?? {
    send: message => port.send(message),
    onMessage: listener => port.onMessage(message => {
      if (message.type.startsWith("port:")) listener(message as unknown as Parameters<typeof listener>[0]);
    }),
  };
  return openMirror({ transport: binding, inputs, shadowRoot, wikiUri, actor, width, ...(deferPaint ? { deferPaint } : {}),
    portId: crypto.randomUUID(), mintTx: () => crypto.randomUUID() }, seams);
}
