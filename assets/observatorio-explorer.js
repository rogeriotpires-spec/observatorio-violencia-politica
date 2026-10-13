(() => {
  'use strict';
  const $=id=>document.getElementById(id);
  const DATA=window.ObservatoryData,MAP=window.ObservatoryMap||window.ObservatoryCountries;
  const hasMap=!!$('world-map'),hasHistory=!!$('history-grid'),pageHash='#'+document.body.dataset.section;
  const api=window.Observatory,R=DATA.records,H=DATA.historicalChapters||[];
  const locations=DATA.mapLocations?.groups||[],byId=new Map(R.map(r=>[r.id,r]));
  const byLocation=new Map(locations.map(g=>[g.id,g])),byChapter=new Map(H.map(c=>[c.id,c]));
  const byISO=new Map(MAP.map(c=>[c.iso,c]));
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const norm=v=>String(v??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  const countriesOf=c=>c.countries_iso3||c['países_iso3']||[];
  const paragraphsOf=c=>Array.isArray(c.paragraphs)?c.paragraphs:[c.context,c.consequences].filter(Boolean);
  const date=v=>/^\d{4}-\d{2}-\d{2}$/.test(v)?v.split('-').reverse().join('/'):v;
  const project=([lon,lat])=>[(lon+180)*1000/360,(85-lat)*480/145];
  const ms={layer:'cases',q:'',country:'',method:'',group:'',from:1900,to:2026,undated:true,selection:null};
  const view={x:0,y:0,w:1000,h:480};
  let currentClusters=[],historyLimit=6,activeChapter=null,chapterReturn=pageHash,chapterFocus=null,chapterScroll=0,drag=null,pinch=null,suppressClickUntil=0;
  const pointers=new Map();
  const palette={'Tentativa de assassinato':'#f9a14b','Assassinato ou morte investigada':'#fb7676','Sequestro ou desaparecimento':'#e3cc77','Prisão, deportação ou repressão':'#77b9dc','Ameaças':'#bf9fdf','Danos à propriedade':'#aebbc7','Outras formas de violência':'#aebbc7'};
  const shortMethod={'Tentativa de assassinato':'Tentativa','Assassinato ou morte investigada':'Assassinato / morte investigada','Sequestro ou desaparecimento':'Sequestro / desaparecimento','Prisão, deportação ou repressão':'Prisão / repressão','Ameaças':'Ameaça','Danos à propriedade':'Dano à propriedade','Outras formas de violência':'Outras formas'};
  const recordText=r=>[r.name,r.country,r.location,r.type,r.authorLead,r.summary,r.role,r.id].join(' ');
  const sourceIdsOf=g=>g.sourceIds||[];
  const recordsOf=g=>g.recordIds.map(id=>byId.get(id)).filter(Boolean);
  const titleOf=g=>{const rr=recordsOf(g);return rr.length===1?rr[0].name:`${rr[0]?.name||g.place} e mais ${rr.length-1} pessoa${rr.length===2?'':'s'}`;};
  const precisionOf=g=>g.precision==='city'?'Referência da cidade / localidade':g.precision==='region'?'Região conhecida; sem ponto exato':'Somente país ou contexto conhecido';
  function inYear(r){return r.year==null?ms.undated:r.year>=ms.from&&r.year<=ms.to;}
  function filteredLocations(){
    const terms=norm(ms.q).trim().split(/\s+/).filter(Boolean);
    return locations.map(g=>({...g,recordIds:g.recordIds.filter(id=>{const r=byId.get(id);return r&&r.collection==='documental'&&(!ms.country||r.country===ms.country||g.country===ms.country)&&(!ms.method||r.method===ms.method)&&(!ms.group||r.group===ms.group)&&inYear(r)&&terms.every(t=>norm(recordText(r)+' '+g.place).includes(t));})})).filter(g=>g.recordIds.length);
  }
  function filteredChapters(forGrid=false){
    const q=norm(forGrid?$('history-q').value:ms.q).trim(),terms=q.split(/\s+/).filter(Boolean);
    const region=forGrid?$('history-region').value:'';
    const order=['HIST-013','HIST-014','HIST-002','HIST-005','HIST-007','HIST-001'];
    const source=forGrid?[...H].sort((a,b)=>{const rank=c=>order.includes(c.id)?order.indexOf(c.id):order.length+H.indexOf(c);return rank(a)-rank(b);}):H;
    return source.filter(c=>(!region||c.region===region)&&(forGrid||(!ms.country||c.countryLabel===ms.country||countriesOf(c).some(i=>byISO.get(i)?.country===ms.country)))&&(forGrid||(c.endYear>=ms.from&&c.startYear<=ms.to))&&terms.every(t=>norm([c.title,c.subtitle,c.countryLabel,c.regime,c.leader,c.classification,paragraphsOf(c).join(' ')].join(' ')).includes(t)));
  }
  function setSelect(el,values,label=x=>x){const keep=el.value;el.innerHTML='<option value="">Todos</option>'+values.map(v=>`<option value="${esc(v)}">${esc(label(v))}</option>`).join('');if(values.includes(keep))el.value=keep;}
  function setCountryOptions(){const values=ms.layer==='cases'?[...new Set(locations.flatMap(g=>[g.country,...recordsOf(g).map(r=>r.country)]).filter(Boolean))]:[...new Set(H.flatMap(c=>countriesOf(c).map(i=>byISO.get(i)?.country)).filter(Boolean))];setSelect($('map-country'),values.sort((a,b)=>a.localeCompare(b,'pt')));if(values.includes(ms.country))$('map-country').value=ms.country;else ms.country='';}
  function mapHash(){const p=new URLSearchParams();p.set('camada',ms.layer==='cases'?'casos':'regimes');if(ms.q)p.set('q',ms.q);if(ms.country)p.set('pais',ms.country);if(ms.method)p.set('tipo',ms.method);if(ms.group)p.set('perfil',ms.group);if(ms.from!==1900)p.set('de',ms.from);if(ms.to!==2026)p.set('ate',ms.to);if(!ms.undated)p.set('semdata','0');if(ms.selection)p.set('selecionado',ms.selection);return '#mapa?'+p.toString();}
  function persistMap(){history.replaceState(null,'',mapHash());}
  function syncControls(){
    document.querySelectorAll('[data-map-layer]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.mapLayer===ms.layer)));
    $('map-filters').classList.toggle('history-layer',ms.layer==='history');
    $('map-undated').closest('label').hidden=ms.layer==='history';
    $('map-q').value=ms.q;$('map-country').value=ms.country;$('map-method').value=ms.method;$('map-group').value=ms.group;
    $('map-from').value=ms.from;$('map-to').value=ms.to;$('map-undated').checked=ms.undated;
    $('map-from-output').textContent=ms.from;$('map-to-output').textContent=ms.to;$('map-period-label').textContent=`${ms.from} a ${ms.to}`;
    document.querySelectorAll('[data-map-period]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.mapPeriod===`${ms.from},${ms.to}`)));
  }
  function constrain(){view.w=Math.max(40,Math.min(1000,view.w));view.h=view.w*.48;view.x=Math.max(0,Math.min(1000-view.w,view.x));view.y=Math.max(0,Math.min(480-view.h,view.y));}
  function updateView(){constrain();$('world-map').setAttribute('viewBox',`${view.x} ${view.y} ${view.w} ${view.h}`);$('map-zoom-label').textContent=`${(1000/view.w).toFixed(view.w>500?1:0).replace('.0','')}×`;$('map-zoom-in').disabled=view.w<=40;$('map-zoom-out').disabled=view.w>=1000;renderMarkers();}
  function zoom(factor,center=[view.x+view.w/2,view.y+view.h/2]){const old=view.w,newW=Math.max(40,Math.min(1000,old*factor)),ratio=newW/old;view.x=center[0]-(center[0]-view.x)*ratio;view.y=center[1]-(center[1]-view.y)*ratio;view.w=newW;updateView();}
  function home(){Object.assign(view,{x:0,y:0,w:1000,h:480});updateView();}
  function focusPoint(point,width){view.w=width;view.x=point[0]-width/2;view.y=point[1]-width*.24;updateView();}
  function focusCountry(iso){const c=byISO.get(iso);if(!c)return;const bbox=c.bbox||[0,0,1000,480],w=Math.min(420,Math.max(85,(bbox[2]-bbox[0])*1.35,(bbox[3]-bbox[1])*2.8));const center=c.center||[(bbox[0]+bbox[2])/2,(bbox[1]+bbox[3])/2];focusPoint(center,w);}
  function clusterGroups(groups){
    const width=$('world-map').getBoundingClientRect().width||800,threshold=38*view.w/width;
    const output=[];
    for(const g of groups.filter(g=>g.precision==='city'&&Array.isArray(g.coordinates))){
      const [x,y]=project(g.coordinates);if(x<view.x-10||x>view.x+view.w+10||y<view.y-10||y>view.y+view.h+10)continue;
      const hit=output.find(c=>Math.hypot(c.x-x,c.y-y)<threshold);
      if(hit){const n=hit.groups.length;hit.x=(hit.x*n+x)/(n+1);hit.y=(hit.y*n+y)/(n+1);hit.groups.push(g);}else output.push({x,y,groups:[g]});
    }
    return output;
  }
  function renderMarkers(){
    if(ms.layer!=='cases'){$('map-markers').innerHTML='';currentClusters=[];return;}
    currentClusters=clusterGroups(filteredLocations());
    const unit=view.w/($('world-map').getBoundingClientRect().width||800);
    $('map-markers').innerHTML=currentClusters.map((c,index)=>{const n=c.groups.length,r=recordsOf(c.groups[0])[0],color=palette[r?.method]||'#aebbc7',label=n>1?`${n} episódios próximos. Clique para aproximar.`:`${titleOf(c.groups[0])}. ${c.groups[0].place}. ${date(r?.date||'')}. Abrir dados.`;return `<g class="map-marker${n>1?' cluster':''}" style="--point-color:${color}" transform="translate(${c.x.toFixed(4)} ${c.y.toFixed(4)})" tabindex="0" role="button" data-map-cluster="${index}" aria-label="${esc(label)}"><title>${esc(label)}</title><circle class="marker-hit" r="${22*unit}"></circle><circle class="marker-halo" r="${(n>1?17:12)*unit}"></circle><circle class="marker-core" r="${(n>1?12:5.8)*unit}"></circle>${n>1?`<text font-size="${10.7*unit}">${n}</text>`:''}</g>`;}).join('');
  }
  function renderCountries(){
    const groups=filteredLocations(),chapters=filteredChapters(),covered=new Set(ms.layer==='cases'?groups.map(g=>g.iso3):chapters.flatMap(c=>countriesOf(c)));
    $('map-countries').innerHTML=MAP.map(p=>{const active=covered.has(p.iso),selected=ms.selection===`country:${p.iso}`,label=`${p.country}${active?', abrir registros':''}`;return `<path d="${esc(p.d)}" class="country-shape${active?ms.layer==='history'?' history-area':' has-records':''}${selected?' active-country':''}" ${active?`data-map-country="${esc(p.iso)}" tabindex="0" role="button" aria-label="${esc(label)}"`:''}><title>${esc(p.country)}</title></path>`;}).join('');
  }
  function legend(){
    if(ms.layer==='history'){$('map-legend').innerHTML='<span><i style="--legend-color:#a56939"></i>País relacionado a um capítulo histórico</span><span>Áreas indicativas em fronteiras atuais</span>';return;}
    const kinds=[...new Set(filteredLocations().flatMap(g=>recordsOf(g).map(r=>r.method)))];
    $('map-legend').innerHTML=kinds.map(m=>`<span><i style="--legend-color:${palette[m]||'#aebbc7'}"></i>${esc(shortMethod[m]||m)}</span>`).join('')+'<span><i style="--legend-color:#f0d5b8"></i>Número no círculo = episódios agrupados</span>';
  }
  function groupButton(g){const rr=recordsOf(g);return `<button data-map-event="${esc(g.id)}"><strong>${esc(titleOf(g))}</strong><span>${esc(g.place||g.country)} · ${esc(date(rr[0]?.date||'Data pendente'))}</span><span>${g.recordIds.length} ficha${g.recordIds.length===1?'':'s'} · ${esc(precisionOf(g))}</span></button>`;}
  function chapterButton(c){return `<button data-map-chapter="${esc(c.id)}"><strong>${esc(c.title)}</strong><span>${esc(c.countryLabel)} · ${c.startYear}–${c.endYear}</span><span>${esc(c.classification)}</span></button>`;}
  function emptyPanel(){
    $('map-panel').innerHTML=`<p class="eyebrow">${ms.layer==='cases'?'CASOS INDIVIDUAIS':'CAPÍTULOS HISTÓRICOS'}</p><div class="map-empty-icon" aria-hidden="true">◎</div><h3>Uma história começa<br>com um lugar.</h3><p>${ms.layer==='cases'?'Clique em um ponto para conhecer o episódio. Os círculos numerados aproximam grupos de pontos.':'Clique em um país destacado para conhecer os capítulos históricos relacionados.'}</p><p class="map-panel-note">${ms.layer==='cases'?'Sem cidade documentada, a ficha permanece acessível pelo país e pela lista. Não usamos a capital como local presumido do acontecimento.':'Cada estimativa permanece no seu período e universo. Capítulos históricos e fichas individuais não são somados.'}</p>`;
  }
  function showEvent(id,save=true){
    const g=filteredLocations().find(x=>x.id===id);if(!g){emptyPanel();return;}
    ms.selection=`event:${id}`;const rr=recordsOf(g),r=rr[0];
    $('map-panel').innerHTML=`<button class="map-panel-back" data-panel-country="${esc(g.iso3)}">← ${esc(g.country||r.country)}</button><p class="eyebrow">${esc(r.method)}</p><h3>${esc(titleOf(g))}</h3><p class="map-panel-meta">${esc(date(r.date))}<br>${esc(g.place||g.country)}</p><p>${esc(r.summary)}</p>${rr.length===1?`<button class="button primary" data-case="${esc(r.id)}">Abrir ficha e documentos →</button>`:`<div class="panel-events">${rr.map(v=>`<button data-case="${esc(v.id)}">${esc(v.name)}<span>Abrir ficha e documentos →</span></button>`).join('')}</div>`}<p class="map-panel-note">${esc(precisionOf(g))}. ${esc(g.coordinateBasis||'')}${g.notes?' '+esc(Array.isArray(g.notes)?g.notes.join(' '):g.notes):''}</p>${g.coordinateSource?`<p class="map-panel-note">Localidade: GeoNames ${esc(g.coordinateSource.geonameId)} · ${esc(sourceIdsOf(g).join(', '))}</p>`:''}`;
    if(save)persistMap();
  }
  function showCountry(iso,save=true){
    const c=byISO.get(iso),groups=filteredLocations().filter(g=>g.iso3===iso),chapters=filteredChapters().filter(h=>countriesOf(h).includes(iso));
    ms.selection=`country:${iso}`;
    const count=ms.layer==='cases'?groups.length:chapters.length;
    $('map-panel').innerHTML=`<p class="eyebrow">${ms.layer==='cases'?'EPISÓDIOS RELACIONADOS':'CONTEXTO HISTÓRICO'}</p><h3>${esc(c?.country||iso)}</h3><p class="map-panel-meta">${count} ${ms.layer==='cases'?'grupo'+(count===1?'':'s')+' de episódios':'capítulo'+(count===1?'':'s')} neste recorte</p>${count?`<div class="panel-events">${ms.layer==='cases'?groups.map(groupButton).join(''):chapters.map(chapterButton).join('')}</div>`:'<p>Nenhum registro corresponde aos filtros selecionados.</p>'}<p class="map-panel-note">${ms.layer==='cases'?'Cada grupo pode reunir fichas de várias vítimas do mesmo episódio. Casos sem cidade aparecem aqui, sem ponto presumido.':'As fronteiras atuais servem à navegação. Não representam a extensão histórica dos regimes nem os locais exatos de todos os crimes.'}</p>`;
    renderCountries();if(save)persistMap();
  }
  function showChapterOnMap(id,save=true){const c=filteredChapters().find(x=>x.id===id);if(!c){emptyPanel();return;}ms.selection=`chapter:${id}`;const f=c.figures[0];$('map-panel').innerHTML=`<p class="eyebrow">${esc(c.classification)}</p><h3>${esc(c.title)}</h3><p class="map-panel-meta">${esc(c.countryLabel)} · ${c.startYear}–${c.endYear}</p><p>${esc(c.subtitle)}</p>${f?`<strong class="panel-figure">${esc(f.valueText)}</strong><p>${esc(f.label)}</p>`:''}<button class="button primary" data-chapter="${esc(c.id)}">Ler o capítulo e as fontes →</button><p class="map-panel-note">${esc(c.caveat)}</p>`;if(save)persistMap();}
  function renderPanel(){if(ms.selection?.startsWith('event:'))showEvent(ms.selection.slice(6),false);else if(ms.selection?.startsWith('country:'))showCountry(ms.selection.slice(8),false);else if(ms.selection?.startsWith('chapter:'))showChapterOnMap(ms.selection.slice(8),false);else emptyPanel();}
  function renderResults(){
    if(ms.layer==='cases'){
      const groups=filteredLocations(),fiches=groups.reduce((s,g)=>s+g.recordIds.length,0),points=groups.filter(g=>g.precision==='city'&&g.coordinates).length;
      $('map-list').innerHTML=groups.length?groups.map(groupButton).join(''):'<p class="fineprint">Nenhum episódio corresponde aos filtros.</p>';
      $('map-result-status').innerHTML=`<strong>${groups.length}</strong> grupos de episódios · <strong>${fiches}</strong> fichas de pessoa e episódio · <strong>${points}</strong> com referência de cidade · <strong>${groups.length-points}</strong> por região ou país. Datas de triagem podem permanecer em revisão.`;
    }else{
      const chapters=filteredChapters();$('map-list').innerHTML=chapters.length?chapters.map(chapterButton).join(''):'<p class="fineprint">Nenhum capítulo corresponde aos filtros.</p>';
      $('map-result-status').innerHTML=`<strong>${chapters.length}</strong> capítulos históricos neste período. As cifras se referem aos recortes de cada fonte. Sem soma entre capítulos.`;
    }
  }
  function renderMap(resetSelection=false){if(resetSelection)ms.selection=null;syncControls();renderCountries();renderMarkers();legend();renderResults();renderPanel();}
  function setLayer(layer,save=true){ms.layer=layer;ms.selection=null;ms.country='';ms.method='';ms.group='';setCountryOptions();home();renderMap();if(save)persistMap();}
  function selectCluster(index){const c=currentClusters[index];if(!c)return;if(c.groups.length===1){showEvent(c.groups[0].id);return;}const groupIds=c.groups.map(g=>g.id);if(view.w>42)focusPoint([c.x,c.y],Math.max(40,view.w*.43));ms.selection=null;$('map-panel').innerHTML=`<p class="eyebrow">EPISÓDIOS PRÓXIMOS</p><h3>${c.groups.length} episódios neste grupo.</h3><p>O mapa foi aproximado. Selecione um ponto ou escolha abaixo.</p><div class="panel-events">${groupIds.map(id=>filteredLocations().find(g=>g.id===id)).filter(Boolean).map(groupButton).join('')}</div>`;persistMap();}
  function screenPoint(clientX,clientY){const rect=$('world-map').getBoundingClientRect();const rw=rect.width||800,rh=rect.height||384,scale=Math.min(rw/view.w,rh/view.h),ox=(rw-view.w*scale)/2,oy=(rh-view.h*scale)/2;return [view.x+(clientX-rect.left-ox)/scale,view.y+(clientY-rect.top-oy)/scale];}
  function chapterCard(c){const f=c.figures[0];return `<article class="history-card"><span class="history-class">${esc(c.classification)}</span><h3>${esc(c.title)}</h3><p class="history-place">${esc(c.countryLabel)} · ${c.startYear}–${c.endYear}</p>${f?`<p class="history-figure">${esc(f.valueText)}</p><p class="history-figure-label">${esc(f.label)}</p>`:''}<p class="history-card-note">${esc(c.regime)}</p><button data-chapter="${esc(c.id)}">Entender os fatos e os números →</button></article>`;}
  function renderHistory(){const list=filteredChapters(true);$('history-grid').innerHTML=list.slice(0,historyLimit).map(chapterCard).join('')||'<p>Nenhum capítulo encontrado.</p>';$('history-status').textContent=`${Math.min(historyLimit,list.length)} de ${list.length} capítulos. Conteúdo histórico separado da base individualizada.`;$('more-history').hidden=historyLimit>=list.length;}
  function chapterMarkup(c){
    const related=R.filter(r=>r.collection==='documental'&&countriesOf(c).some(i=>byISO.get(i)?.country===r.country));
    const countryLabels=countriesOf(c).map(i=>byISO.get(i)?.country).filter(Boolean);
    return `<div class="reader-shell"><p class="reader-kicker">CONTEXTO HISTÓRICO · ${esc(c.id)}</p><h1 id="chapter-title" tabindex="-1">${esc(c.title)}</h1><p class="reader-deck">${esc(c.subtitle)}</p><div class="chapter-meta"><span>${esc(c.countryLabel)}</span><span>${c.startYear}–${c.endYear}</span><span>${esc(c.classification)}</span></div><div class="reader-notice"><strong>Capítulo em revisão.</strong> Estimativas históricas e fichas individuais são conjuntos distintos. As cifras abaixo não compõem um total de mortes do Observatório.</div><div class="reader-layout"><div class="reader-main"><section class="reader-section"><h2>Contexto e acontecimentos</h2>${paragraphsOf(c).map(p=>`<p>${esc(p)}</p>`).join('')}</section><section class="reader-section"><h2>O que os números representam</h2><div class="chapter-facts">${c.figures.map(f=>`<div class="chapter-fact"><strong>${esc(f.valueText)}</strong><p><b>${esc(f.label)}</b></p><p>${esc(f.scope)}</p><small>${esc(f.sourceIds.join(' · '))}${f.notAdditive?' · Não somar aos demais recortes.':''}</small></div>`).join('')}</div><p class="chapter-attribution">${esc(c.caveat)}</p><p class="history-type-note">${esc(c.geographyScope||'')}</p></section><section class="reader-section"><h2>Liderança e responsabilidade</h2><p>${esc(c.leader)}</p><p class="history-type-note">A identificação da liderança política contextualiza o período. A responsabilidade por cada crime e as decisões judiciais devem ser lidas conforme os documentos citados.</p></section><section class="reader-section"><h2>Fontes e correspondência documental</h2>${c.sourceIds.map(id=>DATA.sources.find(s=>s.fonte_id===id)).filter(Boolean).map(s=>api.sourceMarkup(s,true)).join('')}</section>${related.length?`<section class="reader-section"><h2>Explore também as fichas deste contexto</h2><p class="related-note">Vínculo de navegação por país. Estas fichas não constituem a lista de vítimas contabilizadas nas estimativas do capítulo.</p><div class="related-list">${related.slice(0,6).map(r=>`<button data-case="${esc(r.id)}"><b>${esc(r.name)}</b>${esc(date(r.date))} · ${esc(r.type)} →</button>`).join('')}</div></section>`:''}<p class="reader-end">Rogerio Pires · Revista Timeline.<br>Fontes consultadas para esta versão: 13/10/2026. Cada cifra conserva o recorte e a data da fonte.</p></div><aside class="reader-side"><dl><div><dt>Regime / contexto</dt><dd>${esc(c.regime)}</dd></div><div><dt>Período do capítulo</dt><dd>${c.startYear}–${c.endYear}</dd></div><div><dt>Orientação documentada</dt><dd>${esc(c.ideology||'Ver contexto e fontes')}<br><small>${esc((c.ideologySourceIds||[]).join(' · '))}</small></dd></div><div><dt>Região</dt><dd>${esc(c.region)}</dd></div><div><dt>Países no mapa atual</dt><dd>${esc(countryLabels.join(', '))}</dd></div><div><dt>Natureza</dt><dd>Contexto histórico agregado. Fora da contagem individual.</dd></div></dl><div class="side-actions"><button class="button primary chapter-back-map" data-chapter-map="${esc(c.id)}">Explorar este capítulo no mapa</button><button class="button secondary" data-print>Imprimir capítulo</button></div></aside></div></div>`;
  }
  function syncReading(){document.body.classList.toggle('reading',$('history-dialog').open||$('case-dialog').open);}
  function showChapter(id){const c=byChapter.get(id);if(!c)return;activeChapter=id;$('history-content').innerHTML=chapterMarkup(c);if(!$('history-dialog').open)$('history-dialog').showModal();$('history-dialog').scrollTop=0;syncReading();setTimeout(()=>$('chapter-title')?.focus({preventScroll:true}),0);}
  function openChapter(id){if(!byChapter.has(id))return;if(!activeChapter){chapterReturn=location.hash||pageHash;chapterFocus=document.activeElement;chapterScroll=window.scrollY;}history.pushState({chapterId:id},'',`#capitulo=${encodeURIComponent(id)}`);showChapter(id);}
  function hideChapter(){if(!activeChapter)return;activeChapter=null;if($('history-dialog').open)$('history-dialog').close();syncReading();}
  function closeChapter(){if(!activeChapter)return;hideChapter();history.replaceState(null,'',chapterReturn);window.scrollTo(0,chapterScroll);if(chapterFocus&&document.contains(chapterFocus))chapterFocus.focus({preventScroll:true});}
  function readRoute(){
    const hash=location.hash;
    if(hash.startsWith('#capitulo=')){try{showChapter(decodeURIComponent(hash.slice(10)));}catch{}return;}
    if(!hash.startsWith('#caso='))hideChapter();
    if(hasMap&&hash.startsWith('#mapa?')){
      const p=new URLSearchParams(hash.slice(6));ms.layer=p.get('camada')==='regimes'?'history':'cases';ms.q=p.get('q')||'';ms.country=p.get('pais')||'';ms.method=p.get('tipo')||'';ms.group=p.get('perfil')||'';ms.from=Math.max(1900,Math.min(2026,Number(p.get('de'))||1900));ms.to=Math.max(ms.from,Math.min(2026,Number(p.get('ate'))||2026));ms.undated=p.get('semdata')!=='0';ms.selection=p.get('selecionado');setCountryOptions();renderMap();
    }
    syncReading();
  }
  function expandCriteria(){if(location.hash==='#criterios'&&$('criterios'))$('criterios').open=true;}
  document.addEventListener('click',e=>{
    const b=e.target.closest('button,[data-map-country],[data-map-cluster]');if(!b)return;
    if(b.dataset.chapter){openChapter(b.dataset.chapter);return;}
    if(b.dataset.chapterMap){const id=b.dataset.chapterMap;if(!hasMap){location.assign('mapa.html#mapa?camada=regimes&selecionado='+encodeURIComponent('chapter:'+id));return;}closeChapter();setLayer('history',false);ms.q='';ms.from=1900;ms.to=2026;const c=byChapter.get(id);renderMap();showChapterOnMap(id);if(countriesOf(c).length===1)focusCountry(countriesOf(c)[0]);$('mapa').scrollIntoView({behavior:'smooth'});return;}
    if(b.dataset.mapLayer){setLayer(b.dataset.mapLayer);return;}
    if(b.dataset.mapPeriod){[ms.from,ms.to]=b.dataset.mapPeriod.split(',').map(Number);renderMap(true);persistMap();return;}
    if(b.dataset.mapCountry){if(Date.now()<suppressClickUntil)return;showCountry(b.dataset.mapCountry);focusCountry(b.dataset.mapCountry);return;}
    if(b.dataset.panelCountry){showCountry(b.dataset.panelCountry);return;}
    if(b.dataset.mapEvent){showEvent(b.dataset.mapEvent);return;}
    if(b.dataset.mapChapter){showChapterOnMap(b.dataset.mapChapter);return;}
    if(b.hasAttribute('data-map-cluster')){if(Date.now()<suppressClickUntil)return;selectCluster(Number(b.dataset.mapCluster));return;}
  });
  if(hasMap){
  $('map-filters').addEventListener('submit',e=>e.preventDefault());
  let timer;for(const key of ['q','country','method','group'])$('map-'+key).addEventListener(key==='q'?'input':'change',()=>{const update=()=>{ms[key]=$('map-'+key).value;renderMap(true);persistMap();};clearTimeout(timer);if(key==='q')timer=setTimeout(update,130);else update();});
  for(const side of ['from','to'])$('map-'+side).addEventListener('input',()=>{ms[side]=Number($('map-'+side).value);if(ms.from>ms.to){if(side==='from')ms.to=ms.from;else ms.from=ms.to;}renderMap(true);persistMap();});
  $('map-undated').addEventListener('change',()=>{ms.undated=$('map-undated').checked;renderMap(true);persistMap();});
  $('map-reset').addEventListener('click',()=>{Object.assign(ms,{q:'',country:'',method:'',group:'',from:1900,to:2026,undated:true,selection:null});setCountryOptions();home();renderMap();persistMap();});
  $('map-zoom-in').addEventListener('click',()=>zoom(.6));$('map-zoom-out').addEventListener('click',()=>zoom(1/.6));$('map-home').addEventListener('click',home);
  const svg=$('world-map');
  svg.addEventListener('keydown',e=>{const target=e.target.closest('[data-map-cluster],[data-map-country]');if(target&&(e.key==='Enter'||e.key===' ')){e.preventDefault();if(target.dataset.mapCountry){showCountry(target.dataset.mapCountry);focusCountry(target.dataset.mapCountry);}else selectCluster(Number(target.dataset.mapCluster));return;}if(['+','=','-','Home','ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)){e.preventDefault();if(e.key==='+'||e.key==='=')zoom(.6);else if(e.key==='-')zoom(1/.6);else if(e.key==='Home')home();else{if(e.key==='ArrowLeft')view.x-=view.w*.12;if(e.key==='ArrowRight')view.x+=view.w*.12;if(e.key==='ArrowUp')view.y-=view.h*.16;if(e.key==='ArrowDown')view.y+=view.h*.16;updateView();}}});
  svg.addEventListener('wheel',e=>{if(!e.ctrlKey&&!e.metaKey)return;e.preventDefault();zoom(e.deltaY>0?1.15:.87,screenPoint(e.clientX,e.clientY));},{passive:false});
  svg.addEventListener('pointerdown',e=>{if(e.pointerType==='mouse'&&e.button!==0)return;pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});if(pointers.size===1){drag={id:e.pointerId,startX:e.clientX,startY:e.clientY,x:view.x,y:view.y,w:view.w,h:view.h,moved:false};}else if(pointers.size===2){const pp=[...pointers.values()];pinch={distance:Math.hypot(pp[0].x-pp[1].x,pp[0].y-pp[1].y),w:view.w,center:screenPoint((pp[0].x+pp[1].x)/2,(pp[0].y+pp[1].y)/2)};suppressClickUntil=Date.now()+300;}});
  svg.addEventListener('pointermove',e=>{
    if(!pointers.has(e.pointerId)){const p=e.target.closest('[data-map-country],[data-map-cluster]');$('map-hover').textContent=p?.getAttribute('aria-label')||'Clique em um ponto ou país com registros';return;}
    pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
    if(pinch&&pointers.size===2){const pp=[...pointers.values()],distance=Math.hypot(pp[0].x-pp[1].x,pp[0].y-pp[1].y);if(distance>0)focusPoint(pinch.center,Math.max(40,Math.min(1000,pinch.w*pinch.distance/distance)));suppressClickUntil=Date.now()+300;return;}
    if(!drag)return;const dx=e.clientX-drag.startX,dy=e.clientY-drag.startY;if(Math.hypot(dx,dy)>5){drag.moved=true;svg.setPointerCapture?.(e.pointerId);svg.classList.add('dragging');const rect=svg.getBoundingClientRect(),scale=Math.min((rect.width||800)/drag.w,(rect.height||384)/drag.h);view.x=drag.x-dx/scale;view.y=drag.y-dy/scale;updateView();}
  });
  function pointerUp(e){const moved=drag?.moved||!!pinch;pointers.delete(e.pointerId);if(moved)suppressClickUntil=Date.now()+250;if(pointers.size<2)pinch=null;if(!pointers.size){drag=null;svg.classList.remove('dragging');}else{const p=[...pointers.values()][0];drag={id:[...pointers.keys()][0],startX:p.x,startY:p.y,x:view.x,y:view.y,w:view.w,h:view.h,moved:false};}}
  svg.addEventListener('pointerup',pointerUp);svg.addEventListener('pointercancel',pointerUp);svg.addEventListener('lostpointercapture',e=>{if(pointers.has(e.pointerId))pointerUp(e);});
  svg.addEventListener('pointerleave',()=>{$('map-hover').textContent='Clique em um ponto ou país com registros';});
  }
  if(hasHistory){
  $('history-q').addEventListener('input',()=>{historyLimit=6;renderHistory();});$('history-region').addEventListener('change',()=>{historyLimit=6;renderHistory();});$('more-history').addEventListener('click',()=>{historyLimit=H.length;renderHistory();});
  }
  $('close-history').addEventListener('click',closeChapter);$('history-dialog').addEventListener('cancel',e=>{e.preventDefault();closeChapter();});$('history-dialog').addEventListener('close',syncReading);$('case-dialog').addEventListener('close',()=>setTimeout(syncReading,0));
  window.addEventListener('hashchange',()=>{readRoute();expandCriteria();});window.addEventListener('popstate',readRoute);if(hasMap)window.addEventListener('resize',()=>renderMarkers());
  if(hasMap){
  setSelect($('map-method'),[...new Set(R.filter(r=>r.collection==='documental').map(r=>r.method))].sort());
  setSelect($('map-group'),Object.keys(DATA.groupLabels).filter(k=>R.some(r=>r.collection==='documental'&&r.group===k)),k=>DATA.groupLabels[k]);
  setCountryOptions();
  $('map-grid').innerHTML=Array.from({length:11},(_,i)=>`<path class="geo-line" d="M${(i+1)*1000/12} 0V480"></path>`).join('')+Array.from({length:5},(_,i)=>`<path class="geo-line" d="M0 ${(i+1)*80}H1000"></path>`).join('');
  renderMap();
  }
  if(hasHistory){setSelect($('history-region'),[...new Set(H.map(c=>c.region))].sort());renderHistory();}
  const docRecords=R.filter(r=>r.collection==='documental');for(const [id,value] of [['stat-cases',docRecords.length],['stat-contexts',new Set(docRecords.map(r=>r.country)).size],['stat-chapters',H.length]])if($(id))$(id).textContent=value;
  if($('method-links'))$('method-links').innerHTML=[...new Set(docRecords.map(r=>r.method))].map(m=>`<button data-method-link="${esc(m)}">${esc(shortMethod[m]||m)} →</button>`).join('');
  readRoute();expandCriteria();
  window.ObservatoryExplorer=Object.freeze({getState:()=>({...ms}),getView:()=>({...view}),groups:locations,chapters:H,filterGroups:filteredLocations,filterChapters:()=>filteredChapters(),clusters:()=>currentClusters,selectEvent:showEvent,selectCountry:showCountry,selectChapter:showChapterOnMap,openChapter,project});
})();
