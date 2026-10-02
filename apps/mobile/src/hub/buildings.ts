/** Building drawings of screen-hub (`11 More Screens`, function `parts`), ported to typed code. Coordinates are the design's. */
export interface Part {
  d: string;
  f: string;
  stroke: string;
  width: number;
  opacity: number;
}

export type BuildingType = 'tower' | 'crenel' | 'shop' | 'dome' | 'badgir';

export interface Shape {
  x: number;
  by: number;
  w: number;
  h: number;
  type: BuildingType;
  body: string;
  roof: string;
  awn?: string;
}

export function buildingParts(b: Shape): Part[] {
  const { x, by, w, h } = b;
  const L = x - w / 2;
  const top = by - h;
  const P: Part[] = [];
  const add = (d: string, f: string, s?: string, wd?: number, o?: number) => P.push({ d, f, stroke: s || '#4A2E1E', width: wd ?? 2.4, opacity: o ?? 1 });
 add(`M${L-10} ${by} Q${x} ${by+16} ${L+w+10} ${by}Z`,'#3A2418','none',0,.18);
 if(b.type==='tower'){add(`M${L-6} ${top} L${x} ${top-40} L${L+w+6} ${top}Z`,b.roof);add(`M${x} ${top-40} v-10`,'none');}
 if(b.type==='dome'){const r = w * 0.34;add(`M${x-r} ${top} C${x-r} ${top-r*1.5} ${x+r} ${top-r*1.5} ${x+r} ${top}Z`,b.roof);add(`M${x} ${top-r*1.12} v-12`,'none');add(`M${x-r*.6} ${top-r*.5} Q${x-r*.4} ${top-r*.95} ${x-r*.05} ${top-r*1.05}`,'none','#fff',2.2,.6);}
 if(b.type==='badgir'){add(`M${L+w-30} ${top} V${top-36} h22 V${top}Z`,b.body);add(`M${L+w-25} ${top-30} v14 M${L+w-19} ${top-30} v14 M${L+w-13} ${top-30} v14`,'none','#4A2E1E',2.2);add(`M${L+w-33} ${top-40} h28 v6 h-28Z`,b.roof);}
 add(`M${L} ${by} V${top} H${L+w} V${by}Z`,b.body);
 if(b.type==='crenel'){let d='';for(let cx=L;cx<L+w-4;cx+=20)d+=`M${cx} ${top} v-10 h12 v10Z `;add(d,b.roof);}
 add(`M${L-4} ${top-2} h${w+8} v9 h-${w+8}Z`,b.roof);
 add(`M${L} ${top+12} h${w} v6 h-${w}Z`,'#3E93B8');
 const dw=Math.min(28,w*.3),dh=h*.56;add(`M${x-dw/2} ${by} V${by-dh+dw/2} A${dw/2} ${dw/2} 0 0 1 ${x+dw/2} ${by-dh+dw/2} V${by}Z`,'#6A3018');
 add(`M${x-dw/2+4} ${by} V${by-dh+dw/2+2} A${dw/2-4} ${dw/2-4} 0 0 1 ${x+dw/2-4} ${by-dh+dw/2+2} V${by}Z`,'#E0803E','none',0,.55);
 if(w>60){const ww=12;[L+w*.18,L+w*.82].forEach(cx=>add(`M${cx-ww/2} ${top+44} V${top+32} A${ww/2} ${ww/2} 0 0 1 ${cx+ww/2} ${top+32} V${top+44}Z`,'#5A2A14'));}
 if(b.type==='tower'){add(`M${x} ${top+30} m-11 0 a11 11 0 1 0 22 0 a11 11 0 1 0 -22 0`,'#FFF6E8');add(`M${x} ${top+30} v-7 M${x} ${top+30} h5`,'none','#4A2E1E',2.2);}
 if(b.awn){add(`M${L-4} ${top+20} h${w+8} l-8 16 h-${w-8}Z`,b.awn);let d='';for(let sx=L+4;sx<L+w-6;sx+=14)d+=`M${sx} ${top+20} l-2 16 h7 l2 -16Z `;add(d,'#FFF3E0','none',0,.95);}
 add(`M${L+5} ${by-6} V${top+22}`,'none','#fff',2.2,.5);
  return P;
}
