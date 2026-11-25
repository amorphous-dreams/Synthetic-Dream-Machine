/**
 * keep-at-unlock — the operator's unlock strings a keep lei in the same act, under the one passphrase it already typed.
 *
 *   U1  unlock-offers-the-keep-lei: the house config names a keep workspace and no keep lei stands for it; on a terminal the
 *       unlock asks once, and a yes strings the lei (`swarm-lei-kui`, rite keep, branch = the workspace) under the very route
 *       the unlock gathered. The ward act takes that route as handed: no second prompt, no terminal asked again.
 *   U2  unlock-strings-no-keep-lei-without-a-workspace (CONTROL): a config that names no keep workspace reads no line, asks
 *       nothing and strings nothing; a lei that already stands, a no, a script (no terminal) and a pūlama unlock (no route)
 *       each string nothing.
 *   U4  keep-lei-stands-once-across-two-faces: the keep lei stands one per house, as the keep's face: the face whose keep lei
 *       already stands, else h0. Whoever wears, the offer reads that face's line; a lei standing on h1 offers nothing at an
 *       unlock that wears h0, and with none standing the offer strings as h0 and names it.
 *   U3  the house config's keep workspace: `LARES_KEEP_WORKSPACE` names it (the environment first, else the operator's
 *       surface env file); with none named, the one pair LARES_WORKSPACES binds; several pairs and no name read none.
 *
 * The vessel's rows answer from a recorded fake; the terminal stands behind a port.
 */
import { describe, expect, test } from "vitest";
import type { Credential } from "@lararium/mesh/keyslot-door";
import { KEEP_LEI_RETURNS, offerKeepLei, type KeepOfferPorts } from "../src/keep-at-unlock.js";
import { keepWorkspaceName } from "../src/keep-config.js";
import { wardTicketFor } from "../src/ward-door.js";

const ROUTE: Credential[] = [{ kind: "passphrase", passphrase: "test-founding-passphrase" }];

function rig(over: { lei?: Record<string, unknown>; leiOn?: Record<number, Record<string, unknown>>; yes?: boolean; terminal?: boolean; open?: readonly number[]; shut?: readonly number[]; mount?: number } = {}) {
  const calls: string[] = [], said: string[] = [], asked: string[] = [], routes: (readonly Credential[])[] = [];
  const ports: KeepOfferPorts = {
    canAsk: () => over.terminal !== false,
    ask: async (q) => { asked.push(q); return over.yes !== false; },
    row: async (verb, args, route) => {
      calls.push(`${verb} ${JSON.stringify(args)}`);
      if (route !== undefined) routes.push(route);
      // THE DOOR'S CHORE GATE: a line asked as a face other than the daemon mount refuses.
      if (over.mount !== undefined && args["face"] !== over.mount) return { ok: false, code: "chore-face-not-mounted", message: "chore-face-not-mounted" };
      if (verb === "swarm-show") {
        const per = over.leiOn?.[Number(args["face"])];
        return { ok: true, output: { lei: per ?? over.lei ?? { standing: false, refusal: "absent", after: null } } };
      }
      return { ok: true, output: { cid: "c".repeat(64), rite: "keep", branch: args["branch"], returns: args["returns"] } };
    },
    say: (line) => { said.push(line); },
    ...(over.open === undefined ? {} : { houseFaces: async () => ({ open: over.open!, shut: over.shut ?? [] }) }),
  };
  return { calls, said, asked, routes, ports };
}

