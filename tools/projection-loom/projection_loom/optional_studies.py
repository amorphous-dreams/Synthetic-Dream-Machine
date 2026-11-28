"""Opt-in, read-only comparisons, never a second native or generation helm."""
from __future__ import annotations


def topologic_route_pilot(place_witness):
    """Check every audited void graph through separately installed TopologicPy.

    Empty void graphs have no library representation worth manufacturing.
    No physical geometry, source identity, or pet-name crosses this boundary.
    """
    from topologicpy.Vertex import Vertex
    from topologicpy.Edge import Edge
    from topologicpy.TGraph import TGraph
    assemblies=place_witness.get("assemblies", [])
    if not assemblies:
        raise ValueError("Place witness has no assemblies")
    census=[]
    for index,assembly in enumerate(assemblies):
        routes=assembly["routes"]
        nodes=routes["voids"]
        loc={name:pos for pos,name in enumerate(nodes)}
        if len(loc)!=len(nodes):
            raise ValueError("Optional TGraph pilot needs unique native handles")
        if any(a not in loc or b not in loc for a,b in routes["links"]):
            raise ValueError("Optional TGraph pilot found an unbound link")
        if not nodes:
            census.append({"assembly":index,"nodes":0,"edges":0,"state":"empty"})
            continue
        vertices=[Vertex.ByCoordinates(i*2.0,0,0) for i in range(len(nodes))]
        edges=[Edge.ByVertices(vertices[loc[a]],vertices[loc[b]])
               for a,b in routes["links"]]
        graph=TGraph.ByVerticesEdges(vertices,edges)
        if graph is None:
            raise ValueError("TopologicPy refused the bounded source graph")
        observed=(len(TGraph.Vertices(graph)),len(TGraph.Edges(graph)))
        if observed!=(len(nodes),len(edges)):
            raise ValueError("TopologicPy pilot disagrees with native void adjacency")
        census.append({"assembly":index,"nodes":observed[0],"edges":observed[1],
                       "state":"observed"})
    return {"backend":"TopologicPy TGraph",
            "source_witness_id":place_witness["source_witness_id"],
            "assemblies":census,
            "authority":"read-only graph comparison, not native or Operator authority"}


def pyribs_archive_pilot(cohort):
    """Inspect already admitted Fire alternatives in an optional QD grid."""
    from ribs.archives import GridArchive
    import numpy as np
    rows=cohort["candidates"]
    if not rows:
        raise ValueError("No native-admitted candidate rows to illuminate")
    solutions=np.arange(len(rows),dtype=np.float64).reshape(-1,1)
    changed=np.asarray([r["changed_pixels_all_views"] for r in rows],dtype=np.float64)
    if not np.isfinite(changed).all() or np.any(changed<0):
        raise ValueError("Optional QD descriptor requires finite pixel counts")
    measures=np.stack((changed/max(1.0,float(changed.max())),
                      np.asarray([len(r["expressed_views"])/6 for r in rows])),axis=1)
    archive=GridArchive(solution_dim=1,dims=[5,5],ranges=[(0,1.00001),(0,1.00001)])
    archive.add(solution=solutions,objective=np.zeros(len(rows)),measures=measures)
    return {"backend":"pyribs GridArchive","occupied_cells":len(archive),
            "candidates":len(rows),
            "authority":"diagnostic only; no OODA-HA archive mutation or winner selection"}
