/**
 * WS-SWARM WITNESS — the swarm ceremony over the Herm's OPEN membership relay: the SAME ceremony that
 * crosses a file channel crosses LIVE WebSockets here, over real sockets, real Keyhive. The shore
 * (MembershipChannel) holds one shape; the file and WS impls both run live forms of the Herm's blind
 * ceremony carriage, chosen by deployment. This witnesses the WS impl across real sockets.
 *
 *   relay (in-process WebSocketServer) ← founder · vessel-B · vessel-C (each a WS client)
 *
 * The ceremony: found → INVITE (broadcast) → CONTACT (cards over WS) → ADMIT (the founder opens each
 * party's dwelling in real Keyhive) → PRESENT (each party presents the admit it holds, and the founder
 * verifies that one party on ask). No roster stands anywhere: the founder answers "does this presented
 * party hold", never "who holds" (`dwellersHolding`). Envelopes ride as opaque routing payloads, NOT
 * Automerge sync — so this carries none of the anti-relay cap-wall; a plain message relay suffices.
 *
 * Run: pnpm exec tsx packages/lararium-node/probes/ws-swarm-witness.ts
 *
 * Meme: lar:///ha.ka.ba/lares/api/pono/cabal-realm
 */

import { KeyhiveProvider, InMemoryEventStore, foundCabalRealm, openDwelling, dwellersHolding } from "@lararium/keyhive";
import { MEMBERSHIP_BROADCAST } from "@lararium/mesh";
import { startMembershipRelay, WSMembershipChannel } from "../src/ws-membership-channel.js";

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

  const founder = new KeyhiveProvider();
  await founder.init({ seed: new Uint8Array(32).fill(0xf0), eventStore: new InMemoryEventStore() });
  const vesselB = new KeyhiveProvider();
  await vesselB.init({ seed: new Uint8Array(32).fill(0xb0), eventStore: new InMemoryEventStore() });
  const vesselC = new KeyhiveProvider();
  await vesselC.init({ seed: new Uint8Array(32).fill(0xc0), eventStore: new InMemoryEventStore() });

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
    await founderCh.offer({ kind: "admit", from: "founder", to: c.from, payload: { memberIdHex: id } });
  }
  await settle();
  const admitB = await bCh.poll("vessel-B");
  const admitC = await cCh.poll("vessel-C");
  stage("4 ADMIT — each party's dwelling opens in real Keyhive, and its admit crosses the socket to it alone",
    admitB.length === 1 && admitC.length === 1 && admitB[0]?.kind === "admit" && admitC[0]?.kind === "admit",
    `B=${admitB.length} C=${admitC.length}`);

  // ── STAGE 5 — PRESENT: each party presents the admit it holds; the founder verifies it ON ASK ──
  for (const [ch, from, admit] of [[bCh, "vessel-B", admitB[0]], [cCh, "vessel-C", admitC[0]]] as const) {
    await ch.offer({ kind: "present", from, to: "founder", payload: admit?.payload });
  }
  await settle();
  const presented = await founderCh.poll("founder");
  const held: string[] = [];
  for (const p of presented) {
    const hex = String((p.payload as { memberIdHex?: string } | undefined)?.memberIdHex ?? "");
    if (p.kind === "present" && (await dwellersHolding(founder, realm, [hex])).length === 1) held.push(p.from);
  }
  stage("5 PRESENT — each party's presented admit verifies on ask against real Keyhive",
    presented.length === 2 && held.length === 2, `presented=${presented.length} held=${held.join(",")}`);

  // CONTROL — a party the founder knows but never opened a dwelling for holds nothing: the check reads Keyhive,
  // never the fact that a party presented something.
  const stranger = new KeyhiveProvider();
  await stranger.init({ seed: new Uint8Array(32).fill(0xd0), eventStore: new InMemoryEventStore() });
  const { id: strangerId } = await founder.receiveContactCard(await stranger.contactCard());
  const strangerHolds = await dwellersHolding(founder, realm, [strangerId]);
  stage("6 CONTROL — a known party never admitted presents and holds nothing", strangerHolds.length === 0,
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
