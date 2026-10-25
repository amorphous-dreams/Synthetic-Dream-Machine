import { describe, expect, test } from "vitest";
import { refusalIsHostDependency } from "../engine-refusal.js";

describe("the web config drops an engine only for a missing host library", () => {
  test("RED: the loader's own refusal line reads as a host dependency; CONTROL: Playwright's missing-dependencies report still does", () => {
    const loader = "[pid=511642][err] /home/u/.cache/ms-playwright/webkit-2370/minibrowser-wpe/bin/MiniBrowser: error while loading shared libraries: libevent-2.1.so.7: cannot open shared object file: No such file or directory";
    const report = "browserType.launch: Host system is missing dependencies to run browsers.\nlibgtk-4.so.1";
    expect(refusalIsHostDependency(loader)).toBe(true);
    expect(refusalIsHostDependency(report)).toBe(true);
  });

  test("a missing executable and a broken install keep failing loud", () => {
    expect(refusalIsHostDependency("browserType.launch: Executable doesn't exist at /home/u/.cache/ms-playwright/webkit-2370/pw_run.sh")).toBe(false);
    expect(refusalIsHostDependency("browserType.launch: Browser closed unexpectedly")).toBe(false);
  });
});
