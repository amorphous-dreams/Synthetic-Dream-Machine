"""Native-anchored location and circulation evidence for Projection Loom.

Shapely analyzes bounded XY samples of *actual carved CAD material/voids*.
Sampling is explicitly approximate and NEVER grants native validity.
NetworkX witnesses declared void connections after the native VoidAssembly audit.
No hidden geometry, physical load, traversability guarantee or Operator choice.
"""
from __future__ import annotations

import math
import cadquery as cq
import networkx as nx
from shapely import box as planar_box, union_all

from .provenance_encoding import canonical_json_sha256

SCHEMA = "projection-loom/place-witness"


def _grid(solid, *, z, extent, cell, max_cells=2304):
    x0,y0,x1,y1 = extent
    nx_cells=math.ceil((x1-x0)/cell)
    ny_cells=math.ceil((y1-y0)/cell)
    if (min(nx_cells,ny_cells)<1 or nx_cells*ny_cells>max_cells):
        raise ValueError("Plan sampling exceeds bounded resolution budget")
    occupied=[]
    for iy in range(ny_cells):
        for ix in range(nx_cells):
            xa=x0+ix*cell; ya=y0+iy*cell
            xb=min(x1,xa+cell); yb=min(y1,ya+cell)
            if solid.isInside(cq.Vector((xa+xb)/2,(ya+yb)/2,z),1e-7):
                occupied.append(planar_box(xa,ya,xb,yb))
    if not occupied:
        from shapely.geometry import GeometryCollection
        return GeometryCollection()
    return union_all(occupied)


def _domain(source, variants, padding):
    boxes=[s.BoundingBox() for s in [source,*variants]]
    lo_x=min(b.xmin for b in boxes)-padding
    lo_y=min(b.ymin for b in boxes)-padding
    hi_x=max(b.xmax for b in boxes)+padding
    hi_y=max(b.ymax for b in boxes)+padding
    return [float(lo_x),float(lo_y),float(hi_x),float(hi_y)]


def _routes(assembly):
    if assembly.voids is None:
        return {"voids":[],"links":[],"exteriors":[],"reached":[],
                "hops":{},"path_handles":{},
                "interpretation":"no authored voids; no route claim"}
    voids=assembly.voids.voids
    graph=nx.Graph()
    graph.add_nodes_from(sorted(voids))
    for name,part in voids.items():
        for neighbor in part.connects:
            if neighbor in voids and neighbor!=name:
                graph.add_edge(name,neighbor)
    exterior=sorted(name for name,p in voids.items() if p.exterior)
    routes={}
    for name in sorted(voids):
        possible=[nx.shortest_path(graph,src,name)
                  for src in exterior if nx.has_path(graph,src,name)]
        if possible:
            routes[name]=min(possible,key=lambda r:(len(r),tuple(r)))
    return {"voids":sorted(voids),
            "links":[list(e) for e in sorted(tuple(sorted(e)) for e in graph.edges)],
            "exteriors":exterior,
            "reached":sorted(routes),
            "hops":{k:len(v)-1 for k,v in routes.items()},
            "path_handles":routes,
            "interpretation":"declared native-overlap routes; graph hops are not walking distances"}


def _sections(source, variants, *, elevations, cell, clearance, padding):
    domain=_domain(source,variants,padding)
    solids=[source,*variants]
    rows=[]
    for z in elevations:
        footprints=[_grid(s,z=z,extent=domain,cell=cell) for s in solids]
        original=footprints[0]
        samples=[]
        for poly in footprints:
            # GEOS planar operations describe sampled sections only.
            common=poly.intersection(original).area
            change=poly.symmetric_difference(original).area
            samples.append({"sampled_material_area":round(poly.area,6),
                            "sampled_shared_material_area":round(common,6),
                            "sampled_symmetric_difference_area":round(change,6),
                            "sampled_material_interior_area_after_erosion":round(
                                poly.buffer(-clearance/2).area,6)})
        rows.append({"elevation":z,"material":samples})
    return domain, rows


