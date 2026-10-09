import './style.css';
import { CameraPipeline } from './camera';
import { ImpactRenderer } from './renderer';
import { ImpactAudio } from './audio';
import { loadFixture } from './fixture';
import { faceShape, Round, type FaceShape, type Outcome } from './simulation';

document.querySelector('#app')!.innerHTML=`
<header><a class="logo" href="/">SPLAT<span>ME!</span><sup>® LAB</sup></a><nav><a href="/">Kamera laboratuvarı ↗</a><span class="edition">EXPERIMENT 002</span></nav></header>
<main><div class="headline"><div><p class="eyebrow"><i></i> CINEMATIC IMPACT PROTOTYPE</p><h1>DON’T.<br><span>GET. SPLAT.</span></h1></div><p class="lede">Bir saniye. Bir refleks.<br>Sonrası biraz <em>dağınık.</em></p></div>
<section class="lab"><div class="viewport-wrap"><div class="viewport" id="viewport"><canvas id="scene" aria-label="Canlı kamera ve üç boyutlu çarpışma sahnesi"></canvas><div class="topline"><span id="mode" class="chip">3D ÖNİZLEME</span><span class="chip" id="face-state">KAMERA KAPALI</span></div><div class="reticle" id="reticle" hidden><i></i><span>HEDEF KİLİTLENDİ</span></div><div class="impact-title" id="impact-title" aria-live="polite"></div><div class="replay-label" id="replay-label" hidden><span>↶ INSTANT REPLAY</span><b>0.35×</b><small>Kamera kaydı + yeniden çizilen efektler · canlı takip sürüyor</small></div><div class="bottomline"><span id="cue">Kamera aç. Yüzünü kadraja al. Kaç.</span><span id="round-count">TAKE 001</span></div><div class="letterbox top"></div><div class="letterbox bottom"></div></div><div class="stage-caption"><span><i></i> GÖRÜNTÜ CİHAZINDA KALIR</span><button id="fullscreen" class="text-button">Tam ekran ⛶</button></div></div>
<aside class="director"><span class="eyebrow">THE CONTROL ROOM</span><h2>Başını kurtar.</h2><p>Hedef fırlatıldığı anda sabitlenir. İsabetten önce başını çek. Kıl payı kaçışın da bir ödülü var.</p><button id="start" class="primary">Kamerayı aç <span>↗</span></button><button id="throw" class="fire" disabled>FIRLAT <kbd>SPACE</kbd></button><div class="duo"><button id="stop" disabled>Durdur</button><button id="clean">Yüzü temizle</button></div><div class="toggles"><label><input id="sound" type="checkbox" checked> Katmanlı ses</label><label><input id="auto-replay" type="checkbox" checked> Otomatik ağır çekim</label><label><input id="tracking-enabled" type="checkbox" checked> Kafa takibi <small>A/B ölçümü</small></label></div><label class="select-label">KAMERA PROFİLİ<select id="profile"><option value="quality">Kalite · 1080p / 60 talebi</option><option value="speed">Hız · 720p / 60 talebi</option></select></label><label class="select-label">KAMERA<select id="device"><option value="">Varsayılan ön kamera</option></select></label><p class="status" id="status" role="status">Kamera ve ses yalnızca başlattığında etkinleşir. Mikrofon kullanılmaz.</p><details class="preview-controls"><summary>Kamerasız efekt önizlemesi</summary><p>Yapay test portresi. Gerçek kamera performansı ölçümü değildir; aynı yüz geometrisinde efektleri gösterir.</p><div class="duo"><button id="demo-hit">İsabet</button><button id="demo-near">Yakın kaçış</button></div></details></aside></section>
<section class="telemetry"><div class="metrics"><div><span>RENDER</span><b id="fps">—</b><small>FPS</small></div><div><span>KAYNAK / SUNULAN</span><b id="capture">—</b><small>FPS</small></div><div><span>ALGILAMA</span><b id="detect">—</b><small>FPS</small></div><div><span>MODEL / AKTARIM</span><b id="model">—</b><small>ms</small></div><div><span>CPU / GPU ÇİZİM</span><b id="draw">—</b><small>ms</small></div></div><details id="diagnostics"><summary>Performans teşhisi ve ölçüm raporu <span>+</span></summary><div class="diagnostic-body"><p>Kaynak FPS, tarayıcı track istatistiği varsa gösterilir; donanım sensörünün doğrudan ölçümü değildir. “—” desteklenmediğini belirtir. Sunulan kareler ile callback sayısı ve worker’a gönderilen kareler ayrı hesaplanır. 60 FPS, garanti değil hedeftir.</p><pre id="diagnostic-text">Kamerayı başlattığında ölçümler burada görünecek.</pre><div class="duo"><button id="export">Raporu indir</button><button id="replay" disabled>Son olayı tekrar oynat ↶</button></div><p>16 FPS nedenini ayırmak için aynı sahnede “Kafa takibi”ni kapat/aç ve 720p profilini dene. Kaynak sabit kalıp worker gönderimi değişiyorsa yakalama ile algılama farklı sınırlardadır. Fiziksel hareket→ekran gecikmesi bu panelden ölçülemez.</p></div></details></section><footer><span>VOLUME. VELOCITY. VERY BAD LUCK.</span><span>WebGL · local vision · original procedural audio</span></footer></main>`;
const $=(id:string)=>document.getElementById(id)!;
const button=(id:string)=>$(id) as HTMLButtonElement;
const checked=(id:string)=>($(id) as HTMLInputElement).checked;
const camera=new CameraPipeline(),audio=new ImpactAudio(),round=new Round();
let graphics:ImpactRenderer;
try{graphics=new ImpactRenderer($('scene') as HTMLCanvasElement,camera.video);}catch(e){$('status').textContent=`WebGL başlatılamadı: ${String(e)}. Güncel ve donanım hızlandırması açık bir tarayıcı kullan.`;button('start').disabled=true;throw e;}
let running=false,demo:Outcome|null=null,stain=false,take=0,raf=0,last=performance.now(),frames=0,sampleAt=last;
let replayStarted=false,replaySound=false,lastReplay=false,renderFps=0,renderP95=0,impactPan=0;
let frameTimes:number[]=[],reports:unknown[]=[],lastMetrics:unknown=null;
let demoFace:FaceShape={x:.5,y:.47,rx:.12,ry:.25,roll:0};
let fixture:Awaited<ReturnType<typeof loadFixture>>|null=null,fixturePromise:ReturnType<typeof loadFixture>|null=null;
let qaTime:number|null=null;
async function ensureFixture(){if(!fixture){status('Yapay test portresi hazırlanıyor…');fixture=await (fixturePromise??=loadFixture());demoFace=fixture.face;graphics.setFixture(fixture.image);}return fixture;}
const status=(text:string)=>{$('status').textContent=text;};
camera.onState=status;
camera.onError=text=>{running=false;button('start').disabled=false;button('stop').disabled=true;status(text);round.reset();audio.stop();graphics.clearReplay();};
async function start(){
  audio.stop();round.reset();stain=false;demo=null;graphics.useFixture=false;graphics.clearDeposits();graphics.clearReplay();
  button('start').disabled=true;button('stop').disabled=false;running=true;
  try{await audio.unlock();}catch{status('Ses açılamadı; sessiz devam ediliyor.');}
  await camera.start(($( 'profile') as HTMLSelectElement).value,($( 'device') as HTMLSelectElement).value);
  if(camera.stream){
    const devices=await navigator.mediaDevices.enumerateDevices(),select=$('device') as HTMLSelectElement,current=camera.stream.getVideoTracks()[0].getSettings().deviceId;
    select.replaceChildren(...devices.filter(d=>d.kind==='videoinput').map((d,i)=>{const option=document.createElement('option');option.value=d.deviceId;option.textContent=d.label||`Kamera ${i+1}`;option.selected=d.deviceId===current;return option;}));
  }
}
function stop(){camera.stop();audio.stop();round.reset();stain=false;demo=null;running=false;graphics.useFixture=false;graphics.clearDeposits();graphics.clearReplay();button('start').disabled=false;button('stop').disabled=true;status('Kamera kapalı. Görüntü ve tekrar belleği temizlendi.');}
function currentShape(){const face=camera.freshFace;return face?faceShape(face.points):null;}
async function launch(preview:Outcome|null=null){
  if(preview){try{await ensureFixture();}catch(e){fixturePromise=null;status(String(e));return;}}
  const face=preview?demoFace:currentShape();
  if(!face||(!preview&&!camera.tracking))return;
  if(round.start!==-Infinity&&!round.outcome)return;
  await audio.unlock().catch(()=>{});audio.stop();graphics.endReplay();
  demo=preview;graphics.useFixture=!!preview;replayStarted=false;replaySound=false;take++;graphics.clearReplay();qaTime=null;
  if(innerWidth<760)$('viewport').scrollIntoView({behavior:'smooth',block:'center'});
  round.launch(performance.now()/1000,face,take*7919);
  if(preview==='near')round.target.x=face.x-(face.rx+.035)*1.32;
  audio.whoosh(round.duration,round.target.x*2-1);$('round-count').textContent=`TAKE ${String(take).padStart(3,'0')}`;
  status(preview?'Yapay test portresi · kamera performansı ölçümü değildir.':'Hedef kilitlendi. Şimdi başını çek!');
}
function replay(){if(graphics.beginReplay(performance.now()/1000)){replayStarted=true;replaySound=false;audio.stop();}}
button('start').onclick=()=>void start();button('stop').onclick=stop;button('throw').onclick=()=>void launch();
button('clean').onclick=()=>{stain=false;graphics.clearDeposits();};button('demo-hit').onclick=()=>void launch('hit');button('demo-near').onclick=()=>void launch('near');button('replay').onclick=replay;
$('sound').onchange=()=>audio.setMuted(!checked('sound'));
$('tracking-enabled').onchange=()=>{camera.tracking=checked('tracking-enabled');camera.face=null;};
$('profile').onchange=()=>{if(running)void start();};$('device').onchange=()=>{if(running)void start();};
button('fullscreen').onclick=()=>{if(document.fullscreenElement)void document.exitFullscreen();else void $('viewport').requestFullscreen().catch(()=>status('Tam ekran bu tarayıcıda kullanılamıyor.'));};
window.addEventListener('keydown',e=>{if(e.code==='Space'&&!/INPUT|SELECT|BUTTON|TEXTAREA/.test((e.target as HTMLElement).tagName)){e.preventDefault();if(!button('throw').disabled)void launch();}});
button('export').onclick=()=>{
  const data={version:1,at:new Date().toISOString(),userAgent:navigator.userAgent,notes:'Browser source counters are not direct sensor measurements. No physical motion-to-photon measurement.',samples:reports};
  const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download='splat-impact-measurements.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
};
function render(now:number){
  const t=qaTime??now/1000,delta=now-last;last=now;frames++;frameTimes.push(delta);if(frameTimes.length>120)frameTimes.shift();
  let face=demo?{...demoFace}:currentShape();

  const aspect=camera.video.videoWidth&&running?camera.video.videoWidth/camera.video.videoHeight:16/9;
  $('viewport').style.aspectRatio=String(aspect);graphics.resize(aspect);
  const outcome=round.advance(t,face,aspect);
  if(outcome){stain=stain||outcome==='hit';impactPan=face?Math.max(-1,Math.min(1,(round.target.x-face.x)/face.rx)):0;audio.impact(outcome,impactPan);button('replay').disabled=false;status(outcome==='hit'?'SPLAT. Yüzü temizleyebilir veya yeniden deneyebilirsin.':outcome==='near'?'Kıl payı! Hedefin yanından geçtin.':outcome==='untracked'?'Çarpışma anında yüz takibi yoktu; sonuç sayılmadı.':'Temiz kaçış. Bir tur daha?');}
  if(round.outcome&&t-round.impact>.84&&!replayStarted&&checked('auto-replay'))replay();
  const elapsed=t-round.impact;
  graphics.draw(t,round,face,demo?fixture?.points??null:camera.freshFace?.points??null,running&&camera.video.readyState>=2,stain,round.start!==-Infinity&&!replayStarted&&(!round.outcome||elapsed<=.86));
  if(graphics.replay&&graphics.replayTime>=round.impact&&!replaySound){audio.impact(round.outcome??'miss',impactPan,.55);replaySound=true;}
  if(lastReplay&&!graphics.replay)status('Tekrar tamamlandı. Yeni bir tur için hazır.');lastReplay=graphics.replay;
  $('viewport').classList.toggle('cinematic',graphics.replay||round.outcome==='near'&&elapsed<.8);
  $('replay-label').hidden=!graphics.replay;
  $('mode').textContent=graphics.replay?'KAYIT TEKRARI':demo?'KAMERASIZ EFEKT ÖNİZLEMESİ':running?'CANLI · AYNA GÖRÜNTÜSÜ':'3D ÖNİZLEME';
  $('face-state').textContent=demo?'SİMÜLE HEDEF':camera.freshFace?'YÜZ TAKİBİ AKTİF':running?'YÜZ ARANIYOR':'KAMERA KAPALI';
  const inFlight=round.start!==-Infinity&&!round.outcome;
  button('throw').disabled=!camera.freshFace||!camera.tracking||inFlight||graphics.replay;
  $('reticle').hidden=!inFlight||graphics.replay;
  $('reticle').style.left=`${round.target.x*100}%`;$('reticle').style.top=`${round.target.y*100}%`;
  $('cue').textContent=graphics.replay?'Anı tekrar yaşa.':inFlight?'KAÇ! HEDEF ARTIK SABİT.':camera.freshFace?'Hazırsın. SPACE veya FIRLAT.':'Kamera aç. Yüzünü kadraja al. Kaç.';
  const title=$('impact-title');title.textContent=!graphics.replay&&elapsed>=0&&elapsed<.62?(round.outcome==='hit'?'':round.outcome==='near'?'KIL PAYI.':round.outcome==='miss'?'TEMİZ.':''):'';
  title.style.transform=`translate(-50%,-50%) rotate(-8deg) scale(${1+Math.max(0,.15-elapsed)*2})`;
  if(now-sampleAt>1000){
    renderFps=frames*1000/(now-sampleAt);frames=0;sampleAt=now;
    const sorted=[...frameTimes].sort((a,b)=>a-b);renderP95=sorted[Math.floor(sorted.length*.95)]??0;
    const m=camera.metrics.sample(camera.video,camera.stream?.getVideoTracks()[0]);lastMetrics=m;
    const n=(v:number|null)=>v===null?'—':v.toFixed(1);
    $('fps').textContent=n(renderFps);$('capture').textContent=`${n(m.sourceFps)} / ${n(m.presentedFps)}`;
    $('detect').textContent=n(m.detectionFps);$('model').textContent=`${n(m.inferenceMs)} / ${n(m.bitmapMs)}`;
    $('draw').textContent=`${n(graphics.renderMs)} / ${n(graphics.gpuMs)}`;
    const report={time:new Date().toISOString(),mode:demo?'preview':graphics.replay?'replay':'live',tracking:camera.tracking,profile:($('profile') as HTMLSelectElement).value,
      renderFps,frameP95Ms:renderP95,drawCpuMs:graphics.renderMs,drawGpuMs:graphics.gpuMs,replayCopyCpuMs:graphics.recordMs,replayMemoryMiB:graphics.replayMemoryMB,replayCameraFps:graphics.replayCaptureFps,replayEffectsRate:graphics.replayRate,
      quality:graphics.quality,renderResolution:`${graphics.width}×${graphics.height}`,audioBaseLatencyMs:audio.context?audio.context.baseLatency*1000:null,...m};
    reports.push(report);if(reports.length>180)reports.shift();
    $('diagnostic-text').textContent=JSON.stringify(report,null,2);
  }
  // Read-only diagnostics for automated browser checks; no fake tracking in production.
  (window as any).__impactDiagnostics={outcome:round.outcome,replay:graphics.replay,replayTime:graphics.replayTime,impactTime:round.impact,stain,effects:graphics.effectState,audioScheduledAt:audio.lastScheduledAt,renderFps,renderP95,metrics:lastMetrics,quality:graphics.quality,replayCameraFps:graphics.replayCaptureFps,drawCalls:graphics.renderer.info.render.calls,replayMemoryMB:graphics.replayMemoryMB};
  raf=requestAnimationFrame(render);
}
document.addEventListener('visibilitychange',()=>{if(document.hidden){audio.stop();round.reset();graphics.clearReplay();stain=false;graphics.clearDeposits();camera.face=null;}});
window.addEventListener('pagehide',()=>{cancelAnimationFrame(raf);camera.stop();audio.dispose();graphics.dispose();});
raf=requestAnimationFrame(render);

// Explicit visual QA endpoint: static fictional portrait, never live-camera evidence.
if(new URLSearchParams(location.search).has('qa'))(window as any).__impactQA={
 async frame(age:number,seed=7919){
  const f=await ensureFixture();demo='hit';graphics.useFixture=true;graphics.endReplay();graphics.clearDeposits();graphics.clearReplay();
  round.launch(10,f.face,seed);round.impact=10+round.duration;round.outcome=age>=0?'hit':null;
  qaTime=round.impact+age;stain=age>=0;replayStarted=true;
  graphics.draw(qaTime,round,f.face,f.points,false,stain,false);
  return {face:f.face,points:Array.from(f.points),effects:graphics.effectState};
 },
 async reset(){await ensureFixture();qaTime=null;graphics.clearDeposits();stain=false;round.reset();demo='hit';graphics.useFixture=true;}
};
