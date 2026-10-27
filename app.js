const envelope = document.querySelector('#envelope');
const invitation = document.querySelector('#invitation');
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
function openInvite() {
  if (envelope.classList.contains('open')) { invitation.scrollIntoView({ behavior: reduced ? 'instant' : 'smooth' }); return; }
  envelope.classList.add('open');
  envelope.setAttribute('aria-expanded', 'true');
  document.querySelector('#open-link').textContent = 'A MEGHÍVÓD ↓';
  invitation.hidden = false;
  setTimeout(() => invitation.scrollIntoView({ behavior: reduced ? 'instant' : 'smooth' }), reduced ? 0 : 1000);
}
envelope.addEventListener('click', openInvite);
document.querySelector('#open-link').addEventListener('click', openInvite);
let event;
const fields = document.querySelector('#form-fields');
fields.disabled = true;
fetch('./event.json').then(r => { if (!r.ok) throw Error(); return r.json(); }).then(data => {
  const hasEmail = /^[a-zA-Z0-9-]+$/.test(data.formId || ''), hasSheet = /^https:\/\/script\.google\.com\/macros\/s\/[\w-]+\/exec$/.test(data.sheetUrl || '');
  event = { ...data, hasEmail, hasSheet, registrationOpen: data.registrationOpen && (hasEmail || hasSheet) };
  if (event.start) document.querySelector('#event-date').textContent = new Intl.DateTimeFormat('hu-HU', { timeZone: 'Europe/Budapest', year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' }).format(new Date(event.start));
  fields.disabled = !event.registrationOpen;
  document.querySelector('#config-notice').textContent = event.registrationOpen ? '' : 'Találkozunk november 21-én, 19:00-kor. A jelentkezés hamarosan megnyílik.';
}).catch(() => { document.querySelector('#config-notice').textContent = 'Az esemény adatait most nem sikerült betölteni. Frissítsd az oldalt.'; });
const form = document.querySelector('#rsvp-form');
const calendarDate = date => new Date(date).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
form.addEventListener('submit', async e => {
  e.preventDefault();
  if (form.elements._honey.value) return;
  const payload = { name: form.elements.name.value, email: form.elements.email.value, attending: form.elements.attending.value, whiskey: false, notes: form.elements.notes.value, consent: form.elements.consent.checked };
  const status = document.querySelector('#form-status');
  fields.disabled = true;
  status.textContent = 'Visszajelzés küldése…';
  try {
    const id = crypto.randomUUID ? crypto.randomUUID() : '10000000-1000-4000-8000-100000000000'.replace(/[018]/g, c => (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16));
    const saveToSheet = event.hasSheet ? fetch(event.sheetUrl, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ ...payload, id, _honey: '' }), keepalive: true, signal: AbortSignal.timeout(25000) }).then(r => r.json()).then(r => { if (!r.ok) throw Error(r.error); }) : Promise.reject(Error('no sheet'));
    const emailPayload = { name: payload.name, email: payload.email, 'Részvétel': payload.attending === 'yes' ? 'Igen' : 'Nem', 'Amit tudnod kell': payload.notes || 'Nincs megjegyzés.', 'Esemény': 'Gents II — Winter is coming — 2026. november 21., 19:00', 'Adatkezelési hozzájárulás': 'Igen', _subject: 'Gents II — új visszajelzés', _template: 'table', _honey: '' };
    const sendEmail = event.hasEmail ? fetch('https://formsubmit.co/ajax/' + encodeURIComponent(event.formId), { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify(emailPayload), keepalive: true, signal: AbortSignal.timeout(25000) }).then(async r => { const result = await r.json(); if (!r.ok || ![true, 'true'].includes(result.success)) throw Error('email'); }) : Promise.reject(Error('no email'));
    // Az első sikeres mentésnél azonnal visszajelzünk; a másik kérés a háttérben fut tovább.
    try { await Promise.any([saveToSheet, sendEmail]); } catch { throw Error('Nem sikerült elküldeni a visszajelzést. Próbáld újra, vagy keresd közvetlenül a szervezőt.'); }
    form.hidden = true;
    const success = document.querySelector('#success');
    success.hidden = false;
    document.querySelector('#calendar-actions').hidden = payload.attending === 'no';
    if (payload.attending === 'no') document.querySelector('#success-text').textContent = 'Köszönjük, hogy jelezted. Reméljük, legközelebb találkozunk!';
    if (event.start) {
      const params = new URLSearchParams({ action: 'TEMPLATE', text: event.title, dates: `${calendarDate(event.start)}/${calendarDate(event.end || event.start)}`, location: event.location, details: 'Poker és Blackjack. Dress code: elegáns — öltözz ki! Behajtás: a Bercsényi liget felőli nagykapun.', ctz: 'Europe/Budapest' });
      document.querySelector('#google-calendar').href = `https://calendar.google.com/calendar/render?${params}`;
    }
    success.focus();
  } catch (error) { status.textContent = error.message || 'Hálózati hiba. Próbáld újra.'; fields.disabled = false; }
});
function escapeICS(value) { return value.replace(/\\/g, '\\\\').replace(/\r?\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;'); }
// Fold by UTF-8 octets to remain compatible with Apple Calendar and RFC 5545.
function fold(line) { let result = '', count = 0; for (const char of line) { const length = new TextEncoder().encode(char).length; if (count + length > 75) { result += '\r\n '; count = 1; } result += char; count += length; } return result; }
document.querySelector('#apple-calendar').addEventListener('click', () => {
  if (!event?.start) return;
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Gents Night//Invitation//HU', 'CALSCALE:GREGORIAN', 'BEGIN:VEVENT', `UID:gents-night-${calendarDate(event.start)}@invitation.local`, `DTSTAMP:${calendarDate(new Date())}`, `DTSTART:${calendarDate(event.start)}`, ...(event.end ? [`DTEND:${calendarDate(event.end)}`] : []), `SUMMARY:${escapeICS(event.title)}`, `LOCATION:${escapeICS(event.location)}`, 'DESCRIPTION:Poker és Blackjack. Dress code: elegáns — öltözz ki! Behajtás: a Bercsényi liget felőli nagykapun.', 'END:VEVENT', 'END:VCALENDAR'];
  const url = URL.createObjectURL(new Blob([lines.map(fold).join('\r\n') + '\r\n'], { type: 'text/calendar;charset=utf-8' }));
  const link = document.createElement('a'); link.href = url; link.download = 'gents-night.ics'; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
});
// Téli hangulat: lassan ereszkedő hópihék (csökkentett mozgás beállításnál kikapcsolva).
if (!reduced) {
  const snow = document.createElement('div');
  snow.className = 'snow';
  snow.setAttribute('aria-hidden', 'true');
  const count = innerWidth < 700 ? 26 : 50;
  for (let i = 0; i < count; i++) {
    const flake = document.createElement('span');
    const inner = document.createElement('i');
    flake.className = 'flake';
    inner.textContent = Math.random() < 0.4 ? '❄' : '•';
    const size = 7 + Math.random() * 13;
    flake.style.cssText = `left:${Math.random() * 100}%;font-size:${size.toFixed(1)}px;opacity:${(0.3 + Math.random() * 0.55).toFixed(2)};animation-duration:${(10 + Math.random() * 14).toFixed(1)}s;animation-delay:-${(Math.random() * 24).toFixed(1)}s`;
    inner.style.cssText = `animation-duration:${(3 + Math.random() * 4).toFixed(1)}s;animation-delay:-${(Math.random() * 6).toFixed(1)}s`;
    flake.append(inner);
    snow.append(flake);
  }
  document.body.prepend(snow);
}
