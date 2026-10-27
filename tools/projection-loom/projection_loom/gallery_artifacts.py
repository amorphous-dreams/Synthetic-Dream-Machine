"""Reproducible six-view and original-source galleries for Operator Aftermath.

The gallery changes no native candidate. All cameras are seed-frozen before
regrowth; a visual contact sheet has no structural or calibration authority.
"""
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw
from .render import silhouette

VIEWS=("oblique","front","left","back","right","top")


def finalist_gallery(build,cameras,output,*,alpha=None,size=(128,192)):
    folder=Path(output)
    folder.mkdir(parents=True,exist_ok=True)
    mesh=build.assembly.tessellate(union=True)
    panels=[]
    for label in VIEWS:
        image=Image.fromarray(silhouette(mesh,cameras[label],size),"L").convert("RGB")
        panels.append(image)
    w,h=size
    sheet=Image.new("RGB",(3*w,2*(h+24)),(15,20,27))
    draw=ImageDraw.Draw(sheet)
    for i,(name,image) in enumerate(zip(VIEWS,panels)):
        x=(i%3)*w;y=(i//3)*(h+24)
        sheet.paste(image,(x,y+24))
        draw.text((x+4,y+5),name,fill=(235,238,243))
    six=folder/"six_view.png";sheet.save(six)
    result={"six_view":"six_view.png",
            "views":list(VIEWS),
            "camera_authority":"seed-frozen-synthetic-observation",
            "source_comparison":None}
    if alpha is not None:
        pixels=np.asarray(alpha,dtype=np.uint8)
        if pixels.ndim!=2 or not pixels.size:
            raise ValueError("Full source must have an original L8 alpha plane")
        native=(pixels.shape[1],pixels.shape[0])
        original=Image.fromarray(pixels,"L")
        rendered=Image.fromarray(silhouette(mesh,cameras["oblique"],native),"L")
        original.save(folder/"original_alpha_native.png")
        rendered.save(folder/"candidate_oblique_native.png")
        compare=Image.new("RGB",(512,416),(14,18,24))
        compare.paste(original.resize((256,384)).convert("RGB"),(0,30))
        compare.paste(rendered.resize((256,384)).convert("RGB"),(256,30))
        pen=ImageDraw.Draw(compare)
        pen.text((5,7),"Original alpha",fill=(245,245,245))
        pen.text((261,7),"Native CAD - provisional camera",fill=(245,245,245))
        compare.save(folder/"oblique_comparison.png")
        result["source_comparison"]={
            "size":list(native),
            "original_alpha":"original_alpha_native.png",
            "native_oblique":"candidate_oblique_native.png",
            "overview":"oblique_comparison.png",
            "registration_status":"provisional-not-metric"}
    return result
