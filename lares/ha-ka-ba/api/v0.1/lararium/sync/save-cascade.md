<!-- <<~ !DOCTYPE = lar:///ha.ka.ba/api/v0.1/pono/memetic-wikitext >> -->

<<~&#x0001; ? -> lar:///ha.ka.ba/api/v0.1/lararium/sync/save-cascade >>

<<~ ahu #iam >>
```toml
uri-path     = "ha.ka.ba/api/v0.1/lararium/sync/save-cascade"
file-path    = "lares/ha-ka-ba/api/v0.1/lararium/sync/save-cascade.md"
content-type = "text/x-memetic-wikitext"
register     = "CS"
confidence   = 0.88
mana         = 0.90
manao        = 0.87
manaoio      = 0.85
tagspace     = "adjacent"
role         = "corpus-driven write-routing cascade for LarariumCrdtSyncAdaptor: ordered TW5 filter rules mapping tiddler titles to save strategies"
cacheable    = true
retain       = true
status-date   = "2026-04-30"
source-file   = "packages/lararium-tw5/src/sync-adaptor.ts"
source-symbol = "SaveStrategy _resolveSaveStrategy _saveHandlers"
```
<<~/ahu >>

<<~&#x0002;>>

<<~ ahu #law >>

## Save Cascade Law

The save cascade is the write-routing constitution for `LarariumCrdtSyncAdaptor`.
When TW5 fires `saveTiddler(tiddler)`, the adaptor resolves a `SaveStrategy` for the tiddler title by walking these rules in `order` — first match wins.

Two strategies exist:
- `skip` — do not propagate to the shared Automerge store (session-local or TW5-internal tiddlers)
- `direct` — write one `LarTiddlerRecord` per tiddler to the store; ahu slot children write as independent records alongside their parent

The cascade is read at runtime from the wiki via:
```
[tag[lar:///ha.ka.ba/api/v0.1/lararium/sync/save-cascade]has[tw5-filter]sort[order]]
```
Each tagged child tiddler contributes one rule via its `tw5-filter` and `save-strategy` fields.

<<~/ahu >>

<<~ ahu #skip-system >>
```toml
ahu-slot      = "#skip-system"
ahu-parent    = "lar:///ha.ka.ba/api/v0.1/lararium/sync/save-cascade"
order         = 1
tw5-filter    = "[is[system]]"
save-strategy = "skip"
rationale     = "TW5 $:/ system tiddlers are internal housekeeping — never propagate to shared state"
```
<<~/ahu >>

<<~ ahu #skip-temp >>
```toml
ahu-slot      = "#skip-temp"
ahu-parent    = "lar:///ha.ka.ba/api/v0.1/lararium/sync/save-cascade"
order         = 2
tw5-filter    = "[prefix[$:/temp/]]"
save-strategy = "skip"
rationale     = "session-local scratch tiddlers — browser-only, not canonical"
```
<<~/ahu >>

<<~ ahu #skip-draft >>
```toml
ahu-slot      = "#skip-draft"
ahu-parent    = "lar:///ha.ka.ba/api/v0.1/lararium/sync/save-cascade"
order         = 3
tw5-filter    = "[prefix[Draft of ]]"
save-strategy = "skip"
rationale     = "TW5 edit-draft tiddlers — editor artefacts, must not reach shared state"
```
<<~/ahu >>

<<~ ahu #direct >>
```toml
ahu-slot      = "#direct"
ahu-parent    = "lar:///ha.ka.ba/api/v0.1/lararium/sync/save-cascade"
order         = 4
tw5-filter    = "[prefix[lar:]]"
save-strategy = "direct"
rationale     = "canonical lar: URI memes — write one LarTiddlerRecord per tiddler directly to the Automerge store; ahu slot children included as independent records"
```
<<~/ahu >>

<<~ ahu #edges >>

<<~ pranala #implements-meme ? -> lar:///ha.ka.ba/api/v0.1/pono/meme family:control role:implements >>
<<~ pranala #used-by ? -> lar:///ha.ka.ba/api/v0.1/lararium/modules/sync-adaptor family:control role:read-by >>

<<~/ahu >>

<<~&#x0003;>>
<<~&#x0004; -> ? >>