def review_place(source_assembly, alternatives, *, location, elevations=(1.6,3.2),
                 cell=.5, clearance=.7, padding=1.5):
    """Analyze audited source plus separately native-audited alternatives.

    Section domain is frozen across all alternatives in this review. GEOS
    sections are cell-center samples; do not infer a continuous walkable route
    or certify physics from a sampled negative-space footprint.
    """
    if (not 1<=len(alternatives)<=8 or not 1<=len(elevations)<=8
            or any(not math.isfinite(z) for z in elevations)
            or sorted(set(elevations))!=list(elevations)):
        raise ValueError("Place review requires 1..8 alternatives and sorted elevations")
    if not isinstance(location,str) or not location.strip():
        raise ValueError("Place review needs a source location")
    for label,value,lo,hi in (("cell",cell,.2,2.0),
                              ("clearance",clearance,.2,4.0),
                              ("padding",padding,0.0,8.0)):
        if type(value) not in (int,float) or not math.isfinite(value) or not lo<=value<=hi:
            raise ValueError("Invalid bounded planar parameter: "+label)
    all_assemblies=[source_assembly,*alternatives]
    # Bound the total native inside-solid predicates, not just each single
    # section. Every carved void also contributes separate section samples.
    shape_count=len(all_assemblies)+sum(
        len(a.voids.voids) if a.voids is not None else 0
        for a in all_assemblies)
    # Preflight using each authored part's bounding box: no expensive
    # fuse, carve, or sampled native call happens before the global budget.
    solids_bounds=[part.solid.BoundingBox() for assembly in all_assemblies
                   for part in assembly.parts.values()]
    span_x=max(bb.xmax for bb in solids_bounds)-min(bb.xmin for bb in solids_bounds)+2*padding
    span_y=max(bb.ymax for bb in solids_bounds)-min(bb.ymin for bb in solids_bounds)+2*padding
    predicates=math.ceil(span_x/cell)*math.ceil(span_y/cell)*len(elevations)*shape_count
    if predicates>60000:
        raise ValueError("Place sampling exceeds total native query budget")
    audits=[a.audit(join=True) for a in all_assemblies]
    if any(not a.get("valid") or a.get("union_solids")!=1 for a in audits):
        raise ValueError("Place review requires all sources to pass native CAD/void audit")
    solids=[a.material_solid() for a in all_assemblies]
    domain,sections=_sections(solids[0],solids[1:],elevations=elevations,
                              cell=cell,clearance=clearance,padding=padding)
    baseline=solids[0]
    rows=[]
    for idx,(assembly,solid) in enumerate(zip(all_assemblies,solids)):
        # These are exact BRep material differences, independent of sampling.
        if idx==0:
            added=removed=0.
        else:
            addition=solid.cut(baseline)
            subtraction=baseline.cut(solid)
            if not addition.isValid() or not subtraction.isValid():
                raise ValueError("Native difference operation produced invalid geometry")
            added=float(addition.Volume()); removed=float(subtraction.Volume())
        routes=_routes(assembly)
        void_samples=[]
        for name in routes["voids"]:
            part=assembly.voids.voids[name]
            by_level=[]
            for z in elevations:
                poly=_grid(part.solid,z=z,extent=domain,cell=cell)
                by_level.append({"elevation":z,"sampled_void_area":round(poly.area,6),
                    "sampled_void_interior_area_after_erosion":round(
                        poly.buffer(-clearance/2).area,6)})
            void_samples.append({"handle":name,"levels":by_level})
        rows.append({
            "role":"original" if idx==0 else "alternative",
            "witness_id":assembly.relation_witness(location=location).witness_id,
            "native_shell_union_volume":float(audits[idx]["union_volume"]),
            "native_carved_material_volume":float(solid.Volume()),
            "exact_native_material_added":added,
            "exact_native_material_removed":removed,
            "routes":routes, "sampled_voids":void_samples,
        })
    data={"schema":SCHEMA,"location":location,"source_witness_id":rows[0]["witness_id"],
          "grid":{"cell":cell,"elevations":list(elevations),
                  "domain":domain,"clearance_probe":clearance,
                  "max_query_budget":60000,"estimated_native_point_queries":predicates,
                  "uncertainty":"cell-centre raster XY diagnostic, not exact plan clearance"},
          "sections":sections,"assemblies":rows,
          "authority":"native CAD audit precedes sampled planar analysis; no inferred occupancy or approval"}
    data["sha256"]=canonical_json_sha256(data)
    return data
