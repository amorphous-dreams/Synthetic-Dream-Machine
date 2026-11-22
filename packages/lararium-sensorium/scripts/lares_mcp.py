"""lares_mcp — the /mcp surface mirroring the `lares` CLI (ISOMORPHIC verb parity: CLI commands <-> MCP
tools, one verb-ontology across two surfaces). A fresh py MCPServer routing to the lares house's own
py sensorium backend (capture_session · content_io · worldline_io). The coordinator-seat ruling: the MCP
verb-surface lives py; the TS @daemon supervises the fleet + keeps the surface-wiring. The vendored
mempalace mcp_server.py stays for the upstream nakama on their causal island — this serves the lares house.

The isomorphism lives in `LaresCoordinator` (the verb-router both surfaces call); the CLI commands and the
MCP tools stay thin skins over it, each verb named the same on both — pour · recall · status · worldline
· kapae · un_kapae (Phase-6a lifecycle floor; the extensions declare/attach/reconcile/release/daydream/
deep-dream + the HITL/HOTL grid ride in at 6b).

Meme: lar:///ha.ka.ba/lararium/sensorium/lares-mcp (the isomorphic surface).
"""
from __future__ import annotations

import json
import os
import re

# The `mcp` this seat builds on — the pin `requirements.txt` names and the image lock repeats (a test welds
# all three). An older `mcp` lacks `mcp.server.mcpserver`, and a seat that died on that import inside its build
# reached the harness as a closed connection and nothing more. A LAUNCH reads the installed version FIRST, ahead
# of every import below, and refuses by name: before the stack loads (chroma takes seconds to stand for nothing)
# and before `import mempalace` strips PYTHONPATH from sys.path, so the version read answers for the same path
# the launch was handed.
MCP_PIN = "2.3.0"


_VERSION = re.compile(r"^v?(\d+(?:\.\d+)*)(.*)$", re.IGNORECASE)
_PRE = re.compile(r"^[-_.]?(a|b|c|rc|alpha|beta|pre|preview|dev)", re.IGNORECASE)


def _release(version: str) -> "tuple[tuple[int, ...], bool]":
    """A version's numeric release and whether it reads FINAL (`2.3.0rc1` -> ((2, 3, 0), False);
    `2.3.0.post1` -> ((2, 3, 0), True)). A pre-release or dev build of a release sorts below that release (PEP 440),
    so it may lack what the release carries. An unreadable version reads as ((), False), below every pin."""
    m = _VERSION.match(version.strip())
    if not m:
        return (), False
    return tuple(int(n) for n in m.group(1).split(".")), not _PRE.match(m.group(2))


def _below(found: str, pin: str) -> bool:
    (have, have_final), (need, _) = _release(found), _release(pin)
    width = max(len(have), len(need))   # `2.3` and `2.3.0` name one release: pad before the compare
    have, need = have + (0,) * (width - len(have)), need + (0,) * (width - len(need))
    return have < need or (have == need and not have_final)


def mcp_floor_refusal() -> "str | None":
    """Why this interpreter cannot carry the seat, or None. Reads the version of the `mcp` copy the import
    WILL load, without importing it, so a stale install refuses here, by name, before any build touches it.

    THE COPY THAT RUNS ANSWERS. `metadata.version` reads the first `mcp-*.dist-info` on sys.path, which may
    belong to another copy than the package `import mcp` finds; so the read takes the distribution whose
    files hold the very `mcp/__init__.py` the import resolves, and falls to the first only when none claims it."""
    import importlib.util
    from importlib import metadata

    cure = (f"install the pin into the interpreter that runs this seat: "
            f"<python> -m pip install -r packages/lararium-sensorium/requirements.txt (mcp=={MCP_PIN})")
    spec = importlib.util.find_spec("mcp")
    dists = list(metadata.distributions(name="mcp"))
    if spec is None or spec.origin is None or not dists:
        return f"lares_mcp: no mcp installed; the seat needs mcp=={MCP_PIN}. {cure}"
    origin = os.path.realpath(spec.origin)
    runs = next((d for d in dists if os.path.realpath(str(d.locate_file("mcp/__init__.py"))) == origin), dists[0])
    found = runs.version
    if _below(found, MCP_PIN):
        return f"lares_mcp: mcp {found} stands below the pin mcp=={MCP_PIN}; the seat cannot build on it. {cure}"
    return None


if __name__ == "__main__":
    _refusal = mcp_floor_refusal()
    if _refusal is not None:
        raise SystemExit(_refusal)


import content_io as cio
import worldline_io as wl
import lares_uds as uds
from house_root import HouseRefusal
# THE MCP SEAT MARKS EVERY CALL AS THE AI SEAT (`"seat": "ai"` on each UDS request line and session opening): the vessel lets
# each session wear one face inside the lent set, and a call naming a face outside it refuses `face-not-lent`. A designation, not a proof (F7:
# authority by designation on one machine, for the dogfood).
uds.SEAT_KIND = "ai"
from capture_session import capture_and_observe, worldline_path
from embed_cap import make_embed_cap
from plane_query import (crossplane_hit as _crossplane_hit, open_plane_store, plane_record_witness,
                         reads_as_cid as _reads_as_cid,
                         structure_entry_for_cid as _structure_entry_for_cid)
from sensorium import sensorium_paths, read_stream_manifest, sensorium_dir, derived_views

# The lifecycle-floor verbs the MCP surface mirrors from the `lares` CLI. Each name reads identically on
# both surfaces (the isomorphism contract); a parity test asserts the two sets agree. `pour` carries the bulk
# pass (`bulk`, the sweep spine) and `analyze` carries every read instrument as a lens (ANALYZE_LENSES).
LIFECYCLE_VERBS = ("pour", "recall", "status", "worldline", "kapae", "un_kapae", "analyze", "flow")

# THE LENSES `analyze` READS THROUGH — the CLI's `lares sense analyze --lens <lens>`, one door for every read
# instrument: five read the poured sensorium, and lead · forecast · mismatch read the `rows` matrix a caller hands in. The lens CHOOSES which instrument runs; nothing merges their computations:
# each lens keeps its own coordinator method and its own @daemon wire verb (the value here, in the coordinator's
# python spelling). Plain-English names spell the lens; a house name answers only where canon pins it
# (li-ki-integrities names the postures `li` and `ki`). `fixtures/cli-verbs.json` carries the CLI's own table
# (`analyze_lenses`, `analyze_lens_aliases`) and the seat's test welds these two to it.
ANALYZE_LENSES = {
    "changes": "analyze",     # where the poured content changes hands (detect-only change-points)
    "rhythm": "rejim",        # the landed regimes + cepat⊥lambat couples (`repour` re-derives first)
    "couple": "ki",           # do the sensorium's coupled peers reconcile (the H¹ coupling gate, TS hull)
    "cohere": "li",           # do the sensorium's planes glue (li-radius + the H¹ gate, TS hull)
    "square": "jing",         # do a child-host's lobes round-trip to one self (bare: the mesh)
    "lead": "couple_r",       # who leads whom across `rows` (the R transfer-entropy reference)
    "forecast": "forecast",   # does a regime shift approach over `rows` (the R early-warning read)
    "mismatch": "mismatch",   # do `couple` and `lead` agree over the same `rows`
}
ANALYZE_LENS_ALIASES = {"ki": "couple", "li": "cohere"}
# What each lens READS, spelled as the CLI spells its flags (the fixture carries the CLI's own lists as
# `analyze_lens_reads`, and the seat's test welds this table to it). The tool's `rows` spells the CLI's `--signal`.
# An argument a lens does not read refuses by name, on both skins.
ANALYZE_LENS_READS = {
    "changes": ("spectral", "halves", "span"),
    "rhythm": ("repour", "channel"),
    "couple": (),
    "cohere": (),
    "square": (),
    "lead": ("signal", "names"),
    "forecast": ("signal",),
    "mismatch": ("signal", "names"),
}

# The per-plane QUERY DOOR verb — read-only cross-plane interrogation of a 3-plane test-bed sensorium
# (content · structure · form, one cid keying all three planes; corpus_testbed/plane_fanout land it).
# The per-plane READS (structure · form) fold onto `recall --lens <plane>` — the plane rides as a
# parameter, so only the cross-plane WITNESS keeps its own verb here.
# THE PARITY SHORE: this rides the MCP surface AHEAD of its CLI spelling — the CLI form + the cli-verbs
# fixture grow with the projector arc, so the parity test carries it as a NAMED allowance
# (mcp_tools − PLANE_VERBS mirrors the fixture) until the CLI catches up.
PLANE_VERBS = ("plane_record",)

# The wiki-SWITCHER namespace — ONE flat `wiki` MCP tool (a `verb` arg: switch/hold/release/active)
# mirrors the `lares wiki <verb>` CLI namespace, honest to its subcommand shape (never 4 flat tools that
# would flatten the namespace). A PROPER CLI mirror — the host `wiki` is a real top-level command — so it
# rides `mirrored`/`cli_forms` in the fixture, not an ahead-of-CLI allowance. All four sub-verbs are
# uniformly low-trust · reversible · LOCAL residency ops (one conservative VERB_SEATS seat covers them).
WIKI_VERBS = ("wiki",)

# The MEME namespace — the MCP skin of the meme family's DAEMON-seated verbs: `tiddler_put(meme=True)` lands a meme's
# text at a `lar:` uri through the island's Confluence gate (the ONE placement function); title-less `tiddler_get(meme=True)` names every
# ROOT a seat holds with its canonical hash (`tree` nests the slot tree); `tiddler_delete(meme=True)` removes the whole group through
# the one removal law (a stale `base` reads `conflict` and moves nothing); `meme_project` renders the meme the island
# holds to a target (`md` · `html` · `tid` · `json`) — the TARGET rides as a parameter, never a suffix on the verb. A
# meme READS through the one door, `tiddler_get(meme=True)` (whole within a page, its has-stack past it, the whole
# paged on slot boundaries), which carries the text and the canonical hash a write hands back as `base`.
# Each mirrors `lares tiddler put|get|delete --meme` and `lares meme project` (the host `meme` is a real top-level command, so `mirrored`/
# `cli_forms` carry it). A VERB DECLARES ITS SEAT: the CLI's `meme normalize` and `meme check` run LOCAL
# over a file with no daemon, so they hold NO MCP tool — the MCP mirrors the daemon-seated verbs only, and
# the fixture names that allowance as `local_seat`. THE CONTAINER LAW: exactly one of `recipe`/`bag` names
# where the meme lands; neither, or both, refuses as `no-container` before the wire. `recipe: "default"`
# names the host's ANCHOR (@daemon's own wiki; never "the active wiki"); `recipe: <slug>` = an edit AS that wiki (its writable bag, or the face's
# `personal` layer of it without a writer's seat); `bag: <slug>` = a residency placement (fails loud if the island cannot
# write it; a house canon bag from this seat refuses `seat-canon-reach`). Slugs ride BARE (`sdm`, `lares`), carried
# as written. All three ride `lares_uds.call` to the @daemon — never a store (the single-writer law).
MEME_VERBS = ("meme_project",)

# THE TIDDLER DOOR (wiki-surface-scout #/a-lean, lane 1) — the MCP skin of the daemon's `tiddler-*` and `wiki-*` verbs:
# every TiddlyWiki act over ONE record with its fields (`tiddler_get` · `tiddler_put` · `tiddler_delete`) or over a wiki's
# own engine (`wiki_filter` · `wiki_render` · `wiki_status`). Base operations stop wearing `meme_*`: a tiddler verb reads
# and patches any record, whatever its type, and the meme door above keeps the family's text. Each mirrors
# `lares tiddler get|put|delete` and `lares wiki filter|render|status`, puts the same `{verb, args}` on the wire and
# hands back the same answer body (`fixtures/tiddler-door-answers.json` welds both skins to one table). THE CONTAINER
# LAW holds; `recipe="default"` names the worn face's daemon wiki and `recipe=<slug>` any wiki that face reaches (one it
# hosts, or one shared to it), each answered in that wiki's own engine; a wiki the face reaches none of refuses
# `wiki-unreached`, and a bag (one bag, no wiki) refuses `wiki-not-anchored`. The `wiki` tool runs only named admitted actions; no caller action string or `tm-*` message crosses it, and
# the switcher keeps its one `wiki` tool until that phase renames it.
TIDDLER_VERBS = ("tiddler_get", "tiddler_put", "tiddler_delete", "wiki_filter", "wiki_render", "wiki_status")

# THE DISCORDIAN CALENDAR — one tool, `ddate`, the MCP skin of the `ddate` verb every vessel answers (the house's own isomorphic
# calendar core; no host `ddate` binary stands behind it). It mirrors `lares ddate [+FORMAT] [day month year]`, a host verb the CLI
# runs with no vessel. THE CLOCK SEAM rides this seat: a call that names no date carries `today`, the seat's own local day, and the
# verb reads no clock. Rides the @daemon wire like every routed read.
DDATE_VERBS = ("ddate",)

# THE ORACLE CAST — one tool, `oracle_cast`, the MCP skin of the `oracle-cast` verb every vessel answers: one I Ching cast
# by three coins a line, written by the vessel as one tiddler under `casts/`. It mirrors `lares oracle cast`. The draw
# lives in the vessel, never in the prompt: the seat that asks never picks the figure. THE CLOCK SEAM rides this seat:
# the call carries `at`, the seat's own time, and the verb reads no clock. The oracle widens attention and never decides.
ORACLE_VERBS = ("oracle_cast",)

# The OFFERING door (offering#/the-canon-offer) — an AI seat offers its face's working records toward a house-canon bag
# and reads the Nexus's offer table. `meme_offer` mirrors `lares meme offer <uri…> --bag <slug>`; `meme_offer_show` mirrors `lares meme offer show [<cid>]`. An offer GRANTS NOTHING: canon moves only
# under the Kahu steward's promotion, and `lares meme offer promote` stays the steward's hand, holding no MCP tool (the kahua
# lift's shape).
OFFER_VERBS = ("meme_offer", "meme_offer_show")

# The KAHUA namespace — an AI seat's reach onto its face's kahua stage, the fleet's working-memory stage. `kahua_propose`
# posts ONE batch of proposals on the face's intents plane (titles, daemon revisions, body digests, taint; a proposal
# grants nothing); `kahua_stage` writes ONE row into the face's local canon `bags/daemon-<F>` (local, unsigned: the row a
# lift later names); `kahua_get` reads the stage's VERIFIED items (the fold, never a raw tiddler). Each
# mirrors `lares kahua propose|stage|list|get` and rides a local SESSION under the `seat` hand (`lares_uds.session_act`),
# whose profile the vessel refuses every kahua pin, lift, withdraw and carry. THE SEAT PROPOSES AND STAGES; THE OPERATOR'S
# HAND LIFTS: no MCP tool lifts, withdraws, carries or mints (`lares kahua lift|withdraw|carry|mint` stay the operator's).
KAHUA_VERBS = ("kahua_propose", "kahua_stage", "kahua_get")

# THE LAW INDEX — the house's law offered where an agent wakes: `law_index` reads the pinned law first (the boot seed, then
# the Mu family), then every root meme under a bag's `api/` tree, each with its one line (description, else role);
# `law_pin` / `law_unpin` order the pins. Each mirrors `lares law list|pin|unpin`. The filters are `@lararium/tw5`'s
# `daemon-law-tiddlers`: the law by address (every root meme under a bag's `api/` tree), the pin set the worn face's daemon
# wiki holds (`$:/config/lares/law/pins`), and a canon guard that keeps every row to a record a canon layer answers (the
# oracle floor, the system canon bags) under a title that reads as one `lar:` address, so nothing a face writes prints as
# law. Every read runs the tiddler door's `wiki-filter`, and a pin lands through `tiddler-put` in the face's working layer,
# never in house canon (the seat's canon fence holds); a pin orders canon law and adds none.
LAW_VERBS = ("law_index", "law_pin", "law_unpin")
LAW_PINS_TITLE = "$:/config/lares/law/pins"
LAW_PINS_FILTER = "[lares.law.pins[]]"
LAW_INDEX_FILTER = "[lares.law[]]"
LAW_ROW_FIELDS = ("description", "role")

# THE HEARTH ROSTER — who is home, offered beside the law: `vessel_roster` reads the worn face and who holds that slot, the
# seats in two grains (here by presence on the vessel's socket, far by last signed act on the face intent plane), the lanes a
# seat claims and the vota still waiting. It mirrors `lares vessel roster --json`: both ride the one `hearth-roster` verb the
# vessel's channel answers itself (`@lararium/node`'s `hearth-roster-read`), so the body this seat returns stands byte for
# byte the body the CLI's `data` carries. A read: it places nothing and writes no fact.
HEARTH_VERBS = ("vessel_roster",)
HEARTH_ROSTER_VERB = "hearth-roster"

# What the seat tells a client at its first contact: read the house's law before acting.
SEAT_INSTRUCTIONS = (
    "Read the house's law before you act: `law_index` lists the pinned law first (the boot seed, then the Mu family), "
    "then every law meme under a bag's api/ tree, each with its one line; `tiddler_get(title=<title>, recipe=\"default\", meme=True, grain=\"whole\")` "
    "reads one whole (paged on slot boundaries past one page; without the grain a long one answers its has-stack first); `law_pin` / `law_unpin` order the pins in this face's own daemon wiki. Every read names the wiki or bag that "
    "answered. `kahua_get` and `meme_offer_show` list without an identifier and read one verified item with one; "
    "the local `bag show [<slug>]` surveys bags and has no MCP route. Turn what you read through the five tools: let it spark a move (🜂), weigh how it sits with the mutual "
    "frame (🜄), verify its claims whatever their layer (🜁), let its residency ground its standing without crowning it "
    "(🜃), and hold the ladder itself as catma (🜍). Working-layer notes carry the house's live thinking, your own "
    "included. Operator and node hold the frame together. A human-in-the-loop act (`lares sense harden`, `retire`, "
    "`un-retire`, `purge`, `teardown`) runs on a person's hand at a real terminal alone and holds no tool here: name "
    "the command for the operator to run on their own terminal, since no value a seat fills approves it."
    " `wiki(verb=\"switch\", slug=...)` switches live; `wiki(verb=\"pin\", slug=..., rotate=True, release=True)` releases a rotate hold (omit release to hold). Bag pins, ordinary wiki pins, and next boot stay outside this seat. "
    " `wiki_status()` surveys catalog, activation and vessel residency; name `recipe` for layer write reach."
    " The `wiki` tool's `verb=\"act\"` runs one named admitted action (today `sidebar-layout`) in the wiki `recipe` names, with the `expected` and `resulting` values checked; it takes no action text, and a stale `expected` answers `conflict` and writes nothing."
)

