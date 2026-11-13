/**
 * cosign-answer-ward — THE CO-SIGNER OPENS ITS WARD (row 7, S3b; seat-harness#/the-swarm-slices).
 *
 * A ward act on a face of two devices runs only beside a second device's approve. That approve signs as the co-signing device's
 * atom, and it signs only inside a fresh unlock of that device's OWN ward for the face (its ward-slots tree, opened from its own
 * human route for this one act, zeroed after). A joinee holds no face root, yet its ward tree stands from its join: the join
 * request founds the face's custody, and the founding binds the ward beside it.
 *
 * Red: an approve of a ward ask with no fresh unlock lands. Controls: the approve under the device's own route lands; a deny, and
 * an approve of an ask that names no ward act, ask no route; a wrong route opens nothing; a passkey never mints a route. The store
 * door runs `intent-answer` first with no route and asks one only where the answer's signer names `ward-needs-fresh-unlock`.
 *
 * THE WARD ON THE WIRE: the approve carries this device's per-face ward signature over (the answer, the ask's digest, the fleet
 * frontier it read), under the ward key the device's admission into the face carries (its tag door's `wardKey`), derived from that
 * face's own ward key, so two faces of one vessel present ward keys no reader links. Reds: the approve carries no ward signature;
 * two faces present one key; an approve with no frontier read signs. Control: a deny carries none.
 *
 * No suite person is seated here: a row that forgets its route reads red.
 */
import { afterEach, beforeEach, expect, test } from "vitest";
import { ed25519SignerFromSeed, ed25519VerifyingKeyFromSeed, verifyEd25519, wardAnswerImage } from "@lararium/mesh";
import { vesselFaceTagDoor } from "../src/vessel-face-tag-store.js";
import { signIntentAnswer } from "../src/commands/intent.js";
import { ensureFaceCustodyOfGroup } from "../src/face-route.js";
import { storeVerbGatesFirst, storeVerbNeedsWard, wardCredential } from "../src/ward-credential.js";
import { fixtureWard, seatScratchCustody, type SeatedScratchCustody } from "./custody-seat-fixture.js";

const GROUP = "cosign-answer-face", FRONTIER = "f".repeat(64), DETAIL = "d".repeat(64);
let c: SeatedScratchCustody;
beforeEach(async () => { c = await seatScratchCustody("cosign-answer"); });
afterEach(async () => { await c.drop(); });

const keyed = async (n: number) => ({ key: await ed25519VerifyingKeyFromSeed(new Uint8Array(32).fill(n)), sign: ed25519SignerFromSeed(new Uint8Array(32).fill(n)) });

async function joinee() {
  // The join request founds the joinee's face custody, as `face-join` does at request time; the ward binds there.
  const { ordinal } = await ensureFaceCustodyOfGroup(GROUP);
  const issuer = await keyed(51), answerer = await keyed(52);
  const asked = (verb: string) => ({ intent: "i".repeat(64), verb, issuer: issuer.key.toLowerCase(), askedBy: issuer.key.toLowerCase(), detail: "d".repeat(64), cosign: verb.startsWith("ward-") });
  const answer = (verb: string, extra: { deny?: boolean; ward?: ReturnType<typeof fixtureWard>; frontier?: string | null } = {}) => signIntentAnswer({
    group: GROUP, signer: answerer, ask: "a".repeat(64), executor: issuer.key.toLowerCase(), deny: extra.deny === true, asked: asked(verb), face: ordinal,
    frontier: extra.frontier === undefined ? FRONTIER : extra.frontier, ...(extra.ward ? { ward: extra.ward } : {}),
  });
  return { ordinal, issuer, answerer, answer };
}

const codeOf = (p: Promise<unknown>): Promise<string | undefined> =>
  p.then(() => undefined, (e: { reading?: string; message: string }) => e.reading ?? /^[a-z-]+/.exec(e.message)?.[0] ?? e.message);

test("RED: a joinee's approve of a ward ask with no fresh unlock refuses `ward-needs-fresh-unlock`; CONTROL: under its own route it lands", async () => {
  const j = await joinee();
  for (const verb of ["ward-kapae-lower", "ward-house-cap", "ward-push-go"]) {
    expect(await codeOf(j.answer(verb))).toBe("ward-needs-fresh-unlock");
    const landed = await j.answer(verb, { ward: fixtureWard() });
    expect(landed.body).toMatchObject({ entry: "answer", verdict: "approve", executor: j.issuer.key.toLowerCase() });
    expect(landed.signer).toBe(j.answerer.key.toLowerCase());
  }
});

