/**
 * floor-tab — THE PAGE'S PART ON THE FLOOR (browser-vessel-lift slice 4; the 2026-11-06 ruling: every tab carries a live session).
 *
 * One tab per store owns the vessel worker (the owner lock proves it); every other tab on the origin claims a port through the
 * broker and opens its OWN session over it. The page module `src/floor-tab.ts` carries that choice for `main.ts`:
 *
 *   FT1 RED   a tab whose owner lock grants leads: it stands its own vessel worker once and claims nothing.
 *   FT2 RED   a tab that finds the owner lock held claims (`vessel:claim{tabSession}`) and follows over the port the broker hands
 *             it (`vessel:port{tabSession}`). CONTROL: a port for another tab's session, or a second port after its claim spent,
 *             follows nothing.
 *   FT3 RED   the owner answers a want (`vessel:want{claimId, tabSession}`): its vessel mints the follower's port (the claimId
 *             names the want) and the page offers the minted end unread (`vessel:offer{claimId}`, the port transferred).
 *             CONTROL: a refused mint offers nothing; a claiming tab mints nothing for another's want.
 *   FT4 RED   a claiming tab's pagehide withdraws its claim (`vessel:withdraw{tabSession}`), so the broker's wait ends on an event.
 *             CONTROL: the owner's pagehide withdraws nothing.
 *
 * Meme: lar:///ha.ka.ba/lares/docs/pono/browser-vessel-lift
 */
import { expect, test } from "vitest";
import { standFloorTab } from "../src/floor-tab.js";
import type { BrokerToPage, PageToBroker } from "../src/ceremony-protocol.js";
import type { PageLife } from "@lararium/browser/page";