describe("the keep lei at unlock", () => {
  test("U1 unlock-offers-the-keep-lei: one question, and a yes strings the keep lei under the unlock's own route", async () => {
    const r = rig();
    const out = await offerKeepLei(r.ports, { workspace: "backup", route: ROUTE });
    expect(out).toMatchObject({ offered: true, strung: true, workspace: "backup" });
    expect(r.asked).toHaveLength(1);
    expect(r.asked[0]).toMatch(/keep lei.*"backup".*same passphrase/);
    expect(r.calls).toEqual([
      `swarm-show ${JSON.stringify({ rite: "keep", branch: "backup", face: 0 })}`,
      `swarm-lei-kui ${JSON.stringify({ rite: "keep", branch: "backup", returns: KEEP_LEI_RETURNS, after: null, face: 0 })}`,
    ]);
    expect(r.routes).toEqual([ROUTE]);
    expect(r.routes[0]).toBe(ROUTE);
    // A spent line strings the next lei after the line's tip.
    const spent = rig({ lei: { standing: false, refusal: "returns-spent", after: "e".repeat(64) } });
    await offerKeepLei(spent.ports, { workspace: "backup", route: ROUTE });
    expect(spent.calls[1]).toContain(`"after":"${"e".repeat(64)}"`);
    // THE WARD TAKES THE ROUTE AS HANDED: with no terminal and no seated gatherer, a handed route parks a ticket, and none is asked.
    const ticket = await wardTicketFor("swarm-lei-kui", { rite: "keep", branch: "backup", returns: KEEP_LEI_RETURNS, after: null }, false, ROUTE);
    expect(typeof ticket["wardRef"]).toBe("string");
  });

  test("U2 unlock-strings-no-keep-lei-without-a-workspace (CONTROL): no workspace reads no line, asks nothing and strings nothing", async () => {
    const r = rig();
    expect(await offerKeepLei(r.ports, { workspace: null, route: ROUTE })).toMatchObject({ offered: false, strung: false, why: "no-workspace" });
    expect([r.calls, r.asked]).toEqual([[], []]);
    const standing = rig({ lei: { standing: true, reach: "wide", returnsLeft: 3, after: "e".repeat(64) } });
    expect(await offerKeepLei(standing.ports, { workspace: "backup", route: ROUTE })).toMatchObject({ offered: false, why: "standing" });
    expect(standing.asked).toEqual([]);
    const no = rig({ yes: false });
    expect(await offerKeepLei(no.ports, { workspace: "backup", route: ROUTE })).toMatchObject({ offered: true, strung: false, why: "declined" });
    expect(no.calls.filter((c) => c.startsWith("swarm-lei-kui"))).toEqual([]);
    const script = rig({ terminal: false });
    expect(await offerKeepLei(script.ports, { workspace: "backup", route: ROUTE })).toMatchObject({ offered: false, why: "no-terminal" });
    expect([script.calls, script.asked]).toEqual([[], []]);
    const pulama = rig();
    expect(await offerKeepLei(pulama.ports, { workspace: "backup", route: null })).toMatchObject({ offered: false, why: "no-route" });
    expect([pulama.calls, pulama.asked]).toEqual([[], []]);
  });

  test("U3 the keep workspace reads from LARES_KEEP_WORKSPACE, else the one pair LARES_WORKSPACES binds", () => {
    expect(keepWorkspaceName({ LARES_KEEP_WORKSPACE: "backup" }, null)).toBe("backup");
    expect(keepWorkspaceName({}, "LARES_KEEP_WORKSPACE=backup\n")).toBe("backup");
    expect(keepWorkspaceName({ LARES_WORKSPACES: "backup=/srv/house-backup" }, null)).toBe("backup");
    expect(keepWorkspaceName({}, "LARES_WORKSPACES=notes=/srv/notes\n")).toBe("notes");
    expect(keepWorkspaceName({ LARES_WORKSPACES: "notes=/srv/notes;backup=/srv/b" }, null)).toBeNull();
    expect(keepWorkspaceName({ LARES_WORKSPACES: "notes=/srv/notes;backup=/srv/b", LARES_KEEP_WORKSPACE: "backup" }, null)).toBe("backup");
    expect(keepWorkspaceName({}, null)).toBeNull();
    expect(keepWorkspaceName({ LARES_KEEP_WORKSPACE: "Not A Name" }, null)).toBeNull();
  });

  test("U4 keep-lei-stands-once-across-two-faces: whoever wears, the offer reads the keep's face; a lei standing there offers nothing", async () => {
    // A lei stands on h1: an unlock (wearing anything) reads h0, then h1, finds it standing, and offers nothing.
    const onOne = rig({ open: [0, 1], leiOn: { 1: { standing: true, reach: "wide", returnsLeft: 4, after: "e".repeat(64) } } });
    expect(await offerKeepLei(onOne.ports, { workspace: "backup", route: ROUTE })).toMatchObject({ offered: false, why: "standing", face: 1, faceBy: "keep" });
    expect(onOne.asked).toEqual([]);
    expect(onOne.calls.filter((c) => c.startsWith("swarm-lei-kui"))).toEqual([]);
    // keep-lei-offers-nothing-at-unlock-after-the-change: the lei on h0 stands, so a second face open asks nothing either.
    const onZero = rig({ open: [0, 1], leiOn: { 0: { standing: true, reach: "wide", returnsLeft: 4, after: "e".repeat(64) } } });
    expect(await offerKeepLei(onZero.ports, { workspace: "backup", route: ROUTE })).toMatchObject({ offered: false, why: "standing", face: 0 });
    expect(onZero.calls).toEqual([`swarm-show ${JSON.stringify({ rite: "keep", branch: "backup", face: 0 })}`]);
    // None stands: the offer strings as h0, the keep's face, and names it with whose route stands behind the ward.
    const none = rig({ open: [1, 2] });
    expect(await offerKeepLei(none.ports, { workspace: "backup", route: ROUTE })).toMatchObject({ offered: true, strung: true, face: 0, faceBy: "keep" });
    expect(none.calls.at(-1)).toBe(`swarm-lei-kui ${JSON.stringify({ rite: "keep", branch: "backup", returns: KEEP_LEI_RETURNS, after: null, face: 0 })}`);
    expect(none.asked[0]).toMatch(/as h0, the keep's face/);
    expect(none.asked[0]).toMatch(/face h0's ward/);
    // The unlock never names the keep's face: no `face` option rides the offer.
    expect("face" in ({} as Parameters<typeof offerKeepLei>[1])).toBe(false);
  });

  test("U5 the offer fires only while every face stands open and every line reads, none standing; otherwise it stays quiet", async () => {
    // A face stands shut: a lei may stand there, so the unlock asks nothing and strings nothing.
    const shut = rig({ open: [0], shut: [2] });
    expect(await offerKeepLei(shut.ports, { workspace: "backup", route: ROUTE })).toMatchObject({ offered: false, strung: false, why: "faces-unread" });
    expect(shut.asked).toEqual([]);
    expect(shut.calls.filter((c) => c.startsWith("swarm-lei-kui"))).toEqual([]);
    // Every face open, and h1's line refused at the gate (h0 wears): it stays quiet as well.
    const gated = rig({ open: [0, 1], mount: 0 });
    expect(await offerKeepLei(gated.ports, { workspace: "backup", route: ROUTE })).toMatchObject({ offered: false, why: "faces-unread" });
    expect(gated.asked).toEqual([]);
    // CONTROL: one face, open and read, none standing: the offer asks and strings as h0.
    const one = rig({ open: [0], mount: 0 });
    expect(await offerKeepLei(one.ports, { workspace: "backup", route: ROUTE })).toMatchObject({ offered: true, strung: true, face: 0 });
  });
});
