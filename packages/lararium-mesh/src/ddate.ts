/**
 * ddate — the Discordian calendar, computed from a Gregorian date the caller names.
 *
 * Five seasons of 73 days (Chaos, Discord, Confusion, Bureaucracy, The Aftermath), a five-day week (Sweetmorn,
 * Boomtime, Pungenday, Prickle-Prickle, Setting Orange) cycling on the day of the season, the year of Our Lady of
 * Discord (YOLD) at the Gregorian year plus 1166, and St. Tib's Day on February 29 standing outside every season and
 * week, so the days after it keep their place in the calendar. Day 5 of a season holds its apostle's holyday, day 50
 * its season holyday. X-Day falls on Confusion 40, 9827 YOLD, the SubGenius reckoning that moved the first X-Day's
 * date once it passed without incident.
 *
 * THE CLOCK SEAM. The core reads no clock: every function takes the Gregorian date it answers for. A caller at an edge
 * (the CLI, a daemon verb's caller, a wiki macro) reads its own clock and passes the day in; the same day always
 * answers the same words. The one draw of chance (`%.`) comes from an injected entropy door (`./entropy-door.js`).
 *
 * THE FORMAT CODES follow the `ddate(1)` the hosts carry, with two additions:
 *
 *   %A %a  weekday, long and short        %B %b  season, long and short
 *   %d     day of the season              %e     the day as an ordinal (1st, 11th, 21st, 22nd, 23rd)
 *   %E     the ordinal by its last digit alone (11st, 12nd, 13rd): the first ddate's reading, kept as an easter egg
 *   %H     the day's holyday, or nothing  %N     stop here unless today holds a holyday
 *   %Y     the YOLD                       %X     days until X-Day (negative once it passed)
 *   %n %t  newline, tab                   %.     an exclamation drawn through the entropy door
 *   %{ %}  the span between them reads "St. Tib's Day" on February 29 and prints plain on every other day
 *
 * A code this core does not know prints nothing. On St. Tib's Day a field outside the `%{ %}` span (`%A %a %B %b %d
 * %e %E`) reads "St. Tib's Day": the day carries no weekday, season or number, and the name stands in each place.
 * Of several `%{ %}` spans only the last one is replaced, as the hosts' ddate does.
 *
 * Platform-blind and pure.
 */

import { entropyPick, type EntropyDoor } from "./entropy-door.js";

/** A Gregorian date as people write it: `year` carries no year zero, so -1 names 1 BCE. */
export interface GregorianDate {
  readonly year: number;
  readonly month: number;
  readonly day: number;
}

export const SEASONS = ["Chaos", "Discord", "Confusion", "Bureaucracy", "The Aftermath"] as const;
export const SEASONS_SHORT = ["Chs", "Dsc", "Cfn", "Bcy", "Afm"] as const;
export const WEEKDAYS = ["Sweetmorn", "Boomtime", "Pungenday", "Prickle-Prickle", "Setting Orange"] as const;
export const WEEKDAYS_SHORT = ["SM", "BT", "PD", "PP", "SO"] as const;
/** Day 5 of each season. */
export const APOSTLE_HOLYDAYS = ["Mungday", "Mojoday", "Syaday", "Zaraday", "Maladay"] as const;
/** Day 50 of each season. */
export const SEASON_HOLYDAYS = ["Chaoflux", "Discoflux", "Confuflux", "Bureflux", "Afflux"] as const;

export const TIBS_DAY = "St. Tib's Day";

/** What `%.` draws from, in the order the hosts' ddate keeps them. */
export const EXCLAMATIONS = [
  "Hail Eris!", "All Hail Discordia!", "Kallisti!", "Fnord.", "Or not.", "Wibble.", "Pzat!", "P'tang!", "Frink!",
  "Grudnuk demand sustenance!", "Keep the Lasagna flying!", "You are what you see.", "Or is it?",
  "This statement is false.", "Lies and slander, sire!", "Hee hee hee!", "Hail Eris, Hack Linux!",
] as const;

/** The format a bare `ddate` reads today with. */
export const DEFAULT_FORMAT = "Today is %{%A, the %e day of %B%} in the YOLD %Y%N%nCelebrate %H";
/** The format a ddate reads with when the caller names the date. */
export const DEFAULT_DATED_FORMAT = "%{%A, %B %d%}, %Y YOLD";

/** X-Day: Confusion 40, 9827 YOLD, which falls on the Gregorian date below. */
export const X_DAY_GREGORIAN: GregorianDate = { year: 8661, month: 7, day: 5 };

export interface DiscordianDay {
  /** The Gregorian date this day answers for. */
  readonly gregorian: GregorianDate;
  /** The year of Our Lady of Discord. */
  readonly yold: number;
  /** True on St. Tib's Day, which stands outside every season and week. */
  readonly tibs: boolean;
  /** 0..4 into {@link SEASONS}; -1 on St. Tib's Day. */
  readonly season: number;
  /** 1..73 within the season; 0 on St. Tib's Day. */
  readonly dayOfSeason: number;
  /** 0..4 into {@link WEEKDAYS}; -1 on St. Tib's Day. */
  readonly weekday: number;
  /** The holyday this day keeps, or null. */
  readonly holyday: string | null;
}

