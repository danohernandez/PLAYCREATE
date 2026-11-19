function createSequencePlayback({previous,next,toggle,speed,position,render}){
 let steps=[],index=0,frame=null,lastTime=null,elapsed=0,timeline,finished=false;
 function update(){
  previous.disabled=index===0;
  next.disabled=index>=steps.length-1;
  toggle.disabled=!steps.length||(steps.length===1&&!timeline?.animated);
  toggle.textContent=frame!==null?'Pausar':finished?'Repetir':'Reproducir';
  position.textContent=steps.length?(index+1)+' de '+steps.length:'';
 }
 function show(){
  elapsed=0;
  timeline=steps.length?render(steps[index],index):null;
  timeline?.draw(0);
  update();
 }
 function stop(){
  if(frame!==null)cancelAnimationFrame(frame);
  frame=null;lastTime=null;update();
 }
 function tick(time){
  if(lastTime!==null)elapsed+=Math.min(100,time-lastTime)*(Number(speed.value)||1);
  lastTime=time;
  timeline?.draw(elapsed);
  if(elapsed>=(timeline?.duration??1500)){
   if(index===steps.length-1){finished=true;stop();return;}
   index++;show();
  }
  frame=requestAnimationFrame(tick);
 }
 function start(){
  if(toggle.disabled)return;
  if(finished){index=0;finished=false;show();}
  frame=requestAnimationFrame(tick);update();
 }
 function move(delta){
  stop();
  const target=index+delta;
  if(target>=0&&target<steps.length){index=target;finished=false;show();}
 }
 toggle.onclick=()=>frame===null?start():stop();
 previous.onclick=()=>move(-1);
 next.onclick=()=>move(1);
 return {
  load(items,autoplay=false){stop();steps=items;index=0;finished=false;show();if(autoplay)start()},
  stop,
  move
 };
}

function courtMotionPath(arrow,start){
 const end={x:arrow.ex,y:arrow.ey};
 const control=Number.isFinite(arrow.cx)&&Number.isFinite(arrow.cy)?{x:arrow.cx,y:arrow.cy}:null;
 const interpolate=(a,b,t)=>({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t});
 if(!control)return t=>interpolate(start,end,t);
 if(arrow.lineShape==='angle'){
  const a=Math.hypot(control.x-start.x,control.y-start.y),b=Math.hypot(end.x-control.x,end.y-control.y);
  const split=a/(a+b||1);
  return t=>t<split?interpolate(start,control,t/split):interpolate(control,end,(t-split)/(1-split||1));
 }
 return t=>interpolate(interpolate(start,control,t),interpolate(control,end,t),t);
}

function createCourtMotion(svg,elements,full){
 // Arrows are acted on in drawing order. Their start points identify nearby players.
 const actors=elements.filter(e=>e.type==='player'||e.type==='defender');
 const arrows=elements.filter(e=>['move','dribble','pass','screen'].includes(e.type)&&Number.isFinite(e.ex)&&Number.isFinite(e.ey));
 const initial=new Map(actors.map(e=>[e.id,{x:e.x,y:e.y}]));
 const positions=new Map(initial),actions=[];
 let ball=elements.find(e=>e.type==='ball');
 let ballPosition=ball?{x:ball.x,y:ball.y}:null;
 const nearest=(point,candidates=actors,limit=60)=>{
  let id,dist=limit;
  for(const e of candidates){
   const pos=positions.get(e.id),d=Math.hypot(pos.x-point.x,pos.y-point.y);
   if(d<dist){id=e.id;dist=d}
  }
  return id;
 };
 let holder=actors.some(e=>e.id===ball?.holder)?ball.holder:ballPosition?nearest(ballPosition,actors,30):undefined;
 const offset=point=>({x:point.x+21,y:point.y+6});
 let cursor=300;
 for(const arrow of arrows){
  const pass=arrow.type==='pass',dribble=arrow.type==='dribble';
  const actor=pass?undefined:nearest(arrow,dribble?actors.filter(e=>e.type==='player'):actors);
  if(!pass&&actor===undefined)continue;
  const start=pass?{x:arrow.x,y:arrow.y}:positions.get(actor);
  if(Math.hypot(arrow.ex-start.x,arrow.ey-start.y)<3)continue;
  const path=courtMotionPath(arrow,start);
  const distance=Math.hypot(arrow.ex-start.x,arrow.ey-start.y);
  const duration=pass?Math.max(350,Math.min(800,distance*2)):Math.max(500,Math.min(1600,distance*5));
  const carry=dribble||(!pass&&holder===actor);
  actions.push({actor,pass,carry,path,start:cursor,end:cursor+duration});
  cursor+=duration;
  const end=path(1);
  if(pass)holder=nearest(end,actors,34);
  else{
   positions.set(actor,end);
   if(dribble)holder=actor;
  }
 }
 const needsBall=actions.some(action=>action.pass||action.carry);
 const syntheticBall=!ball&&needsBall;
 if(syntheticBall)ball={id:'playback-ball',type:'ball',x:0,y:0,size:20};
 svg.setAttribute('viewBox','0 0 600 '+(full?1060:600));
 svg.innerHTML=(full?courtBase(true):referenceCourt())+elements.map(elementSVG).join('')+(syntheticBall?elementSVG(ball):'');
 const nodes=new Map([...svg.querySelectorAll('[data-id]')].map(node=>[node.getAttribute('data-id'),node]));
 const place=(id,p)=>nodes.get(String(id))?.setAttribute('transform','translate('+p.x+' '+p.y+')');
 const ballNode=ball?nodes.get(String(ball.id)):null;
 return {animated:actions.length>0,duration:actions.length?cursor+450:1300,draw(time){
  for(const [id,point] of initial)place(id,point);
  let currentBall=ballPosition;
  for(const action of actions){
   if(time<action.start)break;
   const point=action.path(Math.min(1,(time-action.start)/(action.end-action.start)));
   if(action.actor!==undefined)place(action.actor,point);
   if(action.pass||action.carry)currentBall=action.pass?point:offset(point);
   if(time<action.end)break;
  }
  if(ballNode){
   ballNode.setAttribute('visibility',currentBall?'visible':'hidden');
   if(currentBall)place(ball.id,currentBall);
  }
 }};
}