test("RED: an answer to an ask this vessel cannot see (it has not synced here) refuses `ward-ask-unseen` before it signs, approve or deny, route or none; CONTROL: the ask in view signs", async () => {
  const j = await joinee();
  for (const extra of [{}, { deny: true }, { ward: fixtureWard() }]) {
    expect(await codeOf(signIntentAnswer({ group: GROUP, signer: j.answerer, ask: "a".repeat(64), executor: j.issuer.key.toLowerCase(), deny: "deny" in extra, asked: null, face: j.ordinal,
      ...("ward" in extra ? { ward: extra.ward } : {}) }))).toBe("ward-ask-unseen");
  }
  expect((await j.answer("ward-house-cap", { ward: fixtureWard() })).body).toMatchObject({ verdict: "approve" });
});

test("CONTROL: a deny, and an approve of an ask that names no ward act, ask no route", async () => {
  const j = await joinee();
  expect((await j.answer("ward-kapae-lower", { deny: true })).body).toMatchObject({ verdict: "deny" });
  expect((await j.answer("deploy")).body).toMatchObject({ verdict: "approve" });
});

test("CONTROL: a wrong route opens no slot of the joinee's ward, and a passkey never mints a route", async () => {
  const j = await joinee();
  expect(await codeOf(j.answer("ward-kapae-lower", { ward: fixtureWard("not the route") }))).toBe("ward-no-slot-opens");
  expect(() => wardCredential([{ kind: "passkey" } as never])).toThrow(/ward-passkey-refused/);
});

test("RED: the store door runs an approve first with no route and asks one only where the signer names `ward-needs-fresh-unlock`; CONTROL: a deny is no ward act", () => {
  expect(storeVerbGatesFirst("intent-answer")).toBe(true);
  expect(storeVerbNeedsWard("intent-answer", { target: "a".repeat(64) })).toBe(true);
  expect(storeVerbNeedsWard("intent-answer", { target: "a".repeat(64), deny: true })).toBe(false);
  // the nonsense control: a verb outside the table is no ward act
  expect(storeVerbNeedsWard("intent-show", {})).toBe(false);
});

test("RED: the co-signer's approve carries no ward signature; CONTROL: it carries one over (the answer, the ask's digest, the frontier it read) under the ward key its admission carries, and a deny carries none", async () => {
  const j = await joinee();
  const wardKey = (await vesselFaceTagDoor(fixtureWard())(GROUP, j.answerer.key)).wardKey;
  expect(wardKey).toMatch(/^[0-9a-f]{64}$/);
  const landed = await j.answer("ward-house-cap", { ward: fixtureWard() });
  expect(landed.body).toMatchObject({ frontier: FRONTIER });
  const image = wardAnswerImage({ group: GROUP, ask: "a".repeat(64), detail: DETAIL, verdict: "approve", executor: j.issuer.key, frontier: FRONTIER });
  expect(verifyEd25519(landed.body["wardSig"], image, wardKey)).toBe(true);
  // the nonsense control: the atom's own key verifies nothing the ward signed
  expect(verifyEd25519(landed.body["wardSig"], image, j.answerer.key)).toBe(false);
  const denied = await j.answer("ward-house-cap", { deny: true });
  expect(denied.body["wardSig"]).toBeUndefined();
});

test("RED: an approve of a ward ask with no fleet frontier read signs; it refuses `ward-cosign-frontier-unknown` before the ward opens", async () => {
  const j = await joinee();
  expect(await codeOf(j.answer("ward-push-go", { ward: fixtureWard(), frontier: null }))).toBe("ward-cosign-frontier-unknown");
});

test("RED: two faces of one vessel present one ward key, or keys a reader links; CONTROL: each face's key verifies only its own face's approve", async () => {
  const one = await joinee();
  const other = "cosign-answer-other-face";
  const { ordinal } = await ensureFaceCustodyOfGroup(other);
  const door = vesselFaceTagDoor(fixtureWard());
  const k1 = (await door(GROUP, one.answerer.key)).wardKey, k2 = (await door(other, one.answerer.key)).wardKey;
  expect(k1).toMatch(/^[0-9a-f]{64}$/);
  expect(k2).toMatch(/^[0-9a-f]{64}$/);
  expect(k1).not.toBe(k2);
  // a re-read presents the same key: the key answers to the face, never to the call
  expect((await door(GROUP, one.answerer.key)).wardKey).toBe(k1);
  const signed = await signIntentAnswer({ group: other, signer: one.answerer, ask: "a".repeat(64), executor: one.issuer.key.toLowerCase(), deny: false, face: ordinal, frontier: FRONTIER, ward: fixtureWard(),
    asked: { intent: "i".repeat(64), verb: "ward-push-go", issuer: one.issuer.key.toLowerCase(), askedBy: one.issuer.key.toLowerCase(), detail: DETAIL, cosign: true, spent: false } });
  const image = wardAnswerImage({ group: other, ask: "a".repeat(64), detail: DETAIL, verdict: "approve", executor: one.issuer.key, frontier: FRONTIER });
  expect(verifyEd25519(signed.body["wardSig"], image, k2)).toBe(true);
  expect(verifyEd25519(signed.body["wardSig"], image, k1)).toBe(false);
});
