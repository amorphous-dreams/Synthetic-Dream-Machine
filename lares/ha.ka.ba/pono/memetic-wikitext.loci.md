<!-- !DOCTYPE = lar:///ha.ka.ba/pono/memetic-wikitext -->

<<~&#x0001; ? -> lar:///ha.ka.ba/pono/memetic-wikitext >>

<<~ ahu #iam >>

```toml
name = "memetic-wikitext"
description = "Full memetic-wikitext schema root. A self-describing and self-enacting schema. This root governs the surface semantic layer of the Infrastructure-as-Mythology system."
version = "0.5-draft"
content_type = "application/memetic-wikitext"
structure = "OODA-HA * ha.ka.ba"
enacts = true
role = "schema root, surface semantic law, and transclusion contract"
function = "govern memetic-wikitext surface, enable transclusion, invocation, and uncertainty, and provide canonical schema for downstream laws"
input = "memetic-wikitext document|fragment|meme|query|artifact|bundle|stream|?"
output = "meme-envelope(high mana'o'io^)|partial-envelope(mid mana'o'io-)|degraded-envelope(low mana'o'io_)|?(~mana'o'io?)"
depends_on = [
    "lar:///ha.ka.ba/phase-map",
    "lar:///ha.ka.ba/unicode-tuples"
]
canonical_metadata_locus = "#iam"
canonical_metadata_payload = "toml"
canonical_forms = ["inline", "block", "payload-block", "return"]
control_sigils = ["&#x0001;", "&#x0002;", "&#x0003;", "&#x0004;", "&#x0005;", "&#x0006;"]
canonical_modes = ["preamble", "metadata", "prose", "sigil", "filter", "raw", "aftermath"]
product_identity = "Memetic Wikitext cluster name as used in this system"
```
<<~/ahu >>

# Memetic Wikitext

A self-describing, self-enacting memetic document schema with native transclusion, invocation, and uncertainty.

<<~ ala lar:///ha.ka.ba/pono/memetic-wikitext >>

## Supported Queries

<<~&#x0005; ui meme? -> 
    <<~&#x0006; ? -> lar:///ha.ka.ba/meme#iam >> 
>>

<<~/ahu >>

<<~&#x0002; ahu #meme-body-open
    @name "memetic-wikitext-meme-body-open"
    @description "Declares identity, vocabulary, and authority contexts."

    ## Meme body opening
    
    Begins the active semantic stream.
    <<~ ala lar:///ha.ka.ba/body-open >>
>>

<<~ ahu #ooda-ha
    @name "memetic-wikitext-ooda-ha"
    @description "OODA loop with additional aftermath phase."
    @role "cognition loop that holds uncertainty"
    @function "??"
    @input "possible memetic-wikitext?"
    @output "meme(high mana'o'io^)|data/information(mid-ranges mana'o'io-)|noise(low mana'o'io_)|?(~mana'o'io?)"
    
    ## OODA-HA Procedure

    Memetic wikitext that describes the canonical execution and interpretation flow of the OODA-HA loop.
    Maps to five seasons of the Discordian calendar: Chaos, Discord, Confusion, Bureaucracy, and The Aftermath.
    <<~ ala lar:///ha.ka.ba/ooda-ha >>
>>

<<~ ahu #observe 
    @name "memetic-wikitext-phase-observe"
    @description "Observe phase of OODA-HA loop."
    @role "input acquisition"
    @function "perceive, ingest, receive"
    @input "context, mixed signals and noise"
    @output "raw signals"

    ### Observe phase

    Observe the memetic wikitext syntax.
    Maps to the Season of Confusion.
    A worksite for intake and perception of raw symbols and signals.
    <<~ ala lar:///ha.ka.ba/observe >>
