import { TW5Engine, makeGlassPortAdaptor, mountGlassCamera } from "@lararium/tw5/glass";
import type { GlassTransport } from "@lararium/tw5/glass";
import type { GlassBootInputs } from "./cas.js";
import type { GlassWidth } from "./flag.js";
import type { ReturnTypeOfPagePort } from "./transport-type.js";

export async function bootGlass({ host, inputs, port, wikiUri, actor, width }: {
  host: HTMLElement; inputs: GlassBootInputs; port: ReturnTypeOfPagePort;
  wikiUri: string; actor: string; width: GlassWidth;
}) {
  const engine = new TW5Engine();
  await engine.boot({ bytes: inputs.coreBytes, sha256: inputs.coreCid }, inputs.preloadedTiddlers, { glass: true });
  const tw = engine.$tw;
  let adaptor: ReturnType<typeof makeGlassPortAdaptor> | null = null;
  let camera: ReturnType<typeof mountGlassCamera> | null = null;
  const teardown = (): void => { camera?.unmount(); adaptor?.close(); engine.dispose(); engine.releaseGlass(); };
  try {
  const shadowRoot = host.shadowRoot ?? host.attachShadow({ mode: "open" });
  const transport: GlassTransport = {
    send: message => port.send(message),
    onMessage: listener => port.onMessage(message => {
      if (message.type.startsWith("port:")) listener(message as unknown as Parameters<typeof listener>[0]);
    }),
  };
  adaptor = makeGlassPortAdaptor({ wiki: tw.wiki, Tiddler: tw.Tiddler, transport,
    portId: crypto.randomUUID(), wikiUri, actor, width, mintTx: () => crypto.randomUUID() });
  camera = mountGlassCamera({ tw, shadowRoot });
  } catch (error) { teardown(); throw error; }
  let mounted = true;
  return { tw, adaptor: adaptor!, unmount() {
    if (!mounted) return;
    mounted = false;
    teardown();
  } };
}
