/**
 * ddate — the calendar's own laws: the clock seam, the ordinals and the easter egg, the entropy door, X-Day.
 * The host-parity rows live in `ddate.golden.test.ts`.
 */
import { describe, test, expect } from "vitest";
import {
  DDATE_INVALID, DDATE_USAGE, DEFAULT_DATED_FORMAT, DEFAULT_FORMAT, EXCLAMATIONS, X_DAY_GREGORIAN,
  dayEntropy, daysUntilXDay, discordianDay, formatDiscordian, isGregorianDate, ordinal, ordinalByLastDigit, readDdate,
} from "../src/ddate.js";
import { PLATFORM_ENTROPY, entropyBelow, entropyPick, type EntropyDoor } from "../src/entropy-door.js";

/** A seeded door: a fixed xorshift walk, named as a replay. */
function seeded(seed: number): EntropyDoor {
  let s = seed >>> 0 || 1;
  return {
    source: `test:seeded(${seed})`,
    fill: (bytes) => {
      for (let i = 0; i < bytes.length; i += 1) { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; bytes[i] = s & 0xff; }
      return bytes;
    },
  };
}
const TODAY = { year: 2026, month: 11, day: 20 };
const say = (argv: readonly string[], door: EntropyDoor = seeded(1)): string => {
  const r = readDdate(argv, TODAY, door);
  if (r.kind !== "ok") throw new Error(r.kind);
  return r.text;
};

describe("ddate — the clock seam: the caller names the day, the core reads none", () => {
  test("the same day answers the same words, whatever else runs between", () => {
    const a = say(["+%A, %B %d, %Y", "20", "11", "2026"]);
    say(["+%A", "1", "1", "1999"]);
    expect(say(["+%A, %B %d, %Y", "20", "11", "2026"])).toBe(a);
    expect(a).toBe("Prickle-Prickle, The Aftermath 32, 3192");
  });

  test("a bare line reads the day the caller passes in, with the default format", () => {
    expect(say([])).toBe("Today is Prickle-Prickle, the 32nd day of The Aftermath in the YOLD 3192");
    expect(DEFAULT_FORMAT).toContain("%N");
    expect(DEFAULT_DATED_FORMAT).toBe("%{%A, %B %d%}, %Y YOLD");
    expect(say(["1", "1", "2024"])).toBe("Sweetmorn, Chaos 1, 3190 YOLD");
  });

  test("a bare line on a holyday carries the Celebrate line", () => {
    const r = readDdate([], { year: 2024, month: 1, day: 5 }, seeded(1));
    expect(r.kind === "ok" && r.text).toBe("Today is Setting Orange, the 5th day of Chaos in the YOLD 3190\nCelebrate Mungday");
  });
});

describe("ddate — ordinals and the easter egg", () => {
  test("the living ordinals", () => {
    expect([1, 2, 3, 4, 11, 12, 13, 21, 22, 23, 31, 41, 50, 73].map(ordinal))
      .toEqual(["1st", "2nd", "3rd", "4th", "11th", "12th", "13th", "21st", "22nd", "23rd", "31st", "41st", "50th", "73rd"]);
  });

  test("%e prints the living ordinal and %E the first ddate's last-digit ordinal", () => {
    expect(say(["+%e %E", "11", "1", "2025"])).toBe("11th 11st");
    expect(say(["+%e %E", "12", "1", "2025"])).toBe("12th 12nd");
    expect(say(["+%e %E", "13", "1", "2025"])).toBe("13th 13rd");
    expect(say(["+%e %E", "21", "1", "2025"])).toBe("21st 21st");
    expect(ordinalByLastDigit(11)).toBe("11st");
  });
});

