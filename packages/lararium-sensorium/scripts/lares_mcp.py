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

# The sensorium lifecycle acts the seat runs by address (`seat_acts` in `build_mcp`): pour, recall, status, worldline,
# kapae, un_kapae, analyze and flow, each the handler a carrier's `handler/seat` row names. `pour` carries the bulk pass
# (`bulk`, the sweep spine) and `analyze` carries every read instrument as a lens (ANALYZE_LENSES).

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

# The cross-plane witness (lar:///sense.plane.reads) — read-only cross-plane interrogation of a 3-plane test-bed sensorium
# (content · structure · form, one cid keying all three planes; corpus_testbed/plane_fanout land it).
# The per-plane READS (structure · form) fold onto `recall --lens <plane>` — the plane rides as a
# parameter, so only the cross-plane WITNESS keeps its own handler (`plane_record`).

# The wiki SWITCHER (lar:///engine.wiki.switches · keeps · unkeeps) — one `wiki` handler takes `switch`, `keep` or `unkeep`
# by `slug`, mirroring the `lares wiki <verb>` CLI namespace. Each is a low-trust · reversible · LOCAL residency op.

# The MEME render (lar:///engine.meme.projects) — a family writes through the plain record tools: `put(title=<root>,
# text=<carrier>)` lands a meme's text at a `lar:` uri through the island's Confluence gate inside the put,
# `put(title="<root>#/x", text=…)` one slot, `delete(title=<root>, family=True)` the whole group (a stale `base` reads
# `conflict` and moves nothing); a meme READS through the one door, `get(title=<root>, aperture="arc")`, which carries the text
# and the canonical hash a write hands back as `base`. `meme_project` renders the meme the island holds to a target (`md` ·
# `html` · `tid` · `json`) — the TARGET rides as a parameter, never a suffix on the verb. A VERB DECLARES ITS SEAT: the CLI's
# `meme normalize` and `meme check` run LOCAL over a file with no daemon, so the seat holds no handler for them, and the
# fixture names that allowance as `local_seat`. THE CONTAINER LAW: exactly one of `recipe`/`bag` names where a seat act reads
# or lands; neither, or both, refuses as `no-container` before the wire. `recipe: "default"` names the host's ANCHOR
# (@daemon's own wiki; never "the active wiki"); `recipe: <slug>` = an edit AS that wiki (its writable bag, or the face's
# `personal` layer of it without a writer's seat); `bag: <slug>` = a residency placement (fails loud if the island cannot
# write it; a house canon bag from this seat refuses `seat-canon-reach`). Slugs ride BARE (`sdm`, `lares`), carried
# as written. Every act rides `lares_uds.call` to the @daemon — never a store (the single-writer law).

# THE ENGINE READS (lar:///engine.wiki.renders, lar:///engine.layer.reads) — `wiki_render` wikifies a title or a span in a
# wiki's own engine and `wiki_status` names each layer the wiki composes and whether this face reads and writes it; each
# mirrors `lares wiki render|status`. The record verbs themselves (`get` · `put` · `delete` · `rename`) ride the seat's own
# tools straight to the vessel's `call` (`fixtures/tiddler-door-answers.json` welds both skins to one table).
# `recipe="default"` names the worn face's daemon wiki and `recipe=<slug>` any wiki that face reaches (one it hosts, or one
# shared to it), each answered in that wiki's own engine; a wiki the face reaches none of refuses `wiki-unreached`.

# THE DISCORDIAN CALENDAR (lar:///oracle.calendar.dates) — `ddate`, the seat's act for the `ddate` verb every vessel answers
# (the house's own isomorphic calendar core; no host `ddate` binary stands behind it). THE CLOCK SEAM rides this seat: a call
# that names no date carries `today`, the seat's own local day, and the verb reads no clock.

# THE ORACLE CAST (lar:///library.oracle.speaks) — `oracle_cast`, the seat's act for the `oracle-cast` verb every vessel
# answers: one I Ching cast by three coins a line, written by the vessel as one tiddler under `casts/`. The draw lives in
# the vessel, never in the prompt: the seat that asks never picks the figure. THE CLOCK SEAM rides this seat: the call
# carries `at`, the seat's own time, and the verb reads no clock. The throw stands and the reading stays open.

# The OFFERING door (lar:///realm.offer.signs, lar:///realm.offer.shows; offering#/the-canon-offer) — an AI seat offers its
# face's working records toward a house-canon bag and reads the Nexus's offer table. An offer GRANTS NOTHING: canon moves
# only under the Kahu steward's promotion, and the promotion stays the steward's hand, which no seat act carries.

# The KAHUA stage (lar:///face.draft.proposes · stages · reads) — an AI seat's reach onto its face's kahua stage, the
# fleet's working-memory stage. `kahua_propose` posts ONE batch of proposals on the face's intents plane (titles, daemon
# revisions, body digests, taint; a proposal grants nothing); `kahua_stage` writes ONE row into the face's local canon
# `bags/daemon-<F>` (local, unsigned: the row a lift later names); `kahua_get` reads the stage's VERIFIED items (the fold,
# never a raw tiddler). Each rides a local SESSION under the `seat` hand (`lares_uds.session_act`), whose profile the vessel
# refuses every kahua pin, lift, withdraw and carry. THE SEAT PROPOSES AND STAGES; THE OPERATOR'S HAND LIFTS.

# THE LAW INDEX (lar:///engine.law.indexes · pins · unpins) — the house's law offered where an agent wakes: `law_index`
# reads the pinned law first (the boot seed, then the Mu family), then every root meme under a bag's `api/` tree, each with
# its one line (description, else role); `law_pin` / `law_unpin` order the pins. The filters are `@lararium/tw5`'s
# `daemon-law-tiddlers`: the law by address (every root meme under a bag's `api/` tree), the pin set the worn face's daemon
# wiki holds (`$:/config/lares/law/pins`), and a canon guard that keeps every row to a record a canon layer answers (the
# oracle floor, the system canon bags) under a title that reads as one `lar:` address, so nothing a face writes prints as
# law. Every read runs the tiddler door's `wiki-filter`, and a pin lands through `tiddler-put` in the face's working layer,
# never in house canon (the seat's canon fence holds); a pin orders canon law and adds none.
LAW_PINS_TITLE = "$:/config/lares/law/pins"
LAW_PINS_FILTER = "[lares.law.pins[]]"
LAW_INDEX_FILTER = "[lares.law[]]"
LAW_ROW_FIELDS = ("description", "role")

