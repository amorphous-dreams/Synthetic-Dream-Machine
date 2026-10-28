/**
 * session-switch.test — the five-step fence switches one session and no other.
 *
 * Real sessions on the contract's own table, wearing faces the one supplier built, each holding a real signer, so a
 * signature here asks the table an owner would hold.
 *
 * Canon: lar:///ha.ka.ba/lares/api/pono/session-contract#/the-switch
 */
import * as ed25519 from "@noble/ed25519";
import { describe, expect, test } from "vitest";
import { utf8Bytes } from "../src/crypto.js";
import { checkVesselChain, foldWithdrawals, type VesselFaceKeyCustody } from "../src/face-authority.js";
import { SessionTable, sessionBinding, type Session, type SessionBinding, type SessionFace } from "../src/session-contract.js";
import { supplySessionFace } from "../src/session-face.js";
import { mintSessionSigner, type SessionSigner } from "../src/session-signer.js";
import { switchSession, type SessionSwitchPorts, type SessionSwitchTarget, type SwitchIntent, type SwitchOutcome } from "../src/session-switch.js";
import { SWITCH_ACT_URI_PREFIX, buildSwitchAct, neverProjects } from "../src/verb-tiddler.js";
import { chain, type Chain, type Pair } from "./face-proof-fixture.js";

const NEXUS = "nexus-switch.synthetic";
const PAYLOAD = utf8Bytes("a synthetic act");
const custodyOf = (by: Pair): VesselFaceKeyCustody => ({ signAsVesselFace: (_s, _k, image) => ed25519.signAsync(image, by.secret) });

function faceOf(c: Chain, group: string): SessionFace {
  const fold = foldWithdrawals(c.scope);
  if (!("memory" in fold)) throw new Error(fold.refusal);
  const verdict = checkVesselChain({ admitted: c.scope, certificate: c.certificate, memory: fold.memory });
  if (verdict.verdict !== "verified") throw new Error(verdict.verdict);
  const supply = supplySessionFace({
    chain: verdict.chain, vesselFaceKey: c.vessel.key,
    admit: { verdict: { state: "held", reason: "held", nym: c.scope.faceKey }, head: c.scope.faceKey, nexus: c.scope.nexus, admitRef: `admit-${group}`, revision: `heads-${group}` },
    grant: { personaGroup: group, faceKey: c.scope.faceKey, nexus: c.scope.nexus, revision: `group-${group}` },
  });
  if (!("face" in supply)) throw new Error(supply.refusal);
  return supply.face;
}

/** One face a vessel holds: its chain and the face the supplier builds from it. */
interface Held { readonly chain: Chain; readonly face: SessionFace }
const held = async (label: string, group: string): Promise<Held> => {
  const c = await chain(label, NEXUS);
  return { chain: c, face: faceOf(c, group) };
};

/** A session the owner holds, and the one signer the session holds. */
interface Live { binding: SessionBinding; session: Session; signer: SessionSigner; wears: Held }

async function mint(table: SessionTable, binding: SessionBinding, session: Session, wears: Held): Promise<SessionSigner> {
  const minted = await mintSessionSigner({ table, binding, session, certificate: wears.chain.certificate, apart: [], custody: custodyOf(wears.chain.vessel) });
  if (!("signer" in minted)) throw new Error(minted.refusal);
  return minted.signer;
}

async function openLive(table: SessionTable, wears: Held): Promise<Live> {
  const binding = sessionBinding("socket");
  const opened = table.open(binding, wears.face, "face");
  if (!opened.ok) throw new Error(opened.refusal);
  return { binding, session: opened.session, signer: await mint(table, binding, opened.session, wears), wears };
}

const envelopeOf = (s: Session) => ({ ownerEpoch: s.ownerEpoch, sessionId: s.sessionId, generation: s.generation, faceRef: s.face.proofSubject });