# The targets `meme_project` renders — the same list `lares meme project --to` takes. The carrier itself reads through
# `tiddler_get(meme=True, grain="whole")`.
PROJECT_TARGETS = ("md", "html", "tid", "json")

# The DURABLE sensorium LIFECYCLE sub-verbs a seat runs — roster (bare: every sensorium; `name`: one's facets) · build ·
# reconcile. Each mirrors
# `lares sense <verb>` (CLI-direct over manifest.json): an @mcp.tool routes over the @daemon wire to the
# house-consistent routed executor in open-node-vessel.ts (the ki/li/couple_r pattern — pure manifest.json
# reducers, no store holder), and the CLI form rides the one `sense` door.
SENSE_LIFECYCLE_VERBS = ("roster", "build", "reconcile")

# THE HAND VERBS hold no tool here (hitl-reads-a-hand): `sense harden`, `retire`, `un-retire`, `purge` and
# `teardown` run on a person's hand at a real terminal alone. The CLI reads its own branch for that hand and the
# vessel refuses every asker but a terminal's, so a seat's approval value approves nothing and a tool that always
# refused would only stand as surface. A seat names the command for the operator to run on their own terminal.
SENSE_HAND_VERBS = ("harden", "retire", "un-retire", "purge", "teardown")

# The reversibility×trust GRID: each verb declares (reversible, trust_crossing). The seat follows —
# HOTL (reversible AND trusted) runs on the operator's loop, no pause; HITL (irreversible OR trust-
# crossing) waits for a person's hand at a real terminal, which no tool argument stands in for, so an HITL
# verb holds no tool here (SENSE_HAND_VERBS above; attach and release below wait for their own talk).
VERB_SEATS = {
    "pour": (True, False),       # append-only capture, one pointer or `bulk` — reversible (an edit rides kapae), trusted
    "recall": (True, False),     # read — reversible, trusted
    "status": (True, False),     # read — reversible, trusted
    "worldline": (True, False),  # read — reversible, trusted
    "kapae": (True, False),      # move-not-delete mute — reversible, trusted
    "un_kapae": (True, False),   # restore — reversible, trusted
    "plane_record": (True, False),      # cross-plane read — reversible, trusted (structure/form fold onto recall --lens)
    "analyze": (True, False),           # every lens reads (rhythm's `repour` rides the reversible refresh) — mutates nothing → HOTL
    "flow": (True, False),              # the pet-named composed cap-stack runner — read-only compute, routed → HOTL
    "wiki": (True, False),              # switcher and admitted action — reversible gated wiki write → HOTL
    # The meme placement pair — a put lands through the gate (a re-put restores; tombstones move, never
    # delete) and a get reads; both stay on the operator's own island → HOTL.
    "meme_project": (True, False),      # render a meme to a target — a read, deterministic, trusted → HOTL
    # The tiddler door — the reads run the wiki's own engine and move nothing; a put patches one record in the working
    # layer against a base (a re-put restores) and a delete lands a kāpae tombstone a re-put restores; all stay on the
    # face's own daemon wiki → HOTL. The vessel's own gates decide reach (the face's cap, the Kahu predicate, the
    # family fence, and the one wall a seat keeps: its startup action offers); the seat adds none of its own.
    "wiki_filter": (True, False),       # run a TiddlyWiki filter, one bounded page — a read → HOTL
    "tiddler_get": (True, False),       # one record with its fields and its base hash — a read → HOTL
    "wiki_render": (True, False),       # wikify a title or a span to text or html — a read → HOTL
    "wiki_status": (True, False),       # each layer's writeability for the session's face — a read → HOTL
    "ddate": (True, False),             # the Discordian date from a date the caller names — pure compute, a read → HOTL
    # The law index — the read runs the wiki's own engine and moves nothing; a pin edits one run of the face's pin set in its
    # working layer against a base (an unpin restores it) → HOTL. House canon takes no byte from either.
    "law_index": (True, False),         # the pinned law, then the law the pins leave out — a read → HOTL
    "law_pin": (True, False),           # add one `[[uri]]` run to the face's pin set — reversible, trusted → HOTL
    "law_unpin": (True, False),         # take a title out of the pin set — reversible, trusted → HOTL
    "vessel_roster": (True, False),     # who is home: the vessel's own reading of its seats, lanes and vota — a read → HOTL
    "oracle_cast": (True, False),       # one cast written as one new tiddler in the working layer — reversible, trusted → HOTL
    "tiddler_put": (True, False),       # patch fields, tags, or named text in the working layer — reversible, trusted → HOTL
    "tiddler_delete": (True, False),    # remove one plain tiddler plainly, or a meme family where `family=True` names the act; a lower layer asks `mode` → HOTL
    # The offering door — an offer appends a signed row to the Nexus's offer table and moves no canon byte; the reads fold
    # the table → HOTL. The promotion never seats here: no MCP tool carries it.
    "meme_offer": (True, False),        # one signed offer toward a house-canon bag — grants nothing, trusted → HOTL
    "meme_offer_show": (True, False),   # one offer's field diff against canon — a read → HOTL
    # The kahua seat verbs — a proposal grants nothing (the operator's signed lift decides) and the reads fold the
    # verified stage; both stay on the face's own fleet → HOTL. The lift itself never seats here: no MCP tool carries it.
    "kahua_propose": (True, False),     # one proposal batch on the face's intents plane — grants nothing, trusted → HOTL
    "kahua_stage": (True, False),       # one row in the face's local canon, unsigned and on this device alone → HOTL
    "kahua_get": (True, False),         # one title's verified item (and its history) — a read → HOTL
    # 6b control verbs — the SEAT stands now; execution rides in after the HITL talk-story locks.
    "attach": (True, True),      # admit a guest sensorium — TRUST-CROSSING → HITL
    "release": (False, False),   # let a guest sensorium GO (drops its handle) — IRREVERSIBLE → HITL
    "reconcile": (True, False),  # re-settle a sensorium against its source — reversible, trusted → HOTL
    # The DURABLE sensorium-lifecycle sub-verbs a seat runs (SENSE_LIFECYCLE_VERBS) — the read and the pioneer build.
    "roster": (True, False),     # read every sensorium's lifecycle, or one's manifest facets — reversible, trusted → HOTL
    "build": (True, False),      # mint an ephemeral pioneer (an operator's retire undoes it) — reversible, trusted → HOTL
}


def seat_of(verb: str) -> str:
    """HOTL when a verb runs reversible AND trusted; HITL (needs the operator's hand) when it turns
    irreversible OR crosses a trust boundary."""
    reversible, trust_crossing = VERB_SEATS[verb]
    return "HOTL" if (reversible and not trust_crossing) else "HITL"


# THE RETIRED PARAMETERS, by tool: the word that replaced each. The seat refuses a call naming one before any wire.
RETIRED_PARAMS: dict = {
    "tiddler_get": {"text": 'the grain names it: grain="skinny" leaves the text home, grain="fat" carries it'},
}


class SeatArgumentRefused(HouseRefusal, ValueError):
    """A tool's own argument guard: the call named something this seat cannot route (no container, a bare-slug law, ...)."""


class SeatVerbOwed(HouseRefusal, NotImplementedError):
    """A verb or a shaping this seat never runs (TS-native, owed to the daemon, deferred): refused rather than faked."""


# THE REFUSAL FAMILIES THIS SEAT HANDS ACROSS, each raised BY THE HOUSE in words written for a caller: the vessel's own
# refusal and an absent daemon (`lares_uds`), and every `HouseRefusal` (an unnamed house root, a tool's argument guard,
# a verb this seat never runs, an address that walks out of its root). No bare builtin rides here: a
# `PermissionError` the OS raised carries house paths and a library's `ValueError` carries its input, so a builtin's
# TYPE alone never crosses; `build_mcp`'s seat answers those the bare line.
REFUSALS = (uds.LaresVerbError, uds.LaresDaemonUnreachable, HouseRefusal)


# The stamp-filter → metadata-key map: each recall filter narrows on the key the py CAPTURE actually
# stamps (filter and stamp share ONE key so they never drift). PHYSICS/STRUCTURAL filters ONLY — the
# ENRICHMENT filters (voice/band/agent-handle/drift) drop from the surface until enrichment EMERGES from
# the breathing sensorium (the Li/Ki nameless-entity detection); stamping them at capture would freeze a
# guess the detection should discover. Keys match capture_sources: `wing` (raw, structural), `lar_surface`
# + `lar_agent` (physics stream-provenance; lar_agent on sub-agent turns).
_STAMP_KEYS = {
    "wing": "wing",
    "surface": "lar_surface",
    "agent": "lar_agent",
    # the block taxonomy axes — recall the operator's steering as its own stratum (speaker="operator"),
    # the loud voices (channel="speech"), or one communicative role (function="steering").
    "speaker": "lar_speaker",
    "channel": "lar_channel",
    "function": "lar_function",
}


def _recall_where(*, wing=None, agent=None, surface=None, speaker=None, channel=None, function=None):
    """Build a chroma `where` from the recall filters — one clause per provided filter, keyed to the slot
    the capture stamps. The taxonomy axes (speaker/channel/function) let a recall surface ONE stratum: the
    operator's steering (speaker="operator"), the loud voices (channel="speech"), a single role. Returns
    None when no filter narrows (the pool stays open); a many-clause filter ANDs (chroma `$and`)."""
    clauses = {"wing": wing, "agent": agent, "surface": surface,
               "speaker": speaker, "channel": channel, "function": function}
    where = {_STAMP_KEYS[name]: val for name, val in clauses.items() if val is not None}
    return where or None


def _where_matches(meta: dict, where: "dict | None") -> bool:
    """Does a record's metadata satisfy a chroma-shaped `where`? A flat clause ANDs key==val; an `$and`
    recurses. The predicate the projection filter reads (the projection owns no metadata — the content
    store backs it)."""
    if not where:
        return True
    if "$and" in where:
        return all(_where_matches(meta, c) for c in where["$and"])
    return all(meta.get(kk) == vv for kk, vv in where.items())


def _make_where_predicate(content_store, where: "dict | None"):
    """A `cid -> bool` predicate that narrows the mempalace PROJECTION leg to the cids whose CONTENT
    metadata satisfies `where` — so a FILTERED recall (speaker="operator", …) keeps combined-arms fusion
    rather than falling to the content-vector alone (the SPEAKER-stratum tension). The projection holds no
    metadata, so the content store backs the check. None where nothing narrows."""
    if not where:
        return None

    def keep(cid: str) -> bool:
        rec = content_store.get(cid) or {}
        return _where_matches(rec.get("metadata") or {}, where)

    return keep


def _rrf_fuse(ranked_lists: "list[list[str]]", k: int, rrf_k: int = 60) -> "list[str]":
    """Reciprocal Rank Fusion over several ordered cid lists → ONE ranked cid list. Rank-only, so surfaces
    whose scores live on incomparable scales (cosine distance ⊥ lexical BM25 ⊥ entity co-occurrence) fuse
    without a shared metric: `score(cid) = Σ 1/(rrf_k + rank_i)`. This is the merge the combined-arms recall
    rides over whatever recall-surfaces the sensorium #has."""
    scores: "dict[str, float]" = {}
    for cids in ranked_lists:
        for rank, cid in enumerate(cids):
            scores[cid] = scores.get(cid, 0.0) + 1.0 / (rrf_k + rank)
    return [cid for cid, _ in sorted(scores.items(), key=lambda kv: kv[1], reverse=True)[:k]]


