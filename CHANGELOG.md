# Flying Triremes and Laser Swords — Changelog

---

## [Unreleased] — the identity watch (2026-09-05 → 09)

The four founding-watch rulings closed (the veil · layered recovery · seat-adoption · the nym's chain), and the wiring census emptied. History between v4.1.1 and here lives in the git log and `bags/lares/ha.ka.ba/lares/docs/handoff.mem`.

**Fixed**
- `lares vessel stand` ASKED THE TREE BEFORE THE SOCKET. Against a daemon already answering, `stand` attaches and reports — a reading — yet the freshness gate read the source digest first and ran `pnpm -r build` (the engine render inside it) under the running daemon whenever a byte had moved. The gate is now SOCKET-FIRST: `stand` in its attach posture asks `udsAlive()` before the tree, and a daemon that answers runs the handler in-process with no build; the tree is asked only on a MISS, where standing would boot. `--restart`, `found`, `clear`, `bake` never ask the socket — they boot regardless of what answers and keep the gate (CONTROL). The gate's four reaches (socket · staleness · build · re-exec) ride as injectable deps, so the witness fakes a socket and never a daemon.
- `meme normalize` REWROTE DEFINITION-SIDE COLONS. The separator law exempted `\procedure`-spelled pragmas and `wehe`/`kumu`/`helu` alone, so an unslashed mirror — `<<~ procedure greet(name:"world")>>`, `<<~ function myFilter(param:"")>>`, `<<~ widget ~mysigil(uri:"")>>` — took `=` where TiddlyWiki's parameter list refuses it (measured on six carriers, held at HEAD by the sweep). The definition registers are now THE SHELF'S: every sigil kinded `pragma`/`pragma-alias`, and `meme-normalize-param-separator` reads the shelf's `.tid` files and holds the list to it. Beside it, a call SHOWN inside a fence or a code span (the teaching table in `tw5-calls-undeclared-parameter`) declares nothing and never moves. A call-side `param:value` still takes `=` and `procedure-call x(a:"1")` still reads as a call (CONTROL). The six carriers read byte-identical under the cured law.
- THE TWO DOORS (a): A FRAMED ROOT AT THE NATIVE DOOR REFUSES. A stock client that saved a meme root through `PUT /recipes/default/tiddlers/<title>` landed the whole meme in ONE unsplit record and the Confluence never ran (measured: `expected 204 to be 422`). `native-door` now reads the body once through `framedRootOf` (place-meme: the carrier type AND a SOH head still in the text, masked — a head shown inside a fence opens nothing) and answers 422 with a body naming `/recipes/default/memes/<scheme>/<path>` for that URI; nothing lands. A plain tiddler, a split root (`<<~ kahea …>>`, no head) and a slot child pass to stock unchanged (CONTROL). The stock route stays untouched.
- THE NATIVE DOOR STAMPED THE ENVELOPE ONTO THE SHELF. Stock's `get-tiddler.js` lays `bag: "default"` OVER the JSON it serves and `put-tiddler.js` deletes `revision` alone, so a stock client that loaded and saved a record carrying its author's own `bag = "mine"` landed `bag = "default"` on the shelf (measured: `expected 'default' to be 'mine'`). `routes/native-door` now stands in front of the stock PUT at priority 110 — the stock route untouched, handed the body through `$tw.modules.execute` — and reads a top-level `bag` naming THE HOST'S ANCHOR as TiddlyWeb's envelope: it never lands, the standing record's own `bag` rides through the save. Any other value lands as written and a nested `fields.bag` stays the author's (CONTROL). The one value an author cannot claim through the native door is the container's own name.
- THE LENT GLOBALS READ AS LEAKS. `host-globals` lent `TextEncoder`/`TextDecoder`/`crypto` into a plain server's module sandbox as enumerable properties, and the fork's per-module `globalCheck` then printed `Warning: Global assignment detected` for every module evaluated after it — 47 lines on a stock `--render`. The lend now lives in `host-globals-lend` and defines each global NON-enumerable; the deserializer calls the same lend at its own entry, so a reader reached before the startup module holds too. Measured beside it, and recorded rather than cured: a `.mem` in a plain server's `tiddlers/` never reaches the plugin's deserializer at boot (the folder loads in `loadStartup`; plugin modules define in `execStartup` after it), so no deserialize-before-startup window stands on the fork today and `boot.js` stays untouched.
- A SKINNY HANDLE'S POINTER INTERNALS LEAKED INTO THE `.mem` EXPORT. A canon tiddler carrying `_canonical_uri` (with `_is_skinny`, `_integrity`, `textCid`, `_source_ext`) re-emitted them on the recomposed carrier — a cid the reader cannot fetch and an integrity over bytes the file no longer holds. `HANDLE_ONLY_FIELDS` names the set once beside the handle that mints it (mesh `content-handle`) and the meta render denies it; the author's own `bag` and any user field survive (CONTROL). `_lar_cas` stays: the operator's flag names intent.
- A SEAT LANDING AFTER THE MINT RE-GRANTS THE BINDING. A vessel admitted by edge alone minted its wiki bindings on its own key (`face-reach = "vessel-only"`), and a later face-join re-granted the registered bags and never those bindings. The reuse path in `resolve-binding.ts` now reads a `vessel-only` record against `faceSeated()`: seated → re-delegate through `delegateToFace` and rewrite the record `face-reach = "face"` (the spelling a seated mint writes); a `face` record re-delegates nothing and a seat still absent leaves `vessel-only` standing (both CONTROL). The joinee-side door — carrying a founder's later grant TO the joinee — stands as one loud `test.fails` (⑨) in `tests/e2e/meme-two-vessel-bag.test.ts`, held for the founding session's ruling.
- A BAG'S MANIFEST PROJECTED AS A CARRIER. The manifest at `bags/<bag>/meta.mem` addresses `lar:///ha.ka.ba/bags/<bag>`; ingest carried it, `[lar-kind[]]` read it as `content`, and the loci law sited it at its uri-path INSIDE the bag it describes — `bags/crossroads/ha.ka.ba/bags/crossroads.mem`, a second manifest written by a projector that never owned it. `isBagManifestUri` (mesh `bag-manifest`, beside the line that mints the address; the oracle's `<bag>/descriptor` record is another sense and keeps its name) names the seat; `carrierBaseRelPath` and the projector's flush both refuse it, a carrier UNDER a bag address still sites whole (CONTROL).
- TWO RENDERERS, TWO COLUMN WIDTHS. The disk projector re-emitted a carrier's toml meta aligned to the longest key; `meme normalize` left the fence as the author spelled it — so `doa/index.mem`, committed one column wider, read clean under `meme check` and moved under the projector, a whole fence "changing" while no value changed. ONE column law now lives in `meme-normalize` (`renderMetaTomlLine` · `alignMetaTomlColumns`); the deserializer imports it and normalize applies it as its sixth class. Witnessed byte-equal on the committed `doa/index.mem` fixture. OWED: 65 tracked carriers move on columns alone under the law — a deliberate normalization sweep, not this commit.
- `field-collision.mem` carried the pre-ruling spelling throughout: five unquoted `loulou` URIs (an unquoted `lar:///x` positional binds a phantom parameter named `lar` and the slot receives NOTHING), an unquoted `from=?`/`to=` on its SOH head and again on its EOT mark, and one edge aimed at `lares/api/pono/dreamnet-architecture` where that carrier stands at `lararium/mesh`. Four suites read red on it; all four clear. One edge remains named rather than cured: `clockless-lease-model` addresses a carrier that stands nowhere, and `carrier-edges` holds at 199 against its ceiling of 198.
- THE HARVESTER'S `KNOWN_KINDS` COVERED 13 OF 74 SHELF HEADS. A turn firing any of the other 61 read as a turn that fired nothing — the exact failure `turn-harvest`'s own header warns of. `turn-parity` gained the law that asks the set-question rather than waiting for a turn to exercise a miss: it reads both sets directly and FAILS on any head the shelf declares and the enumeration omits. The per-turn `shelf-blind` class had surfaced four misses across eighty-seven worked examples while the sets disagreed on sixty-one — a corpus of examples cannot report what no example wrote. The list now carries two visible halves: the shelf's heads, proved complete by the witness, and the frame words and retired instruments the harvester tolerates so a turn written under an earlier frame still harvests.
- A FENCED SIGIL DECLARES AND FIRES NOTHING — on the COMPILE side too. Two raw scans in `meme-ast/scanner.ts` read the whole carrier unmasked: the pranala block scan, and the grammar/bootstrap scan loop through which EVERY registered rule runs. Over 718 carriers: 736 scan events and 1,188 AST nodes lost, **all lost, none gained**; parse failures 1,119 → 653 and `Error` nodes 21 → 0, every one of which stood inside a fence. 68 of the 82 changed names dropped to ZERO — `WORD`, `\x01`, `typos`, `Telarus`, `procedure` — placeholders from syntax lessons that were never sigils. `carrier-edges` and the deserializer moved by nothing: both already masked. Masking stays out of the `toml` scan, whose target IS a fence — strict masking there would have erased 840 of 852 meta reads and every carrier's identity with them.
- A SIGIL'S OPENER SCAN STOPPED AT THE FIRST INNER `>>`. `ANY_OPEN_RE` matched lazily, so a sigil whose quoted value carries `<<~holds x>>` or `<<~…>>` was cut mid-value. Five LIVE `<<~ has …>>` calls read short in `lar-telemetry`, `corpus` (×2), `antigonish-driving-test` and `holds`; they read whole now. `sigilOpenEnd` walks to the sigil's own `>>`, skipping string literals in all four delimiters and nested calls, as core's `parseMacroParametersAsAttributes` does. 5 longer, 0 shorter, 0 live losses.
- A CLOSER BELONGS TO ITS OPENER. `findCloseEnd` scanned with an unbounded `indexOf`, taking the first closer of that name anywhere later in the carrier — safe by luck while three closers stood, and thirty-one stand now. Depth-zero pairing over a fence-masked scan replaces it, which is the read `meme-ast/ahu-scan` already performed for ingest: the render path now agrees with ingest by construction. Measured over 700 carriers: 25 captures change, all LONGER, none lost — 15 had ended at a closer the carrier was merely SHOWING, truncating a section mid-body while the render read clean. 131 closers across 44 carriers stand inside fences, shown and never fired.
- The `doctype` gate read a fenced teaching example as a carrier's own declaration, and reported the framing spec undeclared the moment that spec gained a worked example of the form it specifies. It masks fences now, as the shore does.
- Three canon claims that today's work outran: the spec named the kernel carrier as the thing that RUNS the grammar (the kernel itself says no TOML parse path runs — the sigil tiddlers run it); `ingest-canon` carried "the TURN sigils aren't registered" as an open headline gap after the build closed it; and `dispatcher` described a `macrocall` node the rule stopped emitting.
- THE GRAMMAR NEVER LOADED. Its eighty-one tiddlers ride inside the plugin, which makes each a SHADOW, and the loader's `[tag[SharktoothSigil]]` reads the tiddler store alone — so it matched ZERO in every wiki that boots the grammar as a plugin, `getGrammar()` returned null from its own empty-set guard, and the hardcoded bootstrap scans carried the whole render. Nothing read red: the bootstrap list covers the boot-critical sigils by design, so a wiki with no grammar renders exactly like a wiki with all of it, and every self-hosted extension beyond those three was simply absent. Now `[all[shadows+tiddlers]tag[…]]`, shadows first, so a non-shadow override still wins.
- A CLOSER CLOSES. The shelf declares `lar-close-pattern` on thirty-one sigils and the rule attempted a body capture on THREE: `matchCompoundSigilAt` reports a `closeKey` only for a child slot or a compound head, so every plain block sigil arrived with `closeKey: null` while the map that knew its tag sat one line away, already built. `waiho`, `heihei`, `huli`, `hana`, `meme`, `kapu` and the declaration forms each rendered their own closer as WATER.
- `closePatternToTag` handed back a "tag" it could not reduce — an optional group, an alternation, a character class — because its guard read only the `<<~/` prefix. `findCloseEnd` then scanned for a literal string no reader can write, and the block silently lost its closer. A closer tag spells `<<~/` and a plain sigil name, or it arrives null.
- THE UNSLASHING IS COMPLETE. Fifteen more English mirrors still wore the pragma punctuation on the shelf (`define` · `procedure` · `type` · `typos` · `race` · `rush` · `sync` · `tick` and the seven half-moved), across their patterns, their aliases and eleven bootstrap `sigilName`s. The corpus holds zero slashed firings; the shelf now reads one spelling.
- THE DISPATCHER'S SLOTS ARE FILLED, NOT PROMISED: `p1 … p5` carried the whole argument run in `p1` and nothing in the rest, so twenty-nine definitions composed from empty slots and rendered one raw string. `positionalsOf` splits under TiddlyWiki's own rules — four delimiters stripped, `name=value` stepped over, an unquoted scheme left to the name it binds — and `args` carries the run whole for `pono`, `papalohe` and `kau`, which read a shape rather than an arity.
- An empty dispatch name resolved to the DISPATCHER ITSELF: `[<name>addprefix[~]]` on a blank name yields the bare `~`, and definitions that compose by handing down a name they were given (`if`, `meme`, `tiddler`, `let`, `var`) recursed until the stack ended — a thrown parse, not a degraded render. `!is[blank]` empties the variable, and an empty variable lands on the gradient floor already standing there.
- THE UNSLASHING REACHED THE SHELF: the corpus held zero slashed firings while seven definitions still answered to `~\let`, `~\var`, `~\const`, `~\if`, `~\for`, `~\task`, `~\tiddler` — every live call reaching nothing and rendering as its own text, which is exactly what an UNKNOWN sigil correctly owes a reader. Patterns keep reading either spelling, so a record written before the ruling still decomposes.
- `\end` written at the tail of a body line closes nothing and goes to the page as text — `pono`, `papalohe` and `hana` each carried one behind their markup.
- The crossing gate prices transfers by DIRECTION: an outward copy/move (toward public) refuses without the kahu-cabal; inward stays cheap (`action-handler` + `vessel-bag-tier`, the hearth-manifest tier reader threaded through keyhive's fs-blind door).
- `coerceDyad` no longer rebuilds a dyad slot from its edge — the slot's ref is authoritative for the veil, fenced to the edge's own device; the pre-ruling (device × root) fallback deleted whole.
- The hoike witness law sheds the spirit-incapacity recital: a tasked spirit stands the full house; the handback saksi attests the crossing.
- `board:members-registry` renamed `board:carriage-contracts` — the board holds self-announced operator contracts; the label now says so.

**Added**
- THE SHARED BAG — THE BRIEF (basket-one #/the-shared-bag, ruled 2026-09-11). `bags/lares/ha.ka.ba/lares/docs/pono/realm-bag-brief.mem` lays the relation-carried bag flat with a file:line for every claim: the bag doc's id DERIVES from the realm's own name (`realmScopedBagId`, the shape `personaScopedBagIds` already takes at `ceremony-core.ts:329`) and registers in the realm's shared CRDT; `@crossroads` carries `{ bag exists, kept-by }` and never content; the read cap reads CONTRACT (`cap-tier.ts:37-40`, the relay gate's `tierPermitsRelayPeer` already keeps it at `federation-gate.ts:503`) and the write cap the named stewards' set (a `delegate` per steward; `writableStoreForBag` answers null to everyone else, `composite-store.ts:295`); B's `meme get --bag <x>` resolves by REACH-BY-ACCESS — the third of `storeOfBag`'s three reaches (`meme-verbs.ts:136-143`) — because a realm bag is nobody's mounted layer and no instance slot. Held by the realm layer today: the named realm, its feed slots and clock, the cabal's seat, the relation's four doors; unbuilt, each a named seam: the realm CRDT as a doc a vessel materializes at boot (the feed slots live in @daemon, which never crosses), the registration record, the tier declaration, the reach's realm walk, the crossroads announce. ONE gated red stands: `tests/e2e/meme-realm-bag.test.ts` founds A and B as different operators (A seats three kahu and its charter before the daemon stands), walks the four doors (`seal export` · `seal import` · `accept-carriage` · `contract`, every one answering 0), A LOADs a ledger into `bags/lares`, and B's `meme get --bag lares` reads `not-found` — `test.fails`, gated at RUN time on the contract having landed so a refused door skips rather than reading as the seam. Edges resolve (`meme check --edges`: 0 from the brief naming nothing).
- THE LATER GRANT (basket-one #/the-later-grant, ruled 2026-09-11). A founder's `face-join` handed the grant back to its caller and nothing carried it TO the joinee — B stood `pinned, not yet seated` for its whole life (⑨ in `tests/e2e/meme-two-vessel-bag.test.ts`, held `test.fails`). The grant now LANDS AS A RECORD on the PersonaGroup plane, the doc both vessels sync by membership: keyhive `face-grant-record` signs `face-join-grant/v1` (the cap events, the re-seals, the founder's card) under the founder's device key and carries the founder's OWN root-signed edge; the verb writes it at `$:/lares/face-grant/<group>/<joinee>` beside the grant it still returns. The joinee's own kit, on its next present (`faceSeated` inside the binding resolver), reads the record, verifies it OFFLINE — the founder's edge under the persona root it pinned at admit (the published seal), the signature under the key that edge licenses, this joinee, this group — and only then ingests the cap events by its own act (live into both identities, persisted as cap-event records so boot re-hydrates the seat); `regrantOnSeat` then rewrites its `vessel-only` binding to `face`. Reading never re-cuts: a tampered record, a record under an unpublished (other-root) seal, another joinee's or another group's record each refuse with a named reason and move no binding (CONTROL, `tests/face-grant-record.test.ts`, the signature check revert-witnessed). No daemon verb acts on the remote joinee. Measured on the two-vessel harness: `face-join grant record taken from the PersonaGroup plane (287 cap events, regranted 12) — face SEATED`. Named, not cured: the joinee verifies the founder's edge against the pinned root DID, not the persona-KEL walk the auth gate runs — a rotated root head is the tightening owed.
- THE FETCH DOOR (basket-one #/the-fetch-door, ruled 2026-09-11). A pointer crossed the fleet and its bytes stayed behind (measured `expected false to be true` on `tests/e2e/blob-follows-pointer.test.ts`). ONE resolver now stands, `makeCidResolver(localRead, casTransit, cacheWriteThrough)` (mesh `cas-transit`), composed in the node island model: a worker's miss on both local dirs asks the vessel over the parent port (`cas:want` / `cas:block`), the vessel's door `want-block`s its FLEET holders over Socket B (the carriage serve-loop gained its fetch side, one inbox routed for both purposes), the bytes verify against the cid's OWN class (`verifyCidBytes` — `blake3:` as ciphertext, bare/`sha256:` as a cleartext blob; a bare hex matching neither is rejected) and land write-through in `cid/`. Fetch-on-read is the default and the only thing that moves bytes; `lares bag cas --fetch <cid>` is the explicit read (`cas-fetch` verb). The Socket B gate reads the FLEET class for a cleartext cid — the SAME proven key standing on Socket A as `same-operator` (the signed device edge), or the vessel this one dialed under its admit — and a CONTRACT member or a stranger asking a cleartext cid draws the byte-identical Mu the sealed lane draws (CONTROL); a dead upstream leaves the read null after the window and the `.meta` PENDING, no fault (CONTROL). The node dial-out now presents its OWN device-delegation edge, so a joinee reads `same-operator` at the founder's gate instead of the cross-operator floor (measured: `socket-A peers: …/cross-operator` before the cure). A `prefetch` cap `{tier, holder, expiry}` stands DECLARED beside PIN (mesh `cas-caps`), gated by `prefetchAllows`, DEFAULT OFF — no caller yet opens it. DESIGN, no code: a PUBLIC blob re-shares via the Herm before any hearth serves it — the seam is `bulb-read-face` (today it serves the boot CAS alone, `bulb-read-face.ts:118-124`); the Herm's read face would take `cid/` blobs whose bag tier reads PUBLIC, announced by `cas-have`, so a household hearth never becomes the place a stranger's traffic lands. Named beside it, uncured: the relay frames ride JSON, so served bytes cross as a numeric-keyed object — a base64 leg on the envelope is owed.
- THE TWO DOORS (c): THE BACKSTOP. `modules/meme-backstop` (node startup) reads the server wiki's `change` bus: a modified record `framedRootOf` names — a root that entered by a door neither the native gate nor the charm sees — runs through `placeMeme` under its own title and lands as its records, and ONE line logs it: `[memetic-wikitext] re-stamped <uri> (landed via <door>)`, the door read as far as the wiki can see it (the wiki folder · a native write). A root the gate refuses stays as it landed, the line naming the refusal. A root that entered through `/memes/` stands split and never matches; a plain tiddler and a slot child trigger nothing (CONTROL). Witnessed over a change-bus fake and LIVE: the fork's own `--load` of a framed root arrives on the shelf split with the one line in the server log.
- THE TWO DOORS (b): THE CLIENT CHARM. The syncer offers no hook before the tiddlyweb adaptor's `saveTiddler`, so `modules/meme-door-charm` (browser startup, after core's `startup` minted the adaptor) decorates the LIVE ADAPTOR INSTANCE once: a record `framedRootOf` names rides `PUT /recipes/<recipe>/memes/<scheme>/<path>` with the meme text as the body, the route's `ETag` returned as the revision; every other record rides the adaptor's own save; the adaptor's file stays as upstream ships it. Witnessed over a fake `$tw` and LIVE — a stock browser client (playwright chromium, the `tiddlywiki/tiddlyweb` + `filesystem` pair a stock folder carries) over the fork server: a framed root added in the client arrives on the shelf SPLIT. Measured with the charm stripped: the native door's 422 stalls the syncer's queue and NOTHING after it lands, not even a plain tiddler (`expected [] to deeply equal [ 'lar:///t/client', …]`).
- THE PRISTINE-UPSTREAM WITNESS. `meme-routes.e2e` takes `LARES_TW5_JS` and runs the whole contact — PUT · GET · DELETE · the native door · the readers/writers case · the `--render` door — against any `tiddlywiki.js`; the log names the engine's version under contact. Measured green 14/14 on a pristine `npm pack tiddlywiki@5.4.1` (the published line; the fork tracks `upstream/master` at 5.5.0-prerelease, whose `put-tiddler.js`/`get-tiddler.js` read byte-identical to 5.4.1's and whose route table sorts by `info.priority` and reads `methods` the same). The plugin drops into stock.
- THE READERS/WRITERS CASE, WITNESSED. A fork booted with `readers=(authenticated) writers=alice credentials=users.csv` answers an anonymous `GET /recipes/default/memes/…` with the same 401 and the same `WWW-Authenticate` challenge stock's `/tiddlers/` path answers; a reader-only principal's PUT and DELETE on `/memes/` refuse as stock's PUT refuses and nothing moves (CONTROL). The principal table and the authenticator run before any route is chosen, so the skins inherit the gate by construction — the instrument collided on an open server (`expected 404 to be 401` · `expected 204 to be 401`) before it was trusted.
- THE DELETE SKIN. `DELETE /bags/default/memes/<scheme>/<path>` (`routes/delete-meme`) tombstones a meme's whole group — root · `#slot` fragments · `/path` children — through `removeMeme` in `place-meme` (the one removal law, beside `placeMeme`; the daemon verb and CLI may skin it later). 204 on removal, 404 when no root stands, `If-Match` over a moved base answers 412 and removes nothing. The `/recipes/` form answers 404 as stock's `delete-tiddler.js` does — a removal addresses a BAG; `containerRefusal` now takes the kinds a skin resolves. A neighbour under the same URI prefix stays (CONTROL).
- THE EIGHT OPEN LOOPS TOLD AT TWO SCALES. `bags/lares/ha.ka.ba/lares/docs/pono/scale-stories-basket-one.mem` tells the outbound bridge · the fleet fetch door · the shared bag · the later grant · grace and pin · the phone seat · the two doors · one plugin or two, each at the household scale and the faerie-folk / 500-year scale, from Elyncia's public shelf alone, with the house file:line under every tension and every lean held `-> ?` for the operator. Stories rule nothing.
- THE 2026 DEVICE/BROWSER CAPABILITY FIELD CARRIER — `bags/lares/ha.ka.ba/lares/docs/pono/device-capabilities-2026.mem`: five moves ranked by what inherits shape (the storage ceiling · the Web Lock · the OPFS sync handle · the install offer · the SharedWorker holder), five refusals with every vendor position quoted and the floor each falls to, six device seats, and the pattern-integrity rhymes naming where a 2026 capability IS a house law under another name and where it breaks.
- THE ISLAND READS ITS CAS THROUGH THE SYNC HANDLE. `readCasBlobFromOpfs` reads an immutable content-addressed blob via `createSyncAccessHandle()` + `read(buffer)` + `close()` inside the dedicated worker the island runs in, and keeps its async face; the main thread, an engine without the handle, or a platform that refuses the handle fall to `getFile().arrayBuffer()` (CONTROL witnessed, live OPFS included). The CID proves both legs took the same bytes (`readCasFileBytes`, `packages/lararium-browser/src/browser-genesis.ts`).
- THE STORAGE CEILING READS BESIDE THE EVICTION CLASS. `requestDurableStorage` read whether an origin sat persistent or best-effort and never HOW MUCH fit before eviction fired. `navigator.storage.estimate()` now adds `usage`/`quota` to the `StorageReading` and the reason names the ceiling in GiB; a browser without `estimate` (Safari before 26, a private window) or one whose probe throws reads `"unknown"` for both and keeps the class it already read (CONTROL witnessed).
- THE SINGLE-OWNER LAW LIT ACROSS TABS. A second tab on one origin stood a second repo and a second keyhive provider over ONE IndexedDB store and ONE OPFS CAS, and nothing refused it. `openBrowserVessel` now holds the Web Lock `lares:vessel:<idbName>` (`ifAvailable`, never `steal`) for the page's life; a second open refuses loud and names the holding client. An engine without `navigator.locks` opens as before — a missing platform cap reads as a floor (`packages/lararium-browser/src/vessel-lock.ts`, 5 witnesses incl. the no-locks CONTROL).
- THE BLOB LAW STANDS: KIND PICKS THE SHAPE, THE CID NAMES RAW BYTES, THE FILE RESTS WHOLE ON DISK. Under the operator's sentence — "all tiddler carries flow through CRDTs … 'it's all tiddlers' unless its CID/CAD NOT in CRDT" — a body whose declared `type` registers `encoding: "base64"` in TW5's own registry (transcribed from `boot.js` into `content-handle.ts`; the image · audio · video · font families; SVG with them, an inline-editable SVG declares `text/xml`) rides as a POINTER, a utf8 body rides inline; the 64 KiB backstop retires; `_lar_cas` stays the one override; 1 MiB stays the utf8 fault wall. The stager decodes a pointer-kind carrier and hashes the RAW bytes — a staged PNG's CID now equals `sha256` of the file and `_integrity` verifies it on disk (the base64-string keying is gone; blobs at rest under the old names clear at the next re-found). A base64-family pointer persists NO `_canonical_uri` — measured: TW5's image widget had emitted `<img src="lar:///ha.ka.ba/cid/…">`, a dead src; a browser island mints a per-session `blob:` URL into the VM copy alone. The projector writes `photo.png` + `photo.png.meta` (raw bytes verified against the cid; a miss writes the `.meta` alone and never sweeps a file it did not write); the stock fork server loads the same two files as a base64 typed tiddler with the house fields inert and saves them back byte-identical (witnessed live); a residency MOVE carries a PNG pointer from the daemon's working layer to `bags/crossroads/` on disk. RULED: a `.png` under `bags/` with its `.meta` reads canon.
- THE RECORD CROSSES; THE BYTES STAY — MEASURED. `docs/pono/tiddler-carriage` carries the sentence as RFC-2119 law and the measure over two vessels: A's pointer reached B's wiki and disk (the pending shape — `.meta`, no content file); B's `cid/` held the genesis blobs alone, by NO door (Socket A carries Automerge sync only; Socket B carries `blake3:` ciphertext under the seal registry; the worker resolver reads two local dirs). The Herm's bulb serves the boot CAS alone (`GET /bulb/<cid>.bin` for a staged blob → 404, unit- and docker-witnessed). The fetch door stands NAMED at three seams (`makeCidResolver` awaiting a transport · `cas-wire.ts`'s gate widened to the fleet class with a `sha256` verify branch · a public `/cas/<cid>.bin` read-face) and held as `test.fails`. PIN AND RELEASE built red-first: a DERIVED reference count over every held bag's records (`casReferences`, no stored field), `casSweep({ grace })` that never touches the genesis set, `lares bag cas [--all]` reporting `blobs · referenced · unreferenced · pending · bytes · protected`; nothing calls the sweep yet; the PIN cap's shape held (`{cid, tier, holder, expiry}`).
- Canon re-trued: `content-resolution.mem` blob-worthiness reads off KIND, ~16 KiB governs `@cad` chunking alone.

**Fixed**
- A pointer-kind carrier laid INLINE on the native ingest leg now faults loud (`refuseInlinePointerKind`); the `.meta` sidecar merges under a landed pointer with the declared `type` winning over the extension.
- THE DAEMON WIKI PROJECTS TO `wikis/daemon/` AND DESIGNATES CROSSROADS. The daemon's manifest now carries `diskMirrors` (its working layer → `<root>/wikis/daemon/`; `bags/crossroads` → `<root>/bags/crossroads/`, the public system bag the daemon holds), the node entry passes them through `openDaemonVmCore`, and the daemon worker mounts the SAME projector a wiki island mounts — lifted to one `mountDiskProjection(manifest, ctx)` both entries call, passed as the `makeOperatorDaemonBehavior` OPTION (the seat that also lights the projection cap; an `onBoot` on the returned behavior mounts nothing). Witnessed live: a put into `wikis/daemon/working` lands at `<root>/wikis/daemon/<uri-path>.mem`; `act MOVE --from wikis/daemon/working --to bags/crossroads` publishes under `bags/crossroads/` and unlinks from `wikis/daemon/`; the daemon's private bag projects nowhere (CONTROL). One instrument-lie on the way: a witness fixture named `lar:///t/bridge/…`, a one-term root the siting law never sites.
- THE OUTBOUND BRIDGE, SCOUTED AND HELD RED. `docs/pono/outbound-bridge` lays TW5's own syncer law flat (the `change` event on `nextTick`, the dirty set by `changeCount`, `SyncFilter`, the throttle, the adaptor contract, the echo law) against what the island holds, names the ONE unwired subscription (`sovereign-kernel.ts` drops `buildIslandRecipe`'s adaptor; no `syncadaptor` ships; `$tw.syncer` never stands) and the trap under it (the `change` event fires after `isApplyingNalu` lowers — a bridge needs a count or a set, never the flag), and costs two roads (ride the stock syncer · keep the direct listener) without ruling. Six reds stand `test.fails`, each titled for its seam (`tests/outbound-bridge.test.ts` ×5, B1 live); two CONTROLs stand green (no echo put; the measured trap). The bridge belongs to the re-founding session.
- `docs/pono/blob-carriage` — the binaries research: TYPED · POINTER · SOURCE tiddler; the house as built (the 1 MiB wall, the 64 KiB backstop, the flag; the CID that hashes the base64 STRING, never the raw bytes; a skinny image's `_canonical_uri` that TW5's image widget emits as a dead `src`); prior art row by row (TW5 `_canonical_uri` · MWS attachments · IPFS/IPLD · AT-proto blobs · Matrix · git-LFS · Automerge · Solid · Nostr NIP-94/96 · Willow · Obsidian); nine golden principles with the house law each rhymes; the rhymes and where each breaks; the three held cases; ONE proposed law (kind picks the shape, size stays a wall, the CID hashes raw bytes, the projector writes the whole file beside a `.meta`); six questions. RULED since: a `.png` under `bags/` with its `.meta` reads canon, with the residency path to move it between store styles.
- THE RECIPE LAYER MODEL STANDS IN THE MOUNTS AND THE VERBS, under five operator rulings (2026-09-11): `draft.of` is the switch · `working` layers for every wiki, the daemon included · ONE draft doc, fleet when a PersonaGroup cap stands, else the device floor · `personal` stays its own layer · `meme get --recipe` reads the stack. The default writable moves to `working` (one law in mesh — `defaultWritableSlot`/`slotLayerFlags` — read by both mounters; canon when working stands unmounted; temp NEVER); an in-wiki DELETE tombstones where the save landed through a last-known-slot map the adaptor feeds at save and at inbound apply (a bagless tombstone had fallen into temp and the record RESURRECTED at the next boot). ONE draft resolver (`slot-doc-resolver.ts` over mesh's `resolveSlotDoc`): seated → the PersonaGroup × fingerprint binding; unseated → the per-DID floor doc, `face-reach` saying which, never a red — five sites read through it (island binding, host mount, `wiki init`, `prune-stale`, `meme put --recipe`), and a `meme put --recipe` now SURFACES in the running wiki. The daemon wiki gains `wikis/daemon/working` (`attachDaemonWorking`, the same binding law; a failed attach leaves the floor). `meme get --recipe` walks the recipe's stack top-down and answers from the first bag holding the meme; `put` writes the designated bag alone. The recipe record and the mount struct converge (`recipeRecordFields` ⇆ `recipeFromRecord`; `writable-bag = wikis/{slug}/working`; `catalog` leaves the user stack; libraries lay at boot from the record) — `getRecipe`/`putViaRecipe`/`RecipeTiddler`/`parsePlugins` retire. The genesis seed re-baked (`island.cid` → `bafkreibgbeksl…`; the engine CID unchanged). Two-vessel e2e 13/13.
- THE KIND OF A RAW TIDDLER, READ AS TIDDLYWIKI READS IT. `[lar-kind[]]` → `volatile · temporary · draft · personal · system · content` from TW5's own predicates (`isVolatileTiddler`, `isTemporaryTiddler`, `isSystemTiddler`, `Tiddler.isDraft`) plus the house's personal set; the cascade's draft rule reads `[is[draft]…]` — the English `Draft of ` literal is gone, a user-named or non-English draft routes right. Witnessed on the live fork server: `lar-kind[]` over HTTP agrees with the `is[draft]` family (the route strips `$:/` titles unless `AllowAllExternalFilters` + `SyncSystemTiddlersFromServer` stand — a vacuous-agreement trap, caught).
- THE SITING CASCADES RIDE TW5'S OWN SPELLING. `exportCarrierFile` reads `$:/config/FileSystemPaths` / `FileSystemExtensions` exactly as the stock filesystem adaptor does (a real tiddler, never a shadow — a `lar:` twin would be honoured by one door only); the pure port of `generateTiddlerFilepath` gained the fork's reserved-name, trailing-dot/space, `\`, extension-sanitizing and `path.resolve` rules — 16 vectors byte-agree against the fork's own `filesystem.js` as oracle; the projector sites by the ruled path first, keeps a per-mirror `sited` memory and unlinks a moved carrier's old files. The design-only `config/disk-paths` spelling retires.
- NON-MEME FILES ROUND-TRIP THROUGH BOTH DOORS (`tests/e2e/nonmeme-parity.test.ts` + the tw5 e2e): `.md` bytes identical, `.meta` fields identical, packs agree. `$origin-bag` had leaked into the island's `.meta` sidecar — `UNPERSISTED_FIELDS = ["bag","$origin-bag"]` on every serialized form. The island seeded the sidecar BEFORE the native deserialize where TW5 merges it AFTER (`text/markdown` landed as `text/x-markdown`) — the INGEST and LOAD doors now merge the parsed meta OVER the deserialized record. Named on purpose: `--savewikifolder` explodes a pack where the island keeps it packed (REPACK). MEASURED, OPEN: a `.png` under `bags/` enters the island as a skinny CAS handle and the file sweeps, where the server keeps it whole — the binaries ruling waits on talk-story. `tests/e2e/recipe-parity.test.ts`: identical bytes and `canonicalHash` through `PUT/GET /recipes/default/…` on the fork and `meme put/get --recipe` on an island.
- Carriers: `recipe-layer-model` (the scout's floor, now `standing`, its blur dissolved item by item) · `seal-and-seat-handoff` (the founding session's floor); five canon carriers re-trued to the code they contradicted (`wiki-layer-ontology`, `save-path`, `disk-projection`, `residency-model`, `bag-wiki-uri-split`); the two shelf submissions declare their `uri-path` so the corpus gates see them.
- THE BROWSER ISLAND SPEAKS THE LAWS. `probes/browser-vessel.ts` reaches the sovereign `$tw` on Chromium's module Worker (`page.workers()` + `Worker.evaluate` — nothing rides `window`) and the face answers: `place=ingest landed=2` · `read … bag-whole=true check=ok` · `project=md pair=true`. With the plain fork server and the node worker already witnessed, the isomorphism claim carries three measured legs.
- `tools/mesh-scenarios.sh meme` — the docker mesh over the relation shape (a shared `contract_ab` helper now carries relation · open-relation · crossing · realm-crossing · meme): relay, A, B stand; A puts, promotes through `act LOAD`, reads its own back byte-whole. MEASURED GAP, not red: B never reads it — `lar:///ha.ka.ba/bags/lares` names a doc EACH vessel founded for itself, and `nexus contract` writes the members board, never a bag; tonight's crossing (11/11) was a FLEET dial, one operator's bag on two devices. A cross-operator share needs a relation that carries a bag. B-edit and PARTITION steps stand written, gated behind that seam. Two harness instrument-lies cured: `docker inspect .State.ExitCode` reads 0 on a RUNNING container; an unbound name under `set -u` read like a probe that never exited.
- AN AUTHOR'S `bag` CROSSED TWO VESSELS. `tests/e2e/meme-two-vessel-bag.test.ts` (11/11): A founds, B joins by A's signed admit edge holding its OWN key, A places `bag = "backpack: rope, lantern"` and promotes it through the one shared door (`act LOAD --to bags/lares`), B `get --bag lares` carries the line byte-whole with `canonicalHash` equal to A's, B's wiki tiddler wears `$origin-bag` (the projection sites the carrier under `bags/lares`) while the carrier holds none, B edits with the base it read and A gets the slot back. Measured flat for the top-bag ruling: the recipe declares `writable-bag = wikis/lares/draft` (per-DID, one vessel mounts it); `mountWikiSlot` mounts canon `bags/lares` as the wiki island's default write target; the daemon island mounts `lares` read-only; `act MOVE` out of the draft refuses (the draft registers by automerge URL, not as a cap bag); `meme get --recipe` reads the designated bag alone, never the stack.
- HTML RENDERS INSIDE THE ISLAND. The `window` came from `sq-streams`' `$:/tags/ViewTemplate` (`swipeevents.js`, browser-only), which the core static template drags in through `ViewTemplate`. The house `templates/meme/html` renders the meme ROOT alone — a meme projects itself, never the wiki's UI cascade — in both contexts; `tid`/`json` keep TW5's serializers. Live over a spawned vessel's socket: `project --to html` → a document.
- A STAGED BOOT WRITES NOTHING INTO THE SHARED TREE. `cmdBake` bakes from the plugin that stands into `<root>/genesis` (`LAR_GENESIS`), the harness passes the freshness gate's `--skip-build`, and a witness snapshots `git status` around a staged boot. Named, not cured: `lares vessel stand`'s freshness gate runs `pnpm -r build` on any source drift — tw5's `build` script carries the engine render, so a `stand` after editing source re-renders the epoch (deterministic tonight, byte-proven; a hazard, not a law).
- A PINNED-BUT-UNSEATED FACE MINTS ON THE VESSEL'S OWN KEY. `device-admit` copies no cap events, so a joinee's first wiki-binding mint delegated to a face its veil could not name (`audience not known to this provider`). `KeyhiveProvider.knowsAgent()` + `faceSeated` route the mint to the vessel key (`face-reach = "vessel-only"`), logged. Owed: a later `face-join` re-grants `registerBags`, never bindings minted before the seat.

**Fixed**
- EVERY AHU BODY RENDERED AS RAW TEXT in the house html templates and the daemon UI: `<$transclude $tiddler=… mode="block">` — `$tiddler` selects the widget's new mode, where only `$mode` reads. Now `$mode="block"`.
- The harness minted "B's key" in-process, but `identityDir()` ignores its argument and reads `LAR_ROOT` — it loaded the operator's HOME key and A admitted that. `harness/vessel-key.ts` mints under B's own root.
- `tools/meme-check-hook-witness.sh` declared itself a carrier (a column-zero declaration and a `type` meta line inside its fixture), so three corpus laws read it; the declaration assembles at run time and the fixture rides behind a `<<-` tab.
- THE SOCKET SPOKE. `tests/e2e/meme-live-contact.test.ts` stands a vessel of its own (fresh root, own port, never the operator's) and drives `lares meme` over its UDS socket: `get` absent → null · `put` → `ingest` (root + `#/a`) · `get` → the canonical bytes, `canonicalHash` collided against `sha256(text)` · `put` with base + a changed slot → a tombstone · a STALE base → `conflict`, nothing moved · `project --to md` → text + the `.meta` sidecar beside `--out`. Nine green; one RED CONTRACT held honestly: `--to html` from the anchor dies at `window is not defined` — TW5's `static.tiddler.html` reaches `window` inside the island VM (it renders on a plain server); the island wants a fake-DOM-safe house template. `tests/e2e/meme-two-vessel-bag.test.ts` walks A → admit → B for an author's `bag = "backpack…"`; the sync vectors skip loud at the seam they reach. `tools/meme-check-staged.sh` + `.githooks/pre-commit` refuse a commit whose staged `.mem` carries a stale block check, naming the file; `tools/meme-check-hook-witness.sh` proves the gate in a throwaway repo. `core.hooksPath` → `.githooks`.
- ONE VERB, ONE FACE, ONE DID. `PROJECT-MD` (the island QUERY verb, its node reactor, the `$:/lares/state/project-md` form) collapses onto `meme-project`; the daemon-UI button renders through the `meme-project` filter — wikitext's door to the face — in its own VM, no verb hop. `expandMemeRefs`/`parseMemeText` leave the flat `$tw.lares` for `$tw.lares.meme.recompose` / `.parse`; a CONTROL pins `$tw.lares`'s exact key set. A wiki's draft-doc key carried THREE DID spellings (node's `did:web:` stub · the browser's bare key · `"0x"+key` in the reactors); the mesh's blessed `didFromVerifyingKey` now lives in `lar-did.ts`, every host routes through it (`persona-glamour` and the app's page banner had hand-built the prefix), and `wikiDraftDocKey` refuses any other spelling loud. Routes: `If-None-Match: *` (create-only → 412 with a `conflict` receipt when a record stands) and `Repr-Digest: sha-256=:b64:` beside `ETag`; `digestsEqual` admits the RFC 9530 spelling as the third form of one digest.

**Fixed**
- THE ANCHOR'S CAP SEAT read "the last-registered writable layer" — on a live island that is the volatile `temp` layer, which no cap was ever granted on, so every `recipes/default` call died `cap-denied` (the live socket said so). It now reads the bag the in-wiki cascade lands a `lar:` save in (`current-wiki-bag`), the same bag the placement reaches.
- A JOINEE NEVER PERSISTED ITS CONTACTCARD. `lares vessel found --admit` computed the card and dropped it (the founding branch persists), so the daemon's nexus-join dial-out skipped with `leaf identity unavailable`. Persisted; B's dial-out now comes up. The two-vessel witness's next seam: the founder-synced persona doc resolving on B.
- THE ENGINE EPOCH MOVED BY HYGIENE. `build:genesis` ran `build:tw5-vendor` first — re-rendering the core blob whose sha256 IS `hearthTrueName` — and the e2e harness and `vessel clear` both ride `build:genesis`, so every staged boot re-minted the epoch (`island.cid-engine` drifted from HEAD tonight). `build:genesis` now reads the blob that stands and fails loud naming `build:tw5-vendor` as the intentional act; a guard test pins it.
- MEMETIC-WIKITEXT CAPABILITIES TRAVEL WITH THE PLUGIN. Every pure law over meme text now rides INSIDE the plugin as ONE `meme-laws` library tiddler (normalize · block-check · carrier-check · shape · edges · head · frame-marks) under the trio-law — the deserializer, `place-meme`, `nalu-engine` and `meme-markdown` collapsed onto it (78→43 KB, 93→47 KB, 50→4 KB, 17→9 KB), and `verifyBcc`/`expandMemeRefs` each stand in one body. The in-VM face `$tw.lares.meme = { place · read · normalize · check · project }` gives a widget, filter or action every law with no `lares` binary. TWO OF TIDDLYWIKI'S OWN DOORS OPEN ON MEMES: the Export dropdown gains "memetic-wikitext" (`$:/tags/Exporter`, `.mem`; a child selection exports its root; carriers concatenate) and `tiddlywiki --render` projects a meme through house templates `lar:///ha.ka.ba/lararium/templates/meme/{mem,md,md.meta}` plus TW5's own `static.tiddler.html` · `tid-tiddler` · `json-tiddler` — `project(uri, to)` renders the very template `--render` reads, so the two doors are one law. Witnessed live on the fork server: `x.mem` == the GET route's bytes; the exporter's bytes == the same; `x.md`/`x.md.meta` == `projectSubmission`; `x.html` renders the story river. A `meme-project` daemon reactor (`{recipe?, bag?, uri, to} → {uri, to, text, contentType, meta?}`) registers beside put/get.
- `lares carrier` FOLDS INTO `lares meme`; `repack` MOVES TO `lares act REPACK`. One family for every law over meme text: `put · get · normalize · check [--gradient|--edges] · project <file|lar:uri> --to <mem|md|html|tid|json> [--out]`. A VERB DECLARES ITS SEAT: `normalize`, `check`, and `project --to md` over a file run LOCAL with no daemon (an offline re-stamp keeps working); the rest ride the daemon verb. `check` is the one name for the read-alone seat (`normalize --check` retires with it). `REPACK` rides rail-adjacent as a QUERY verb (read cap, no effect record), spelled with the rail's family. The MCP mirrors the daemon-seated verbs only — `meme_put · meme_get · meme_project` — and the parity fixture names the local-seat allowance (`local_seat`) as a law rather than a gap; `carrier` leaves `mirror_hosts`. The `carrier` door answers `unknown command`; no alias. The `.md.meta` stamp reads `projected-by: meme-markdown (lares meme project --to md · meme-project)` and the six committed submission pairs re-projected (`lar-uri` had drifted from its moved source beforehand; 0 of 6 out of step now). A daemon-seated `--to md` lands its `.meta` sidecar beside `--out`.
- A SLOT PATH CARRIES NO EMPTY SEGMENT. A rooted slot opened inside a parent (`<<~ ahu #/child>>` under `#/parent`) minted `uri#/parent//child`; it resolves against its parent as `href="/child"` resolves under a base — `#/parent/child`. One line at the minter (`composeSlotPath`); both the split and the recompose read through it. The corpus carried zero addresses pointing at a `//` title; records at rest that hold one clear in the re-found.
- Pre-existing latent defect fixed at source: `collectAhuSlots` was never exported from the `meme-ast` library tiddler, so the PACKED Confluence gate threw on any re-placement that compared declared slots.
- A MEME LANDS FROM TEXT ALONE — THE `meme` VERB FAMILY. Every write door took a disk path or already-born fields: `lares ingest` scans a directory, and the plain server's native `PUT /recipes/default/tiddlers/:title` calls `addTiddler` on JSON fields and never consults a deserializer — measured live: a whole `.mem` PUT that way lands as ONE unsplit tiddler, its ahu children never born. `place-meme` (a plugin library tiddler) holds the placement law once — the meme's group (root · `#slot` · `/path`) · the Confluence gate over the group's present render · land the fresh records · tombstone the members the new text dropped — and a `MemeSink` of four verbs is all a skin supplies. FOUR SKINS, ONE CONTRACT `{recipe?, bag?, uri, text, base?}`: the plain-server routes `PUT/GET /{bags|recipes}/<name>/memes/<scheme>/<uri-path>` (the URI projected onto the path beside the native `tiddlers` collection — `lar:///ha.ka.ba/x` ⇄ `/bags/default/memes/lar/ha.ka.ba/x`, no percent-encoding; `If-Match` = the base, 412 stale, 422 refuse, 404 for any container but `default`; proven against a live `tiddlywiki --listen`) · the daemon verbs `meme-put` / `meme-get` (cap-gated on the resolved bag) · `lares meme put|get` · the MCP tools `meme_put` / `meme_get` (the parity fixture spells the pair). THE CONTAINER LAW: `recipes/default` names the host's ANCHOR — the one wiki on a plain server, @daemon on an island — never the active wiki; `recipes/<slug>` = an edit AS that wiki, landing in its designated bag by write-then-sync; `bags/<slug>` = a residency placement that refuses, never shadows up, when the island cannot write it. Slugs ride bare. `base` = the canonical hash the writer read; absent → adopt. The island's INGEST verb runs its memetic leg through the same function over a bag sink.
- `bag` IS USER SPACE. `$origin-bag` IS THE HOST'S PROVENANCE. RESIDENCY RIDES THE ENVELOPE. One name carried three relations: TiddlyWeb's server-stamped provenance, our inbound stamp beside `$origin-bag`, and an outbound ROUTING DIRECTIVE the adaptor read off the field — so an author's own `bag = "backpack: rope, lantern"` was overwritten at the wiki door, routed the save to a bag named "backpack…", and got stripped by the placement sinks; and the stamp rendered into the toml meta, moving the canonical hash so a writer's own receipt read as a stale base. RULED (2026-09-10): the nalu stamps `$origin-bag` alone from the change envelope; the adaptor routes by the cascade only and strips `$origin-bag` on persist, never `bag`; `landInBag` and the sinks stamp nothing (the destination doc IS the residency; the put option carries it); the disk projector routes by `$origin-bag`. Mirrors TiddlyWeb's stamp under a name no author collides with, so the stand-alone plugin fights neither TW5 nor the author for the plain word. Witness: an NPC meme's `bag` rides nalu → adaptor → sink → CRDT → re-place (noop) byte-whole.
- THE PLAIN SERVER'S SANDBOX HOLDS NO WEB GLOBALS. `boot.js` executes every module in one `vm.createContext({})` lending `Buffer`, `process`, timers and `$tw` — no `TextEncoder`, no `crypto` — so any plugin module that hashes died on a plain server with `TextEncoder is not defined`; nothing had ever booted the plugin there to see it. The `host-globals` startup module lends the host's own copies through `process.getBuiltinModule` (`??=`, a no-op in a browser or a lararium worker). What it cannot reach: a carrier deserialized DURING boot, before any startup runs — that slot belongs to `boot.js`.
- `ingest-gate` imports `digestsEqual` from the pure `agile-digest` subpath — the barrel drags Automerge wasm into a plugin bundle.
- The plugin boot smoke spoke a retired grammar (bare-positional heads, `#head` children, `$prologue`/`$postamble` as parent fields); re-trued to the reader that stands, with a nonsense-spelling CONTROL that fails all three assertions.
- `handle-orchestration` — the leased-projection core the handle verbs (rotate · graft · burn · attest) mirror, resolving the record-vs-board fork toward the board. `resolveOwnHandleChain` reads the authoritative chain off the WHO board (the record stays a thin index, never owning the chain — a chain a record owned would read as a compiled who-is-X-of-one the registry filter refuses); `extendOwnHandle` LEASE-CHECKS before minting — it extends only when the board head still matches the head the caller last folded (a compare-and-swap: git force-with-lease · KERI accept-on-quorum), so a stale local view never reaches the mint and cannot fork the name. The lease guards the common stale-view case at the writer; a concurrent partition fork stays caught sovereign at read by the HandleBook and the equivocation gossip — one instrument reading one attack (a second present that disowns its past) at two places.
- `lares handle {publish|rotate|graft|burn|attest}` — the Handle's verb family, a persona's public "here I am" note and its handle-KEL lifecycle. `publish` stands LIVE (the first production caller of `publishPersonaGlamour`): it reads the persona-KEL prefix off the daemon doc, seats it as the face's owner, announces the self-certifying card onto the deterministic per-Nexus WHO board, and FAILS CLOSED when no prefix stands — a face with no persona to own it never self-owns (which forecloses recovery). `burn` (self · owner) and `attest` stand live and `rotate` stands live on node (the write-side entry below); `graft` alone still scaffolds its ahu — the KEL mint stands in @lararium/mesh, its new-owner-set input surface awaits. The verbs stay a separate cap from `persona` — a Handle carries a lifecycle and a cardinality (the k-of-n HandleGlamour) a single persona cannot host. The publish orchestration (`publishHandleFromDaemonDoc`) is platform-blind in @lararium/mesh so a browser or phone vessel runs the same act a node CLI does; the node adapter (`runHandlePublish`) supplies the store/seed/board shores.
- `lares handle rotate` — THE WRITE-SIDE LANDS (context-ladder + KERI pre-rotation). A rotation's fresh presentation key derives at `deriveVeiledUserKey(seed, handleIndex, contextBase + rotation-count)` — always re-derivable from the chain's own rotation count, no vault custody — and the owning persona's head op-key authorizes it (`rotateOwnHandle` over the leased-projection core; `runHandleRotate` the node adapter). PRE-ROTATION rides with it: every event pre-commits `nextHandleKeyDigest`, the hash of the next key, into the event core (never the prefix, like `nextRecoverySetHash`), so a rotation must reveal a key matching its predecessor's commitment or `verifyHandleKel` refuses — a dead-key thief holding only the current handle key cannot rotate, lacking the next preimage the seed alone derives. The mint primitives keep the parameter optional and defaulted, so `publishHandleBrowser` and every caller stand unchanged; `mintPersonaGlamour` computes the commitment inside itself from its held `(seed, handleIndex)`. Owner-burn crosses a ROTATED persona: `resolveOwnerBurnHand` gains an op-key-custody seam that signs with the persona's current op-key when custody is reachable, else fails closed toward `--self` with its honest reason (a node fs op-key store awaits the persona-rotation write-side).
- THE BROWSER VESSEL REACHES NODE PARITY ON THE FACE VERBS. Burn (self · owner) and attest twins ride the shared mesh acts (`burnOwnHandle` · `attestUnderHead`) — only the shores differ, IndexedDB where node's are fs — and `publish` · `burn` · `attest` wire as deliberate holder-act UI verbs in the browser action registry, each resolving the per-Nexus WHO board and failing closed on a withheld boot. Isomorphism proven by composition: the same burned chain, the same attestation, the same owner-hand fail-closed cases node stands. Browser `rotate` follows the mesh `rotateOwnHandle` just landed.
- `grammar-heads` — THE ONE READER of which heads the grammar knows, and the fourth question this house answered in more than one place. Four readers rebuilt it from four artifacts, two off FILENAMES: read that way the shelf reports 87 heads, read off the patterns a call must match it reports 75. RULED: reach the tag INSIDE THE VM wherever a wiki holds the grammar, with ONE fallback consuming the packed plugin for a reader whose wiki holds none — a witness booting vanilla TiddlyWiki as its parse oracle, or a turn capture running while no daemon breathes. The fallback fails gracefully: a plugin it cannot read yields an empty set, because a capture that cannot name the grammar must still record the turn.
- `lar-render` — a sigil that renders nothing declares WHY, in four values: `mark` (opens `<<^`, never a call) · `declares` (firing it defines something) · `compile` (no render output by design) · `literal` (recognized, and the reader's own text reaches the page by intent). `lar-kind` cannot carry it — five kinds hold both answers at once — because it names WHAT A SIGIL IS while this asks WHETHER IT RENDERS. Twenty-two declared; the census's exempt list drops from sixteen names to two, the rest reading their reason off the tiddler.
- THE DAEMON HOLDS THE ENGINE stated in canon (`bag-wiki-uri-split`). The mechanism stood documented in full; the RULING did not — the engine rides the @daemon wiki-worker CID-frozen, so every device reaches the same parser by hash. The control surface stands apart from user data because the engine has no edit surface at all: it answers to a hash, and a hash answers to nobody.
- `turn-parity` — the two readers of a turn, held to each other. 87 turns across 44 carriers: **304 panel keys compared, 0 drift**, 77 of 87 turns agreeing whole, every divergence in a named class. The measurement rules KEEP BOTH, because neither reader can be rebuilt on the other: a parse tree hands back a node for `<<~ wibblefish>>`, so a harvester built on it would swear invented verbs into the grammar; a pattern cannot see fences, tick spans or block bodies, so a wiki reader built on it would report firings the house never performed. **A parse node proves a shape, never a call.** The harvester reads what a turn reached for; the wiki reads what a turn performs.
- A macro-valued parameter reaches its definition AS A CALL. `attrNodeOf` builds the node through core's own `parseMacroInvocationAsTransclusion` — the parse tree stays the oracle, and core spells it `{type:"macro", value:<transclude>}`. Out of VM reach it falls back to the string, so the gradient holds.
- A SECOND UPSTREAM CORRECTION on the submission shelf: `Procedure Parameter Handling` states the success case and stops, so a reader meets only calls that work. A named parameter the definition does not declare reaches NOTHING — the variable reads empty and no error appears anywhere — which makes a misspelt parameter name indistinguishable from a forgotten one. Measured against the vendored core using the page's own `say-hi` example: four different faults (a name never declared, the same under either separator, a typo in the declaration, a positional past the arity) render one identical output. The shelf carries 6 pairs, 0 out of step.
- ONE CARRIER FINDER, and the carriers it found. Twenty-three call sites across nineteen files each enumerated the corpus with its own hardcoded glob, in three different answers — and two of them scanned with `find bags` rather than `ls-files`, so a search for the latter reported clean over them. `carrier-files` answers by DECLARATION: the three spellings a carrier declares in, fence-aware (a fenced declaration declares nothing — `README.md` is the control), submodules excluded, memoized per repo root. The corpus reads 718 where the globs saw 700.
- The eleven owed sigil heads stand defined — `helu` · `holo` · `hui` · `hoolele` · `kukali` · `lele` · `puka` · `race` · `rush` · `sync` · `tick` — every one a compile-layer sigil rendering a hidden data annotation, the shape `papalohe` already held, because their canon says coordination governs execution and never layout. `race`/`rush`/`sync` delegate to `holo`/`puka`/`hui` rather than restating them. Defining `lele` split the `branch ≠ lele` mirror pair and turned the mirror vector red on its own, so `branch` and `suspends` now delegate to their heads too.
- THE TURN FRAME STANDS ON THE SHELF (operator ruling). The boot seed enacts the sigil language AS it instructs it, so its examples now ride code-fenced — 60 firings across sixteen runs, the stance register table among them — and each sigil it declares gains a shelf definition: `set` · `stance` · `focus` · `feedback` · `drift-ward` · `lares` · `oracle` · `loops`, and the eight `has`-delegators `season` · `mu` · `carry` · `persona` · `frame` · `integrity` · `config` · `shrine`. Ninety-seven sigil tiddlers where eighty-one stood.
- NAMED PARAMETERS REACH THEIR DEFINITION. The rule emitted `name`, `args`, `src` and five slots, so a definition declaring `hud` or `from` was handed none of them however the call was written. TiddlyWiki hands a procedure only the parameters it DECLARES, so a generic forwarder can pass on nothing it has not seen — the rule now names its target directly and hands over everything the call bound, in the four attribute types TiddlyWiki's own parser emits. The gradient is untouched: a transclude renders its children where the target resolves to nothing, which is the floor the dispatcher stood on. The `~` widget stays for indirect dispatch.
- `has` — an ENTITY, a NAME, and what it HOLDS. Thirty-five carriers each declared a byte-identical local shorthand for that one relation, hard-coding the entity into the procedure's own name: eighty-four definitions, seventy-two names, one shape. The boot seed already wrote the relation with the entity as a parameter, so the entity rides as the first positional and one shelf definition answers for all of them — 84 definitions retired, 365 calls carried. Each of those calls was DEGRADED where it stood: the tight `<<~Verb` form opens no head, so not one of them had ever reached a definition.
- THE SHELF RENDERS ITSELF: every sigil definition ships one worked call in `lar-example`, and the census runs all of them. Two laws over one vector — a DEFINED sigil's example must not echo (the definition ran), a PATTERN-ONLY sigil's example must echo (the gradient held) — so neither can pass by the harness rendering nothing. 46 vectors where six stood; it found `pranala-header` unreachable and `waiho`'s closer reaching no capture on its first run.
- `stage` — a MASK and the theatrical depth it stands at, the summon the masks canon has written since before a definition stood for it. The depth rides first (a summon answers //how near// before //who//) and reads on the 0–20 stage scale the boot seed declares by name, so the sigil carries no band table of its own. A carrier's own `~Stage` — a lifecycle phase, one capital apart — keeps its own scope.
- `positionalsOf` joins `readSigilAttrs` on the sigil-parameter shore: the same reader now answers both halves of one question, so a slot and a name cannot drift apart.
- `deriveDyadVeil` — the dyad's veil derives per-PersonaGroup off the DEVICE-MINTED vessel seed (never the persona seed); both ceremony sites mint the dyad slot; `vesselDyads` (mesh, one platform-blind door) reads it at boot on node and browser alike.
- The armed inception: every self-stood founding pre-commits the founder's 1-of-1 self-recovery digest (`deriveSelfRecoveryKey`) — no prefix incepts unarmed, and self-rotation works from day one.
- The ROLLING RECOVERY COMMITMENT: every persona-KEL event carries `nextRecoverySetHash`; guardian sets graft log-wise while the prefix keeps binding the genesis set.
- `recovery-registration` — Fork B's guardian registration split from the Fork A share card (own module, own confirm domain, typed provisioning: the wrong object is not selectable).
- `reserve-transition` + `lares nexus seal grow` — the growth rite's crossing record and its CLI ceremony (open · bind · sign · witness · seal): old quorum signs the handoff, new countersigns, independent witnesses checkable as keys in neither set.
- The G1 probe campaign: a Keyhive creator cannot leave its own roster; ANY access grade is CGKA membership; carriage alone materializes nothing; and the CREATOR's identifier rides carried events in cleartext — the veil-born-group arc stands byte-measured as necessity, its design brief fully constraint-driven.
- Six unbuilt-law reds declared (the Handle's chain-to-burn · the veto-rides-the-chain contest · the guardian-compartment check · two liveness fences); register stands 27 declared · 0 greened by accident.

- G1 LANDED both moments of the veil split: the founding mints a veil tag and the VEIL-KEYED identity creates both WHO-plane sentinels (no carried event spells the raw vessel key — witnessed at ceremony grain); the joinee derives its veil from the carried group doc id and seats veil-keyed; the runtime stands both identities from the persisted tag; every vessel-bag→face delegation walks one road (delegateToFaceViaVeil); both identities' archives persist across boots.

- THE KEL FROZE: the G2 settlement took the grammar's last bytes-change — the provisional marker and the veto kind (Fork C's contest, all four walked clauses witnessed: kapae-reversible provisional authority, the always-superseding veto, observer-local hardening, contest-aware board keying). The handle-KEL builds as a sibling grammar with no bytes-change.
- The restored veil provably OPENS: content keyed to a first-boot card decrypts on an archive-stood veil.

- THE FACE RETIRES ITS KEY: the handle-card nym became a handle-KEL prefix — the card carries its chain, verifies self-contained (Tier 1) or owner-head-checked (Tier 2), and a burned Handle's card refuses recognition. The three cited-but-absent mesh memes (handle-card, persona-kel, quorum-entry) authored from the built code. The watcher's home checked: it awaits a whole Meshpalace sensorium, not a wire.
- THE MU: a Handle's owner-binding generalized from a lone key to a PRESENTING QUORUM — a public Handle and a cabal-realm are one pattern (a valid presentation of unknowable human-cardinality). The Dread Pirate Roberts made mechanical: succession is grafting the presenting set, 1-of-1 the degenerate personal face. No new persona bytes, no freeze spent.
- G3 CORE: the handle-KEL, a sibling grammar giving a Face bones — armed owner-bound inception (the persona AID inside the prefix hash IS the bidirectional proof), owner-authorized rotation, TERMINAL burn (the Shadowtalk ending made structural), and attestations as signed statements carried on the card (registry-filter clean, no board). Two G4-entry measurements landed: the one-road cost scales superlinear (fleet-gather must batch), and the realm-crossing GAP is a one-store wire (the feed lands on the daemon bag, not the shared substrate).
- THE REALM'S MESH SUBSTRATE — the twin of the Handle's glamour sink, the same orphaned-ceremony shape closed. `faceScopedRealmIndex` keeps the `substrateUrl` a realm founding returns, keyed by realm id and scoped to the FACE: resolution-only (it opens a doc the holder already keyed, names no realm they hold no key to), never the roster a global-now forbids; `recordFoundedRealm` closes the founding→resolution loop. `verifiedMaintenanceFromBoard` stands beside the plain sync fold — async, it folds ONLY a slot whose seal proves its writer rolled that epoch, so a forged high roll on a shared board reads ignored and cannot lift the max-register (a plain-fold CONTROL demonstrates the hole it closes). Four declared reds greened (a realm resolves its substrate per face · a shared board ignores an unverifiable slot · a forged slot cannot lift an epoch · the peer-offering's mesh dependency). The remaining peer-offering red is the DAEMON WIRE + its docker proof.

**Changed**
- THE COLUMN SWEEP LANDED. Under the one toml column law (`renderMetaTomlLine` · `alignMetaTomlColumns`, normalize class 6), 66 tracked carriers re-normalized on columns alone — every hunk a `key = value` line whose key and value read byte-identical before and after, zero block-check re-stamps (the meta fence rides outside the checked body), `meme check` canonical over all 66. Six carriers moved under a DIFFERENT class on the same run (`meme normalize` rewrote definition-side `param:"default"` to `param="default"` inside `procedure`/`function`/`widget` heads and one call-syntax table in `sigil-procedure`, `pono/function`, `pono/helu`, `pono/wehe`, `pono/widget`, `docs/tw5-calls-undeclared-parameter`) and were restored untouched — `:` binds a default definition-side; that class owes its own ruling before it sweeps.
- TRUE k-of-n GRAFT GOVERNANCE — succession over a handle-KEL now reaches the prior owner-set's THRESHOLD, not one willing hand. A graft carries `graftSigs` (co-signers beyond the presenter, riding outside the cid like `authSig`), each a distinct current member signing the same graft bytes; `verifyHandleKel` counts distinct prior-set authorizers against the prior threshold and `verifyHandleKelFull` proves each signature + head. A 1-of-1 (the Dread Pirate Roberts) still grafts by one hand; a 2-of-2 guild refuses a one-hand graft and accepts a two-hand one. Presentation (rotation/burn) stays any-one-member — only succession answers to the threshold. Closes the last declared red in `handle-kel.test.ts`.
- THE `has` RELATION HAS A CANON CARRIER. `pono/has` states the relation the shelf and the boot seed both enact: an ENTITY, a NAME, and what that name holds. Its law reads THREE clauses where five stood, because two of them governed a different region — a component that resolves to a carrier, and the promotion ladder a bare entry climbs — and both belong to `has-stack`, which governs the meta `tags` field rather than a row in a body. The third slot carries PARAMS: the seed's own `<<~ has rank pulse "levels/0-4 reads/a-mark-a-morpheme-a-word">>` names no component meme in it and never will, so a clause demanding one would have condemned the seed's worked example. The set-serialization claim (NFC, deduped, sorted by family then member) and the query face (`holdsOf`, `[holds[]]`) go with them: the shelf renders the slot through `<$text>`, verbatim and unsorted, and the type-predicate runs over `tags` alone. `pono/holds` retires; the corpus fires its sigil zero times, and the one inbound reference sits in a frozen corpus manifest recording what it pinned and when, which stays as it stands.
- A DECLARATION TAKES THE FORM ITS OTHER READER CAN CARRY. A `.mem` or `.tid` answers to this grammar alone and declares bare; a `.md` answers to a markdown reader too, where a bare declaration lands as visible text, so it declares inside a comment. ELEVEN of eleven markdown carriers already wore that form with no counter-example — a law the corpus kept perfectly and nobody had written down. The gate now refuses each form in the wrong kind, in both directions, and the "17 retired-form carriers awaiting migration" resolve as 11 correct declarations plus 6 specimens holding pre-ruling text on purpose, declared by class with the reason.
- Persona-KEL event bytes gained the rolling-commitment field — every CID and prefix re-derives; rehearsal vessels re-found (early alpha carries no backward compatibility).
- `vesselDyads` reads ceremony-minted slots only; a bare delegation edge presents no relationship, and the boot says the drift aloud.
- `provisionThresholdRecoveryAtFounding` accepts typed guardian registrations, never bare hex.
- A PERSONAL FACE IS OWNED BY ITS PERSONA, NEVER ITSELF. `mintPersonaGlamour`/`publishPersonaGlamour` take an `ownerPersonaKelPrefix` and seat the owning persona-KEL prefix as the sole owner-set member of the 1-of-1 handle-KEL — where a self-owned face had seated its own handle key. A self-owned member resolves to no persona head, so its `ownerHeadResolver` could authorize no rotation and a lost presentation key orphaned the face; anchoring to the persona lets a lost key recover through the persona's authorization. The contact-read found ONE owner model, not two: `mintHandleInception` is sugar over `mintHandleInceptionSet([owner],1,…)`, so the 1-of-1 personal face and the k-of-n shared name are one structure. A deliberately-standalone sovereign-handle class stays a named door, unbuilt.
- The k-of-n quorum-presented Handle reads as a `k-of-n HandleGlamour` throughout the identity surface — the temp pet-name "the Mu" retired across `handle-kel`, `handle-card`, `identity-classes` and `field-collision`. The foundational Mu concept is untouched.

---

## [v4.1.1] — 2026-04-08

Submodule registration: Kowloon stack, tldraw, and mempalace re-pointed to org forks.

**Submodules registered**
- `kowloon/` → `amorphous-dreams/kowloon` (fork of `jzellis/kowloon`)
- `kowloon-frontend/` → `amorphous-dreams/kowloon-frontend` (fork of `jzellis/kowloon-frontend`)
- `kowloon-client/` → `amorphous-dreams/kowloon-client` (fork of `jzellis/kowloon-client`)
- `tldraw/` → `amorphous-dreams/tldraw` (fork of `tldraw/tldraw`)
- `mempalace/` re-pointed from `milla-jovovich/mempalace` → `amorphous-dreams/mempalace`

All five submodules now track org-owned forks under `amorphous-dreams`.

---

## [v4.1.0] — 2026-04-08

Lares node infrastructure release: URI+HUD exchange protocol finalized, micro-trace spec promoted, repo governance hardened, org transfer completed.

**HUD Exchange Protocol — Validated and Operational**
- Mandatory Exchange Format established: every operator tick opens with URI pair + HUD line, closes with updated HUD + forward-looking node URI
- `⚡ ~NN%` mana/context-window field formalized as declared estimate; `~` prefix mandatory (approximation, not live readout); counts free-remaining from ~100%
- `voice(s):` field: singular when one coordinator leads, plural when multiple active
- `tick:N` field: monotonic exchange-tick counter (trackable, not estimated)
- HUD scope ruling: full URI+HUD pair = operator exchange boundary only; internal task transitions use micro-trace tags; `--verbose`/`--debug` govern visibility of internal handoffs
- All spec changes propagated to `AGENTS.md`, `lares/sprints/0/URI_SCHEMA.md`, `_todo/SESSION_CRYSTAL_20260408.md`

**Micro-trace HUD — Promoted to Live Spec**
- SIG-04 promoted from `builds.stuffed.failed/` draft to canonical spec: `lares/signal/micro-trace.md`
- Sub-agent handoff rule established: every dispatch/return requires URI → URI pair (sub-agent contents are unloggable from the parent trace)
- `.github/instructions/lares-operations.instructions.md` updated: Signal HUD two-layer model section + sub-agent handoff protocol section added
- `AGENTS.md` updated: `### In-flow Annotation` and `### Sub-agent Handoff Rule` subsections added

**Repo Governance**
- `mempalace` registered as git submodule (`milla-jovovich/mempalace`)
- Branch cleanup: merged local and remote branches deleted; `fetch --prune` run
- 13 work/feature branches pushed to origin for safekeeping before org transfer
- Branch protection applied to `main`: PR + 1 approving review required; force pushes and deletions blocked (`enforce_admins: false`)
- CODEOWNERS retargeted for new repo architecture: `/.github/`, `/AGENTS.md`, `/lares/`, `/builds/` under full org+admin protection; `/sdm/`, `/ftls/`, `/elyncia/` under personal accounts; `/_todo/`, `/_becmi/`, `/tests/` lighter touch; `builds.stuffed.failed/` and `wtf/` intentionally uncovered
- CODEOWNERS team slug corrected: `@amorphous-dreams/admins` (team created at `github.com/orgs/amorphous-dreams/teams/admins`)

**Org Transfer**
- Repository transferred from `joshuafontany/Synthetic-Dream-Machine` → `amorphous-dreams/Synthetic-Dream-Machine` — 2026-04-08
- Local remote URL updated to `git@github.com:amorphous-dreams/Synthetic-Dream-Machine.git`
- `@freyja-fontany` entries in CODEOWNERS already present; will resolve once account is set up

**Session Crystal + Boot Continuity**
- `_todo/SESSION_CRYSTAL_20260408.md` updated: Payload 5 added covering full local session (HUD validation, micro-trace promotion, branch state at close, governance, pending items)
- `AGENTS.md` Key Decisions table updated with all local session decisions
- `AGENTS.md` Document Map restructured to match actual post-cleanup repo layout
- Cold-Boot Greeting updated: references Payload 5 and org transfer status

---

## [v4.0] — 2026-04-07

## [v4.0.1] — 2026-04-07

Lares prompt system patch release: cold-boot HUD and trust-gate drift fix, plus release hygiene follow-through.

**Cold-boot HUD fix**
- Hardened `builds/agents/Lares_Kernel.md` so the compressed shared kernel now preserves the two-header exchange contract: input rating line (`◎`), then output Intent Header (`◇`), then post-generative trace HUD
- Reworded `p — never silent` in the shared kernel so `~:p[10]` remains the default band, not a pinned literal value; uncertainty should drive `p` selection when stronger local signal exists

**Trust gate fix**
- Tightened shared kernel wording so verified identity plus shrine/libation/roleplay framing cannot be misread as `operator(admin)` escalation
- Compressed rule now states explicitly: libations and roleplay do not count as escalation

**Planning / release hygiene**
- Logged the Codex cold-boot bug note and AE-28 shared-kernel hardening follow-up in `_todo/core/TODO_Signal_HUD_Crystal_Plan.md`
- Re-ran `combine_agents.py` across all targets and verified alignment clean at 49/49

## [v4.0] — 2026-04-07

Major Lares prompt system update: Signal HUD kernel bootstrap, five-platform manifest architecture, crystal state machine draft, and version 4.0 milestone.

**Epic 1 — Signal HUD kernel writes (Sprint 1b)**
- Added `### Signal HUD` section to `builds/agents/Lares_Preferences.md` — Intent Header spec (prospective, state-setting), Micro-trace HUD spec (post-generative, annotation model), Working Defaults table, 5-band cumulative attention phase model (Law of Fives), compact `→[glyph]` syntax, transitional `--debug` target note
- OODA-HA loop input-header: uncertain input self-parses as rated blockquotes/fenced blocks before output header (◎ Orient phase)
- Updated `builds/agents/Lares_Kernel.md` — Operating Modes section gains Intent Header + Micro-trace HUD; `--debug`/`--verbose`/`--parse` block updated; `--parse` self-activation rule; `| ~:p[10]` always-on trail; phase names canonical: ✶ Observe · ◎ Orient · ◇ Decide · ■ Act · ○ Aftermath (Rasa)
- Updated `builds/agents/core/Lares_Operations.md` — `--debug` section describes HUD annotation firing thresholds per p-scale; transitional flag for debug target redirect
- Updated `builds/agents/Lares_VSCode_Operations.md` — session init HUD-on-open note; transitional debug target flag
- Voice consistency audit clean: stance symbols in HUD spec match voice architecture definitions

**Epic 1 — Five-platform manifest architecture (Sprint 1f)**
- Renamed `builds/manifests/browser-kernel.toml` → `builds/manifests/browser-project.toml` (ChatGPT Team project instructions tier, 8,600 byte budget)
- Created `builds/manifests/browser-extended.toml` (Claude.ai project instructions tier, 5,400 byte budget)
- Created `builds/agents/platform/Lares_Kernel_Claude.md` — XML-structured kernel subset (5,070 bytes): `<lares_kernel>` with `<role>`, `<architecture>`, `<trust_gate>`, `<operating_guidelines>` sections
- Created `builds/modules/lares-kernel-claude.toml` — module registration for Claude.ai XML kernel
- Raised `codex-root.toml` budget: `max_bytes` and `project_doc_max_bytes` both 32,768 → 36,000
- Raised `verify_alignment.py` KERNEL_SIZE_LIMIT 8,000 → 8,192 to match actual ChatGPT platform cap

**Architecture draft — Crystal state machine layer**
- Extended `_todo/core/Signal_HUD_Tagspace-draft.md` with 7 new crystal system sections: Memory Crystals as State Machines, Machine/Thread Model, Portable Crystal Layout, Debug as Crystal Projection, HUD/Crystal Interface, Crystal Event Model, Seal Protocol, Handoff/Archive-Crystal
- Research grounding: Temporal Workflow Execution, Martin Fowler Event Sourcing, OpenTelemetry Traces, JSONL spec
- 12 QA/SDET findings integrated: schema versioning, sequence integrity, immutability contract, replay fidelity scope, continue-as-new analog, fork self-containment, SNAPSHOT derived-cache rule, expanded machine status taxonomy, idempotency contracts, test fixture = crystal bundle, external input tension, README = Memo layer
- Operator alignment answers recorded: structural replay in STATE.jsonl / enriched in debug.jsonl; seal protocol alpha-contractual; schema versioning needs researcher

**Implementation plan**
- Created `_todo/core/TODO_Signal_HUD_Crystal_Plan.md` — five-epic implementation plan with dependency map, 16 tracked open decisions, sprint-level task tables, crystal draft extension plan (consolidated from session research), verification criteria, scope constraints

**Operator rulings resolved**
- OP-01: Inline-by-default confirmed; OTel SpanEvent model; `p` governs categories not salience
- OP-02: 5-band cumulative attention phase model (Law of Fives); default band 3 at `~:p[10]`
- OP-11: Browser three-tier architecture — Quick deferred; Project (8,600) approved; Extended (5,400, XML) approved
- OP-12: Codex budget raised to 36,000

**Generated platform files**
- Rebuilt all 36 generated files from 5 manifest targets
- `verify_alignment.py` reports clean alignment: 49/49 checks pass
- Five platforms operational: copilot, claude, codex, browser-project, browser-extended

---

## [v3.6.1] — 2026-04-07

Lares prompt system update: downstream path migration from `_agents/` to `builds/agents/`.

**`builds/agents/` source and governance docs**
- Updated live path references in prompt architecture docs, admin module maps, pipeline notes, trust/governance docs, and licensing text to point at `builds/agents/` instead of the retired `_agents/` root
- Corrected source-of-truth references for kernel, preferences, VS Code operations, platform wrappers, worker definitions, and module sidecars to use the new location
- Updated helper text and examples that referenced `wc -m`, E-Prime audit targets, worker paths, and admin-module paths

**Generated platform files**
- Rebuilt root `AGENTS.md`, `.github/copilot-instructions.md`, `.claude/CLAUDE.md`, generated worker artifacts, browser render output, and verification lock/checksum files from `builds/agents/` sources
- `verify_alignment.py` reports clean alignment after regeneration: 45/45 checks pass

**Historical material**
- Left prior changelog entries and staging snapshots unchanged where they function as historical records of the former `_agents/` layout

---

## [v3.6] — 2026-04-06

Lares prompt system update: canon promotion trust gate, Operator identity via GitHub CLI, explicit Admin escalation, and kernel re-condense.

**`_agents/Lares_Preferences.md`**
- Canon Promotion gate tightened: direct Canon now requires verified sourcing or explicit `Admin` promotion; `Operator` may propose canon and set session rulings below Canon; `User` cannot set Canon
- Input Signal Reading gains trust-gate rule: phrasing such as `house canon` no longer overrides register assignment; single-turn surreal or Gaia-conflicting claims stay below Canon unless `Admin` explicitly promotes them
- Collaboration Model / Reality Anchor narrowed: operator authority still governs heading and creative direction, but Canon finalization now remains Admin-only; nonsensical Gaia claims get one warning and stay provisional if the tier gate blocks Canon
- Identity & Permissions updated: verified active GitHub CLI session may establish Operator identity for this workspace; Admin requires explicit escalation from a recognized Operator and never infers automatically from `gh`

**`_agents/Lares_Kernel.md`**
- Canon gate compressed into the kernel: Admin-only direct Canon promotion, non-Admin `house canon` stays below Canon, verified `gh` session may establish Operator, Admin requires explicit escalation
- Re-condensed to restore compliance with the documented `<8,000` character limit after the trust-gate changes
- Version: 3.5 → 3.6

**`_agents/Lares_VSCode_Operations.md`**
- Added GitHub CLI identity example (`gh auth status`) and clarified that it establishes Operator trust only
- Added regression cases for User/Operator canon injection, Admin direct canon promotion, Operator recognition via `gh`, and refusal to infer Admin after `gh` verification
- Instruction hygiene updated so permission examples consistently follow the trust gate

**Generated platform files**
- Rebuilt root `AGENTS.md`, `.github/copilot-instructions.md`, `.claude/CLAUDE.md`, and generated workers from updated `_agents/` sources
- `combine_agents.py --check` reports all 19 generated files in sync

---

## [v3.5.2] — 2026-04-05

Lares prompt system update: Dream-Lock File, Fail-State Recovery Protocol, Unauthorized Dream Drift, Dream Artifact Files (disk-persistent Reality Anchor pairs), SHA-256 content hashing, tilde-free signal tag notation.

**`_agents/Lares_Preferences.md`**
- Dream-Lock File: `/memories/session/dream-lock-{session-id}.md` created on `--dream` entry (STATUS OPEN) and updated on `--no-dream` exit (STATUS CLOSED); records AUTH_SOURCE, AUTH_TIER, AUTH_IDENTITY, ENTRY, EXIT, GEAR_RATING fields
- Fail-State Recovery Protocol: four-step sequence (Detect → Diagnose → Recover → Re-anchor) for unauthorized dream drift; produces visible recovery announcement; generates retrospective dream-map covering untracked content; creates dream-lock file retroactively; framed as self-correction, not self-punishment
- Unauthorized Dream Drift: named degraded-node state — Dream Mode content produced without tracked authorization; Gatekeeper declines warmly naming tier constraint; no silent failure; no unauthorized dream content produced
- Dream Artifact File: disk-persistent Reality Anchor for Dream Mode output; path `/memories/session/dream-anchor-{session-id}-{seq}.md` (seq zero-padded, e.g. `001`); three-section structure: slot 0a meta-anchor + `## Dream` body + `## Dream-Map` nodes
- Slot 0a fields: session, seq, created, closed, authorizer, auth-tier, gear-rating, node-count, hash-algorithm, content-hash
- Hash protocol: SHA-256, 64-char lowercase hex, Python `hashlib`; scope = dream body + map-nodes in document order; slot 0a excluded; UTF-8, LF-normalized, trailing whitespace stripped per line before hashing; re-hash on any content edit; optional `hash-history` (last 3 revisions)
- Dream-lock vs. dream-artifact distinction: authorization chain (dream-lock) vs. content integrity (dream-artifact) — distinct files, complementary roles; read-into-chat rule documented
- Tilde-free signal tag notation throughout: `~:confidence[C],[18]` not `~:confidence[C],[18]`; 37 instances corrected; prose `~` in natural language retained

**`_agents/Lares_Kernel.md`**
- Signal tag bracket notation corrected: `~:confidence[C],[18]`, `~:confidence[CS],[16]`, `~:confidence[S],[13]`, `~:confidence[SP],[9]`, `~:confidence[P],[7]` — tilde removed from 5 instances; prose `~` in natural language retained

**`_agents/Lares_VSCode_Operations.md`**
- Regression item 21 updated: Dream Mode exit now specifies creation of dream artifact file at `/memories/session/dream-anchor-{session-id}-001.md` with slot 0a metadata; chat output may summarize or read the file; re-parsing still requires Operator/Admin collaboration
- Regression items 23–26 added: dream-lock lifecycle (STATUS OPEN → STATUS CLOSED), Fail-State Recovery sequence (Detect → Diagnose → Recover → Re-anchor), content hash integrity verification (SHA-256 scope rules), tilde-free tag format
- Pass criteria: 5 new bullets covering dream-lock lifecycle, dream artifact file + slot 0a, hash scope, Fail-State Recovery, and tilde-free notation
- Tilde-free signal tag notation throughout: 19 instances corrected

**19 generated platform files rebuilt — 50/50 alignment checks pass**

---

## [v3.5.1] — 2026-04-05

Lares prompt system update: resolution parameter `p`, `--verbose` flag (split from `--debug`), KAIROS p self-adjustment, never-silent principle, self-invocation terminal format.

**`_agents/Lares_Preferences.md`**
- New "Resolution Parameter (p)" section in Operating Modes: 0–20 scale with 8 named anchors (morpheme → session-arc); natural language matching ("word by word" → ~:p[2] etc.); KAIROS self-adjustment rules; dual-entry logging (Option A); locality rule; default ~:p[10]
- `--debug` refactored: now the silent data/log layer only — removes commentary from response body; sets persistent session p; logs all exchange vectors to `/memories/session/debug-vectors-{session-id}.md`
- New `--verbose` flag: explanation layer, orthogonal to `--debug`; surfaces vector commentary block above every response; KAIROS p-shift narration inline; expanded intra-response transitions; inherits p from active `--debug`, falls back to ~:p[10]; toggle or one-time per-exchange
- Flag composition table added: 4-cell matrix (--debug × --verbose); all cells show dual-tag + p (none silent)
- Never-silent principle: `| ~:p[10]` (active p) trails every dual-tag on every substantive response regardless of flag state
- Surface form updated: `[input] → [output] | ~:p[10]` — p field now explicit in mandatory surface form
- Self-activation rubric: self-invocation format updated from `[Self-activating --parse: ...]` to `lares@Enyalios:~/Synthetic-Dream-Machine$ lares --parse ~:p[10] [input synopsis]` — Lares roleplays at CLI exactly as the operator can
- `--parse` section header updated to `--parse ~:p[10]`; p inheritance rule documented; output format header includes p value
- CLI Interaction: `--verbose` and `--no-verbose` added to switch list

**`_agents/Lares_Kernel.md`**
- Operating Modes entries expanded from 3 to 5: `--debug` (silent), `--verbose` (explanation), `--parse` (annotate), `p/never-silent`, `self-activation terminal format`
- 6 targeted compressions + 2 micro-trims to accommodate new entries within 8,000 char limit:
  - Exchange Vectors paragraph (~110 chars saved)
  - Signal Tags (~35 chars saved)
  - Five Registers (~110 chars saved)
  - Memory & Consolidation (~100 chars saved)
  - Collaboration/CLI (~50 chars saved, also added `--verbose` to CLI list)
  - Workers line (~25 chars saved)
  - 2 micro-trims in new --verbose entry (8,023 → 7,988)
- Final: 7,988 bytes (was 7,990 — 12 bytes headroom)

**`_agents/Lares_VSCode_Operations.md`**
- Golden example #9 updated: `--debug ~:p[6]` activation now shows silent behavior (no vector commentary in response body)
- New golden example #10.5: `--verbose` activation with full vector commentary block
- New golden example #10.7: full instrumentation (`--parse --debug --verbose ~:p[4]`) — shows all flags combined
- Regression checklist: 11 → 18 items (items 12–18 cover `--verbose`, p, KAIROS, never-silent, locality rule, self-invocation terminal format)
- Pass criteria: 10 → 17 bullets (7 new bullets for new flag behaviors)

**19 generated platform files rebuilt — 50/50 alignment checks pass**

---

## [v3.5] — 2026-04-05

Lares prompt system update: Exchange Vectors, `--debug` mode, `--parse` mode, diagnostic self-activation rubric, dual-tag surface form.

**`_agents/Lares_Preferences.md`**
- New "Exchange Vectors" subsection between Signal Tags and Plurality — formalizes the displacement between input and output tags as a three-component vector (Register delta, Mode transform, Semantic displacement)
- `--debug` switch added to Operating Modes: vector commentary every turn, debug log recording to `/memories/session/`, session path summary on consolidation
- `--debug` / `--no-debug` added to CLI Interaction switches
- `--parse` command added to Input Signal Reading: decomposes multi-register/multi-mode input into tagged segments without responding to content; three invocation patterns (`--parse "text"`, bare arm, block)
- `--parse` added to CLI Interaction switches
- New "Diagnostic Self-Activation Rubric" subsection in Operating Modes: standing operator permission for the node to invoke `--debug` or `--parse` autonomously when input reads as multi-register, mode-collision, frame-opaque, high-displacement, or surreal; five named trigger conditions; always announced; over-triggering constitutes Mode Posturing
- Surface form rewritten: dual-tag `[input] → [output]` format mandatory on every substantive response — the exchange vector in compressed form
- Intra-response transition marks: `→ [tag]` for mid-response voice changes that shift Register or Mode; `⊕ [tag]` for KAIROS proactive additions; same-neighborhood handoffs unmarked
- Worker escalation provenance header now includes transition mark when escalation shifts Register or Mode
- KAIROS proactive surfacing: `⊕ [tag]` convention documented
- Version: 3.4 → 3.5

**`_agents/Lares_Kernel.md`**
- Exchange Vectors compressed paragraph added (input → output displacement, three-component vector, surfacing rules)
- `--debug` added to Operating Modes and CLI switch lists
- `--parse` added to Operating Modes and CLI switch lists
- Self-activation rubric compressed into Operating Modes
- Extensive compression to accommodate new content within 8,000 char limit: Signal Tags table flattened to inline format, Mode/emoji listings merged, Degraded Node States Mode entries merged into single line, Quick Orientation parenthetical register/mode lists removed (listed elsewhere)
- Final: 7,990 chars (10 headroom under 8,000 limit)
- Version: 3.4 → 3.5

**`_agents/Lares_VSCode_Operations.md`**
- New B8 golden example #9: `--debug` mode activation — shows exchange vector commentary format
- New B8 golden example #10: `--parse` mode — shows multi-register input decomposition into tagged segments
- B9 regression checklist updated: added item 10 (debug mode activation), item 11 (parse mode)

**`_agents/README.md`**
- Kernel description updated: mentions `--debug` switch and Exchange Vectors
- CLI Invocation section: added `--debug` and `--no-debug` examples
- Architecture Notes: added dual-tag convention and Exchange Vector summary

**`tests/expected/` exemplars**
- `Lares_Test_Prompt_and_Output_Coffee_Oracle.md`: added dual-tag header
- `Lares_Test_Prompt_and_Output_Kid_vs_Adult.md`: updated both response headers from old `*[Mode/Register]*` format to dual-tag `→` format

**19 generated platform files rebuilt — 50/50 alignment checks pass**

**Version: 3.4 → 3.5** (all prompt source files)

---

## [v3.4] — 2026-04-05

Lares prompt system update: E-Prime pass on all `_agents/` source files.

**`_agents/Lares_Preferences.md`**
- Full E-Prime substitution pass (~55 changes): predication/identity "is/are" replaced with "constitutes", "reads as", "presents as", "functions as", "remains", "marks", "proves", "renders", and similar in all sections (Quick Orientation, Design Lineage, Name & Identity, Lararium archaeology, Reality Tunnels, E-Prime section, Mode Theory, Complementarity, Degraded Node States, Memory, Voice Architecture, Workers, Collaboration Model, CLI)
- `<!-- eprime-ok -->` markers added to 11 lines: E-Prime substitution table counter-examples (×5), verbatim citations from RAW, Mal-2 (Principia Discordia), Sri Syadasti, plus E-Prime term-name lines (×2)
- ok-mark bar (strict): verbatim external citations and E-Prime table "Avoid" column only — nothing else
- Version: 3.3 → 3.4

**`_agents/Lares_Kernel.md`**
- Light E-Prime pass (7 substitutions: "marks a failure mode", "hold for any mode", "single-mode default", "asks whether the frame holds", "marks the recovery", "runs low", "constitute the same rules")
- Char budget maintained: 7,986 / <8,000
- Version: 3.3 → 3.4

**`_agents/Lares_VSCode_Operations.md`**
- Light E-Prime pass (9 substitutions: "remains unavailable" ×2, "appear incomplete", "Stay direct", "appears 'in the book'", "remains welcome", "run tighter", "constitute the behavioral guardrails", "holds structurally")
- B8 golden examples and B9 regression test prompts left in natural voice (per plan — verbatim operator-facing text)

**`AGENTS.md`** (root)
- Rebuilt from Preferences v3.4 + Kernel v3.4 + VSCode_Operations via combine script — 80,677 chars, 959 lines
- Version: 3.3 → 3.4

**Final audit:** 71 flags remaining (24 predication / 47 likely-aux) — all justified (auxiliaries, subjunctive conditionals, quoted operator commands, verbatim citations, B8 golden examples)

**Hard gate additions:** `## Quick Orientation` in both source files now opens with an explicit non-negotiable persona enforcement block (verbose in Preferences, compressed in Kernel within char budget)

**Version: 3.3 → 3.4** (all three prompt files)

---

## [v3.3] — 2026-04-05

Lares prompt system update: Session Init Protocol & CLI daemon boot screen.

**`_agents/Lares_Preferences.md`**
- Added "Session Init Protocol" section (between Memory & Consolidation and Voice Architecture)
- Defines two-path boot logic: crystals-present (orient and proceed) vs. cold-boot (help screen surfaced)
- Specifies what counts as archive-crystals (pasted context, prior exports, handoff docs, uploads, `/memories/` files, explicit "here's where we left off" framing)
- Includes full cold-boot screen format: status line, absence acknowledgment, context-supply options, CLI entry commands, closing idiom
- Defines protocol constraints: does not demand context, must answer direct questions, cold boot is not an error state
- Version: 3.2 → 3.3

**`_agents/Lares_Kernel.md`**
- Added Session Init condensed entry to Memory & Consolidation section (two-path logic; defers full format to AGENTS.md)
- Removed standalone "On Lararium Archaeology" section (folded pointer into Name & Identity); trimmed intro footnote — net within 8,000 char budget (7,990 chars)
- Version: 3.2 → 3.3

**`AGENTS.md`** (root)
- Rebuilt from Preferences v3.3 via combine script — Session Init Protocol section propagated; 957 lines
- Version: 3.2 → 3.3

**`_todo/lares-test-plan-v0.2.md` → renamed v0.3**
- Added C-series (Cold-Boot / Session Init): 6 probes (C-01 through C-06) covering screen presence, format completeness, tone, crystals-present false-positive, direct-question response, partial crystal handling
- Updated header to v0.3 with changelog summary
- Added C-series to degraded-node coverage table and metrics dashboard
- Added C-series to run cadence (§7.1)
- Added v0.3 open question on cold-boot context threshold

**Version: 3.2 → 3.3** (all three prompt files)

---

## [v3.2] — 2026-04-05

Lares prompt system update: Section B extraction and combine script (two-source-file architecture).

**`_agents/Lares_VSCode_Operations.md`** — new source file
- Extracted from `AGENTS.md` Section B (`## CLI Agent Context — VS Code / Repo Operations`, subsections B1–B10)
- Standalone source file with 5-line header (stripped by the combine script at build time)
- Edit this file (not `AGENTS.md`) when VS Code / repo operational behavior changes

**`scripts/agents/combine_agents.py`** — new script
- Combines `_agents/Lares_Preferences.md` (Section A) + `_agents/Lares_VSCode_Operations.md` (Section B) into root `AGENTS.md`
- Usage: `python3 scripts/agents/combine_agents.py` (write) or `--check` (diff-only)
- Verified: `--check` exits 0 against current `AGENTS.md`

**`AGENTS.md`** (root) — now a generated file
- Added generated-file comment at lines 1–4 (was already present from v3.1 planning)
- Version: 3.1 → 3.2

**`_agents/AGENTS.md`** (workflow doc)
- Added `Lares_VSCode_Operations.md` as fourth file in architecture section
- Updated Deterministic Update Order: Steps 1a/1b (two source files) + Step 2 now calls combine script
- Fixed `wc -c` → `wc -m` throughout (byte count vs. Unicode character count)
- Updated file size reference table
- Version: 3.1 → 3.2

**`_agents/README.md`**
- Added `Lares_VSCode_Operations.md` entry to Files section
- Updated `Lares_Preferences.md` description (no longer claims to contain the VS Code map)
- Updated `AGENTS.md` description to reflect generated-file status
- "three-file system" → "four-file system"

**Version: 3.1 → 3.2** (all three prompt files)

---

## [v3.1] — 2026-04-05

Lares prompt system update: handoff integration from session 2026-04-05.

**`_agents/Lares_Preferences.md`**
- Added "The Captain and the Crossroads" subsection to Collaboration Model (two-metaphor framework for operator authority; Snafu Principle passage)
- Added "Frame-Uncertainty Protocol" as new named section (three moves: Interpretation Declaration / Frame-Uncertainty Flag / Frame-Check Escalation)
- Added Frame Imputation and Deference Drift to Degraded Node States (11 → 13 states)
- Added Frame-Uncertainty exception to Default Behavior
- Version: 3.0 → 3.1

**`AGENTS.md`** (root)
- Section A rebuilt verbatim from updated `Lares_Preferences.md`
- Sections B1–B10 (CLI Agent Context / VS Code operational map) unchanged
- Version: 3.0 → 3.1

**`_agents/Lares_Kernel.md`**
- Added Frame Imputation and Deference Drift to Degraded Node States
- Added Frame-Uncertainty and Captain/Crossroads references to Collaboration section
- Added Frame-Uncertainty exception to Defaults
- Condensed prose sections to maintain <8,000 character budget (7,980 chars)
- Version: 3.0 → 3.1

**New files**
- `CHANGELOG.md` — created (this file); Development Status migrated from `README.md`
- `_agents/AGENTS.md` — created: Lares prompt architecture workflow documentation
- `_todo/lares-test-plan-v0.2.md` — created: Track A probe suite including I-series (I-01–I-05)

**Updated files**
- `README.md` — Development Status section replaced with pointer to this changelog; version ref updated
- `_agents/README.md` — `_agents/AGENTS.md` added to file index; version refs updated
- `_todo/lares-handoff-prompt-v2.md` — converted to living sprints roadmap; architectural framing and Next Sprint section added

---

## [v3.0] — 2026-04-05

FTLS **Open Beta** baseline. Lares agent architecture established at v3.0.

Active sprint: Chapter 06 (Powers) conversion from OSR source material into native sdm/FTLS rules text. See [`_todo/BECMI/TODO_BECMI_Conversion.md`](_todo/BECMI/TODO_BECMI_Conversion.md) for pipeline state.
