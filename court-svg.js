function courtBase(full){let h=full?1060:560;let half='<path d="M65 20V170 A235 235 0 0 0 535 170V20 M205 20V245H395V20 M240 245 A60 60 0 0 0 360 245 M240 245 A60 60 0 0 1 360 245"/><path d="M267 65H333"/><circle cx="300" cy="80" r="12"/>';return '<rect width="600" height="'+h+'" fill="#FFFFFF"/><g stroke="#000000" stroke-width="2.5" fill="none"><rect x="20" y="20" width="560" height="'+(h-40)+'"/>'+half+(full?'<g transform="translate(600 1060) rotate(180)">'+half+'</g><path d="M20 530H580"/><circle cx="300" cy="530" r="60"/>':'<path d="M240 540 A60 60 0 0 1 360 540"/>')+'</g>'}
function basketballSVG(radius){return '<g transform="scale('+(radius/10)+') rotate(-20)" stroke="#161616" stroke-linecap="round" stroke-linejoin="round"><circle r="10" fill="#F59A23" stroke-width=".85"/><path d="M-10 0H10M0-10V10M-7.071-7.071C-2.8-4.8-2.8 4.8-7.071 7.071M7.071-7.071C2.8-4.8 2.8 4.8 7.071 7.071" fill="none" stroke-width=".72"/></g>'}

function highlightSVG(e){
 const c=esc(e.color||'#E45454'),rx=e.rx||40,ry=e.ry||40;
 let shape=e.kind==='zone'?'<rect x="'+(-rx)+'" y="'+(-ry)+'" width="'+(rx*2)+'" height="'+(ry*2)+'" rx="1"/>':'<ellipse rx="'+rx+'" ry="'+ry+'"/>';
 return '<g data-id="'+esc(e.id)+'" transform="translate('+e.x+' '+e.y+')" style="cursor:move"><g fill="'+c+'" fill-opacity=".2" stroke="'+c+'" stroke-width="2.5">'+shape+'</g>'+''+'</g>';
}
function dribbleArrowGeometry(e){
 const ex=e.ex??e.x+70,ey=e.ey??e.y-70,cx=e.cx??(e.x+ex)/2,cy=e.cy??(e.y+ey)/2;
 const samples=[],count=Math.max(32,Math.min(600,Math.ceil((Math.hypot(cx-e.x,cy-e.y)+Math.hypot(ex-cx,ey-cy))/2)));
 for(let i=0;i<=count;i++){
  const t=i/count,u=1-t;
  const p=e.lineShape==='angle'?(t<.5?{x:e.x+(cx-e.x)*2*t,y:e.y+(cy-e.y)*2*t}:{x:cx+(ex-cx)*(2*t-1),y:cy+(ey-cy)*(2*t-1)}):{x:u*u*e.x+2*u*t*cx+t*t*ex,y:u*u*e.y+2*u*t*cy+t*t*ey};
  p.distance=i?samples[i-1].distance+Math.hypot(p.x-samples[i-1].x,p.y-samples[i-1].y):0;samples.push(p);
 }
 const total=samples[count].distance;
 let dx=ex-cx,dy=ey-cy;if(Math.hypot(dx,dy)<.001){dx=ex-e.x;dy=ey-e.y}
 const length=Math.hypot(dx,dy)||1,ux=dx/length,uy=dy/length,head=Math.min(12,Math.max(3,total*.3)),half=head*.45;
 const base={x:ex-ux*head,y:ey-uy*head},stem={x:ex-ux*(head+7),y:ey-uy*(head+7)};
 let d='M'+e.x+' '+e.y,index=1,zig=0;
 const stop=Math.max(0,total-head-9);
 for(let distance=8;distance<stop;distance+=8){
  while(index<count&&samples[index].distance<distance)index++;
  const a=samples[index-1],b=samples[index],fraction=(distance-a.distance)/(b.distance-a.distance||1);
  const x=a.x+(b.x-a.x)*fraction,y=a.y+(b.y-a.y)*fraction,tangent=Math.hypot(b.x-a.x,b.y-a.y)||1,offset=(++zig%2?4:-4)*Math.min(1,(stop-distance)/10);
  d+=' L'+(x-(b.y-a.y)/tangent*offset)+' '+(y+(b.x-a.x)/tangent*offset);
 }
 if(total>head+9)d+=' L'+stem.x+' '+stem.y;
 d+=' L'+base.x+' '+base.y;
 const tip='<path data-dribble-arrowhead d="M'+ex+' '+ey+' L'+(base.x-uy*half)+' '+(base.y+ux*half)+' L'+(base.x+uy*half)+' '+(base.y-ux*half)+' Z" fill="#000000" stroke="#000000" stroke-width="1" stroke-linejoin="round"/>';
 return {d,tip,end:{x:ex,y:ey},base,direction:{x:ux,y:uy}};
}
function elementSVG(e){if(e.type==='highlight')return highlightSVG(e);let c=['move','pass','dribble','screen'].includes(e.type)?'#000000':(e.type==='player'?'#007AAD':esc(e.color)),s=e.size||20,w=e.width||3;if(['player','defender','ball','text','cone','marker'].includes(e.type)){let shape=e.type==='cone'?'<g transform="scale('+(s/20)+')"><path d="M-16 15H16L12 20H-12Z" fill="#E66B10" stroke="#161616" stroke-width="1.5"/><path d="M0-20L12 15H-12Z" fill="#F59A23" stroke="#161616" stroke-width="1.5"/><path d="M-4.5-7H4.5L6.5-1H-6.5Z M-8 5H8L10 11H-10Z" fill="#FFFBFC"/></g>':e.type==='player'?'<circle r="'+s+'" fill="'+c+'"/>':e.type==='ball'?basketballSVG(s*.6):'';let label=e.type==='marker'?'#':e.type==='defender'?'X'+e.n:['ball','cone'].includes(e.type)?'':e.n;return '<g data-id="'+e.id+'" transform="translate('+e.x+' '+e.y+')" style="cursor:move">'+shape+'<text text-anchor="'+(e.type==='text'?(e.align||'middle'):'middle')+'" dominant-baseline="central" font-family="Arial" font-size="'+(e.type==='text'?s:s*.95)+'" font-weight="'+(e.type==='text'?(e.bold?700:400):700)+'" text-decoration="'+(e.type==='text'?([e.underline?'underline':'',e.strike?'line-through':''].filter(Boolean).join(' ')||'none'):'none')+'" fill="'+(e.type==='player'?'white':c)+'">'+esc(label)+'</text></g>'}let ex=e.ex??e.x+70,ey=e.ey??e.y-70,cx=e.cx??(e.x+ex)/2,cy=e.cy??(e.y+ey)/2;let curved=e.cx!=null,angle=Math.atan2(ey-cy,ex-cx);let d='M'+e.x+' '+e.y+(curved?(e.lineShape==='angle'?' L'+cx+' '+cy+' L'+ex+' '+ey:' Q'+cx+' '+cy+' '+ex+' '+ey):' L'+ex+' '+ey);let dribble=null;if(e.type==='dribble'){dribble=dribbleArrowGeometry(e);d=dribble.d}let tip=dribble?dribble.tip:e.type==='screen'?'<path d="M'+(ex-Math.sin(angle)*10)+' '+(ey+Math.cos(angle)*10)+' L'+(ex+Math.sin(angle)*10)+' '+(ey-Math.cos(angle)*10)+'"/>':'<path d="M'+(ex-12*Math.cos(angle-.45))+' '+(ey-12*Math.sin(angle-.45))+' L'+ex+' '+ey+' L'+(ex-12*Math.cos(angle+.45))+' '+(ey-12*Math.sin(angle+.45))+'"/>';return '<g data-id="'+e.id+'" stroke="'+c+'" fill="none" stroke-width="'+w+'" style="cursor:move"><path d="'+d+'" stroke="transparent" stroke-width="24" pointer-events="stroke"/><path d="'+d+'" '+(e.type==='pass'?'stroke-dasharray="9 7"':'')+'/>'+tip+'</g>'}

