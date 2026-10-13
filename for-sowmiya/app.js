'use strict';
const $=id=>document.getElementById(id);
const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)');
let revealObserver;
let unlocked=false,motionPaused=reducedMotion.matches,memoryList=[];
function applyMotion(){
  document.body.classList.toggle('motion-paused',motionPaused||reducedMotion.matches);
  syncVideos();
}
applyMotion();
reducedMotion.addEventListener('change',event=>{motionPaused=event.matches;applyMotion();});
function show(view){
  if(!unlocked&&view!=='welcome')return;
  pauseMemoryVideos();closeMemoryLightbox();
  for(const id of ['welcome','memories'])$(id).hidden=id!==view;
  document.body.dataset.scene=view;
  window.scrollTo({top:0,behavior:'instant'});
  $(view).setAttribute('tabindex','-1');$(view).focus({preventScroll:true});
  syncVideos();
}
function pauseMemoryVideos(root=document) {
  root.querySelectorAll('video').forEach(video=>video.pause());
}
function makeMemoryMedia(asset) {
  const node=document.createElement(asset.kind==='video'?'video':'img');
  node.src=asset.src;
  if(asset.kind==='video'){node.controls=true;node.preload='metadata';node.playsInline=true;node.muted=true;node.defaultMuted=true;node.loop=true;node.autoplay=!motionPaused&&!reducedMotion.matches;node.setAttribute('aria-label',asset.alt||'Our memory video');}
  else {node.alt=asset.alt||'Our memory photo';if(asset.width&&asset.height){node.width=asset.width;node.height=asset.height;}node.loading='lazy';node.decoding='async';}
  return node;
}
let lightboxItems=[],lightboxIndex=0,lightboxLabel='';
function paintLightbox(){
  pauseMemoryVideos($('memory-lightbox'));
  const asset=lightboxItems[lightboxIndex];
  if(!asset)return;
  $('lightbox-media').replaceChildren(makeMemoryMedia(asset));
  $('lightbox-count').textContent=lightboxLabel+' - '+(lightboxIndex+1)+' of '+lightboxItems.length;
  $('lightbox-prev').hidden=lightboxItems.length<2;$('lightbox-next').hidden=lightboxItems.length<2;
}
function openMemoryLightbox(items,index,label){
  pauseMemoryVideos();
  lightboxItems=items;lightboxIndex=index;lightboxLabel=label;
  paintLightbox();$('memory-lightbox').showModal();$('lightbox-close').focus();syncVideos();
}
function clearLightbox(){
  pauseMemoryVideos($('memory-lightbox'));$('lightbox-media').replaceChildren();
  lightboxItems=[];lightboxIndex=0;lightboxLabel='';syncVideos();
}
function closeMemoryLightbox(){
  if($('memory-lightbox').open)$('memory-lightbox').close();
  clearLightbox();
}

