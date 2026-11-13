/**
 * ceremony — THE UNLOCK CEREMONY'S PARTS (browser-vessel-lift#/the-slices, slice 1b), over real MessageChannels in a real engine.
 *
 *   C1 RED      a ward ask answered with a passkey refuses `ward-passkey-refused` by name, and a ward ask offers the
 *               passphrase route alone. CONTROL: the same ask answered with a passphrase resolves it, and a custody unlock
 *               over a standing passkey pin takes the passkey.
 *   C2 RED      the ceremony's passphrase leaves on a transferred ArrayBuffer: the buffer reads detached in the sender and
 *               every field reads cleared; the vessel's side decodes the bytes and its own copy zero-fills.
 *   C3 RED      an insecure context, a frame, a policy out of force and an absent broker each refuse by name, on the
 *               ceremony document and on the page. CONTROL: a document standing under all four asks (null).
 *   C4          the page's part: one channel end crosses to the vessel, the other to the broker, the window opens with no
 *               opener on the ask's own path, and the page keeps neither end.
 *   C5 RED      `face` rides every ask (slice 3 part ii): an ask that names no face refuses `ask-face-absent`, a clear that
 *               names none (null, "this browser") refuses `clear-face-absent`, and `h<N>` names no face
 *               (`face-names-a-handle`); nothing reaches the page. CONTROL: an unlock naming the browser itself (null) and
 *               a clear naming its PersonaGroup raise their asks, the face on both the ceremony's and the page's.
 */
import { expect, test } from "vitest";
import { CeremonyRefused, decodeCeremonyAnswer, routesFor, standCeremonyDoor, type DoorToPage } from "../src/workers/ceremony-door.js";
import { ceremonyRefusal, sendPassphrase, askIdOf } from "../src/ceremony/ceremony-core.js";
import { openCeremony, pageCeremonyRefusal } from "../src/ceremony-page.js";
import type { CeremonyAsk, CeremonyToVessel, VesselToCeremony } from "../src/ceremony-protocol.js";

const next = <T>(port: MessagePort): Promise<T> => new Promise((resolve) => { port.onmessage = (e) => resolve(e.data as T); });

/** Stand a door, raise one ask, and hand it the vessel's end of a fresh channel; answers the ceremony's end and the ask it read. */
async function asked(spec: Parameters<ReturnType<typeof standCeremonyDoor>["ask"]>[0]) {
  const toPage: DoorToPage[] = [];
  let heard!: (m: DoorToPage) => void;
  const raisedOnce = new Promise<DoorToPage>((resolve) => { heard = resolve; });
  const door = standCeremonyDoor((m) => { toPage.push(m); if (m.t === "ask") heard(m); });
  const answer = door.ask(spec);
  // barrier: the door's own word to the page, never a clock.
  const raised = await raisedOnce;
  expect(raised.t, "the door raised its ask to the page").toBe("ask");
  const channel = new MessageChannel();
  const read = next<VesselToCeremony>(channel.port2);
  door.port(raised.askId, channel.port1);
  const ask = (await read) as CeremonyAsk;
  return { answer, ask, ceremony: channel.port2, toPage };
}

test("C1 RED — a ward ask answered with a passkey refuses ward-passkey-refused; CONTROL: a passphrase answers it, and a custody unlock takes a passkey", async () => {
  const ward = await asked({ kind: "ward", act: "a kāpae-lower", face: null });
  expect(ward.ask).toMatchObject({ t: "ask", kind: "ward", act: "a kāpae-lower", routes: ["passphrase"], passkeys: [] });
  expect(ward.ask.digest).toMatch(/^[0-9a-f]{64}$/);
  const id = new Uint8Array([1, 2, 3]).buffer, out = new Uint8Array(32).fill(7).buffer;
  ward.ceremony.postMessage({ t: "answer", askId: ward.ask.askId, answer: { kind: "passkey", credentialId: id, prfOutput: out } } satisfies CeremonyToVessel, [id, out]);
  const refused = await ward.answer.catch((e: unknown) => e);
  expect(refused).toBeInstanceOf(CeremonyRefused);
  expect((refused as CeremonyRefused).refusal).toBe("ward-passkey-refused");
  expect(ward.toPage.at(-1)).toEqual({ t: "ask:settled", askId: ward.ask.askId });

  // CONTROL: the same kind of ask, answered with a passphrase, resolves to that passphrase.
  const again = await asked({ kind: "ward", act: "a commit in daemon", face: null });
  const bytes = new TextEncoder().encode("a ward passphrase").buffer;
  again.ceremony.postMessage({ t: "answer", askId: again.ask.askId, answer: { kind: "passphrase", bytes } } satisfies CeremonyToVessel, [bytes]);
  expect(await again.answer).toEqual({ kind: "passphrase", passphrase: "a ward passphrase" });

  // CONTROL: a custody unlock over a standing passkey pin offers and takes the passkey.
  const passkeys = [{ credentialId: new Uint8Array([9, 9]), prfSalt: new Uint8Array(32).fill(1) }];
  const unlock = await asked({ kind: "unlock", act: "boot", face: null, passkeys });
  expect(unlock.ask.routes).toEqual(["passphrase", "passkey"]);
  const id2 = new Uint8Array([9, 9]).buffer, out2 = new Uint8Array(32).fill(5).buffer;
  unlock.ceremony.postMessage({ t: "answer", askId: unlock.ask.askId, answer: { kind: "passkey", credentialId: id2, prfOutput: out2 } } satisfies CeremonyToVessel, [id2, out2]);
  const credential = await unlock.answer;
  expect(credential?.kind).toBe("passkey");
  expect([...(credential as { prfOutput: Uint8Array }).prfOutput]).toEqual(new Array(32).fill(5));
  // A first bind never offers a passkey: the tree's first route stands human.
  expect(routesFor("bind-first", passkeys)).toEqual(["passphrase"]);
  expect(() => decodeCeremonyAnswer({ kind: "bind-first", routes: ["passphrase"] }, { kind: "passkey", credentialId: new ArrayBuffer(2), prfOutput: new ArrayBuffer(32) })).toThrow(/ceremony-route-refused/);
});

