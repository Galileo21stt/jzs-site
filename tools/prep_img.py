import os, shutil, json, sys
from PIL import Image
Image.MAX_IMAGE_PIXELS = None
SRC = sys.argv[1]; DST = sys.argv[2]
mp = {
 'zj01':'中建史/01_中建史考研重点：建筑群组合方式','zj02':'中建史/02_中建史所有单体石构建筑专题','zj03':'中建史/03_中建史所有单体木构建筑专题',
 'wj01':'外建史/01_一图流理清所有人物_外建史人名专题','wj02':'外建史/02_外建史西方奴隶社会专题','wj03':'外建史/03_外建史各种有关城市的表述_了解即可',
 'wj04':'外建史/04_外建史专题：后文艺复兴和前现代主义','wj05':'外建史/05_外建史所有广场一图流','wj06':'外建史/06_后现代七大流派',
 'wj07':'外建史/07_战后七大思潮专题_作者作品名称一一对应即','wj08':'外建史/08_外近现所有流派特点专题_名词解释论述可用','wj09':'外建史/09_现代建筑五大师专题'}
os.makedirs(f'{DST}/orig', exist_ok=True); os.makedirs(f'{DST}/tiles', exist_ok=True)
manifest = {}
TW, TH = 1500, 1500
for tid, rel in mp.items():
    d = os.path.join(SRC, rel); out = []
    for fn in sorted(os.listdir(d)):
        if not fn.lower().endswith(('.png','.jpg')): continue
        stem, ext = os.path.splitext(fn)
        stem = stem.replace('_封面','_cover')
        oname = f'{tid}_{stem}{ext.lower()}'
        shutil.copy2(os.path.join(d, fn), f'{DST}/orig/{oname}')
        im = Image.open(os.path.join(d, fn)).convert('RGB')
        w, h = im.size
        s = min(1.0, TW / w); nw, nh = round(w*s), round(h*s)
        if s < 1: im = im.resize((nw, nh), Image.LANCZOS)
        tiles = []; y = 0; i = 0
        while y < nh:
            th = min(TH, nh - y)
            if nh - (y+th) < 300 and nh - (y+th) > 0: th = nh - y
            t = im.crop((0, y, nw, y+th)); tn = f'{tid}_{stem}_{i:02d}.jpg'
            t.save(f'{DST}/tiles/{tn}', quality=84, optimize=True, progressive=True)
            tiles.append([tn, th]); y += th; i += 1
        out.append({'orig': oname, 'w': w, 'h': h, 'tw': nw, 'tiles': tiles, 'cover': '_cover' in stem})
    manifest[tid] = out
with open(f'{DST}/manifest.json','w') as f: json.dump(manifest, f, ensure_ascii=False)
print(json.dumps({k:[(x['orig'],len(x['tiles'])) for x in v] for k,v in manifest.items()}, ensure_ascii=False))
