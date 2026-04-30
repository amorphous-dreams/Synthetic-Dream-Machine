<!-- <<~ !DOCTYPE = lar:///ha.ka.ba/api/v0.1/pono/memetic-wikitext >> -->

<<~&#x0001; ? -> lar:///ha.ka.ba/api/v0.1/lararium/templates/meme >>

<<~ ahu #iam >>

```toml
uri-path     = "ha.ka.ba/api/v0.1/lararium/templates/meme"
file-path    = "lares/ha-ka-ba/api/v0.1/lararium/templates/meme.md"
content-type = "text/vnd.tiddlywiki"
register     = "CS"
confidence   = 0.90
mana         = 0.90
manao        = 0.88
manaoio      = 0.85
role         = "render template: drives slot transclusion for all meme parent tiddlers via {{||this}}"
cacheable    = true
retain       = true
```

<<~/ahu >>

<<~&#x0002;>>

\whitespace trim

\define LAR_MEME_CONTROL_SLOTS() #iam #exit #edges #stream-open #stream-close #stream-exit #body-open #body-close #meme-body-open #meme-body-close

<$list filter="[enlist{!!ahu-slots}]" variable="childUri" emptyMessage="">
<$set name="slotName" value={{{[<childUri>get[ahu-slot]]}}}>

<$list filter="[<slotName>!matchregexp[^#(iam|exit|edges|stream-open|stream-close|stream-exit|body-open|body-close|meme-body-open|meme-body-close)$]]" variable="_" emptyMessage="">
<$transclude tiddler=<<childUri>> mode="block"/>
</$list>

</$set>
</$list>

<<~&#x0003;>>

<<~ ahu #edges >>

<<~ pranala #implements-meme ? -> lar:///ha.ka.ba/api/v0.1/pono/meme family:control role:implements >>

<<~/ahu >>

<<~&#x0004; -> ? >>
