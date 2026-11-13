/**
 * recovery-contact-speech — enrolment says aloud what the word "recovery contact" does not, and the help glosses
 * "your Handle" at first use (operator, 2026-10-31: "Approve recovery contact, and during this rewrite we should use
 * Handle (& explain it) over 'name'"; "2 of 3").
 */
import { describe, test, expect } from "vitest";
import { recoveryContactEnrolmentSpeech } from "../src/commands/persona.js";
import { COMMAND_HELP } from "../src/command-help.js";

describe("what recovery-contact enrolment says", () => {
  test("two of these three, together, can restore your Handle, with the Handle glossed", () => {
    const spoken = recoveryContactEnrolmentSpeech().join("\n");
    expect(spoken).toContain("two of these three, together, can restore your Handle");
    expect(spoken).toContain("your Handle: the public card your face publishes, recognised by its own key");
    expect(spoken.toLowerCase()).not.toContain("guardian");
  });

  test("the persona help names the role recovery contact, glosses your Handle once, and says the rule", () => {
    const help = COMMAND_HELP["persona"]!;
    const text = [help.usage, help.synopsis, ...(help.examples ?? []), ...(help.flags ?? [])].join("\n");
    expect(text).toContain("recovery-contact enrol");
    expect(text).toContain("your Handle: the public card your face publishes, recognised by its own key");
    expect(text.match(/your Handle: the public card/g)).toHaveLength(1);
    expect(text).toContain("two of the three");
    expect(text.toLowerCase()).not.toContain("guardian");
  });
});
