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
  event = { ...data, registrationOpen: data.registrationOpen && /^[a-zA-Z0-9-]+$/.test(data.formId || '') };
  if (event.start) document.querySelector('#event-date').textContent = new Intl.DateTimeFormat('hu-HU', { timeZone: 'Europe/Budapest', year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' }).format(new Date(event.start));
  fields.disabled = !event.registrationOpen;
  document.querySelector('#config-notice').textContent = event.registrationOpen ? '' : 'Találkozunk október 23-án, 18:00-kor. A jelentkezés hamarosan megnyílik.';
}).catch(() => { document.querySelector('#config-notice').textContent = 'Az esemény adatait most nem sikerült betölteni. Frissítsd az oldalt.'; });
const form = document.querySelector('#rsvp-form');
form.elements.attending.addEventListener('change', () => {
  form.elements.whiskey.disabled = form.elements.attending.value === 'no';
  if (form.elements.whiskey.disabled) form.elements.whiskey.checked = false;
});
const calendarDate = date => new Date(date).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
form.addEventListener('submit', async e => {
  e.preventDefault();
  if (form.elements._honey.value) return;
  const payload = { name: form.elements.name.value, email: form.elements.email.value, attending: form.elements.attending.value, whiskey: form.elements.whiskey.checked, notes: form.elements.notes.value, consent: form.elements.consent.checked };
  const status = document.querySelector('#form-status');
  fields.disabled = true;
  status.textContent = 'Visszajelzés küldése…';
  try {
    const emailPayload = { name: payload.name, email: payload.email, 'Részvétel': payload.attending === 'yes' ? 'Igen' : 'Nem', 'Közös whiskey': payload.attending === 'yes' && payload.whiskey ? 'Igen, beszállok' : 'Nem', 'Amit tudnod kell': payload.notes || 'Nincs megjegyzés.', 'Esemény': 'Gents Night — 2026. október 23., 18:00', 'Adatkezelési hozzájárulás': 'Igen', _subject: 'Gents Night — új visszajelzés', _template: 'table', _honey: '' };
    const response = await fetch('https://formsubmit.co/ajax/' + encodeURIComponent(event.formId), { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify(emailPayload), signal: AbortSignal.timeout(25000) });
    const result = await response.json();
    if (!response.ok || ![true, 'true'].includes(result.success)) throw Error('Nem sikerült elküldeni a visszajelzést. Próbáld újra, vagy keresd közvetlenül a szervezőt.');
    form.hidden = true;
    const success = document.querySelector('#success');
    success.hidden = false;
    document.querySelector('#calendar-actions').hidden = payload.attending === 'no';
    if (payload.attending === 'no') document.querySelector('#success-text').textContent = 'Köszönjük, hogy jelezted. Reméljük, legközelebb találkozunk!';
    if (event.start) {
      const params = new URLSearchParams({ action: 'TEMPLATE', text: event.title, dates: `${calendarDate(event.start)}/${calendarDate(event.end || event.start)}`, location: event.location, details: 'Poker, Blackjack és közös whiskey. A befejezési idő még nincs megadva.', ctz: 'Europe/Budapest' });
      document.querySelector('#google-calendar').href = `https://calendar.google.com/calendar/render?${params}`;
    }
    success.focus();
  } catch (error) { status.textContent = error.message || 'Hálózati hiba. Próbáld újra.'; fields.disabled = false; form.elements.whiskey.disabled = form.elements.attending.value === 'no'; }
});
function escapeICS(value) { return value.replace(/\\/g, '\\\\').replace(/\r?\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;'); }
// Fold by UTF-8 octets to remain compatible with Apple Calendar and RFC 5545.
function fold(line) { let result = '', count = 0; for (const char of line) { const length = new TextEncoder().encode(char).length; if (count + length > 75) { result += '\r\n '; count = 1; } result += char; count += length; } return result; }
document.querySelector('#apple-calendar').addEventListener('click', () => {
  if (!event?.start) return;
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Gents Night//Invitation//HU', 'CALSCALE:GREGORIAN', 'BEGIN:VEVENT', `UID:gents-night-${calendarDate(event.start)}@invitation.local`, `DTSTAMP:${calendarDate(new Date())}`, `DTSTART:${calendarDate(event.start)}`, ...(event.end ? [`DTEND:${calendarDate(event.end)}`] : []), `SUMMARY:${escapeICS(event.title)}`, `LOCATION:${escapeICS(event.location)}`, 'DESCRIPTION:Poker és Blackjack. A befejezési idő még nincs megadva.', 'END:VEVENT', 'END:VCALENDAR'];
  const url = URL.createObjectURL(new Blob([lines.map(fold).join('\r\n') + '\r\n'], { type: 'text/calendar;charset=utf-8' }));
  const link = document.createElement('a'); link.href = url; link.download = 'gents-night.ics'; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
});