function standBrokerStandIn() {
  const posted: Array<{ msg: PageToBroker; ports: readonly MessagePort[] }> = [];
  const listeners = new Set<(msg: BrokerToPage, ports: readonly MessagePort[]) => void>();
  return {
    posted,
    broker: {
      post(msg: PageToBroker, transfer: Transferable[] = []) { posted.push({ msg, ports: transfer.filter((t): t is MessagePort => t instanceof MessagePort) }); },
      listen(listener: (msg: BrokerToPage, ports: readonly MessagePort[]) => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    },
    hand(msg: BrokerToPage, ports: readonly MessagePort[] = []) { for (const l of listeners) l(msg, ports); },
  };
}

function standLife() {
  const listeners = new Set<(life: PageLife) => void>();
  return { feed: (l: (life: PageLife) => void) => { listeners.add(l); return () => { listeners.delete(l); }; }, say: (life: PageLife) => { for (const l of listeners) l(life); } };
}

const settle = async (ok: () => boolean): Promise<void> => { for (let i = 0; i < 80 && !ok(); i++) await new Promise((r) => setTimeout(r, 10)); };

/** Hold `lockName` as another tab would, until the returned release. */
async function heldElsewhere(lockName: string): Promise<() => void> {
  let release!: () => void;
  await new Promise<void>((granted) => { void navigator.locks.request(lockName, () => new Promise<void>((r) => { release = r; granted(); })); });
  return release;
}

function tabOf(lockName: string, tabSession: string, mint: (wantId: string, tabSession: string) => Promise<MessagePort | null> = async () => null) {
  const b = standBrokerStandIn();
  const life = standLife();
  const leads: number[] = [];
  const mints: Array<[string, string]> = [];
  const follows: MessagePort[] = [];
  const tab = standFloorTab({
    locks: navigator.locks, lockName, tabSession, broker: b.broker, pageLife: life.feed,
    lead: () => { leads.push(1); return { mintPort: (w: string, s: string) => { mints.push([w, s]); return mint(w, s); } }; },
    follow: (port: MessagePort) => { follows.push(port); },
  });
  return { tab, ...b, life, leads, mints, follows };
}

test("FT1 RED a tab whose owner lock grants leads once and claims nothing", async () => {
  const t = tabOf(`floor-tab:${crypto.randomUUID()}`, "tab-a");
  await settle(() => t.leads.length > 0);
  expect(t.leads, "the owner stands its own vessel worker once").toHaveLength(1);
  expect(t.tab.role()).toBe("owner");
  expect(t.posted.filter((p) => p.msg.t === "vessel:claim"), "an owner claims nothing").toEqual([]);
});

test("FT2 RED a tab that finds the owner lock held claims and follows over its brokered port — CONTROL: another session's port, or a second port, follows nothing", async () => {
  const lockName = `floor-tab:${crypto.randomUUID()}`;
  const release = await heldElsewhere(lockName);
  const t = tabOf(lockName, "tab-b");
  await settle(() => t.posted.length > 0);
  expect(t.posted.map((p) => p.msg), "the tab claims a port for its own session").toEqual([{ t: "vessel:claim", tabSession: "tab-b" }]);
  expect(t.leads, "a claiming tab stands no vessel worker").toEqual([]);
  expect(t.tab.role()).toBe("claiming");
  const stray = new MessageChannel(), own = new MessageChannel(), again = new MessageChannel();
  t.hand({ t: "vessel:port", tabSession: "tab-other" }, [stray.port1]);
  expect(t.follows, "CONTROL: another session's port follows nothing").toEqual([]);
  t.hand({ t: "vessel:port", tabSession: "tab-b" }, [own.port1]);
  expect(t.follows, "the tab follows over the port the broker handed it").toEqual([own.port1]);
  expect(t.tab.role()).toBe("follower");
  t.hand({ t: "vessel:port", tabSession: "tab-b" }, [again.port1]);
  expect(t.follows, "CONTROL: a spent claim follows no second port").toEqual([own.port1]);
  release();
});

test("FT3 RED the owner's vessel mints a follower's port for its want and the page offers it unread — CONTROL: a refused mint offers nothing; a claiming tab mints nothing", async () => {
  const lockName = `floor-tab:${crypto.randomUUID()}`;
  const minted = new MessageChannel();
  const owner = tabOf(lockName, "tab-a", async (w) => (w === "c1" ? minted.port2 : null));
  await settle(() => owner.leads.length > 0);
  owner.hand({ t: "vessel:want", claimId: "c1", tabSession: "tab-b" });
  await settle(() => owner.posted.some((p) => p.msg.t === "vessel:offer"));
  expect(owner.mints, "the claimId names the want the vessel mints for").toEqual([["c1", "tab-b"]]);
  const offer = owner.posted.find((p) => p.msg.t === "vessel:offer")!;
  expect(offer.msg).toEqual({ t: "vessel:offer", claimId: "c1" });
  expect(offer.ports, "the minted end crosses transferred").toEqual([minted.port2]);
  owner.hand({ t: "vessel:want", claimId: "c2", tabSession: "tab-c" });
  await new Promise((r) => setTimeout(r, 50));
  expect(owner.posted.filter((p) => p.msg.t === "vessel:offer"), "CONTROL: a refused mint offers nothing").toHaveLength(1);

  const claimer = tabOf(lockName, "tab-d");
  await settle(() => claimer.posted.length > 0);
  claimer.hand({ t: "vessel:want", claimId: "c3", tabSession: "tab-e" });
  await new Promise((r) => setTimeout(r, 50));
  expect(claimer.mints, "CONTROL: a claiming tab mints nothing").toEqual([]);
  expect(claimer.posted.filter((p) => p.msg.t === "vessel:offer")).toEqual([]);
});

test("FT4 RED a claiming tab's pagehide withdraws its claim — CONTROL: the owner's pagehide withdraws nothing", async () => {
  const lockName = `floor-tab:${crypto.randomUUID()}`;
  const owner = tabOf(lockName, "tab-a");
  await settle(() => owner.leads.length > 0);
  const claimer = tabOf(lockName, "tab-b");
  await settle(() => claimer.posted.length > 0);
  claimer.life.say("pagehide");
  expect(claimer.posted.at(-1)?.msg, "the claim's wait ends on the claimant's own word").toEqual({ t: "vessel:withdraw", tabSession: "tab-b" });
  owner.life.say("pagehide");
  expect(owner.posted.filter((p) => p.msg.t === "vessel:withdraw"), "CONTROL: an owner holds no claim to withdraw").toEqual([]);
});