# THE HEARTH ROSTER (lar:///face.roster.reads) — who is home, offered beside the law: `vessel_roster` reads the worn face and
# who holds that slot, the seats in two grains (here by presence on the vessel's socket, far by last signed act on the face
# intent plane), the lanes a seat claims and the vota still waiting. It mirrors `lares vessel roster --json`: both ride the one
# `hearth-roster` verb the vessel's channel answers itself (`@lararium/node`'s `hearth-roster-read`), so the body this seat
# returns stands byte for byte the body the CLI's `data` carries. A read: it places nothing and writes no fact.
HEARTH_ROSTER_VERB = "hearth-roster"

# THE DISK SHORE (lar:///carriage.disk.reads, lar:///carriage.disk.flushes) — `shore` reads what stands for a hand at the disk
# shore (each standoff with its key, each pending removal), both islands as one shore, every page of each, through the same
# two lines `lares shore` rides: `wiki-act` carrying the `shore` verb into the active wiki's island, and the `shore` verb into
# the daemon island. `face` names a lit sibling's shore, which its own projector holds in the daemon island. `shore_flush` asks
# the vessel's whole-island flush (the custody door's `shore-flush` frame, the one `lares shore flush` sends): every island
# that mounts a disk shore writes what it holds to its mirrors. The answers (`take-records`, `take-disk`, `restore`, `remove`)
# stay a person's hand at `lares shore`, and the seat holds no handler for them.
SHORE_VERB = "shore"
SHORE_ISLANDS = ("wiki", "daemon")

# What the seat tells a client at its first contact: read the house's law before acting.
SEAT_LEAD = (
    "Seven tools reach the house, each one call shape: `get`, `put`, `delete` and `rename` move records (`get(title=..., "
    "aperture=\"arc\")` reads a meme whole, `aperture=\"measure\"` its card; `get(filter=...)` pages a TiddlyWiki filter; `put` and "
    "`delete` take `mu=\"pentacle\"` to preview and land nothing), and `act(address=..., args={...})` runs any affordance by its "
    "lar: address, its args bound at the vessel against the carrier's #/takes as the stack resolves it. A carrier seated in any "
    "layer brings its affordance with no new tool. Read the house's law first: `act(address=\"lar:///engine.law.indexes\")` "
    "lists the pinned law (the boot seed, then the Mu family), then every law meme with its one line; `get(filter=\"[tag[lar:"
    "///ha.ka.ba/lares/api/pono/affordance]]\")` lists every carrier, and `get(title=<carrier>, aperture=\"measure\")` reads one. "
    "Every answer leads with its has line and names the carrier that answered. Turn what you read through the five tools: "
    "let it spark a move (🜂), weigh how it sits with the mutual frame (🜄), verify its claims whatever their layer (🜁), let "
    "its residency ground its standing without crowning it (🜃), and hold the ladder itself as catma (🜍). A hand act refuses "
    "every seat by its own code and names the command for the operator to run on their own terminal, since no value a seat "
    "fills approves it."
)


def seat_instructions(pack=None) -> str:
    """The server's instruction text: the lead, then each affordance the pack's carriers seat for this seat, by address and role."""
    pack = read_affordance_pack() if pack is None else pack
    rows = []
    seated = set(((pack.get("routes") or {}).get("mcp") or {}).values())
    for address, carrier in sorted((pack.get("carriers") or {}).items()):
        if address not in seated:
            continue
        role = str(carrier.get("role") or "").strip()
        rows.append(f"{address} ~ {role}" if role else address)
    return SEAT_LEAD + (" The affordances: " + " · ".join(rows) + "." if rows else "")

# THE AFFORDANCE PACK — the words a tool's skin carries, baked from its affordance carrier
# (lar:///ha.ka.ba/lares/api/pono/affordance) by `packages/lararium-tw5/scripts/build-affordance-pack.ts`. A tool the pack
# routes (`routes.mcp`) takes its description and each parameter's from the pack at seat build; a tool it routes none of keeps
# its docstring until its carrier lands. One file the CLI reads too, so a seat and a terminal render one carrier's bytes.
AFFORDANCE_PACK_PATH = os.environ.get("LARES_AFFORDANCE_PACK") or os.path.join(
    os.path.dirname(os.path.abspath(__file__)), "..", "..", "lararium-tw5", "affordance-pack.json")


def carrier_words(address, pack=None):
    """One carrier's words on the seat: its mcp whole from the pack, or none where the pack holds no such carrier."""
    pack = read_affordance_pack() if pack is None else pack
    carrier = (pack.get("carriers") or {}).get(address) or {}
    return list(((carrier.get("renders") or {}).get("mcp") or {}).get("whole") or [])


def act_description(pack=None) -> str:
    """The `act` tool's description: the call shape, then each carrier by address and role, rendered from the pack."""
    pack = read_affordance_pack() if pack is None else pack
    lines = ["Run any affordance by its lar: address: `act(address=\"lar:///<t1.t2.t3>\", args={...})`. The vessel binds the args "
             "against the carrier's #/takes as the caller's stack resolves it; an act refuses by name with a cure. Each carrier:"]
    for address, carrier in sorted((pack.get("carriers") or {}).items()):
        role = str(carrier.get("role") or "").strip()
        lines.append(f"{address} ~ {role}" if role else address)
    return "\n".join(lines)


def read_affordance_pack(path=None):
    """The baked pack, or an empty one where none stands (every tool then keeps its own words; witness W3 reads the gap)."""
    try:
        with open(path or AFFORDANCE_PACK_PATH, encoding="utf-8") as fh:
            pack = json.load(fh)
    except (OSError, ValueError):
        return {"carriers": {}, "routes": {}}
    return pack if isinstance(pack, dict) else {"carriers": {}, "routes": {}}


# The targets `meme_project` renders — the same list `lares meme project --to` takes. The carrier itself reads through
# `get(title=<uri>, aperture="arc")`.
PROJECT_TARGETS = ("md", "html", "tid", "json")

