<!-- <<~ !DOCTYPE = lar:///ha.ka.ba/api/v0.1/pono/memetic-wikitext >> -->

<<~&#x0001; ? -> lar:///ha.ka.ba/api/v0.1/vendor/sq-streams >>

<<~ ahu #iam >>

```toml
uri-path     = "ha.ka.ba/api/v0.1/vendor/sq-streams"
file-path    = "lares/ha-ka-ba/api/v0.1/lararium/plugins/sq-streams.md"
content-type = "text/x-memetic-wikitext"
register     = "CS"
confidence   = 0.92
mana         = 0.90
manao        = 0.88
manaoio      = 0.85
role         = "vendor declaration: Streams plugin by Saq Imtiaz — hierarchical tree-of-tiddlers TW5 UI"
cacheable    = true
retain       = true
tw5-plugin-id = "$:/plugins/sq/streams"
tw5-plugin-version = "1.2.24"
```

<<~/ahu >>

<<~&#x0002;>>

<<~ ahu #about >>

# Streams Plugin — by Saq Imtiaz

**Author**: [Saq Imtiaz](https://github.com/saqimtiaz/streams)
**License**: MIT
**Upstream source**: https://saqimtiaz.github.io/streams/
**TW5 plugin id**: `$:/plugins/sq/streams`
**Vendored at**: `lares/ha-ka-ba/api/v0.1/tw5-plugins/sq-streams-1.2.24.json`
**Preload script**: `scripts/write-vendor-plugins.ts` → `src/generated-vendor-plugins.ts`

Provides hierarchical tree-of-tiddlers UI: rapid keyboard-driven entry, Tab to
indent, Enter for new node. Each stream node is a standalone tiddler.

## Field mapping — Lararium ↔ Streams

| Lararium field | Streams field | Direction |
|---|---|---|
| `ahu-parent` | `parent` | child → parent |
| `ahu-slots`  | `stream-list` | parent → ordered children |
| (parent)     | `stream-type = "stream"` | marker |
| (child)      | `stream-type = "default"` | marker |

`carrier-split.ts` emits both sets. All ahu child tiddlers are natively navigable
as Streams trees. `[tag[lar:///parent-uri]]` and `[list{!!stream-list}]` both work.

## Upgrade

```
cd /tmp && git clone --depth=1 https://github.com/saqimtiaz/streams.git sq-streams
# then re-run: pnpm --filter @lararium/tw5 build:vendors
```

Update `tw5-plugin-version` in this #iam block after upgrade.

<<~/ahu >>

<<~&#x0003;>>

<<~ ahu #edges >>

<<~ pranala #implements-meme ? -> lar:///ha.ka.ba/api/v0.1/pono/meme family:control role:implements >>
<<~ pranala #vendor-of ? -> lar:///ha.ka.ba/api/v0.1/pono/vendor family:provenance role:vendor >>

<<~/ahu >>

<<~&#x0004; -> ? >>
