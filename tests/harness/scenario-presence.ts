/**
 * Pure scenario vocabulary for a vessel's present posture.
 *
 * This is deliberately test-only. It describes three independent layers:
 *   1. the actor identity descriptor,
 *   2. the vessel's structural capability stack,
 *   3. named hats/claims, which are observations and never authority.
 *
 * No layer imports a runtime, reads process state, or resolves a capability. An
 * adapter may later compile the structural layer into real cap modules and prove
 * the named claims against those modules.
 */

export const STRUCTURAL_CAPS = [
  "substrate",
  "daemon",
  "meshpalace",
  "carriage",
  "who-face",
  "read-face",
  "bulb",
  "wikislot",
  "wiki",
  "pool",
  "mount",
  "persona",
  "catalog",
] as const;

export type StructuralCap = (typeof STRUCTURAL_CAPS)[number];
export type StructuralClass = "herm" | "lararium" | "leaf" | "unclassified";
export type ActorKind = "human" | "agent" | "place" | "office" | "cabal" | "infrastructure";
export type RelationshipVerb = "operates" | "reads" | "holds" | "carries" | "owns" | "seated-as";

export const RELATIONSHIP_VERBS = [
  "operates",
  "reads",
  "holds",
  "carries",
  "owns",
  "seated-as",
] as const;

export interface ActorIdentityDescriptor {
  readonly id: string;
  readonly kind: ActorKind;
  /** A display label only; it carries no identity material or authority. */
  readonly label?: string;
}

export interface VesselStructuralCapStack {
  readonly id: string;
  /** String input is intentional: adapters can reject unknown future caps at this boundary. */
  readonly caps: readonly string[];
  /**
   * An optional test assertion. `classifyStructuralCaps` never reads it; validation
   * rejects it when it disagrees with the cap-derived class.
   */
  readonly assertClass?: StructuralClass;
}

export interface NamedHatDescriptor {
  readonly id: string;
  readonly name: string;
  /** A bounded relationship label; it does not grant or prove the relationship. */
  readonly verb: RelationshipVerb;
  /** Actor or vessel that attributes this descriptive claim; it is not a presenter. */
  readonly issuer: string;
  /** Subject is a name in the scenario, not a capability presenter. */
  readonly subject: string;
  readonly resource?: string;
  /** Optional fixture provenance; adapters must not interpret it as authority. */
  readonly evidence?: HatEvidenceDescriptor;
}

export interface HatEvidenceDescriptor {
  readonly kind: string;
  readonly ref?: string;
}

export interface ScenarioPresence {
  readonly id: string;
  readonly actor: ActorIdentityDescriptor;
  readonly vessel: VesselStructuralCapStack;
  readonly hats: readonly NamedHatDescriptor[];
}

export interface ScenarioCast {
  readonly presences: readonly ScenarioPresence[];
}

const CAP_SET = new Set<string>(STRUCTURAL_CAPS);
const RELATIONSHIP_VERB_SET = new Set<string>(RELATIONSHIP_VERBS);
const HERM_FLOOR: readonly StructuralCap[] = ["substrate", "daemon", "meshpalace", "carriage"];
const LARARIUM_LIFTS: readonly StructuralCap[] = [
  "wikislot",
  "wiki",
  "pool",
  "mount",
  "persona",
  "catalog",
];

function hasAll(caps: ReadonlySet<string>, required: readonly string[]): boolean {
  return required.every((cap) => caps.has(cap));
}

function duplicate(values: readonly string[]): string | undefined {
  const seen = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) return value;
    seen.add(value);
  }
  return undefined;
}

/** Derive the structural class from the declared cap IDs only. */
export function classifyStructuralCaps(stack: Pick<VesselStructuralCapStack, "caps">): StructuralClass {
  const caps = new Set(stack.caps);
  const hasLift = LARARIUM_LIFTS.some((cap) => caps.has(cap));

  if (hasAll(caps, HERM_FLOOR) && !hasLift) return "herm";
  if (hasLift) return "lararium";
  if (caps.has("substrate") && !caps.has("daemon")) return "leaf";
  return "unclassified";
}

/**
 * Validate and copy a presence descriptor. The returned value remains plain data;
 * it has no authority-bearing methods or ambient identity dependency.
 */
export function defineScenarioPresence(input: ScenarioPresence): ScenarioPresence {
  validateScenarioPresence(input);

  return {
    id: input.id,
    actor: { ...input.actor },
    vessel: {
      ...input.vessel,
      caps: [...input.vessel.caps],
    },
    hats: input.hats.map((hat) => ({ ...hat })),
  };
}