# The DURABLE sensorium LIFECYCLE acts a seat runs (lar:///sense.roster.reads · pioneer.builds · source.reconciles) —
# roster (bare: every sensorium; `name`: one's facets) · build · reconcile. Each mirrors `lares sense <verb>` (CLI-direct
# over manifest.json): the seat act routes over the @daemon wire to the house-consistent routed executor in
# open-node-vessel.ts (the ki/li/couple_r pattern — pure manifest.json reducers, no store holder), and the CLI form rides
# the one `sense` door.

# THE HAND VERBS hold no tool here (hitl-reads-a-hand): `sense harden`, `retire`, `un-retire`, `purge` and
# `teardown` run on a person's hand at a real terminal alone. The CLI reads its own branch for that hand and the
# vessel refuses every asker but a terminal's, so a seat's approval value approves nothing and a tool that always
# refused would only stand as surface. A seat names the command for the operator to run on their own terminal.
SENSE_HAND_VERBS = ("harden", "retire", "un-retire", "purge", "teardown")

# THE SEAT ACTS THAT WALK A DRY PATH, by address: whether a door can preview is a fact of its code, never a carrier's claim. A
# `_` carry the vessel lets through to a seat act outside this set refuses `mu-cell-empty` here and runs nothing. Empty today:
# no seat handler previews.
SEAT_DRY: frozenset = frozenset()

# THE RECORD TOOLS' OWN ADDRESSES: each record tool sends its address, never its word, so no spelling a layer seats can turn a
# tool into another act; and an answer from any other address refuses by name (`tool-class-crossed`).
RECORD_ADDRESSES = {
    "get": ("lar:///engine.record.reads", "lar:///engine.filter.pages"),
    "put": ("lar:///engine.record.puts",),
    "delete": ("lar:///engine.record.removes",),
    "rename": ("lar:///engine.record.renames",),
}

# A record write the vessel answers without landing: its receipt names the decision, and the seat raises it by name.
UNLANDED = ("conflict", "exists", "refused")


def record_address(tool: str, params: dict) -> str:
    """The address a record tool sends: `get` reads by filter where it names one, else by title (the meme listing included)."""
    if tool == "get":
        return RECORD_ADDRESSES["get"][1] if params.get("filter") is not None else RECORD_ADDRESSES["get"][0]
    return RECORD_ADDRESSES[tool][0]


def answered_address(out) -> "str | None":
    """The address an answer names: a plan's `address`, else the carrier its stamp names (a seat title or a bare root)."""
    if not isinstance(out, dict):
        return None
    if isinstance(out.get("address"), str) and out["address"]:
        return out["address"]
    carrier = (out.get("carrier") or {}).get("carrier") if isinstance(out.get("carrier"), dict) else None
    if not isinstance(carrier, str):
        return None
    m = re.search(r"/afford/([^/#]+)$", carrier) or re.fullmatch(r"lar:///([^/#]+)", carrier)
    return f"lar:///{m.group(1)}" if m else None


def unlanded_refusal(tool: str, out) -> "str | None":
    """The words a record write's unlanded receipt raises: `<tool>-<decision>`, the has line, the refusal and its consequence."""
    if not isinstance(out, dict) or out.get("decision") not in UNLANDED:
        return None
    said = [f"{tool}-{out['decision']}: nothing landed"]
    for key in ("refusal", "consequence", "hash", "observed"):
        if out.get(key) is not None:
            said.append(f"{key} {out[key] if isinstance(out[key], str) else json.dumps(out[key])}")
    if isinstance(out.get("has"), str):
        said.append(out["has"])
    return " · ".join(said)


