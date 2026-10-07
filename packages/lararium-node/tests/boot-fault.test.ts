/**
 * The boot-fault attestation weld: what a node writes when its boot throws must read back, through the
 * supervisor's own `fatalLine`, as a fault that names itself and its cure. A fault without a `fatal:` line
 * reads to `lares vessel stand` / `lares herm` as a stall, and the cure never reaches the operator.
 */
import { describe, it, expect } from "vitest";
import {
  isSerdeSkewFault, bootFaultReport, fatalLine, SERDE_SKEW_EXIT, SERDE_SKEW_CURE,
} from "../src/boot-fault.js";

const skew = new Error("[vessel-host] fault: tag for enum is not valid, found 7");

/** The attestation a supervisor reads: the boot log text after its start offset. */
const attest = (err: unknown): string =>
  ["[lararium] booting wiki lares", ...bootFaultReport(err).lines, ""].join("\n");

describe("boot-fault attestation", () => {
  it("a serde skew leads with ONE fatal: line naming the skew and its cure, and exits 75", () => {
    expect(isSerdeSkewFault(skew)).toBe(true);
    const report = bootFaultReport(skew);
    expect(report.code).toBe(SERDE_SKEW_EXIT);
    expect(report.code).toBe(75);
    expect(report.lines[0]).toMatch(/^\[lararium\] fatal: /);
    expect(report.lines.filter((l) => /fatal:/.test(l))).toHaveLength(1);
    expect(report.lines[0]).toContain("serde skew");
    expect(report.lines[0]).toContain(SERDE_SKEW_CURE);
  });

  it("the supervisor's fatalLine surfaces the skew cure, never a silent stall", () => {
    const text = attest(skew);
    expect(/fatal:/.test(text)).toBe(true);           // stand/herm's fault detector fires
    const line = fatalLine(text);
    expect(line).not.toBeNull();
    expect(line).toContain("lares vessel rite rebuild");
    expect(line!.length).toBeLessThanOrEqual(300);   // fits the one-line report whole
  });

  it("CONTROL: a non-skew fault reads back as its own message, never painted with the rebuild cure", () => {
    const err = new Error("archive sealed — set LARES_ARCHIVE_PASSPHRASE and boot again\nsecond line");
    expect(isSerdeSkewFault(err)).toBe(false);
    const report = bootFaultReport(err);
    expect(report.code).toBe(1);
    expect(report.lines[0]).toBe("[lararium] fatal: archive sealed — set LARES_ARCHIVE_PASSPHRASE and boot again");
    expect(report.lines.slice(1).join("\n")).toContain("at ");      // the stack rides below the one line
    const line = fatalLine(attest(err));
    expect(line).toBe("archive sealed — set LARES_ARCHIVE_PASSPHRASE and boot again");
    expect(line).not.toContain(SERDE_SKEW_CURE);
  });

  it("a non-Error throw still leads with a fatal: line", () => {
    expect(fatalLine(attest("boom"))).toBe("boom");
    expect(fatalLine("[lararium] booting\n[lararium] vessel-ready\n")).toBeNull();
  });
});
