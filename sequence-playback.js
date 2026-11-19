function createSequencePlayback({previous,next,toggle,speed,position,progress,clock,fullscreen,fullscreenTarget,render}){
 let steps=[],starts=[],total=0,index=-1,frame=null,lastTime=null,elapsed=0,timeline;
 const durationOf=step=>step.motion?.duration??1500;
 function updateControls(){
  previous.disabled=index<=0;
  next.disabled=index<0||index>=steps.length-1;
  toggle.disabled=!steps.length||(steps.length===1&&!steps[0].motion?.animated);
  const label=frame!==null?'Pausar':total&&elapsed===total?'Repetir':'Reproducir';
  toggle.textContent=frame!==null?'❚❚':'▶';
  toggle.setAttribute('aria-label',label);
  toggle.title=label;
  position.textContent=index<0?'':(index+1)+' de '+steps.length;
 }
 function timeLabel(ms){
  const seconds=Math.floor(ms/1000);
  return Math.floor(seconds/60)+':'+String(seconds%60).padStart(2,'0');
 }
 function seek(time){
  if(!steps.length)return;
  elapsed=Math.max(0,Math.min(total,time));
  let target=steps.length-1;
  while(target>0&&elapsed<starts[target])target--;
  if(target!==index){
   index=target;
   timeline=render(steps[index],index);
   updateControls();
  }
  timeline?.draw(elapsed-starts[index]);
  progress.value=String(Math.round(elapsed));
  const text=timeLabel(elapsed)+' / '+timeLabel(total);
  if(clock.textContent!==text){clock.textContent=text;progress.setAttribute('aria-valuetext',text);}
 }
 function stop(){
  if(frame!==null)cancelAnimationFrame(frame);
  frame=null;lastTime=null;updateControls();
 }
 function tick(time){
  if(lastTime!==null)seek(elapsed+Math.min(100,time-lastTime)*(Number(speed.value)||1));
  lastTime=time;
  if(elapsed===total){stop();return;}
  frame=requestAnimationFrame(tick);
 }
 function start(){
  if(toggle.disabled)return;
  if(elapsed===total)seek(0);
  frame=requestAnimationFrame(tick);updateControls();
 }
 function move(delta){
  const target=index+delta;
  if(target>=0&&target<steps.length){lastTime=null;seek(starts[target]);}
 }
 toggle.onclick=()=>frame===null?start():stop();
 previous.onclick=()=>move(-1);
 next.onclick=()=>move(1);
 progress.oninput=()=>{
  lastTime=null;seek(Number(progress.value));
  if(elapsed===total)stop();else updateControls();
 };
 if(fullscreen){
  fullscreen.hidden=!document.fullscreenEnabled||!fullscreenTarget?.requestFullscreen;
  fullscreen.onclick=async()=>{
   try{
    if(document.fullscreenElement===fullscreenTarget)await document.exitFullscreen();
    else await fullscreenTarget.requestFullscreen();
   }catch(error){console.warn('Pantalla completa no disponible',error);}
  };
  document.addEventListener('fullscreenchange',()=>{
   const label=document.fullscreenElement===fullscreenTarget?'Salir de pantalla completa':'Pantalla completa';
   fullscreen.title=label;fullscreen.setAttribute('aria-label',label);
  });
 }
 return {
  load(items,autoplay=false){
   stop();steps=items;starts=[];total=0;index=-1;elapsed=0;timeline=null;
   for(const step of steps){starts.push(total);total+=durationOf(step);}
   progress.max=String(total);progress.disabled=!total;
   seek(0);updateControls();if(autoplay)start();
  },
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

const isCourtArrow=element=>['move','dribble','pass','screen'].includes(element.type);
const isCourtAction=element=>isCourtArrow(element)||element.type==='marker';
const courtBallOffset=point=>({x:point.x+21,y:point.y+6});
function prepareCourtMotion(elements){
 // Arrows are acted on in drawing order. Their start points identify nearby players.
 const actors=elements.filter(e=>e.type==='player'||e.type==='defender');
 const players=actors.filter(e=>e.type==='player');
 const commands=elements.filter(e=>e.type==='marker'||(isCourtArrow(e)&&Number.isFinite(e.ex)&&Number.isFinite(e.ey)));
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
 let holder=ball&&actors.some(e=>e.id===ball.holder)?ball.holder:ballPosition?nearest(ballPosition,actors,30):undefined;
 let finalBallPosition=ballPosition,cursor=300;
 for(const arrow of commands){
  if(arrow.type==='marker'){
   const nearby=players.filter(player=>{
    const point=positions.get(player.id);
    return Math.hypot(point.x-arrow.x,point.y-arrow.y)<=85;
   });
   const from=holder??nearest(arrow,nearby,86);
   if(from===undefined||!nearby.some(player=>player.id===from))continue;
   const to=nearest(arrow,nearby.filter(player=>player.id!==from),86);
   if(to===undefined)continue;
   const start=finalBallPosition??courtBallOffset(positions.get(from));
   const end=courtBallOffset(positions.get(to));
   const path=courtMotionPath({ex:end.x,ey:end.y},start);
   actions.push({pass:true,path,start:cursor,end:cursor+320});
   cursor+=320;holder=to;finalBallPosition=end;
   continue;
  }
  const pass=arrow.type==='pass',dribble=arrow.type==='dribble';
  const actor=pass?undefined:nearest(arrow,dribble?players:actors);
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
  if(pass){holder=nearest(end,actors,34);finalBallPosition=end;}
  else{
   positions.set(actor,end);
   if(dribble)holder=actor;
   if(carry)finalBallPosition=courtBallOffset(end);
  }
 }
 const needsBall=actions.some(action=>action.pass||action.carry);
 const syntheticBall=!ball&&needsBall;
 if(syntheticBall)ball={id:'playback-ball',type:'ball',x:0,y:0,size:20};
 return {initial,actions,ball,ballPosition,syntheticBall,finalPositions:positions,finalBallPosition,finalHolder:holder,animated:actions.length>0,duration:actions.length?Math.ceil(cursor+450):1300};
}
function drawPlaybackCourt(svg,elements,full,extra=''){
 svg.setAttribute('viewBox','0 0 600 '+(full?1060:600));
 svg.innerHTML=(full?courtBase(true):referenceCourt())+elements.filter(e=>!isCourtAction(e)).map(elementSVG).join('')+extra;
}
function connectPlaybackFrames(frames){
 const actorKey=element=>element.n==null||element.n===''?element.type+':'+element.id:element.type+':'+String(element.n);
 return frames.map((frame,index)=>{
  const previous=frames[index-1];
  if(!frame.motion||!previous?.motion)return frame;
  const endings=new Map();
  for(const element of previous.elements){
   const point=previous.motion.finalPositions.get(element.id);
   if(point)endings.set(actorKey(element),point);
  }
  const entryPositions=new Map();
  for(const element of frame.elements){
   if(!frame.motion.initial.has(element.id))continue;
   const point=endings.get(actorKey(element));
   if(point)entryPositions.set(element.id,point);
  }
  return {...frame,motion:{...frame.motion,entryPositions,entryBall:previous.motion.finalBallPosition}};
 });
}
function smoothMotionTime(value){
 const t=Math.max(0,Math.min(1,value));
 return t*t*(3-2*t);
}
function interpolateCourtPoint(a,b,t){
 return {x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t};
}
function sampleCourtMotion(motion,time){
 const {initial,actions,ballPosition,entryPositions,entryBall}=motion;
 const positions=new Map();
  const entry=smoothMotionTime(time/300);
  for(const [id,point] of initial){
   const start=entry<1?entryPositions?.get(id):null;
   positions.set(id,start?interpolateCourtPoint(start,point,entry):point);
  }
  let currentBall=entry<1&&entryBall&&ballPosition?interpolateCourtPoint(entryBall,ballPosition,entry):ballPosition;
  for(const action of actions){
   if(time<action.start)break;
   const point=action.path(smoothMotionTime((time-action.start)/(action.end-action.start)));
   if(action.actor!==undefined)positions.set(action.actor,point);
   if(action.pass||action.carry)currentBall=action.pass?point:courtBallOffset(point);
   if(time<action.end)break;
  }
 return {positions,ball:currentBall};
}
function createCourtMotion(svg,elements,full,motion){
 const {ball,syntheticBall}=motion;
 drawPlaybackCourt(svg,elements,full,syntheticBall?elementSVG(ball):'');
 const nodes=new Map([...svg.querySelectorAll('[data-id]')].map(node=>[node.getAttribute('data-id'),node]));
 const place=(id,p)=>nodes.get(String(id))?.setAttribute('transform','translate('+p.x+' '+p.y+')');
 const ballNode=ball?nodes.get(String(ball.id)):null;
 return {draw(time){
  const pose=sampleCourtMotion(motion,time);
  for(const [id,point] of pose.positions)place(id,point);
  if(ballNode){
   ballNode.setAttribute('visibility',pose.ball?'visible':'hidden');
   if(pose.ball)place(ball.id,pose.ball);
  }
 }};
}