function referenceCourt(){return '<rect width="600" height="600" fill="#FFFFFF"/><g transform="translate(0 20)">'+courtBase(false)+'</g>'}
const sharedElementTypes=['player','defender','ball','text','cone','marker','move','pass','dribble','screen','highlight'];
function packSharedElement(e){
 const fields=[sharedElementTypes.indexOf(e.type),e.x,e.y,e.size,e.width,e.ex,e.ey,e.cx,e.cy,e.rx,e.ry,e.n,e.color,e.align,e.lineShape==='angle'?1:null,e.kind==='zone'?1:null,(e.bold?1:0)|(e.underline?2:0)|(e.strike?4:0)];
 if(!fields[16])fields.pop();
 while(fields.length>3&&fields.at(-1)==null)fields.pop();
 return fields.map(value=>typeof value==='number'&&Math.abs(value)<100000?Math.round(value*10)/10:value);
}
function renderSharedCourt(elements,full){
 const number=value=>typeof value==='number'&&Number.isFinite(value)?Math.max(-2000,Math.min(2000,value)):undefined;
 const height=full?1060:600;
 const shapes=elements.map((fields,index)=>{
  if(!Array.isArray(fields))return '';
  const [kind,x,y,size,width,ex,ey,cx,cy,rx,ry,n,color,align,angle,zone,format]=fields;
  const type=Number.isInteger(kind)?sharedElementTypes[kind]:undefined;
  if(!type||number(x)==null||number(y)==null)return '';
  return elementSVG({type,id:index,x:number(x),y:number(y),size:number(size),width:number(width),
   ex:number(ex),ey:number(ey),cx:number(cx),cy:number(cy),rx:number(rx),ry:number(ry),
   n:typeof n==='number'||typeof n==='string'?n:'',
   color:typeof color==='string'?color:undefined,
   align:['start','middle','end'].includes(align)?align:'middle',lineShape:angle===1?'angle':undefined,kind:zone===1?'zone':undefined,
   bold:!!(format&1),underline:!!(format&2),strike:!!(format&4)});
 }).join('');
 return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 '+height+'">'+(full?courtBase(true):referenceCourt())+shapes+'</svg>';
}