test("C2 RED — the passphrase leaves detached and the fields clear; the vessel's copy zero-fills", async () => {
  const channel = new MessageChannel();
  const got = next<CeremonyToVessel>(channel.port2);
  const fields = [{ value: "correct horse" }, { value: "correct horse" }];
  const sent = sendPassphrase(channel.port1, "a1", fields);
  expect(sent.byteLength, "the transferred buffer reads detached in the sender").toBe(0);
  expect(fields.map((f) => f.value)).toEqual(["", ""]);
  const msg = await got;
  expect(msg.t).toBe("answer");
  const answer = msg.answer as { kind: "passphrase"; bytes: ArrayBuffer };
  const view = new Uint8Array(answer.bytes);
  expect(decodeCeremonyAnswer({ kind: "unlock", routes: ["passphrase"] }, answer)).toEqual({ kind: "passphrase", passphrase: "correct horse" });
  expect([...view].every((b) => b === 0), "the vessel's copy of the bytes zero-fills once decoded").toBe(true);
});

test("C3 RED — an insecure context, a frame, a policy out of force and an absent broker refuse by name; CONTROL: a standing document asks", () => {
  const ok = { isSecureContext: true, framed: false, hasServiceWorker: true, evalRuns: false };
  expect(ceremonyRefusal(ok)).toBeNull();
  expect(ceremonyRefusal({ ...ok, isSecureContext: false, hasServiceWorker: false })).toBe("ceremony-needs-secure-context");
  expect(ceremonyRefusal({ ...ok, framed: true })).toBe("ceremony-framed");
  expect(ceremonyRefusal({ ...ok, evalRuns: true })).toBe("ceremony-csp-absent");
  expect(ceremonyRefusal({ ...ok, hasServiceWorker: false })).toBe("ceremony-broker-absent");
  expect(pageCeremonyRefusal({ isSecureContext: false, hasServiceWorker: false })).toBe("ceremony-needs-secure-context");
  expect(pageCeremonyRefusal({ isSecureContext: true, hasServiceWorker: false })).toBe("ceremony-broker-absent");
  expect(pageCeremonyRefusal({ isSecureContext: true, hasServiceWorker: true })).toBeNull();
  expect(askIdOf("#ask=0f8fad5b-d9cb-469f-a165-70867728950e")).toBe("0f8fad5b-d9cb-469f-a165-70867728950e");
  expect(askIdOf("#ask=javascript:alert(1)")).toBeNull();
});

test("C4 — the page sends one channel end to the vessel and one to the broker, opens the ceremony with no opener, and keeps neither end", () => {
  const toBroker: Array<{ msg: unknown; transfer: Transferable[] }> = [];
  const broker = { postMessage: (msg: unknown, transfer: Transferable[]) => { toBroker.push({ msg, transfer }); } } as unknown as ServiceWorker;
  const toVessel: MessagePort[] = [];
  const opened: string[][] = [];
  openCeremony("0f8fad5b-d9cb-469f-a165-70867728950e", broker, (p) => toVessel.push(p), (u, t, f) => { opened.push([u, t, f]); return null; });
  expect(toVessel).toHaveLength(1);
  expect(toBroker).toHaveLength(1);
  expect(toBroker[0]!.msg).toEqual({ t: "ceremony:offer", askId: "0f8fad5b-d9cb-469f-a165-70867728950e" });
  expect(toBroker[0]!.transfer).toHaveLength(1);
  expect(toBroker[0]!.transfer[0]).not.toBe(toVessel[0]);
  expect(opened).toEqual([["/ceremony.html#ask=0f8fad5b-d9cb-469f-a165-70867728950e", "_blank", "noopener"]]);
});

test("C5 RED — every ask names its face, and a clear names one PersonaGroup; CONTROL: named asks raise, face and all", async () => {
  const toPage: DoorToPage[] = [];
  const door = standCeremonyDoor((m) => { toPage.push(m); });
  await expect(door.ask({ kind: "unlock", act: "boot" } as unknown as Parameters<typeof door.ask>[0])).rejects.toMatchObject({ refusal: "ask-face-absent" });
  await expect(door.ask({ kind: "clear", act: "tm-clear-password", face: null })).rejects.toMatchObject({ refusal: "clear-face-absent" });
  await expect(door.ask({ kind: "unlock", act: "boot", face: "h0" })).rejects.toMatchObject({ refusal: "face-names-a-handle" });
  expect(toPage, "a refused ask reaches no page").toEqual([]);

  const floor = await asked({ kind: "unlock", act: "boot", face: null });
  expect(floor.ask.face, "null names this browser itself").toBeNull();
  const group = "pg-teshima-family-council";
  const clear = await asked({ kind: "clear", act: "tm-clear-password", face: group });
  expect(clear.ask.face).toBe(group);
  expect(clear.toPage[0]).toMatchObject({ t: "ask", kind: "clear", face: group });
});