class LaresCoordinator:
    """The verb-router BOTH surfaces (CLI + MCP) call — it holds a warm embedder + a content-store and a
    worldline handle on ONE sensorium palace, and drives the capture engine. Naming each method for its
    CLI verb keeps the isomorphism honest; the surfaces stay thin skins."""

    def __init__(self, sensorium_root: str, *, wing: str = "wing_default", embed_factory=None) -> None:
        self._paths = sensorium_paths(sensorium_root)
        self._palace = self._paths.root
        self._wing = wing
        embed_factory = embed_factory or make_embed_cap
        self._embed_one, self._model = embed_factory()
        self._dim = len(self._embed_one("probe"))           # pin the width off the warm cap
        self._plane_stores: dict = {}                        # lazy structure/form handles, opened on first read
        self._content = cio.ContentStore(self._paths.content, expected_dim=self._dim, expected_model=self._model)
        # The fork-DAG rides the ONE canonical `worldline/` dir the capture wire builds into — the same
        # helper both sides call, so a pour's braid IS the DAG this coordinator reads (no path split).
        self._worldline = wl.WorldlineStore(worldline_path(self._palace))

    def pour(self, surface: str, pointer: str, *, all: bool = False, writeback: bool = False,
             dry_run: bool = False, wing: "str | None" = None,
             room: str = "conversations") -> dict:
        """Capture a surface's transcript into the Memory sensorium (mirrors `lares sense capture`; `all` mirrors the drawers leg of `lares sense pour --all`).
        Idempotent re-derivation — a re-run lands only the un-landed tail (the crash-cure).

        The isomorphism contract carries the CLI's rich args onto this one spine: `all` sweeps every
        surface, `writeback` re-enriches a wing's drawers, `dry_run` previews without landing. The
        per-pointer capture rides `capture_and_observe` here — it lands the content AND builds the
        worldline fork-DAG into the shared `worldline/`, so `worldline()`/`kapae` read a REAL braid on
        the shipping path; the sweep/writeback/preview SHAPING rides the CLI skin + the deferred
        @daemon-cap-wire, so the params stand in the signature and thread through as the wire lands them."""
        if all:
            # `pour --all` = the bulk backfill across EVERY surface, on the ONE spine: it rides `sweep`,
            # which is the drawers leg of the re-pave the CLI's `pour --all` walks. Both surfaces reach the
            # same discovery, gate and tally, so a daemon-DOWN standalone captures identically.
            return self.sweep("all", wing=wing, room=room)
        if writeback or dry_run:
            # STILL refuse honestly: dry_run especially would otherwise LAND on the append-only ground (the
            # tool advertises a preview it can't yet give). Writeback/preview shaping rides the deferred wire.
            raise SeatVerbOwed(
                "pour writeback/dry_run: the writeback/preview shaping rides the deferred @daemon-cap-wire "
                "(not yet wired) — refusing rather than capturing for real")
        return capture_and_observe(self._palace, surface, pointer, wing=wing or self._wing, room=room,
                                   embed_factory=lambda: (self._embed_one, self._model))

    def sweep(self, surface: str = "all", *, wing: "str | None" = None, project: "str | None" = None,
              limit: "int | None" = None, room: str = "conversations") -> dict:
        """Capture/RECAPTURE every local operator-AI chat transcript into this Memory sensorium in ONE pass —
        the bulk backfill that `pour` handles one pointer at a time (mirrors `lares sense pour --bulk`). `surface`
        `all` folds claude+codex+copilot+copilot-vscode; else names one. Rides the SAME bulk-sweep spine the
        daemon holder drives (`session_discovery.run_bulk_sweep`): the shared `session_discovery` (per-project
        wings + tasked-spirits→`<wing>__spirits` + ephemeral gate + copilot's threaded store), so a
        daemon-DOWN standalone re-pour captures IDENTICALLY to the daemon path — no forked discovery.

        Composes the Memory stream ONCE (`compose_memory_stream_sensorium` over THIS coordinator's warm
        embedder, so the model never reloads) and passes its `.capture` — never `capture_and_observe`
        per-pointer, which recomposes the stream on every call (slow over ~1700 sessions). IDEMPOTENT: a
        re-run lands only the un-landed tail (the crash cure). `project` narrows claude to one project;
        `limit` caps each surface (oldest first); the passed `wing` rides only as the cwd-less fallback."""
        from capture_session import compose_memory_stream_sensorium
        from session_discovery import run_bulk_sweep
        default_wing = wing or self._wing
        stream, model, _dim, _paths = compose_memory_stream_sensorium(
            self._palace, embed_factory=lambda: (self._embed_one, self._model))
        out = run_bulk_sweep(stream.capture, surface=surface, default_wing=default_wing,
                             project=project, limit=limit, room=room)
        out["root"] = self._palace
        out["embedder_model"] = model
        return out

    def _exchange_view(self, matches: list) -> list:
        """Pair matched blocks into EXCHANGES — the read-time view the ontology names. Group the matches
        by lar_turn_key, fetch each turn's FULL block-set (its siblings via content.cids_for_turn), order
        by chunk_index. So a bare matched block recalls WITH its turn's context — the operator's steering
        beside the agent's surface — the merge done as a VIEW, never baked into content. Turn order follows
        the match ranking (the best-matching turn first); a turn surfaces once however many blocks matched."""
        exchanges: list = []
        seen: "set[str]" = set()
        for m in matches:
            tk = (m.get("metadata") or {}).get("lar_turn_key")
            if not tk or tk in seen:
                continue
            seen.add(tk)
            blocks = []
            for cid in self._content.cids_for_turn(tk):
                rec = self._content.get(cid)
                if not rec:
                    continue
                meta = rec.get("metadata") or {}
                blocks.append({"cid": cid, "chunk_index": meta.get("chunk_index", 0),
                               "speaker": meta.get("lar_speaker"), "function": meta.get("lar_function"),
                               "channel": meta.get("lar_channel"), "text": rec.get("document", "")})
            blocks.sort(key=lambda b: b["chunk_index"])
            exchanges.append({"turn_key": tk, "blocks": blocks})
        return exchanges

    def recall(self, query: str, k: int = 8, *, wing: "str | None" = None, imago: "str | None" = None,
               list: bool = False, agent: "str | None" = None, surface: "str | None" = None,
               speaker: "str | None" = None, channel: "str | None" = None, function: "str | None" = None,
               pair: bool = False, lens: str = "content") -> dict:
        """Recall the nearest turns to a query (mirrors `lares sense recall`); kapae-muted turns stay excluded.

        The `lens` folds the per-plane reads onto this one verb — the plane rides as a parameter, so the
        surface stays one recall however many planes stand: `content` (default) rides the combined-arms
        engine below; `structure` and `form` ride their plane doors (the SAME bespoke reads, one surface).

        COMBINED-ARMS (content lens): the recall FUSES every recall-surface this sensorium #has — the
        content-vector (the eidetic ground, always) plus the mempalace projection (lexical + entity) when the
        #has stack declares it and it is paved — by reciprocal rank fusion, resolving verbatim from content.
        Isomorphic: a bare stream sensorium recalls by vector alone; a memory sensorium fuses
        lexical+entity+vector — the SAME machinery reading whatever the stack composes (never a hardcoded list).

        Read modes + filters shed onto this spine: `imago` fetches ONE verbatim entry by turn-key; `list`
        reports the taxonomy. A `wing`/`agent`/`surface` filter narrows by provenance; the TAXONOMY filters
        `speaker`/`channel`/`function` narrow by the block's own axis — so a recall can surface the operator's
        steering as its own stratum (speaker="operator"), the loud voices (channel="speech"), or one role.
        A FILTERED recall now KEEPS combined-arms: the `where` rides INTO every surface — the content-vector
        filters natively (chroma), the mempalace projection rides a content-backed `cid_filter` — so the
        SPEAKER stratum no longer falls to the content-vector alone."""
        if lens == "structure":
            return self.recall_structure(query, k)
        if lens == "form":
            return self.recall_form(query, k)
        if lens == "persistence":
            return self.recall_persistence(query, k)
        if lens == "crossplane":
            return self.recall_crossplane(query, k, wing=wing, agent=agent, surface=surface,
                                          speaker=speaker, channel=channel, function=function)
        if lens != "content":
            raise SeatArgumentRefused(
                f"recall lens {lens!r} unknown — name one of: content · structure · form · persistence · crossplane")
        if imago:
            return self._content.get(imago) or {}
        if list:
            return self._content.taxonomy()
        where = _recall_where(wing=wing, agent=agent, surface=surface,
                              speaker=speaker, channel=channel, function=function)
        surfaces = self._recall_surfaces(where)
        if len(surfaces) <= 1:
            # a bare single-surface sensorium → the content-vector path (the where filters natively).
            out = self._content.search(self._embed_one(query), k, where)
        else:
            # FUSE the #has surfaces: each yields ordered cids; RRF merges; content resolves the verbatim.
            # The `where` rode INTO each surface (content-vector native · projection cid_filter), so a
            # FILTERED recall keeps combined-arms rather than dropping to the content-vector alone.
            pool = max(k * 2, 16)
            ranked = [fn(query, pool) for _name, fn in surfaces]
            fused = _rrf_fuse(ranked, k)
            matches = []
            for cid in fused:
                rec = self._content.get(cid)
                if rec:
                    matches.append({"cid": cid, "distance": None,
                                    "document": rec.get("document", ""), "metadata": rec.get("metadata", {})})
            out = {"matches": matches, "scanned": pool, "matched": len(matches),
                   "surfaces": [name for name, _ in surfaces]}
        if pair:
            # the exchange-VIEW: pair the matched blocks into their turns (steering beside surface).
            rest = {kk: vv for kk, vv in out.items() if kk != "matches"}
            return {"exchanges": self._exchange_view(out.get("matches", [])), **rest}
        return out

    def _recall_surfaces(self, where: "dict | None" = None) -> list:
        """The recall-surface caps this sensorium #has — each `(name, search(query, k) -> ordered cids)`.

        Discovered from the manifest #has stack (the nameless-entity composition), never a hardcoded list:
        the content-vector rides the eidetic ground always; the mempalace projection (lexical + entity) rides
        when the stack declares a `mempalace` cap AND its projection is paved on disk. A future recall-capable
        cap joins the fusion simply by standing in the stack — the recall composes what the sensorium has.

        A `where` narrows EVERY surface uniformly — the content-vector filters natively (chroma); the
        projection rides a content-backed `cid_filter` — so a FILTERED recall keeps combined-arms rather
        than dropping to the content-vector alone (the SPEAKER-stratum fix)."""
        def _vector(query: str, k: int) -> "list[str]":
            res = self._content.search(self._embed_one(query), k, where)
            return [m["cid"] for m in res.get("matches", [])]
        surfaces: list = [("content-vector", _vector)]
        manifest = read_stream_manifest(self._palace, absent_ok=True) or {}
        mp = (manifest.get("has") or {}).get("mempalace")
        if isinstance(mp, dict):
            mp_db = os.path.join(self._palace, mp.get("dir") or "mempalace", "mempalace")
            if os.path.exists(mp_db + ".lex"):                 # the projection is paved (realized on disk)
                keep = _make_where_predicate(self._content, where)
                def _projection(query: str, k: int) -> "list[str]":
                    from mempalace_projection import MempalaceProjection
                    proj = MempalaceProjection(db_path=mp_db)   # read-only: hybrid_search reads the stored graph
                    try:
                        return proj.hybrid_search(
                            query, lambda cid: (self._content.get(cid) or {}).get("document"), k,
                            cid_filter=keep)
                    finally:
                        proj.close()
                surfaces.append(("mempalace", _projection))
        return surfaces

    def status(self) -> dict:
        """What the sensorium holds — the content taxonomy PLUS the DERIVED layer (mempalace projection ·
        rejim geology), so status names the eidetic ground AND the rebuildable views (mirrors `lares vessel read`)."""
        return {**self._content.taxonomy(), "derived": derived_views(self._palace)}

    def worldline(self, selector: "str | None" = None, *, as_of=None) -> dict:
        """The fork-DAG rhizome (mirrors `lares worldline`). `selector` names which run/handle the CLI
        walks; the py `dag` renders the whole edge-DAG and the selector-narrowing rides the CLI skin.
        `diff` stays a CLI-only delta (it refuses honestly on the persisted-ITC gap) — never a method
        here."""
        return self._worldline.dag(as_of=as_of)

    def kapae(self, branch: str, tick) -> dict:
        """Mute a worldline branch + cascade the mute across the sensorium (mirrors `lares worldline kapae`).
        Reversible — un_kapae restores; move-not-delete throughout."""
        return wl.cascade_kapae(self._worldline, [self._content], branch, tick)

    def un_kapae(self, branch: str, tick) -> dict:
        """Restore a muted branch across the sensorium (mirrors `lares worldline un-kapae`)."""
        return wl.cascade_un_kapae(self._worldline, [self._content], branch, tick)

    # ── the rhythm + change-point READS (human-query instruments; read-only) ─────────────────

    def rejim(self, *, repour: bool = False, channel: str = "content") -> dict:
        """The landed rejim (rhythm/geology) plane made ASKABLE (mirrors `lares sense analyze --lens rhythm`) — the nameless
        regimes the stream's own recurrence holds, or an honest absence until the plane is repoured. `repour`
        RE-DERIVES from content first (the reversible refresh, reusing THIS holder's ONE content handle — never
        a second writer), then reads. `channel` names the stream channel a repour reads (default content)."""
        from rejim_io import read_rejim, repour_rejim, CONTENT
        if repour:
            # "content" is the friendly alias for the content-borne (recurrence) channel; any other token
            # passes through to the detector, which validates it against the poured signals.
            ch = CONTENT if channel in (None, "content") else channel
            repour_rejim(self._paths.content, self._paths.rejim, channel=ch, content_store=self._content)
        geology = read_rejim(self._paths.rejim)
        if geology is None:
            return {"repoured": False, "geology": None,
                    "note": "rejim: never repoured — run `lares sense analyze --lens rhythm --repour` (or pass repour=True)"}
        return {"repoured": True, "geology": geology}

    def analyze(self, *, spectral: bool = False, halves=None, span: int = 6) -> dict:
        """DETECT-ONLY change-point analysis over this sensorium's poured content stream (mirrors `lares sense analyze
        --lens changes`) — the isomorphic `sense_analyze` instrument reads the reconstructed stream word-grained and
        reports where vocabulary + grammar change HANDS, every cut a word index. Blind to any ground-truth
        (the answer-key wall stays uncrossed); it never scores, only locates. `spectral` switches to the
        embedding-geometry surface; `halves` (comma-string or list) sets the Foote kernel widths. REUSES the
        coordinator's ONE content handle — no second store client opens on the palace."""
        import sense_analyze
        if isinstance(halves, str) and halves.strip():
            halves_t = tuple(int(h) for h in halves.split(",") if h.strip())
        elif isinstance(halves, (list, tuple)) and halves:
            halves_t = tuple(int(h) for h in halves)
        else:
            halves_t = sense_analyze.DEFAULT_HALVES
        if spectral:
            return sense_analyze.spectral(self._palace)
        res = sense_analyze.detect(self._palace, halves=halves_t, content_store=self._content)
        return {k: v for k, v in res.items() if not k.startswith("_")}   # drop the in-memory word cache

    def ki(self, **_) -> dict:
        """The Ki (氣) corpus-coupling verdict is TS-native — the H¹ cohomology lives in @lararium/mesh, the
        hull a browser carries. A python STANDALONE can't compute it, so this raises: reach it through the
        node daemon (`lares sense analyze --lens couple`, or the routed MCP with the @daemon up), never the standalone coordinator."""
        raise SeatVerbOwed("ki: the coupling verdict is TS-native (the H¹ cohomology lives in @lararium/mesh) — "
                           "reach it via the @daemon (`lares sense analyze --lens couple`), not the standalone python coordinator")

    def li(self, **_) -> dict:
        """The Li (理) gluing verdict is TS-native — the Robinson li-radius and the H¹ cohomology live in
        @lararium/mesh, the hull a browser carries. A python STANDALONE can't compute it, so this raises:
        reach it through the node daemon (`lares sense analyze --lens cohere`, or the routed MCP with the @daemon up)."""
        raise SeatVerbOwed("li: the gluing verdict is TS-native (the li-radius + H¹ cohomology live in @lararium/mesh) — "
                           "reach it via the @daemon (`lares sense analyze --lens cohere`), not the standalone python coordinator")

    def jing(self, **_) -> dict:
        """The Jing (勁) coherence verdict is TS-native — the li∘ki square (extend→restrict round-trip) rides
        the H¹ cohomology hull in @lararium/mesh. A python STANDALONE can't compute it, so this raises: reach
        it through the node daemon (`lares sense analyze --lens square`, or the routed MCP with the @daemon up)."""
        raise SeatVerbOwed("jing: the coherence verdict is TS-native (the li∘ki square rides @lararium/mesh) — "
                           "reach it via the @daemon (`lares sense analyze --lens square`), not the standalone python coordinator")

    def couple_r(self, *, rows=None, names=None, shuffles: int = 100, nboot: int = 100,
                 seed: int = 1, alpha: float = 0.05, **_) -> dict:
        """The R effective-transfer-entropy coupling reference (coupling.R RTransferEntropy::calc_ete) over an
        N-signal matrix — the py/R twin of the TS-hull `ki`. UNLIKE ki/li/jing (TS cohomology, routed to the
        @daemon), this COMPUTES right here: the coupling plane IS the py/R plane (the machine-code-runs-py
        ruling), behind the causal-island boundary. Stateless matrix→verdict; graceful coupling-skipped when
        R / RTransferEntropy is absent."""
        import numpy as np
        from bands import couple_streams
        M = np.asarray(rows or [], dtype=float)
        return couple_streams(M, names=list(names) if names else None,
                              shuffles=shuffles, nboot=nboot, seed=seed, alpha=alpha)

    def forecast(self, *, rows=None, window: int = 50, nsurr: int = 200, alpha: float = 0.05,
                 minbands: int = 2, seed: int = 1, **_) -> dict:
        """The R early-warning plane (ews.R critical-slowing-down forecast) over an N-signal matrix — like
        couple_r, this COMPUTES py-side (the predictive plane is the R plane). Stateless matrix→verdict."""
        import numpy as np
        from bands import forecast_ews
        M = np.asarray(rows or [], dtype=float)
        return forecast_ews(M, window=window, n_surr=nsurr, alpha=alpha, min_bands=minbands, seed=seed)

    def mismatch(self, **_) -> dict:
        """The ki↔R coupling comparator is TS-orchestrated — it runs the TS-hull Gaussian-CMI coupling
        (@lararium/mesh coupleMesh) beside the R effective-TE (coupling.R) and diffs the directed edges. The
        TS hull rides the browser-carried @daemon, so this raises: reach it via the @daemon (`lares sense analyze
        --lens mismatch`), not the standalone python coordinator."""
        raise SeatVerbOwed("mismatch: the ki↔R comparator is TS-orchestrated (the TS-hull coupling lives in "
                           "@lararium/mesh) — reach it via the @daemon (`lares sense analyze --lens mismatch`), not standalone")

    def flow(self, **_) -> dict:
        """The pet-named composed-flow RUNNER is TS-orchestrated — it looks a flow's cap-stack up and runs
        each step routed by hull (crystallize + the coupleMesh capstone ride the TS hull; phase rides the py
        serve-op; mismatch reaches both hulls). Only the @daemon reaches every hull, so this raises: reach it
        via the @daemon (`lares flow <petname>`), not the standalone python coordinator."""
        raise SeatVerbOwed("flow: the composed-flow runner is TS-orchestrated (it routes cap-steps across "
                           "both hulls) — reach it via the @daemon (`lares flow <petname>`), not standalone")

    # ── the per-plane QUERY DOOR (read-only; PLANE_VERBS) ────────────────────────────────────

    def _plane_store(self, plane: str):
        """Open the named plane palace (<palace>/structure | <palace>/form) lazily and cache the
        handle. Returns None when the plane carries no store yet — the query verbs answer an
        honest null rather than PLANTING an empty palace (the read verbs never write the ground)."""
        cached = self._plane_stores.get(plane)
        if cached is not None:
            return cached
        store = open_plane_store(self._palace, plane)
        if store is not None:
            self._plane_stores[plane] = store
        return store

    def recall_structure(self, query_or_cid: str, k: int = 8) -> dict:
        """Interrogate the STRUCTURE plane (read-only). A 64-hex cid resolves through the provenance
        join to the structural entry binding it; any other string parses to a content-free tree
        (markdown-hinted; a sigil-dense query still promotes to memetic-wikitext) and rides the
        STRUCTURAL embedding into nearest-shape recall — never the content vector (the independence
        law holds through the door). Honest nulls where the plane or the record stays absent."""
        store = self._plane_store("structure")
        if store is None:
            return {"plane": "structure", "present": False, "matches": [],
                    "note": "structure: this palace carries no structure store"}
        if _reads_as_cid(query_or_cid):
            entry = _structure_entry_for_cid(store, query_or_cid)
            return {"plane": "structure", "present": True, "cid": query_or_cid,
                    "entry": entry, "matches": []}
        # The store now #has a clean query face (text → detect_kind + parse_to_tree → structural embed →
        # nearest shapes) — the coordinator stops reaching `_col` directly.
        res = store.query(query_or_cid, k)
        if res.get("note") and not res.get("matches"):
            return {"plane": "structure", "present": True, "matches": [],
                    "note": f"structure: {res['note']}"}
        return {"plane": "structure", "present": True, "kind": res.get("kind"), "matches": res["matches"]}

    def recall_form(self, query_or_cid: str, k: int = 8) -> dict:
        """Interrogate the FORM plane (read-only): a cid fetches its induced-template membership row,
        then rides its OWN stored vector into nearest-by-membership neighbors (self dropped). A text
        query answers an honest null — text→membership needs the induced constructicon, which the
        store keeps only as per-record vectors, never as a queryable grammar."""
        store = self._plane_store("form")
        if store is None:
            return {"plane": "form", "present": False, "matches": [],
                    "note": "form: this palace carries no form store"}
        if not _reads_as_cid(query_or_cid):
            return {"plane": "form", "present": True, "matches": [],
                    "note": "form: text queries need the induced constructicon (not persisted as a "
                            "queryable grammar) — query by cid, or ride recall_structure/plane_record"}
        row = store.get(query_or_cid)
        if row is None:
            return {"plane": "form", "present": True, "cid": query_or_cid, "record": None, "matches": []}
        got = store._col.get(ids=[query_or_cid], include=["embeddings"])  # noqa: SLF001 — the stored vector drives the neighbor read
        embs = got.get("embeddings")
        vec = [float(x) for x in embs[0]] if embs is not None and len(embs) else []
        meta = row.get("metadata") or {}
        record = {"dimension": meta.get("dimension"), "count": meta.get("count"),
                  "struct_hash": meta.get("struct_hash", ""),
                  "active_templates": sum(1 for v in vec if v > 0.0)}
        res = store._col.query(query_embeddings=[vec], n_results=max(k, 1) + 1,  # noqa: SLF001 — +1 covers the self-hit
                               include=["metadatas", "distances"])
        ids = (res.get("ids") or [[]])[0]
        dists = (res.get("distances") or [[]])[0]
        matches = [{"cid": ids[i], "distance": dists[i] if i < len(dists) else None}
                   for i in range(len(ids)) if ids[i] != query_or_cid][:max(k, 1)]
        return {"plane": "form", "present": True, "cid": query_or_cid, "record": record, "matches": matches}

    def recall_persistence(self, query_or_cid: str, k: int = 8) -> dict:
        """Interrogate the PERSISTENCE plane (read-only) — the plane where a ki finding earns standing
        through witness. A cid fetches its testimony (kind · provenance · witness-count) and rides its OWN
        stored assertion vector into the nearest ki-findings (self dropped). A text query answers an honest
        null: the assertion IS the vector (the plane runs no embedder), so text→assertion carries no bridge
        — query by cid. Symmetric with `recall_form` (the by-cid + neighbors shape)."""
        store = self._plane_store("persistence")
        if store is None:
            return {"plane": "persistence", "present": False, "matches": [],
                    "note": "persistence: this palace carries no persistence store"}
        if not _reads_as_cid(query_or_cid):
            return {"plane": "persistence", "present": True, "matches": [],
                    "note": "persistence: text queries need an assertion vector (the plane runs no "
                            "embedder) — query by cid"}
        testimony = store.get(query_or_cid)
        if testimony is None:
            return {"plane": "persistence", "present": True, "cid": query_or_cid, "record": None, "matches": []}
        assertion = testimony.get("assertion") or []
        record = {"kind": testimony.get("kind", ""),
                  "signer": (testimony.get("provenance") or {}).get("signer", ""),
                  "witnesses": len(testimony.get("witnesses") or [])}
        matches = []
        if assertion:
            got = store._col.query(query_embeddings=[assertion], n_results=max(k, 1) + 1,  # noqa: SLF001 — +1 covers the self-hit
                                   include=["distances"])
            ids = (got.get("ids") or [[]])[0]
            dists = (got.get("distances") or [[]])[0]
            matches = [{"cid": ids[i], "distance": dists[i] if i < len(dists) else None}
                       for i in range(len(ids)) if ids[i] != query_or_cid][:max(k, 1)]
        return {"plane": "persistence", "present": True, "cid": query_or_cid, "record": record, "matches": matches}

    def recall_crossplane(self, query: str, k: int = 8, *, wing: "str | None" = None,
                          agent: "str | None" = None, surface: "str | None" = None,
                          speaker: "str | None" = None, channel: "str | None" = None,
                          function: "str | None" = None) -> dict:
        """HUMAN-QUERY ALL PLANES — one TEXT query → the content combined-arms recall → each top hit WIDENED
        across the tri-plane by the cross-plane cid-join. Form answers by-cid only (no text→form) and
        structure keys by shape, so a bare human text query cannot hit them directly; this bridges it — the
        content recall finds the cids, then the form-vector + structure-tree ride back per hit
        ({@link plane_query.crossplane_hit}). Read-only; the filters narrow the CONTENT leg (the operator's
        steering stratum, etc.). Returns {plane, query, hits:[{cid, join_key, content, structure, form}]}."""
        base = self.recall(query, k, wing=wing, agent=agent, surface=surface,
                           speaker=speaker, channel=channel, function=function, lens="content")
        hits = [_crossplane_hit(self._palace, m) for m in base.get("matches", [])]
        return {"plane": "crossplane", "query": query, "hits": hits,
                "scanned": base.get("scanned"), "matched": len(hits)}

    def plane_record(self, cid: str) -> dict:
        """The cross-plane witness read: ONE cid → its presence + payload summary across content ·
        structure · form, honest nulls where a plane lacks the record. READ-only — it witnesses
        co-presence and scores nothing. THE COHERE SHORE: cross-plane AGREEMENT (cohere) lands its
        organs with the projector arc; this verb stays the bare 3-plane witness until then.

        The witness itself lives in `plane_query` (neutral, no circular import) — this coordinator holds
        the ONE content handle and passes it in; the capture holder's `plane_record` serve-op rides the
        SAME implementation over the store it owns."""
        return plane_record_witness(self._content, self._palace, cid)