/** The owner's ports over one live session: the fence drops its signer, the commit mints the target's. */
function portsFor(table: SessionTable, live: Live, to: Held, over: Partial<SessionSwitchPorts<SessionSwitchTarget>> = {}) {
  const acts: Array<SwitchIntent | SwitchOutcome> = [];
  const steps: string[] = [];
  const ports: SessionSwitchPorts<SessionSwitchTarget> = {
    table, binding: live.binding, envelope: envelopeOf(live.session), mintActId: () => "act-1",
    preflight: async () => { steps.push("preflight"); return { ok: true, target: { face: to.face, profile: "face" } }; },
    writeIntent: async (intent) => { steps.push("intent"); acts.push(intent); },
    fence: async () => { steps.push("fence"); live.signer.drop(); },
    commit: async (next) => {
      steps.push("commit");
      live.signer = await mint(table, live.binding, next, to);
      live.session = next; live.wears = to;
      return { ok: true };
    },
    writeOutcome: async (outcome) => { steps.push("outcome"); acts.push(outcome); },
    ...over,
  };
  return { ports, acts, steps };
}

const signs = async (signer: SessionSigner) => {
  const signed = await signer.sign("act", PAYLOAD);
  return "signature" in signed ? "signs" : signed.refusal;
};

describe("the switch fences one session", () => {
  test("RED: switching one session leaves a sibling session's face, generation, state and signer as they stood", async () => {
    const [a, b] = [await held("switch-a", "aaaa0001aaaa0001"), await held("switch-b", "bbbb0002bbbb0002")];
    const table = new SessionTable("owner-switch");
    const sibling = await openLive(table, a);
    const switching = await openLive(table, a);
    const siblingBefore = table.check(envelopeOf(sibling.session), sibling.binding);
    const switchingBefore = envelopeOf(switching.session);
    const { ports, steps } = portsFor(table, switching, b);
    const result = await switchSession(ports);
    expect(result).toMatchObject({ ok: true, switched: true, session: { generation: 1, state: "live" } });
    expect(steps).toEqual(["preflight", "intent", "fence", "commit", "outcome"]);
    expect(switching.session.face.proofSubject).toBe(b.face.proofSubject);
    // The sibling's record reads byte for byte as it stood, one generation on reads stale, and it still signs.
    expect(table.check(envelopeOf(sibling.session), sibling.binding)).toEqual(siblingBefore);
    expect(table.check({ ...envelopeOf(sibling.session), generation: 1 }, sibling.binding)).toEqual({ ok: false, refusal: "stale-generation" });
    expect(await signs(sibling.signer)).toBe("signs");
    expect(table.size).toBe(2);
    // And the sibling switches on its own afterwards, leaving the first session where its switch left it.
    const again = portsFor(table, sibling, b);
    expect(await switchSession(again.ports)).toMatchObject({ ok: true, switched: true, session: { generation: 1 } });
    expect(table.check(switchingBefore, switching.binding)).toMatchObject({ ok: false, refusal: "stale-generation" });
    expect(table.check({ ...switchingBefore, generation: 1 }, switching.binding)).toMatchObject({ ok: true, session: { face: { proofSubject: b.face.proofSubject } } });
  });

  test("RED: the old generation signs nothing after the switch, frozen calls refuse mid-switch, and the new signer signs", async () => {
    const [a, b] = [await held("gen-a", "aaaa0003aaaa0003"), await held("gen-b", "bbbb0004bbbb0004")];
    const table = new SessionTable("owner-gen");
    const live = await openLive(table, a);
    const old = live.signer;
    const before = envelopeOf(live.session);
    let midSwitch: { call: string; sign: string } | null = null;
    const { ports } = portsFor(table, live, b, {
      writeIntent: async () => {
        const call = table.check(before, live.binding);
        midSwitch = { call: call.ok ? "ok" : call.refusal, sign: await signs(old) };
      },
    });
    expect(await switchSession(ports)).toMatchObject({ ok: true, switched: true });
    expect(midSwitch).toEqual({ call: "session-not-live", sign: "session-not-live" });
    expect(await signs(old)).toBe("signer-dropped");
    expect(table.check(before, live.binding)).toEqual({ ok: false, refusal: "stale-generation" });
    expect(await signs(live.signer)).toBe("signs");
    expect(live.signer.certificate.scope).toEqual(b.chain.scope);
  });

  test("CONTROL: re-wearing the face a session wears writes nothing, keeps its generation and leaves its signer signing", async () => {
    const a = await held("same-a", "aaaa0005aaaa0005");
    const table = new SessionTable("owner-same");
    const live = await openLive(table, a);
    const old = live.signer;
    const { ports, acts, steps } = portsFor(table, live, a);
    expect(await switchSession(ports)).toMatchObject({ ok: true, switched: false, session: { generation: 0, state: "live" } });
    expect(steps).toEqual(["preflight"]);
    expect(acts).toEqual([]);
    expect(await signs(old)).toBe("signs");
  });

  test("POSITIVE: two owners, each with its own face, switch only their own session", async () => {
    const [a, b, c] = [await held("pos-a", "aaaa0006aaaa0006"), await held("pos-b", "bbbb0007bbbb0007"), await held("pos-c", "cccc0008cccc0008")];
    const node = new SessionTable("owner-node");
    const browser = new SessionTable("owner-browser");
    const onNode = await openLive(node, a);
    const onBrowser = await openLive(browser, b);
    const n = portsFor(node, onNode, c);
    const w = portsFor(browser, onBrowser, a);
    const [rn, rw] = await Promise.all([switchSession(n.ports), switchSession(w.ports)]);
    expect(rn).toMatchObject({ ok: true, switched: true, session: { face: { proofSubject: c.face.proofSubject } } });
    expect(rw).toMatchObject({ ok: true, switched: true, session: { face: { proofSubject: a.face.proofSubject } } });
    expect(onNode.signer.certificate.scope).toEqual(c.chain.scope);
    expect(onBrowser.signer.certificate.scope).toEqual(a.chain.scope);
    expect([await signs(onNode.signer), await signs(onBrowser.signer)]).toEqual(["signs", "signs"]);
    expect(n.acts.map((act) => [act.outgoing, act.incoming])).toEqual([[a.face.proofSubject, c.face.proofSubject], [a.face.proofSubject, c.face.proofSubject]]);
    expect(w.acts.map((act) => [act.outgoing, act.incoming])).toEqual([[b.face.proofSubject, a.face.proofSubject], [b.face.proofSubject, a.face.proofSubject]]);
  });
});

