/*\
title: lar:///ha.ka.ba/lararium/tw5/macros/ddate
type: application/javascript
module-type: macro
\*/
import { DEFAULT_FORMAT, dayEntropy, discordianDay, formatDiscordian } from "@lararium/mesh/ddate";

/**
 * `<<ddate>>` and `<<ddate format>>` — the Discordian date of the day the wiki renders on, through the house's own calendar core.
 *
 * The macro renders the DAY and never a cast: the same day answers the same words, and a `%.` in the format draws its
 * exclamation from a door keyed on the day, where the CLI and the daemon verb draw through the platform's entropy
 * door. THE CLOCK SEAM stays at this edge: the macro reads the local calendar day once and hands it to the core,
 * which reads no clock.
 *
 * The format takes the ddate(1) codes (`%A %a %B %b %d %e %E %H %N %n %t %Y %. %X %{ %}`); with none the default line
 * reads: "Today is Prickle-Prickle, the 32nd day of The Aftermath in the YOLD 3192".
 */
export const name = "ddate";

export const params = [{ name: "format" }];

export function run(format?: string): string {
  const here = new Date();
  const today = { year: here.getFullYear(), month: here.getMonth() + 1, day: here.getDate() };
  const day = discordianDay(today);
  if (day === null) return "";
  const asked = typeof format === "string" && format !== "" ? format : DEFAULT_FORMAT;
  return formatDiscordian(day, asked, dayEntropy(today)).text;
}
