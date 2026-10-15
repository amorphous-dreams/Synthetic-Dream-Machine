/**
 * WS-SWARM WITNESS — the swarm ceremony over the Herm's OPEN membership relay: the SAME ceremony that
 * crosses a file channel crosses LIVE WebSockets here, over real sockets, real Keyhive. The shore
 * (MembershipChannel) holds one shape; the file and WS impls both run live forms of the Herm's blind
 * ceremony carriage, chosen by deployment. This witnesses the WS impl across real sockets.
 *
 *   relay (in-process WebSocketServer) ← founder · vessel-B · vessel-C (each a WS client)
 *
 * The ceremony: found → INVITE (broadcast) → CONTACT (cards over WS) → ADMIT (the founder opens each
 * party's dwelling in real Keyhive, its admit carrying a fresh challenge) → PRESENT (each party signs the
 * founder's challenge with the key its admit names, and the founder verifies that possession, then that one
 * member on ask). A party presenting another party's admit, or replaying a present already verified, holds
 * nothing. No roster stands anywhere: the founder answers "does this presented member hold", never "who holds"
 * (`dwellersHolding`). Envelopes ride as opaque routing payloads, NOT
 * Automerge sync — so this carries none of the anti-relay cap-wall; a plain message relay suffices.
 *
 * Run: pnpm exec tsx packages/lararium-node/probes/ws-swarm-witness.ts
 *
 * Meme: lar:///ha.ka.ba/lares/api/pono/cabal-realm
 */

import { KeyhiveProvider, InMemoryEventStore, foundCabalRealm, openDwelling, dwellersHolding } from "@lararium/keyhive";
import { MEMBERSHIP_BROADCAST } from "@lararium/mesh";
import { startMembershipRelay, WSMembershipChannel } from "../src/ws-membership-channel.js";
import { PresentVerifier, signPresent, type SwarmAdmit } from "./swarm-present.js";

const settle = (ms = 120): Promise<void> => new Promise((r) => setTimeout(r, ms));
let failures = 0;
function stage(name: string, ok: boolean, detail = ""): void {
  if (!ok) failures++;
  console.log(`[ws-swarm] ${ok ? "PASS" : "FAIL"} — ${name}${detail ? `  (${detail})` : ""}`);
}
const b64 = (u: Uint8Array): string => Buffer.from(u).toString("base64");

