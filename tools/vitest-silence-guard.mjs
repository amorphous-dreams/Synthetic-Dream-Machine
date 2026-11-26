// vitest-silence-guard — a vitest setup file: a suite file whose tests ran and asserted nothing reads red.
//
// A test that passes on silence (a refusal mapped to `[]` and then asserted empty, a loop over a collection that came back
// empty, a body that never reaches an `expect`) stands green whether the code works or refuses. Each test's assertion count
// (`expect.getState().assertionCalls`, which vitest resets as every test starts) adds to the file's tally; when the file's
// last test has run, a file that ran at least one test and tallied zero assertions fails here, naming itself. A file that
// ran no test (all skipped, or filtered out) tallies nothing and passes; one assertion anywhere in the file clears it.
// This guards the file, not each test: the per-test emptiness stays the test's own precondition assert.
import { afterAll, afterEach, expect } from "vitest";

let ran = 0;
let asserted = 0;

afterEach(() => {
  ran++;
  asserted += expect.getState().assertionCalls ?? 0;
});

afterAll(() => {
  if (ran > 0 && asserted === 0) {
    const file = expect.getState().testPath ?? "this suite file";
    throw new Error(`[vitest-silence-guard] ${file} ran ${ran} test(s) and made no assertion: a suite that passes on silence proves nothing\n  cure: assert the non-empty precondition before an emptiness, and assert a refusal by name (rejects.toThrow("<reason>"))`);
  }
});
