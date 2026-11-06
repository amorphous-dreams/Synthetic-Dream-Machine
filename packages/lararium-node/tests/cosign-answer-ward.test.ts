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
 * No suite person is seated here: a row that forgets its route reads red.
 */
import { afterEach, beforeEach, expect, test } from "vitest";
import { ed25519SignerFromSeed, ed25519VerifyingKeyFromSeed } from "@lararium/mesh";
import { signIntentAnswer } from "../src/commands/intent.js";
import { ensureFaceCustodyOfGroup } from "../src/face-route.js";
import { storeVerbGatesFirst, storeVerbNeedsWard, wardCredential } from "../src/ward-credential.js";
import { fixtureWard, seatScratchCustody, type SeatedScratchCustody } from "./custody-seat-fixture.js";

const GROUP = "cosign-answer-face";
let c: SeatedScratchCustody;
beforeEach(async () => { c = await seatScratchCustody("cosign-answer"); });
afterEach(async () => { await c.drop(); });

const keyed = async (n: number) => ({ key: await ed25519VerifyingKeyFromSeed(new Uint8Array(32).fill(n)), sign: ed25519SignerFromSeed(new Uint8Array(32).fill(n)) });

async function joinee() {
  // The join request founds the joinee's face custody, as `face-join` does at request time; the ward binds there.
  const { ordinal } = await ensureFaceCustodyOfGroup(GROUP);
  const issuer = await keyed(51), answerer = await keyed(52);
  const asked = (verb: string) => ({ intent: "i".repeat(64), verb, issuer: issuer.key.toLowerCase(), askedBy: issuer.key.toLowerCase(), detail: "d".repeat(64), cosign: verb.startsWith("ward-") });
  const answer = (verb: string, extra: { deny?: boolean; ward?: ReturnType<typeof fixtureWard> } = {}) => signIntentAnswer({
    group: GROUP, signer: answerer, ask: "a".repeat(64), executor: issuer.key.toLowerCase(), deny: extra.deny === true, asked: asked(verb), face: ordinal,
    ...(extra.ward ? { ward: extra.ward } : {}),
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