async function main(): Promise<void> {
  console.log("[ws-swarm] =========================================================");
  console.log("[ws-swarm] the swarm ceremony over LIVE WebSockets (the Herm's OPEN carriage, WS form)");
  console.log("[ws-swarm] =========================================================");

  const relay = await startMembershipRelay(0);
  const url = `ws://127.0.0.1:${String(relay.port)}`;
  const founderCh = new WSMembershipChannel(url);
  const bCh = new WSMembershipChannel(url);
  const cCh = new WSMembershipChannel(url);
  await Promise.all([founderCh.opened(), bCh.opened(), cCh.opened()]);

  const seedB = new Uint8Array(32).fill(0xb0);
  const seedC = new Uint8Array(32).fill(0xc0);
  const founder = new KeyhiveProvider();
  await founder.init({ seed: new Uint8Array(32).fill(0xf0), eventStore: new InMemoryEventStore() });
  const vesselB = new KeyhiveProvider();
  await vesselB.init({ seed: seedB, eventStore: new InMemoryEventStore() });
  const vesselC = new KeyhiveProvider();
  await vesselC.init({ seed: seedC, eventStore: new InMemoryEventStore() });
  const founderKeyHex = await founder.whoami();
  const verifier = new PresentVerifier(founderKeyHex);

  // ── STAGE 1 — FOUND the shared realm (local Keyhive; no channel needed) ─────────
  const realm = await foundCabalRealm(founder, "lar:///crossroads.cabal.gathers/ws-swarm", "automerge:ws-swarm-substrate");
  stage("1 FOUND — shared realm founded, three WS clients live on the relay", realm.realmDocIdHex.length > 0,
    `relay=:${String(relay.port)} realm=${realm.realmDocIdHex.slice(0, 10)}…`);

  // ── STAGE 2 — INVITE broadcast over LIVE WS ────────────────────────────────────
  await founderCh.offer({ kind: "invite", from: "founder", to: MEMBERSHIP_BROADCAST, payload: { realmDocIdHex: realm.realmDocIdHex } });
  await settle();
  const invB = await bCh.poll("vessel-B");
  const invC = await cCh.poll("vessel-C");
  const invSelf = await founderCh.poll("founder");
  stage("2 INVITE — broadcast reaches both joiners over the socket, never the sender",
    invB.length === 1 && invC.length === 1 && invSelf.length === 0, `B=${invB.length} C=${invC.length} self=${invSelf.length}`);

  // ── STAGE 3 — CONTACT: contact-cards cross LIVE WS to the founder ───────────────
  await bCh.offer({ kind: "contact-card", from: "vessel-B", to: "founder", payload: b64(await vesselB.contactCard()) });
  await cCh.offer({ kind: "contact-card", from: "vessel-C", to: "founder", payload: b64(await vesselC.contactCard()) });
  await settle();
  const cards = await founderCh.poll("founder");
  stage("3 CONTACT — both contact-cards cross the socket to the founder",
    cards.length === 2 && cards.every((c) => c.kind === "contact-card"), `cards=${cards.length}`);

  // ── STAGE 4 — ADMIT: the founder opens each party's dwelling and answers with its admit ──
  for (const c of cards) {
    const { id } = await founder.receiveContactCard(new Uint8Array(Buffer.from(c.payload as string, "base64")));
    await openDwelling(founder, realm, id);
    await founderCh.offer({ kind: "admit", from: "founder", to: c.from, payload: verifier.admit(realm.realmDocIdHex, id) });
  }
  await settle();
  const admitB = await bCh.poll("vessel-B");
  const admitC = await cCh.poll("vessel-C");
  stage("4 ADMIT — each party's dwelling opens in real Keyhive, and its admit crosses the socket to it alone",
    admitB.length === 1 && admitC.length === 1 && admitB[0]?.kind === "admit" && admitC[0]?.kind === "admit",
    `B=${admitB.length} C=${admitC.length}`);

  // ── STAGE 5 — REPLAYED ADMIT: a party presents ANOTHER party's admit, read off the open relay ───────────────
  // vessel-C holds B's admit (its challenge still live) and signs it with its own key. The founder refuses it, and
  // the refusal spends nothing: B's own present below still verifies.
  const bAdmit = admitB[0]?.payload as SwarmAdmit;
  const cAdmit = admitC[0]?.payload as SwarmAdmit;
  const holdsOnAsk = async (hex: string): Promise<boolean> => (await dwellersHolding(founder, realm, [hex])).length === 1;
  const stolen = await verifier.verify(await signPresent(bAdmit, founderKeyHex, seedC), holdsOnAsk);
  const bare = await verifier.verify({ ...bAdmit }, holdsOnAsk);
  stage("5 RED — a party presenting another party's admit holds nothing, signed with its own key or with no proof at all",
    !stolen.holds && !bare.holds, `stolen=${stolen.why ?? "HELD"} bare=${bare.why ?? "HELD"}`);

  // ── STAGE 6 — PRESENT: each party signs the founder's challenge with the key its admit names; the founder
  // verifies that possession, then the one member ON ASK ──
  const presentB = await signPresent(bAdmit, founderKeyHex, seedB);
  for (const [ch, from, present] of [[bCh, "vessel-B", presentB], [cCh, "vessel-C", await signPresent(cAdmit, founderKeyHex, seedC)]] as const) {
    await ch.offer({ kind: "present", from, to: "founder", payload: present });
  }
  await settle();
  const presented = await founderCh.poll("founder");
  const held = new Set<string>();
  for (const p of presented) {
    if (p.kind === "present" && (await verifier.verify(p.payload, holdsOnAsk)).holds) held.add(p.from);
  }
  stage("6 PRESENT — each party's presented admit, signed by the key it names, verifies on ask against real Keyhive (CONTROL)",
    presented.length === 2 && held.size === 2, `presented=${presented.length} held=${[...held].join(",")}`);

  // ── STAGE 7 — REPLAY: B's own present, already verified, replayed by anyone, holds nothing (its challenge is spent) ──
  const replay = await verifier.verify(presentB, holdsOnAsk);
  stage("7 RED — a verified present replayed holds nothing: its challenge is spent", !replay.holds, replay.why ?? "HELD");

  // CONTROL — a party the founder knows but never opened a dwelling for holds nothing: the check reads Keyhive,
  // never the fact that a party presented something.
  const stranger = new KeyhiveProvider();
  await stranger.init({ seed: new Uint8Array(32).fill(0xd0), eventStore: new InMemoryEventStore() });
  const { id: strangerId } = await founder.receiveContactCard(await stranger.contactCard());
  const strangerHolds = await dwellersHolding(founder, realm, [strangerId]);
  stage("8 CONTROL — a known party never admitted holds nothing in Keyhive", strangerHolds.length === 0,
    `held=${strangerHolds.length}`);
  await stranger.dispose();

  founderCh.close(); bCh.close(); cCh.close();
  await founder.dispose();
  await vesselB.dispose();
  await vesselC.dispose();
  await relay.close();

  console.log("[ws-swarm] =========================================================");
  if (failures === 0) {
    console.log("[ws-swarm] ALL STAGES PASS — the swarm ceremony crossed LIVE WebSockets.");
    console.log("[ws-swarm] The shore holds: one ceremony, file/POST and live-WS both below it, chosen by deployment.");
  } else {
    console.log(`[ws-swarm] ${failures} STAGE(S) FAILED.`);
    process.exit(1);
  }
}

main().catch((err) => { console.error("[ws-swarm] FATAL:", err); process.exit(1); });
