/**
 * The problems goldens over the fixture carriers beside this file — read by the door's goldens
 * (`meme-check-problems.test.ts`) and by the canon matcher's weld (`meme-check-problems-matcher.test.ts`),
 * so both read one set of lines.
 *
 * `clean.mem` stands sealed beside this file. The faulted carriers tear it in the scratch dir, never in the
 * tree, since the pre-commit gate (rightly) refuses a torn or stale `.mem` staged: `torn` drops the ETX
 * line, `stale` moves one body word under the standing seal, `body-fault` defines `l-space` twice in the
 * meta fence.
 */
export const NAMES = ["clean", "torn", "stale", "body-fault"] as const;
export type FixtureName = (typeof NAMES)[number];

/** Each fixture's text, torn from the clean carrier's; throws where the clean carrier moved under it. */
export function fixtureText(name: FixtureName, clean: string): string {
  const tear = (from: string, to: string): string => {
    if (!clean.includes(from)) throw new Error(`fixtures/problems/clean.mem no longer holds ${JSON.stringify(from)}`);
    return clean.replace(from, to);
  };
  switch (name) {
    case "clean":      return clean;
    case "torn":       return tear(/<<\^ code=`&#x0003;`[^\n]*\n/.exec(clean)?.[0] ?? "<<^ code=`&#x0003;`", "");
    case "stale":      return tear("clean as it stands", "stale as it stands");
    case "body-fault": return tear("uri-path = \"ha.ka.ba/lares/test/problems-fixture\"\n", "uri-path = \"ha.ka.ba/lares/test/problems-fixture\"\nl-space  = \"stable\"\n");
  }
}

const STALE_STORED = "ni:///sha-256;qnF6uQ-mRjsPw8x7bmg81E_WlLyVVRf3HkV6e5Nv2iE";
const STALE_COMPUTED = "ni:///sha-256;_3ym4gcZplb573Fn3JbXkqDPOZa6iYuZvbtFsEmQOvc";

/** The exact problems lines each fixture prints, and the exit the human seat gives it. */
export const GOLDEN: Record<FixtureName, { lines: string[]; code: number }> = {
  clean: { lines: [], code: 0 },
  torn: {
    lines: ["torn.mem:4:1: error: no-etx: the frame opens and never closes — no block check can cover an unbounded span; close the frame by hand"],
    code: 1,
  },
  stale: {
    lines: [`stale.mem:21:21: error: stale-bcc: the block check covers other bytes — stored ${STALE_STORED} · computed ${STALE_COMPUTED}; \`lares meme normalize\` re-stamps it`],
    code: 1,
  },
  "body-fault": {
    lines: ["body-fault.mem:11:1: error: duplicate-meta-key: meta fence: duplicate key \"l-space\" (line 5) — TOML forbids defining a key twice; keep one"],
    code: 1,
  },
};

/** The default human output, pinned from the door before the problems mode stood: it never moves. */
export const HUMAN: Record<FixtureName, string> = {
  clean: "all 1 carrier(s) canonical.\n",
  torn: "torn: torn.mem\n"
    + "  ✗ the frame opens and never closes — no block check can cover an unbounded span; close the frame by hand\n"
    + "no carrier(s) normalized; 1 boundary/stage fault(s) remain. (1 standing off its declared stage)\n",
  stale: "would normalize: stale.mem\n"
    + "  - block check would re-stamp over the body it follows\n"
    + `  - stale: stored ${STALE_STORED} · computed ${STALE_COMPUTED}\n`
    + "1 of 1 carrier(s) drifted.\n",
  "body-fault": "fault: body-fault.mem\n"
    + "  ✗ duplicate-meta-key: meta fence: duplicate key \"l-space\" (line 5) — TOML forbids defining a key twice; keep one\n"
    + "no carrier(s) normalized; 1 boundary/stage fault(s) remain. (1 standing off its declared stage)\n",
};