export function validateScenarioPresence(input: ScenarioPresence): void {
  if (!input.id) throw new Error("scenario presence id must be non-empty");
  if (!input.actor.id) throw new Error("scenario presence actor id must be non-empty");
  if (!input.vessel.id) throw new Error("scenario presence vessel id must be non-empty");
  if (!input.actor.kind) throw new Error("scenario presence actor kind must be declared");
  if (input.id === input.actor.id || input.id === input.vessel.id) {
    throw new Error(`scenario presence duplicate id "${input.id}" across presence and actor/vessel`);
  }
  if (input.actor.id === input.vessel.id) {
    throw new Error(`scenario presence duplicate id "${input.actor.id}" across actor and vessel`);
  }

  const duplicateCap = duplicate(input.vessel.caps);
  if (duplicateCap) throw new Error(`scenario presence duplicate structural cap "${duplicateCap}"`);
  for (const cap of input.vessel.caps) {
    if (!CAP_SET.has(cap)) throw new Error(`scenario presence unknown structural cap "${cap}"`);
  }

  const ids = [input.id, input.actor.id, input.vessel.id, ...input.hats.map((hat) => hat.id)];
  const duplicateId = duplicate(ids);
  if (duplicateId) throw new Error(`scenario presence duplicate id "${duplicateId}"`);

  for (const hat of input.hats) {
    if (!hat.id) throw new Error("scenario presence hat id must be non-empty");
    if (!hat.name) throw new Error(`scenario presence hat "${hat.id}" must have a name`);
    if (!hat.issuer) throw new Error(`scenario presence hat "${hat.id}" must have an issuer`);
    if (!hat.subject) throw new Error(`scenario presence hat "${hat.id}" must have a subject`);
    if (!RELATIONSHIP_VERB_SET.has(hat.verb)) {
      throw new Error(`scenario presence hat "${hat.id}" has unknown relationship verb "${hat.verb}"`);
    }
  }

  const derived = classifyStructuralCaps(input.vessel);
  if (input.vessel.assertClass && input.vessel.assertClass !== derived) {
    throw new Error(
      `scenario presence structural class assertion "${input.vessel.assertClass}" disagrees with caps ("${derived}")`,
    );
  }
}

/** Validate a multi-vessel cast. Actor IDs may repeat: one actor can stand several vessels. */
export function validateScenarioCast(input: ScenarioCast): void {
  const seenPresenceIds = new Set<string>();
  const seenVesselIds = new Set<string>();
  const seenHatIds = new Set<string>();
  const actorIds = new Set<string>();
  const vesselIds = new Set<string>();

  for (const presence of input.presences) {
    validateScenarioPresence(presence);

    if (seenPresenceIds.has(presence.id)) {
      throw new Error(`scenario cast duplicate presence id "${presence.id}"`);
    }
    seenPresenceIds.add(presence.id);

    if (seenVesselIds.has(presence.vessel.id)) {
      throw new Error(`scenario cast duplicate vessel id "${presence.vessel.id}"`);
    }
    seenVesselIds.add(presence.vessel.id);
    vesselIds.add(presence.vessel.id);
    actorIds.add(presence.actor.id);

    for (const hat of presence.hats) {
      if (seenHatIds.has(hat.id)) throw new Error(`scenario cast duplicate hat id "${hat.id}"`);
      seenHatIds.add(hat.id);
    }
  }

  const subjects = new Set([...actorIds, ...vesselIds]);
  for (const presence of input.presences) {
    for (const hat of presence.hats) {
      if (!subjects.has(hat.issuer)) {
        throw new Error(`scenario cast hat "${hat.id}" names absent issuer "${hat.issuer}"`);
      }
      if (!subjects.has(hat.subject)) {
        throw new Error(`scenario cast hat "${hat.id}" names absent subject "${hat.subject}"`);
      }
    }
  }
}

export function defineScenarioCast(input: ScenarioCast): ScenarioCast {
  validateScenarioCast(input);
  return {
    presences: input.presences.map((presence) => defineScenarioPresence(presence)),
  };
}

/** Read a named hat; reading a label does not grant or infer authority. */
export function hasNamedHat(
  presence: Pick<ScenarioPresence, "hats">,
  subject: string,
  name: string,
): boolean {
  return presence.hats.some((hat) => hat.subject === subject && hat.name === name);
}

/** Read a relationship label without turning it into an authority check. */
export function hasHatRelationship(
  presence: Pick<ScenarioPresence, "hats">,
  subject: string,
  verb: RelationshipVerb,
): boolean {
  return presence.hats.some((hat) => hat.subject === subject && hat.verb === verb);
}

/** Read an attributed relationship without turning it into an authority check. */
export function hasAttributedRelationship(
  presence: Pick<ScenarioPresence, "hats">,
  issuer: string,
  subject: string,
  verb: RelationshipVerb,
): boolean {
  return presence.hats.some((hat) => hat.issuer === issuer && hat.subject === subject && hat.verb === verb);
}