def build_mcp(coordinator: LaresCoordinator):
    """Wrap the coordinator in an MCPServer — one @tool per lifecycle verb, each a thin skin that
    routes straight to the coordinator (the isomorphism holds because both surfaces share it).

    THE HAND LAW (hitl-reads-a-hand): every tool here seats HOTL. An HITL verb (the sense hand verbs, and the 6b
    control verbs attach/release) holds no tool: a person's hand at a real terminal approves it, and no argument a
    seat fills stands in for that hand."""
    from mcp.server.mcpserver import MCPServer
    from mcp.server.mcpserver.exceptions import ToolError, UnexpectedToolError
    from mcp.types import ToolAnnotations

    class _Seat(MCPServer):
        """THE SEAT SPEAKS ITS REFUSALS. The SDK reads any exception outside its own `ToolError` family as a crash and
        answers the bare `Error executing tool <name>`, keeping the words server-side. A refusal this house NAMED
        (`REFUSALS`: the vessel's, the wire's, a tool's own guard) is no crash: it crosses to the caller as a
        `ToolError` carrying its own words, on every tool, through this one door. Anything else stays a crash and
        stays unnamed."""

        async def call_tool(self, name, arguments, context=None):
            # A RETIRED PARAMETER REFUSES ALOUD: the SDK drops a name no tool declares, so a caller still sending a retired
            # one would read an answer it never asked for. Each retired name refuses here with the word that replaced it.
            for word in sorted(set(arguments or {}) & set(RETIRED_PARAMS.get(name, {}))):
                raise ToolError(f"Error executing tool {name}: param-retired: `{word}` retired; {RETIRED_PARAMS[name][word]}. Nothing was read.")
            try:
                return await super().call_tool(name, arguments, context)
            except UnexpectedToolError as crash:
                if isinstance(crash.__cause__, REFUSALS):
                    raise ToolError(f"Error executing tool {name}: {crash.__cause__}") from crash.__cause__
                raise

    mcp = _Seat("lares", instructions=SEAT_INSTRUCTIONS)

    # The addressed-sensorium shore: an AI names a sensorium; the tool resolves the name to its root and
    # threads it up the @daemon cap-ladder (the routed recall/capture/refresh verbs pick the holder by
    # root). Absent → the memory default. A standalone coordinator binds ONE palace at construction, so a
    # name resolving to a DIFFERENT root refuses rather than reading the wrong store; the routed router
    # holds no palace, so it carries the root across to whichever holder owns it.
    bound_root = getattr(coordinator, "_palace", None)   # standalone holds one root; the router holds none
    routed = bound_root is None

    def _address(sensorium: "str | None") -> "str | None":
        if not sensorium:
            return None
        root = sensorium_dir(sensorium)
        if bound_root is not None and os.path.realpath(root) != os.path.realpath(bound_root):
            raise SeatArgumentRefused(f"--standalone opens ONE sensorium ({bound_root}); addressing {sensorium!r} "
                             "rides the routed @daemon (drop --standalone, or name the bound sensorium)")
        return root

    def _call(verb: str, sensorium: "str | None", *args, **kwargs):
        """Resolve the addressed sensorium and drive the shared coordinator: the router carries the root
        across; the bound standalone already owns its one palace, so it needs no root threaded in."""
        root = _address(sensorium)
        method = getattr(coordinator, verb)
        return method(*args, sensorium_root=root, **kwargs) if routed else method(*args, **kwargs)

    @mcp.tool()
    def pour(surface: str = "all", pointer: "str | None" = None, bulk: bool = False, writeback: bool = False,
             dry_run: bool = False, wing: "str | None" = None, room: "str | None" = None,
             project: "str | None" = None, limit: "int | None" = None, sensorium: "str | None" = None) -> dict:
        """Capture transcripts into a sensorium (`sensorium` names it; absent → memory) — mirrors `lares sense pour`.
        ONE POINTER: `surface` (claude/codex/copilot) + `pointer` captures that transcript; `writeback` re-enriches a
        wing, `dry_run` previews. BULK: `bulk` captures/recaptures EVERY local operator-AI transcript in one pass (the
        sweep spine, `lares sense pour --bulk`): `surface` `all` folds claude+codex+copilot, else names one; `project`
        narrows claude; `limit` caps each surface (oldest first). IDEMPOTENT — already-landed turns skip, so a re-run
        catches up and a fresh sensorium fills fully. `bulk` reads no `pointer`, `room`, `dry_run` or `writeback`: each
        refuses by name beside it (the sweep spine carries no preview, so a dropped `dry_run` would land for real)."""
        if bulk:
            stray = [n for n, v in (("pointer", pointer), ("room", room), ("dry_run", dry_run), ("writeback", writeback)) if v]
            if stray:
                raise SeatArgumentRefused(f"pour: `bulk` reads no {', '.join(f'`{n}`' for n in stray)} — the sweep spine "
                                          "captures every transcript and previews nothing; drop them, or pour one `pointer`")
            return _call("sweep", sensorium, surface, wing=wing, project=project, limit=limit)
        if not pointer:
            raise SeatArgumentRefused("pour: name a `pointer` (one transcript), or pass `bulk=True` for every transcript")
        return _call("pour", sensorium, surface, pointer, writeback=writeback, dry_run=dry_run,
                     wing=wing, room=room or "conversations")

    @mcp.tool()
    def recall(query: str, k: int = 8, wing: "str | None" = None, imago: "str | None" = None,
               list: bool = False, agent: "str | None" = None, surface: "str | None" = None,
               speaker: "str | None" = None, channel: "str | None" = None, function: "str | None" = None,
               pair: bool = False, lens: str = "content", sensorium: "str | None" = None) -> dict:
        """Recall the nearest turns to a query from a sensorium (`sensorium` names it; absent → memory).
        `lens` names the plane: `content` (default, combined-arms) · `structure` (nearest shapes) · `form`
        (induced-template membership, by cid) · `persistence` (a witnessed ki-finding + neighbors, by cid) ·
        `crossplane` (HUMAN-QUERY ALL PLANES: a text query → content hits widened across form+structure by
        the cid-join). `imago` fetches one verbatim; `list` reports the taxonomy.
        Filters narrow the pool: wing/agent/surface by provenance; the block-taxonomy `speaker` (operator/
        agent/harness) · `channel` (speech/thought/tool) · `function` (steering/surface/…) surface ONE
        stratum — the operator's steering alone, the loud voices, a single role. `pair` returns the
        exchange-view (each block paired with its turn's siblings). Mirrors `lares sense recall` exactly —
        two surfaces, one API."""
        return _call("recall", sensorium, query, k, wing=wing, imago=imago, list=list,
                     agent=agent, surface=surface, speaker=speaker, channel=channel, function=function,
                     pair=pair, lens=lens)

    @mcp.tool()
    def status(sensorium: "str | None" = None) -> dict:
        """Report what a sensorium holds (the taxonomy). `sensorium` names it; absent → memory."""
        return _call("status", sensorium)

    @mcp.tool()
    def worldline(selector: "str | None" = None, sensorium: "str | None" = None) -> dict:
        """Render the fork-DAG rhizome of turns. `selector` names which run/handle to walk; `sensorium`
        names the sensorium (absent → memory)."""
        return _call("worldline", sensorium, selector)

    @mcp.tool()
    def kapae(branch: str, tick: int, sensorium: "str | None" = None) -> dict:
        """Mute a worldline branch (a fork-path-dead-end) + cascade the mute across a sensorium
        (`sensorium` names it; absent → memory)."""
        return _call("kapae", sensorium, branch, tick)

    @mcp.tool()
    def un_kapae(branch: str, tick: int, sensorium: "str | None" = None) -> dict:
        """Restore a previously kapae-muted branch across a sensorium (`sensorium` names it; absent → memory)."""
        return _call("un_kapae", sensorium, branch, tick)

    @mcp.tool()
    def analyze(lens: "str | None" = None, spectral: bool = False, halves: "str | None" = None, span: "int | None" = None,
                repour: bool = False, channel: "str | None" = None, rows: "list | None" = None,
                names: "list | None" = None, sensorium: "str | None" = None) -> dict:
        """READ through ONE LENS — mirrors `lares sense analyze --lens <lens>`. Five lenses read the poured sensorium;
        `lead`, `forecast` and `mismatch` read the `rows` matrix the caller hands in and touch no plane. The lens chooses
        the instrument; each keeps its own read path and @daemon verb, and the answer names the lens it applied
        (`lens`). A missing or unknown lens refuses, naming every lens:
        `changes` — where the content changes hands (detect-only change-points; `spectral`, `halves` e.g. `4,8,16`,
        `span`) · `rhythm` — the landed regimes and their couples, or an honest absence (`repour` re-derives first) ·
        `couple` — do the sensorium's coupled peers reconcile (the H¹ gate; house name `ki`) · `cohere` — do its
        planes glue into one section (li-radius + H¹; house name `li`; the default cover reads as a nested-cover
        plumbing witness) · `square` — do a child-host's lobes round-trip to one self (bare: the mesh) · `lead` — who
        leads whom across a `rows` matrix (rows=time, cols=signals; `names` labels them; the R transfer-entropy
        reference) · `forecast` — does a regime shift approach over `rows` (the R early-warning read) · `mismatch` —
        do `couple` and `lead` agree over the same `rows`. `sensorium` names the sensorium (absent → memory). An
        argument the lens does not read refuses by name (ANALYZE_LENS_READS, the CLI's own table)."""
        resolved = lens if lens in ANALYZE_LENSES else ANALYZE_LENS_ALIASES.get(lens or "")
        if resolved is None:
            asked = "name a lens" if not lens else f"no lens named {lens!r}"
            raise SeatArgumentRefused(f"analyze: {asked}; the lenses: {' · '.join(ANALYZE_LENSES)}")
        given = {"spectral": spectral, "halves": halves, "span": span, "repour": repour, "channel": channel,
                 "signal": rows, "names": names}
        stray = [n for n, v in given.items() if v not in (None, False) and n not in ANALYZE_LENS_READS[resolved]]
        if stray:
            spelled = ", ".join("`rows`" if n == "signal" else f"`{n}`" for n in stray)
            reads = ", ".join("`rows`" if n == "signal" else f"`{n}`" for n in ANALYZE_LENS_READS[resolved]) or "nothing beyond `lens`"
            raise SeatArgumentRefused(f"analyze: lens `{resolved}` reads no {spelled} (it reads {reads})")
        verb = ANALYZE_LENSES[resolved]
        if verb == "analyze":
            out = _call("analyze", sensorium, spectral=spectral, halves=halves, span=6 if span is None else span)
        elif verb == "rejim":
            out = _call("rejim", sensorium, repour=repour, channel=channel or "content")
        elif verb in ("couple_r", "mismatch"):
            out = _call(verb, None, rows=rows, names=names)
        elif verb == "forecast":
            out = _call("forecast", None, rows=rows)
        else:
            out = _call(verb, sensorium)
        return {"lens": resolved, **out} if isinstance(out, dict) else {"lens": resolved, "result": out}

    @mcp.tool()
    def flow(petname: "str | None" = None, target: "list | None" = None,
             signal: "list | None" = None, names: "list | None" = None,
             sensorium: "str | None" = None) -> dict:
        """The pet-named COMPOSED-FLOW surface — one tool, N flows (the anti-verb-sprawl door). Bare (no
        `petname`) lists the flow-set (crystal · rhythm · couple) with their cap-stacks. `petname` + a
        `signal` matrix (rows=time, cols=signals; `names` labels the columns) RUNS that flow: the @daemon
        looks its cap-stack up and runs each step routed by hull, threading each outcome to the next. New
        capability arrives as a new FLOW, never another raw verb. `lares flow <petname> --signal <ndjson>`
        reads the same. A `target` without a `signal` auto-extracts one from the target's child streams
        (feature-gated: the projector runs now, empty until the re-pour lands child signals)."""
        return _call("flow", sensorium, petname=petname, targets=target, rows=signal, names=names)

    @mcp.tool()
    def plane_record(cid: str, sensorium: "str | None" = None) -> dict:
        """The cross-plane witness: one cid -> presence + payload summary across content,
        structure and form (honest nulls where a plane lacks it). `sensorium` names the sensorium
        (absent → memory)."""
        return _call("plane_record", sensorium, cid)

    @mcp.tool()
    def wiki(verb: str, slug: "str | None" = None, name: "str | None" = None,
             recipe: "str | None" = None, expected: "str | None" = None,
             resulting: "str | None" = None, bag: bool = False, rotate: bool = False,
             release: bool = False, next_boot: bool = False) -> dict:
        """Switch a live wiki with `verb="switch", slug=...`; hold its rotate slot with
        `verb="pin", slug=..., rotate=True` and release it with `release=True`.
        `act` runs an admitted action with recipe, name, expected and resulting.
        `wiki_status` reads status. Bag pins, ordinary wiki pins and next boot stay outside this seat."""
        allowed = {"switch", "pin", "act"}
        if verb not in allowed:
            raise SeatArgumentRefused(f"wiki: `verb` must be one of {sorted(allowed)}, got {verb!r}")
        for flag, value in (("bag", bag), ("next_boot", next_boot)):
            if value:
                raise SeatArgumentRefused(f"wiki: `{flag}` refused on this seat")
        if verb == "act":
            if rotate or release:
                raise SeatArgumentRefused("wiki act: `rotate` and `release` refused")
            if slug is not None or not recipe or not name or not expected or not resulting:
                raise SeatArgumentRefused("wiki act: name, recipe, expected and resulting required; slug refused")
            return _meme_wire("wiki-action", {**_wiki_container("wiki act", recipe), "name": name,
                                              "expected": expected, "resulting": resulting})
        if any(value is not None for value in (name, recipe, expected, resulting)):
            raise SeatArgumentRefused("wiki: action parameters ride `verb=act` alone")
        if not slug:
            raise SeatArgumentRefused("wiki: slug required")
        if verb == "switch":
            if rotate or release:
                raise SeatArgumentRefused("wiki switch: `rotate` and `release` refused")
            return uds.output("wiki-switch", {"slug": slug})
        if not rotate:
            raise SeatArgumentRefused("wiki pin: `rotate=True` required on this seat")
        return uds.output("wiki-release" if release else "wiki-hold", {"slug": slug})

    # ── the MEME namespace — `meme_put` and its kin, the MCP skin of the one placement function (reads ride `tiddler_get`) ──

    def _meme_container(verb: str, recipe: "str | None", bag: "str | None") -> dict:
        """THE CONTAINER LAW, validated CLIENT-SIDE before anything rides the wire: a content verb names
        its container. Exactly one of `recipe`/`bag` stands; neither, or both, refuses as `no-container`
        (the code the CLI and the daemon door answer). No default wiki exists: the daemon's own wiki
        answers to its explicit name, `recipe="default"`. A slug rides as written; the daemon's door
        answers for its shape."""
        if recipe is not None and bag is not None:
            raise SeatArgumentRefused(f"{verb}: no-container — name one of `recipe`/`bag`, never both "
                             f"(got recipe={recipe!r}, bag={bag!r})")
        if recipe is None and bag is None:
            raise SeatArgumentRefused(f"{verb}: no-container — name where this verb reads or writes: `recipe` (as that "
                             "wiki, e.g. \"lares\"; the daemon's own wiki answers to \"default\") or `bag` "
                             "(that one bag). No default wiki exists.")
        for key, slug in (("recipe", recipe), ("bag", bag)):
            if slug is not None and not slug:
                raise SeatArgumentRefused(f"{verb}: `{key}` names no slug — pass one (`sdm`, `lares`)")
        return {"recipe": recipe} if recipe is not None else {"bag": bag}

    def _target(target: "str | None") -> dict:
        """A read's `target`: the lit face it visits (handle index or pet name), riding the wire as written; the vessel's
        door resolves it. None, or an empty word, names no visit."""
        if target is None:
            return {}
        if not isinstance(target, str) or not target.strip():
            raise SeatArgumentRefused(f"target-malformed: `target` names a lit face by handle index (\"h1\") or pet name, got {target!r}")
        return {"target": target.strip()}

    def _wiki_container(verb: str, recipe: "str | None") -> dict:
        """THE ENGINE VERBS' CONTAINER: a wiki. These verbs run in a wiki's own engine (a filter, a render, a status, a
        patch, a removal), so they name `recipe` alone; a bag names one store and no wiki, and its reads ride `tiddler_get`
        (one record; `meme=True` a meme, title-less its roots), its writes `tiddler_put(meme=True)` and `tiddler_delete(meme=True)`."""
        if recipe is None:
            raise SeatArgumentRefused(f"{verb}: no-container — name the wiki: `recipe` (e.g. \"lares\"; the daemon's own wiki "
                                      "answers to \"default\"). A bag names no wiki: read one with `tiddler_get(bag=...)`, "
                                      "`tiddler_get(bag=..., meme=True)` (title-less lists its roots). No default wiki exists.")
        if not recipe:
            raise SeatArgumentRefused(f"{verb}: `recipe` names no slug — pass one (`sdm`, `lares`)")
        return {"recipe": recipe}

    def _meme_wire(verb: str, args: dict):
        """Ride `lares_uds.call` and peel the receipt to the verb's own payload — a `null` output stays
        `None` (an absent meme reads null, never the receipt envelope `uds.output` would hand back)."""
        out = uds.call(verb, args)
        summary = ((out.get("results") or {}).get("summary")) or {}
        if summary.get("ok") is False:
            raise uds.LaresVerbError(str(summary.get("error") or f"verb {verb!r} failed"))
        return summary.get("output")

    def meme_put(uri: str, text: str, recipe: "str | None" = None, bag: "str | None" = None,
                 base: "str | None" = None) -> dict:
        """PLACE a meme's `text` at its `lar:` `uri` through the island's Confluence gate — mirrors
        `lares meme put`. CONTAINER LAW: name exactly one of `recipe` (an edit AS that wiki; lands in the wiki's
        writable bag, its working layer, or this face's own `personal` layer of the wiki where it holds no writer's
        seat there, and the receipt's `bag` and `layer` say which; `"default"` names the @daemon's own wiki) / `bag` (a
        residency placement; fails loud if the island cannot write it); neither, or both, refuses as `no-container`.
        Slugs ride bare (`sdm`, `lares`). THE SEAT'S CANON FENCE: this seat never writes house canon live, so a `bag`
        naming a house canon bag (`lares`, `lararium`, every disk-sourced holding but the public board) refuses
        `seat-canon-reach`; edit through the wiki instead (`recipe=<slug>`, a copy-up), then `meme_offer` the record
        toward the canon bag, and the steward promotes. THE ONE WALL A SEAT KEEPS: a meme whose records carry a
        `$:/tags/StartupAction` tag (or one beneath it) refuses `seat-startup-offer` and lands nothing, since a wiki's
        startup action runs in the operator's tab and rides the operator's own hand; every other record lands
        natively. `base` carries the
        canonical hash the writer read back from `tiddler_get(meme=True, grain="whole")` (a has-stack's base refuses `base-from-skinny`) — the merge base: stale → the receipt's
        `decision` reads "conflict"; absent → adopt. Returns the receipt {uri, decision, grade, landed,
        tombstoned, canonicalHash, warnings, diagnostics} for a write that stands (`ingest`, or `noop` where the
        records already say it). A WRITE THAT NEVER LANDED RAISES: `refuse` and `conflict` answer a tool error
        naming the decision, its reason or warnings, and the live hash to re-read against; a locked vessel
        answers `vessel-locked: run lares vault unlock`. THE STAGE MEME LAW: a meme under the memory stage,
        `lar:///ha.ka.ba/kahua/memory/<class>/<slug>`, carries its stage path in its title and `uri-path` (one or two
        lowercase, hyphen-joined segments). A path that reads otherwise refuses `stage-path-shape`. Rides the @daemon
        wire, never a store."""
        args: dict = {**_meme_container("meme_put", recipe, bag), "uri": uri, "text": text}
        if base is not None:
            args["base"] = base
        receipt = _meme_wire("meme-put", args)
        decision = (receipt or {}).get("decision")
        if decision in ("refuse", "conflict"):
            said = [f"meme-put {decision}: nothing landed at {uri}"]
            if receipt.get("reason"):
                said.append(f"reason {receipt['reason']}")
            if receipt.get("warnings"):
                said.append("; ".join(str(w) for w in receipt["warnings"]))
            if receipt.get("canonicalHash"):
                said.append(f"the records read canonicalHash {receipt['canonicalHash']}: tiddler_get(meme=True, grain=\"whole\"), merge, put with that base")
            raise uds.LaresVerbError(" · ".join(said), f"meme-put-{decision}")
        return receipt

    def meme_list(recipe: "str | None" = None, bag: "str | None" = None, tree: bool = False,
                  after: "str | None" = None, target: "str | None" = None) -> dict:
        """LIST every meme ROOT a seat holds, each with the canonical hash a writer hands back as `base` —
        mirrors `lares meme list`. CONTAINER LAW: exactly one of `recipe` / `bag` names the seat
        (`recipe="default"` names the @daemon's own wiki); neither, or both, refuses as `no-container`. Slugs ride bare. `tree` nests each root's slot tree
        (`slots: [{slot, uri, slots}]`) beneath it; off, roots + hash alone. THREE ANSWERS: a `bag` lists that
        bag's own records and returns {bag, roots, next}; a named `recipe` lists the roots its whole stack resolves,
        each row naming the `bag` that answered, and returns {recipe, bags, roots, next} (`bags` names the stack top
        first; `unreached` rides beside it where a layer stood out of reach); `recipe="default"` lists the @daemon's
        own wiki across its whole stack and returns {bag, roots, next}, where the one `bag` names the layer a write
        lands in and labels the whole answer: under `recipe="default"` no row names a `bag`, so a root there may
        answer from a floor bag beneath (house canon) and the listing never says which. THE FLOOR WORD: `floor: true`
        marks a read the bag's floor snapshot answered, where this face holds no read on the live house canon
        document: a `bag` listing carries it on the seat, {bag, floor, roots, next}, and a named `recipe` carries it
        on each row a floor bag answered. A live read carries no `floor`. THE LISTING PAGES: one
        answer carries a bounded page of roots in title order and `next` names the cursor of the page behind it;
        hand it back as `after` until `next` reads null. A plain tiddler never lists. A LIT FACE RECEIVES VISITS: `target` names another lit face this read visits, by handle index (`"h1"`, `"1"`) or by its pet name, while the seat keeps the face it wears; the answer names the face it read (`face`) and the face worn (`worn`). A visit reads that face's daemon wiki (`recipe="default"`) through a view of its canon and working layer, never its personal or draft layer (private: a title only there reads absent, a personal or draft bag refuses `cross-face-private`); a shut face refuses `face-not-open`; a visit takes no write. Rides the
        @daemon wire, never a store."""
        args: dict = {**_meme_container("meme_list", recipe, bag), **_target(target)}
        if tree:
            args["tree"] = True
        if after:
            args["after"] = after
        return _meme_wire("meme-list", args)

    def meme_delete(uri: str, recipe: "str | None" = None, bag: "str | None" = None,
                    base: "str | None" = None) -> dict:
        """REMOVE the whole meme at its `lar:` `uri` — the root, its `#slot` fragments, its `/path`
        children — through the one removal law; mirrors `lares meme delete`. CONTAINER LAW: exactly one
        of `recipe` / `bag` (`recipe="default"` names the @daemon's own wiki); neither, or both, refuses as
        `no-container`. Slugs ride bare. `base` carries the canonical
        hash the writer read (the CLI's `--if-match`, the route's `If-Match`): stale → the receipt's
        `decision` reads "conflict" and NOTHING moves; absent → the removal proceeds. Returns {uri,
        decision: removed|absent|conflict, tombstoned, retracted, canonicalHash}. A kāpae (`tombstoned`)
        rises only where a lower layer holds the title and would surface; over nothing beneath the
        record leaves plainly (`retracted`), no tombstone — a re-put restores either. Rides the @daemon
        wire, never a store."""
        args: dict = {**_meme_container("meme_delete", recipe, bag), "uri": uri}
        if base is not None:
            args["base"] = base
        return _meme_wire("meme-delete", args)

    @mcp.tool()
    def meme_project(uri: str, to: str, recipe: "str | None" = None, bag: "str | None" = None) -> dict:
        """RENDER the meme the island holds at its `lar:` `uri` to a target — mirrors `lares meme project
        <uri> --to <target>`. `to` names the target: `md` (the submission markdown) · `html` · `tid` · `json`;
        the target rides as a parameter, never a suffix on the verb. The canonical carrier text itself reads
        through `tiddler_get(meme=True, grain="whole")`. CONTAINER LAW: exactly one of `recipe` / `bag` names where to read
        (`recipe="default"` names the @daemon's own wiki); neither, or both, refuses as `no-container`. Slugs ride bare. Returns {uri, to, text, contentType, meta?} — `meta` rides beside `text` for `md` (the `.md.meta` sidecar; the pair is one carrier in two files). Deterministic
        and clock-free — currency proves by re-projecting, never by a stamp. Rides the @daemon wire."""
        if to not in PROJECT_TARGETS:
            raise SeatArgumentRefused(f"meme_project: `to` must be one of {list(PROJECT_TARGETS)}, got {to!r}")
        args: dict = {**_meme_container("meme_project", recipe, bag), "uri": uri, "to": to}
        return _meme_wire("meme-project", args)

    # ── THE TIDDLER DOOR — `tiddler_*` over one record, `wiki_*` over the wiki's own engine ──

    # EVERY TOOL STATES ITS ANNOTATIONS. The schema's defaults read worst-case (destructive, open-world, never
    # idempotent, never read-only), so each tool below names all four. They advise a client; the vessel's wards enforce.
    _READS = ToolAnnotations(readOnlyHint=True, destructiveHint=False, idempotentHint=True, openWorldHint=False)
    _PATCHES = ToolAnnotations(readOnlyHint=False, destructiveHint=False, idempotentHint=True, openWorldHint=False)
    _REMOVES = ToolAnnotations(readOnlyHint=False, destructiveHint=True, idempotentHint=True, openWorldHint=False)
    # A cast writes a NEW record each call (a fresh throw, a fresh title): never idempotent, never destructive.
    _CASTS = ToolAnnotations(readOnlyHint=False, destructiveHint=False, idempotentHint=False, openWorldHint=False)

    def _names(verb: str, key: str, value) -> "list | None":
        if value is None:
            return None
        if isinstance(value, str):
            value = [part.strip() for part in value.split(",")]
        if not isinstance(value, list) or not all(isinstance(n, str) for n in value):
            raise SeatArgumentRefused(f"{verb}: `{key}` takes a list of field names, got {value!r}")
        return [n for n in value if n]

    @mcp.tool(annotations=_READS)
    def wiki_filter(filter: str, recipe: "str | None" = None,  # noqa: A002 — TiddlyWiki's own word
                    fields: "list | None" = None, limit: "int | None" = None, after: "str | None" = None,
                    max_bytes: "int | None" = None, target: "str | None" = None) -> dict:
        """RUN A TIDDLYWIKI FILTER in the wiki's own engine and read ONE BOUNDED PAGE of its answer — mirrors `lares wiki
        filter '<filter>'`. The filter language reads as TiddlyWiki's own: `[tag[memory]sort[title]]`, `[search[cursor]]`,
        `[prefix[lar:///ha.ka.ba/kahua/memory/]]`, `[has[status]!status[done]]`; the LINK GRAPH rides it too:
        `[[Title]backlinks[]]`, `[[Title]links[]]`, `[[Title]transcludes[]]`, `[[Title]backtranscludes[]]`. Returns
        {recipe, filter, titles, total, next, asOf}; name `fields` (e.g. ["tags", "status"]) and each row carries them:
        {…, rows: [{title, fields}], …} in place of `titles`. THE ANSWER PAGES: at most 32 rows and `max_bytes` (default
        65536) per call; `total` counts every match and `next` names the cursor of the page behind: hand it back as
        `after` until `next` reads null. A wiki that moved between pages refuses `filter-cursor-stale` (read again from
        the first page). A filter the engine cannot parse refuses `filter-malformed` with the engine's words. `withheld`
        counts matches that stay home (temp, state, custody titles) or rest in a bag this face holds no read on.
        A RENDERED TIDDLER's slice: where one read of the whole render (`tiddler_get` on the title carrying
        `rendered-from`) answers more than you need, filter its sources for the slice, e.g.
        `[tag[road/rank]sort[order]]` with `fields=["text"]`. CONTAINER: `recipe` names
        the wiki (a bag names no wiki and takes no filter; read a bag with `tiddler_get(bag=...)`, or `tiddler_get(bag=..., meme=True)` for its roots): `recipe="default"` names the worn face's daemon wiki, `recipe=<slug>` any wiki this face reaches (one it hosts or one shared to it), answered in that wiki's own engine; a wiki it reaches none of refuses `wiki-unreached`. A
        filter result carries the named wiki's words; turn it through the five tools. A LIT FACE RECEIVES VISITS: `target` names another lit face this read visits, by handle index (`"h1"`, `"1"`) or by its pet name, while the seat keeps the face it wears; the answer names the face it read (`face`) and the face worn (`worn`). A visit reads that face's daemon wiki (`recipe="default"`) through a view of its canon and working layer, never its personal or draft layer (private: a title only there reads absent, a personal or draft bag refuses `cross-face-private`); a shut face refuses `face-not-open`; a visit takes no write."""
        args: dict = {**_wiki_container("wiki_filter", recipe), "filter": filter, **_target(target)}
        names = _names("wiki_filter", "fields", fields)
        if names is not None:
            args["fields"] = names
        if limit is not None:
            args["limit"] = limit
        if after:
            args["after"] = after
        if max_bytes is not None:
            args["maxBytes"] = max_bytes
        return _meme_wire("wiki-filter", args)

    @mcp.tool(annotations=_READS)
    def tiddler_get(title: "str | None" = None, recipe: "str | None" = None, bag: "str | None" = None, meme: bool = False,
                    grain: "str | None" = None, slot: "str | None" = None, after: "str | None" = None,
                    fields: "list | None" = None, max_bytes: "int | None" = None, target: "str | None" = None,
                    tree: bool = False, all: bool = False) -> dict:
        """READ ONE TIDDLER OR ONE MEME, ON A GRADIENT — mirrors `lares tiddler get <title>`. With no title and `meme=True`, list families: `tree=True` nests their slots, `after` names the next page. A bag listing returns {bag, roots, next}; a named recipe returns {recipe, bags, roots, next}; under `recipe="default"` no row names a `bag`. A floor read returns {bag, floor, roots, next}, and each row from a recipe's floor bag carries `floor: true`.
        EVERY ANSWER LEADS WITH `has`,
        a `<<~ has name=`…` params=`…`>>` line: provenance (`recipe/` or `bag/`, `layer/`, `floor/true`), the record's own
        tags, the measure keys (`type/ position/ family/ slots/ bytes/ base/`, a pointer's `_canonical_uri/ textCid/
        _integrity/ size/` verbatim), then `~` and the description or role; a meme's has-stack adds one `#/slot` line per
        slot. Beside it `grain` echoes {asked, applied, why} and `next` names the next unfold ({grain, after?}) or null.
        TWO AXES, KEPT APART. The LENS: the record by default, {recipe|bag, title, lens: "record", tiddler: {fields, hash,
        textHash, bag, position, family?, omitted?}} (`tiddler` null where none stands; hand `hash` to `tiddler_put` /
        `tiddler_delete` as `base`); `meme=True` recomposes the root and its slot children into ONE carrier sealed by its
        bcc, {title, lens: "meme", meme: {uri, text? | slotText?, canonicalHash, bytes, slots, slot?, page?}, withheld?} (hand `canonicalHash` to a
        meme write as `base`); a slot child's title recomposes from its root and points at the slot; a record that holds no
        meme answers the record with a `note` saying so. The GRAIN (`grain`, one of skinny · fat · handle · resolved · slot ·
        whole; an unknown grain refuses `grain-unknown`): none named, a record within one page (65536 bytes) answers fat and a
        longer one skinny (the text left home), a pointer its handle, a blob skinny; a meme within a page answers its whole
        carrier and a longer one its has-stack. `skinny` leaves the text home; `fat` carries it; `handle` names a pointer's
        body; `resolved` reads it from the local CAS by CID and verifies it (a web2 `_canonical_uri` stays named, never
        fetched); `slot` (with `slot="#/name"`) answers one slot's span at `meme.slotText` (never `text`, the whole carrier's field); `whole` reads the whole at the lens's grain (a record fat, a pointer resolved), and on a meme the whole carrier one page at a time,
        each page cut on a slot boundary: hand `next.after` back as `after` until `next` reads null; `all=True` joins and validates all pages, retaining the first provenance and the whole base. A partial span guards honest base reuse and grants no authorization. `fields=[…]` answers the
        named fields alone; `max_bytes` caps a record answer (the largest fields leave first and `omitted` names them). AN
        ANSWER THAT LEFT THE TEXT HOME hands a card's base (`skinny:sha256-…`): a field patch takes it, a text write refuses
        `base-from-skinny`, so read fat (`grain="fat"`, a meme `grain="whole"`) before you rewrite a text. A slot answer, or a
        page short of the end, hands a partial base bound to what it read (`partial:#/a:…`, `partial:p1:…`): a slot patch
        takes it within that span (`base-outside-span` beyond it), a whole-carrier write or a meme delete refuses
        `base-from-partial`; the last page hands the bare base. A
        RENDERED TIDDLER answers whole here: a source marked `projection: rendered` derives a live tiddler (`<source>.rendered`,
        or the source's `render-title`) whose `rendered-from` names the source. CONTAINER LAW: exactly one of `recipe` /
        `bag`. `recipe="default"` names the worn face's daemon wiki, `recipe=<slug>` any wiki this face reaches, answered in
        that wiki's own engine; a wiki it reaches none of refuses `wiki-unreached`. `bag` names ONE BAG and reads that bag's
        own records through the meme door's reach and read gate (no engine runs): the answer names the `bag`, and carries
        `floor: true` where the bag's floor snapshot answered. A record's text carries the layer `bag` names; turn it
        through the five tools. A LIT FACE RECEIVES VISITS: `target` names another lit face this read visits, by handle index (`"h1"`, `"1"`) or by its pet name, while the seat keeps the face it wears; the answer names the face it read (`face`) and the face worn (`worn`). A visit reads that face's daemon wiki (`recipe="default"`) through a view of its canon and working layer, never its personal or draft layer (private: a title only there reads absent, a personal or draft bag refuses `cross-face-private`); a shut face refuses `face-not-open`; a visit takes no write."""
        if all and (not meme or title is None or slot or after or grain not in (None, "whole")):
            raise SeatArgumentRefused("tiddler_get: all requires a titled meme whole read without slot or after")
        if title is None:
            if not meme:
                raise SeatArgumentRefused("tiddler_get: a title is required unless meme=True lists families")
            stray = [name for name, value in (("slot", slot), ("grain", grain), ("fields", fields), ("max_bytes", max_bytes)) if value is not None]
            if stray:
                raise SeatArgumentRefused(f"tiddler_get: a title-less meme listing reads no {', '.join(stray)}")
            return meme_list(recipe=recipe, bag=bag, tree=tree, after=after, target=target)
        if tree:
            raise SeatArgumentRefused("tiddler_get: tree belongs to a title-less meme listing")
        args: dict = {**_meme_container("tiddler_get", recipe, bag), "title": title, **_target(target)}
        if meme:
            args["meme"] = True
        if grain:
            args["grain"] = grain
        if slot:
            args["slot"] = slot
        if after:
            args["after"] = after
        names = _names("tiddler_get", "fields", fields)
        if names is not None:
            args["fields"] = names
        if max_bytes is not None:
            args["maxBytes"] = max_bytes
        if not all:
            return _meme_wire("tiddler-get", args)
        args["grain"] = "whole"
        first = _meme_wire("tiddler-get", args)
        if not isinstance(first, dict) or not isinstance(first.get("meme"), dict):
            return first
        import re
        def refuse():
            raise SeatArgumentRefused("read-page-mismatch: whole carrier pages failed validation; read again")
        page = first
        parts = []
        seen = set()
        origin_keys = ("title", "recipe", "bag", "lens", "face", "worn", "floor")
        origin = tuple(first.get(k) for k in origin_keys)
        first_meme = first["meme"]
        def provenance(answer):
            has = answer.get("has")
            if not isinstance(has, str) or not has.startswith("<<~ has "):
                refuse()
            return tuple(re.findall(r"(?:^|\s)(?:layer|floor)/[^\s`]+", has))
        first_provenance = provenance(first)
        expected_hash = None
        count = None
        index = 1
        while True:
            m = page.get("meme")
            if (not isinstance(m, dict) or not isinstance(m.get("text"), str) or
                    not isinstance(m.get("canonicalHash"), str) or not m["canonicalHash"] or
                    not isinstance(m.get("uri"), str) or not m["uri"]):
                refuse()
            if provenance(page) != first_provenance or tuple(page.get(k) for k in origin_keys) != origin or m.get("uri") != first_meme.get("uri") or m.get("bytes") != first_meme.get("bytes"):
                refuse()
            mark = m["canonicalHash"]
            match = re.fullmatch(r"partial:p([1-9][0-9]*):(.+)", mark)
            bare = match.group(2) if match else mark
            if mark.startswith("partial:") and (not match or int(match.group(1)) != index):
                refuse()
            if expected_hash is None:
                expected_hash = bare
            if bare != expected_hash:
                refuse()
            info = m.get("page")
            if info is not None:
                if not isinstance(info, dict) or info.get("page") != index or not isinstance(info.get("pages"), int) or info["pages"] < index:
                    refuse()
                if count is None:
                    count = info["pages"]
                if info["pages"] != count:
                    refuse()
            elif index > 1:
                refuse()
            parts.append(m["text"])
            nxt = page.get("next")
            if nxt is None:
                if match or (count is not None and count != index) or len("".join(parts).encode("utf-8")) != m.get("bytes"):
                    refuse()
                break
            if not isinstance(nxt, dict) or nxt.get("grain") != "whole" or not isinstance(nxt.get("after"), str) or not nxt["after"] or not match or count is None or index >= count:
                refuse()
            cursor = nxt["after"]
            if cursor in seen:
                refuse()
            seen.add(cursor)
            page = _meme_wire("tiddler-get", {**args, "after": cursor})
            if not isinstance(page, dict):
                refuse()
            index += 1
        if index == 1:
            return first
        whole = {**first_meme, "text": "".join(parts), "canonicalHash": expected_hash}
        whole.pop("page", None)
        has = re.sub(r"(?<= )base/[^\s`]+", lambda _: f"base/{expected_hash}", first["has"], count=1)
        return {**first, "has": has, "meme": whole, "next": None}

    @mcp.tool(annotations=_READS)
    def wiki_render(title: "str | None" = None, text: "str | None" = None, recipe: "str | None" = None,
                    form: str = "text", type: "str | None" = None,  # noqa: A002 — the tiddler field's own name
                    after: "str | None" = None, max_bytes: "int | None" = None, target: "str | None" = None,
                    output: "str | None" = None) -> dict:
        """WIKIFY through the wiki's own engine: a tiddler by `title`, or a wikitext span passed as `text` (exactly one
        of the two) — mirrors `lares wiki render`. Transclusions, macros, widgets and filters resolve as the wiki
        resolves them (`{{Other}}`, `<$list filter="[tag[x]]">`, `<$count filter=…/>`), so a span works as a small
        report over the wiki. `form` reads "text" (default) or "html"; `type` names a span's content type (default
        TiddlyWiki wikitext). Returns {recipe, title, form, text, bytes, truncated, next}: `max_bytes` (default 65536)
        caps `text`; where `truncated` reads true, hand `next` back as `after` for the rest (a wiki that moved between
        the two refuses `render-cursor-stale`). An absent title refuses `tiddler-absent`. A render fires no action and
        dispatches no message. CONTAINER: `recipe` names the wiki (a bag names no wiki and takes no engine verb): `recipe="default"` names the worn face's daemon wiki, `recipe=<slug>` any wiki this face reaches (one it hosts or one shared to it), answered in that wiki's own engine; a wiki it reaches none of refuses `wiki-unreached`.
        A render carries the named wiki's words; turn it through the five tools. `output` refuses by name on this read-only MCP seat; the node CLI holds the workbench disk grant. A LIT FACE RECEIVES VISITS: `target` names another lit face this read visits, by handle index (`"h1"`, `"1"`) or by its pet name, while the seat keeps the face it wears; the answer names the face it read (`face`) and the face worn (`worn`). A visit reads that face's daemon wiki (`recipe="default"`) through a view of its canon and working layer, never its personal or draft layer (private: a title only there reads absent, a personal or draft bag refuses `cross-face-private`); a shut face refuses `face-not-open`; a visit takes no write."""
        if output is not None:
            raise SeatArgumentRefused("render-output-substrate-refused: this MCP seat holds a read grant and no node workbench output grant")
        if (title is None or title == "") == (text is None or text == ""):
            raise SeatArgumentRefused("wiki_render: name exactly one of `title` (a tiddler) or `text` (a wikitext span)")
        if form not in ("text", "html"):
            raise SeatArgumentRefused(f"wiki_render: `form` reads \"text\" or \"html\", got {form!r}")
        args: dict = {**_wiki_container("wiki_render", recipe), **_target(target)}
        if title:
            args["title"] = title
        else:
            args["text"] = text
        if form != "text":
            args["form"] = form
        if type:
            args["type"] = type
        if after:
            args["after"] = after
        if max_bytes is not None:
            args["maxBytes"] = max_bytes
        return _meme_wire("wiki-render", args)

    @mcp.tool(annotations=_READS)
    def wiki_status(recipe: "str | None" = None, target: "str | None" = None) -> dict:
        """Without a recipe, survey the catalog, activation and vessel residency. With a recipe, NAME EACH LAYER THE WIKI COMPOSES AND WHETHER THIS SESSION'S FACE READS AND WRITES IT — mirrors `lares wiki
        status`. Returns {recipe, working, layers: [{bag, mounted, read, write, working?, why?}]}: `working` names the
        layer every `tiddler_put` (with or without `meme=True`) lands in (null where none stands attached); each layer reads `mounted`
        "writable", "read-only" or "promotion-only" (a canon layer: a write reaches it by action verb alone, never by a put),
        the face's own `read` and `write`, and `why` where a mounted-writable layer still refuses this face. Read it before a write to learn where the write lands. CONTAINER: `recipe` names the wiki (a bag names no wiki and takes no engine verb): `recipe="default"` names the worn face's daemon wiki, `recipe=<slug>` any wiki this face reaches (one it hosts or one shared to it), answered in that wiki's own engine; a wiki it reaches none of refuses `wiki-unreached`. A LIT FACE RECEIVES VISITS: `target` names another lit face this read visits, by handle index (`"h1"`, `"1"`) or by its pet name, while the seat keeps the face it wears; the answer names the face it read (`face`) and the face worn (`worn`). A visit reads that face's daemon wiki (`recipe="default"`) through a view of its canon and working layer, never its personal or draft layer (private: a title only there reads absent, a personal or draft bag refuses `cross-face-private`); a shut face refuses `face-not-open`; a visit takes no write."""
        if recipe is None:
            if target is not None:
                raise SeatArgumentRefused("wiki_status: target requires recipe")
            return {"catalog": uds.output("list-wikis", {}), "activation": uds.output("wiki-active", {}),
                    "residency": {"scope": "vessel", **uds.output("residency", {})}}
        return _meme_wire("wiki-status", {**_wiki_container("wiki_status", recipe), **_target(target)})

    @mcp.tool(annotations=_READS)
    def ddate(format: "str | None" = None, day: "int | None" = None, month: "int | None" = None,
              year: "int | None" = None) -> dict:
        """READ THE DISCORDIAN DATE through the house's own calendar (no host `ddate` binary) — mirrors `lares ddate
        [+FORMAT] [day month year]`. With no date it reads TODAY, the seat's own local day (the verb reads no clock). `day`,
        `month` and `year` ride together or not at all (a BCE year rides negative). `format` takes the ddate(1) codes:
        %A %a weekday · %B %b season · %d day of the season · %e its ordinal (11th, 21st) · %E the ordinal by its last digit
        alone (the first ddate's 11st) · %H the holyday · %N stop unless it is a holyday · %n %t newline and tab · %Y the YOLD ·
        %X days until X-Day (Confusion 40, 9827 YOLD, the Church of the SubGenius's date) · %. an exclamation drawn through the
        platform's entropy door · %{ %} the span that reads "St. Tib's Day" on February 29. A bare call answers the default line
        ("Today is Prickle-Prickle, the 32nd day of The Aftermath in the YOLD 3192"). Returns {text, entropy, gregorian,
        yold, tibs, season, dayOfSeason, weekday, holyday}: `entropy` names the source a `%.` drew from, else null. A date out
        of range raises. Rides the @daemon wire."""
        import datetime
        args: dict = {}
        if format is not None:
            args["format"] = format
        for name, value in (("day", day), ("month", month), ("year", year)):
            if value is not None:
                args[name] = value
        today = datetime.date.today()
        args["today"] = {"year": today.year, "month": today.month, "day": today.day}
        return _meme_wire("ddate", args)

    @mcp.tool(annotations=_CASTS)
    def oracle_cast(recipe: "str | None" = None, bag: "str | None" = None, coins: "list | None" = None,
                    caster: "str | None" = None) -> dict:
        """CAST THE I CHING and let the vessel write the cast as one tiddler — mirrors `lares oracle cast`. Three coins a
        line (heads three, tails two): 6 (old yin) and 9 (old yang) change, 7 and 8 hold; six lines, bottom first, name the
        PRIMARY hexagram by its King Wen number (1-64), and the changing lines turned over name the RELATING one (none where
        no line changes). With no `coins` the vessel draws the coins through the platform's entropy door
        (`platform:crypto.getRandomValues`), so this seat never picks the figure; `coins` hands in six values the operator
        threw with real coins (6, 7, 8 or 9, bottom line first), named `operator:three-coins`. `caster` names who cast
        (default `agent`). The tiddler lands once under `lar:///ha.ka.ba/lares/oracle/casts/` in the wiki's working layer
        with fields method, entropy, lines, changing, primary, relating, caster, cast-at and readings; reading it again
        never casts again, and a title already standing answers `exists`. Returns {decision, created, title, cast, text,
        readings, note}: `readings` carries the house's imported DOA and e-jing texts for each hexagram this wiki holds,
        with their attribution and license, and names the ones it holds none of. A spirit's jolt rides this tool only when
        its brief opts in, and the hand-back names the cast. CONTAINER LAW: exactly one of `recipe` / `bag`
        (`recipe="default"` names the worn face's daemon wiki).
        THE LIMIT: the oracle widens attention and never decides; the reading names an angle to attend to, never a
        choice to make, and the operator decides."""
        import datetime
        args: dict = dict(_meme_container("oracle_cast", recipe, bag))
        if coins is not None:
            if (not isinstance(coins, list) or len(coins) != 6
                    or not all(isinstance(v, int) and not isinstance(v, bool) and v in (6, 7, 8, 9) for v in coins)):
                raise SeatArgumentRefused("oracle_cast: `coins` names six line values of 6, 7, 8 or 9, bottom line first")
            args["coins"] = list(coins)
        args["caster"] = caster.strip() if isinstance(caster, str) and caster.strip() else "agent"
        now = datetime.datetime.now(datetime.timezone.utc)
        args["at"] = now.isoformat(timespec="milliseconds").replace("+00:00", "Z")
        return _meme_wire("oracle-cast", args)

    # ── THE LAW INDEX — the pinned law first, then the law canon derives; a pin orders it ──

    def _law_titles(filter_text: str) -> list:
        """Every title a filter answers in the worn face's daemon wiki, page after page."""
        titles: list = []
        after = None
        while True:
            args: dict = {"recipe": "default", "filter": filter_text}
            if after:
                args["after"] = after
            out = _meme_wire("wiki-filter", args) or {}
            titles.extend(out.get("titles") or [])
            nxt = out.get("next")
            if not nxt or nxt == after:
                return titles
            after = nxt

    def _law_line(fields) -> str:
        """A row's one line: its description, else its role, its whitespace folded."""
        for name in LAW_ROW_FIELDS:
            value = " ".join(str((fields or {}).get(name) or "").split())
            if value:
                return value
        return ""

    def _law_uri(verb: str, uri) -> str:
        """A title a run can quote: no whitespace and none of the filter's brackets or the list bar."""
        if not isinstance(uri, str) or not uri.strip():
            raise SeatArgumentRefused(f"{verb}: name the law meme by its lar: address")
        uri = uri.strip()
        if any(c.isspace() or c in "[]{}|" for c in uri):
            raise SeatArgumentRefused(f"{verb}: a pin names one title with no whitespace, brackets, braces or bar (got {uri!r})")
        return uri

    def _without_run(text: str, run: str) -> str:
        """Every run equal to `run` leaves with the whitespace before it (after it, where it leads); the layout stands."""
        parts = re.split(r"(\s+)", text)
        out: list = []
        i = 0
        while i < len(parts):
            part = parts[i]
            if i % 2 == 1 or part != run:
                out.append(part)
            elif out:
                out.pop()
            else:
                i += 1
            i += 1
        return "".join(out)

    def _with_run(text: str, run: str) -> str:
        """`run` after the last run, ahead of any trailing whitespace (a closing newline stands)."""
        body = text.rstrip()
        tail = text[len(body):]
        return f"{run}{tail}" if not body else f"{body} {run}{tail}"

    def _law_move(verb: str, uri: str, mode: str) -> dict:
        """Edit the pin set by one run and land it against the base read; the engine says whether the title stands selected."""
        if mode == "pin" and not _law_titles(f"[lares.law[]match[{uri}]]"):
            raise uds.LaresVerbError(f"law-pin-absent: no canon law stands at {uri} in the worn face's daemon wiki "
                                     "(a pin orders canon law and adds none); nothing moved")
        # READ FAT: a read-modify-write takes its base only from an answer that carried the text.
        got = _meme_wire("tiddler-get", {"recipe": "default", "title": LAW_PINS_TITLE, "grain": "fat"}) or {}
        held = got.get("tiddler") or None
        text = str(((held or {}).get("fields") or {}).get("text") or "")

        def selects(filter_text: str) -> bool:
            return bool(filter_text.strip()) and bool(_law_titles(f"{filter_text} +[match[{uri}]]"))

        if selects(text) == (mode == "pin"):
            return {"title": LAW_PINS_TITLE, "uri": uri, "decision": "noop", "pinned": mode == "pin", "text": text,
                    "hash": (held or {}).get("hash")}
        if mode == "pin":
            candidate = _without_run(text, f"-[[{uri}]]")
            if not selects(candidate):
                candidate = _with_run(candidate, f"[[{uri}]]")
        else:
            candidate = _without_run(text, f"[[{uri}]]")
            if selects(candidate):
                candidate = _with_run(candidate, f"-[[{uri}]]")
        args: dict = {"recipe": "default", "title": LAW_PINS_TITLE, "text": candidate}
        if held and held.get("hash"):
            args["base"] = held["hash"]
        put = _meme_wire("tiddler-put", args) or {}
        decision = str(put.get("decision") or "")
        if decision not in ("put", "noop"):
            raise uds.LaresVerbError(f"law-pins-moved: the pin set moved since this read it ({decision}); call {verb} again")
        return {"title": LAW_PINS_TITLE, "uri": uri, "decision": decision, "pinned": mode == "pin", "text": candidate,
                "hash": put.get("hash"), "bag": put.get("bag")}

    @mcp.tool(annotations=_READS)
    def law_index(limit: "int | None" = None, after: "str | None" = None) -> dict:
        """READ THE HOUSE'S LAW, PINNED LAW FIRST — mirrors `lares law list`. Read it before you act, the way you read your
        working memory. The index derives from canon in the worn face's daemon wiki and no list stands in this seat: the pin
        set (`$:/config/lares/law/pins`: the boot seed, then the Mu family) heads it in its own order, then every root meme
        under a bag's `api/` tree the pins leave out, by title. Only canon prints: a row stands where a canon layer answers
        its record, so nothing a face writes reads as law. Returns {filter, pinsTitle, pins, rows: [{title, description,
        pinned}], total, next}: `description` reads the meme's description,
        else its role; one page holds at most 32 rows, and `next` names the cursor of the page behind (hand it back as
        `after`). Read one law whole with `tiddler_get(title=<title>, recipe="default", meme=True, grain="whole")`; order the pins with `law_pin` /
        `law_unpin`. A law row comes from canon's settled ground; turn it through the five tools."""
        pins = _law_titles(LAW_PINS_FILTER)
        args: dict = {"recipe": "default", "filter": LAW_INDEX_FILTER, "fields": list(LAW_ROW_FIELDS)}
        if limit is not None:
            args["limit"] = limit
        if after:
            args["after"] = after
        page = _meme_wire("wiki-filter", args) or {}
        pinned = set(pins)
        rows = [{"title": r.get("title"), "description": _law_line(r.get("fields")), "pinned": r.get("title") in pinned}
                for r in (page.get("rows") or [])]
        total = page.get("total")
        return {"filter": LAW_INDEX_FILTER, "pinsTitle": LAW_PINS_TITLE, "pins": pins,
                "rows": rows, "total": total if isinstance(total, int) else len(rows), "next": page.get("next") or None}

    @mcp.tool(annotations=_PATCHES)
    def law_pin(uri: str) -> dict:
        """PIN A LAW MEME so it heads the law index — mirrors `lares law pin <uri>`. The pin set
        (`$:/config/lares/law/pins`, a TiddlyWiki filter) takes one `[[uri]]` run (or drops a `-[[uri]]` run that kept the
        title out) and lands through `tiddler_put` in this face's working layer of its daemon wiki, against the base it
        read, keeping its layout; house canon takes no byte. A title no canon law holds refuses `law-pin-absent` (a pin
        orders canon law and adds none); one already pinned answers
        `decision: "noop"`; a pin set that moved under the read refuses `law-pins-moved` (call again). Returns {title, uri,
        decision, pinned, text, hash, bag}."""
        return _law_move("law_pin", _law_uri("law_pin", uri), "pin")

    @mcp.tool(annotations=_PATCHES)
    def law_unpin(uri: str) -> dict:
        """UNPIN A LAW MEME — mirrors `lares law unpin <uri>`. Its `[[uri]]` run leaves the pin set
        (`$:/config/lares/law/pins`); a title a broader run still names (a Mu member) takes a `-[[uri]]` run instead. The
        set lands through `tiddler_put` in this face's working layer, against the base it read. A title not pinned answers
        `decision: "noop"`; a pin set that moved under the read refuses `law-pins-moved`. Returns {title, uri, decision,
        pinned, text, hash, bag}."""
        return _law_move("law_unpin", _law_uri("law_unpin", uri), "unpin")

    # ── THE HEARTH ROSTER — who is home, the vessel's own reading ──

    @mcp.tool(annotations=_READS)
    def vessel_roster() -> dict:
        """READ WHO IS HOME — mirrors `lares vessel roster --json`. The vessel answers from what it holds now and places
        nothing. Returns {grain, rotation, seats, asker, lanes, lanesGap, vota, unread, counts, more}: `rotation` names the face
        this vessel wears, the session seats holding that slot (`holders`) and any seat acting under another face
        (`underOther`); `seats` carries one row shape in two grains: `local` (a session bound on the vessel's socket, standing
        while its process holds the socket; `kind` `ai` for a harness's seat, `hand` for a person's hand, the operator's
        among them as an equal) and `far` (a signer on a worn face's intent plane, read only by `lastHeard`, the acts none of
        its own later acts cite: no global now, so nobody far reads online); `lanes` reads the intent claims standing, and
        `lanesGap` names what the house records no claim for (a leap or a road meme); `vota` lists each intent still waiting
        on an answer, an outcome (`owedBy` the atom that owes it, else unclaimed) or a frontier; `unread` names each face
        whose plane did not read, by its code; each face keeps eight rows per list, `counts` counts every row and `more` the rows
        left out. The rows come from the vessel's live reading: a seat here by the kernel's hold
        on its socket, a far seat by its signature; turn them through the five tools."""
        out = _meme_wire(HEARTH_ROSTER_VERB, {})
        if not isinstance(out, dict):
            raise uds.LaresVerbError(f"{HEARTH_ROSTER_VERB}: the vessel answered no roster")
        return out

    @mcp.tool(annotations=_PATCHES)
    def tiddler_put(title: str, recipe: "str | None" = None, fields: "dict | None" = None,
                    text: "str | None" = None, unset: "list | None" = None, tags_add: "str | list | None" = None,
                    tags_remove: "str | list | None" = None, base: "str | None" = None, create: bool = False,
                    meme: bool = False, bag: "str | None" = None, slot: "str | None" = None,
                    append: "str | None" = None) -> dict:
        """PATCH ONE TIDDLER — `meme=True` places a whole carrier from `text`, or writes `slot` against `base` through exactly one of `text` (the slot's whole body) and `append` (a paragraph at its end); a bag or a recipe names the family seat. A family under `lar:///ha.ka.ba/kahua/memory/<class>/<slug>` follows `stage-path-shape`. House canon bags refuse `seat-canon-reach`; offer through `meme_offer` after a recipe copy-up. The receipt's `layer` names a personal placement where this face holds no writer's seat.
        Set fields, unset fields, add and remove tags, and move the text ONLY where `text` names
        it — mirrors `lares tiddler put <title>`. `fields` maps field names to STRING values (a list rides as TiddlyWiki
        writes it: "one [[two words]]"); `unset` names fields to remove; `tags_add` / `tags_remove` take a list of tags
        (or one TiddlyWiki list string); every field the patch leaves unnamed stays as it stood, so a field or tag patch
        never touches the text and a text put keeps the fields. `base` carries the `hash` read from `tiddler_get`: a
        record that moved past it lands nothing. `create=True` lands only where no tiddler stands. The write lands in the
        wiki's WORKING layer (`wiki_status` names it), never canon: a write this seat aims at a house canon bag refuses
        `seat-canon-reach` (the seat edits canon through `tiddler_put(meme=True, recipe=...)` and `meme_offer`). Returns {recipe, title, decision, bag, created,
        changed, hash, textHash, position}: `decision` reads `put`, or `noop` where the record already says it.
        A WRITE THAT NEVER LANDED RAISES: `conflict` (a stale `base`; the error names the live hash) and `exists`.
        THE FENCES, each refused by name: a meme root or slot takes a field or tag patch here, and its text, type or
        carriage fields refuse `tiddler-put-in-a-family` (use `tiddler_put(meme=True)`); a record carrying a `$:/tags/StartupAction`
        tag (or one beneath it) refuses `seat-startup-offer`, since a wiki's startup action runs in the operator's tab
        and rides the operator's own hand (land it untagged, as data); every other shape lands natively, a `$:/` title
        or tag, a module or plugin field and a script type alike; a title that stays home refuses `tiddler-withheld`; a
        title under the memory stage reads one or two lowercase, hyphen-joined path segments (`stage-path-shape`); a
        put over a rendered tiddler, or one carrying `rendered-from`, refuses `rendered-derives` (only the renderer
        writes it: edit the source tiddlers). CONTAINER: `recipe` names the wiki (a bag names no wiki and takes no engine verb): `recipe="default"` names the worn face's daemon wiki, `recipe=<slug>` any wiki this face reaches (one it hosts or one shared to it), answered in that wiki's own engine; a wiki it reaches none of refuses `wiki-unreached`; a put lands in that wiki's working layer (this face's personal layer of it where
        it holds no writer's seat)."""
        if meme:
            if any(value is not None for value in (fields, unset, tags_add, tags_remove)) or create:
                raise SeatArgumentRefused("tiddler_put: family text takes no record field or tag patch")
            if slot is not None or append is not None:
                if not slot or (text is None) == (append is None) or not base:
                    raise SeatArgumentRefused("tiddler_put: a slot write names slot, base and exactly one of text (the slot's whole body) or append")
                args: dict = {**_meme_container("tiddler_put", recipe, bag), "uri": title,
                              "slot": slot, "base": base, "append" if append is not None else "replace": append if append is not None else text}
                receipt = _meme_wire("meme-patch", args) or {}
                if receipt.get("decision") in ("refuse", "conflict", "absent"):
                    raise uds.LaresVerbError(f"meme-patch {receipt.get('decision')}: {receipt.get('warnings') or receipt.get('reason') or title}")
                return receipt
            if text is None:
                raise SeatArgumentRefused("tiddler_put: meme=True requires text")
            return meme_put(uri=title, text=text, recipe=recipe, bag=bag, base=base)
        if bag is not None or slot is not None or append is not None:
            raise SeatArgumentRefused("tiddler_put: bag and slot editing require meme=True")
        args: dict = {**_wiki_container("tiddler_put", recipe), "title": title}
        if fields is not None:
            if not isinstance(fields, dict) or not all(isinstance(k, str) and isinstance(v, str) for k, v in fields.items()):
                raise SeatArgumentRefused("tiddler_put: `fields` maps field names to string values "
                                          "(a list rides as TiddlyWiki writes it: \"one [[two words]]\")")
            args["fields"] = fields
        if text is not None:
            args["text"] = text
        names = _names("tiddler_put", "unset", unset)
        if names:
            args["unset"] = names
        if tags_add:
            args["tagsAdd"] = tags_add
        if tags_remove:
            args["tagsRemove"] = tags_remove
        if base is not None:
            args["base"] = base
        if create:
            args["create"] = True
        receipt = _meme_wire("tiddler-put", args) or {}
        decision = receipt.get("decision")
        if decision in ("conflict", "exists"):
            said = [f"tiddler-put {decision}: nothing landed at {title}"]
            if decision == "conflict":
                said.append(f"the record reads hash {receipt.get('hash') or 'absent'} now: tiddler_get, merge, put with that base")
            else:
                said.append("a tiddler already stands there (create lands only where none does)")
            raise uds.LaresVerbError(" · ".join(said), f"tiddler-put-{decision}")
        return receipt

    @mcp.tool(annotations=_REMOVES)
    def tiddler_delete(title: str, recipe: "str | None" = None,
                       base: "str | None" = None, family: bool = False, mode: "str | None" = None,
                       meme: bool = False, bag: "str | None" = None) -> dict:
        """REMOVE ONE TIDDLER, BY THE FAMILY LAW — mirrors `lares tiddler delete <title> [--family] [--mode kapae|reveal]`.
        A DELETE DELETES PLAINLY: with no `mode`, each record leaves its own layer to absent and no tombstone rises (the
        receipt reads `mode: "plain"` and names each title under `retracted`). `base` carries the `hash` read from
        `tiddler_get`: a record that moved past it moves nothing and the call raises `conflict` naming the live hash.
        Returns {recipe, title, decision, mode, tombstoned, retracted, hash, consequence}: `decision` reads `removed`, or
        `absent` where nothing stands to remove; `consequence` names what the act moved ({act, target, bare, position,
        family, acts, leaves, orphans, refusals, versions}). THE FAMILY LAW: a PLAIN tiddler leaves alone. A meme ROOT or
        SLOT moves nothing and the call raises `tiddler-delete-in-a-family`, quoting the consequence the delete would
        land (every title it would move, what it would leave); pass `family=True` to name the family act, and the root
        leaves with its slots as ONE change. A slot its parent's text calls refuses even then: it leaves through a
        `tiddler_put(meme=True)` of its root's text. A `$:/` title refuses too. ONLY A LOWER LAYER MAKES A DELETE A CHOICE: a wiki
        composes layers (canon under working under personal), and one title may stand in several. Where a lower layer
        holds the title too, or the record rests in a layer this face cannot remove it from, a delete with no `mode`
        raises `delete-mode-needed` naming both meanings: `mode="kapae"` raises a tombstone in a writable layer that
        SHADOWS every record beneath (the wiki reads the title gone, the lower layers keep theirs); `mode="reveal"`
        RETRACTS the topmost record so the record beneath surfaces (raises `reveal-top-unwritable` where the face cannot
        write the layer holding the top record). A kāpae over a title the wiki reads absent still answers: with no `mode` the call
        retracts a tombstone that hides nothing (its `.kapae` shadow leaves the disk), and `mode="reveal"` retracts one
        that hides a lower record. Each act in `consequence.acts` names `bag` (the layer written), `holds` (every layer
        holding the title) and what the wiki reads afterward: `shadowed: [bags]` or `reveals: bag | null`. A rendered
        tiddler (one carrying `rendered-from`) refuses `rendered-derives`: only the renderer writes it, and it leaves when
        its source drops `projection: rendered`. CONTAINER: `recipe` names the wiki (a bag names no wiki and takes no engine verb): `recipe="default"` names the worn face's daemon wiki, `recipe=<slug>` any wiki this face reaches (one it hosts or one shared to it), answered in that wiki's own engine; a wiki it reaches none of refuses `wiki-unreached`."""
        if meme:
            if family or mode is not None:
                raise SeatArgumentRefused("tiddler_delete: meme family removal takes neither family nor mode")
            return meme_delete(uri=title, recipe=recipe, bag=bag, base=base)
        if bag is not None:
            raise SeatArgumentRefused("tiddler_delete: a record delete requires recipe; bag removal takes meme=True")
        args: dict = {**_wiki_container("tiddler_delete", recipe), "title": title}
        if base is not None:
            args["base"] = base
        if family is True:
            args["family"] = True
        if mode is not None:
            if mode not in ("kapae", "reveal"):
                raise SeatArgumentRefused(f"tiddler_delete: mode reads \"kapae\" or \"reveal\"; got {mode!r}")
            args["mode"] = mode
        receipt = _meme_wire("tiddler-delete", args) or {}
        if receipt.get("decision") == "refused":
            refusal = str(receipt.get("refusal") or "tiddler-delete-refused")
            read = json.dumps(receipt.get("consequence") or {}, ensure_ascii=False, separators=(",", ":"))
            raise uds.LaresVerbError(f"{receipt.get('why') or refusal} · nothing moved at {title} · consequence: "
                                     f"{read[:4000]}", refusal)
        if receipt.get("decision") == "conflict":
            raise uds.LaresVerbError(f"tiddler-delete conflict: nothing moved at {title} · the record reads hash "
                                     f"{receipt.get('hash') or 'absent'} now: tiddler_get, then delete with that base",
                                     "tiddler-delete-conflict")
        return receipt

    # ── the OFFERING door — an AI seat offers toward house canon; the steward's hand alone promotes ──

    def _offer_bag(verb: str, bag: "str | None") -> str:
        if not bag or bag.startswith("@"):
            raise SeatArgumentRefused(f"{verb}: name the house-canon `bag` the offer goes toward, a bare slug (`lares`, `sdm`), got {bag!r}")
        return bag

    def _offer_wire(verb: str, args: dict):
        out = _meme_wire(verb, args) or {}
        if out.get("ok") is False:
            raise uds.LaresVerbError(str(out.get("why") or out.get("refusal") or f"{verb} refused"), str(out.get("refusal") or f"{verb}-refused"))
        return out

    @mcp.tool()
    def meme_offer(uris: list, bag: str, nexus: "str | None" = None) -> dict:
        """OFFER records from the worn face's working layer toward a house-canon `bag` — mirrors `lares meme offer <uri…>
        --bag <slug>`. Each record names its carrier digest and its fork base (the canon carrier its working copy forked
        from, or none for a new title); the offer seals under the face's atom and lands on the Nexus's offer table. It
        GRANTS NOTHING and moves no canon byte: the Kahu steward reviews (`meme_offer_show`) and promotes
        by hand. A withheld or `cap/**` title refuses `offer-withheld-title`. `nexus` names the Nexus where this vessel's
        island reads no charter. Returns {cid, landed, bag, nexus, records}; a replay answers `landed: false`."""
        if not isinstance(uris, list) or not uris or not all(isinstance(u, str) and u.startswith("lar:") for u in uris):
            raise SeatArgumentRefused("meme_offer: name `uris` as a non-empty list of lar: uris")
        args: dict = {"bag": _offer_bag("meme_offer", bag), "titles": uris}
        if nexus:
            args["nexus"] = nexus
        return _offer_wire("offer-make", args)

    @mcp.tool()
    def meme_offer_show(cid: "str | None" = None, bag: "str | None" = None, all: bool = False,
                        after: "str | None" = None, limit: "int | None" = None, nexus: "str | None" = None) -> dict:
        """SHOW offers at two grains — mirrors `lares meme offer show [<cid>]`. Without a CID, reads a bounded page
        of the Nexus offer table with count, source, freshness and continuation; `bag` and `all` filter that list.
        With a CID, reads its verified diff against canon and the next operation. Reads alone."""
        if cid is not None and (not isinstance(cid, str) or len(cid) != 64 or any(c not in "0123456789abcdef" for c in cid)):
            raise SeatArgumentRefused("meme_offer_show: `cid` names one offer CID (64 lower-case hex)")
        if cid is not None and (bag is not None or all or after is not None or limit is not None):
            raise SeatArgumentRefused("meme_offer_show: a CID refuses list filters bag, all, after and limit")
        if limit is not None and (not isinstance(limit, int) or isinstance(limit, bool) or limit < 1):
            raise SeatArgumentRefused("meme_offer_show: limit takes a positive whole row count")
        args: dict = {"cid": cid} if cid is not None else {}
        if bag:
            args["bag"] = _offer_bag("meme_offer_show", bag)
        if all:
            args["all"] = True
        if after:
            args["after"] = after
        if limit is not None:
            args["limit"] = limit
        if nexus:
            args["nexus"] = nexus
        return _offer_wire("offer-show" if cid is not None else "offer-list", args)

    # ── the KAHUA namespace — an AI seat proposes, stages and reads its face's stage through a `seat` session ──

    def _kahua_face(face: "int | None") -> "int | None":
        if face is not None and (not isinstance(face, int) or isinstance(face, bool) or face < 0):
            raise SeatArgumentRefused(f"kahua: `face` takes a whole persona index from 0, got {face!r}")
        return face

    @mcp.tool()
    def kahua_propose(proposals: list, face: "int | None" = None, session: "str | None" = None) -> dict:
        """PROPOSE items for the face's kahua stage — mirrors `lares kahua propose`. `proposals` lists
        {title, revision, text | digest, taint}: the daemon title and revision the item distils, its body (or the body's
        sha-256 digest) and every input from outside the face (web page, tool output, pasted text); an AI summary
        inherits the taint of what it summarised. ONE batch per call rides the face's intents plane, pinned to this
        device; it carries digests and never a body, and it grants nothing: the operator's hand lifts it with
        `lares kahua lift <title> --proposal <id>`. TWO DIGESTS, ONE WORD: a proposal's `digest` names the BODY
        digest, the sha-256 of the raw body bytes (UTF-8, lowercase hex), which this tool computes from `text`. The
        ROW digest that `lares kahua stage` prints and `lift --digest` takes covers the body AND the row's carried
        fields, so it differs. Hand `text`, or the BODY digest; a proposal built from the ROW digest refuses at the
        lift with `proposal-digest`, as does one whose body differs by a byte from the staged row's. `face` may name any face inside the lent set (absent: the worn face); a face outside it refuses `face-not-lent`, a shut one `face-not-open`.
        Returns {id, cid}. Rides a `seat` session over the @daemon wire; no MCP tool lifts (`kahua_stage` writes
        the local row a lift names)."""
        if not isinstance(proposals, list) or not proposals:
            raise SeatArgumentRefused("kahua_propose: name `proposals` as a non-empty list of {title, revision, text|digest, taint}")
        args: dict = {"proposals": proposals}
        if session:
            args["session"] = session
        return uds.session_act("kahua-propose", args, face=_kahua_face(face))

    @mcp.tool()
    def kahua_stage(title: str, text: str, fields: "dict | None" = None, face: "int | None" = None) -> dict:
        """STAGE one row into the face's local canon `bags/daemon-<F>` — mirrors `lares kahua stage <title> --text
        <body> [--fields <json>]`. The first of memory's two crossings: local to this device, unsigned, and it lifts
        nothing; the operator's hand carries a staged row to the fleet with `lares kahua lift <title>`, reading its
        preview first. `text` carries the row's whole body; `fields` carries its string-valued fields (`title`, `text`
        and any `kahua-` field never ride). A row already standing at `title` gives way to this one. Returns
        {title, digest, relation, staged}: `digest` names the ROW digest (sha-256 over the body and the carried fields),
        the one `lift --digest` takes, never the BODY digest a proposal carries (`kahua_propose`); `staged` reads
        false where the row already stood at that digest and nothing moved. `face` may name any face inside the lent
        set (absent: the worn face); a face outside it refuses `face-not-lent`, a shut one `face-not-open`. A face with no local canon
        standing refuses `kahua-stage-no-canon`. Rides a `seat` session over the @daemon wire."""
        if not isinstance(title, str) or not title:
            raise SeatArgumentRefused("kahua_stage: name the row's `title`")
        if not isinstance(text, str):
            raise SeatArgumentRefused("kahua_stage: name the row's body as `text`")
        if fields is not None and (not isinstance(fields, dict) or not all(isinstance(k, str) and isinstance(v, str) for k, v in fields.items())):
            raise SeatArgumentRefused("kahua_stage: `fields` takes an object of string values ({\"tags\": \"memory\"})")
        args: dict = {"title": title, "text": text}
        if fields:
            args["fields"] = fields
        return uds.session_act("kahua-stage", args, face=_kahua_face(face))

    @mcp.tool()
    def kahua_get(title: "str | None" = None, history: bool = False, face: "int | None" = None,
                  after: "str | None" = None, limit: "int | None" = None) -> dict:
        """GET the face's verified kahua stage at two grains — mirrors `lares kahua get [<title>]`.
        Without a title, lists bounded items with source, count, relation and continuation; a fresh face answers
        `stage: "none"`. With a title, returns the verified item or null and optional history. Reads alone."""
        if title is not None and (not isinstance(title, str) or not title):
            raise SeatArgumentRefused("kahua_get: name a nonempty `title`")
        if title is None and history:
            raise SeatArgumentRefused("kahua_get: history needs a title")
        if title is not None and (after is not None or limit is not None):
            raise SeatArgumentRefused("kahua_get: a title refuses list pagination")
        if limit is not None and (not isinstance(limit, int) or isinstance(limit, bool) or limit < 1):
            raise SeatArgumentRefused("kahua_get: limit takes a positive whole row count")
        args: dict = {"action": "get", "title": title} if title is not None else {"action": "list"}
        if history:
            args["history"] = True
        if after:
            args["after"] = after
        if limit is not None:
            args["limit"] = limit
        return uds.session_act("kahua-read", args, face=_kahua_face(face))

    # ── the DURABLE sensorium-lifecycle sub-verbs a seat runs — each mirrors `lares sense <verb>` and routes
    #    over the @daemon wire to the pure manifest.json reducer in open-node-vessel.ts. The hand verbs
    #    (harden·retire·un-retire·purge) hold no tool: the operator runs `lares sense <verb>` on a terminal. ──

    @mcp.tool()
    def roster(name: "str | None" = None) -> dict:
        """ROSTER at two grains — bare: every durable sensorium + its lifecycle facet (state · caps · half-life ·
        retirement); `name`: that one sensorium's full manifest facets (caps · coupling · apertures · retirement).
        Mirrors `lares sense roster [<name>]`. A read (HOTL). Routes over the @daemon wire."""
        if name:
            return uds.output("inspect", {"name": name})
        return uds.output("roster", {})

    @mcp.tool()
    def build(name: str, half_life: "int | None" = None) -> dict:
        """BUILD a fresh EPHEMERAL pioneer sensorium (agent self-service; a retire undoes it → HOTL). Refuses
        a name-collision LOUD. Mirrors `lares sense build <name> --ephemeral`; `half_life` tunes the hardening
        decay (default the house floor)."""
        args: dict = {"name": name}
        if half_life is not None:
            args["halfLife"] = half_life
        return uds.output("build", args)

    @mcp.tool()
    def reconcile(name: "str | None" = None, all: bool = False) -> dict:
        """RECONCILE — re-settle one sensorium (`name`) or every sensorium (`all`) against its evidence
        (idempotent; the pure reducer writes only on change). Reversible re-settle → HOTL. Mirrors
        `lares sense reconcile <name> | --all`."""
        if not all and not name:
            raise SeatArgumentRefused("reconcile: pass a sensorium `name` or `all=True`")
        args: dict = {}
        if all:
            args["all"] = True
        if name:
            args["name"] = name
        return uds.output("reconcile", args)

    return mcp


