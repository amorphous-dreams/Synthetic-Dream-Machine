<!-- <<~ !DOCTYPE = lar:///ha.ka.ba/@lares/api/v0.1/pono/memetic-wikitext >> -->

<<~&#x0001; ? -> lar:///ha.ka.ba/@lararium/templates/ahu/markdown-meme >>
```toml iam
uri-path = "ha.ka.ba/@lararium/templates/ahu/markdown-meme"
type     = "text/x-memetic-wikitext"
register = "CS"
role     = "disk-export render template — emits an ahu slot in canonical memetic-wikitext: opening sigil, body text verbatim, closing sigil. Per-slot iam emission lives in a follow-up sprint once round-trip verifies. Cascade selects this template when lar-export-scope='markdown-meme'."
```

<<~ ahu <$text text={{!!slot}}/> >>
<$text text={{!!text}}/>
<<~/ahu >>
