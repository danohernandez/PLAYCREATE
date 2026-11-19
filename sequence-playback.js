function createSequencePlayback({previous,next,toggle,speed,position,render}){
 let steps=[],index=0,timer=null;
 const stepDuration=2200;
 function update(){
  previous.disabled=index===0;
  next.disabled=index>=steps.length-1;
  toggle.disabled=steps.length<2;
  toggle.textContent=timer!==null?'Pausar':index>0&&index===steps.length-1?'Repetir':'Reproducir';
  position.textContent=steps.length?(index+1)+' de '+steps.length:'';
 }
 function show(){
  if(steps.length)render(steps[index],index);
  update();
 }
 function stop(){
  if(timer!==null)clearTimeout(timer);
  timer=null;
  update();
 }
 function schedule(){
  timer=setTimeout(()=>{
   index++;
   if(index>=steps.length-1)timer=null;
   else schedule();
   show();
  },stepDuration/(Number(speed.value)||1));
 }
 function start(){
  if(steps.length<2)return;
  if(index===steps.length-1){index=0;show();}
  schedule();update();
 }
 function move(delta){
  stop();
  const target=index+delta;
  if(target>=0&&target<steps.length){index=target;show();}
 }
 toggle.onclick=()=>timer===null?start():stop();
 previous.onclick=()=>move(-1);
 next.onclick=()=>move(1);
 speed.onchange=()=>{if(timer!==null){clearTimeout(timer);schedule()}};
 return {
  load(items,autoplay=false){stop();steps=items;index=0;show();if(autoplay)start()},
  stop,
  move
 };
}