describe("a switch that cannot finish", () => {
  test("a refused preflight returns the session live at its generation, its signer whole, and writes nothing", async () => {
    const [a, b] = [await held("pre-a", "aaaa0009aaaa0009"), await held("pre-b", "bbbb000abbbb000a")];
    const table = new SessionTable("owner-pre");
    const live = await openLive(table, a);
    const { ports, acts } = portsFor(table, live, b, { preflight: async () => ({ ok: false, refusal: "face-locked" }) });
    expect(await switchSession(ports)).toEqual({ ok: false, refusal: "face-locked", closed: false });
    expect(acts).toEqual([]);
    expect(table.check(envelopeOf(live.session), live.binding)).toMatchObject({ ok: true, session: { generation: 0, state: "live" } });
    expect(await signs(live.signer)).toBe("signs");
  });

  test("a preflight that throws thaws the session and names a code, its detail kept off the wire", async () => {
    const [a, b] = [await held("throw-a", "aaaa0011aaaa0011"), await held("throw-b", "bbbb0012bbbb0012")];
    const table = new SessionTable("owner-throw");
    const live = await openLive(table, a);
    const logged: string[] = [];
    const { ports } = portsFor(table, live, b, { preflight: async () => { throw new Error("/secret/path of another face"); }, log: (l) => logged.push(l) });
    const result = await switchSession(ports);
    expect(result).toEqual({ ok: false, refusal: "preflight-failed", closed: false });
    expect(JSON.stringify(result)).not.toContain("secret");
    expect(logged.join()).toContain("/secret/path");
    expect(await signs(live.signer)).toBe("signs");
  });

  test("an intent that never lands thaws the session, its signer whole, and closes the act aborted", async () => {
    const [a, b] = [await held("intent-a", "aaaa0013aaaa0013"), await held("intent-b", "bbbb0014bbbb0014")];
    const table = new SessionTable("owner-intent");
    const live = await openLive(table, a);
    const { ports, acts } = portsFor(table, live, b, { writeIntent: async () => { throw new Error("flush failed"); } });
    expect(await switchSession(ports)).toEqual({ ok: false, refusal: "intent-unwritten", closed: false });
    expect(acts).toEqual([expect.objectContaining({ outcome: "aborted", refusal: "intent-unwritten" })]);
    expect(table.check(envelopeOf(live.session), live.binding)).toMatchObject({ ok: true, session: { generation: 0 } });
    expect(await signs(live.signer)).toBe("signs");
  });

  test("a fence that throws, and an outcome that never lands, each close the session and record it closed", async () => {
    const [a, b] = [await held("fence-a", "aaaa0015aaaa0015"), await held("fence-b", "bbbb0016bbbb0016")];
    const table = new SessionTable("owner-fence");
    const fenced = await openLive(table, a);
    const f = portsFor(table, fenced, b, { fence: async () => { fenced.signer.drop(); throw new Error("channel stuck"); } });
    expect(await switchSession(f.ports)).toEqual({ ok: false, refusal: "fence-failed", closed: true });
    expect(f.acts.map((x) => ("outcome" in x ? `${x.outcome}:${x.refusal}` : "intent"))).toEqual(["intent", "closed:fence-failed"]);
    expect(table.check(envelopeOf(fenced.session), fenced.binding)).toEqual({ ok: false, refusal: "unknown-session" });

    // A committed switch whose outcome never lands runs on no record: the session closes and its new signer signs nothing.
    const unrecorded = await openLive(table, a);
    let outcomes = 0;
    const o = portsFor(table, unrecorded, b, { writeOutcome: async () => { outcomes++; throw new Error("flush failed"); } });
    expect(await switchSession(o.ports)).toEqual({ ok: false, refusal: "outcome-unwritten", closed: true });
    expect(outcomes).toBe(2);
    expect(await signs(unrecorded.signer)).not.toBe("signs");
  });

  test("an advance that refuses closes the session; nothing mints for a face the table would not wear", async () => {
    const a = await held("adv-a", "aaaa0017aaaa0017");
    const table = new SessionTable("owner-adv");
    const live = await openLive(table, a);
    const bad = { ...a.face, proofSubject: "another-subject", root: "synthetic-root" } as unknown as SessionFace;
    const { ports, steps } = portsFor(table, live, a, { preflight: async () => ({ ok: true, target: { face: bad } }) });
    expect(await switchSession(ports)).toEqual({ ok: false, refusal: "face-malformed", closed: true });
    expect(steps).not.toContain("commit");
  });

  test("two switches of one session at once: the second refuses while the first holds it, and the first lands", async () => {
    const [a, b, c] = [await held("twice-a", "aaaa0018aaaa0018"), await held("twice-b", "bbbb0019bbbb0019"), await held("twice-c", "cccc001acccc001a")];
    const table = new SessionTable("owner-twice");
    const live = await openLive(table, a);
    const first = portsFor(table, live, b);
    const second = portsFor(table, live, c);
    const [r1, r2] = await Promise.all([switchSession(first.ports), switchSession(second.ports)]);
    expect(r1).toMatchObject({ ok: true, switched: true, session: { generation: 1, face: { proofSubject: b.face.proofSubject } } });
    expect(r2).toEqual({ ok: false, refusal: "session-not-live", closed: false });
    expect(second.steps).toEqual([]);
  });

  test("a call checked while the commit mints finds the session switching, never live without its signer", async () => {
    const [a, b] = [await held("window-a", "aaaa001baaaa001b"), await held("window-b", "bbbb001cbbbb001c")];
    const table = new SessionTable("owner-window");
    const live = await openLive(table, a);
    let during: string | null = null;
    const base = portsFor(table, live, b);
    const { ports } = portsFor(table, live, b, { commit: async (next, target) => {
      const call = table.checkBound(envelopeOf(next), live.binding);
      during = call.ok ? "routed" : call.refusal;
      return base.ports.commit(next, target);
    } });
    expect(await switchSession(ports)).toMatchObject({ ok: true, switched: true });
    expect(during).toBe("session-not-live");
    expect(await signs(live.signer)).toBe("signs");
  });

  test("a session the owner closes mid-preflight answers session-closed and throws nothing", async () => {
    const [a, b] = [await held("gone-a", "aaaa001daaaa001d"), await held("gone-b", "bbbb001ebbbb001e")];
    const table = new SessionTable("owner-gone");
    const live = await openLive(table, a);
    const { ports, acts } = portsFor(table, live, b, { preflight: async () => { table.close(live.session.sessionId); return { ok: false, refusal: "face-locked" }; } });
    expect(await switchSession(ports)).toEqual({ ok: false, refusal: "session-closed", closed: true });
    expect(acts).toEqual([]);
    const again = await openLive(table, a);
    const mid = portsFor(table, again, b, { fence: async () => { again.signer.drop(); table.close(again.session.sessionId); } });
    expect(await switchSession(mid.ports)).toEqual({ ok: false, refusal: "session-closed", closed: true });
    expect(mid.steps).not.toContain("commit");
    expect(mid.acts.at(-1)).toMatchObject({ outcome: "closed", refusal: "session-closed" });
  });

  test("a re-admitted face (same subject, another admission) switches: unchanged compares every reference", async () => {
    const a = await held("readmit-a", "aaaa001faaaa001f");
    const table = new SessionTable("owner-readmit");
    const live = await openLive(table, a);
    const readmitted: Held = { chain: a.chain, face: { ...a.face, admitRef: "admit-again", causalRevision: "revision-again" } };
    const { ports } = portsFor(table, live, readmitted);
    expect(await switchSession(ports)).toMatchObject({ ok: true, switched: true, session: { generation: 1, face: { admitRef: "admit-again" } } });
  });

  test("a profile the target's hand would change refuses before the intent", async () => {
    const [a, b] = [await held("prof-a", "aaaa000baaaa000b"), await held("prof-b", "bbbb000cbbbb000c")];
    const table = new SessionTable("owner-prof");
    const live = await openLive(table, a);
    const { ports, acts } = portsFor(table, live, b, { preflight: async () => ({ ok: true, target: { face: b.face, profile: "seat" } }) });
    expect(await switchSession(ports)).toEqual({ ok: false, refusal: "profile-changed", closed: false });
    expect(acts).toEqual([]);
  });

  test("a commit that fails closes this session alone and records the partial outcome", async () => {
    const [a, b] = [await held("commit-a", "aaaa000daaaa000d"), await held("commit-b", "bbbb000ebbbb000e")];
    const table = new SessionTable("owner-commit");
    const live = await openLive(table, a);
    const sibling = await openLive(table, a);
    const { ports, acts } = portsFor(table, live, b, { commit: async () => ({ ok: false, refusal: "dial-refused" }) });
    expect(await switchSession(ports)).toEqual({ ok: false, refusal: "dial-refused", closed: true });
    expect(acts.map((act) => ("outcome" in act ? act.outcome : "intent"))).toEqual(["intent", "closed"]);
    expect(table.check(envelopeOf(live.session), live.binding)).toEqual({ ok: false, refusal: "unknown-session" });
    expect(await signs(live.signer)).toBe("signer-dropped");
    expect(await signs(sibling.signer)).toBe("signs");
  });

  test("a copied envelope on another binding opens no switch", async () => {
    const [a, b] = [await held("copy-a", "aaaa000faaaa000f"), await held("copy-b", "bbbb0010bbbb0010")];
    const table = new SessionTable("owner-copy");
    const live = await openLive(table, a);
    const { ports, steps } = portsFor(table, live, b, { binding: sessionBinding("socket") });
    expect(await switchSession(ports)).toEqual({ ok: false, refusal: "unbound-session", closed: false });
    expect(steps).toEqual([]);
  });
});

describe("the switch act rests beside the receipt facts", () => {
  test("its two phases rest under the act id, name a position and two faces, carry no session id, and never project", () => {
    const intent = { actId: "act-9", ownerEpoch: "owner-x", generation: 3, outgoing: "proof-a", incoming: "proof-b" };
    const a = buildSwitchAct(intent);
    const o = buildSwitchAct({ ...intent, outcome: "closed", refusal: "dial-refused" });
    expect(a.tiddler.title).toBe(`${SWITCH_ACT_URI_PREFIX}act-9/intent`);
    expect(o.tiddler).toMatchObject({ title: `${SWITCH_ACT_URI_PREFIX}act-9/outcome`, outcome: "closed", refusal: "dial-refused", generation: "3" });
    expect(Object.keys(a.tiddler).some((k) => /session/i.test(k))).toBe(false);
    expect(neverProjects(a.tiddler.title)).toBe(true);
  });
});
