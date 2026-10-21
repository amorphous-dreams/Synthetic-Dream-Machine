/** A production-holder island witness: its Web Lock exists exactly while this worker lives. */
import { deviceEdgeDigest } from "@lararium/mesh/holder-session-proof";

const id = new URL(self.location.href).searchParams.get("id");
if (!id) throw new Error("stub island needs a lock id");
const lockName = `island:${id}`;
void navigator.locks.request(lockName, async () => new Promise<void>(() => {}));
self.postMessage({ type: "ready" });
self.addEventListener("message", (event: MessageEvent) => {
  const message = event.data as { type?: string; daemonAuth?: { deviceEdge?: Parameters<typeof deviceEdgeDigest>[0] } };
  if (message?.type !== "manifest") return;
  const edge = message.daemonAuth?.deviceEdge;
  if (!edge) throw new Error("manifest names no device edge");
  self.postMessage({ type: "gate:clear", edgeDigest: deviceEdgeDigest(edge), personaRoot: edge.personaRootDid });
});