describe("ddate — the entropy door", () => {
  test("%. draws one exclamation through the injected door and names the door's source", () => {
    const r = readDdate(["+%.", "1", "1", "2025"], TODAY, seeded(7));
    expect(r.kind).toBe("ok");
    if (r.kind !== "ok") return;
    expect(EXCLAMATIONS).toContain(r.text);
    expect(r.entropy).toBe("test:seeded(7)");
  });

  test("the same seed draws the same words and a format without %. names no source", () => {
    expect(say(["+%.|%.|%.", "1", "1", "2025"], seeded(42))).toBe(say(["+%.|%.|%.", "1", "1", "2025"], seeded(42)));
    const plain = readDdate(["+%A", "1", "1", "2025"], TODAY, seeded(42));
    expect(plain.kind === "ok" && plain.entropy).toBe(null);
  });

  test("the platform door names its source and fills real bytes", () => {
    expect(PLATFORM_ENTROPY.source).toBe("platform:crypto.getRandomValues");
    const bytes = new Uint8Array(64);
    PLATFORM_ENTROPY.fill(bytes);
    expect(bytes.some((b) => b !== 0)).toBe(true);
    expect(entropyBelow(PLATFORM_ENTROPY, 17)).toBeLessThan(17);
  });

  test("entropyBelow is unbiased over a short tail and refuses a bad bound", () => {
    const counts = new Array<number>(3).fill(0);
    const door = seeded(5);
    for (let i = 0; i < 3000; i += 1) counts[entropyBelow(door, 3)] = (counts[entropyBelow(door, 3)] as number) + 1;
    for (const c of counts) expect(c).toBeGreaterThan(800);
    expect(() => entropyBelow(door, 0)).toThrow(RangeError);
    expect(() => entropyPick(door, [])).toThrow(RangeError);
  });

  test("a day-keyed door replays the same draw for a day and says so", () => {
    const day = { year: 2026, month: 11, day: 20 };
    const a = formatDiscordian(discordianDay(day)!, "%.|%.", dayEntropy(day));
    const b = formatDiscordian(discordianDay(day)!, "%.|%.", dayEntropy(day));
    expect(a.text).toBe(b.text);
    expect(a.entropy).toMatch(/deterministic; never a cast/);
  });
});

describe("ddate — the calendar's own corners", () => {
  test("St. Tib's Day stands outside season and week, and the next day resumes", () => {
    const tibs = discordianDay({ year: 2024, month: 2, day: 29 })!;
    expect(tibs).toMatchObject({ tibs: true, holyday: null });
    expect(formatDiscordian(tibs, "%{%A, %B %d%}, %Y YOLD", seeded(1)).text).toBe("St. Tib's Day, 3190 YOLD");
    expect(say(["+%A %B %d", "1", "3", "2024"])).toBe("Setting Orange Chaos 60");
  });

  test("apostle holydays fall on day 5 and season holydays on day 50", () => {
    expect(say(["+%H", "5", "1", "2025"])).toBe("Mungday");
    expect(say(["+%H", "19", "2", "2025"])).toBe("Chaoflux");
    expect(say(["+%H", "5", "1", "2025"])).not.toBe("");
    expect(say(["+a%Nb", "6", "1", "2025"])).toBe("a");
    expect(say(["+a%Nb", "5", "1", "2025"])).toBe("ab");
  });

  test("X-Day counts down to Confusion 40, 9827 YOLD", () => {
    expect(daysUntilXDay(X_DAY_GREGORIAN)).toBe(0);
    expect(daysUntilXDay({ year: 8661, month: 7, day: 4 })).toBe(1);
    const x = discordianDay(X_DAY_GREGORIAN)!;
    expect(formatDiscordian(x, "%b %d, %Y", seeded(1)).text).toBe("Cfn 40, 9827");
  });

  test("a date naming no day reads invalid, and a wrong argument count reads usage", () => {
    expect(isGregorianDate({ year: 2023, month: 2, day: 29 })).toBe(false);
    expect(readDdate(["32", "1", "2024"], TODAY, seeded(1)).kind).toBe("invalid");
    expect(readDdate(["1", "1"], TODAY, seeded(1)).kind).toBe("usage");
    expect(DDATE_USAGE).toBe("usage: ddate [+format] [day month year]");
    expect(DDATE_INVALID).toBe("Invalid date -- out of range");
  });
});