const CUMULATIVE_DAYS = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334] as const;
const MONTH_LENGTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31] as const;

/** The Gregorian leap rule on the year as written (the date's validity reads it so). */
function isLeap(year: number): boolean {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}

/** True when `date` names a day: a whole year (never zero), a month 1..12 and a day within that month. */
export function isGregorianDate(date: GregorianDate): boolean {
  const { year, month, day } = date;
  if (![year, month, day].every(Number.isInteger) || year === 0 || Math.abs(year) > 0x7fff_ffff) return false;
  if (month < 1 || month > 12) return false;
  const length = (MONTH_LENGTH[month - 1] as number) + (month === 2 && isLeap(year) ? 1 : 0);
  return day >= 1 && day <= length;
}

/** Days since 1970-01-01 of a proleptic Gregorian date in astronomical years (year 0 stands). */
function daysFromCivil(year: number, month: number, day: number): number {
  const y = month <= 2 ? year - 1 : year;
  const era = Math.floor(y / 400);
  const yearOfEra = y - era * 400;
  const dayOfYear = Math.floor((153 * (month + (month > 2 ? -3 : 9)) + 2) / 5) + day - 1;
  const dayOfEra = yearOfEra * 365 + Math.floor(yearOfEra / 4) - Math.floor(yearOfEra / 100) + dayOfYear;
  return era * 146097 + dayOfEra - 719468;
}

/** The astronomical year of a year written without a year zero. */
const astronomical = (year: number): number => (year > 0 ? year : year + 1);

/**
 * The Discordian day of a Gregorian date, or null when the date names no day. The YOLD reads the year plus 1166
 * (a BCE year counts one more, since no year zero stands between 1 BCE and 1 CE).
 */
export function discordianDay(date: GregorianDate): DiscordianDay | null {
  if (!isGregorianDate(date)) return null;
  const { year, month, day } = date;
  const yold = year > 0 ? year + 1166 : year + 1167;
  const leap = isLeap(year);
  let yearDay = (CUMULATIVE_DAYS[month - 1] as number) + day - 1;
  if (leap && month > 2) yearDay += 1;
  if (leap && yearDay === 59) {
    return { gregorian: date, yold, tibs: true, season: -1, dayOfSeason: 0, weekday: -1, holyday: null };
  }
  if (leap && yearDay > 59) yearDay -= 1;
  const season = Math.floor(yearDay / 73);
  const dayOfSeason = (yearDay % 73) + 1;
  const holyday = dayOfSeason === 5 ? (APOSTLE_HOLYDAYS[season] as string)
    : dayOfSeason === 50 ? (SEASON_HOLYDAYS[season] as string)
    : null;
  return { gregorian: date, yold, tibs: false, season, dayOfSeason, weekday: yearDay % 5, holyday };
}

/** Whole days from `date` to X-Day (negative once X-Day has passed). */
export function daysUntilXDay(date: GregorianDate): number {
  const x = X_DAY_GREGORIAN;
  return daysFromCivil(x.year, x.month, x.day) - daysFromCivil(astronomical(date.year), date.month, date.day);
}

const suffixOf = (last: number): string => (last === 1 ? "st" : last === 2 ? "nd" : last === 3 ? "rd" : "th");

/** The ordinal as people say it: 1st, 2nd, 3rd, 4th, 11th, 12th, 13th, 21st, 22nd, 23rd. */
export function ordinal(n: number): string {
  const teen = Math.abs(n) % 100 >= 11 && Math.abs(n) % 100 <= 13;
  return `${n}${teen ? "th" : suffixOf(Math.abs(n) % 10)}`;
}

/** The ordinal by its last digit alone: 11st, 12nd, 13rd. The easter egg `%E` prints this. */
export function ordinalByLastDigit(n: number): string {
  return `${n}${suffixOf(Math.abs(n) % 10)}`;
}

export interface FormatResult {
  readonly text: string;
  /** The entropy door's `source` when the format drew from it (`%.`); null when the text rests on the day alone. */
  readonly entropy: string | null;
}

