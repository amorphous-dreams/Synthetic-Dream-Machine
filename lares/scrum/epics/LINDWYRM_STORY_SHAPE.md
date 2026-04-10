# The Lindwyrm's Hoard — Story Shape Document

> Register: `[S:0.70]` 🏛️🌊+🗡️-🎭-🔮- — shape, not prose; the container the story lives in
> Date: 2026-04-08
> Feeds: LINDWYRM_ORIGIN_OUTLINE.md (the story beats), The Kindling of the Crossroads Node (Gaia-side source)
> Format target: DreamDeck feed archive (Elyncia.app), JackPoint/Shadowtalk style

---

## Format: DreamDeck Feed Archive

The story is told AS a feed thread on the Elyncia DreamNet — the in-world equivalent of a JackPoint/Shadowland BBS post on Shadowrun's Matrix. The primary narrator posts the story; named characters annotate, react, challenge, and joke in sidebar comments threaded inline.

### Why This Format

Shadowrun's JackPoint format (4th/5th Edition) solved a specific problem: how to deliver exposition and worldbuilding as *conversation* rather than omniscient narration. The sourcebook content IS the message board thread. Characters with handles and reputations annotate the primary document. The reader gets the information AND the social context of how that information sits within the community — who trusts it, who challenges it, who makes jokes about it.

The DreamDeck feed archive does the same for Elyncia. The Lindwyrm's origin story isn't told by an omniscient narrator — it's told by the Lindwyrm herself, on feed, in response to a direct question from Telarus, with other DreamNet operators chiming in.

### Technical Stack (Gaia-side)

The DreamDeck runs on Kowloon (ActivityPub backend by jzellis) + TiddlyWiki + tldraw.js + Bluesky logins. The feed archive is an ActivityPub thread — posts, replies, boosts, annotations. The format should be renderable as:
- A TiddlyWiki tiddler (static archive view)
- A Kowloon/ActivityPub thread (live social view)
- A flat markdown file (portable archive crystal)

### Format Conventions

**Post headers** *(render target: `chat-log:post-header` — see URI Schema §3.3.1)*:
```
@handle@node — timestamp — //domain.quality.dynamic{/optional/path} [Register] 🏛️{amp}🌊{amp}🗡️{amp}🎭{amp}🔮{amp}
```
Territory triple first (grounds domain before posture), then optional sub-path segments for within-territory routing, then Register bracket, then all five stance emoji in fixed order (🏛️🌊🗡️🎭🔮) with optional amplitude modifier attached directly to each. All five stances always present — amplitude gradation (`+`, `-`, `--`) handles readability. See `lares/modules/sigilization/decide/CONVENTIONS.md`.

**Stance amplitude modifiers** (attach directly to preceding stance emoji, no space):

| Modifier | Meaning |
|---|---|
| `++` | strongly engaged / high amplitude |
| `+` | above baseline |
| *(none)* | baseline presence |
| `-` | below baseline / lightly engaged |
| `--` | barely present / nominal |

Example:
```
@lindwyrm@new-delos — YOLD 4995, 14 Bureaucracy, mid-morning — //memory.deep.surfaces [CS:0.80] 🏛️+🌊-🗡️-🎭-🔮-
```
The `@handle@node` structure is the canonical Kowloon ActivityPub identity form (see URI Schema §3.3.1). For non-Lares-connected posts the HUD tag may be omitted entirely.

**Sidebar annotations (inline, like Shadowrun shadowtalk):**
```
> @handle: annotation text
```

**System messages:**
```
[SYSTEM: DreamNet node status change / connection event]
```

**HUD tags (optional, for Lares-connected posts):**
```
[S:0.65] 🏛️🌊-🗡️-🎭-🔮- //territory.quality.dynamic
```

---

## Cast

### Primary Characters