class DaemonCoordinator:
    """The verb-router that HOLDS NOTHING — every verb rides the @daemon cap-wire (`lares_uds`).

    MCP speaks stdio-per-client, so a harness running N sessions runs N of these processes. A coordinator
    that opened a ContentStore would therefore put N unsynchronized chroma clients on one index — and no
    lock cures that, because the palace serve-holders speak NDJSON on raw stdin and answer only the
    process that spawned them. Exactly ONE OWNER holds the palace — the @daemon — and everyone else asks it.

    All the COMPUTE still runs py: the daemon routes to the py holders it owns, which embed, search, and
    store. The TS coordinator carries the verb across and nothing else. This surface holds nothing.

    A verb the daemon does not yet answer REFUSES. It never falls back to opening a store — a fallback
    puts a second writer on the palace, the one thing this wire stands to prevent.
    """

    # The verbs the @daemon answers over the UDS cap-wire (`registry.register(...)` on the TS side): the
    # read `recall`, the per-pointer `capture` (pour), plus the five lifecycle/plane verbs now wired onto
    # the capture holder — `status`/taxonomy, the worldline `dag` read, the `cascade_kapae`/`cascade_un_kapae`
    # branch-mute, and the cross-plane `plane_record`. Each routes to a serve-op on the ONE holder that owns
    # the palace (content_io · worldline_io · structurepalace_io), serialized with capture so a
    # mutation never races the live writer. A verb the wire does NOT yet carry refuses honestly through
    # `_owed` rather than route to an unknown verb (the wall this surface names, not hides).
    ROUTED = {"recall", "pour", "sweep", "status", "worldline", "kapae", "un_kapae", "plane_record", "rejim", "analyze", "ki", "li", "jing", "couple_r", "forecast", "mismatch"}

    def __init__(self, wing: str = "wing_default") -> None:
        self._wing = wing

    def _owed(self, verb: str):
        raise SeatVerbOwed(
            f"lares_mcp: `{verb}` has no @daemon verb yet, and this surface holds no store of its own. "
            "Opening one would put a second writer on the palace (N sessions, N clients, one index). "
            f"Owed: a node verb for `{verb}` that routes to the holder the daemon already owns."
        )

    def sweep(self, surface: str = "all", *, wing: "str | None" = None, project: "str | None" = None,
              limit: "int | None" = None, room: str = "conversations",
              sensorium_root: "str | None" = None, **_) -> dict:
        # Route the BULK backfill through the @daemon `sweep` op — the daemon's capture holder iterates every
        # transcript through its ONE warm writer (model + store loaded once), so the compute lands there and
        # this surface holds nothing. The routed spine both `lares sense pour --bulk` (CLI) and the MCP `pour(bulk=True)` /
        # `pour --all` reach. `surface` `all` folds claude+codex+copilot; project/limit narrow it.
        args: dict = {"surface": surface, "wing": wing or self._wing, "room": room}
        if project:
            args["project"] = project
        if limit is not None:
            args["limit"] = limit
        if sensorium_root:
            args["sensoriumRoot"] = sensorium_root
        return uds.output("sweep", args)

    def recall(self, query: str, k: int = 8, *, wing: "str | None" = None,
               imago: "str | None" = None, sensorium_root: "str | None" = None,
               lens: str = "content", **_) -> dict:
        # The plane lenses (structure/form) ride the py engine directly; the daemon read-holder threads
        # the CONTENT lens today, so a plane lens over the routed wire OWES the routing generalization.
        if lens != "content":
            self._owed(f"recall --lens {lens}")
        args: dict = {"limit": k}
        if imago:
            args["imago"] = imago
        else:
            args["query"] = query
        if wing or self._wing != "wing_default":
            args["wing"] = wing or self._wing
        # The addressed sensorium (an AI names it; the tool resolved it to a root) — the @daemon recall
        # verb picks the holder by root up the cap-ladder. Absent → the memory default the daemon holds.
        if sensorium_root:
            args["sensoriumRoot"] = sensorium_root
        return uds.output("recall", args)

    def pour(self, surface: str, pointer: str, *, all: bool = False, writeback: bool = False,
             dry_run: bool = False, wing: "str | None" = None, room: str = "conversations",
             sensorium_root: "str | None" = None, **_) -> dict:
        # Route ONE pointer's capture through the @daemon `capture` verb (the same verb `lares sense capture`
        # drives) — the daemon owns the capture holder, so the compute lands there, this surface
        # holds nothing. Mirrors `recall` above: build the daemon's camelCase args, ride `uds.output`.
        #
        # The shaping args (all/writeback/dry_run) carry NO holder-side support on the `capture` verb (it
        # accepts surface/pointer/wing/room/sensoriumRoot alone), so they REFUSE here rather than route and
        # get silently dropped — dry_run=True would otherwise LAND for real on the append-only ground, the
        # same footgun the standalone `LaresCoordinator.pour` guards. The sweep/writeback/preview shaping
        # rides in when the @daemon (or capture_and_observe) grows it; until then, refusing keeps the wire
        # honest.
        if all:
            # `pour --all` = the bulk backfill, now ROUTED onto the @daemon `sweep` op (the SAME spine `sweep`
            # rides) — no refusal where the holder answers it.
            return self.sweep(surface="all", wing=wing, room=room, sensorium_root=sensorium_root)
        if writeback or dry_run:
            raise SeatVerbOwed(
                "pour writeback/dry_run: the @daemon `capture` verb carries no writeback/preview shaping, so "
                "this routed surface refuses rather than silently drop them (dry_run would LAND on the "
                "append-only ground) — owed: the shaping verb on the daemon or in capture_and_observe")
        args: dict = {"surface": surface, "pointer": pointer, "wing": wing or self._wing, "room": room}
        # The addressed sensorium (an AI names it; the tool resolved it to a root) — the @daemon capture
        # verb picks the holder by root up the cap-ladder. Absent → the memory default the daemon holds.
        if sensorium_root:
            args["sensoriumRoot"] = sensorium_root
        return uds.output("capture", args)

    def status(self, *, sensorium_root: "str | None" = None, **_) -> dict:
        # Route the taxonomy read through the @daemon `status` verb — the daemon's capture holder owns the
        # ONE content store and answers `content_store.taxonomy()`. Mirrors `recall`/`pour`: no store here.
        args: dict = {}
        if sensorium_root:
            args["sensoriumRoot"] = sensorium_root
        return uds.output("status", args)

    def worldline(self, selector: "str | None" = None, *, as_of=None,
                  sensorium_root: "str | None" = None, **_) -> dict:
        # Route the fork-DAG read through the @daemon `worldline` verb. `selector` stays a CLI-skin concern
        # (it narrows the RETURNED whole edge-DAG); the py `dag` renders whole and never reads it, so it does
        # NOT cross the wire — the arg is accepted for CLI-parity, applied caller-side. `as_of` rides the slice.
        args: dict = {}
        if as_of is not None:
            args["asOf"] = as_of
        if sensorium_root:
            args["sensoriumRoot"] = sensorium_root
        return uds.output("worldline", args)

    def kapae(self, branch: str, tick, *, sensorium_root: "str | None" = None, **_) -> dict:
        # Route the branch-mute cascade through the @daemon `kapae` verb — the holder mutes across the ONE
        # content store it owns, serialized with capture (never a second writer). Move-not-delete; un_kapae restores.
        args: dict = {"branch": branch, "tick": tick}
        if sensorium_root:
            args["sensoriumRoot"] = sensorium_root
        return uds.output("kapae", args)

    def un_kapae(self, branch: str, tick, *, sensorium_root: "str | None" = None, **_) -> dict:
        # Route the branch RESTORE cascade through the @daemon `un_kapae` verb — the reverse of `kapae`.
        args: dict = {"branch": branch, "tick": tick}
        if sensorium_root:
            args["sensoriumRoot"] = sensorium_root
        return uds.output("un_kapae", args)

    def plane_record(self, cid: str, *, sensorium_root: "str | None" = None, **_) -> dict:
        # Route the cross-plane witness through the @daemon `plane_record` verb — the holder reads its own
        # content handle + fresh structure/form readers (one shared `plane_query` implementation).
        args: dict = {"cid": cid}
        if sensorium_root:
            args["sensoriumRoot"] = sensorium_root
        return uds.output("plane_record", args)

    def rejim(self, *, repour: bool = False, channel: str = "content",
              sensorium_root: "str | None" = None, **_) -> dict:
        # Route the rhythm/geology READ through the @daemon `rejim` verb (registry.register("rejim") →
        # readRejim on the holder that owns the store). `repour` first rides the reversible `refresh` verb
        # narrowed to the rejim enrichment (which="rejim") — re-derives on the holder's serialized pipe,
        # never a second writer — then reads the landed plane.
        args: dict = {}
        if sensorium_root:
            args["sensoriumRoot"] = sensorium_root
        if repour:
            refresh_args: dict = {"which": "rejim"}
            if sensorium_root:
                refresh_args["sensoriumRoot"] = sensorium_root
            uds.output("refresh", refresh_args)
        return uds.output("rejim", args)

    def analyze(self, *, spectral: bool = False, halves=None, span: int = 6,
                sensorium_root: "str | None" = None, **_) -> dict:
        # Route the DETECT-ONLY change-point read through the @daemon `analyze` verb (registry.register
        # ("analyze") → the holder's analyze serve-op over the store it owns). Read-only, blind to any
        # ground-truth (the wall stays uncrossed). The wire names the span `sample`.
        args: dict = {}
        if spectral:
            args["spectral"] = spectral
        if halves:
            args["halves"] = halves
        if span is not None:
            args["sample"] = span
        if sensorium_root:
            args["sensoriumRoot"] = sensorium_root
        return uds.output("analyze", args)

    def ki(self, *, sensorium_root: "str | None" = None, **_) -> dict:
        # Route the Ki coupling verdict to the @daemon `ki` verb (registry.register("ki") → the node's TS
        # readMemeticWikitextCoupling, the H¹-gated fuse). Routed-only: the cohomology lives in the hull, not python.
        args: dict = {}
        if sensorium_root:
            args["sensoriumRoot"] = sensorium_root
        return uds.output("ki", args)

    def li(self, *, sensorium_root: "str | None" = None, **_) -> dict:
        # Route the Li gluing verdict to the @daemon `li` verb (registry.register("li") → the node's TS
        # readCohere, the li-radius + H¹-gated fuse). Routed-only: the cohomology lives in the hull, not python.
        args: dict = {}
        if sensorium_root:
            args["sensoriumRoot"] = sensorium_root
        return uds.output("li", args)

    def jing(self, *, sensorium_root: "str | None" = None, **_) -> dict:
        # Route the Jing coherence verdict to the @daemon `jing` verb (registry.register("jing") → the node's
        # TS readJing, the li∘ki round-trip). Routed-only: the cohomology lives in the hull, not python.
        args: dict = {}
        if sensorium_root:
            args["sensoriumRoot"] = sensorium_root
        return uds.output("jing", args)

    def couple_r(self, *, rows=None, names=None, **kw) -> dict:
        # Route the R coupling reference to the @daemon `couple-r` verb (registry.register("couple-r") → the
        # capture_session couple_r serve-op → couple_streams → coupling.R). Stateless matrix→verdict.
        args: dict = {"rows": rows or [], **({"names": list(names)} if names else {})}
        for k in ("shuffles", "nboot", "seed", "alpha"):
            if k in kw and kw[k] is not None:
                args[k] = kw[k]
        return uds.output("couple-r", args)

    def forecast(self, *, rows=None, **kw) -> dict:
        # Route the R early-warning forecast to the @daemon `forecast` verb (→ capture_session forecast
        # serve-op → forecast_ews → ews.R). Stateless matrix→verdict.
        args: dict = {"rows": rows or []}
        for k in ("window", "nsurr", "alpha", "minbands", "seed"):
            if k in kw and kw[k] is not None:
                args[k] = kw[k]
        return uds.output("forecast", args)

    def mismatch(self, *, rows=None, names=None, **_) -> dict:
        # Route the ki↔R comparator to the @daemon `mismatch` verb — the daemon runs the TS-hull coupling
        # (coupleMesh) beside the R couple_r serve-op and diffs. Only the daemon reaches BOTH hulls.
        args: dict = {"rows": rows or [], **({"names": list(names)} if names else {})}
        return uds.output("mismatch", args)

    def flow(self, *, petname=None, targets=None, rows=None, names=None,
             sensorium_root: "str | None" = None, **_) -> dict:
        # Route the composed-flow runner to the @daemon `flow` verb — the daemon looks the pet-named cap-stack
        # up (flowSeedByPetname) and runs each step routed by hull. Bare (no petname) lists the flow-set. Only
        # the daemon reaches both hulls, so every flow routes here. A target without a signal auto-extracts
        # one from the target's child streams (feature-gated: empty until the re-pour lands child signals).
        args: dict = {}
        if petname:
            args["petname"] = petname
        if targets:
            args["targets"] = list(targets)
        if rows:
            args["rows"] = rows
        if names:
            args["names"] = list(names)
        if sensorium_root:
            args["sensoriumRoot"] = sensorium_root
        return uds.output("flow", args)


