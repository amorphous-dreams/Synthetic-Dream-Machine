/** A single sealed submission at one face's relay gate. */
import { MIN_MESSAGE1_BYTES, MIN_MESSAGE2_BYTES, encodeIntentRelayResult, readIntentRelaySubmit, type GateBundle, type GateDeadlines, type GateOutcome, type GateSocket, type IntentRelayResult } from "@lararium/mesh";
import type { IntentRelayOutcome, StandableGate } from "./face-gate-server.js";

const accepted = new WeakSet<GateSocket>();
function sameText(a: string, b: string): boolean {
  let difference = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++) difference |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return difference === 0;
}
export function makeIntentRelayGate(deps: {
  readonly bundle: GateBundle;
  readonly group: string;
  readonly ring: { admits(group: string): Promise<boolean> };
  readonly admit: (entry: unknown) => Promise<IntentRelayResult>;
  readonly deadlines: GateDeadlines;
  readonly maxPending?: number;
}): StandableGate {
  let pending = 0;
  const maxPending = deps.maxPending ?? 50;
  const silence = (reason: Extract<GateOutcome, { outcome: "silence" }>["reason"]): GateOutcome => ({ outcome: "silence", reason });
  return {
    get pending() { return pending; },
    preflight(message1) {
      if (!(message1 instanceof Uint8Array) || message1.length !== MIN_MESSAGE1_BYTES) return false;
      try { deps.bundle.respond(message1); return true; } catch { return false; }
    },
    async accept(socket): Promise<GateOutcome | IntentRelayOutcome> {
      if (accepted.has(socket)) return silence("socket-reused");
      accepted.add(socket);
      if (pending >= maxPending) return silence("pending-full");
      pending++;
      let lapsed = false;
      let lapse!: () => void;
      const expired = new Promise<null>((resolve) => { lapse = () => resolve(null); });
      const deadline = deps.deadlines.draw(() => { lapsed = true; socket.cut(); lapse(); });
      try {
        if (!sameText(socket.flight.knock, deps.bundle.knock)) return silence("knock-foreign");
        if (!(socket.flight.message1 instanceof Uint8Array) || socket.flight.message1.length !== MIN_MESSAGE1_BYTES) return silence("flight-length");
        let transport;
        try {
          const first = deps.bundle.respond(socket.flight.message1);
          const second = first.writeMessage2();
          if (first.payload.length !== 0 || second.message2.length !== MIN_MESSAGE2_BYTES) return silence("flight-undecrypted");
          transport = second.transport;
          if (!lapsed) socket.send(second.message2);
        } catch { return silence("flight-undecrypted"); }
        const frame = await Promise.race([socket.recv(), expired]);
        if (frame === null || lapsed) return silence("presentation-absent");
        let plain: Uint8Array;
        try { plain = transport.receive.open(frame); } catch { return silence("presentation-frames"); }
        const submitted = readIntentRelaySubmit(plain);
        if (!submitted.ok) return silence("presentation-frames");
        const admitted = await Promise.race([deps.ring.admits(deps.group), expired]);
        if (admitted !== true || lapsed) return silence("sorted-silent");
        const result = await Promise.race([deps.admit(submitted.entry), expired]);
        if (result === null || lapsed) return silence("deadline-before-answer");
        socket.send(transport.send.seal(encodeIntentRelayResult(result)));
        return { outcome: "relay-answered", status: result.status };
      } catch { return silence("fault"); }
      finally { deadline.cancel(); pending--; }
    },
  };
}