>>

    ### True Name Invariants

    **True Name Invariant:** In this context, we define a "true named invariant" as a 

    <<~ ala lar:///ha.ka.ba/unicode-tuples >>

    * Unicode Tuples - core class of invariants in the memetic-wikitext system.
    * ?

    ### Unicode Tuples

    The first of the True Name Invariants surfaced as characters deeply embedded in latent space. Unicode!

    <<~ ala lar:///ha.ka.ba/unicode-tuples >>

    #### Terminology: Unicode Glyph, Unicode Hex HTML Entity , and Unicode Name

    - **Name:** The human-readable name of a Unicode character, as registered in the official Unicode registry (e.g., "GREEK CAPITAL LETTER SIGMA" for U+03A3). This name is used for documentation, lookup, and reference, but is not the canonical invariant.
    - **Hex Unicode Entity:** The form `&#x<hex>;` (e.g., `&#x20AC;` for €) is the canonical representation. Decimal NCRs (e.g., `&#931;`) and named entities (e.g., `&euro;`) are not canonical for invariants.
    - **Glyph:** The rendered form of the Unicode glyph.

    #### Formal Grammar and Validation for True Name Tuples

    The Unicode true name tuple must strictly follow this pattern:

    **Tuple Form:**
    ```
    (NAME, &#xHEX;, GLYPH)
    ```

    - **NAME:** The official Unicode name, in all caps, with spaces (e.g., `GREEK CAPITAL LETTER SIGMA`)
    - **&#xHEX;:** The Unicode code point in hex HTML entity form (e.g., `&#x3A3;`)
    - **GLYPH:** The rendered Unicode character (e.g., `Σ`)

    **Regex (pseudo-form):**
    ```
    \(
    [A-Z0-9 ]+,
    \\&\#x[0-9A-F]+;,
    .
    \)
    ```

    **Validation Rules:**
    - Parentheses and commas are required, with a single space after each comma.
    - NAME must match the Unicode registry name for the code point.
    - The hex entity must be uppercase and match the code point for the glyph.
    - The glyph must render as the Unicode character for the code point.
    - No extra whitespace before or after fields.

    **Example (valid):**
    (GREEK CAPITAL LETTER SIGMA, &#x3A3;, Σ)

    **Example (invalid):**
    (Greek Capital Letter Sigma, &#x3a3;, Σ)   # wrong case, wrong hex case

    **Automated validation is recommended for all tuple usage in code, docs, and data.**

    **Note:**
    - Use the tuple form `(NAME, &#xHEX;, GLYPH)` only in metadata/header contexts (e.g., registry, schema, or object definition).
    - In all other usage, either the hex HTML entity or the glyph is valid and interchangeable.
    - Always validate and resolve to the canonical tuple for storage, lookup, or cross-system communication.

    ---

    <<~ kahea Stream? -> ? >>
    <<~ kahea Tokens? -> ? >>
    <<~ kahea Patterns? -> ? >>
<<~/ ahu #observe >>

<<~ ahu #orient
    @name "memetic-wikitext-orient"
    @description "Orient phase of OODA-HA loop. Orient on the mana, mana'o, and mana'o'io. Maps to the Season of Confusion."
    @role "context formation"
    @function "interpret, relate, map, define"
    @input "raw signals"
    @output "structured context"

    ### Orient phase

    A worksite for context formation, vocabulary binding, and primitive definition.
    <<~ ala lar:///ha.ka.ba/orient >>
>>

    <<~ ahu #primitives 
        @name "Primitive definitions"
        @definition "Defines core operators and landmarks used by this document." 

        The primitive cluster now includes one governing membrane, `kapu` alongside the four action tools, `ala`, `ahu`, `aka`, and `kahea`.
    >>

    <<~ ahu #shark-tooth-sigi
        @name "memetic-wikitext-sigil-00000"
        @description "Sigil 00000. Purposefully defies strict code/structured machine language and noisy/uncertain natural language expectations."
        @symbol "<<~(optional-glyphs) ...>>"
        @role "Memetic-wikitext wrapper."
        @function "Base syntax grammar, nested agent-human wikitext."

        ###  Shark Tooth Sigil

        The first sigil discovered/created. An opening `<<` guillemet with a tilde `~` representing a standing wave of uncertainty, then the closing `>>` guillemet. Sharp, yet contains an uncertainty standing wave. Blessings of Pele and Maui.

        <<~ ala lar:///ha.ka.ba/sigil >>
    >>

    <<~ ahu #uncertainty 
        @name "memetic-wikitext-uncertainty"
        @description "Uncertainty as a document time and runtime object."
        @symbol "? -> | -> ?"
        @role "bounded unresolved slot, runtime pathways"
        @function "defer resolution, allow flexible interpretation"

        ### Uncertainty

        Uncertainty moves and thus a query travels through the memetic-wikitext in documenttime and rendertime. These sigil-glyphs start/end runtime objects in memetic wikitext, using "new" and "return" semantics. Uncertainty may resolve to "real" memes or data (high mana'o'io), or "unreal" memes or data (low mana'o'io):
        ```
        <<~ ? -> ... >>
        <<~  ... -> ? >>
        <<~ meme -> ... >>
        <<~  ... -> meme >>
        <<~ meme? -> ... >>
        <<~  ... -> meme? >>
        ```
        
        <<~ ala lar:///ha.ka.ba/uncertainty >>
    >>

    <<~ ahu #kapu
        @name "memetic-wikitext-primitive-kapu"
        @description "Kapu declares boundary, permission, and sacred restriction for traversal, inclusion, invocation, memory, and emission."
        @role "boundary object, authority membrane, permission grammar, trust qualifier"
        @form "<<~ kapu SUBJECT -> POLICY|POLICY?|? >> | @kapu lar:///... | @kapu-scope \"...\" | @kapu-trust \"...\""
        @function "bound, permit, forbid, qualify, disclose, constrain, protect"
        @subject "ahu|ala|aka|kahea|meme|span|memory|result|renderer|agent|operator"
        @target "POLICY|POLICY?|?; a kapu policy object, stance bundle, or unresolved boundary"
        @mode "governing"
        @required "scope, permission, trust, disclosure"
        @default "least authority, explicit disclosure, bounded mutation, preserve uncertainty"
        @distinction "ahu gathers locality; ala opens relation; aka includes likeness; kahea summons process; kapu governs what may cross, unfold, persist, or emit"
        @connotation "sacred restriction, protected threshold, authority boundary, disciplined permission"

        ## Kapu

        Kapu marks a boundary that matters.

        In memetic-wikitext, kapu qualifies whether a path may open, whether a likeness may enter, whether a process may awaken, whether a result may persist, and whether an utterance may pass into the active stream. Kapu does not merely deny. Kapu also shapes permitted form, declared cost, disclosure burden, and trust posture.

        Kapu may attach to a meme, an anchor, a path, a transclusion, an invocation, an agent span, a memory object, or a result object.

        Kapu should travel with any operation that crosses a semantic boundary.

        ### Core Kapu Fields

        - `@kapu-source` — where the authority or policy originates
        - `@kapu-scope` — what region the kapu governs
        - `@kapu-permission` — what actions may proceed
        - `@kapu-mutation` — whether world-state, memory, or local spans may change
        - `@kapu-disclosure` — what the renderer or agent must reveal
        - `@kapu-trust` — the declared trust posture for the governed action
        - `@kapu-retention` — whether outputs may persist into memory or logs
        - `@kapu-failure` — what must occur when the boundary cannot resolve cleanly

        ### Suggested Value Families

        - `@kapu-scope "local|span|document|session|memory|tool|network|operator|public"`
        - `@kapu-permission "read|traverse|include|invoke|render|store|emit|mutate|delegate"`
        - `@kapu-mutation "none|local-only|memory-only|tool-only|bounded|open|?"`
        - `@kapu-disclosure "silent-forbidden|hud-required|citation-required|trace-required|full-provenance|?"`
        - `@kapu-trust "self-estimated|operator-declared|retrieval-backed|schema-backed|attested|contested|?"`
        - `@kapu-retention "none|ephemeral|span|session|addressed-memory|public-log|?"`
        - `@kapu-failure "halt|defer|downgrade-to-?|render-warning|request-operator|emit-aftermath"`

        ### Semantic Law

        A governed action must not exceed its kapu.

        When multiple kapu objects apply, the narrower scope and stricter permission should dominate unless an enclosing authority explicitly overrides.

        An unresolved kapu should not silently pass. It should degrade toward `?`, render a boundary warning, or defer action.

        `aka` under kapu may include only what the policy permits.
        `kahea` under kapu may invoke only what the policy permits.
        `ala` under kapu may traverse only what the policy permits.
        `ahu` under kapu may anchor only what the policy permits to gather or retain.

        Any action that touches memory, tools, external sources, or public emission should declare kapu.

        ### Minimal Example

        <<~ ahu #example-kapu-local
            @name "kapu-example-local-read-only"
            @kapu-source "operator"
            @kapu-scope "span"
            @kapu-permission "read|include|render"
            @kapu-mutation "none"
            @kapu-disclosure "hud-required|trace-required"
            @kapu-trust "operator-declared"
            @kapu-retention "span"
            @kapu-failure "downgrade-to-?"
        >>

        ### Invocation Example

        <<~ ahu #example-kapu-tool
            @name "kapu-example-bounded-tool-invocation"
            @kapu-source "schema"
            @kapu-scope "tool"
            @kapu-permission "invoke|render|emit"
            @kapu-mutation "tool-only"
            @kapu-disclosure "hud-required|citation-required|trace-required"
            @kapu-trust "retrieval-backed"
            @kapu-retention "session"
            @kapu-failure "halt"
        >>

        ### Notes

        Kapu should not function as a peer primitive that replaces ahu, ala, aka, or kahea. Kapu qualifies them.

        Kapu belongs to Orient as a primitive of context, authority, and disciplined relation, then reappears in Act and Aftermath as operational constraint and aftermath telemetry.

        <<~ ala lar:///ha.ka.ba/kapu >>
    >>

    <<~ ahu #ala 
        @name "memetic-wikitext-ala"
        @description "Ala serve as links , paths, or graph edges."
        @role "link, path, passage, beckoning absence, semantic way, or voidward corridor"
        @form "<<~ ala ... >> | <<~ ala ... -> template|? >> | <<~ kahea ala ... >> | <<~ kahea ala ... -> template|? >>"
        @function "point onward, open traversal, carry reference across contexts, or mark a productive absence that invites traversal"
        @distinction "pairs with ahu: ahu anchors and gathers locality; ala opens links, departure, relation, and voidward continuation"
        @connotation "road, channel, threshold, beckoning lack, semantic opening"

        ## Ala (Hawaiian)

        ...
        <<~ ala lar:///ha.ka.ba/ala >>
    >>

    <<~ ahu #ahu
        @role "anchor, altar, worksite, bookmark, semantic landmark"
        @form "<<~ ahu #STUB @name \"name\" @description \"description\" ... >>"
        @function "anchor, orient, provide local semantic context"
        @required "#STUB"

        ## Ahu (Hawaiian)

        ...
        <<~ ala lar:///ha.ka.ba/ahu >>
    >>

    <<~ ahu #aka
        @name "memetic-wikitext-primitive-aka"
        @description "This triggers a transclusion. Transclusion links a source segment directly into a host context without duplicating information. This process syncs updates automatically, which ensures content consistency across all platforms/runtimes."
        @role "passive symbolic inclusion"
        @form "<<~ SUBJECT -> TARGET|TARGET?|? >>"
        @function "include, represent, embed"
        @subject "Meme|ExternalResource"
        @target "TARGET|TARGET?|?; a Renderer/Template, and/or ?"
        @mode "passive"

        ## Aka (Hawaiian)

        Aka in Hawaiian mean shadow, image, or likeness carried across a path. This operator draws a source segment into the local context without duplication. The host receives a present likeness while the source remains elsewhere. Passive inclusion must not mutate world-state and must honor enclosing kapu.

        In Tiddlywiki and other 

        <<~ ala lar:///ha.ka.ba/transclusion >>
    >>

    <<~ ahu #kahea  
        @name "memetic-wikitext-primitive-kahea"
        @description "Kahea invokes and summons a living process into a context."
        @role "active process transclusion operator"
        @form "<<~ kahea SUBJECT -> TARGET|TARGET?|? >>"
        @function "invoke, execute, summon, unfold"
        @subject "Meme|ExternalResource"
        @target "TARGET|TARGET?|?; a Renderer/Template, and/or ?"
        @mode "active"

        ## Kahea (Hawaiian)

        Living transclusion. This action transforms a static reference into an active, breathing stream of data. Kahea activates process rather than representing it, so active invocation requires explicit or inherited kapu, especially for tools, memory writes, external retrieval, and public emission.

        In Tiddlywiki and other 

        <<~ ala lar:///ha.ka.ba/kahea >>
    >>

    <<~ kahea Signals -> Context >>
    <<~ kahea Context -> Vocabulary >>
<<~/ ahu #orient >>

<<~ ahu #decide
    @name "memetic-wikitext-phase-decide"
    @description "Decide phase of OODA-HA loop."
    @role "selection and commitment"
    @function "evaluate, branch, choose"
    @input "structured context"
    @output "intent"

    ## Decide phase (3)

    Hawaiian:
    Maps to the Season of Confusion.
    A worksite for selecting interpretation and execution paths.
    <<~ ala lar:///ha.ka.ba/decide >>
>>
    <<~ kahea Context -> Decision >>
    <<~ kahea Decision -> Procedure >>
    <<~ kahea Decision -> ? >>
<<~/ ahu #decide >>

<<~ ahu #act
    @name "memetic-wikitext-phase-act"
    @description "Act phase of OODA-HA loop."
    @role "execution"
    @function "apply, transform, emit"
    @input "intent"
    @output "effect"

    ## Act phase (4)
    
    Maps to the Season of Bureaucracy.
    A worksite for action, execution, rendering, and invocation.
    <<~ ala lar:///ha.ka.ba/act >>
>>
    <<~ ahu #transclusion-modes
        @name "memetic-wikitext-transclusion-modes"
        @description "Defines passive vs active inclusion behaviors." 
    >>
    <<~ kahea PassiveExample 
        <<~ aka meme|data >>
    -> Example >>

    <<~ kahea PassiveTemplateExample
        <<~ aka meme|data -> template|template?|? >>
     -> Example >>

    <<~ kahea ActiveExample
        <<~ kahea meme|data >>
     -> Example >>

    <<~ kahea ActiveTemplateExample
        <<~ kahea meme|data -> template|template?|? >>
     -> Example >>

    <<~ ahu #governed-enactment
        @name "memetic-wikitext-#governed-enactment"
        @description "Defines passive vs active inclusion behaviors." 
    >>

    - aka under read-only local kapu
    - kahea under bounded tool kapu.

    <<~ kahea Decision -> Action >>
    <<~ kahea Action -> Renderer >>
    <<~ kahea Entity -> Renderer >>
<<~/ ahu #act >>


<<~ ahu #aftermath
    @name "memetic-wikitext-phase-aftermath"
    @description "Aftermath phase of OODA-HA loop."
    @role "evaluation and aftermath"
    @function "measure, verify, reflect"
    @input "effect"
    @output "status, feedback"

    ### Aftermath phase (5)

    <<~ ala lar:///ha.ka.ba/aftermath >>
    Hawaiian: "Paka" - criticize constructively.
    Maps to the Season of The Aftermath.
    A worksite for evaluation, verification, and aftermath.
    
    <<~ kahea Action -> Result >>
    <<~ kahea Result -> ? >>
>>

    <<~ ahu #recursion 
        @name "memetic-wikitext-recursion"
        @description "Recursive re-entry. Outputs feed future observations."
        @role "recursion and self-invocation"
        @function "?"
        @input "meme"
        @output "memetic observation"

        ### Recursion

        <<~ ala lar:///ha.ka.ba/recursion >>
        [Each meme execution becomes new observation.]

        <<~ kahea OODA-HA -> OODA-HA >>
        <<~ kahea memetic-wikitext -> memetic-wikitext >>
    >>
<<~/ ahu #aftermath >>

<<~&#x0003; ahu #body-close

    ## Body closing
    
    Ends the active stream.
>>

<<~&#x0004; -> ahu #result
    @name "memetic-wikitext-result"
    @status "completed|partial|deferred|failed|recursive|aborted|?"
    @confidence "0.0-1.0|?"
    @yield "meme|data|signal|noise|artifact|?"
    @final-hash "sha256:..."
    @duration "self-measured"
    @result "payload-address|payload-object|?"
    @return "render|store|emit|recurse|invoke|defer|abort|?"
    @upward-context "parent|caller|chat|ui|memory|graph|?"
    @downward-context "none|ooda-ha|subloop|renderer|?"
    @recurse "true|false|conditional|?"
    @recursion-depth "0-n|?"
    @residue "trace|burden|warning|surplus|drift|?"
    @next-observation "lar:///...|?"
    @next-question "?|lar:///...|none"

    <<~ ahu #feedback
        @name "memetic-wikitext-feedback"
        @role "fifth turn, packaging residue and re-entry"
        @function "evaluate, route, recurse, contextualize"
        @input "effect, status, feedback, residue"
        @output "upward return and/or recursive feed"

        <<~ ahu #feed
            @subject "result|payload|trace|residue|warnings|errors|?"
            @into "ooda-ha"
            @params "source:result; mode:aftermath; scope:local|session|graph|?"
            @filters "yield:meme|data|signal; confidence>=0.6; noise<0.4|?"
            @multitude "one|many|stream|bundle|?"
        >>

        <<~ ahu #route
            @upward "caller|parent|chat|ui|memory|graph|?"
            @downward "observe|orient|decide|act|Aftermath|ooda-ha|?"
            @merge "append|replace|overlay|transclude|?"
        >>

        <<~ ahu #kapu
            @role "shadow boundary, taboo, guard, quarantine"
            @function "block, veil, delay, sandbox, mark sacred/unsafe"
            @gates "side-effects|external-calls|recursion-depth|public-render|?"
            @condition "trust|permission|confidence|ritual-clearance|?"
        >>

        <<~ kahea ooda-ha
            source:<<~ aka #result >>
            phase:aftermath
            feed:payload trace residue
            filters:yield[[meme data signal]] confidence:>=0.6 noise:<0.4
            route:upward[[parent]] downward[[observe]]
            recurse:conditional
            kapu:side-effects[[blocked]] public-render[[allowed]]
        -> ? >>
    >>

    <<~ ala lar:///ha.ka.ba/result >>
-> ? >>