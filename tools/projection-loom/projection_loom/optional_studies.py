"""Read-only research comparisons with replaceable optional libraries.

TopologicPy and pyribs never enter the build, native audit, reproduction,
proposal compiler, or OODA-HA phases. They are separately installed studies.
"""
from __future__ import annotations


def topologic_route_pilot(place_witness):
    """Cross-check native void graph node/edge counts in optional TopologicPy."""
    if not place_witness["assemblies"]:
        raise ValueError("Place witness has no assemblies")
    from topologicpy.Vertex import Vertex
    from topologicpy.Edge import Edge
    from topologicpy.TGraph import TGraph
    routes=place_witness["assemblies"][0]["routes"]
    nodes=routes["voids"]
    index={name:i for i,name in enumerate(nodes)}
    vertices=[Vertex.ByCoordinates(i*2.0,0,0) for i in range(len(nodes))]
    edges=[Edge.ByVertices(vertices[index[a]],vertices[index[b]])
           for a,b in routes["links"]]
    graph=TGraph.ByVerticesEdges(vertices,edges)
    observed=(len(TGraph.Vertices(graph)),len(TGraph.Edges(graph)))
    expected=(len(nodes),len(edges))
    if observed!=expected:
        raise ValueError("TopologicPy pilot disagrees with audited void graph")
    return {"backend":"TopologicPy TGraph","source_witness_id":place_witness["source_witness_id"],
            "nodes":observed[0],"edges":observed[1],
            "authority":"read-only comparison, not source geometry or pet-name authority"}


def pyribs_archive_pilot(cohort):
    """Observe existing admitted cohort diversity without running an emitter."""
    from ribs.archives import GridArchive
    import numpy as np
    rows=cohort["candidates"]
    if not rows:
        raise ValueError("No native-admitted candidate rows to illuminate")
    # Two bounded behavioural axes, not a hidden artistic merit score:
    # change-pixel fraction proxy and number of expressed orthographic views.
    solutions=np.arange(len(rows),dtype=np.float64).reshape(-1,1)
    changed=np.asarray([r["changed_pixels_all_views"] for r in rows],dtype=np.float64)
    measures=np.stack((changed/np.maximum(1,changed.max()),
                      np.asarray([len(r["expressed_views"])/6 for r in rows])),axis=1)
    archive=GridArchive(solution_dim=1,dims=[5,5],ranges=[(0,1.00001),(0,1.00001)])
    # A neutral equal objective lets first-seen admission occupy each cell.
    archive.add(solution=solutions,objective=np.zeros(len(rows)),measures=measures)
    return {"backend":"pyribs GridArchive","occupied_cells":len(archive),
            "candidates":len(rows),
            "authority":"diagnostic only; does not compete with OODA-HA archive or select elites"}
