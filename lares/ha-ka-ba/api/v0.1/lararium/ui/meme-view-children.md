<!-- <<~ !DOCTYPE = lar:///ha.ka.ba/api/v0.1/pono/memetic-wikitext >> -->

<<~&#x0001; ? -> lar:///ha.ka.ba/api/v0.1/lararium/ui/meme-view-children >>

<<~ ahu #iam >>

```toml
uri-path     = "ha.ka.ba/api/v0.1/lararium/ui/meme-view-children"
file-path    = "lares/ha-ka-ba/api/v0.1/lararium/ui/meme-view-children.md"
content-type = "text/vnd.tiddlywiki"
register     = "CS"
confidence   = 0.88
mana         = 0.88
manao        = 0.85
manaoio      = 0.82
role         = "ViewTemplate: renders non-body ahu slots as named sections; double-click inline edit per slot"
cacheable    = true
retain       = true
tags         = ["$:/tags/ViewTemplate"]
list-after   = "$:/core/ui/ViewTemplate/body"
```

<<~/ahu >>

<<~&#x0002;>>

\whitespace trim

\define ahu-edit-state(childUri) $:/state/lar-ahu-edit/$(childUri)$

\define ahu-section-slot(childUri, slot)
<div class="tc-lararium-ahu-section" data-ahu-slot="""$slot$""">
  <div class="tc-lararium-ahu-slot-header">
    <code class="tc-ahu-slot-name">$slot$</code>
    <$button class="tc-ahu-edit-btn tc-btn-invisible" tooltip="Edit slot inline">
      <$action-setfield $tiddler=<<ahu-edit-state "$childUri$">> text="yes"/>
      ✎
    </$button>
    <$link to="""$childUri$""" tooltip="Open as tiddler">↗</$link>
  </div>
  <$reveal type="nomatch" stateTitle=<<ahu-edit-state "$childUri$">> text="yes">
    <div class="tc-lararium-ahu-body">
      <$transclude tiddler="""$childUri$""" mode="block"/>
    </div>
  </$reveal>
  <$reveal type="match" stateTitle=<<ahu-edit-state "$childUri$">> text="yes">
    <div class="tc-lararium-ahu-edit-inline">
      <$edit-text tiddler="""$childUri$""" field="text" tag="textarea"
        class="tc-edit-texteditor tc-ahu-edit-inline-area" rows="6"/>
      <$button class="tc-btn-invisible tc-ahu-done-btn" tooltip="Done editing">
        <$action-deletefield $tiddler=<<ahu-edit-state "$childUri$">> text/>
        ✓ done
      </$button>
    </div>
  </$reveal>
</div>
\end

<!-- Only render for parent memes that have ahu slots -->
<$list filter="[all[current]has[ahu-slots]]" variable="_" emptyMessage="">

<!-- Slots to suppress: control/structural slots that carry no user-facing prose -->
<!-- #body is rendered by MemeticParser via ViewTemplate/body — don't double-render -->
<!-- #iam #exit #edges #stream-* are structural; render nothing to the user -->
<$set name="suppressedSuffix" value="#body #iam #exit #edges #stream-open #stream-close #stream-exit #body-open #body-close #meme-body-open #meme-body-close">

<div class="tc-lararium-ahu-sections">
<$list filter="[enlist{!!ahu-slots}]" variable="childUri">
<$set name="slotName" value={{{[<childUri>get[ahu-slot]]}}}>

<!-- Skip body + all control slots -->
<$list filter="[<slotName>!matchregexp[^#(body|iam|exit|edges|stream-open|stream-close|stream-exit|body-open|body-close|meme-body-open|meme-body-close)$]]" variable="_" emptyMessage="">
<<ahu-section-slot childUri:<<childUri>> slot:<<slotName>>>>
</$list>

</$set>
</$list>
</div>

</$set>
</$list>

<<~&#x0003;>>

<<~ ahu #edges >>

<<~ pranala #implements-meme ? -> lar:///ha.ka.ba/api/v0.1/pono/meme family:control role:implements >>

<<~/ahu >>

<<~&#x0004; -> ? >>
