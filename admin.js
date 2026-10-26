const $ = s => document.querySelector(s);
const KEY_NAME = 'gn-admin-key';
const store = { get() { try { return sessionStorage.getItem(KEY_NAME) || localStorage.getItem(KEY_NAME) || ''; } catch { return ''; } }, set(key, remember) { try { sessionStorage.setItem(KEY_NAME, key); if (remember) localStorage.setItem(KEY_NAME, key); } catch {} }, clear() { try { sessionStorage.removeItem(KEY_NAME); localStorage.removeItem(KEY_NAME); } catch {} } };
let sheetUrl = '', key = '', all = [];
const status = text => { $('#status').textContent = text; };
const configReady = fetch('./event.json', { cache: 'no-store' }).then(r => r.json()).then(d => { sheetUrl = /^https:\/\/script\.google\.com\/macros\/s\/[\w-]+\/exec$/.test(d.sheetUrl || '') ? d.sheetUrl : ''; }).catch(() => {});

async function load() {
  await configReady;
  if (!sheetUrl) { status('A Google Táblázat még nincs bekötve (event.json → sheetUrl). Addig a jelentkezések csak e-mailben érkeznek.'); return false; }
  status('Betöltés…');
  try {
    const res = await fetch(sheetUrl, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ action: 'list', key }), signal: AbortSignal.timeout(30000) });
    const data = await res.json();
    if (!data.ok) { if (data.error === 'unauthorized') { store.clear(); $('#login').hidden = false; $('#results').hidden = true; status('Hibás admin kulcs.'); } else status('Nem sikerült betölteni a jelentkezéseket.'); return false; }
    all = data.responses.map(r => ({ ...r, time: Date.parse(r.createdAt) || 0 })).sort((a, b) => b.time - a.time);
    const seen = new Set();
    for (const r of all) { const id = r.email.trim().toLowerCase() || r.name.trim().toLowerCase(); r.old = seen.has(id); seen.add(id); }
    if (data.sheetUrl) { $('#sheet-link').href = data.sheetUrl; $('#sheet-link').hidden = false; }
    $('#login').hidden = true; $('#results').hidden = false;
    status(all.length ? '' : 'Még nincs jelentkezés.');
    render();
    return true;
  } catch { status('Hálózati hiba — próbáld újra.'); return false; }
}

function render() {
  const latest = all.filter(r => !r.old);
  $('#s-yes').textContent = latest.filter(r => r.attending).length;
  $('#s-no').textContent = latest.filter(r => !r.attending).length;
  $('#s-all').textContent = all.length;
  const q = $('#search').value.trim().toLowerCase(), f = $('#filter').value, history = $('#history').checked;
  const shown = all.filter(r => (history || !r.old)
    && (f === 'all' || (f === 'yes' && r.attending) || (f === 'no' && !r.attending) || (f === 'notes' && r.notes.trim()))
    && (!q || [r.name, r.email, r.notes].some(v => v.toLowerCase().includes(q))));
  const rows = $('#rows'); rows.replaceChildren();
  for (const r of shown) {
    const tr = document.createElement('tr'); if (r.old) tr.className = 'old';
    const cell = (label, content, cls) => { const td = document.createElement('td'); td.dataset.label = label; if (cls) td.className = cls; if (content instanceof Node) td.append(content); else td.textContent = content; tr.append(td); return td; };
    const tag = (text, cls) => { const s = document.createElement('span'); s.className = 'tag ' + cls; s.textContent = text; return s; };
    const name = cell('NÉV', r.name); if (r.old) name.append(tag('KORÁBBI', 'old'));
    cell('E-MAIL', r.email);
    cell('RÉSZVÉTEL', tag(r.attending ? 'JÖN' : 'NEM JÖN', r.attending ? 'yes' : ''));
    cell('MEGJEGYZÉS', r.notes || '—', 'notes');
    cell('BEÉRKEZÉS', r.time ? new Date(r.time).toLocaleString('hu-HU', { timeZone: 'Europe/Budapest', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : r.createdAt, 'when');
    rows.append(tr);
  }
  $('#count').textContent = `${shown.length} sor látható` + (all.some(r => r.old) && !history ? ' · ismételt beküldésnél csak a legfrissebb válasz számít' : '');
}

$('#login').addEventListener('submit', async e => {
  e.preventDefault();
  key = e.target.elements.key.value.trim();
  if (await load()) { store.set(key, e.target.elements.remember.checked); e.target.reset(); }
});
for (const id of ['#search', '#filter', '#history']) $(id).addEventListener('input', render);
$('#refresh').addEventListener('click', load);
$('#logout').addEventListener('click', () => { store.clear(); key = ''; all = []; $('#rows').replaceChildren(); $('#results').hidden = true; $('#login').hidden = false; status('Kiléptél.'); });
$('#export').addEventListener('click', () => {
  const cell = v => { let t = String(v ?? ''); if (/^[\s]*[=+\-@]/.test(t)) t = "'" + t; return '"' + t.replace(/"/g, '""') + '"'; };
  const rows = [['Név', 'E-mail', 'Részt vesz', 'Megjegyzés', 'Beérkezés', 'Legfrissebb válasz'], ...all.map(r => [r.name, r.email, r.attending ? 'Igen' : 'Nem', r.notes, r.time ? new Date(r.time).toLocaleString('hu-HU', { timeZone: 'Europe/Budapest' }) : r.createdAt, r.old ? 'Nem' : 'Igen'])];
  const url = URL.createObjectURL(new Blob(['﻿' + rows.map(row => row.map(cell).join(';')).join('\r\n')], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a'); a.href = url; a.download = 'gents-night-jelentkezesek.csv'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
});
key = store.get();
if (key) load();
