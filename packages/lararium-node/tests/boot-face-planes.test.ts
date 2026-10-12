/**
 * boot-face-planes — a boot reads a face from its own bootstrap alone. No oracle value reaches the
 * family, the worn pin, a plane's url or a sibling plane.
 */
import { describe, test, expect } from "vitest";
import {
  personaBagIdFor, personaSiblingBagIds, personaMembershipEntries, personaScopedBagIds,
  PERSONA_GROUP_DOC_ID_TIDDLER, DAEMON_BAG_ID, type PlaneEntry,
} from "@lararium/mesh";
import { bootFacePlanes, bootDaemonUrl } from "../src/boot-face-planes.js";

const G1 = "11".repeat(16);
const G2 = "22".repeat(16);
const U1 = "automerge:g1plane";
const U2 = "automerge:g2plane";

// A caller that hands an oracle anyway changes nothing: the function reads the bootstrap and the worn id.
const BOOT = (b: Record<string, { text?: string }>, o: Record<string, unknown>, w: string | null) =>
  (bootFacePlanes as unknown as (b: unknown, w: unknown, o: unknown) => ReturnType<typeof bootFacePlanes>)(b, w, o);
const asBootstrap = (entries: PlaneEntry[]): Record<string, { text?: string }> =>
  Object.fromEntries(entries.map((e) => [e.title, { text: e.text ?? undefined }]));
const planeOf = (g: string, url: string): PlaneEntry[] => personaMembershipEntries({ personaGroupId: g, url });
const oracleRec = (text: string) => ({ tiddler: { text } });
const oracleOf = (entries: PlaneEntry[]): Record<string, unknown> =>
  Object.fromEntries(entries.map((e) => [e.title, oracleRec(e.text ?? "")]));

describe("bootFacePlanes: the bootstrap alone answers", () => {
  test("CONTROL: a bootstrap naming two groups yields both, each with its own url", () => {
    const r = BOOT(asBootstrap([...planeOf(G1, U1), ...planeOf(G2, U2)]), {}, G2);
    expect(r.personaPlanes.map((p) => [p.personaGroupId, p.url])).toEqual([[G1, U1], [G2, U2]]);
    expect(r.personaUrl).toBe(U2);
    expect(r.personaBagId).toBe(personaBagIdFor(G2));
  });

  test("CONTROL: one group entered twice yields one plane, so no second layer can shadow the first", () => {
    const dup: Record<string, { text?: string }> = {
      ...asBootstrap(planeOf(G1, U1)),
      "persona/membership/other": { text: G1 },
    };
    expect(BOOT(dup, {}, G1).personaPlanes.map((p) => p.personaGroupId)).toEqual([G1]);
  });

  test("CONTROL: the bootstrap pin and the sibling planes read off the bootstrap", () => {
    const sib = personaSiblingBagIds(personaBagIdFor(G1));
    const b = {
      ...asBootstrap(planeOf(G1, U1)),
      [PERSONA_GROUP_DOC_ID_TIDDLER]: { text: G1 },
      [sib.identities]: { text: "automerge:ids" },
      [sib.circles]: { text: "automerge:circ" },
      [sib.sessions]: { text: "automerge:sess" },
    };
    const r = BOOT(b, {}, null);
    expect(r.personaGroupId).toBe(G1);
    expect([r.identitiesUrl, r.circlesUrl, r.sessionsUrl]).toEqual(["automerge:ids", "automerge:circ", "automerge:sess"]);
  });

  test("(i) an oracle holding a second group's membership and plane leaves the family at the bootstrap's one", () => {
    const r = BOOT(asBootstrap(planeOf(G1, U1)), oracleOf(planeOf(G2, U2)), G1);
    expect(r.personaPlanes.map((p) => p.personaGroupId)).toEqual([G1]);
  });

  test("(ii) an oracle tiddler titled like a plane never redirects the bootstrap's url", () => {
    const r = BOOT(asBootstrap(planeOf(G1, U1)), { [personaBagIdFor(G1)]: oracleRec("automerge:foreign") }, G1);
    expect(r.personaUrl).toBe(U1);
  });

  test("(iii) an oracle carrying the worn pin names no group for an empty bootstrap", () => {
    const r = BOOT({}, { [PERSONA_GROUP_DOC_ID_TIDDLER]: oracleRec(G1) }, null);
    expect(r.personaGroupId).toBeNull();
  });

  test("(iv) an oracle carrying a sibling plane url names none", () => {
    const sib = personaSiblingBagIds(personaBagIdFor(G1));
    const r = BOOT(asBootstrap(planeOf(G1, U1)), { [sib.identities]: oracleRec("automerge:foreign") }, G1);
    expect(r.identitiesUrl).toBeNull();
  });

  test("CONTROL: a bootstrap shaped as a founding lays it down yields the whole face with no oracle", () => {
    const face = personaScopedBagIds(G1);
    const b = {
      ...asBootstrap(planeOf(G1, U1)),
      [face.identities]: { text: "automerge:ids" },
      [face.circles]:    { text: "automerge:circ" },
      [face.sessions]:   { text: "automerge:sess" },
      [PERSONA_GROUP_DOC_ID_TIDDLER]: { text: G1 },
    };
    const r = bootFacePlanes(b, null);
    expect(r).toMatchObject({
      personaGroupId: G1, personaBagId: personaBagIdFor(G1), personaUrl: U1,
      identitiesUrl: "automerge:ids", circlesUrl: "automerge:circ", sessionsUrl: "automerge:sess",
    });
  });

  test("(a) an oracle carrying the daemon key names no daemon url for an empty bootstrap", () => {
    const o = { [DAEMON_BAG_ID]: oracleRec("automerge:foreign-daemon") };
    expect((bootDaemonUrl as unknown as (b: unknown, o: unknown) => string | null)({}, o)).toBeNull();
  });

  test("CONTROL: a bootstrap-named daemon url resolves, whatever an oracle carries", () => {
    const o = { [DAEMON_BAG_ID]: oracleRec("automerge:foreign-daemon") };
    expect((bootDaemonUrl as unknown as (b: unknown, o: unknown) => string | null)(
      { [DAEMON_BAG_ID]: { text: "automerge:mine" } }, o)).toBe("automerge:mine");
  });
});