def whole_carrier(first, fetch):
    """THE WHOLE CARRIER, PAGE BY PAGE (`read-page-mismatch`): a meme read whole that answers past one page follows its cursor
    to the end, and every page must name the same carrier, provenance and hash, in order; any break refuses by name."""
    if not isinstance(first, dict) or not isinstance(first.get("meme"), dict) or not isinstance(first.get("next"), dict):
        return first

    def refuse():
        raise SeatArgumentRefused("read-page-mismatch: whole carrier pages failed validation; read again")

    origin_keys = ("title", "recipe", "bag", "lens", "face", "worn", "floor")
    origin = tuple(first.get(k) for k in origin_keys)
    first_meme = first["meme"]

    def provenance(answer):
        has = answer.get("has")
        if not isinstance(has, str) or not has.startswith("<<~ has "):
            refuse()
        return tuple(re.findall(r"(?:^|\s)(?:layer|floor)/[^\s`]+", has))

    first_provenance = provenance(first)
    page, parts, seen, expected_hash, count, index = first, [], set(), None, None, 1
    while True:
        m = page.get("meme")
        if (not isinstance(m, dict) or not isinstance(m.get("text"), str) or not isinstance(m.get("canonicalHash"), str)
                or not m["canonicalHash"] or not isinstance(m.get("uri"), str) or not m["uri"]):
            refuse()
        if (provenance(page) != first_provenance or tuple(page.get(k) for k in origin_keys) != origin
                or m.get("uri") != first_meme.get("uri") or m.get("bytes") != first_meme.get("bytes")):
            refuse()
        mark = m["canonicalHash"]
        match = re.fullmatch(r"partial:p([1-9][0-9]*):(.+)", mark)
        bare = match.group(2) if match else mark
        if mark.startswith("partial:") and (not match or int(match.group(1)) != index):
            refuse()
        expected_hash = bare if expected_hash is None else expected_hash
        if bare != expected_hash:
            refuse()
        info = m.get("page")
        if info is not None:
            if not isinstance(info, dict) or info.get("page") != index or not isinstance(info.get("pages"), int) or info["pages"] < index:
                refuse()
            count = info["pages"] if count is None else count
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
        if (not isinstance(nxt, dict) or nxt.get("grain") != "whole" or not isinstance(nxt.get("after"), str) or not nxt["after"]
                or not match or count is None or index >= count):
            refuse()
        cursor = nxt["after"]
        if cursor in seen:
            refuse()
        seen.add(cursor)
        page = fetch(cursor)
        if not isinstance(page, dict):
            refuse()
        index += 1
    if index == 1:
        return first
    whole = {**first_meme, "text": "".join(parts), "canonicalHash": expected_hash}
    whole.pop("page", None)
    has = re.sub(r"(?<= )base/[^\s`]+", lambda _: f"base/{expected_hash}", first["has"], count=1)
    return {**first, "has": has, "meme": whole, "next": None}

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

    # ── the rhythm + change-point instruments (rhythm can refresh its plane) ─────────────────

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

    # ── the per-plane QUERY DOOR (read-only; lar:///sense.plane.reads) ────────────────────────────────────

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
            try:
                return await super().call_tool(name, arguments, context)
            except UnexpectedToolError as crash:
                if isinstance(crash.__cause__, REFUSALS):
                    raise ToolError(f"Error executing tool {name}: {crash.__cause__}") from crash.__cause__
                raise

    pack = read_affordance_pack()
    mcp = _Seat("lares", instructions=seat_instructions(pack))

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

    def pour(surface: str = "all", pointer: "str | None" = None, bulk: bool = False, writeback: bool = False,
             dry_run: bool = False, wing: "str | None" = None, room: "str | None" = None,
             project: "str | None" = None, limit: "int | None" = None, sensorium: "str | None" = None) -> dict:
        """Capture transcripts into a sensorium.
        Capture transcripts into a sensorium (`sensorium` names it; absent → memory) — mirrors `lares sense pour`.
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

    def status(sensorium: "str | None" = None) -> dict:
        """Report what a sensorium holds (the taxonomy). `sensorium` names it; absent → memory."""
        return _call("status", sensorium)

    def worldline(selector: "str | None" = None, sensorium: "str | None" = None) -> dict:
        """Render the graph of conversation turns.
        Render the fork-DAG rhizome of turns. `selector` names which run/handle to walk; `sensorium`
        names the sensorium (absent → memory)."""
        return _call("worldline", sensorium, selector)

    def kapae(branch: str, tick: int, sensorium: "str | None" = None) -> dict:
        # THE SEAT'S OWN ACT FOR lar:///sense.kapae.mutes: the vessel binds its args against the carrier and answers handler/seat;
        # this function keeps behaviour alone, and the carrier holds its words.
        return _call("kapae", sensorium, branch, tick)

    def un_kapae(branch: str, tick: int, sensorium: "str | None" = None) -> dict:
        # THE SEAT'S OWN ACT FOR lar:///sense.kapae.restores: the vessel binds its args against the carrier and answers handler/seat;
        # this function keeps behaviour alone, and the carrier holds its words.
        return _call("un_kapae", sensorium, branch, tick)

    def analyze(lens: "str | None" = None, spectral: bool = False, halves: "str | None" = None, span: "int | None" = None,
                repour: bool = False, channel: "str | None" = None, rows: "list | None" = None,
                names: "list | None" = None, sensorium: "str | None" = None) -> dict:
        """Run one analysis lens, optionally refreshing the rhythm plane.
        Mirrors `lares sense analyze --lens <lens>`. Five lenses read the poured sensorium;
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

    def flow(petname: "str | None" = None, target: "list | None" = None,
             signal: "list | None" = None, names: "list | None" = None,
             sensorium: "str | None" = None) -> dict:
        # THE SEAT'S OWN ACT FOR lar:///sense.record.flows: the vessel binds its args against the carrier and answers handler/seat;
        # this function keeps behaviour alone, and the carrier holds its words.
        return _call("flow", sensorium, petname=petname, targets=target, rows=signal, names=names)

    def plane_record(cid: str, sensorium: "str | None" = None) -> dict:
        """Read a record across the sensorium planes.
        The cross-plane witness: one cid -> presence + payload summary across content,
        structure and form (honest nulls where a plane lacks it). `sensorium` names the sensorium
        (absent → memory)."""
        return _call("plane_record", sensorium, cid)

    def wiki(verb: str, slug: "str | None" = None) -> dict:
        """The worn face's live wiki and keep list: `switch`, `keep` or `unkeep` one wiki by `slug`."""
        allowed = {"switch", "keep", "unkeep"}
        if verb not in allowed:
            raise SeatArgumentRefused(f"wiki: `verb` must be one of {sorted(allowed)}, got {verb!r}")
        if not slug:
            raise SeatArgumentRefused("wiki: slug required")
        return uds.output({"switch": "wiki-switch", "keep": "wiki-keep", "unkeep": "wiki-unkeep"}[verb], {"slug": slug})

    # ── the MEME namespace — the container law and the wire every content tool rides (a family writes through `tiddler_put`) ──

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
        """THE ENGINE VERBS' CONTAINER: a wiki. These verbs run in a wiki's own engine (a filter, a render, a status, an
        admitted action), so they name `recipe` alone; a bag names one store and no wiki, and its reads ride `tiddler_get`
        (one record; `meme=True` a meme, title-less its roots), its writes `tiddler_put(bag=...)` and `tiddler_delete(bag=...)`."""
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
        # NO SILENT LOSS (sealed-store#/owed): a write whose save waits unsealed, or refused outright, carries the vessel's
        # `rest` band; every MCP write rides this one wire, so each answers `owed` naming the band, never a bare ok.
        owed = uds.owed_error(verb, out.get("rest"), summary.get("output"))
        if owed is not None:
            raise owed
        return summary.get("output")

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

    def meme_project(uri: str, to: str, recipe: "str | None" = None, bag: "str | None" = None) -> dict:
        """Render the meme the island holds at its `lar:` `uri` to a target — mirrors `lares meme project
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
    def _names(verb: str, key: str, value) -> "list | None":
        if value is None:
            return None
        if isinstance(value, str):
            value = [part.strip() for part in value.split(",")]
        if not isinstance(value, list) or not all(isinstance(n, str) for n in value):
            raise SeatArgumentRefused(f"{verb}: `{key}` takes a list of field names, got {value!r}")
        return [n for n in value if n]

    def wiki_render(title: "str | None" = None, text: "str | None" = None, recipe: "str | None" = None,
                    form: str = "text", type: "str | None" = None,  # noqa: A002 — the tiddler field's own name
                    after: "str | None" = None, max_bytes: "int | None" = None, target: "str | None" = None,
                    output: "str | None" = None) -> dict:
        """Wikify through the wiki's own engine: a tiddler by `title`, or a wikitext span passed as `text` (exactly one
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

    def wiki_status(recipe: "str | None" = None, target: "str | None" = None) -> dict:
        """Survey wiki residency and layer access.
        Without a recipe, survey the catalog, activation and vessel residency. With a recipe, NAME EACH LAYER THE WIKI COMPOSES AND WHETHER THIS SESSION'S FACE READS AND WRITES IT — mirrors `lares wiki
        status`. Returns {recipe, working, layers: [{bag, mounted, read, write, working?, why?}]}: `working` names the
        layer every `tiddler_put` with `recipe` lands in (null where none stands attached); each layer reads `mounted`
        "writable", "read-only" or "promotion-only" (a canon layer: a write reaches it by action verb alone, never by a put),
        the face's own `read` and `write`, and `why` where a mounted-writable layer still refuses this face. Read it before a write to learn where the write lands. CONTAINER: `recipe` names the wiki (a bag names no wiki and takes no engine verb): `recipe="default"` names the worn face's daemon wiki, `recipe=<slug>` any wiki this face reaches (one it hosts or one shared to it), answered in that wiki's own engine; a wiki it reaches none of refuses `wiki-unreached`. A LIT FACE RECEIVES VISITS: `target` names another lit face this read visits, by handle index (`"h1"`, `"1"`) or by its pet name, while the seat keeps the face it wears; the answer names the face it read (`face`) and the face worn (`worn`). A visit reads that face's daemon wiki (`recipe="default"`) through a view of its canon and working layer, never its personal or draft layer (private: a title only there reads absent, a personal or draft bag refuses `cross-face-private`); a shut face refuses `face-not-open`; a visit takes no write."""
        if recipe is None:
            if target is not None:
                raise SeatArgumentRefused("wiki_status: target requires recipe")
            return {"catalog": uds.output("list-wikis", {}), "activation": uds.output("wiki-active", {}),
                    "residency": {"scope": "vessel", **uds.output("residency", {})}}
        return _meme_wire("wiki-status", {**_wiki_container("wiki_status", recipe), **_target(target)})

    def ddate(format: "str | None" = None, day: "int | None" = None, month: "int | None" = None,
              year: "int | None" = None) -> dict:
        # THE SEAT'S OWN ACT FOR lar:///oracle.calendar.dates: the vessel binds its args against the carrier and answers handler/seat;
        # this function keeps behaviour alone, and the carrier holds its words.
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

    def oracle_cast(recipe: "str | None" = None, bag: "str | None" = None, coins: "list | None" = None,
                    caster: "str | None" = None, asking: "str | None" = None, uncertain: "str | None" = None,
                    observe: "list | str | None" = None, by: "str | None" = None) -> dict:
        # THE SEAT'S OWN ACT FOR lar:///library.oracle.speaks: the vessel binds its args against the carrier and answers handler/seat;
        # this function keeps behaviour alone, and the carrier holds its words.
        import datetime
        args: dict = dict(_meme_container("oracle_cast", recipe, bag))
        if coins is not None:
            if (not isinstance(coins, list) or len(coins) != 6
                    or not all(isinstance(v, int) and not isinstance(v, bool) and v in (6, 7, 8, 9) for v in coins)):
                raise SeatArgumentRefused("oracle_cast: `coins` names six line values of 6, 7, 8 or 9, bottom line first")
            args["coins"] = list(coins)
        args["caster"] = caster.strip() if isinstance(caster, str) and caster.strip() else "agent"
        # THE KIND RIDES AS DATA: `by` names the library shelf (library/oracles/<kind>/, default e-jing); the vessel reads the
        # method the shelf declares and refuses an unknown kind or an unrun method by name, the shelves that stand in its cure.
        if by is not None:
            if not isinstance(by, str) or not by.strip():
                raise SeatArgumentRefused("oracle_cast: `by` names a library shelf, e.g. e-jing or doa")
            if by.strip() != "e-jing":
                args["by"] = by.strip()
        if isinstance(asking, str) and asking.strip():
            args["asking"] = asking.strip()
        if isinstance(uncertain, str) and uncertain.strip():
            args["uncertain"] = uncertain.strip()
        if observe is not None:
            pointers = observe.split() if isinstance(observe, str) else observe
            if not isinstance(pointers, list) or not all(isinstance(x, str) for x in pointers):
                raise SeatArgumentRefused("oracle_cast: `observe` names context pointers, a list of strings or one line")
            pointers = [x.strip() for x in pointers if x.strip()]
            if pointers:
                args["observe"] = pointers
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

    def law_index(limit: "int | None" = None, after: "str | None" = None, all: bool = False) -> dict:
        # THE SEAT'S OWN ACT FOR lar:///engine.law.indexes: the vessel binds its args against the carrier and answers handler/seat;
        # this function keeps behaviour alone, and the carrier holds its words.
        pins = _law_titles(LAW_PINS_FILTER)
        pinned = set(pins)
        rows: list = []
        page: dict = {}
        cursor = after or None
        while True:
            args: dict = {"recipe": "default", "filter": LAW_INDEX_FILTER, "fields": list(LAW_ROW_FIELDS)}
            if limit is not None:
                args["limit"] = limit
            if cursor:
                args["after"] = cursor
            page = _meme_wire("wiki-filter", args) or {}
            rows.extend({"title": r.get("title"), "description": _law_line(r.get("fields")), "pinned": r.get("title") in pinned}
                        for r in (page.get("rows") or []))
            nxt = page.get("next")
            # `all` follows every cursor to the end, as `lares law index --all` does; otherwise one page answers.
            if not all or not nxt or nxt == cursor:
                break
            cursor = nxt
        total = page.get("total")
        return {"filter": LAW_INDEX_FILTER, "pinsTitle": LAW_PINS_TITLE, "pins": pins,
                "rows": rows, "total": total if isinstance(total, int) else len(rows), "next": page.get("next") or None}

    def law_pin(uri: str) -> dict:
        # THE SEAT'S OWN ACT FOR lar:///engine.law.pins: the vessel binds its args against the carrier and answers handler/seat;
        # this function keeps behaviour alone, and the carrier holds its words.
        return _law_move("law_pin", _law_uri("law_pin", uri), "pin")

    def law_unpin(uri: str) -> dict:
        # THE SEAT'S OWN ACT FOR lar:///engine.law.unpins: the vessel binds its args against the carrier and answers handler/seat;
        # this function keeps behaviour alone, and the carrier holds its words.
        return _law_move("law_unpin", _law_uri("law_unpin", uri), "unpin")

    # ── THE HEARTH ROSTER — who is home, the vessel's own reading ──

    def vessel_roster() -> dict:
        """Read WHO IS HOME — mirrors `lares vessel roster --json`. The vessel answers from what it holds now and places
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

    # ── THE DISK SHORE — what stands for a hand, and the vessel's whole-island flush ──

    def shore(face: "int | None" = None, bag: "str | None" = None) -> dict:
        # THE SEAT'S OWN ACT FOR lar:///carriage.disk.reads: the vessel binds its args against the carrier and answers handler/seat;
        # this function keeps behaviour alone, and the carrier holds its words.
        args: dict = {"op": "list"}
        if face is not None:
            if not isinstance(face, int) or isinstance(face, bool) or face < 0:
                raise SeatArgumentRefused("face-malformed: shore: `face` names a handle index (a whole number from 0), as `shore(face=2)`")
            args["face"] = face
        if bag is not None:
            args["bag"] = bag
        islands = ("daemon",) if face is not None else SHORE_ISLANDS
        standoffs: list = []
        pending: list = []
        def unpaged(island, why):
            return uds.LaresVerbError(f"shore-list-unpaged: the {island} island: {why}")

        # EVERY PAGE OF EACH ISLAND, under readShoreList's guards (lares-cli shore-core): rows where a count stands, a page with no
        # mark, a cursor that stands still or rows short of the counts refuse `shore-list-unpaged`; a mark that moves refuses
        # `shore-list-moved`. A list never states a shore nobody measured.
        for island in islands:
            after = None
            mark = None
            counts = None
            got_s: list = []
            got_p: list = []
            while True:
                page_args = {**args, **({"after": after} if after is not None else {})}
                out = (_meme_wire("wiki-act", {"verb": SHORE_VERB, "args": page_args}) if island == "wiki"
                       else _meme_wire(SHORE_VERB, page_args)) or {}
                if out.get("ok") is False:
                    if out.get("refusal") == "no-disk-shore":
                        break
                    raise uds.LaresVerbError(f"{out.get('refusal') or 'shore-refused'}: the {island} island: {out.get('why') or 'refused'}")
                for name in ("standoffs", "pending"):
                    if not isinstance(out.get(name), list):
                        raise unpaged(island, f"the shore's {name} arrived as a count and named none of them; this vessel answers an unpaged list")
                if not isinstance(out.get("mark"), str):
                    raise unpaged(island, "the shore's page named no mark of the shore it read")
                if mark is not None and out["mark"] != mark:
                    raise uds.LaresVerbError(f"shore-list-moved: the {island} island's shore moved while the read walked its pages; read it again")
                mark = out["mark"]
                counts = (out.get("standoffCount"), out.get("pendingCount"))
                got_s.extend({**r, "island": island} for r in out["standoffs"])
                got_p.extend({**r, "island": island} for r in out["pending"])
                nxt = out.get("next")
                if not isinstance(nxt, str) or nxt == "":
                    break
                if after is not None and nxt <= after:
                    raise unpaged(island, "the shore's cursor stood still between two pages")
                after = nxt
            if counts is not None and counts != (len(got_s), len(got_p)):
                raise unpaged(island, f"the shore counted {counts[0]}/{counts[1]} standoffs/pending and its pages named {len(got_s)}/{len(got_p)}")
            standoffs.extend(got_s)
            pending.extend(got_p)
        return {"standoffs": standoffs, "standoffCount": len(standoffs), "pending": pending, "pendingCount": len(pending),
                **({"face": face} if face is not None else {})}

    def shore_flush() -> dict:
        # THE SEAT'S OWN ACT FOR lar:///carriage.disk.flushes: the vessel binds its args against the carrier and answers handler/seat;
        # this function keeps behaviour alone, and the carrier holds its words.
        answer = uds.custody_frame({"op": "shore-flush"}, timeout=60.0)
        if answer.get("status") == "error":
            raise uds.LaresVerbError(str((answer.get("refusal") or {}).get("reason") or answer.get("errorMessage") or "shore-flush refused")
                                     + (f": {answer.get('errorMessage')}" if answer.get("errorMessage") else ""))
        reading = answer.get("reading")
        if answer.get("op") != "shore-flush" or not isinstance(reading, dict):
            raise uds.LaresVerbError("shore-flush: the vessel answered no flush reading")
        return reading

    _SLOT_PATH = re.compile(r"^#/[^\s#$/]+(?:/[^\s#$/]+)*$")

    def _slot_title(verb: str, title: str, slot: "str | None") -> str:
        """THE SLOT FOLDS INTO THE TITLE, as the CLI's `--slot` folds: `slot="#/x"` names the record `<title>#/x`. A malformed
        path refuses `slot-malformed`; a slot beside a title that already names one refuses `slot-beside-fragment`."""
        if slot is None or not str(slot).strip():
            return title
        slot = str(slot).strip()
        if not _SLOT_PATH.match(slot):
            raise SeatArgumentRefused(f"slot-malformed: {verb} takes `slot` as a slot path such as \"#/notes\" or \"#/notes/today\" "
                                      f"(got {slot!r}); `tiddler_get(meme=True, tree=True, recipe=...)` names the slots a family holds")
        if "#" in title:
            raise SeatArgumentRefused(f"slot-beside-fragment: {title} already names a slot; drop `slot`, or name the root "
                                      f"as `title` with slot={slot!r}")
        return f"{title}{slot}"

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

    def meme_offer(uris: list, bag: str, nexus: "str | None" = None) -> dict:
        """Offer records from the worn face's working layer toward a house-canon `bag` — mirrors `lares meme offer <uri…>
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

    def meme_offer_show(cid: "str | None" = None, bag: "str | None" = None, all: bool = False,
                        after: "str | None" = None, limit: "int | None" = None, nexus: "str | None" = None) -> dict:
        """Show offers at two grains — mirrors `lares meme offer show [<cid>]`. Without a CID, reads a bounded page
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

    def kahua_propose(proposals: list, face: "int | None" = None, session: "str | None" = None) -> dict:
        # THE SEAT'S OWN ACT FOR lar:///face.draft.proposes: the vessel binds its args against the carrier and answers handler/seat;
        # this function keeps behaviour alone, and the carrier holds its words.
        if not isinstance(proposals, list) or not proposals:
            raise SeatArgumentRefused("kahua_propose: name `proposals` as a non-empty list of {title, revision, text|digest, taint}")
        args: dict = {"proposals": proposals}
        if session:
            args["session"] = session
        return uds.session_act("kahua-propose", args, face=_kahua_face(face))

    def kahua_stage(title: str, text: str, fields: "dict | None" = None, face: "int | None" = None) -> dict:
        # THE SEAT'S OWN ACT FOR lar:///face.draft.stages: the vessel binds its args against the carrier and answers handler/seat;
        # this function keeps behaviour alone, and the carrier holds its words.
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

    def kahua_get(title: "str | None" = None, history: bool = False, face: "int | None" = None,
                  after: "str | None" = None, limit: "int | None" = None) -> dict:
        # THE SEAT'S OWN ACT FOR lar:///face.draft.reads: the vessel binds its args against the carrier and answers handler/seat;
        # this function keeps behaviour alone, and the carrier holds its words.
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

    def roster(name: "str | None" = None) -> dict:
        """Roster at two grains — bare: every durable sensorium + its lifecycle facet (state · caps · half-life ·
        retirement); `name`: that one sensorium's full manifest facets (caps · coupling · apertures · retirement).
        Mirrors `lares sense roster [<name>]`. A read (HOTL). Routes over the @daemon wire."""
        if name:
            return uds.output("inspect", {"name": name})
        return uds.output("roster", {})

    def build(name: str, half_life: "int | None" = None) -> dict:
        """Build a fresh EPHEMERAL pioneer sensorium (agent self-service; a retire undoes it → HOTL). Refuses
        a name-collision LOUD. Mirrors `lares sense build <name> --ephemeral`; `half_life` tunes the hardening
        decay (default the house floor)."""
        args: dict = {"name": name}
        if half_life is not None:
            args["halfLife"] = half_life
        return uds.output("build", args)

    def reconcile(name: "str | None" = None, all: bool = False) -> dict:
        """Reconcile — re-settle one sensorium (`name`) or every sensorium (`all`) against its evidence
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

    # THE SEAT'S OWN ACTS, BY ADDRESS (fork 10): the vessel binds each against its carrier's #/takes and answers
    # `handler/seat` with the bound args; the seat runs the handler here, in its own process.
    seat_acts = {
        "lar:///sense.capture.pours": pour, "lar:///sense.memory.recalls": recall, "lar:///sense.taxonomy.counts": status,
        "lar:///sense.worldline.reads": worldline, "lar:///sense.kapae.mutes": kapae, "lar:///sense.kapae.restores": un_kapae,
        "lar:///sense.rhythm.analyzes": analyze, "lar:///sense.record.flows": flow, "lar:///sense.plane.reads": plane_record,
        "lar:///sense.roster.reads": roster, "lar:///sense.pioneer.builds": build, "lar:///sense.source.reconciles": reconcile,
        "lar:///engine.wiki.switches": lambda slug: wiki("switch", slug), "lar:///engine.wiki.keeps": lambda slug: wiki("keep", slug),
        "lar:///engine.wiki.unkeeps": lambda slug: wiki("unkeep", slug),
        "lar:///engine.meme.projects": meme_project, "lar:///engine.wiki.renders": wiki_render, "lar:///engine.layer.reads": wiki_status,
        "lar:///oracle.calendar.dates": ddate, "lar:///library.oracle.speaks": oracle_cast,
        "lar:///engine.law.indexes": law_index, "lar:///engine.law.pins": law_pin, "lar:///engine.law.unpins": law_unpin,
        "lar:///face.roster.reads": vessel_roster, "lar:///carriage.disk.reads": shore, "lar:///carriage.disk.flushes": shore_flush,
        "lar:///realm.offer.signs": meme_offer, "lar:///realm.offer.shows": meme_offer_show,
        "lar:///face.draft.proposes": kahua_propose, "lar:///face.draft.stages": kahua_stage, "lar:///face.draft.reads": kahua_get,
    }
    mcp.seat_acts = seat_acts

    def _run_seat(address: str, bound: dict):
        """Run one seat act with the args the vessel bound: each neutral name in its Python spelling, the handler's own names alone
        (a shared row's default the handler takes no word for stays at the vessel)."""
        import inspect
        handler = seat_acts.get(address)
        if handler is None:
            raise SeatVerbOwed(f"seat-act-unheld: the vessel answered handler/seat for {address}, and this seat holds no handler "
                               "for it; read its carrier with get(title=\"" + address + "\", aperture=\"measure\")")
        names = set(inspect.signature(handler).parameters)
        kwargs = {k.replace("-", "_"): v for k, v in (bound or {}).items()}
        return handler(**{k: v for k, v in kwargs.items() if k in names})

    def _door(word: str, params: dict, tool: "str | None" = None):
        """THE ONE CALL (landing 11): every tool sends `{verb, params}` to the vessel's `call`; the vessel resolves the address
        through the caller's stack, binds the params against the carrier's live #/takes, checks the hand, and answers.
        A record tool sends its own address and takes an answer from that class alone (`tool-class-crossed`), and a record write
        the vessel answers without landing raises by name. A `handler/seat` answer runs here, a `_` carry only where the seat
        act walks a dry path in code (`SEAT_DRY`); a `handler/host` answer names the terminal's command."""
        out = _meme_wire("call", {"verb": word, "params": params, "surface": "mcp"})
        answered = answered_address(out)
        if tool is not None and answered is not None and answered not in RECORD_ADDRESSES[tool]:
            raise SeatArgumentRefused(f"tool-class-crossed: `{tool}` answers from {' or '.join(RECORD_ADDRESSES[tool])} alone, and the "
                                      f"stack answered {answered}; run that affordance by name with act(address=\"{answered}\")")
        if isinstance(out, dict) and out.get("handler") == "seat":
            address = str(out.get("address") or word)
            carry = (out.get("mu") or {}).get("carry") if isinstance(out.get("mu"), dict) else None
            if isinstance(carry, str) and "_" in carry and address not in SEAT_DRY:
                raise SeatArgumentRefused(f"mu-cell-empty: {address} walks no dry path in this seat, so a {carry} call lands nothing; "
                                          f"the plain call (no mu) lands the act")
            return _run_seat(address, out.get("params") or {})
        # AN UNLANDED WRITE RAISES BY THE CLASS THAT ANSWERED: the record write's address, whichever tool (or `act`) asked.
        writer = tool if tool in ("put", "delete", "rename") else next(
            (name for name in ("put", "delete", "rename") if answered in RECORD_ADDRESSES[name]), None)
        if writer is not None:
            refusal = unlanded_refusal(writer, out)
            if refusal is not None:
                raise uds.LaresVerbError(refusal)
        if isinstance(out, dict) and out.get("handler") == "host":
            address = str(out.get("address") or word)
            raise SeatArgumentRefused(f"host-door: {address} runs at a terminal's own door (it reads host files or asks y/N); "
                                      f"ask the operator to run `lares act {address} ...` on their own terminal")
        return out

    def aperture_reaches_whole(raw) -> bool:
        """True where an aperture reads arc or theme: `arc`, `theme`, `16/arc`, or a number 13 to 20."""
        text = str(raw or "").strip().lower()
        if text == "":
            return False
        head, _, rank = text.partition("/")
        if rank:
            return rank in ("arc", "theme")
        if head.isdigit():
            return 13 <= int(head) <= 20
        return head in ("arc", "theme")

    def _params(named: dict, more: "dict | None") -> dict:
        """The call's params in their neutral names: the named ones a tool declares, then any others the carrier takes."""
        merged = {k.replace("_", "-"): v for k, v in (more or {}).items()}
        merged.update({k.replace("_", "-"): v for k, v in named.items() if v is not None})
        return merged

    reads = ToolAnnotations(readOnlyHint=True, destructiveHint=False, idempotentHint=True, openWorldHint=False)
    writes = ToolAnnotations(readOnlyHint=False, destructiveHint=True, idempotentHint=False, openWorldHint=False)

    @mcp.tool(annotations=reads)
    def get(title: "str | None" = None, filter: "str | None" = None, mu: "str | None" = None,  # noqa: A002 — TiddlyWiki's own word
            aperture: "str | None" = None, recipe: "str | None" = None, bag: "str | None" = None, slot: "str | None" = None,
            after: "str | None" = None, params: "dict | None" = None) -> dict:
        bound = _params({"title": title, "filter": filter, "mu": mu, "aperture": aperture, "recipe": recipe, "bag": bag, "slot": slot,
                         "after": after}, params)
        address = record_address("get", bound)
        first = _door(address, bound, "get")
        # THE WHOLE RIDES THE RANGE DIAL (the keypad head): aperture arc or theme (13 and past) follows every page; mu names the lens.
        if address != RECORD_ADDRESSES["get"][0] or not aperture_reaches_whole(bound.get("aperture")):
            return first
        return whole_carrier(first, lambda cursor: _door(address, {**bound, "after": cursor}, "get"))

    @mcp.tool(annotations=writes)
    def put(title: str, text: "str | None" = None, append: "str | None" = None, fields: "dict | None" = None,
            base: "str | None" = None, create: "bool | None" = None, mu: "str | None" = None, recipe: "str | None" = None,
            bag: "str | None" = None, params: "dict | None" = None) -> dict:
        return _door(RECORD_ADDRESSES["put"][0], _params({"title": title, "text": text, "append": append, "fields": fields, "base": base,
                                                        "create": create, "mu": mu, "recipe": recipe, "bag": bag}, params), "put")

    @mcp.tool(annotations=writes)
    def delete(title: str, way: "str | None" = None, family: "bool | None" = None, base: "str | None" = None,
               mu: "str | None" = None, recipe: "str | None" = None, bag: "str | None" = None, params: "dict | None" = None) -> dict:
        return _door(RECORD_ADDRESSES["delete"][0], _params({"title": title, "way": way, "family": family, "base": base, "mu": mu,
                                                           "recipe": recipe, "bag": bag}, params), "delete")

    @mcp.tool(annotations=writes)
    def rename(title: str, to: str, base: "str | None" = None, mu: "str | None" = None, recipe: "str | None" = None,
               params: "dict | None" = None) -> dict:
        return _door(RECORD_ADDRESSES["rename"][0], _params({"title": title, "to": to, "base": base, "mu": mu, "recipe": recipe}, params), "rename")

    @mcp.tool(annotations=ToolAnnotations(readOnlyHint=False, destructiveHint=True, idempotentHint=False, openWorldHint=True))
    def act(address: str, args: "dict | None" = None) -> dict:
        if not isinstance(address, str) or not address.strip():
            raise SeatArgumentRefused("act: name an affordance `address`, e.g. lar:///engine.law.indexes")
        return _door(address.strip(), _params({}, args))

    # THE WORDS LIVE IN THE CARRIERS: each tool's description renders from the pack (the carriers' mcp wholes), the act's from
    # every carrier the seat reaches.
    descriptions = {
        "get": ["lar:///engine.record.reads", "lar:///engine.filter.pages"], "put": ["lar:///engine.record.puts"],
        "delete": ["lar:///engine.record.removes"], "rename": ["lar:///engine.record.renames"],
    }
    manager = getattr(mcp, "_tool_manager", None)
    for tool, addresses in descriptions.items():
        held = manager.get_tool(tool) if manager is not None else None
        words = [line for a in addresses for line in carrier_words(a, pack)]
        if held is not None and words:
            held.description = "\n".join(words)
    held = manager.get_tool("act") if manager is not None else None
    if held is not None:
        held.description = act_description(pack)
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
