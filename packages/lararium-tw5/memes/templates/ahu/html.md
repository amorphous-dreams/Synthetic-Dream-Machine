<!-- <<~ !DOCTYPE = lar:///ha.ka.ba/@lares/api/v0.1/pono/memetic-wikitext >> -->

<<~&#x0001; ? -> lar:///ha.ka.ba/@lararium/templates/ahu/html >>
```toml iam
uri-path = "ha.ka.ba/@lararium/templates/ahu/html"
type     = "text/x-memetic-wikitext"
register = "CS"
role     = "live-UI render template — renders an ahu slot as a clickable section. The cascade selects this template by default. Sets currentTiddler to the slot child URI; the operator can transclude metadata directly."
```

<section class="lar-ahu" data-uri=<<currentTiddler>>>
<header class="lar-ahu-slot"><$link to=<<currentTiddler>>>{{!!slot}}</$link></header>
<div class="lar-ahu-body">
<$transclude $tiddler=<<currentTiddler>> mode="block"/>
</div>
</section>