function syncVideos(){
  document.querySelectorAll('video').forEach(video=>{
    const visible=!document.hidden&&!motionPaused&&!reducedMotion.matches&&
      !video.closest('[hidden]')&&(!$('memory-lightbox').open||video.closest('dialog'));
    if(visible)video.play().catch(()=>{});
    else video.pause();
  });
}
document.addEventListener('visibilitychange',syncVideos);
function renderStory(story){
  memoryList=story.memories;
  $('timeline').replaceChildren();$('event-index').replaceChildren();
  let number=0;
  memoryList.forEach((memory,index)=>{
    const event=document.createElement('section');event.className='event-section';
    event.id='event-'+index;
    const heading=document.createElement('header');heading.className='event-heading';
    const label=document.createElement('span');label.className='small-label';label.textContent='CHAPTER '+String(index+1).padStart(2,'0');
    const title=document.createElement('h2');title.textContent=memory.title;
    heading.append(label);if(memory.title)heading.append(title);
    const grid=document.createElement('div');grid.className='floating-grid';
    memory.assets.forEach((asset,i)=>{
      number++;
      const card=document.createElement('article');card.className='floating-card';
      card.style.setProperty('--delay',-(number%7)+'s');
      const frame=document.createElement('div');frame.className='media-frame';
      const media=makeMemoryMedia(asset);frame.append(media);
      const copy=document.createElement('div');copy.className='card-copy';
      const tag=document.createElement('span');tag.className='card-number';
      tag.textContent='MOMENT '+String(number).padStart(2,'0')+' / '+(asset.kind==='video'?'IN MOTION':'A LITTLE STILL');
      const heading=document.createElement('h3');heading.textContent=asset.title||memory.caption;
      const message=document.createElement('p');message.textContent=asset.message??memory.text;message.hidden=!message.textContent;
      const expand=document.createElement('button');expand.className='secondary';expand.type='button';
      expand.textContent='Open full size \u2197';
      expand.setAttribute('aria-label','Open '+heading.textContent+' in full size');
      expand.addEventListener('click',()=>openMemoryLightbox([asset],0,heading.textContent));
      copy.append(tag,heading,message,expand);card.append(frame,copy);grid.append(card);
    });
    event.append(heading,grid);$('timeline').append(event);
    const tab=document.createElement('button');tab.type='button';tab.className='event-tab';
    tab.textContent=String(index+1).padStart(2,'0');
    tab.setAttribute('aria-label','Go to chapter '+(index+1)+(memory.title?': '+memory.title:''));
    tab.addEventListener('click',()=>{document.querySelector('.memory-index').open=false;event.scrollIntoView({behavior:motionPaused||reducedMotion.matches?'instant':'smooth',block:'start'});});
    $('event-index').append(tab);
  });
  $('letter-copy').replaceChildren(...story.letter.map(text=>{const p=document.createElement('p');p.textContent=text;return p;}));
  observePageMotion();
}
async function fetchStory(){
  const response=await fetch('/api/story',{cache:'no-store'});
  if(!response.ok)throw new Error('Please unlock the memories again.');
  renderStory(await response.json());unlocked=true;show('memories');activity.watch();startBackgroundMusic();
}
$('unlock-form').addEventListener('submit',async event=>{
  event.preventDefault();const button=event.currentTarget.querySelector('[type=submit]');
  button.disabled=true;$('gate-error').textContent='';
  try{
    const response=await fetch('/api/unlock',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(Object.fromEntries(new FormData($('unlock-form'))))});
    const result=await response.json();
    if(!response.ok)throw new Error(result.error||'The memories could not open. Please try again.');
    activity.report('security_passed');await fetchStory();$('unlock-form').reset();
  }catch(error){$('gate-error').textContent=error.message;}
  finally{button.disabled=false;}
});
let celebrationTimer;
function answer(yes){
  activity.report(yes?'answer_yes':'answer_need_time');
  const layer=$('confetti');
  clearTimeout(celebrationTimer);layer.replaceChildren();layer.classList.toggle('sad-response',!yes);
  if(motionPaused||reducedMotion.matches){
    const heart=document.createElement('span');heart.className='answer-still-heart';heart.textContent=yes?'\u2665':'\uD83D\uDE22';layer.append(heart);
    celebrationTimer=setTimeout(()=>layer.replaceChildren(),2500);return;
  }
  const glow=document.createElement('div');glow.className='answer-glow';layer.append(glow);
  const centre=document.createElement('span');centre.className='answer-big-heart';centre.textContent=yes?'\u2665':'\uD83D\uDE22';layer.append(centre);
  for(let wave=0;wave<4;wave++){
    const ring=document.createElement('span');ring.className='answer-ring';ring.style.animationDelay=(wave*.55)+'s';layer.append(ring);
    for(let i=0;i<30;i++){
      const particle=document.createElement('span');particle.className='answer-particle';
      particle.textContent=yes?(i%3===0?'\u2726':i%2?'\u2665':'\u2661'):(i%3===0?'\uD83D\uDE22':i%2?'\uD83D\uDCA7':'\uD83D\uDE41');
      const angle=Math.random()*Math.PI*2;const radius=25+Math.random()*55;
      particle.style.setProperty('--x',Math.cos(angle)*radius+'vmax');
      particle.style.setProperty('--y',Math.sin(angle)*radius+'vmax');
      particle.style.setProperty('--spin',(Math.random()*540-270)+'deg');
      particle.style.setProperty('--size',(12+Math.random()*26)+'px');
      particle.style.color=['#ec77a6','#b04482','#e5af59','#ca95df','#eea6ba'][i%5];
      particle.style.animationDelay=(wave*.65+Math.random()*.5)+'s';layer.append(particle);
    }
  }
  celebrationTimer=setTimeout(()=>layer.replaceChildren(),8000);
}
$('yes').addEventListener('click',()=>answer(true));$('no').addEventListener('click',()=>answer(false));

