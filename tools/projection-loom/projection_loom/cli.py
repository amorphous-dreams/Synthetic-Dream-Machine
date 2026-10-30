"""Command-line interface for solid-grown production models."""
from __future__ import annotations
import argparse,json
from pathlib import Path
import numpy as np
from .pipeline import Project
from .evolution import Evolution
from .render import silhouette
from .relations import PetNameLedger, RelationWitness


def _save(path,value):
    p=Path(path);p.parent.mkdir(parents=True,exist_ok=True)
    p.write_text(json.dumps(value,indent=2))


def main(argv=None):
    parser=argparse.ArgumentParser(prog='projection-loom',description='Grow and evolve CAD-solid architectures')
    commands=parser.add_subparsers(dest='command',required=True)
    for name in ('grow','validate','evolve','epoch-loop','discover'):
        p=commands.add_parser(name)
        p.add_argument('--project',type=Path,required=True)
        p.add_argument('--out',type=Path,required=True)
        p.add_argument('--genome',type=Path,help='JSON construction genome; never an imported mesh')
        p.add_argument('--identity-ledger',type=Path,help='optional operator-authored pet-name ledger')
        if name in ('grow','evolve','epoch-loop'):p.add_argument('--export-size',nargs=2,type=int,default=[1024,1536])
        if name in ('evolve','epoch-loop'):
            p.add_argument('--burst',type=int,default=32)
            p.add_argument('--survivors',type=int,default=6)
            p.add_argument('--offspring',type=int,default=5)
            p.add_argument('--seed',type=int,default=4811)
            p.add_argument('--slack-fraction',type=float,default=.20,
                           help='fraction of survivors reserved for novel valid phenotypes')
        if name=='epoch-loop':p.add_argument('--passes',type=int,default=5)
    p=commands.add_parser('ground-init', help='Create an empty causal relational ground')
    p.add_argument('--location', required=True)
    p.add_argument('--out', type=Path, required=True)
    p=commands.add_parser('ground-apply', help='Apply a typed causal edit or refuse conflicts')
    p.add_argument('--ground', type=Path, required=True)
    p.add_argument('--edit', type=Path, required=True)
    p.add_argument('--out', type=Path, required=True)
    p=commands.add_parser('ground-inspect', help='Inspect causal frontier and semantic entities')
    p.add_argument('--ground', type=Path, required=True)
    p=commands.add_parser('scene-package', help='Export accepted native geometry as portable OpenUSD and STEP')
    p.add_argument('--declaration', type=Path, required=True)
    p.add_argument('--out', type=Path, required=True)
    p=commands.add_parser('scene-validate', help='Audit portable scene and STEP evidence')
    p.add_argument('--bundle', type=Path, required=True)
    p=commands.add_parser('scene-invalidation', help='Compare selective native/scene rebuild dependencies')
    p.add_argument('--before', type=Path, required=True, help='prior authored scene declaration')
    p.add_argument('--after', type=Path, required=True, help='new authored scene declaration')
    p=commands.add_parser('editor-seed', help='Bind authored scene assemblies to persistent causal entities')
    p.add_argument('--declaration', type=Path, required=True)
    p.add_argument('--out', type=Path, required=True)
    p=commands.add_parser('editor-apply', help='Reconcile typed edit and regenerate native scene')
    p.add_argument('--declaration', type=Path, required=True)
    p.add_argument('--ground', type=Path, required=True)
    p.add_argument('--bundle', type=Path, required=True)
    p.add_argument('--proposal', type=Path, required=True)
    p.add_argument('--out', type=Path, required=True)
    p=commands.add_parser('regulative-control', help='Matched native fixed-vs-site-responsive OODA-HA trial')
    p.add_argument('--growth', type=Path, required=True)
    p.add_argument('--fill', type=float, default=.52)
    p.add_argument('--out', type=Path, required=True)
    p=commands.add_parser('scene-variants', help='Compose independently witnessed USD candidate alternatives')
    p.add_argument('--specification', type=Path, required=True)
    p.add_argument('--out', type=Path, required=True)
    p=commands.add_parser('scene-variants-validate', help='Inspect portable USD alternatives')
    p.add_argument('--comparison', type=Path, required=True)
    p=commands.add_parser('location-init',help='Bind independent source/frame inventory to native causal scene')
    p.add_argument('--inventory',type=Path,required=True)
    p.add_argument('--declaration',type=Path,required=True)
    p.add_argument('--out',type=Path,required=True)
    p=commands.add_parser('location-support',help='Fork a verified native contact into a causal location')
    p.add_argument('--workspace',type=Path,required=True)
    p.add_argument('--proposal',type=Path,required=True)
    p.add_argument('--out',type=Path,required=True)
    p=commands.add_parser('location-edit',help='Fork a source-bound OODA-HA native edit island')
    p.add_argument('--workspace',type=Path,required=True)
    p.add_argument('--proposal',type=Path,required=True)
    p.add_argument('--out',type=Path,required=True)
    p=commands.add_parser('location-review',help='Record an attributed decision about a verified native location')
    p.add_argument('--workspace',type=Path,required=True)
    p.add_argument('--actor',required=True)
    p.add_argument('--decision',choices=('accept','abstain','dissent'),required=True)
    p.add_argument('--reason',default='')
    p.add_argument('--out',type=Path,required=True)
    p=commands.add_parser('location-review-verify',help='Verify an attributed location review receipt')
    p.add_argument('--workspace',type=Path,required=True)
    p.add_argument('--receipt',type=Path,required=True)
    p=commands.add_parser('location-verify',help='Reaudit source, causal and native location evidence')
    p.add_argument('--workspace',type=Path,required=True)
    p=commands.add_parser('registered-ablation',
                          help='Two-arm matched multi-generation CAD experiment with independent calibrated source views')
    p.add_argument('--image-group',type=Path,required=True)
    p.add_argument('--intent',type=Path,required=True)
    p.add_argument('--out',type=Path,required=True)
    p.add_argument('--epochs',type=int,default=2)
    p.add_argument('--offspring',type=int,default=3)
    p.add_argument('--exact-budget',type=int,default=3)
    p.add_argument('--finalists',type=int,default=2)
    p.add_argument('--seed',type=int,default=41)
    p=commands.add_parser('fire-place-bind',help='Bind selected original Fire relation into typed spatial place intent')
    p.add_argument('--plan',type=Path,required=True)
    p.add_argument('--intent',type=Path,required=True)
    p.add_argument('--genome',type=Path,required=True)
    p.add_argument('--alternative',required=True)
    p.add_argument('--witness-id',required=True)
    p.add_argument('--actor',required=True)
    p.add_argument('--seed-sha256')
    p.add_argument('--out',type=Path,required=True)
    p=commands.add_parser('fire-place-verify',help='Independently verify original Fire/intent/native binding')
    p.add_argument('--binding',type=Path,required=True)
    p.add_argument('--plan',type=Path,required=True)
    p.add_argument('--intent',type=Path,required=True)
    p.add_argument('--genome',type=Path,required=True)
    p=commands.add_parser('place-run',help='Grow source-bound architectural locations under one OODA-HA journal')
    p.add_argument('--inventory',type=Path,required=True)
    p.add_argument('--intent',type=Path,required=True)
    p.add_argument('--spatial',type=Path,required=True)
    p.add_argument('--genome',type=Path,required=True)
    p.add_argument('--out',type=Path,required=True)
    p.add_argument('--epochs',type=int,default=2)
    p.add_argument('--offspring',type=int,default=3)
    p.add_argument('--exact-budget',type=int,default=2)
    p.add_argument('--seed',type=int,default=41)
    p=commands.add_parser('place-continue',help='Grow the next study from an explicitly accepted review')
    p.add_argument('--campaign',type=Path,required=True)
    p.add_argument('--review',type=Path,required=True)
    p.add_argument('--intent',type=Path,required=True)
    p.add_argument('--spatial',type=Path,required=True)
    p.add_argument('--out',type=Path,required=True)
    p.add_argument('--epochs',type=int,default=2)
    p.add_argument('--offspring',type=int,default=3)
    p.add_argument('--exact-budget',type=int,default=2)
    p.add_argument('--seed',type=int,default=41)
    p=commands.add_parser('place-gallery',help='Render six synthetic orthographic views from independently verified STEP locations')
    p.add_argument('--campaign',type=Path,required=True)
    p.add_argument('--out',type=Path,required=True)
    p=commands.add_parser('place-gallery-verify',help='Re-render original shared-camera STEP location gallery')
    p.add_argument('--campaign',type=Path,required=True)
    p.add_argument('--gallery',type=Path,required=True)
    p=commands.add_parser('place-compare',help='Publish native evidence for comparable operator review')
    p.add_argument('--campaign',type=Path,required=True)
    p.add_argument('--out',type=Path,required=True)
    p=commands.add_parser('place-compare-verify',help='Independently re-audit a previously published place comparison')
    p.add_argument('--campaign',type=Path,required=True)
    p.add_argument('--receipt',type=Path,required=True)
    p=commands.add_parser('place-verify',help='Re-audit the native source and all candidate aftermath')
    p.add_argument('--campaign',type=Path,required=True)
    p=commands.add_parser('place-candidate-review',help='Write operator-attributed review of one admitted location')
    p.add_argument('--campaign',type=Path,required=True)
    p.add_argument('--candidate',required=True)
    p.add_argument('--actor',required=True)
    p.add_argument('--decision',choices=('accept','abstain','dissent'),required=True)
    p.add_argument('--reason',default='')
    p.add_argument('--out',type=Path,required=True)
    p=commands.add_parser('native-support-propose',
                          help='Check exact BRep bearing contact and propose typed causal support')
    p.add_argument('--ground',type=Path,required=True)
    p.add_argument('--bundle',type=Path,required=True)
    p.add_argument('--lower',required=True)
    p.add_argument('--upper',required=True)
    p.add_argument('--out',type=Path,required=True)
    p=commands.add_parser('native-support-reparent',
                          help='Propose independent dual-contact native support reparent')
    p.add_argument('--ground',type=Path,required=True)
    p.add_argument('--bundle',type=Path,required=True)
    p.add_argument('--old-parent',required=True)
    p.add_argument('--new-parent',required=True)
    p.add_argument('--child',required=True)
    p.add_argument('--out',type=Path,required=True)
    p=commands.add_parser('native-support-verify',
                          help='Recheck geometric contact and replay source-ground relation')
    p.add_argument('--ground',type=Path,required=True)
    p.add_argument('--bundle',type=Path,required=True)
    p.add_argument('--proposal',type=Path,required=True)
    p=commands.add_parser('registered-inventory',
                          help='Admit independent measured image/camera/survey sources into one location')
    p.add_argument('--image-group',type=Path,required=True)
    p.add_argument('--location',required=True)
    p.add_argument('--out',type=Path,required=True)
    p=commands.add_parser('full-location-crucible',
                          help='Source-calibrated native support, causal edit, cache and USD alternatives')
    p.add_argument('--image-group',type=Path,required=True)
    p.add_argument('--declaration',type=Path,required=True)
    p.add_argument('--lower',required=True)
    p.add_argument('--upper',required=True)
    p.add_argument('--move',required=True)
    p.add_argument('--delta',type=float,nargs=3,required=True)
    p.add_argument('--out',type=Path,required=True)
    p=commands.add_parser('registered-replicates',
                          help='Run repeated paired registered versus source-withheld native campaigns')
    p.add_argument('--image-group',type=Path,required=True)
    p.add_argument('--intent',type=Path,required=True)
    p.add_argument('--out',type=Path,required=True)
    p.add_argument('--seeds',type=int,nargs='+',default=[41,73,101])
    p.add_argument('--epochs',type=int,default=2)
    p.add_argument('--offspring',type=int,default=2)
    p.add_argument('--exact-budget',type=int,default=2)
    p.add_argument('--finalists',type=int,default=1)
    p=commands.add_parser('wide-epoch',help='Resumable staged constructive epochs')
    p.add_argument('--project',type=Path,required=True)
    p.add_argument('--out',type=Path,required=True)
    p.add_argument('--passes',type=int,default=3)
    p.add_argument('--candidates',type=int,default=9)
    p.add_argument('--exact-budget',type=int,default=6)
    p.add_argument('--detail-budget',type=int,default=3)
    p.add_argument('--topology-locus',action='append',default=[])
    p.add_argument('--seed',type=int,default=41)
    p.add_argument('--location-stack',type=Path)
    p.add_argument('--identity-ledger',type=Path)
    p.add_argument('--max-depth',type=int,default=12,help='optional nested inquiry depth budget')
    p.add_argument('--max-loops',type=int,default=4096,help='bounded session loop count')
    p.add_argument('--llm-provider',choices=['none','ollama','openai-compatible'],default='none',
                   help='opt-in LLM advice; without this, the Operator can still steer through the inbox')
    p.add_argument('--llm-model',help='provider model name; required when provider enabled')
    p.add_argument('--llm-endpoint',help='optional explicitly trusted HTTP(S) provider endpoint')
    p.add_argument('--llm-key-env',default='OPENAI_API_KEY',help='environment variable containing API key')
    p.add_argument('--llm-phases',action='store_true',help='allow the LLM to suggest nested inquiries at phase gates')
    p.add_argument('--llm-timeout',type=float,default=35)
    p.add_argument('--control', choices=['manual','co-pilot','auto-nav','full-speed'],default='auto-nav')
    p.add_argument('--autonomy',type=float)
    p.add_argument('--capability-recipe',type=Path,
                   help='optional per-entity CAD/mesh capability genome; same OODA-HA helm')
    p.add_argument('--score-size',type=int,nargs=2,default=[128,192],
                   metavar=('WIDTH','HEIGHT'),help='fixed compound evidence viewport')
    p.add_argument('--finalists',type=int,choices=[3,4,5],default=3,
                   help='valid CAD and mesh compound survivors regenerated in location Aftermath')
    p=commands.add_parser('inspect-dem',help='Inspect an actual digest-checked DEM and its datum')
    p.add_argument('--location-stack',type=Path,required=True)
    p.add_argument('--source-id',required=True)
    p=commands.add_parser('register-control',help='Fit held-out rigid survey control')
    p.add_argument('--location-stack',type=Path,required=True)
    p.add_argument('--source-frame',required=True)
    p.add_argument('--target-frame',required=True)
    p.add_argument('--source-id',required=True)
    p.add_argument('--tolerance',type=float,required=True)
    p.add_argument('--out',type=Path,required=True)
    p=commands.add_parser('pet-name',help='Bind an observed entity or a nameless location set')
    p.add_argument('--witness',type=Path,required=True)
    p.add_argument('--ledger',type=Path,required=True)
    p.add_argument('--target',required=True,help='observed construction handle (not a CAD face index)')
    p.add_argument('--name',required=True,help='operator-given pet-name')
    p.add_argument('--mode',choices=['entity','location'],default='entity')
    p.add_argument('--has',action='append',default=[],help='expected #has capability; repeatable')
    p.add_argument('--member-has',action='append',default=[],help='location member capability filter')
    p.add_argument('--retain',type=float,default=.4,help='soft affinity, from zero to one')
    p=commands.add_parser('o-takiage',help='Release one pet-name or a whole construction fork')
    p.add_argument('--ledger',type=Path,required=True)
    group=p.add_mutually_exclusive_group(required=True)
    group.add_argument('--name')
    group.add_argument('--branch')
    p.add_argument('--witness',type=Path,help='required for branch release')
    p=commands.add_parser('feature-annotate',
                          help='Snapshot operator-drawn image regions as source-bound provisional attention masks')
    p.add_argument('--project',type=Path,required=True)
    p.add_argument('--region',action='append',required=True,
                   help='Entity=/path/to/annotation.png; repeat for Crystal, Joining, Fortress')
    p.add_argument('--score-size',type=int,nargs=2,default=[128,192])
    p.add_argument('--out',type=Path,required=True)
    p=commands.add_parser('transfer-seed',help='Explicitly authorize proposal-only normalized gene transfer')
    p.add_argument('--source-recipe',type=Path,required=True)
    p.add_argument('--target-recipe',type=Path,required=True)
    p.add_argument('--donor-genome',type=Path,required=True)
    p.add_argument('--donor-id',required=True)
    p.add_argument('--family',required=True)
    p.add_argument('--focus',action='append',required=True)
    p.add_argument('--authorize',action='store_true',help='operator authorizes this donor/target/focus')
    p.add_argument('--out',type=Path,required=True)
    p=commands.add_parser('search-census',help='Inspect measured source-bound lineage reachability; never generate geometry')
    p.add_argument('--archive',type=Path,required=True)
    p.add_argument('--capability-recipe',type=Path,required=True)
    p.add_argument('--out',type=Path,help='optional JSON witness path')
    p=commands.add_parser('ooda-ha-run', help='Run nested OODA-HA with durable operator steering')
    p.add_argument('--project',type=Path,required=True)
    p.add_argument('--out',type=Path,required=True)
    p.add_argument('--passes',type=int,default=3)
    p.add_argument('--candidates',type=int,default=9)
    p.add_argument('--exact-budget',type=int,default=6)
    p.add_argument('--detail-budget',type=int,default=3)
    p.add_argument('--topology-locus',action='append',default=[])
    p.add_argument('--seed',type=int,default=41)
    p.add_argument('--location-stack',type=Path)
    p.add_argument('--identity-ledger',type=Path)
    p.add_argument('--max-depth',type=int,default=12,help='nested inquiry depth budget')
    p.add_argument('--max-loops',type=int,default=4096,help='bounded session loop count')
    p.add_argument('--llm-provider',choices=['none','ollama','openai-compatible'],default='none',
                   help='opt-in LLM advice; without this, the Operator can still steer through the inbox')
    p.add_argument('--llm-model',help='provider model name; required when provider enabled')
    p.add_argument('--llm-endpoint',help='optional explicitly trusted HTTP(S) provider endpoint')
    p.add_argument('--llm-key-env',default='OPENAI_API_KEY',help='environment variable containing API key')
    p.add_argument('--llm-phases',action='store_true',help='allow the LLM to suggest nested inquiries at phase gates')
    p.add_argument('--llm-timeout',type=float,default=35)
    p.add_argument('--control', choices=['manual','co-pilot','auto-nav','full-speed'],
                   default='auto-nav', help='operator/AI steering preset')
    p.add_argument('--autonomy',type=float,
                   help='continuous AI discretion [0,1], overrides --control')
    p.add_argument('--capability-recipe',type=Path,
                   help='optional capability recipe; a selected lineage carries CAD plus polymesh genes')
    p.add_argument('--score-size',type=int,nargs=2,default=[128,192],
                   metavar=('WIDTH','HEIGHT'),help='fixed compound evidence viewport')
    p.add_argument('--finalists',type=int,choices=[3,4,5],default=3,
                   help='regrow distinct compound finalists inside location Aftermath')
    p.add_argument('--feature-evidence',type=Path,
                   help='operator-annotated source-bound region masks, provisional only')
    p.add_argument('--transfer-bundle',type=Path,
                   help='operator-authorized normalized cross-location proposal fragments')
    p.add_argument('--breeding',action='store_true',
                   help='six-family quality-diversity campaign using a source-bound structural recipe')
    p.add_argument('--offspring-per-family',type=int,default=6,
                   help='bounded 1..32 offspring per family per generation')
    p.add_argument('--migration-every',type=int,default=4,
                   help='generations between compatible cross-family locus grafts')
    p.add_argument('--mutation-scale',type=float,default=.16,
                   help='relative spread for local breeding (0,.4]')
    p.add_argument('--explore-overscan',type=int,choices=[1,2],
                   help='opt-in reference-anchored exploration, 2 recommended')
    p.add_argument('--explore-depth',type=float,default=2.)
    p.add_argument('--explore-max-vertices',type=int,default=150000)
    p.add_argument('--explore-max-faces',type=int,default=200000)
    p.add_argument('--explore-review-seats',type=int,default=6)
    p=commands.add_parser('fracture-pattern',
                          help='Generate bounded statistical fragment sizes and 2D crack hypotheses')
    p.add_argument('--out',type=Path,required=True)
    p.add_argument('--size',type=int,nargs=2,default=[128,192])
    p.add_argument('--cells',type=int,default=36)
    p.add_argument('--seed',type=int,default=41)
    p.add_argument('--anisotropy',type=float,default=1.)
    p.add_argument('--line-width',type=int,default=1)
    p.add_argument('--dimension',type=int,choices=[1,2,3],default=3)
    p.add_argument('--fragments',type=int,default=64)
    p.add_argument('--min-size',type=float,default=1.)
    p.add_argument('--max-size',type=float,default=64.)
    p.add_argument('--max-total-measure',type=float)
    p=commands.add_parser('review-orthos',
                          help='Render verified native six-view boards from completed Experiment Zero review')
    p.add_argument('--project',type=Path,required=True)
    p.add_argument('--capability-recipe',type=Path,required=True)
    p.add_argument('--out',type=Path,required=True,help='completed native OODA-HA directory')
    p.add_argument('--gallery',type=Path,required=True,help='fresh gallery output directory')
    p.add_argument('--seats',type=int,choices=[2,3,4,5],default=3)
    p=commands.add_parser('place-review',
                          help='Read-only carved-native passage and section evidence for Fire alternatives')
    p.add_argument('--project',type=Path,required=True)
    p.add_argument('--capability-recipe',type=Path,required=True)
    p.add_argument('--receipt',type=Path,required=True)
    p.add_argument('--out',type=Path,required=True)
    p.add_argument('--cell',type=float,default=.5)
    p.add_argument('--clearance',type=float,default=.7)
    p.add_argument('--elevation',type=float,action='append',
                   help='ordered native elevation of a sampled XY section (repeatable)')
    p.add_argument('--topology-pilot',action='store_true',help='optional TopologicPy read-only graph comparison')
    p=commands.add_parser('fire-cohort', help='Verify and census multiple source-bound Fire native/six-view receipts')
    p.add_argument('--receipt',type=Path,action='append',required=True)
    p.add_argument('--review',type=Path,action='append',required=True)
    p.add_argument('--out',type=Path,required=True)
    p.add_argument('--quality-pilot',action='store_true',help='optional pyribs read-only grid study')
    p=commands.add_parser('fire-review',
                          help='Re-render admitted Fire proposals as native six-view structural orthos')
    p.add_argument('--project',type=Path,required=True)
    p.add_argument('--capability-recipe',type=Path,required=True)
    p.add_argument('--receipt',type=Path,required=True)
    p.add_argument('--out',type=Path,required=True)
    for name in ('fire-context','fire-audition'):
        p=commands.add_parser(name,
            help='Current AI Fire uses this typed Loom boundary; no autonomous interpreter')
        p.add_argument('--project',type=Path,required=True)
        p.add_argument('--capability-recipe',type=Path,required=True)
        p.add_argument('--out',type=Path,required=True)
        p.add_argument('--genome',type=Path)
        p.add_argument('--identity-ledger',type=Path)
        if name=='fire-audition':
            p.add_argument('--proposal',type=Path,required=True,
                help='Fire-authored JSON proposal, NOT raw executable memetic-wikitext')
    p=commands.add_parser('experiment-zero-select',
                          help='Record separately attributed Operator or adviser review choice')
    p.add_argument('--out',type=Path,required=True)
    p.add_argument('--proposal',required=True)
    p.add_argument('--actor',choices=['operator','adviser'],required=True)
    p.add_argument('--reason',required=True)
    p=commands.add_parser('campaign-readiness',
                          help='Run complete bounded native evidence, comparison, replay and sealing')
    p.add_argument('--project',type=Path,required=True)
    p.add_argument('--capability-recipe',type=Path,required=True)
    p.add_argument('--out',type=Path,required=True)
    p.add_argument('--passes',type=int,default=2)
    p.add_argument('--offspring-per-family',type=int,default=3)
    p.add_argument('--exact-budget',type=int,default=12)
    p.add_argument('--detail-budget',type=int,default=6)
    p.add_argument('--seed',type=int,default=41)
    p.add_argument('--score-size',nargs=2,type=int,default=[64,96])
    p.add_argument('--control-mutation-scale',type=float,default=.10)
    p.add_argument('--candidate-mutation-scale',type=float,default=.16)
    p=commands.add_parser('campaign-verify',help='Independently verify every sealed evidence file')
    p.add_argument('--out',type=Path,required=True)
    p=commands.add_parser('ooda-ha-finalists',help='Regrow 3-5 distinct CAD-valid survivors across epochs')
    p.add_argument('--project',type=Path,required=True)
    p.add_argument('--epochs',type=Path,required=True)
    p.add_argument('--out',type=Path,required=True)
    p.add_argument('--count',type=int,choices=[3,4,5],default=4)
    p.add_argument('--size',type=int,nargs=2,default=[384,576])
    p.add_argument('--no-production',action='store_true',help='preview gallery only; still CAD audited')
    p=commands.add_parser('ooda-ha-status',help='Inspect the phase tree and operator checkpoints')
    p.add_argument('--session',type=Path,required=True)
    p=commands.add_parser('ooda-ha-steer',help='Queue a control, applied at the next safe boundary')
    p.add_argument('--session',type=Path,required=True)
    p.add_argument('--action',choices=['pause','resume','review','set-autonomy','approve-plan','choose',
                            'prefer-emitter','pet-name','o-takiage',
                            'open-inquiry','advance-inquiry'],required=True)
    p.add_argument('--autonomy',type=float)
    p.add_argument('--proposal')
    p.add_argument('--emitter',choices=['sobol','local','topology'])
    p.add_argument('--name')
    p.add_argument('--target')
    p.add_argument('--branch')
    p.add_argument('--mode',choices=['entity','location'],default='entity')
    p.add_argument('--has',action='append',default=[])
    p.add_argument('--member-has',action='append',default=[])
    p.add_argument('--retain',type=float,default=.4)
    p.add_argument('--loop',help='existing parent loop or active inquiry loop id')
    p.add_argument('--question',help='question initiating a phase-anchored inquiry')
    p.add_argument('--phase',choices=['orient','decide','act','aftermath','closed'],
                   help='next phase of an active inquiry')
    p.add_argument('--note',help='operator/AI observation, rationale, action or aftermath receipt')
    args=parser.parse_args(argv)
    if args.command in ('ground-init', 'ground-apply', 'ground-inspect'):
        from .relational_ground import RelationalGround
        if args.command == 'ground-init':
            ground = RelationalGround(args.location)
            ground.save(args.out)
            result = ground.to_dict()
        else:
            ground = RelationalGround.load(args.ground)
            if args.command == 'ground-apply':
                edit = json.loads(args.edit.read_text(encoding='utf8'))
                ground, receipt = ground.apply(edit)
                ground.save(args.out)
                result = receipt
            else:
                result = ground.snapshot()
        print(json.dumps(result, indent=2))
        return result
    if args.command in ('scene-package', 'scene-validate'):
        from .scene_usd import package_scene, validate_scene
        if args.command == 'scene-package':
            declared = json.loads(args.declaration.read_text(encoding='utf8'))
            result = package_scene(declared, args.out)
        else:
            result = validate_scene(args.bundle)
        print(json.dumps(result, indent=2))
        return result
    if args.command == 'scene-invalidation':
        from .incremental_graph import graph_for_scene
        old = graph_for_scene(json.loads(args.before.read_text(encoding='utf8')))
        new = graph_for_scene(json.loads(args.after.read_text(encoding='utf8')))
        result = new.compare(old)
        print(json.dumps(result, indent=2))
        return result
    if args.command in ('editor-seed', 'editor-apply'):
        from .editor_proposals import seed_editor_ground, apply_proposal
        declaration = json.loads(args.declaration.read_text(encoding='utf8'))
        if args.command == 'editor-seed':
            ground = seed_editor_ground(declaration)
            ground.save(args.out)
            result = {'location': ground.location, 'frontier': list(ground.frontier),
                      'entities': sorted(ground.snapshot()['entities'])}
        else:
            from .relational_ground import RelationalGround
            ground = RelationalGround.load(args.ground)
            proposal = json.loads(args.proposal.read_text(encoding='utf8'))
            result = apply_proposal(declaration, ground, args.bundle, proposal, args.out)
        print(json.dumps(result, indent=2))
        return result
    if args.command == 'regulative-control':
        from .regulative_growth import matched_trial
        from .developmental import GrowthProgram
        growth = GrowthProgram.from_dict(json.loads(args.growth.read_text(encoding='utf8')))
        result = matched_trial(growth, args.out, fill=args.fill)
        print(json.dumps(result, indent=2))
        return result
    if args.command in ('scene-variants', 'scene-variants-validate'):
        from .scene_variants import build_variants, validate_variants
        if args.command == 'scene-variants':
            declared = json.loads(args.specification.read_text(encoding='utf8'))
            result = build_variants(declared, args.out)
        else:
            result = validate_variants(args.comparison)
        print(json.dumps(result, indent=2))
        return result
    if args.command in ('place-gallery','place-gallery-verify'):
        from .place_gallery import render_place_gallery,verify_place_gallery
        if args.command=='place-gallery':
            result=render_place_gallery(args.campaign,args.out)
        else:
            result={'valid':verify_place_gallery(args.campaign,args.gallery),
                    'source_camera_registration':False,'automatic_promotion':False}
        print(json.dumps(result,indent=2))
        return result
    if args.command in ('place-compare','place-compare-verify'):
        from .place_comparison import place_comparison,verify_place_comparison
        if args.command=='place-compare':
            result=place_comparison(args.campaign,args.out)
        else:
            result={'valid':verify_place_comparison(args.campaign,
                json.loads(args.receipt.read_text(encoding='utf8'))),
                'automatic_promotion':False}
        print(json.dumps(result,indent=2))
        return result
    if args.command in ('fire-place-bind','fire-place-verify'):
        from .intent_seed import IntentContract
        from .place_genome import PlaceGenome
        from .fire_spatial import bind_fire_spatial,verify_fire_spatial
        from .generalized_campaign import save_once
        data=json.loads(args.intent.read_text(encoding='utf8'))
        if set(data)!={'location','aim','objectives','invariants','budgets'}:
            raise ValueError('Fire place intent requires exact author-supplied fields')
        intent=IntentContract(data['location'],data['aim'],tuple(data['objectives']),
                tuple(data['invariants']),tuple(tuple(x) for x in data['budgets']))
        genome=PlaceGenome.from_dict(json.loads(args.genome.read_text(encoding='utf8')))
        plan=json.loads(args.plan.read_text(encoding='utf8'))
        if args.command == 'fire-place-bind':
            result=bind_fire_spatial(plan,intent,genome,alternative_id=args.alternative,
                    source_witness_id=args.witness_id,authored_by=args.actor,
                    seed_sha256=args.seed_sha256)
            save_once(args.out,result)
        else:
            binding=json.loads(args.binding.read_text(encoding='utf8'))
            result={'valid':verify_fire_spatial(binding,plan,intent,genome),
                    'automatic_promotion':False}
        print(json.dumps(result,indent=2))
        return result
    if args.command in ('place-run','place-verify','place-candidate-review','place-continue'):
        from .place_campaign import run_place_campaign,verify_place_campaign,review_place_candidate
        if args.command == 'place-run':
            from .intent_seed import IntentContract
            from .spatial_intent import SpatialIntent
            from .place_genome import PlaceGenome
            from .location_stack import LocationStack
            intent_data=json.loads(args.intent.read_text(encoding='utf8'))
            if set(intent_data)!={'location','aim','objectives','invariants','budgets'}:
                raise ValueError('Place-run IntentContract needs exact author-supplied fields')
            intent=IntentContract(intent_data['location'],intent_data['aim'],
                tuple(intent_data['objectives']),tuple(intent_data['invariants']),
                tuple(tuple(x) for x in intent_data['budgets']))
            result=run_place_campaign(LocationStack.load(args.inventory),intent,
                SpatialIntent.from_dict(json.loads(args.spatial.read_text(encoding='utf8'))),
                PlaceGenome.from_dict(json.loads(args.genome.read_text(encoding='utf8'))),
                args.out,epochs=args.epochs,offspring=args.offspring,
                exact_budget=args.exact_budget,seed=args.seed)
        elif args.command == 'place-continue':
            from .place_campaign import continue_place_campaign
            from .intent_seed import IntentContract
            from .spatial_intent import SpatialIntent
            source=json.loads(args.intent.read_text(encoding='utf8'))
            if set(source)!={'location','aim','objectives','invariants','budgets'}:
                raise ValueError('Continued intent requires exact original contract fields')
            intent=IntentContract(source['location'],source['aim'],tuple(source['objectives']),
                       tuple(source['invariants']),tuple(tuple(x) for x in source['budgets']))
            result=continue_place_campaign(args.campaign,args.review,intent,
                SpatialIntent.from_dict(json.loads(args.spatial.read_text(encoding='utf8'))),
                args.out,epochs=args.epochs,offspring=args.offspring,
                exact_budget=args.exact_budget,seed=args.seed)
        elif args.command == 'place-verify':
            result=verify_place_campaign(args.campaign)
        else:
            result=review_place_candidate(args.campaign,args.candidate,actor=args.actor,
                   decision=args.decision,reason=args.reason,destination=args.out)
        print(json.dumps(result,indent=2))
        return result
    if args.command in ('location-review','location-review-verify'):
        from .location_review import review_location, verify_location_review
        if args.command == 'location-review':
            result=review_location(args.workspace,actor=args.actor,
                        decision=args.decision,reason=args.reason,destination=args.out)
        else:
            data=json.loads(args.receipt.read_text(encoding='utf8'))
            result={'valid':verify_location_review(args.workspace,data),
                    'automatic_promotion':False}
        print(json.dumps(result,indent=2))
        return result
    if args.command in ('location-init','location-edit','location-verify','location-support'):
        from .location_workspace import create_workspace, edit_workspace, verify_workspace, support_workspace
        if args.command=='location-init':
            from .location_stack import LocationStack
            inventory=LocationStack.load(args.inventory)
            declaration=json.loads(args.declaration.read_text(encoding='utf8'))
            result=create_workspace(inventory,declaration,args.out)
        elif args.command=='location-edit':
            proposal=json.loads(args.proposal.read_text(encoding='utf8'))
            result=edit_workspace(args.workspace,proposal,args.out)
        elif args.command=='location-support':
            proposal=json.loads(args.proposal.read_text(encoding='utf8'))
            result=support_workspace(args.workspace,proposal,args.out)
        else:
            result=verify_workspace(args.workspace)
        print(json.dumps(result,indent=2))
        return result
    if args.command=='registered-ablation':
        from .matched_registered_trial import matched_registered_ablation
        from .seed_adapters import image_group
        from .intent_seed import IntentContract
        raw=json.loads(args.intent.read_text(encoding='utf8'))
        raw['objectives']=tuple(raw['objectives'])
        raw['invariants']=tuple(raw.get('invariants',()))
        raw['budgets']=tuple(tuple(row) for row in raw.get('budgets',()))
        intent=IntentContract(**raw)
        result=matched_registered_ablation(image_group(args.image_group),intent,args.out,
                    epochs=args.epochs,offspring=args.offspring,
                    exact_budget=args.exact_budget,finalists=args.finalists,
                    seed=args.seed)
        print(json.dumps(result,indent=2))
        return result
    if args.command in ('native-support-propose','native-support-reparent',
                           'native-support-verify'):
        from .relational_ground import RelationalGround
        from .native_support import propose_support,propose_reparent,verify_support_proposal
        from .generalized_campaign import save_once
        ground=RelationalGround.load(args.ground)
        if args.command=='native-support-propose':
            result=propose_support(ground,args.bundle,args.lower,args.upper)
            save_once(args.out,result)
        elif args.command=='native-support-reparent':
            result=propose_reparent(ground,args.bundle,args.old_parent,
                                    args.new_parent,args.child)
            save_once(args.out,result)
        else:
            document=json.loads(args.proposal.read_text(encoding='utf8'))
            result=verify_support_proposal(document,ground,args.bundle)
        print(json.dumps(result,indent=2))
        return result
    if args.command=='registered-inventory':
        from .seed_adapters import image_group
        from .seed_adapters import registered_views
        from .location_stack import LocationStack
        from .generalized_campaign import save_once
        stack=LocationStack.admit_registered_views(registered_views(image_group(args.image_group)),args.location)
        save_once(args.out,stack.to_dict())
        result={'schema':'projection-loom/registered-location-inventory',
                'location':stack.location_id,
                'verified_source_registrations':len(stack.registrations),
                'source_inventory_sha256':stack.to_dict()['snapshot_sha256'],
                'external_survey_certification':False}
        print(json.dumps(result,indent=2))
        return result
    if args.command=='full-location-crucible':
        from .hephaestus_holistic import run_holistic
        declaration=json.loads(args.declaration.read_text(encoding='utf8'))
        result=run_holistic(args.image_group,declaration,args.lower,args.upper,
                            args.move,args.delta,args.out)
        print(json.dumps(result,indent=2))
        return result
    if args.command=='registered-replicates':
        from .matched_registered_trial import matched_registered_replicates
        from .seed_adapters import image_group
        from .intent_seed import IntentContract
        raw=json.loads(args.intent.read_text(encoding='utf8'))
        raw['objectives']=tuple(raw['objectives'])
        raw['invariants']=tuple(raw.get('invariants',()))
        raw['budgets']=tuple(tuple(row) for row in raw.get('budgets',()))
        intent=IntentContract(**raw)
        result=matched_registered_replicates(
            image_group(args.image_group),intent,args.out,
            seeds=tuple(args.seeds),epochs=args.epochs,offspring=args.offspring,
            exact_budget=args.exact_budget,finalists=args.finalists)
        print(json.dumps(result,indent=2))
        return result
    if args.command=='fracture-pattern':
        from .fracture_patterns import export_pattern
        record=export_pattern(args.out,size=tuple(args.size),cells=args.cells,
                              seed=args.seed,anisotropy=args.anisotropy,
                              width_px=args.line_width,dimension=args.dimension,
                              fragments=args.fragments,min_size=args.min_size,
                              max_size=args.max_size,
                              max_total_measure=args.max_total_measure)
        print(json.dumps(record,indent=2));return record
    if args.command=='review-orthos':
        from .ortho_gallery import make
        result=make(args.out,args.project,args.capability_recipe,args.gallery,
                    seats=args.seats)
        print(json.dumps(result,indent=2));return result
    if args.command=='place-review':
        from .capability_stack import CapabilityRecipe,CapabilityCompositor
        from .fire_geometry import _staged,verify_native_rule_replay
        from .grammar import grow_program
        from .place_witness import review_place
        from .provenance_encoding import canonical_json_sha256
        if args.out.exists():raise ValueError('Place evidence output is immutable')
        project=Project.load(args.project)
        recipe=CapabilityRecipe.load(args.capability_recipe)
        native=json.loads(args.receipt.read_text())
        if native.get('sha256')!=canonical_json_sha256(
                {k:v for k,v in native.items() if k!='sha256'}):
            raise ValueError('Place review native receipt digest mismatch')
        if native.get('source_recipe_sha256')!=recipe.sha256:
            raise ValueError('Place review source recipe drifted')
        from .epochs import _hash
        if native.get('source_genome_sha256')!=_hash(native['source_genome']):
            raise ValueError('Place review source genome receipt drifted')
        actual_seed=(project.seed_entity.sha256
                     if project.seed_entity is not None else None)
        if native.get('source_seed_sha256')!=actual_seed:
            raise ValueError('Place review seed identity drifted')
        from .fire_contract import verify_plan
        checked_plan=verify_plan(native['plan'])
        if checked_plan['sha256']!=native['plan_sha256']:
            raise ValueError('Place review bound proposal drifted')
        if (checked_plan['source_witness_id']!=native['original_witness_id'] or
                checked_plan['seed_entity_sha256']!=native.get('source_seed_sha256') or
                checked_plan['location']!=project.location):
            raise ValueError('Place review bound source differs from native receipt')
        for row in native['results']:
            if row.get('receipt_sha256')!=canonical_json_sha256(
                    {k:v for k,v in row.items() if k!='receipt_sha256'}):
                raise ValueError('Place review native result digest changed')
        comp=CapabilityCompositor(project,recipe,size=(64,96),
                                  source_mask=project.source_mask((64,96)))
        if comp.construction_digest()!=native['source_construction_digest']:
            raise ValueError('Place review construction changed')
        built=comp.grow(native['source_genome'])
        base=built.scene.assembly
        if built.witness().witness_id!=native['original_witness_id']:
            raise ValueError('Place review native source witness changed')
        admitted=[r for r in native['results'] if r['state']=='native-admitted']
        if not admitted:raise ValueError('Place review needs admitted alternatives')
        variants=[]
        for row in admitted:
            rule_steps=verify_native_rule_replay(native['plan'],row,base)
            candidate=_staged(base)
            grow_program(rule_steps,{},assembly=candidate)
            audit=candidate.audit(join=True)
            if (not audit.get('valid') or
                    row['native_audit'].get('valid') is not True or
                    audit.get('union_solids')!=1 or
                    len(candidate.parts)-len(base.parts)!=row['part_delta'] or
                    abs(audit['union_volume']-row['native_audit']['union_volume'])>1e-6 or
                    candidate.relation_witness(location=project.location).witness_id!=row['witness_id']):
                raise ValueError('Place review variant native receipts changed')
            variants.append(candidate)
        data=review_place(base,variants,location=project.location,
                          elevations=tuple(args.elevation) if args.elevation is not None else (1.6,3.2),
                          cell=args.cell,clearance=args.clearance)
        data['native_audition_sha256']=native['sha256']
        if args.topology_pilot:
            from .optional_studies import topologic_route_pilot
            data['topology_pilot']=topologic_route_pilot(data)
        data['sha256']=canonical_json_sha256({k:v for k,v in data.items() if k!='sha256'})
        from .epochs import _atomic
        _atomic(args.out,data)
        print(json.dumps({'file':str(args.out),'sha256':data['sha256'],
                          'alternatives':len(variants)},indent=2))
        return data
    if args.command=='fire-cohort':
        from .fire_cohort import census,write_census
        if len(args.receipt)!=len(args.review):
            raise ValueError('Every Fire native receipt needs its own six-view review')
        pairs=list(zip(args.receipt,args.review))
        if args.quality_pilot:
            from .optional_studies import pyribs_archive_pilot
            from .epochs import _atomic
            optional_path=args.out.with_suffix('.quality-pilot.json')
            if args.out.exists() or optional_path.exists():
                raise ValueError('Fire cohort and optional study outputs must be new')
            result=census(pairs)
            pilot=pyribs_archive_pilot(result)
            # No base evidence is written until the optional dependency and
            # descriptor study have succeeded in this same iteration.
            _atomic(args.out,result)
            _atomic(optional_path,pilot)
        else:
            result=write_census(pairs,args.out)
        print(json.dumps({'sha256':result['sha256'],'native_admitted':result['native_admitted'],
                          'unique_topology_witnesses':result['unique_topology_witnesses'],
                          'unique_six_view_silhouettes':result['unique_six_view_silhouettes']},indent=2))
        return result
    if args.command=='fire-review':
        from .capability_stack import CapabilityRecipe
        from .fire_review import render_fire_review
        project=Project.load(args.project)
        recipe=CapabilityRecipe.load(args.capability_recipe)
        receipt=json.loads(args.receipt.read_text())
        result=render_fire_review(project,recipe,receipt,args.out)
        print(json.dumps({'file':str(args.out/'summary.json'),'sha256':result['sha256'],
                          'alternatives':len(result['alternatives'])},indent=2))
        return result
    if args.command in ('fire-context','fire-audition'):
        from .capability_stack import CapabilityCompositor, CapabilityRecipe
        from .fire_contract import validate_proposal
        from .fire_geometry import fire_audition
        from .provenance_encoding import canonical_json_sha256
        from .epochs import _hash
        project=Project.load(args.project)
        recipe=CapabilityRecipe.load(args.capability_recipe)
        genome=json.loads(args.genome.read_text()) if args.genome else None
        if args.out.exists():
            raise ValueError('Fire output is immutable; use a new output path')
        if args.command=='fire-context':
            compositor=CapabilityCompositor(project,recipe,size=(64,96),
                                            source_mask=project.source_mask((64,96)))
            built=compositor.grow(recipe.initial if genome is None else genome)
            witness=built.witness()
            ledger=PetNameLedger.load(args.identity_ledger) if args.identity_ledger else None
            if ledger is not None and ledger.location!=project.location:
                raise ValueError('Fire ledger belongs to another location')
            result={'schema':'projection-loom/fire-context',
                'source':{'location':project.location,'witness_id':witness.witness_id,
                          **({'seed_entity_sha256':project.seed_entity.sha256}
                             if project.seed_entity is not None else {})},
                'bindings':[{'handle':handle,'selector':witness.selector(handle)}
                            for handle in sorted(witness.nodes)],
                'pet_names':ledger.resolve(witness) if ledger else [],
                'capability_recipe_sha256':recipe.sha256,
                'genome_sha256':_hash(built.genome),
                'scope':'read-only; AI Fire interprets natural/sigil prose',
                'authority':'source witness and operator ledger, no promotion'}
            result['sha256']=canonical_json_sha256(result)
        else:
            proposal=validate_proposal(json.loads(args.proposal.read_text()))
            result=fire_audition(project,recipe,proposal,
                identity_ledger=args.identity_ledger,genome=genome)
        _save(args.out,result)
        print(json.dumps({'file':str(args.out),'sha256':result['sha256'],
                          'schema':result['schema'],
                          'results':result.get('results') and
                                    [{k:v for k,v in row.items() if k in ('id','state','reason')}
                                     for row in result['results']]},indent=2))
        return result
    if args.command=='experiment-zero-select':
        from .experiment_zero import select_survivor
        result=select_survivor(args.out,proposal=args.proposal,actor=args.actor,
                               rationale=args.reason)
        print(json.dumps(result,indent=2));return result
    if args.command=='campaign-readiness':
        from .pre_campaign_readiness import run_readiness
        result=run_readiness(args.project,args.capability_recipe,args.out,
            passes=args.passes,offspring=args.offspring_per_family,
            exact=args.exact_budget,detail=args.detail_budget,seed=args.seed,
            size=tuple(args.score_size),control_scale=args.control_mutation_scale,
            candidate_scale=args.candidate_mutation_scale)
        print(json.dumps(result,indent=2));return result
    if args.command=='campaign-verify':
        from .pre_campaign_readiness import verify_seal
        result=verify_seal(args.out)
        print(json.dumps({'schema':result['schema'],'sha256':result['sha256'],
                          'files':len(result['files'])},indent=2));return result
    if args.command=='feature-annotate':
        from .feature_evidence import FeatureEvidence
        parsed={}
        for item in args.region:
            if '=' not in item:
                raise ValueError('Feature region must be Entity=/path/to/mask.png')
            entity,file=item.split('=',1)
            if entity in parsed:
                raise ValueError('Duplicate source feature entity')
            parsed[entity]=Path(file)
        receipt=FeatureEvidence.author(Project.load(args.project),parsed,args.out,
                                       score_size=tuple(args.score_size))
        result={'manifest':str(args.out),'digest':receipt.digest,
                'source_sha256':receipt.source_sha256,
                'entities':sorted(receipt.masks),
                'evidence_state':'operator-annotated'}
        print(json.dumps(result,indent=2))
        return result
    if args.command=='transfer-seed':
        from .capability_stack import CapabilityRecipe
        from .campaign import FAMILY_FOCUSES
        from .genetic_transfer import build_transfer_seed,bundle_transfers
        source=CapabilityRecipe.load(args.source_recipe)
        target=CapabilityRecipe.load(args.target_recipe)
        if args.family not in FAMILY_FOCUSES or not set(args.focus).issubset(FAMILY_FOCUSES[args.family]):
            raise ValueError('Transfer focus must be within its search family')
        data=json.loads(args.donor_genome.read_text())
        donor=data.get('genome',data)
        seed=build_transfer_seed(source.bounds,target.bounds,
            family=args.family,source_recipe_sha256=source.sha256,
            target_recipe_sha256=target.sha256,donor_id=args.donor_id,
            donor_genome=donor,focus=tuple(args.focus),authorized=args.authorize)
        result=bundle_transfers([seed],target_recipe_sha256=target.sha256)
        _save(args.out,result)
        print(json.dumps(result,indent=2))
        return result
    if args.command=='search-census':
        from .campaign import LineageArchive
        from .capability_stack import CapabilityRecipe
        from .search_strategy import emitter_performance
        recipe=CapabilityRecipe.load(args.capability_recipe)
        payload=json.loads(args.archive.read_text(encoding='utf-8'))
        archive=LineageArchive(args.archive,identity=payload['identity'])
        if archive.identity.get('recipe_sha256') not in (None,recipe.sha256):
            raise ValueError('Census recipe identity differs from lineage archive')
        result=archive.census(recipe.bounds,activations=tuple(
            step.activation for step in recipe.steps if step.activation))
        result['emitter_performance']=emitter_performance(archive)
        result['recipe_sha256']=recipe.sha256
        if args.out:_save(args.out,result)
        print(json.dumps(result,indent=2))
        return result
    if args.command in ('ooda-ha-run','wide-epoch'):
        from .fractal_ooda_ha import run_ooda_ha_epochs
        from .location_stack import LocationStack
        presets={'manual':0.,'co-pilot':.40,'auto-nav':.75,'full-speed':1.}
        project=Project.load(args.project)
        source=LocationStack.load(args.location_stack) if args.location_stack else None
        if args.capability_recipe:
            from .capability_stack import CapabilityRecipe
            recipe=CapabilityRecipe.load(args.capability_recipe)
        else:
            recipe=None
        model_advice = None
        if args.llm_provider != 'none':
            from .llm_helm import HelmLLM
            model_advice=HelmLLM(args.llm_provider,args.llm_model,endpoint=args.llm_endpoint,
                                 api_key_env=args.llm_key_env,timeout=args.llm_timeout)
        exploration_budget=None
        if args.command=='ooda-ha-run' and args.explore_overscan is not None:
            from .exploration import ExplorationBudget
            exploration_budget=ExplorationBudget(
                overscan=args.explore_overscan,depth_multiplier=args.explore_depth,
                max_vertices=args.explore_max_vertices,max_faces=args.explore_max_faces,
                score_size=tuple(args.score_size))
        result=run_ooda_ha_epochs(project,args.out,passes=args.passes,
            candidates=args.candidates,exact_budget=args.exact_budget,
            detail_budget=args.detail_budget,seed=args.seed,
            topology_loci=args.topology_locus,
            autonomy=args.autonomy if args.autonomy is not None else presets[args.control],
            ledger_path=args.identity_ledger,location_stack=source,
            max_depth=args.max_depth,max_loops=args.max_loops,
            adviser=model_advice.choose if model_advice else None,
            phase_adviser=model_advice.phase if model_advice and args.llm_phases else None,
            recipe=recipe,score_size=tuple(args.score_size),finalists=args.finalists,
            breeding=getattr(args,'breeding',False),
            offspring_per_family=getattr(args,'offspring_per_family',6),
            migration_every=getattr(args,'migration_every',4),
            mutation_scale=getattr(args,'mutation_scale',.16),
            feature_evidence_path=getattr(args,'feature_evidence',None),
            transfer_bundle_path=getattr(args,'transfer_bundle',None),
            exploration_budget=exploration_budget)
        if exploration_budget is not None and result.get('status')=='completed':
            from .experiment_zero import write_review
            record=write_review(project,recipe,args.out,exploration_budget,
                                passes=args.passes,seats=args.explore_review_seats)
            result['experiment_zero_review_sha256']=record['sha256']
        print(json.dumps(result,indent=2));return result
    if args.command=='ooda-ha-finalists':
        from .finalists import export_finalists
        project=Project.load(args.project)
        result=export_finalists(project,args.epochs,args.out,count=args.count,
                                size=tuple(args.size),with_production=not args.no_production)
        print(json.dumps({'actual_count':result['actual_count'],
                          'gallery':str(args.out/'contact_sheet.png')}))
        return result
    if args.command=='ooda-ha-status':
        from .fractal_ooda_ha import OODAHAJournal
        session=OODAHAJournal(args.session)
        state=session.summary()
        state['open_loops']=[{'id':n['id'],'phase':n['phase'],'scope':n['scope'],
                              'parent_phase':n.get('parent_phase')}
            for n in session.data['loops'].values() if n['phase']!='closed']
        print(json.dumps(state,indent=2));return state
    if args.command=='ooda-ha-steer':
        from .fractal_ooda_ha import submit_control
        parameters={}
        if args.action=='set-autonomy':
            if args.autonomy is None:parser.error('set-autonomy needs --autonomy')
            parameters['autonomy']=args.autonomy
        elif args.action=='choose':
            if not args.proposal:parser.error('choose needs --proposal')
            parameters['proposal_id']=args.proposal
        elif args.action=='prefer-emitter':
            if not args.emitter:parser.error('prefer-emitter needs --emitter')
            parameters['emitter']=args.emitter
        elif args.action=='pet-name':
            parameters=dict(proposal_id=args.proposal,name=args.name,
                target=args.target,mode=args.mode,has=args.has,
                member_has=args.member_has,retain=args.retain)
        elif args.action=='o-takiage':
            parameters=dict(name=args.name,branch=args.branch,proposal_id=args.proposal)
        elif args.action=='open-inquiry':
            if not args.loop or not args.question:
                parser.error('open-inquiry needs --loop and --question')
            parameters=dict(parent_loop=args.loop, question=args.question)
        elif args.action=='advance-inquiry':
            if not args.loop or not args.phase:
                parser.error('advance-inquiry needs --loop and --phase')
            parameters=dict(loop_id=args.loop,phase=args.phase,detail={'note':args.note or ''})
        msg=submit_control(args.session,args.action,**parameters)
        print(json.dumps(msg,indent=2));return msg
    if args.command=='inspect-dem':
        from .location_stack import LocationStack
        from .geospatial import inspect_dem
        result=inspect_dem(LocationStack.load(args.location_stack),args.source_id).to_dict()
        print(json.dumps(result));return result
    if args.command=='register-control':
        from .location_stack import LocationStack
        from .registration3d import register_control_csv
        stack=LocationStack.load(args.location_stack)
        fit=register_control_csv(stack,args.source_frame,args.target_frame,args.source_id,
                                 tolerance_m=args.tolerance)
        _save(args.out,fit.to_dict())
        print(json.dumps({'state':fit.state,'holdout_rms':fit.holdout_rms}))
        return fit
    if args.command=='pet-name':
        witness=RelationWitness.load(args.witness)
        ledger=PetNameLedger.load(args.ledger) if args.ledger.exists() else PetNameLedger(location=witness.location)
        claim=ledger.pet_name(args.name,args.target,witness,mode=args.mode,
                              has=args.has,member_has=args.member_has,retain=args.retain)
        ledger.save(args.ledger)
        print(json.dumps({'pet_name':claim['name'],'claim_id':claim['claim_id'], 'mode':claim['mode']}))
        return claim
    if args.command=='o-takiage':
        ledger=PetNameLedger.load(args.ledger)
        witness=RelationWitness.load(args.witness) if args.witness else None
        receipt=ledger.o_takiage(name=args.name,branch=args.branch,witness=witness)
        ledger.save(args.ledger)
        print(json.dumps(receipt))
        return receipt
    project=Project.load(args.project)
    ledger=PetNameLedger.load(args.identity_ledger) if args.identity_ledger else None
    if ledger is not None and ledger.location != project.location:
        raise ValueError('Identity ledger location does not match project')
    args.out.mkdir(parents=True,exist_ok=True)
    genome=project.load_genome(args.genome) if args.genome else dict(project.initial)
    if args.command=='discover':
        assembly=project.grow(genome)
        audit=assembly.audit(join=True)
        if not audit['valid']:
            raise ValueError('Only structurally and spatially valid constructions may be discovered')
        witness=assembly.relation_witness(location=project.location)
        witness.save(args.out/'relations.json')
        receipt={'witness_id':witness.witness_id,'entities':len(witness.nodes),
                 'nameless':sum(x.anonymous for x in witness.nodes.values()),
                 'bindings':ledger.resolve(witness) if ledger else []}
        _save(args.out/'discovery.json',receipt)
        print(json.dumps(receipt))
        return receipt
    if args.command=='validate':
        audit=project.grow(genome).audit(join=True)
        _save(args.out/'audit.json',audit)
        print(json.dumps({'valid':audit['valid'],'parts':audit['parts'],'joints':audit['joints']}))
        return audit
    if args.command=='grow':
        a=project.grow(genome)
        result=project.export(a,args.out,genome,size=tuple(args.export_size),ledger=ledger)
        print(json.dumps({'valid':result['contacts']['valid'],'parts':result['contacts']['parts'],'model':str(args.out)}))
        return result
    evolution=Evolution(project,seed=args.seed,ledger=ledger,slack_fraction=args.slack_fraction)
    if args.command=='evolve':
        results=evolution.evolve(genome,burst=args.burst,survivors=args.survivors,offspring=args.offspring)
        for n,item in enumerate(results,1):
            project.export(project.grow(item['genome']),args.out/f'lineage_{n:02d}',item['genome'],size=tuple(args.export_size),ledger=ledger)
        _save(args.out/'evolution.json',{'lineages':results,'evaluations':evolution.eval_count,'history':evolution.records})
        print(json.dumps({'lineages':len(results),'evaluations':evolution.eval_count}))
        return results
    if args.command=='epoch-loop':
        manifest={'passes':[],'schema':'projection-loom/solid-epochs','policy':'each generation grows fresh solids from v2 genome; meshes never become seeds'}
        immutable=genome.copy()
        current=dict(genome)
        for i in range(args.passes):
            feedback=None
            if i:
                mesh=project.grow(current).tessellate(linear=.40,union=True)
                feedback={n:silhouette(mesh,evolution.fitness_cameras[n],evolution.size)>96 for n in project.cameras if n!=project.reference_view}
            results=evolution.evolve(current,burst=args.burst,survivors=args.survivors,offspring=args.offspring,feedback=feedback)
            if results:
                best=results[0]
                # Do not discard the accepted genome solely due to self-feedback.
                immutable_loss=evolution.evaluate(evolution.as_vector(immutable),lit=True)
                candidate_loss=evolution.evaluate(evolution.as_vector(best['genome']),lit=True)
                if candidate_loss<=immutable_loss+.04:current=best['genome']
            folder=args.out/f'epoch_{i+1:02d}'
            project.export(project.grow(current),folder,current,size=tuple(args.export_size),ledger=ledger)
            _save(folder/'search.json',{'top_lineages':results,'history':evolution.records})
            manifest['passes'].append({'epoch':i+1,'genome':dict(current),'best_loss':results[0]['loss'] if results else None,
                                       'accepted':dict(current)==(results[0]['genome'] if results else {}),
                                       'models':[x['genome'] for x in results]})
            _save(args.out/'manifest.json',manifest)
        print(json.dumps({'passes':len(manifest['passes']),'evaluations':evolution.eval_count}))
        return manifest

if __name__=='__main__':main()