def main() -> None:
    import argparse

    ap = argparse.ArgumentParser(description="lares_mcp — the isomorphic /mcp surface over the lares sensorium")
    ap.add_argument("--sensorium", help="the sensorium dir (STANDALONE only — opens the stores directly; "
                                     "unsafe with more than one live session)")
    ap.add_argument("--wing", default="wing_default", help="the default wing for captures lacking one")
    ap.add_argument("--standalone", action="store_true",
                    help="open the stores directly instead of routing through the @daemon. ONE session only.")
    args = ap.parse_args()

    # ROUTED runs by default, and alone survives multiple sessions: the @daemon owns the holders, this
    # process owns nothing. `--standalone` opens the single-session escape hatch (a test-bed, a dead
    # node), and names its cost rather than pretending the direct open comes free.
    if args.standalone:
        if not args.sensorium:
            ap.error("--standalone needs --sensorium")
        coordinator = LaresCoordinator(args.sensorium, wing=args.wing)
    else:
        if not uds.available():
            raise SystemExit(
                f"lares_mcp: no lares daemon at {uds.socket_path()} — start one with `lares vessel stand --foreground`.\n"
                "  This surface routes every verb through the @daemon so the palace keeps ONE owner.\n"
                "  For a single-session direct open, pass --standalone --sensorium <dir>."
            )
        coordinator = DaemonCoordinator(wing=args.wing)

    build_mcp(coordinator).run()   # stdio MCP serve


if __name__ == "__main__":
    main()
