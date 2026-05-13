<<~&#x0001; ? -> lar:///ha.ka.ba/@lararium/tw5/filters/toml-field >>
```toml iam
uri-path = "ha.ka.ba/@lararium/tw5/filters/toml-field"
file-path = "bags/@lararium/tw5/filters/toml-field.md"
type          = "text/x-memetic-wikitext"
register      = "CS"
confidence    = 0.88
mana          = 0.88
role          = "anchor: registerTomlFieldOperator — heleuma ka"
heleuma       = "ka"
source-file   = "packages/lararium-tw5/src/filters/toml-field.ts"
source-symbol = "registerTomlFieldOperator"
module-ref    = "lar:///ha.ka.ba/@lararium/tw5/filters/toml-field-tw5"
body-sha256 = "1062e83173e8d690cb0f5807e47022ca2cd27aef93dbafec5bb2b9096baae950"
cacheable     = true
retain        = true
```

<<~&#x0002;>>

<<~ ahu #contract >>

## Contract

`toml:fieldName[value]` — returns tiddlers where `fields[fieldName] === value`. Used for TOML-indexed field queries.

<<~/ahu >>

<<~ ahu #source >>

## Source

```typescript
tw.filterOperators["toml"] = function (source: TW5FilterSource, operator: TW5FilterOperator) {
  const fieldName = operator.suffix ?? "";
  const value     = operator.operand ?? "";
  const results: string[] = [];
  source(function (tiddler, title: string) {
    if (!tiddler) return;
    const fv: string = String(tiddler.fields?.[fieldName] ?? "");
    if (fv === value) results.push(title);
  });
  return results;
};
```

<<~/ahu >>

<<~ ahu #edges >>

<<~ pranala #to-tw5-widgets ? -> lar:///ha.ka.ba/@lararium/tw5/modules/tw5-widgets family:control role:implements >>
<<~ pranala #to-module ? -> lar:///ha.ka.ba/@lararium/tw5/filters/toml-field-tw5 family:control role:module >>

<<~/ahu >>

<<~&#x0003;>>

<<~&#x0004; -> ? >>
