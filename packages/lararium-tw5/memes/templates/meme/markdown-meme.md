<!-- <<~ !DOCTYPE = lar:///ha.ka.ba/@lares/api/v0.1/pono/memetic-wikitext >> -->

<<~&#x0001; ? -> lar:///ha.ka.ba/@lararium/templates/meme/markdown-meme >>
```toml iam
uri-path = "ha.ka.ba/@lararium/templates/meme/markdown-meme"
type     = "text/x-memetic-wikitext"
register = "CS"
role     = "disk-export parent-level template — assembles canonical memetic-wikitext for a meme. v1: emits SOH carrier sentinel + parent text + slot children via the ahu cascade. Operator-source-grammar idempotency target. v2 will emit per-slot iam toml blocks via dedicated macros."
```

<<~&#x0001; ? -> <$text text=<<currentTiddler>>/> >>

<$text text={{!!text}}/>

<$list filter="[field:fragment-parent<currentTiddler>!has[draft.of]]" variable="slotChild">
<$tiddler tiddler=<<slotChild>>>
<$transclude $tiddler={{{ [all[shadows+tiddlers]tag[$:/tags/Lar/AhuTemplate]!is[draft]] :map:flat[subfilter{!!text}] +[first[]] }}}/>
</$tiddler>
</$list>

<<~&#x0002;>>