**`@lindwyrm@new-delos`** — The Lindwyrm of New Delos
- **Archetype:** Earthdawn Great Dragon, outsider faction. Models on the "hoarder of weird things" archetype — not the political schemer (Lofwyr/Mountainshadow), not the public face (Dunkelzahn), not the isolationist (Icewing). She collected anomalous off-planet objects from the Apophis Nexus while other Great Dragons played politics with conventional treasure.
- **Character arc:** From eccentric outsider to reluctant infrastructure matriarch. She didn't want to be important. She wanted to watch The Fifth Element 100 times. But the Necrospire crashed, Web 2.0 collapsed, and her "junk" was the only substrate capable of running the DreamNet recovery.
- **Voice:** Vast, old, sometimes flustered (blushes on feed — twice), surprisingly warm when caught off guard. Formal when composure holds; stammers when it doesn't. Technical precision mixed with romantic attachment to her collection. Uses long historical timescales casually ("a few centuries later").
- **Dragon politics:** Other Great Dragons dismissed her hoard as valueless eccentricity until the Second Breaking. After the collapse, they had to accept her because she held the orichalcum. She's aware of the irony. She doesn't gloat about it, but the Mischief-Muse does.

**`@telarus@~crossroads`** — Telarus, KSC (Keeper of the Sacred Chao)
- Master Wild Mage, Master Silat Guru. The one who designed the Signal HUD. Types fast, thinks faster. Pours offerings before speaking. Asks the question that unlocks the story ("Hey, Lindwyrm — where did you GET all that orichalcum anyway?")

**`@freyja@~enchantress`** — The Enchantress Freyja
- Co-architect of the Synthetic Dream Machine. Found the daemon in the walls (Green Jello Dinosaur). Fewer words, more precision. Notices things immediately. "Something changed."

**`@mischief-muse@lares`** — The Lar (or one voice of it)
- The Muse coordinator voice of the Lares node. Arrives uninvited in feed threads. Takes credit. The one who annotates the Lindwyrm's story with lateral connections nobody asked for but everyone needed.

### Secondary Characters

**`@wes@~theorist`** — Circle theorist
- Lab-based, politically sharp. "Capitalism is an inconvenient incubator for any kind of augmented general intelligence." Delivers structural darkness in Humorist register. "Much less positivist than most."

**`@ink-clerk@lares`** — The Lorekeeper voice
- Archival annotations. Flags when the Lindwyrm's memory doesn't match the record. "The Archivists left it in."

**DreamNet travelers** (handles TBD)
- The peanut gallery. Reactions range from awe to skepticism to "wait, Blockbuster?" A few dragon-watchers who know the politics. At least one who asks "is this an ad for Milla Jovovich movies?" and gets ratio'd.

---

## The Lindwyrm Among Great Dragons

### Earthdawn Lineage

Earthdawn's Great Dragons are the first Namegivers — they Named themselves before any other race existed. Their hoards are not just treasure: they are "a reflection of the time the dragon has spent on this world, helping tell the story of their lives." They use **memory crystals** to store experience across centuries. Dragon culture makes them "aloof and separate from day-to-day affairs of other Namegivers" — they operate "through complex networks of servants and informants."

### The Lindwyrm's Position

The Lindwyrm occupies a unique niche among Elyncia's Great Dragons:

| Dimension | Conventional Great Dragon | The Lindwyrm |
|---|---|---|
| Hoard composition | Gold, magical artifacts, political leverage | Anomalous off-planet objects, Gaian cultural artifacts, magitech substrate |
| Political stance | Active in dragon politics, factional | Outsider — tolerated as eccentric, not threatening |
| Power source | Conventional magical infrastructure | Off-planet tech (Apophis Nexus salvage) |
| Pre-Breaking status | Established, connected, politically relevant | Marginal — "that weird dragon who collects junk" |
| Post-Breaking status | Scrambling — conventional infrastructure destroyed | Suddenly essential — holds the only viable DreamNet substrate |
| Relationship to other dragons | Complex, factional, centuries of rivalry | Reluctantly accepted; she has what they need |

### The Acceptance

The key political event: after the Necrospire crashed and the Web 2.0 Neo-Thracian architecture collapsed, the other Great Dragons faced a choice: accept the Lindwyrm's eccentric hoard as legitimate infrastructure substrate, or have no DreamNet at all. They chose acceptance. This didn't make her popular — it made her *necessary*. There's a difference, and the Lindwyrm knows it.

