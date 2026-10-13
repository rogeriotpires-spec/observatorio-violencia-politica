(() => {
  'use strict';
  const DATA=window.ObservatoryData;
  const DOCS=window.ObservatoryDocuments;
  const H=DATA.historicalChapters||[];
  const R=DATA.records,S=DATA.sources,byId=new Map(R.map(r=>[r.id,r])),bySource=new Map(S.map(s=>[s.fonte_id,s]));
  const $=id=>document.getElementById(id);
  const pageHash='#'+document.body.dataset.section, hasArchive=!!$('acervo');
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const norm=v=>String(v??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  const safeURL=v=>{try{const u=new URL(v);return ['https:','http:'].includes(u.protocol)?u.href:'#';}catch{return '#';}};
  const formatDate=v=>{if(!v)return 'Data não determinada';if(/^\d{4}-\d{2}-\d{2}$/.test(v))return v.split('-').reverse().join('/');return v;};
  const state={collection:'documental',q:'',country:'',method:'',group:'',period:'',sort:'relevance',source:'',page:1};
  const pageSize=12,formKeys=['q','country','method','group','period','sort'];
  let activeCase=null,returnHash=pageHash,returnScroll=0,returnFocus=null,sourceLimit=8,toastTimer;
  const documentURLs=new Map();
  const collectionHelp={
    documental:'Pessoa e episódio com extração parcial. Orientação política, autoria e elegibilidade ainda passam por validação.',
    legado:'Referências da versão anterior, ainda sem extração e confronto das fontes.',
    agregado:'Ameaças e relatos ainda não individualizados; não entram na contagem de ocorrências.',
    controle:'Casos mantidos para controlar os critérios de inclusão. Robert Fico e Arthur Calwell ficam fora do recorte principal de direita, centro-direita e centro.'
  };
  function periodMatches(r,p){if(!p)return true;if(p==='unknown')return r.year==null;const [a,b]=p.split('-').map(Number);return r.year!=null&&r.year>=a&&r.year<=b;}
  function filtered(st=state){
    const terms=norm(st.q).trim().split(/\s+/).filter(Boolean);
    let rows=R.filter(r=>r.collection===st.collection&&(!st.country||r.country===st.country)&&(!st.method||r.method===st.method)&&(!st.group||r.group===st.group)&&periodMatches(r,st.period)&&(!st.source||r.sourceIds.includes(st.source))&&terms.every(t=>norm([r.name,r.title,r.country,r.location,r.summary,r.type,r.role,r.authorLead,r.id,...r.sourceIds,r.evidence.map(e=>e.afirmacao).join(' ')].join(' ')).includes(t)));
    rows=rows.slice();
    if(st.sort==='name')rows.sort((a,b)=>a.name.localeCompare(b.name,'pt-BR')||a.id.localeCompare(b.id));
    if(st.sort==='recent')rows.sort((a,b)=>(b.year??-Infinity)-(a.year??-Infinity)||b.date.localeCompare(a.date));
    if(st.sort==='oldest')rows.sort((a,b)=>(a.year??Infinity)-(b.year??Infinity)||a.date.localeCompare(b.date));
    return rows;
  }
  function announce(text){clearTimeout(toastTimer);$('toast').textContent=text;$('toast').hidden=false;toastTimer=setTimeout(()=>$('toast').hidden=true,5000);}
  function setOptions(id,values,labelFn=x=>x){const sel=$(id);if(!sel)return;const keep=sel.value;sel.innerHTML=sel.options[0].outerHTML+values.map(v=>`<option value="${esc(v)}">${esc(labelFn(v))}</option>`).join('');if(values.includes(keep))sel.value=keep;}
  setOptions('country',[...new Set(R.map(r=>r.country))].sort((a,b)=>a.localeCompare(b,'pt')));
  setOptions('method',[...new Set(R.map(r=>r.method))].sort((a,b)=>a.localeCompare(b,'pt')));
  setOptions('group',Object.keys(DATA.groupLabels).filter(k=>R.some(r=>r.group===k)),k=>DATA.groupLabels[k]);
  function syncForm(){if(!hasArchive)return;formKeys.forEach(k=>$(k).value=state[k]);}
  function archiveHash(){const p=new URLSearchParams();p.set('conjunto',state.collection);for(const k of formKeys)if(state[k]&&(k!=='sort'||state[k]!=='relevance'))p.set(k,state[k]);if(state.source)p.set('fonte',state.source);if(state.page>1)p.set('pagina',String(state.page));return '#acervo?'+p.toString();}
  function persistFilters(){try{history.replaceState(null,'',archiveHash());}catch{}}
  function resetFilters(){Object.assign(state,{q:'',country:'',method:'',group:'',period:'',sort:'relevance',source:'',page:1});syncForm();renderCases();persistFilters();}
  function browse(updates={}){Object.assign(state,{collection:'documental',q:'',country:'',method:'',group:'',period:'',sort:'relevance',source:'',page:1},updates);if(!hasArchive){location.assign('casos.html'+archiveHash());return;}syncForm();renderCases();persistFilters();$('acervo').scrollIntoView({behavior:'smooth',block:'start'});}
  function card(r){const status=r.collection==='legado'?'Fonte ainda não extraída':r.collection==='agregado'?'Agregado em revisão':r.collection==='controle'?'Controle de exclusão':`${r.sourceIds.length} fonte${r.sourceIds.length===1?'':'s'} · extração parcial`;
    return `<article class="case-card"><div class="case-card-top"><strong>${esc(r.country)}</strong><span>${esc(formatDate(r.date))}</span></div><div class="case-card-body"><span class="case-type">${esc(r.type)}</span><h3 class="case-name"><button data-case="${esc(r.id)}">${esc(r.name)}</button></h3><p class="case-summary">${esc(r.summary)}</p><p class="card-category">${esc(DATA.groupLabels[r.group]||'Classificação pendente')}</p><div class="case-card-bottom"><span class="evidence-count">${esc(status)}</span><button data-case="${esc(r.id)}" aria-label="Ler ficha de ${esc(r.name)}, ${esc(r.date)}">Ler ficha →</button></div></div></article>`;
  }
  function renderCases(){if(!hasArchive)return;const rows=filtered(),pages=Math.max(1,Math.ceil(rows.length/pageSize));state.page=Math.min(pages,Math.max(1,state.page));
    document.querySelectorAll('[data-collection]').forEach(b=>{b.setAttribute('aria-pressed',String(b.dataset.collection===state.collection));b.querySelector('b').textContent=R.filter(r=>r.collection===b.dataset.collection).length;});
    document.querySelectorAll('[data-profile]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.profile===state.group)));
    $('collection-help').textContent=collectionHelp[state.collection];
    $('result-count').innerHTML=`<b>${rows.length}</b> ficha${rows.length===1?'':'s'} neste recorte · <b>${new Set(rows.map(r=>r.country)).size}</b> país${new Set(rows.map(r=>r.country)).size===1?'':'es'}`;
    $('case-grid').innerHTML=rows.slice((state.page-1)*pageSize,state.page*pageSize).map(card).join('');
    $('empty-state').hidden=rows.length>0;$('page-status').textContent=`Página ${state.page} de ${pages}`;
    $('prev-page').disabled=state.page===1;$('next-page').disabled=state.page>=pages;
    $('source-filter').hidden=!state.source;
    if(state.source)$('source-filter').innerHTML=`Documento selecionado: <strong>${esc(bySource.get(state.source)?.titulo||state.source)}</strong><button data-clear-source>Remover este filtro</button>`;
  }
  function sourceMarkup(s,nested=false){const count=R.filter(r=>r.sourceIds.includes(s.fonte_id)).length;
    const doc=DOCS[s.fonte_id],chapters=H.filter(c=>c.sourceIds.includes(s.fonte_id));
    return `<details class="source-item"><summary><span class="source-id">${esc(s.fonte_id)}</span><div><h3>${esc(s.titulo)}</h3><p>${esc(s.instituicao)} · ${s.data_publicacao?esc(formatDate(s.data_publicacao)):'Data de publicação não informada'}${s.legacy?' · referência anterior':''}</p></div></summary><div class="source-body"><p><strong>Natureza:</strong> ${esc(s.tipo_fonte)}.</p><p><strong>Localizador:</strong> ${esc(s.localizador_interno||'Ver evidências da ficha')}.</p><p><strong>Consulta:</strong> ${s.acesso_em?esc(formatDate(s.acesso_em)):'Pendente nesta revisão'}.</p><p><strong>Endereço original:</strong><br><a href="${esc(safeURL(s.url))}" target="_blank" rel="noopener noreferrer">${esc(s.url)}</a></p>${doc?`<p>Extrato incorporado: páginas originais ${doc.pages.map(esc).join(', ')}.</p>`:''}<div class="source-actions">${doc?`<button class="button primary" data-document="${esc(s.fonte_id)}">Ler extrato dentro do site</button>`:''}${!nested&&count?`<button class="button secondary" data-dossier="${esc(s.fonte_id)}">Ver ${count} ficha${count===1?'':'s'} vinculada${count===1?'':'s'}</button>`:''}${!nested?chapters.map(c=>`<button class="button secondary chapter-source-link" data-chapter="${esc(c.id)}">${esc(c.title)} →</button>`).join(''):''}</div>${s.historical&&s.fato_sustentado?`<p><strong>Contribuição documental:</strong> ${esc(s.fato_sustentado)}</p>`:''}</div></details>`;
  }
  function renderSources(){if(!$('source-list'))return;const q=norm($('source-q').value);const list=S.filter(s=>!s.legacy&&norm([s.fonte_id,s.titulo,s.instituicao,s.tipo_fonte].join(' ')).includes(q));$('source-list').innerHTML=list.slice(0,sourceLimit).map(s=>sourceMarkup(s)).join('');$('source-status').textContent=`${Math.min(list.length,sourceLimit)} de ${list.length} fontes exibidas. As referências anteriores ainda não extraídas permanecem nas respectivas fichas.`;$('more-sources').hidden=sourceLimit>=list.length;}
  function evidenceMarkup(e){const s=bySource.get(e.fonte_id);return `<section class="evidence"><div class="evidence-top"><strong>${esc(DATA.fieldLabels[e.campo]||({situacao_judicial_atualizacao:'Andamento judicial',status_autoria:'Estado da atribuição',partido_documentado:'Partido',numero_deputados_sequestrados_evento:'Deputados sequestrados no evento',numero_deputados_mortos_evento:'Deputados mortos no evento',estatistica_externa_separada:'Estatística externa — contexto separado'})[e.campo]||e.campo)}</strong><span>${esc(e.evidencia_id)} · ${esc(e.natureza_evidencia)}</span></div><p>${esc(e.afirmacao)}</p>${e.limite_da_inferencia?`<p class="evidence-note">${esc(e.limite_da_inferencia)}</p>`:''}<p class="evidence-source">${esc(s?.instituicao||e.fonte_id)} · ${esc(formatDate(e.data_fonte))} · ${esc(e.localizador)} · ${esc(e.fonte_id)}</p>${DOCS[e.fonte_id]?`<button class="text-button" data-document="${esc(e.fonte_id)}">Examinar o extrato documental →</button>`:''}</section>`;}
  function uniqueText(values){const seen=new Set();return values.filter(v=>{const key=norm(v).replace(/\s+/g,' ').trim();if(!key||seen.has(key))return false;seen.add(key);return true;});}
  function uniqueEvidence(values){const seen=new Set();return values.filter(e=>{const key=JSON.stringify([e.campo,e.afirmacao,e.fonte_id,e.localizador,e.natureza_evidencia,e.limite_da_inferencia]);if(seen.has(key))return false;seen.add(key);return true;});}
  function caseMarkup(r){
    const related=R.filter(x=>x.id!==r.id&&((r.sharedEvent&&x.sharedEvent===r.sharedEvent)||x.name===r.name));
    const evidence=uniqueEvidence(r.evidence);
    const narrative=evidence.filter(e=>e.campo==='descricao_documental_detalhada'&&norm(e.afirmacao)===norm(r.summary));
    const narrativeNotes=uniqueText(narrative.map(e=>e.limite_da_inferencia).filter(Boolean));
    const bodyEvidence=evidence.filter(e=>!narrative.includes(e));
    const hasField=field=>evidence.some(e=>e.campo===field);
    const hasResponsibility=evidence.some(e=>/autoria|organizacao|motivacao|situacao_judicial|investigacao_policial/.test(e.campo));
    const showLead=r.authorLead&&!hasResponsibility&&!norm(r.summary).includes(norm(r.authorLead));
    const status={
      documental:['Extração parcial','Validação integral e elegibilidade pendentes.'],
      legado:['Acervo anterior','Resumo preservado; fonte ainda não extraída e confrontada.'],
      agregado:['Registro agregado','Relatos ainda não individualizados; fora da contagem de ocorrências.'],
      controle:['Controle de exclusão','Mantido para auditoria dos critérios; fora do recorte principal.']
    }[r.collection];
    const pending=uniqueText(r.pending);
    return `<div class="reader-shell"><p class="reader-kicker">${esc(r.country)} · ${esc(r.id)}</p><h1 id="case-title" tabindex="-1">${esc(r.name)}</h1><p class="reader-deck">${esc(r.type)}</p><div class="reader-notice reader-state"><strong>${esc(status[0])}.</strong> ${esc(status[1])} Revisão documental em andamento.</div><nav class="reader-index" aria-label="Partes da ficha"><button data-reader-jump="ficha-acontecimento">O acontecimento</button><button data-reader-jump="ficha-historia">A história</button><button data-reader-jump="ficha-responsabilidade">Responsabilidade</button><button data-reader-jump="ficha-provas">As provas</button><button data-reader-jump="ficha-pendencias">Em aberto</button></nav><div class="reader-layout"><div class="reader-main"><section id="ficha-acontecimento" class="reader-section"><h2>O acontecimento</h2><p>${esc(r.summary)}</p>${narrative.length?`<p class="narrative-source">${narrative.map(e=>`${esc(e.fonte_id)} · ${esc(e.localizador)} · ${esc(e.natureza_evidencia)}`).join('<br>')}</p>`:''}
    ${narrativeNotes.map(note=>`<p class="narrative-note">${esc(note)}</p>`).join('')}
    ${r.collection==='legado'&&r.legacyInvestigation&&norm(r.legacyInvestigation)!==norm(r.summary)?`<h2>Investigação no cadastro anterior</h2><p>${esc(r.legacyInvestigation)}</p>`:''}
    ${showLead?`<p class="triage-lead"><strong>Autoria indicada na triagem:</strong> ${esc(r.authorLead)}. Atribuição provisória, sem conclusão consolidada nesta ficha.</p>`:''}
    </section><section id="ficha-historia" class="reader-section"><h2>A história e o contexto</h2>${bodyEvidence.filter(e=>!/autoria|organizacao|motivacao|situacao_judicial|investigacao_policial|vinculo_ideologico_autor/.test(e.campo)).map(evidenceMarkup).join('')||'<p>Informações adicionais de contexto ainda não foram extraídas das fontes desta ficha.</p>'}</section><section id="ficha-responsabilidade" class="reader-section"><h2>A responsabilidade</h2>${bodyEvidence.filter(e=>/autoria|organizacao|motivacao|situacao_judicial|investigacao_policial|vinculo_ideologico_autor/.test(e.campo)).map(evidenceMarkup).join('')||'<p>A autoria, a motivação e a situação judicial ainda não têm extração consolidada nesta ficha.</p>'}</section>
    <section id="ficha-provas" class="reader-section"><h2>As provas e referências</h2>${r.sourceIds.map(id=>bySource.get(id)).filter(Boolean).map(s=>sourceMarkup(s,true)).join('')}</section>
    <section id="ficha-pendencias" class="reader-section"><h2>O que permanece em aberto</h2><ul class="pending-list">${pending.map(p=>`<li>${esc(p)}</li>`).join('')}</ul>${r.audit.length?`<details class="reader-audit"><summary>Notas da auditoria</summary><ul class="pending-list">${r.audit.map(a=>`<li><strong>${esc(a.tema)}.</strong> ${esc(a.achado)} ${esc(a.tratamento)}</li>`).join('')}</ul></details>`:''}
    ${related.length?`<h2>Episódios relacionados</h2><p class="related-note">Outras fichas da mesma pessoa ou evento.</p><div class="related-list">${related.map(x=>`<button data-case="${esc(x.id)}"><b>${esc(x.name)}</b>${esc(formatDate(x.date))} · ${esc(x.type)} →</button>`).join('')}</div>`:''}
    </section><p class="reader-end">Rogerio Pires · Revista Timeline.<br>Última extração: ${r.lastChecked?esc(formatDate(r.lastChecked)):'pendente'}. Cada afirmação reflete a data de sua fonte.</p></div><aside class="reader-side"><dl><div><dt>Local</dt><dd>${esc(r.location||'Não consolidado')}</dd></div><div><dt>Data de referência</dt><dd>${esc(formatDate(r.date))}${r.dateVerified?'':'<br><small>Data de triagem; conferência pendente</small>'}</dd></div><div><dt>Categoria provisória</dt><dd>${esc(DATA.groupLabels[r.group])}</dd></div>${!hasField('cargo_candidatura_atividade')?`<div><dt>Cargo ou atividade</dt><dd>${esc(r.role)}</dd></div>`:''}${!hasField('orientacao_vitima')?`<div><dt>Orientação da vítima</dt><dd>${esc(r.victimIdeology||'Não validada')}</dd></div>`:''}${!hasField('vinculo_ideologico_autor_demonstrado')?`<div><dt>Vínculo ideológico do autor</dt><dd>${esc(r.ideology||'Não consolidado')}</dd></div>`:''}${r.sharedEvent?`<div><dt>Evento compartilhado</dt><dd>${esc(r.sharedEvent)}</dd></div>`:''}<div><dt>Unidade</dt><dd>${r.collection==='agregado'?'Agregado sem individualização':'Pessoa e episódio'}</dd></div></dl><div class="side-actions"><button class="button primary" data-copy-case="${esc(r.id)}">Copiar referência</button><button class="button secondary" data-print>Imprimir esta ficha</button></div></aside></div></div>`;
  }
  function showCase(id){const r=byId.get(id);if(!r){announce('Ficha não encontrada nesta versão.');return;}if(activeCase===id)return;activeCase=id;$('case-content').innerHTML=caseMarkup(r);if(!$('case-dialog').open)$('case-dialog').showModal();document.body.classList.add('reading');$('case-dialog').scrollTop=0;setTimeout(()=>$('case-title')?.focus({preventScroll:true}),0);}
  function openCase(id){if(!byId.has(id))return;if(!activeCase){returnHash=location.hash||pageHash;returnScroll=window.scrollY;returnFocus=document.activeElement;}history.pushState({caseId:id},'',`#caso=${encodeURIComponent(id)}`);showCase(id);}
  function hideCase(){if(!activeCase)return;activeCase=null;if($('case-dialog').open)$('case-dialog').close();document.body.classList.remove('reading');requestAnimationFrame(()=>{window.scrollTo(0,returnScroll);if(returnFocus&&document.contains(returnFocus))returnFocus.focus({preventScroll:true});});}
  function closeCase(){if(!$('case-dialog').open)return;history.replaceState(null,'',returnHash||pageHash);hideCase();}
  function readHash(){const hash=location.hash;if(hash.startsWith('#caso=')){try{showCase(decodeURIComponent(hash.slice(6)));}catch{announce('Endereço de ficha inválido.');}return;}hideCase();if(hasArchive&&hash.startsWith('#acervo?')){const p=new URLSearchParams(hash.slice(8));const collection=p.get('conjunto');if(collection in collectionHelp)state.collection=collection;for(const k of formKeys)state[k]=p.get(k)||(k==='sort'?'relevance':'');state.source=bySource.has(p.get('fonte'))?p.get('fonte'):'';state.page=Math.max(1,Number(p.get('pagina'))||1);syncForm();renderCases();}}
  function getDocumentURL(id){if(documentURLs.has(id))return documentURLs.get(id);if(DOCS[id].url)return new URL(DOCS[id].url,document.baseURI).href;const d=DOCS[id],binary=atob(d.base64),bytes=new Uint8Array(binary.length);for(let i=0;i<binary.length;i++)bytes[i]=binary.charCodeAt(i);const url=URL.createObjectURL(new Blob([bytes],{type:d.mime}));documentURLs.set(id,url);return url;}
  function openDocument(id){const d=DOCS[id],s=bySource.get(id);if(!d||!s)return;const url=getDocumentURL(id);$('document-title').textContent=s.titulo;$('document-description').textContent=`${s.instituicao} · Documento ${formatDate(s.data_publicacao)} · Páginas originais selecionadas: ${d.pages.join(', ')}.`;$('download-document').href=url;$('download-document').download=d.name;$('pdf-view').innerHTML=`<iframe title="${esc(s.titulo)} — extrato selecionado" src="${esc(url)}"></iframe>`;$('pdf-view').hidden=false;$('page-view').hidden=true;$('page-view').innerHTML='';$('toggle-pages').textContent='Ler páginas como imagens';$('toggle-pages').dataset.document=id;$('document-dialog').showModal();}
  async function copyReference(id){const r=byId.get(id);const text=`${r.name} — ${formatDate(r.date)}. ${r.type}. ${r.id}. Observatório da Revista Timeline. Ficha publicada em revisão documental. Fontes: ${r.sourceIds.join(', ')}.`;try{await navigator.clipboard.writeText(text);announce('Referência copiada, com a indicação de revisão.');}catch{const input=document.createElement('textarea');input.value=text;document.body.appendChild(input);input.select();let ok=false;try{ok=document.execCommand('copy');}catch{}input.remove();announce(ok?'Referência copiada.':'Não foi possível copiar automaticamente. O identificador está no topo da ficha.');}}
  function download(content,name,type){const u=URL.createObjectURL(new Blob([content],{type}));const a=document.createElement('a');a.href=u;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),10000);}
  function exportJSON(){const records=filtered(),ids=new Set(records.flatMap(r=>r.sourceIds));const output={meta:{...DATA.meta,filters:{...state},notice:'Edição pública da pesquisa em andamento. As fichas não foram integralmente validadas.'},records,sources:S.filter(s=>ids.has(s.fonte_id))};download(JSON.stringify(output,null,2),'Observatorio_Recorte_Em_Revisao.json','application/json;charset=utf-8');}
  function csvCell(v){let s=String(v??'');if(/^[=+@\-\t\r]/.test(s))s="'"+s;return '"'+s.replace(/"/g,'""')+'"';}
  function exportCSV(){const cols=['id','nome','pais','data_referencia','categoria_provisoria','tipo','conjunto','evento_compartilhado','fontes','urls_fontes','validacao_integral','publicacao_autorizada'];const lines=[cols,...filtered().map(r=>[r.id,r.name,r.country,r.date,DATA.groupLabels[r.group],r.type,r.collection,r.sharedEvent||'',r.sourceIds.join('; '),r.sourceIds.map(id=>bySource.get(id)?.url||'').join(' | '),'não',r.publicationAuthorized?'sim':'não'])];download('\ufeff'+lines.map(row=>row.map(csvCell).join(',')).join('\r\n'),'Observatorio_Recorte_Em_Revisao.csv','text/csv;charset=utf-8');}
  document.addEventListener('click',e=>{const b=e.target.closest('button,[data-country]');if(!b)return;
    if(b.dataset.case){openCase(b.dataset.case);return;}
    if(b.dataset.document&&b.id!=='toggle-pages'){openDocument(b.dataset.document);return;}
    if(b.hasAttribute('data-profile')){state.group=b.dataset.profile;state.page=1;syncForm();renderCases();persistFilters();return;}
    if(b.dataset.methodLink){browse({method:b.dataset.methodLink});return;}
    if(b.dataset.actor){browse({q:b.dataset.actor});return;}
    if(b.dataset.readerJump){document.getElementById(b.dataset.readerJump)?.scrollIntoView({behavior:'smooth',block:'start'});return;}
    if(b.dataset.dossier){if(activeCase)closeCase();browse({source:b.dataset.dossier});return;}
    if(b.dataset.country){browse({country:b.dataset.country});return;}
    if(b.dataset.period){browse({period:b.dataset.period});return;}
    if(b.dataset.collection){state.collection=b.dataset.collection;resetFilters();return;}
    if(b.hasAttribute('data-clear')){resetFilters();return;}
    if(b.hasAttribute('data-clear-source')){state.source='';state.page=1;renderCases();persistFilters();return;}
    if(b.dataset.copyCase){copyReference(b.dataset.copyCase);return;}
    if(b.hasAttribute('data-print'))window.print();
  });
  $('filters')?.addEventListener('submit',e=>e.preventDefault());
  let searchTimer;for(const k of formKeys)$(k)?.addEventListener(k==='q'?'input':'change',()=>{clearTimeout(searchTimer);const change=()=>{formKeys.forEach(x=>state[x]=$(x).value);state.page=1;renderCases();persistFilters();};if(k==='q')searchTimer=setTimeout(change,140);else change();});
  $('clear-filters')?.addEventListener('click',resetFilters);
  $('prev-page')?.addEventListener('click',()=>{state.page--;renderCases();persistFilters();$('result-count').scrollIntoView({block:'start',behavior:'smooth'});});
  $('next-page')?.addEventListener('click',()=>{state.page++;renderCases();persistFilters();$('result-count').scrollIntoView({block:'start',behavior:'smooth'});});
  $('source-q')?.addEventListener('input',()=>{sourceLimit=8;renderSources();});$('more-sources')?.addEventListener('click',()=>{sourceLimit+=8;renderSources();});
  $('export-json')?.addEventListener('click',exportJSON);$('export-csv')?.addEventListener('click',exportCSV);
  $('close-case')?.addEventListener('click',closeCase);$('case-dialog')?.addEventListener('cancel',e=>{e.preventDefault();closeCase();});
  $('close-document')?.addEventListener('click',()=>$('document-dialog').close());
  $('document-dialog')?.addEventListener('close',()=>{$('pdf-view').innerHTML='';$('page-view').innerHTML='';});
  $('toggle-pages')?.addEventListener('click',()=>{const id=$('toggle-pages').dataset.document,d=DOCS[id];if(!d)return;const images=d.images||[];if(!images.length){announce('Leitura em imagens indisponível neste arquivo. Use o extrato PDF.');return;}const show=$('page-view').hidden;if(show&&!$('page-view').children.length)$('page-view').innerHTML=images.map((img,i)=>`<img src="${img}" loading="lazy" alt="${i===0?'Capa do extrato':`Página original ${d.pages[i-1]}`} de ${esc(bySource.get(id).titulo)}">`).join('');$('page-view').hidden=!show;$('pdf-view').hidden=show;$('toggle-pages').textContent=show?'Voltar ao leitor de PDF':'Ler páginas como imagens';});
  window.addEventListener('popstate',readHash);window.addEventListener('hashchange',readHash);
  renderCases();renderSources();readHash();
  // Interface de inspeção para verificar contagens e filtros sem executar um navegador.
  window.Observatory=Object.freeze({filter:st=>filtered({...state,...st}),getState:()=>({...state}),records:R,sources:S,meta:DATA.meta,csvCell,browse,openCase,sourceMarkup,refreshSources:renderSources});
})();
