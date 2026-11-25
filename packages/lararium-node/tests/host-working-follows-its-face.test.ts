/**
 * host-working-follows-its-face — THE HOST'S DAEMON WORKING LAYER FOLLOWS THE WORN FACE'S OWN SLOT ALONE (face isolation).
 *
 * The carry import sends a face-named INGEST wave to a SIBLING face of the lit set (open, not worn). The island resolves
 * that sibling's own daemon device slot (`siblingSlot` -> `litFaceSlotDocs`) and names the document to the vessel
 * (`docstore:slot`, marked `sibling`). The vessel maps it for its seal as any slot; its host working layer stays where it
 * stands, by rule, and the log names why. Before the cure the host followed every daemon working notice
 * (`followHostWorkingLayer`), and only the sealed store's `reference-unknown` refusal stopped it: had the sibling's
 * document opened, the host's daemon working layer would have followed another face's document.
 *
 *   H1 — RED: a sibling's daemon working document, announced and able to open (the follow here opens every document the
 *        island repo holds, no sealed refusal), leaves the host layer on the worn face's document; the log names the sibling.
 *   H2 — CONTROL: the worn face's own announcement (a wear change, a re-found) still moves the host layer.
 *
 * The island half runs the island's own parts (`litFaceSlotDocs`, `slotAnnouncer`), the vessel half the vessel's
 * (`docStorePortCell`, `hostWorkingFollower`), over one MessageChannel.
 *
 * Meme: lar:///ha.ka.ba/lararium/mesh/sealed-store#/the-lit-set
 */
import { afterEach, describe, expect, test } from "vitest";
import { CompositeStore } from "@lararium/mesh/composite-store";
import { CONTROL_HOME_ID } from "@lararium/mesh/lar-uris";
import { announceSlotDoc, docStorePortCell } from "@lararium/mesh/sealed-rest";
import { makeIslandRepo } from "@lararium/mesh/island-repo-door";
import { MemoryTiddlerStore } from "@lararium/tw5";
import { litFaceSlotDocs, slotAnnouncer } from "@lararium/keyhive";
import { hostWorkingFollower } from "../src/host-working-follow.js";

const ports: MessagePort[] = [];
afterEach(() => { while (ports.length) ports.pop()!.close(); });

const portOf = (p: MessagePort) => {
  ports.push(p);
  return {
    post: (msg: unknown) => p.postMessage(msg),
    listen: (cb: (msg: unknown) => void) => { const h = (e: MessageEvent) => cb(e.data); p.addEventListener("message", h as never); p.start(); return () => p.removeEventListener("message", h as never); },
  };
};

const SENTINEL = "lar:///ha.ka.ba/wikis/sentinel/working";

function stand() {
  const repo = makeIslandRepo({ syncPort: new MessageChannel().port1 });
  const control = new CompositeStore();
  control.addLayer({ bagId: CONTROL_HOME_ID, store: new MemoryTiddlerStore(CONTROL_HOME_ID), writable: true, defaultWritable: true });
  const channel = new MessageChannel();
  const vesselSide = portOf(channel.port1), islandSide = portOf(channel.port2);
  // THE VESSEL HALF: the host's working layer, its follower, and the log it writes.
  const host = { documentId: "worn-face-doc" };
  const logged: string[] = [];
  const follows: Promise<unknown>[] = [];
  const follower = hostWorkingFollower({
    // The sealed store opens every document the island repo holds: no refusal stops the follow by accident.
    follow: (url) => {
      const followed = repo.find(url as never).then((handle) => { host.documentId = handle.documentId; });
      follows.push(followed.catch(() => undefined));
      return followed;
    },
    log: (line) => logged.push(line),
  });
  let drained: (() => void) | null = null;
  const cell = docStorePortCell(async () => null, {
    onSlot: (bagId, documentId, _floor, _lifted, sibling) => {
      if (bagId === SENTINEL) { drained?.(); return; }
      follower(bagId, documentId, sibling);
    },
  });
  cell.attach(vesselSide);
  // Every notice posted before it has crossed (one port keeps its order), and each follow it began has settled.
  const drain = async (): Promise<void> => {
    const crossed = new Promise<void>((r) => { drained = r; });
    announceSlotDoc(islandSide, SENTINEL, "sentinel");
    await crossed;
    await Promise.all(follows);
  };
  // THE ISLAND HALF: one lit set; each face's resolver names its documents as the worn face's or a sibling's.
  const worn = slotAnnouncer(islandSide, "worn");
  const sibling = slotAnnouncer(islandSide, "sibling");
  const wornSlots = litFaceSlotDocs({ repo, daemonStore: control, control, catalog: null, deviceScoped: (slug) => slug === "daemon", announceDevice: worn.device });
  const siblingSlots = litFaceSlotDocs({ repo, daemonStore: control, control, catalog: null, deviceScoped: (slug) => slug === "daemon", announceDevice: sibling.device });
  const door = { mint: async () => {} } as never;
  return {
    host, logged, drain,
    wornSlot: () => worn.announcing(wornSlots.of({ group: "group-h0", atomKey: "a0".repeat(32), faceDoor: door })).slotDoc("daemon", "working"),
    siblingSlot: () => sibling.announcing(siblingSlots.of({ group: "group-h1", atomKey: "a1".repeat(32), faceDoor: door })).slotDoc("daemon", "working"),
  };
}

describe("the host's daemon working layer follows the worn face's own slot alone", () => {
  test("H1 RED — a sibling face's daemon working document, announced and able to open, leaves the host layer where it stands", async () => {
    const r = stand();
    const sib = await r.siblingSlot();
    expect(sib?.url, "the setup took: the sibling's own device slot minted").toBeTruthy();
    await r.drain();
    expect(r.host.documentId, "the host's working layer followed a sibling face's daemon document").toBe("worn-face-doc");
    expect(r.logged.join("\n")).toMatch(/a sibling face's daemon doc; the host follows its own face alone/);
  });

  test("H2 CONTROL — the worn face's own announcement still moves the host layer", async () => {
    const r = stand();
    const own = await r.wornSlot();
    await r.drain();
    expect(own?.url).toBeTruthy();
    expect(`automerge:${r.host.documentId}`, "the worn face's own re-announcement moves the host layer").toBe(own!.url);
    expect(r.logged.join("\n")).not.toMatch(/sibling/);
  });
});
