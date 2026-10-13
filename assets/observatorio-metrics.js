(() => {
  'use strict';
  const ENDPOINT = 'https://timeline-guia-contadores.rogeriotpires.chatgpt.site/api/observatorio/metrics';
  const KEY = 'timeline.observatorio.visit.v1';
  const DOWNLOAD_KEY = 'timeline.observatorio.pdf.v1';
  const SESSION = 30 * 60 * 1000;
  const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
  const format = new Intl.NumberFormat('pt-BR');
  const status = document.getElementById('metrics-status');
  const retry = document.getElementById('metrics-retry');
  let visit, lastDownload, loaded = false, started = false, visitsPending = false;
  function read(key) { try { return JSON.parse(localStorage.getItem(key)); } catch { return null; } }
  function write(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* Counting still works without device storage. */ } }
  function uuid() {
    if (crypto.randomUUID) return crypto.randomUUID();
    const b = crypto.getRandomValues(new Uint8Array(16));
    b[6] = (b[6] & 15) | 64; b[8] = (b[8] & 63) | 128;
    const s = [...b].map(v => v.toString(16).padStart(2, '0')).join('');
    return `${s.slice(0,8)}-${s.slice(8,12)}-${s.slice(12,16)}-${s.slice(16,20)}-${s.slice(20)}`;
  }
  function show(data) {
    if (data.scope !== 'observatorio-violencia-politica' || data.test !== false ||
        !['visitas', 'pdf'].every(k => Number.isSafeInteger(data.counts?.[k]) && data.counts[k] >= 0)) throw new Error('Invalid totals');
    for (const k of ['visitas', 'pdf']) { const el = document.getElementById(`counter-${k}`); if (el) el.textContent = format.format(data.counts[k]); }
    if (status) status.textContent = 'Contadores atualizados.'; if (retry) retry.hidden = true; loaded = true;
  }
  function unavailable() {
    if (status) status.textContent = loaded ? 'Exibindo a última contagem recebida. Atualização indisponível no momento.' : 'Contadores temporariamente indisponíveis. O PDF continua disponível.';
    if (retry) retry.hidden = false;
    if (!loaded) for (const k of ['visitas', 'pdf']) { const el = document.getElementById(`counter-${k}`); if (el) el.textContent = 'Indisponível'; }
  }
  async function request(event) {
    const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 5000);
    try {
      const response = await fetch(ENDPOINT, {
        method: event ? 'POST' : 'GET', mode: 'cors', credentials: 'omit', cache: 'no-store',
        signal: controller.signal, keepalive: !!event,
        ...(event ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(event) } : {}),
      });
      if (!response.ok) throw new Error('Unavailable');
      const data = await response.json(); show(data); return data;
    } finally { clearTimeout(timer); }
  }
  async function refreshVisit() {
    if (visitsPending) return;
    visitsPending = true;
    try {
      if (!visit.ack) {
        await request({ id: visit.id, metric: 'visitas' });
        visit.ack = true; write(KEY, visit);
      } else await request();
    } catch { unavailable(); }
    finally { visitsPending = false; }
  }
  function start() {
    if (started || document.visibilityState === 'hidden') return;
    started = true;
    const previous = read(KEY), now = Date.now();
    visit = previous && UUID.test(previous.id) && Number.isFinite(previous.lastSeen) && now >= previous.lastSeen && now - previous.lastSeen < SESSION
      ? previous : { id: uuid(), ack: false };
    visit.lastSeen = now; write(KEY, visit);
    void refreshVisit();
  }
  function trackDownload(e) {
    if (e.type === 'auxclick' && e.button !== 1) return;
    if (!e.target.closest('a[data-dossier-download]')) return;
    const now = Date.now(), previous = lastDownload || read(DOWNLOAD_KEY);
    if (previous && now >= previous.time && now - previous.time < 2000) return;
    lastDownload = { id: uuid(), time: now }; write(DOWNLOAD_KEY, lastDownload);
    // The PDF link is never blocked by the counter or a network failure.
    void request({ id: lastDownload.id, metric: 'pdf' }).catch(unavailable);
  }
  document.addEventListener('click', trackDownload);
  document.addEventListener('auxclick', trackDownload);
  document.addEventListener('visibilitychange', start);
  retry?.addEventListener('click', () => { if (visit) void refreshVisit(); else start(); });
  start();
})();
