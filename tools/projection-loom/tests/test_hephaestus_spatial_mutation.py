"""N9-M: mutation serves authored spatial semantics without falsifying STEP."""
from projection_loom.scene_usd import package_scene
from projection_loom.place_affordances import assess_place
from test_hephaestus_place_campaign import setup
from test_hephaestus_place_shelter import fixture as covered
from test_hephaestus_place_ascent import stair


def test_goal_conditioned_native_variations_keep_original_semantic_path(tmp_path):
    situations=[("bridge",setup()[3],setup()[2]),
                ("cover",*covered()),
                ("stairs",*stair())]
    for name,genome,spatial in situations:
        born=genome.vary_spatial(spatial,41)
        assert born.identity!=genome.identity
        assert born.walkways==genome.walkways
        assert born.ascents==genome.ascents
        assert [b.entity_id for b in born.bodies]==[b.entity_id for b in genome.bodies]
        package_scene(born.declaration("matched-source"),tmp_path/name)
        result=assess_place(tmp_path/name,born,spatial)
        assert result["all_declared_goals_witnessed"],(name,result)
        assert result["automatic_promotion"] is False


def test_goal_mutation_keeps_deterministic_proposal_identity():
    genotype=setup()[3]
    spatial=setup()[2]
    assert genotype.vary_spatial(spatial,27).identity==genotype.vary_spatial(spatial,27).identity
    assert genotype.vary_spatial(spatial,27).identity!=genotype.vary_spatial(spatial,35).identity

def test_intent_sensitive_variants_enter_one_native_ooda_ha_campaign(tmp_path):
    from projection_loom.place_campaign import run_place_campaign,verify_place_campaign
    inventory,intent,spatial,genome=setup()
    campaign=tmp_path/"variant-campaign"
    result=run_place_campaign(inventory,intent,spatial,genome,campaign,
                              epochs=2,offspring=2,exact_budget=2,seed=41)
    assert result["attempted"]==4 and result["deferred"]==0
    assert result["admitted"]>=2
    assert result["distinct_admitted_genomes"]>=2
    assert not result["automatic_promotion"] and result["operator_winner"] is None
    assert verify_place_campaign(campaign)==result
