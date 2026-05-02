<<~&#x0001; ? -> lar:///ha.ka.ba/@lares/api/v0.1/lararium/filters/toml-field-tw5 >>
```toml iam
uri-path = "ha.ka.ba/@lares/api/v0.1/lararium/filters/toml-field-tw5"
file-path = "packages/lares/api/v0.1/lararium/filters/toml-field-tw5.md"
type          = "application/javascript"
module-type   = "filteroperator"
register      = "CS"
confidence    = 0.90
mana          = 0.90
role          = "compiled TW5 filter operator: toml — generated from packages/lararium-tw5/src/tw5-widgets.ts"
cacheable     = true
retain        = true
source-symbol = "registerTomlFieldOperator"
source-file   = "packages/lararium-tw5/src/tw5-widgets.ts"
```

<<~&#x0002;>>
(function(){
"use strict";
exports.toml = function(source, operator) {
  var fieldName = operator.suffix ?? "";
  var value     = operator.operand ?? "";
  var results   = [];
  source(function(tiddler, title) {
    if (!tiddler) return;
    var fv = String(tiddler.fields?.[fieldName] ?? "");
    if (fv === value) results.push(title);
  });
  return results;
};
})();
<<~&#x0003;>>
<<~&#x0004; -> ? >>
