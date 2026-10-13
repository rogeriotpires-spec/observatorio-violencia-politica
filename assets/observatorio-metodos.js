(() => {
  'use strict';
  const cards=Array.from(document.querySelectorAll('[data-method-block]'));
  if(!cards.length)return;
  const media=window.matchMedia('(max-width:760px)');
  let size=media.matches?2:4,page=0;
  const positions=new Map(cards.map((el,i)=>[el.id,i]));
  const statuses=document.querySelectorAll('[data-methods-status]');
  const controls=document.querySelectorAll('[data-methods-pagination]');
  const nav=document.getElementById('methods-index');
  function show(focus=false){
    const pages=Math.ceil(cards.length/size);page=Math.max(0,Math.min(pages-1,page));
    cards.forEach((el,i)=>el.hidden=i<page*size||i>=(page+1)*size);
    statuses.forEach(el=>el.textContent=`${cards.length} blocos temáticos · Exibindo ${page*size+1} a ${Math.min((page+1)*size,cards.length)}`);
    controls.forEach(el=>el.innerHTML=`<button type="button" data-method-page="${page-1}" ${page===0?'disabled':''} aria-label="Blocos anteriores">← Anteriores</button>${Array.from({length:pages},(_,i)=>`<button type="button" data-method-page="${i}" ${i===page?'aria-current="page"':''} aria-label="Página ${i+1} de ${pages}">${i+1}</button>`).join('')}<button type="button" data-method-page="${page+1}" ${page===pages-1?'disabled':''} aria-label="Próximos blocos">Próximos →</button>`);
    nav.querySelectorAll('a').forEach(a=>{if(a.hash===location.hash)a.setAttribute('aria-current','location');else a.removeAttribute('aria-current');});
    if(focus){document.getElementById('methods-results').scrollIntoView({block:'start'});document.getElementById('methods-status').focus({preventScroll:true});}
  }
  function readRoute(initial=false){
    const id=location.hash.slice(1);
    if(positions.has(id)){
      page=Math.floor(positions.get(id)/size);show();
      requestAnimationFrame(()=>{const target=document.getElementById(id);target.scrollIntoView({block:'start'});if(!initial)target.querySelector('h2').focus({preventScroll:true});});
    }else if(!location.hash||location.hash==='#metodos'||location.hash==='#conteudo'){
      page=0;show();
    }else if(location.hash.startsWith('#metodos?')){
      const id=new URLSearchParams(location.hash.slice(9)).get('inicio');
      if(positions.has('metodo-'+id)){page=Math.floor(positions.get('metodo-'+id)/size);show();}
    }
  }
  document.addEventListener('click',e=>{
    const button=e.target.closest('[data-method-page]');if(!button)return;
    page=Number(button.dataset.methodPage);
    const first=cards[page*size];if(!first)return;
    history.pushState(null,'','#metodos?inicio='+first.dataset.methodBlock);show(true);
  });
  for(const detail of document.querySelectorAll('[data-method-source-ids]'))detail.addEventListener('toggle',()=>{
    if(!detail.open||detail.dataset.sourcesReady)return;
    const ids=detail.dataset.methodSourceIds.split(',');
    const sources=ids.map(id=>window.Observatory.sources.find(s=>s.fonte_id===id)).filter(Boolean);
    detail.querySelector('.method-source-list').innerHTML=sources.map(s=>window.Observatory.sourceMarkup(s,true)).join('');
    detail.dataset.sourcesReady='true';
  });
  const resize=()=>{const first=page*size;size=media.matches?2:4;page=Math.floor(first/size);show();};
  if(media.addEventListener)media.addEventListener('change',resize);else media.addListener(resize);
  window.addEventListener('hashchange',()=>readRoute());window.addEventListener('popstate',()=>readRoute());
  show();readRoute(true);
})();
