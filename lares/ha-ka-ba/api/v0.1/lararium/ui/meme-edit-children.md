<!-- <<~ !DOCTYPE = lar:///ha.ka.ba/api/v0.1/pono/memetic-wikitext >> -->

<<~&#x0001; ? -> lar:///ha.ka.ba/api/v0.1/lararium/ui/meme-edit-children >>

<<~ ahu #iam >>

```toml
uri-path     = "ha.ka.ba/api/v0.1/lararium/ui/meme-edit-children"
file-path    = "lares/ha-ka-ba/api/v0.1/lararium/ui/meme-edit-children.md"
content-type = "text/vnd.tiddlywiki"
register     = "CS"
confidence   = 0.88
mana         = 0.88
manao        = 0.85
manaoio      = 0.82
role         = "EditTemplate: inline text editors for each ahu slot within a parent meme edit view"
cacheable    = true
retain       = true
tags         = ["$:/tags/EditTemplate"]
list-after   = "$:/core/ui/EditTemplate/body"
```

<<~/ahu >>

<<~&#x0002;>>

\whitespace trim
<$list filter="[all[current]has[ahu-slots]]" variable="_" emptyMessage="">

<div class="tc-lararium-ahu-edit-sections">
<$list filter="[enlist{!!ahu-slots}]" variable="childUri">

<div class="tc-lararium-ahu-edit-section">
<div class="tc-lararium-ahu-slot-header">
<code class="tc-ahu-slot-name"><$text text={{{[<childUri>get[ahu-slot]]}}}/></code>
<$link to=<<childUri>> tooltip="Open slot tiddler">↗</$link>
</div>
<$edit-text tiddler=<<childUri>> field="text" tag="textarea" class="tc-edit-texteditor tc-ahu-edit-body"/>
</div>

</$list>
</div>

</$list>

<<~&#x0003;>>

<<~ ahu #edges >>

<<~ pranala #implements-meme ? -> lar:///ha.ka.ba/api/v0.1/pono/meme family:control role:implements >>

<<~/ahu >>

<<~&#x0004; -> ? >>
