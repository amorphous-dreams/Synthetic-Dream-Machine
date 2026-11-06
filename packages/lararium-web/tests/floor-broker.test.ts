/**
 * floor-broker — THE FLOOR'S PORT BROKER (browser-vessel-lift slice 4), over the broker's own served bytes
 * (`public/ceremony-broker.js`) evaluated against a stand-in service-worker scope, with real MessageChannels.
 *
 * On the floor (an engine with no SharedWorker) one tab's dedicated vessel worker owns the store; a second tab reaches it
 * through a port brokered for it. The follower claims (`vessel:claim{tabSession}`); the broker asks every other window
 * (`vessel:want{claimId, tabSession}`); the owner's vessel worker mints a channel, connects one end as that tab's own
 * session, and its page offers the other end unread (`vessel:offer{claimId}`); the broker hands it to the claimant alone
 * (`vessel:port{tabSession}`). The broker holds a port only between offer and hand, never starts or reads it, and carries
 * none of its traffic.
 *
 *   FB1 RED     a follower's claim reaches every other window as a want, never the claimant itself, and never the
 *               ceremony document.
 *   FB2 RED     the owner's offer reaches the claimant alone, unstarted: what the vessel's end sent before the hand
 *               arrives at the follower first and whole, so the broker read none of it.
 *   FB3 RED     the ceremony document neither claims nor offers a vessel port (`vessel:absent`; an offer from it hands
 *               nothing), and an offer for a claim never made hands nothing.
 *   CONTROL     the ceremony's own offer and claim still hand its port.
 *   FB5 RED     an unanswered claim ends on the claimant's own withdraw (`vessel:withdraw{tabSession}`): its wait settles
 *               and a later offer hands nothing. CONTROL: a withdraw from any other window ends nothing.
 *   FB6 RED     an unanswered claim ends when the claimant's client stands gone at the broker's next event (any message
 *               it hears), never on a timer: its wait settles and a later offer hands nothing. CONTROL: a live
 *               claimant's claim survives that same event.
 *
 * Meme: lar:///ha.ka.ba/lares/docs/pono/browser-vessel-lift
 */
import { expect, test } from "vitest";
import { client, standBroker, type Client } from "./fixtures/broker-scope.js";

const wanted = (c: Client) => c.posted.map((p) => p.msg as { t?: string; claimId?: string; tabSession?: string }).filter((m) => m.t === "vessel:want");

test("FB1 RED — a follower's claim reaches every other window as a want, never the claimant, never the ceremony", async () => {
  const leader = client("lead", "/");
  const follower = client("follow", "/");
  const ceremony = client("rite", "/ceremony.html");
  const broker = standBroker([leader, follower, ceremony]);
  await broker.send(follower, { t: "vessel:claim", tabSession: "tab-b" });
  expect(wanted(leader), "the owner's window hears the want").toHaveLength(1);
  expect(wanted(leader)[0]).toMatchObject({ t: "vessel:want", tabSession: "tab-b" });
  expect(typeof wanted(leader)[0]!.claimId).toBe("string");
  expect(wanted(follower), "the claimant never hears its own want").toHaveLength(0);
  expect(ceremony.posted, "the ceremony document hears nothing of a vessel claim").toHaveLength(0);
});

test("FB2 RED — the owner's offer reaches the claimant alone, unstarted: the vessel's first words arrive whole", async () => {
  const leader = client("lead", "/");
  const follower = client("follow", "/");
  const third = client("other", "/");
  const broker = standBroker([leader, follower, third]);
  await broker.send(follower, { t: "vessel:claim", tabSession: "tab-b" });
  const claimId = wanted(leader)[0]?.claimId;
  expect(claimId, "the want names its claim").toBeTypeOf("string");
  const channel = new MessageChannel();
  // The vessel's end speaks before the hand; a broker that started or read the port would take these words.
  channel.port1.postMessage({ t: "phase", phase: "before-the-hand" });
  await broker.send(leader, { t: "vessel:offer", claimId }, [channel.port2]);
  const handed = follower.posted.filter((p) => (p.msg as { t?: string }).t === "vessel:port");
  expect(handed, "the claimant receives its port once").toHaveLength(1);
  expect(handed[0]!.msg).toEqual({ t: "vessel:port", tabSession: "tab-b" });
  expect(handed[0]!.ports).toEqual([channel.port2]);
  expect(third.posted.filter((p) => p.ports.length > 0), "no other window receives a port").toHaveLength(0);
  const first = await new Promise<unknown>((resolve) => { channel.port2.onmessage = (e) => resolve(e.data); });
  expect(first).toEqual({ t: "phase", phase: "before-the-hand" });
  // The claim spends once: a second offer under the same claim hands nothing more.
  await broker.send(leader, { t: "vessel:offer", claimId }, [new MessageChannel().port2]);
  expect(follower.posted.filter((p) => (p.msg as { t?: string }).t === "vessel:port")).toHaveLength(1);
});

