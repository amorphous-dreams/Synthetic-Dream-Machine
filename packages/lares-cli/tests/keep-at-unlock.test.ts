/**
 * keep-at-unlock — the operator's unlock strings a keep lei in the same act, under the one passphrase it already typed.
 *
 *   U1  unlock-offers-the-keep-lei: the house config names a keep workspace and no keep lei stands for it; on a terminal the
 *       unlock asks once, and a yes strings the lei (`swarm-lei-kui`, rite keep, branch = the workspace) under the very route
 *       the unlock gathered. The ward act takes that route as handed: no second prompt, no terminal asked again.
 *   U2  unlock-strings-no-keep-lei-without-a-workspace (CONTROL): a config that names no keep workspace reads no line, asks
 *       nothing and strings nothing; a lei that already stands, a no, a script (no terminal) and a pūlama unlock (no route)
 *       each string nothing.
 *   U4  unlock-offers-as-the-mount: an unlock that names no face strings the keep lei as the daemon mount, names it, and its
 *       by-hand hint names `--face N`; a named face asks no mount; with no mount (the floor) it strings nothing and names why.
 *   U3  the house config's keep workspace: `LARES_KEEP_WORKSPACE` names it (the environment first, else the operator's
 *       surface env file); with none named, the one pair LARES_WORKSPACES binds; several pairs and no name read none.
 *
 * The vessel's rows answer from a recorded fake; the terminal stands behind a port.
 */
import { describe, expect, test } from "vitest";
import type { Credential } from "@lararium/mesh";
import { KEEP_LEI_RETURNS, offerKeepLei, type KeepOfferPorts } from "../src/keep-at-unlock.js";
import { keepWorkspaceName } from "../src/keep-config.js";
import { wardTicketFor } from "../src/ward-door.js";

const ROUTE: Credential[] = [{ kind: "passphrase", passphrase: "test-founding-passphrase" }];

function rig(over: { lei?: Record<string, unknown>; yes?: boolean; terminal?: boolean; mount?: number | Error } = {}) {
  const calls: string[] = [], said: string[] = [], asked: string[] = [], routes: (readonly Credential[])[] = [];
  const ports: KeepOfferPorts = {
    canAsk: () => over.terminal !== false,
    ask: async (q) => { asked.push(q); return over.yes !== false; },
    row: async (verb, args, route) => {
      calls.push(`${verb} ${JSON.stringify(args)}`);
      if (route !== undefined) routes.push(route);
      if (verb === "swarm-show") return { ok: true, output: { lei: over.lei ?? { standing: false, refusal: "absent", after: null } } };
      return { ok: true, output: { cid: "c".repeat(64), rite: "keep", branch: args["branch"], returns: args["returns"] } };
    },
    say: (line) => { said.push(line); },
    ...(over.mount === undefined ? {} : { mountFace: async () => { if (over.mount instanceof Error) throw over.mount; return over.mount as number; } }),
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
      `swarm-show ${JSON.stringify({ rite: "keep", branch: "backup" })}`,
      `swarm-lei-kui ${JSON.stringify({ rite: "keep", branch: "backup", returns: KEEP_LEI_RETURNS, after: null })}`,
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

  test("U4 unlock-offers-as-the-mount: no face named, the offer reads and strings as the daemon mount and names it; a named face asks no mount; the floor strings nothing and says why", async () => {
    const r = rig({ mount: 1 });
    const out = await offerKeepLei(r.ports, { workspace: "backup", route: ROUTE });
    expect(out).toMatchObject({ offered: true, strung: true, face: 1, faceBy: "mount" });
    expect(r.calls).toEqual([
      `swarm-show ${JSON.stringify({ rite: "keep", branch: "backup", face: 1 })}`,
      `swarm-lei-kui ${JSON.stringify({ rite: "keep", branch: "backup", returns: KEEP_LEI_RETURNS, after: null, face: 1 })}`,
    ]);
    expect(r.asked[0]).toMatch(/acting as h1, the daemon mount/);
    // The by-hand hint names the face.
    const no = rig({ mount: 1, yes: false });
    await offerKeepLei(no.ports, { workspace: "backup", route: ROUTE });
    expect(no.said.join("\n")).toContain("lares lei kui --rite keep --branch backup --returns <n> --face 1");
    // A named face asks no mount.
    const named = rig({ mount: new Error("never asked") });
    expect(await offerKeepLei(named.ports, { workspace: "backup", route: ROUTE, face: 2 })).toMatchObject({ strung: true, face: 2, faceBy: "named" });
    expect(named.calls[0]).toBe(`swarm-show ${JSON.stringify({ rite: "keep", branch: "backup", face: 2 })}`);
    // THE FLOOR: no mount stands; nothing reads, nothing strings, and the line says why.
    const floor = rig({ mount: new Error("this vessel stands faces h0, h1 open and wears none of them") });
    expect(await offerKeepLei(floor.ports, { workspace: "backup", route: ROUTE })).toMatchObject({ offered: false, strung: false, why: "no-face" });
    expect(floor.calls).toEqual([]);
    expect(floor.said.join("\n")).toMatch(/wears none of them.*--face N/);
  });
});