$('lightbox-close').addEventListener('click',closeMemoryLightbox);
$('memory-lightbox').addEventListener('close',clearLightbox);
$('lightbox-prev').addEventListener('click',()=>{lightboxIndex=(lightboxIndex-1+lightboxItems.length)%lightboxItems.length;paintLightbox();});
$('lightbox-next').addEventListener('click',()=>{lightboxIndex=(lightboxIndex+1)%lightboxItems.length;paintLightbox();});
$('memory-lightbox').addEventListener('click',event=>{if(event.target===$('memory-lightbox'))closeMemoryLightbox();});
$('memory-lightbox').addEventListener('keydown',event=>{
  if(event.target.tagName==='VIDEO')return;
  if(event.key==='ArrowLeft'){event.preventDefault();$('lightbox-prev').click();}
  if(event.key==='ArrowRight'){event.preventDefault();$('lightbox-next').click();}
});

async function init(){
  try{
    const response=await fetch('/api/config',{cache:'no-store'});
    if(!response.ok)throw new Error();
    if((await response.json()).authenticated)await fetchStory();
  }catch{$('gate-error').textContent='Start the local server to open these memories. See README.txt.';}
}
init();

// Gentle desktop depth; never applied to touch screens or reduced-motion mode.
const desktopPointer=matchMedia('(min-width: 721px) and (pointer: fine)');
let sceneFrame=0;
window.addEventListener('pointermove',event=>{
  if(!desktopPointer.matches||reducedMotion.matches||sceneFrame)return;
  const x=(event.clientX/innerWidth-.5)*12;
  const y=(event.clientY/innerHeight-.5)*8;
  sceneFrame=requestAnimationFrame(()=>{
    const scene=document.querySelector('.desktop-scene');
    scene.style.setProperty('--scene-x',x+'px');scene.style.setProperty('--scene-y',y+'px');sceneFrame=0;
  });
},{passive:true});

// Animate only when content enters view; content is never hidden while waiting.
function observePageMotion(){
  if(revealObserver)revealObserver.disconnect();
  if(reducedMotion.matches||!('IntersectionObserver' in window))return;
  revealObserver=new IntersectionObserver(entries=>{
    if(reducedMotion.matches)return;
    for(const entry of entries){
      if(!entry.isIntersecting)continue;
      const node=entry.target;
      node.classList.add('reveal-arrival');
      node.addEventListener('animationend',()=>node.classList.remove('reveal-arrival'),{once:true});
      revealObserver.unobserve(node);
    }
  },{threshold:.06,rootMargin:'0px 0px -20px 0px'});
  document.querySelectorAll('.gate-card,.memories-intro,.event-heading,.floating-card,.letter-dateline,.letter-paper h2,#letter-copy p,.signature,.question-card').forEach(node=>revealObserver.observe(node));
}
observePageMotion();
reducedMotion.addEventListener('change',()=>{
  document.querySelectorAll('.reveal-arrival').forEach(node=>node.classList.remove('reveal-arrival'));
  observePageMotion();
});
// A soft ripple follows button presses, including keyboard activation.
document.addEventListener('click',event=>{
  const button=event.target.closest('button,.message-link');
  if(!button||button.disabled||reducedMotion.matches)return;
  button.querySelector('.button-ripple')?.remove();
  const bounds=button.getBoundingClientRect();
  const ripple=document.createElement('span');ripple.className='button-ripple';ripple.setAttribute('aria-hidden','true');
  ripple.style.left=(event.detail?event.clientX-bounds.left:bounds.width/2)+'px';
  ripple.style.top=(event.detail?event.clientY-bounds.top:bounds.height/2)+'px';
  button.append(ripple);setTimeout(()=>ripple.remove(),750);
});

