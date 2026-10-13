(() => {
  'use strict';
  const destinations={"conteudo":"index.html","mapa":"mapa.html","acervo":"casos.html","caso":"casos.html","pesquisa":"casos.html","regimes":"regimes.html","capitulo":"regimes.html","metodos":"metodos.html","documentos":"documentos.html","criterios":"documentos.html","dossie":"pdf.html"};
  function redirectLegacy() {
    const hash=location.hash;
    const key=hash.slice(1).split(/[?=]/)[0];
    const target=destinations[key];
    if(!target||key==='conteudo')return;
    if(key==='caso'&&document.getElementById('case-dialog'))return;
    if(key==='capitulo'&&document.getElementById('history-dialog'))return;
    const current=location.pathname.split('/').pop()||'index.html';
    if(target!==current)location.replace(target+hash);
  }
  function focusSearch(){
    if(location.hash==='#pesquisa')document.getElementById('q')?.focus();
    if(location.hash==='#criterios'&&document.getElementById('criterios'))document.getElementById('criterios').open=true;
  }
  redirectLegacy();focusSearch();
  window.addEventListener('hashchange',()=>{redirectLegacy();focusSearch();});
  const bar=document.querySelector('.nav-inner');
  const active=document.querySelector('.nav-links [aria-current="page"]');
  if(bar&&active)bar.scrollLeft=Math.max(0,active.offsetLeft-bar.clientWidth/2+active.offsetWidth/2);
})();