test("FB3 RED — the ceremony document neither claims nor offers a vessel port, and an unclaimed offer hands nothing", async () => {
  const leader = client("lead", "/");
  const follower = client("follow", "/");
  const ceremony = client("rite", "/ceremony.html");
  const broker = standBroker([leader, follower, ceremony]);
  await broker.send(ceremony, { t: "vessel:claim", tabSession: "tab-c" });
  expect(ceremony.posted.map((p) => p.msg)).toEqual([{ t: "vessel:absent", tabSession: "tab-c" }]);
  expect(wanted(leader), "a ceremony's claim raises no want").toHaveLength(0);
  await broker.send(follower, { t: "vessel:claim", tabSession: "tab-b" });
  const claimId = wanted(leader)[0]?.claimId;
  expect(claimId).toBeTypeOf("string");
  await broker.send(ceremony, { t: "vessel:offer", claimId }, [new MessageChannel().port2]);
  await broker.send(leader, { t: "vessel:offer", claimId: "never-claimed" }, [new MessageChannel().port2]);
  expect(follower.posted.filter((p) => p.ports.length > 0), "neither the ceremony's offer nor an unclaimed one hands a port").toHaveLength(0);
});

test("CONTROL — the ceremony's own offer and claim still hand its port", async () => {
  const page = client("lead", "/");
  const ceremony = client("rite", "/ceremony.html");
  const broker = standBroker([page, ceremony]);
  const channel = new MessageChannel();
  await broker.send(page, { t: "ceremony:offer", askId: "a1" }, [channel.port2]);
  await broker.send(ceremony, { t: "ceremony:claim", askId: "a1" });
  expect(ceremony.posted.map((p) => p.msg)).toEqual([{ t: "ceremony:port", askId: "a1" }]);
  expect(ceremony.posted[0]!.ports).toEqual([channel.port2]);
});

const portsTo = (c: Client) => c.posted.filter((p) => (p.msg as { t?: string }).t === "vessel:port");

test("FB5 RED — the claimant's own withdraw ends its unanswered claim; CONTROL: another window's withdraw ends nothing", async () => {
  const leader = client("lead", "/");
  const follower = client("follow", "/");
  const other = client("other", "/");
  const broker = standBroker([leader, follower, other]);
  await broker.send(follower, { t: "vessel:claim", tabSession: "tab-b" });
  const claimId = wanted(leader)[0]?.claimId;
  expect(claimId).toBeTypeOf("string");
  const wait = broker.kept[0]!;
  await broker.send(other, { t: "vessel:withdraw", tabSession: "tab-b" });
  expect(broker.settled(wait), "CONTROL: a withdraw from a window that never claimed ends nothing").toBe(false);
  await broker.send(follower, { t: "vessel:withdraw", tabSession: "tab-b" });
  expect(broker.settled(wait), "the claimant's withdraw ends the claim's wait").toBe(true);
  await broker.send(leader, { t: "vessel:offer", claimId }, [new MessageChannel().port2]);
  expect(portsTo(follower), "a withdrawn claim hands nothing").toHaveLength(0);
});

test("FB6 RED — a gone claimant's claim ends at the broker's next event, never a timer; CONTROL: a live claim survives it", async () => {
  const leader = client("lead", "/");
  const gone = client("gone", "/");
  const live = client("live", "/");
  const clients = [leader, gone, live];
  const broker = standBroker(clients);
  await broker.send(gone, { t: "vessel:claim", tabSession: "tab-g" });
  await broker.send(live, { t: "vessel:claim", tabSession: "tab-l" });
  const [goneWant, liveWant] = wanted(leader);
  const [goneWait, liveWait] = broker.kept;
  clients.splice(clients.indexOf(gone), 1);
  // The event: any message the broker hears next (here the ceremony's own offer, unrelated to either claim).
  await broker.send(leader, { t: "ceremony:offer", askId: "unrelated" }, [new MessageChannel().port2]);
  expect(broker.settled(goneWait!), "the gone claimant's wait ends at the next event").toBe(true);
  expect(broker.settled(liveWait!), "CONTROL: a live claimant's wait stands").toBe(false);
  await broker.send(leader, { t: "vessel:offer", claimId: goneWant!.claimId }, [new MessageChannel().port2]);
  await broker.send(leader, { t: "vessel:offer", claimId: liveWant!.claimId }, [new MessageChannel().port2]);
  expect(portsTo(live), "CONTROL: the live claim still hands its port").toHaveLength(1);
  expect(broker.settled(liveWait!), "and its wait ends at the hand").toBe(true);
});