// Activity emails are enabled when configured, with a visible notice before entry.
const ACTIVITY_ENDPOINT = 'https://script.google.com/macros/s/AKfycbyG-GnwRGiStu8TE8UP41satw8TUaE5TjQ3Tlt3eteF_zg_MGsR4bwH671Q7QhrPdc-AA/exec';
const activity = (() => {
  const enabled = /^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(ACTIVITY_ENDPOINT);
  const sent = new Set(), timers = new Map(), visible = new Map();
  const visit = crypto.randomUUID();
  let observer;
  if (enabled) {
    const notice = document.createElement('p');
    notice.id = 'activity-notice';
    notice.style.cssText = 'font-size:13px;line-height:1.6;margin:20px 0';
    notice.textContent = 'Sakthi receives email notifications when you enter, view the photos or letter, and choose Yes or Need time.';
    $('unlock-form').insertBefore(notice, $('gate-error'));
  }
  function report(event) {
    if (!enabled || sent.has(event)) return;
    sent.add(event);
    // A no-CORS request cannot confirm delivery. Never interrupt the memories.
    fetch(ACTIVITY_ENDPOINT, {
      method: 'POST', mode: 'no-cors', credentials: 'omit', keepalive: true,
      headers: {'Content-Type': 'text/plain;charset=UTF-8'},
      // Legacy endpoint field: enables reporting; does not represent an opt-in.
      body: JSON.stringify({event, visit, consent: true})
    }).catch(() => {});
  }
  function schedule(node) {
    const event = node.dataset.activityEvent;
    if (!visible.get(node) || document.hidden || sent.has(event) || timers.has(node)) return;
    timers.set(node, setTimeout(() => {
      timers.delete(node);
      if (!document.hidden && visible.get(node)) report(event);
    }, 2000));
  }
  function watch() {
    if (!enabled || !('IntersectionObserver' in window)) return;
    observer?.disconnect();
    observer = new IntersectionObserver(entries => {
      for (const entry of entries) {
        const node = entry.target, inView = entry.isIntersecting && entry.intersectionRatio >= .25;
        visible.set(node, inView);
        if (inView) schedule(node);
        else { clearTimeout(timers.get(node)); timers.delete(node); }
      }
    }, {threshold: [0, .25]});
    document.querySelectorAll('.media-frame, .letter-paper h2').forEach(node => {
      node.dataset.activityEvent = node.matches('.media-frame') ? 'photos_viewed' : 'letter_viewed';
      observer.observe(node);
    });
  }
  document.addEventListener('visibilitychange', () => {
    for (const timer of timers.values()) clearTimeout(timer);
    timers.clear();
    if (!document.hidden) for (const node of visible.keys()) schedule(node);
  });
  return {report, watch};
})();

// Music starts only after the memories have successfully opened.
const backgroundMusic = new Audio();
backgroundMusic.loop = true;
backgroundMusic.preload = 'none';
backgroundMusic.volume = .4;
let musicOpened = false, musicStarting = false;
async function playBackgroundMusic() {
  if (!musicOpened || musicStarting || !backgroundMusic.paused) return;
  musicStarting = true;
  try { await backgroundMusic.play(); }
  catch { /* Retry on the next user interaction if autoplay is blocked. */ }
  finally { musicStarting = false; }
}
function startBackgroundMusic() {
  if (musicOpened) return;
  musicOpened = true;
  backgroundMusic.src = './media/kaathalae-kaathalae.mp3';
  playBackgroundMusic();
}
document.addEventListener('click', playBackgroundMusic);
document.addEventListener('keydown', playBackgroundMusic);
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) playBackgroundMusic();
});