/** Render one Discordian day through a format. The text carries no trailing newline. */
export function formatDiscordian(day: DiscordianDay, format: string, door: EntropyDoor): FormatResult {
  let out = "";
  let drew = false;
  const tibStart = day.tibs ? format.lastIndexOf("%{") : -1;
  const tibEnd = day.tibs ? format.lastIndexOf("%}") : -1;
  const tibsOr = (text: string): string => (day.tibs ? TIBS_DAY : text);
  let i = 0;
  while (i < format.length) {
    const ch = format[i] as string;
    if (ch !== "%") { out += ch; i += 1; continue; }
    if (i === tibStart) {
      out += TIBS_DAY;
      if (tibEnd > tibStart) { i = tibEnd + 2; continue; }
      break;
    }
    const code = format[i + 1];
    i += 2;
    switch (code) {
      case "A": out += tibsOr(WEEKDAYS[day.weekday] as string); break;
      case "a": out += tibsOr(WEEKDAYS_SHORT[day.weekday] as string); break;
      case "B": out += tibsOr(SEASONS[day.season] as string); break;
      case "b": out += tibsOr(SEASONS_SHORT[day.season] as string); break;
      case "d": out += tibsOr(String(day.dayOfSeason)); break;
      case "e": out += tibsOr(ordinal(day.dayOfSeason)); break;
      case "E": out += tibsOr(ordinalByLastDigit(day.dayOfSeason)); break;
      case "H": out += day.holyday ?? ""; break;
      case "N": if (day.holyday === null) return { text: out, entropy: drew ? door.source : null }; break;
      case "n": out += "\n"; break;
      case "t": out += "\t"; break;
      case "Y": out += String(day.yold); break;
      case "X": out += String(daysUntilXDay(day.gregorian)); break;
      case ".": out += entropyPick(door, EXCLAMATIONS); drew = true; break;
      default: break;
    }
  }
  return { text: out, entropy: drew ? door.source : null };
}

/** The reading of one command line, in the shape the CLI, the daemon verb and the wiki macro all share. */
export type DdateReading =
  | { readonly kind: "ok"; readonly text: string; readonly entropy: string | null; readonly day: DiscordianDay }
  | { readonly kind: "usage" }
  | { readonly kind: "invalid" };

export const DDATE_USAGE = "usage: ddate [+format] [day month year]";
export const DDATE_INVALID = "Invalid date -- out of range";

/** A whole number from a token's leading digits (an optional sign and whitespace allowed); any other token reads 0. */
function leadingInteger(token: string): number {
  const m = /^\s*([+-]?\d+)/.exec(token);
  return m === null ? 0 : Number(m[1]);
}

/**
 * Read `ddate [+format] [day month year]`: a first token starting with `+` carries the format; the rest names no
 * date (today, which the caller passes in) or exactly day, month and year. A caller that names no format reads
 * {@link DEFAULT_FORMAT} for today and {@link DEFAULT_DATED_FORMAT} for a named date.
 */
export function readDdate(argv: readonly string[], today: GregorianDate, door: EntropyDoor): DdateReading {
  const named = argv[0]?.startsWith("+") === true;
  const format = named ? (argv[0] as string).slice(1) : null;
  const rest = named ? argv.slice(1) : argv;
  if (rest.length !== 0 && rest.length !== 3) return { kind: "usage" };
  const date: GregorianDate = rest.length === 0
    ? today
    : { day: leadingInteger(rest[0] as string), month: leadingInteger(rest[1] as string), year: leadingInteger(rest[2] as string) };
  const day = discordianDay(date);
  if (day === null) return { kind: "invalid" };
  const result = formatDiscordian(day, format ?? (rest.length === 0 ? DEFAULT_FORMAT : DEFAULT_DATED_FORMAT), door);
  return { kind: "ok", text: result.text, entropy: result.entropy, day };
}

/** What a surface that holds no command line asks: a format and, together or not at all, the three parts of a date. */
export interface DdateAsk {
  readonly format?: string | null;
  readonly day?: number | null;
  readonly month?: number | null;
  readonly year?: number | null;
}

/** The command line an ask spells; null when the date names some of its three parts and not all. */
export function ddateArgv(ask: DdateAsk): readonly string[] | null {
  const parts = [ask.day, ask.month, ask.year].filter((p) => p !== undefined && p !== null);
  if (parts.length !== 0 && parts.length !== 3) return null;
  const format = ask.format === undefined || ask.format === null ? [] : [`+${ask.format}`];
  return parts.length === 0 ? format : [...format, String(ask.day), String(ask.month), String(ask.year)];
}

/** The reading as one plain record: the text, the entropy source a draw named, and the day's own parts. */
export function ddateRecord(reading: Extract<DdateReading, { kind: "ok" }>): Record<string, unknown> {
  const { day } = reading;
  return {
    text: reading.text,
    entropy: reading.entropy,
    gregorian: day.gregorian,
    yold: day.yold,
    tibs: day.tibs,
    season: day.tibs ? null : SEASONS[day.season],
    dayOfSeason: day.tibs ? null : day.dayOfSeason,
    weekday: day.tibs ? null : WEEKDAYS[day.weekday],
    holyday: day.holyday,
  };
}

/**
 * A deterministic door keyed on a day, for a surface that renders the day and never casts (a wiki macro): the same
 * day draws the same exclamation, and the door names itself as day-keyed.
 */
export function dayEntropy(date: GregorianDate): EntropyDoor {
  let state = (daysFromCivil(astronomical(date.year), date.month, date.day) >>> 0) || 1;
  return {
    source: "ddate:day-keyed (deterministic; never a cast)",
    fill: (bytes) => {
      for (let k = 0; k < bytes.length; k += 1) {
        // xorshift32 over the day number: a fixed walk, the same bytes for the same day.
        state ^= state << 13; state >>>= 0;
        state ^= state >>> 17;
        state ^= state << 5; state >>>= 0;
        bytes[k] = state & 0xff;
      }
      return bytes;
    },
  };
}
