// The custody proof's entry (lar:///ha.ka.ba/lares/docs/pono/browser-vessel-lift#/the-confirm-gate): the ceremony document
// spawns this worker for one question and ends it with its answer. It reads this origin's slot trees through
// `@lararium/browser`'s proof door and writes nothing; it serves no vessel, opens no session and holds no key past its answer.
// A passphrase arrives as UTF-8 bytes on a transferred buffer, decodes here and zero-fills at once; no answer and no log line
// carries a byte of it.
//
// THE LISTENER STANDS FIRST. The proof's modules load by a dynamic import, after this entry's own synchronous body set its
// message listener: a module graph that awaits at its top level would otherwise start the worker's event loop before any
// listener stood, and the one question would drop unheard with no error to name it. A graph that does not load answers
// `proof:failed`. The proof door rides `@lararium/mesh/keyslot` alone (no WASM, no Repo), so it stands under any policy.
import type { ProofAnswer, ProofAsk } from "../ceremony-protocol.js";

const scope = self as unknown as { postMessage(msg: ProofAnswer): void; addEventListener(type: "message", l: (e: MessageEvent) => void): void };

async function answer(ask: ProofAsk): Promise<ProofAnswer> {
  const { proveCustodyRoute, readCustodyTrees } = await import("@lararium/browser/custody-proof");
  if (ask.t === "proof:read") {
    let readable = 0;
    for (const store of ask.stores) readable += (await readCustodyTrees(store)).readable;
    return { t: "proof:readable", readable };
  }
  const bytes = new Uint8Array(ask.bytes);
  let passphrase: string;
  try { passphrase = new TextDecoder("utf-8", { fatal: true }).decode(bytes); } finally { bytes.fill(0); }
  let judged = false;
  for (const store of ask.stores) {
    const proof = await proveCustodyRoute(store, [{ kind: "passphrase", passphrase }]);
    if (proof.reading === "opens") return { t: "proof:proved", reading: "opens" };
    if (proof.reading === "no-slot-opens") judged = true;
  }
  return { t: "proof:proved", reading: judged ? "no-slot-opens" : "unverifiable" };
}

scope.addEventListener("message", (e: MessageEvent) => {
  const ask = e.data as ProofAsk | null;
  if (!ask || (ask.t !== "proof:read" && ask.t !== "proof:prove") || !Array.isArray(ask.stores) || !ask.stores.every((s) => typeof s === "string")) {
    scope.postMessage({ t: "proof:failed", why: "the proof takes one read or one prove over named stores" });
    return;
  }
  // The failure names its kind alone: a refusal's own words never ride back, so nothing typed can ride with them.
  void answer(ask).then((msg) => scope.postMessage(msg), (err: unknown) => scope.postMessage({ t: "proof:failed", why: err instanceof Error ? err.name : "Error" }));
});
