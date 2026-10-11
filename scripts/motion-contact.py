from pathlib import Path
from PIL import Image,ImageDraw
import json
root=Path(__file__).resolve().parents[1]
rows=[]
for folder in sorted((root/'assets/motion').iterdir()):
    if not (folder/'geometry.json').exists():continue
    meta=json.loads((folder/'geometry.json').read_text());im=Image.open(root/meta['src'])
    row=Image.new('RGB',(960,170),'#ddd9ce');draw=ImageDraw.Draw(row);draw.text((4,1),folder.name,fill='#222')
    scale=min(110/max(b[2] for b in meta['frames']),144/max(b[3] for b in meta['frames']))
    for i,(x,y,w,h) in enumerate(meta['frames']):
        crop=im.crop((x,y,x+w,y+h)).resize((max(1,round(w*scale)),max(1,round(h*scale))))
        row.paste(crop,(i*120+(120-crop.width)//2,168-crop.height),crop)
    rows.append(row)
for page in range(2):
    batch=rows[page*8:(page+1)*8];out=Image.new('RGB',(960,170*len(batch)), '#ddd9ce')
    for i,row in enumerate(batch):out.paste(row,(0,170*i))
    out.save(root/f'qa/motion-contact-{page+1}.jpg',quality=92)
