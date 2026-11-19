async function playbackVideoImage(svg,w,h,viewBox='0 0 '+w+' '+h){
 const blob=new Blob(['<svg xmlns="http://www.w3.org/2000/svg" width="'+w+'" height="'+h+'" viewBox="'+viewBox+'">'+svg+'</svg>'],{type:'image/svg+xml'});
 const url=URL.createObjectURL(blob),image=new Image();
 try{image.src=url;await image.decode();return image;}
 finally{URL.revokeObjectURL(url);}
}
async function preparePlaybackVideoFrame(frame){
 const {elements,full,motion}=frame;
 const height=full?1060:600;
 const moving=elements.filter(element=>motion.initial.has(element.id)||element.id===motion.ball?.id);
 if(motion.syntheticBall)moving.push(motion.ball);
 const still=elements.filter(element=>!isCourtAction(element)&&!motion.initial.has(element.id)&&element.id!==motion.ball?.id);
 const background=playbackVideoImage((full?courtBase(true):referenceCourt())+still.map(elementSVG).join(''),600,height);
 const sprites=Promise.all(moving.map(async element=>{
  const radius=Math.max(48,Math.ceil((element.size||20)*2));
  const image=await playbackVideoImage(elementSVG({...element,x:0,y:0}),radius*2,radius*2,[-radius,-radius,radius*2,radius*2].join(' '));
  return {id:element.id,image,radius};
 }));
 const [court,actors]=await Promise.all([background,sprites]);
 return {height,background:court,sprites:actors};
}
function drawPlaybackVideoFrame(ctx,frame,art,time){
 const {width,height}=ctx.canvas;
 ctx.fillStyle='#f4f7fa';ctx.fillRect(0,0,width,height);
 ctx.fillStyle='#0c1d32';ctx.font='700 28px Arial';ctx.fillText(frame.title,26,42,width-52);
 ctx.font='18px Arial';ctx.fillText(frame.name,26,70,width-52);
 const scale=Math.min((width-44)/600,(height-185)/art.height);
 const left=(width-600*scale)/2,top=82+(height-185-art.height*scale)/2;
 ctx.drawImage(art.background,left,top,600*scale,art.height*scale);
 const pose=sampleCourtMotion(frame.motion,time);
 for(const {id,image,radius} of art.sprites){
  const point=id===frame.motion.ball?.id?pose.ball:pose.positions.get(id);
  if(point)ctx.drawImage(image,left+(point.x-radius)*scale,top+(point.y-radius)*scale,radius*2*scale,radius*2*scale);
 }
 ctx.font='17px Arial';
 const text=(frame.notes||'').trim().split(/\s+/);
 let row='',line=0;
 for(const word of text){
  const candidate=row?row+' '+word:word;
  if(row&&ctx.measureText(candidate).width>width-52){
   ctx.fillText(row,26,height-78+line*22,width-52);
   if(++line===3)return;
   row=word;
  }else row=candidate;
 }
 if(row)ctx.fillText(row,26,height-78+line*22,width-52);
}
async function makePlaybackVideo(frames,signal,onProgress){
 if(typeof MediaRecorder!=='function'||typeof HTMLCanvasElement.prototype.captureStream!=='function'){
  throw Error('Este navegador no permite generar el archivo de video. Puedes usar Copiar enlace.');
 }
 const mime=['video/mp4;codecs=avc1.42001f','video/mp4','video/webm;codecs=vp8','video/webm'].find(type=>MediaRecorder.isTypeSupported(type));
 if(!mime)throw Error('Este navegador no tiene un formato de grabación disponible.');
 const canvas=document.createElement('canvas');
 canvas.width=720;canvas.height=900;
 const ctx=canvas.getContext('2d',{alpha:false});
 let prepared=await preparePlaybackVideoFrame(frames[0]);
 signal.throwIfAborted();
 drawPlaybackVideoFrame(ctx,frames[0],prepared,0);
 const stream=canvas.captureStream(30);
 let recorder;
 try{
  recorder=new MediaRecorder(stream,{mimeType:mime,videoBitsPerSecond:2400000});
  const chunks=[];
  recorder.ondataavailable=event=>{if(event.data.size)chunks.push(event.data);};
  const ended=new Promise(resolve=>{
   recorder.onstop=()=>resolve(null);
   recorder.onerror=event=>resolve(event.error||Error('No se pudo grabar la animación.'));
  });
  recorder.start(1000);
  const total=frames.reduce((sum,frame)=>sum+frame.motion.duration,0);
  let spent=0;
  for(let i=0;i<frames.length;i++){
   signal.throwIfAborted();
   const frame=frames[i];
   if(i>0)prepared=await preparePlaybackVideoFrame(frame);
   const start=performance.now();
   let time=0;
   while(true){
    signal.throwIfAborted();
    if(recorder.state==='inactive')throw Error('Se interrumpió la grabación.');
    drawPlaybackVideoFrame(ctx,frame,prepared,time);
    onProgress(Math.min(99,Math.floor((spent+time)*100/total)));
    if(time===frame.motion.duration)break;
    await new Promise(resolve=>setTimeout(resolve,1000/30));
    time=Math.min(frame.motion.duration,performance.now()-start);
   }
   spent+=frame.motion.duration;
  }
  await new Promise(resolve=>setTimeout(resolve,80));
  recorder.stop();
  const error=await ended;
  if(error)throw error;
  const type=recorder.mimeType||mime,blob=new Blob(chunks,{type:type.split(';')[0]});
  if(!blob.size)throw Error('No se pudo generar el archivo.');
  return blob;
 }finally{
  if(recorder&&recorder.state!=='inactive')recorder.stop();
  for(const track of stream.getTracks())track.stop();
 }
}
