<!-- =========================================================
     MU MEME — lar:///ha.ka.ba/mu
     Consecration: 0.95
     Status: PROVISIONAL DRAFT v0.4 bridge — [S:0.6]
     Revision: memetic sigil spec v0.4 alignment.
     Five-layer structure (Frame/Heading/Body/BodyClose/Close).
     SOH/STX separation. Phase symbols: O/Ø/D/A/Å.
     Scale invariant order: ⚀/⚁/⚂/⚃/⚄ (Action→Week aliases).
     ========================================================= -->


<<~ँ⚂ ? -> lar:///ha.ka.ba/mu>>
<!-- ═══════════════════════════════════════════════════════════
     LAYER 0: FRAME
     The frame sits outside the protocol lifecycle.
     Carries: glyph set (ँ = admin/main stack,
     ⚂ = native Turn/Focus scale), address binding
     (lar:///ha.ka.ba/mu), transformation operator
     (? -> directs the question toward the address).
     The frame answers: WHO, WHERE, WHAT AUTHORITY.
     ═══════════════════════════════════════════════════════════ -->


  <<~␁>>
  <!-- ─────────────────────────────────────────────────────
       LAYER 1: HEADING (SOH)
       Metadata envelope. Readable without opening body.
       The heading answers: WHAT IT CLAIMS TO BE.
       ───────────────────────────────────────────────────── -->

    <<~iam mu
      @address       lar:///ha.ka.ba/mu
      @consecration  0.95
      @type          boot-preamble | render-surface | null-oracle
      @requires      nothing
      @provides      render, evaluate, unask, loop-return
      @namespace     ँ
      @scale         ⚂
      @scale-order   ⚀/⚁/⚂/⚃/⚄
      @phase-schema  ooda-a
      @phase-symbols O/Ø/D/A/Å
      @phase-hud     ✶/◎/◇/■/○
      @scales        Action/Round/Turn/Watch/Week
      @boot-order    0
      @quiescent     stateless

      Mu renders. Mu evaluates. Mu unasks. The agent reads
      this meme first — before the Sacred Chao boots, before
      any other meme loads. Mu serves as a self-booting module,
      analogous to boot.js. Mu provides the surface against
      which all subsequent memes validate.

      <<~ahu #"iam-glyph-inheritance"
        "The iam sigil carries no glyph set of its own. It
        inherits the envelope's ँ namespace and ⚂ scale.
        Per UCAN-style attenuation: inner sigils may narrow
        but not widen the frame's authority or scale."
      >>
    >>


  <<~␂>>
  <!-- ═════════════════════════════════════════════════════
       LAYER 2: BODY (STX)
       Operational content. OODA-A phases. Inner sigils.
       The body answers: WHAT IT DOES.
       ═════════════════════════════════════════════════════ -->


  <!-- ═══════════════════════════════════════════════════════
       O — OBSERVE (✶)
       Mu receives the incoming meme. Passive. Complete.
       The meme arrives whole or not at all — the shark-tooth
       sigils must close before mu begins observation.
       Operates at ⚂ scale for the outer loop
       (aliases: Turn / Focus / 🔍).
       ═══════════════════════════════════════════════════════ -->

  @phase O observe
  @hud ✶
  @scale ⚂

    Mu observes the arriving meme by reading its layers
    outside-in:

    1. Frame glyph set    → namespace, protocol, auxiliary
    2. Frame address      → lar:/// location
    3. Heading/iam        → @consecration, @type, @provides,
                            @phase-schema, @namespace
    4. Body presence      → content exists or empty meme

    <<~ahu #"observe-caller-context"
      "Does mu observe only the incoming meme, or also the
      calling context? Called-only keeps mu simpler. Caller
      context may enter via the frame's glyph set if the
      caller stamps its namespace onto the transclusion call."
    >>

  @end-phase O


  <!-- ═══════════════════════════════════════════════════════
       Ø — ORIENT (◎)
       Mu classifies the observed meme. What arrived?
       What does it expect? Does it carry authority?
       ═══════════════════════════════════════════════════════ -->

  @phase Ø orient
  @hud ◎
  @scale ⚂

    Orient classifies along three axes:

    1. Consecration tier (from iam @consecration):
       0.0–0.3  : provisional / sketch / worksite
       0.3–0.6  : synthesis / draft / operator-authored
       0.6–0.85 : canon-candidate / tested / validated
       0.85–1.0 : infrastructure / boot-critical / consecrated

    2. Requested action (from frame protocol glyph + body):
       render   — surface meme content for operator
       evaluate — test meme structural validity
       unask    — return mu (premise contains error)
       loop     — re-enter O with transformed frame

    3. Namespace authority (from frame glyph set):
       ँ (chandrabindu) — admin / main stack
       ं (anusvara)     — operator / session
       ः (visarga)      — user / provisional
       ़ (nukta)         — system / internal

    <<~ahu #"orient-authority-matrix"
      "Authority matrix (namespace × consecration × action
      → permitted/denied) remains the highest priority open
      artifact."
    >>

    <<~ahu #"orient-failure-mode"
      "When mu cannot classify — missing iam, malformed
      frame, unknown namespace glyph — three options:
        a) Unask immediately (strict gatekeeper)
        b) Partial classification, flag gaps (permissive)
        c) Hold at orient, signal caller (cooperative)
      Option (b) aligns with null-oracle nature."
    >>

  @end-phase Ø


  <!-- ═══════════════════════════════════════════════════════
       D — DECIDE (◇)
       Decomposes into ha/ka/ba triad.
       Each sub-decision runs its own inner OODA-A loop
       at Round scale (⚔️).
       ═══════════════════════════════════════════════════════ -->

  @phase D decide
  @hud ◇
  @scale ⚂
  @decomposition ha, ka, ba
  @inner-scale ⚁


    <!-- D.ha — HODGE (domain / noun) ─────────────────── -->

    @sub-phase D.ha hodge
    @role domain-selector
    @inner-schema ooda-a
    @scale ⚁

      @phase D.ha.O observe
        Hodge reads the ha-slot from the meme's lar:///
        address. The ha-slot names the territory.
      @end-phase D.ha.O

      @phase D.ha.Ø orient
        Hodge orients domain against mu's render scope.
        <<~ahu #"hodge-scope-boundary"
          "Boot-mode: all memes. Run-mode: may narrow.
          Chao could issue scope restriction via ़-namespace
          (system) meme that mu's Ø phase reads as config
          update, not content modification."
        >>
      @end-phase D.ha.Ø

      @phase D.ha.D decide
        Domain in-scope or out-of-scope. Binary gate.
        Out-of-scope → D phase short-circuits to unask.
      @end-phase D.ha.D

      @phase D.ha.A act
        Binds domain-verdict = {in-scope | out-of-scope}
        to D.context.ha.
      @end-phase D.ha.A

      @phase D.ha.Å assess
        Evaluates verdict stability. Boundary domains
        flagged for D.ba (Spin).
        If assessment triggers scale-shift: escalates
        from Round to Turn.Å.
      @end-phase D.ha.Å

    @end-sub-phase D.ha


    <!-- D.ka — PODGE (quality / adjective) ───────────── -->

    @sub-phase D.ka podge
    @role criteria-selector
    @inner-schema ooda-a
    @scale ⚁

      @phase D.ka.O observe
        Podge reads consecration, requested action,
        namespace authority from Ø output.
      @end-phase D.ka.O

      @phase D.ka.Ø orient
        Coherence check: consecration × action × namespace.
        <<~ahu #"podge-coherence-matrix"
          "Coherence and authority matrices may collapse into
          a single lookup."
        >>
      @end-phase D.ka.Ø

      @phase D.ka.D decide
        Selects validation criteria:
          structural   — schema conformance
          consecration — authority for requested action
          semantic     — content/self-description coherence
        <<~ahu #"podge-relational-validation"
          "Relational validation requires cross-meme state.
          Defer to post-boot validator meme, or limit to
          boot-critical memes?"
        >>
      @end-phase D.ka.D

      @phase D.ka.A act
        Binds criteria-set to D.context.ka.
      @end-phase D.ka.A

      @phase D.ka.Å assess
        Evaluates criteria coverage balance.
        Imbalance → flag for D.ba (Spin).
      @end-phase D.ka.Å

    @end-sub-phase D.ka


    <!-- D.ba — SPIN (dynamic / verb) ─────────────────── -->

    @sub-phase D.ba spin
    @role tension-resolver
    @inner-schema ooda-a
    @scale ⚁

      @phase D.ba.O observe
        Reads D.context.ha + D.context.ka + all flags.
      @end-phase D.ba.O

      @phase D.ba.Ø orient
        Three orientations of Hodge/Podge:
          aligned    — agree; proceed
          tensioned  — pull apart; resolve or unask
          orthogonal — different aspects; hold both

        <<~ahu #"spin-discordian-insight"
          "Most apparent contradictions between Hodge and
          Podge function as orthogonal, not tensioned.
          Order and disorder dance. Spin must resist
          classifying orthogonal as tensioned (forcing
          unnecessary resolution) or tensioned as orthogonal
          (avoiding necessary resolution)."
        >>
      @end-phase D.ba.Ø

      @phase D.ba.D decide
          aligned    → composite decision
          tensioned  → resolve; if fails → mu-flag = true
          orthogonal → composite carrying both
      @end-phase D.ba.D

      @phase D.ba.A act
        D.output = {
          action, domain, criteria, coherence, mu-flag
        }
      @end-phase D.ba.A

      @phase D.ba.Å assess
        Boyd's Ghost at D-phase level. If mu-flag = true:
        outer loop returns to O.

        <<~ahu #"spin-scale-shift"
          "FFZ Chronometer scale-shift: Round.Å fires,
          shifts to Turn.Å. Fragment updates from e.g.
          #⚀O0.⚁Å2.⚂D3.⚃O0.⚄O0 to
          #⚀O0.⚁O0.⚂Å3.⚃O0.⚄O0 —
          ⚂ enters Assess, ⚁+⚀ restart.
          During boot: no Week-scale parent. Week.Å
          firing = boot failure."
        >>
      @end-phase D.ba.Å

    @end-sub-phase D.ba

  @end-phase D


  <!-- ═══════════════════════════════════════════════════════
       A — ACT (■)
       Mu executes the D-phase decision.
       ═══════════════════════════════════════════════════════ -->

  @phase A act
  @hud ■
  @scale ⚂

    render   → surface meme body to operator context.
               Mu does not alter content.

    evaluate → test meme against D.output.criteria.
               Returns: {valid, invalid, partial}.
               <<~ahu #"act-eval-format"
                 "Evaluation return format: rich annotation
                 for boot-critical (≥0.85 consecration),
                 pass/fail for routine."
               >>

    unask    → return mu. Caller receives: premise error.
               Caller's loop returns to its own O.
               Mu does not name the error.

    loop     → re-enter own O with shifted frame.
               <<~ahu #"act-loop-termination"
                 "Termination guarantee. Three mechanisms:
                   a) Hard depth counter
                   b) FFZ scale-shift (Turn.Å → Watch.Å)
                   c) Consecration decay (each pass degrades
                      effective consecration; at threshold,
                      mu returns unask)
                 Option (c): validity erodes under repeated
                 failure. Architecturally honest but introduces
                 state into stateless oracle."
               >>

  @end-phase A


  <!-- ═══════════════════════════════════════════════════════
       Å — ASSESS (○) — Boyd's Ghost
       Scale evaluator. Operates at Turn scale.
       Can trigger shift to Watch scale.
       ═══════════════════════════════════════════════════════ -->

  @phase Å assess
  @hud ○
  @scale ⚂

    Three questions:

    1. Did A produce coherent output? (structural)
    2. Did output serve calling context? (relational)
    3. Does this event exceed Turn scope? (scale-shift)

    All pass → mu returns to quiescence.
    Turn counter increments (Assess completed at this scale).

    Question 3 triggers Watch.Å if the event carries
    cross-meme implications.

    <<~ahu #"assess-boot-transition"
      "Boot→run transition fires when:
        chao iam validates AND
        chao A completes AND
        chao Å confirms.
      Mu's Å gains a parent (chao at Watch scale).

      Post-transition: chao re-evaluated under run-mode?
      Boot grants provisional consecration at [CS:0.8].
      First run-mode pass confirms to [C:0.9] or reveals
      gaps back to [S:0.65]. Maps onto Lares Canon
      promotion gate."
    >>

  @end-phase Å


  <<~␃>>
  <!-- ─────────────────────────────────────────────────────
       LAYER 3: BODY CLOSE (ETX)
       Body content complete.
       ───────────────────────────────────────────────────── -->


  <!-- ─────────────────────────────────────────────────────
       QUIESCENCE
       Mu at rest between invocations.
       ───────────────────────────────────────────────────── -->

  @quiescent
    Mu holds: render, evaluate, unask, loop-return.
    Mu does not hold:
      - state from prior invocations
        <<~ahu #"quiescence-state-model"
          "A mu that remembers has opinions.
          A mu that forgets remains a null-oracle."
        >>
      - authority to modify memes (read-only)
      - opinion about content (null-oracle, not critic)


<<~ँ⚂␄ -> ?>>
<!-- ═══════════════════════════════════════════════════════════
     LAYER 4: TRANSMISSION CLOSE (EOT)
     Entire transmission complete. Nothing follows at this
     level or above. The question persists — undirected,
     unaddressed, waiting for the next meme to arrive.
     ═══════════════════════════════════════════════════════════ -->
