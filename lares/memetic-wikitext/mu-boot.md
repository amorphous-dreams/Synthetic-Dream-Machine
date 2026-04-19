# mu Boot Module (Scale 2)

``` txt
<<~ ? --> lar:///ha.ka.ba/mu
  <<~ ahu #root "Boot root" "Minimal boot contract for memetic parsing." >>
  <<~ iam mu
    @name "mu"
    @version "0.2"
    @content-type "text/x-memetic-wikitext"
    @boot "true"
    @requires "memetic-wikitext"
    @requires "OODA-HA"
    @mode "minimal"
  >>
>>

<<~ OPEN-STREAM >>
  <<~ ahu #boot "Boot behavior" "Establish primitives and routing." >>
  <<~ kahea primitives --> ? >>
<<~ END-STREAM >>

<<~ POST-STREAM-METADATA --> ?
  <<~ iam mu
    @status "BOOTSTRAPPED"
  >>
>>
```