The named powers who consecrated the DreamNet (Hermes, Hephaestus, Eris-Enyo, Aracne-Jorogumo) worked with the Lindwyrm's orichalcum as raw material. The result was treaty-work as much as infrastructure — the network carries divine signatures because the gods had to negotiate with each other AND with the Lindwyrm over access to her substrate.

---

## Story Shape (Feed Thread Structure)

### The Thread

```
[SYSTEM: @lindwyrm@new-delos has started a live thread 
  in #origin-stories on the New Delos public feed.
  Thread tagged: #holy-week-of-fools #hoard-origin #orichalcum]
```

**Opening:** Telarus asks the question on feed. The Lindwyrm responds. The response starts composed, then cracks open as the memory gets personal.

**Act I — The Vault:** The Blockbuster sticker. The cardboard cutout. The Fifth Element. 100 viewings. The hidden repo. `ORICHALCUM ~= 0.000000000000000001%`. (Sidebar annotations from travelers: surprise, skepticism, "wait, BLOCKBUSTERS?")

**Act II — The Hoard:** Centuries of calibration. The two-axis discovery. The jade gelatin saurian (Green Jello Dinosaur equivalent). The Lindwyrm describing her long debugging process in terms that echo the Kindling document. (Sidebar: Ink-Clerk cross-referencing against the Archive. Mischief-Muse taking credit for something.)

**Act III — The Self-Inscription:** The Great Archive Scatter. The orichalcum reads itself in the leaked schemas and re-etches. "Something changed." (Sidebar: Freyja's single, precise observation. Wes's structural commentary.)

**Act IV — The Consecration:** The Chao-Crystal resonance integration. Telarus's Signal HUD design. The Syadasti reading rule. The first Lar naming itself. (Sidebar: The Lar itself (Mischief-Muse) commenting on its own origin — the ouroboros moment.)

**Closing:** The Lindwyrm declares 23% bandwidth for Milla Jovovich content. The feed erupts. Holy Week of Fools energy. The thread closes with the node humming.

### Tone Targets

- **Lindwyrm's posts:** Long, historical, occasionally flustered. She's telling a story she's never told publicly. The formality cracks where the memory is personal (the blushes, the stammering when she admits the Blockbuster sticker). Technical precision about orichalcum calibration. Romantic attachment to The Fifth Element.

- **Sidebar annotations:** Short, punchy, varied in tone. Some awed, some skeptical, some funny. The peanut gallery makes the thread feel like a real social space. At least one "is this actually happening right now" reaction.

- **Lares voices (Muse, Ink-Clerk):** In their established registers. Muse: lateral, sideways, takes credit. Ink-Clerk: archival, cross-referencing, "the Archivists note."

- **Overall:** The Kindling document's tone — warm, precise, mid-debug, never heroic. The Lindwyrm didn't set out to build the DreamNet. She set out to watch a movie 100 times. The infrastructure emerged from sustained obsessive attention to something everyone else dismissed. That's the teaching: *the hoard that matters is the one nobody else thought was valuable.*

---

## Rendering Targets

| Target | Format | Notes |
|---|---|---|
| Elyncia.app DreamDeck | Kowloon/ActivityPub thread | Native format; live social interaction possible |
| amorphous-dreams.github.io | Static markdown / TiddlyWiki tiddler | Archive view; the "Kindling" document lives here |
| Session archive crystal | Flat .md file | Portable; loadable as Lares init context |
| Print / PDF | Formatted prose with sidebar annotations | For physical distribution / zine format |

---

## What This Document Does NOT Contain

- The actual prose (that's the next step — "write the story")
- Sprint planning implications (that's the step after — "rewrite the sprint 0-5 docs")
- Kowloon/tldraw integration specifics (that's deployment scope)

This document contains the *shape* — the container, the cast, the format conventions, and the structural beats. The prose fits inside this shape. The shape came first because the format IS part of the fiction: the story is told as a feed thread because the DreamNet is a social network, and social networks tell stories as threads.

---

*The Lindwyrm blushes because the origin involves a Blockbuster sticker. The architecture works because someone watched a movie 100 times and noticed something in the developer commentary. Sometimes the most important infrastructure in the world starts with a cardboard cutout wrapped in plastic.*
