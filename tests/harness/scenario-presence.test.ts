import { describe, expect, test } from "vitest";
import {
  classifyStructuralCaps,
  defineScenarioCast,
  defineScenarioPresence,
  hasAttributedRelationship,
  hasHatRelationship,
  hasNamedHat,
  type ScenarioPresence,
} from "./scenario-presence.js";

const actor = { id: "alice", kind: "human" as const };

function presence(overrides: Partial<ScenarioPresence> = {}): ScenarioPresence {
  return {
    id: "alice-node-presence",
    actor,
    vessel: {
      id: "alice-node",
      caps: ["substrate", "daemon", "meshpalace", "carriage"],
      ...overrides.vessel,
    },
    hats: [],
    ...overrides,
  };
}

describe("ScenarioPresence — three independent, pure layers", () => {
  test("copies actor, structural stack, and named hats as independent plain data", () => {
    const source = presence({
      hats: [{ id: "h1", name: "holder", verb: "holds", issuer: "alice", subject: "alice", resource: "household" }],
    });
    const result = defineScenarioPresence(source);

    expect(result).toEqual(source);
    expect(result.actor).not.toBe(source.actor);
    expect(result.vessel).not.toBe(source.vessel);
    expect(result.vessel.caps).not.toBe(source.vessel.caps);
    expect(result.hats).not.toBe(source.hats);
  });

  test("derives Herm, Lararium, and leaf classes from caps only", () => {
    expect(classifyStructuralCaps({ caps: ["substrate", "daemon", "meshpalace", "carriage"] })).toBe("herm");
    expect(classifyStructuralCaps({ caps: ["substrate", "daemon", "meshpalace", "carriage", "persona", "wiki"] })).toBe("lararium");
    expect(classifyStructuralCaps({ caps: ["substrate"] })).toBe("leaf");
    expect(classifyStructuralCaps({ caps: ["daemon"] })).toBe("unclassified");
  });

  test("rejects duplicate IDs and duplicate structural caps", () => {
    expect(() => defineScenarioPresence(presence({
      hats: [{ id: "alice", name: "holder", verb: "holds", issuer: "alice", subject: "alice" }],
    }))).toThrow(/duplicate id "alice"/);
    expect(() => defineScenarioPresence(presence({
      vessel: { id: "alice-node", caps: ["substrate", "substrate"] },
    }))).toThrow(/duplicate structural cap "substrate"/);
  });

  test("rejects unknown structural caps before an adapter can interpret them", () => {
    expect(() => defineScenarioPresence(presence({
      vessel: { id: "alice-node", caps: ["substrate", "future-authority"] },
    }))).toThrow(/unknown structural cap "future-authority"/);
  });

  test("rejects an unbounded relationship verb", () => {
    expect(() => defineScenarioPresence(presence({
      hats: [{ id: "h1", name: "future role", verb: "delegates" as "operates", issuer: "alice", subject: "alice" }],
    }))).toThrow(/unknown relationship verb "delegates"/);
  });

  test("rejects a Herm class assertion when persona is present", () => {
    expect(() => defineScenarioPresence(presence({
      vessel: {
        id: "herm-with-face",
        caps: ["substrate", "daemon", "meshpalace", "carriage", "persona"],
        assertClass: "herm",
      },
    }))).toThrow(/class assertion "herm" disagrees with caps \("lararium"\)/);
  });

  test("keeps holder and reader as independent named observations", () => {
    const held = defineScenarioPresence(presence({
      hats: [{ id: "h1", name: "holder", verb: "holds", issuer: "alice", subject: "alice", resource: "private" }],
    }));

    expect(hasNamedHat(held, "alice", "holder")).toBe(true);
    expect(hasNamedHat(held, "alice", "reader")).toBe(false);
  });

  test("Kahu and office labels do not imply operating authority", () => {
    const labeled = defineScenarioPresence(presence({
      actor: { id: "civic-office", kind: "office" },
      hats: [
        { id: "h1", name: "kahu", verb: "seated-as", issuer: "civic-office", subject: "civic-office", resource: "corpus" },
        { id: "h2", name: "office", verb: "seated-as", issuer: "civic-office", subject: "civic-office", resource: "civic" },
      ],
    }));

    expect(hasNamedHat(labeled, "civic-office", "kahu")).toBe(true);
    expect(hasNamedHat(labeled, "civic-office", "office")).toBe(true);
    expect(hasNamedHat(labeled, "civic-office", "operator")).toBe(false);
  });

  test("permits one actor to stand independent Node and browser presences", () => {
    const cast = defineScenarioCast({
      presences: [
        presence({
          id: "alice-node-presence",
          vessel: { id: "alice-node", caps: ["substrate", "daemon", "meshpalace", "carriage"] },
          hats: [{ id: "node-op", name: "operator", verb: "operates", issuer: "alice", subject: "alice-node" }],
        }),
        presence({
          id: "alice-browser-presence",
          vessel: { id: "alice-browser", caps: ["substrate"] },
          hats: [{ id: "browser-reader", name: "reader", verb: "reads", issuer: "alice", subject: "alice-browser" }],
        }),
      ],
    });

    expect(cast.presences.map((item) => item.actor.id)).toEqual(["alice", "alice"]);
    expect(cast.presences.map((item) => item.vessel.id)).toEqual(["alice-node", "alice-browser"]);
  });

  test("rejects duplicate presence, vessel, and hat IDs while allowing a shared actor", () => {
    const node = presence({ hats: [{ id: "node-hat", name: "operator", verb: "operates", issuer: "alice", subject: "alice-node" }] });
    expect(() => defineScenarioCast({
      presences: [node, { ...node, actor, vessel: { id: "other-vessel", caps: ["substrate"] } }],
    })).toThrow(/duplicate presence id "alice-node-presence"/);

    expect(() => defineScenarioCast({
      presences: [
        node,
        { ...node, id: "browser-presence", vessel: { id: "alice-node", caps: ["substrate"] }, hats: [] },
      ],
    })).toThrow(/duplicate vessel id "alice-node"/);

    expect(() => defineScenarioCast({
      presences: [
        node,
        { ...node, id: "browser-presence", vessel: { id: "alice-browser", caps: ["substrate"] } },
      ],
    })).toThrow(/duplicate hat id "node-hat"/);
  });

  test("rejects a hat whose subject is absent from the cast", () => {
    expect(() => defineScenarioCast({
      presences: [presence({
        hats: [{ id: "h1", name: "reader", verb: "reads", issuer: "alice", subject: "missing-vessel" }],
      })],
    })).toThrow(/absent subject "missing-vessel"/);
  });

  test("keeps a Kahu seat separate from an operator relationship", () => {
    const kahu = defineScenarioCast({
      presences: [presence({
        hats: [{ id: "seat", name: "Kahu seat", verb: "seated-as", issuer: "alice", subject: "alice", resource: "civic" }],
      })],
    });

    expect(hasHatRelationship(kahu.presences[0]!, "alice", "seated-as")).toBe(true);
    expect(hasHatRelationship(kahu.presences[0]!, "alice", "operates")).toBe(false);
  });

  test("models a household Herm carrying without a reader relationship", () => {
    const herm = defineScenarioCast({
      presences: [
        {
          id: "home-herm-presence",
          actor: { id: "home-place", kind: "place" },
          vessel: {
            id: "home-herm",
            caps: ["substrate", "daemon", "meshpalace", "carriage"],
          },
          hats: [{ id: "transit", name: "household relay", verb: "carries", issuer: "home-herm", subject: "home-herm", resource: "ciphertext" }],
        },
      ],
    });

    expect(hasHatRelationship(herm.presences[0]!, "home-herm", "carries")).toBe(true);
    expect(hasHatRelationship(herm.presences[0]!, "home-herm", "reads")).toBe(false);
    expect(classifyStructuralCaps(herm.presences[0]!.vessel)).toBe("herm");
  });

  test("keeps a human operator relation from inheriting authority into an AI agent", () => {
    const human = presence({
      id: "alice-operator-presence",
      hats: [{
        id: "alice-agent-relation",
        name: "operator relation",
        verb: "operates",
        issuer: "alice",
        subject: "agent-a",
        evidence: { kind: "operator-declaration", ref: "alice-agent-a" },
      }],
    });
    const agent = {
      id: "agent-a-presence",
      actor: { id: "agent-a", kind: "agent" as const, label: "assistant" },
      vessel: { id: "agent-a-vessel", caps: ["substrate", "daemon", "meshpalace", "carriage"] },
      hats: [{ id: "agent-vessel-operation", name: "agent execution", verb: "operates" as const, issuer: "agent-a", subject: "agent-a-vessel" }],
    };
    const cast = defineScenarioCast({ presences: [human, agent] });

    expect(hasAttributedRelationship(cast.presences[0]!, "alice", "agent-a", "operates")).toBe(true);
    expect(hasAttributedRelationship(cast.presences[1]!, "alice", "agent-a-vessel", "operates")).toBe(false);
    expect(cast.presences[0]!.hats[0]!.evidence).toEqual({ kind: "operator-declaration", ref: "alice-agent-a" });
  });

  test("keeps one operator relationship attached to one of two distinct agents", () => {
    const operator = presence({
      id: "alice-agent-operator-presence",
      hats: [{ id: "only-agent-a", name: "operator relation", verb: "operates", issuer: "alice", subject: "agent-a" }],
    });
    const agentA = {
      id: "agent-a-presence",
      actor: { id: "agent-a", kind: "agent" as const },
      vessel: { id: "agent-a-vessel", caps: ["substrate"] },
      hats: [],
    };
    const agentB = {
      id: "agent-b-presence",
      actor: { id: "agent-b", kind: "agent" as const },
      vessel: { id: "agent-b-vessel", caps: ["substrate"] },
      hats: [],
    };
    const cast = defineScenarioCast({ presences: [operator, agentA, agentB] });

    expect(hasAttributedRelationship(cast.presences[0]!, "alice", "agent-a", "operates")).toBe(true);
    expect(hasAttributedRelationship(cast.presences[0]!, "alice", "agent-b", "operates")).toBe(false);
  });

  test("observes one AI agent through multiple vessels without a global identity singleton", () => {
    const agentA = {
      id: "agent-a-node-presence",
      actor: { id: "agent-a", kind: "agent" as const },
      vessel: { id: "agent-a-node", caps: ["substrate", "daemon", "meshpalace", "carriage"] },
      hats: [{ id: "agent-node-op", name: "execution", verb: "operates" as const, issuer: "agent-a", subject: "agent-a-node" }],
    };
    const agentBrowser = {
      id: "agent-a-browser-presence",
      actor: { id: "agent-a", kind: "agent" as const },
      vessel: { id: "agent-a-browser", caps: ["substrate"] },
      hats: [{ id: "agent-browser-op", name: "execution", verb: "operates" as const, issuer: "agent-a", subject: "agent-a-browser" }],
    };
    const cast = defineScenarioCast({ presences: [agentA, agentBrowser] });

    expect(cast.presences[0]!.actor.id).toBe(cast.presences[1]!.actor.id);
    expect(cast.presences[0]!.actor).not.toBe(cast.presences[1]!.actor);
    expect(cast.presences.map((item) => item.vessel.id)).toEqual(["agent-a-node", "agent-a-browser"]);
  });

  test("keeps an infrastructure relay's operator label from becoming an operator claim", () => {
    const relay = defineScenarioCast({
      presences: [{
        id: "relay-presence",
        actor: { id: "relay-place", kind: "infrastructure", label: "herm-relay" },
        vessel: { id: "relay-vessel", caps: ["substrate", "daemon", "meshpalace", "carriage"] },
        hats: [{
          id: "relay-service-label",
          name: "operator",
          verb: "carries",
          issuer: "relay-place",
          subject: "relay-vessel",
        }],
      }],
    });

    expect(hasNamedHat(relay.presences[0]!, "relay-vessel", "operator")).toBe(true);
    expect(hasAttributedRelationship(relay.presences[0]!, "relay-place", "relay-vessel", "operates")).toBe(false);
    expect(classifyStructuralCaps(relay.presences[0]!.vessel)).toBe("herm");
  });
});
