import { CITIES, findCity, cityForZone } from './cities.js';
import { PRAYERS, METHODS, defaultMethod, prayerTimes, nextPrayer } from './prayer.js';
import { solarDay, skyPhase, standardOffsetMinutes } from './solar.js';

const STORE_KEY = 'waktu-solat:v1';
const GEO_KEY = 'waktu-solat:geo';
const THEME_KEY = 'waktu-solat:theme';

const DEFAULTS = {
  location: 'auto',
  h24: false,
  showApparent: true,
  autoSky: true,
  method: 'auto',
  margin: 0,
};

const SKY_COLOR = {
  day: 'rgba(255, 214, 140, 0.5)',
  golden: 'rgba(255, 166, 92, 0.55)',
  civil: 'rgba(255, 132, 110, 0.42)',
  blue: 'rgba(96, 132, 220, 0.42)',
  nautical: 'rgba(72, 96, 190, 0.38)',
  night: 'rgba(64, 85, 180, 0.3)',
};

/* ------------------------------------------------------------------ state */

function load(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key) || 'null') ?? fallback;
  } catch {
    return fallback;
  }
}

let state = { ...DEFAULTS, ...load(STORE_KEY, {}) };
const saveState = () => localStorage.setItem(STORE_KEY, JSON.stringify(state));

/** Where the times are computed for: an explicit city, GPS, or the timezone. */
function resolveLocation() {
  const geo = load(GEO_KEY, null);
  const zoneTz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';

  if (state.location !== 'auto') {
    const city = findCity(state.location);
    if (city) return { ...city, source: 'picked' };
  }
  if (geo && Number.isFinite(geo.lat) && Number.isFinite(geo.lon)) {
    return { name: geo.name || 'Lokasi anda', country: '', lat: geo.lat, lon: geo.lon, tz: zoneTz, source: 'gps' };
  }

  const city = cityForZone(zoneTz);
  if (city) return { ...city, source: 'auto' };

  // Unknown zone: guess the longitude from the standard offset so the times
  // are still roughly right, and say so in the UI.
  const year = new Date().getFullYear();
  const guessLon = (standardOffsetMinutes(zoneTz, year) / 60) * 15;
  return {
    name: zoneTz.split('/').pop().replace(/_/g, ' '),
    country: zoneTz.split('/')[0].replace(/_/g, ' '),
    lat: 25,
    lon: guessLon,
    tz: zoneTz,
    source: 'approx',
  };
}

let place = resolveLocation();
const methodId = () => (state.method === 'auto' ? defaultMethod(place.tz) : state.method);

/* ------------------------------------------------------------- formatting */

const fmtCache = new Map();
function formatter(key, build) {
  let f = fmtCache.get(key);
  if (!f) fmtCache.set(key, (f = build()));
  return f;
}

const timeOf = (ms, tz) =>
  ms == null
    ? '—'
    : formatter(`t|${tz}|${state.h24}`, () =>
        new Intl.DateTimeFormat(undefined, {
          timeZone: tz,
          hour: '2-digit',
          minute: '2-digit',
          hour12: !state.h24,
        })
      ).format(new Date(ms));

const dateLong = (ms, tz) =>
  formatter(`d|${tz}`, () =>
    new Intl.DateTimeFormat(undefined, {
      timeZone: tz,
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    })
  ).format(new Date(ms));

// Apparent solar time, rendered by Intl so it matches the other clocks exactly.
const clockFmt = (mins) => {
  const h = Math.floor(mins / 60) % 24;
  const m = Math.floor(mins % 60);
  return formatter(`s|${state.h24}`, () =>
    new Intl.DateTimeFormat(undefined, {
      timeZone: 'UTC',
      hour: '2-digit',
      minute: '2-digit',
      hour12: !state.h24,
    })
  ).format(new Date(Date.UTC(2000, 0, 1, h, m)));
};

function durationText(ms) {
  const mins = Math.max(0, Math.round(ms / 60000));
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h && m) return `${h}j ${String(m).padStart(2, '0')}m`;
  if (h) return `${h}j`;
  return `${m}m`;
}

function countdownText(ms) {
  const total = Math.max(0, Math.round(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  if (h && m) return `dalam ${h}j ${m}m`;
  if (h) return `dalam ${h}j`;
  return `dalam ${m}m ${String(total % 60).padStart(2, '0')}s`;
}

/* ----------------------------------------------------------------- render */

function renderShell() {
  const tiles = PRAYERS.map(
    (p) => `<li class="tile" data-key="${p.key}">
      <span class="tile__name">${p.label}</span>
      <span class="tile__time">—</span>
      <span class="tile__hint">${p.hint}</span>
    </li>`
  ).join('');

  document.getElementById('solat').innerHTML = `
    <header class="solat__head">
      <div>
        <h2 class="solat__place"></h2>
        <p class="solat__meta" data-meta></p>
      </div>
      <div class="solat__next" data-next></div>
    </header>
    <ol class="solat__list">${tiles}</ol>
    <dl class="solat__solar" data-solar></dl>
    <p class="solat__foot" data-foot></p>
    <p class="solat__tomorrow" data-tomorrow></p>`;

  document.getElementById('localLine').textContent = place.source === 'approx'
    ? `${place.name} · ${place.tz} · koordinat anggaran`
    : `${place.name}${place.country ? `, ${place.country}` : ''} · ${place.tz}`;

  const note = document.getElementById('geoNote');
  note.hidden = place.source !== 'approx';
  note.textContent =
    'Zon waktu ini tiada dalam senarai bandar, jadi koordinat elaunas diteka daripada zon waktu. ' +
    'Pilih bandar dalam Tetapan untuk kiraan yang tepat.';
  cache.clear();
}

const cache = new Map();

function prayerSet(dayMs) {
  const key = `${methodId()}|${state.margin}|${place.tz}|${place.lat}|${Math.round(dayMs / 86400000)}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const data = prayerTimes(place, new Date(dayMs), methodId(), Number(state.margin) || 0);
  cache.set(key, data);
  if (cache.size > 6) cache.delete(cache.keys().next().value);
  return data;
}

function update(now = new Date()) {
  const root = document.getElementById('solat');
  if (!root.firstChild) return;

  const ms = now.getTime();
  const today = prayerSet(ms);
  const tomorrow = prayerSet(ms + 86400000);
  const solar = solarDay(place, now);
  const method = today.method;

  root.querySelector('.solat__place').textContent = place.name;
  root.querySelector('[data-meta]').textContent =
    [method.label, dateLong(ms, place.tz)].filter(Boolean).join(' · ');

  for (const p of PRAYERS) {
    const tile = root.querySelector(`[data-key="${p.key}"]`);
    const at = today.times[p.key];
    tile.querySelector('.tile__time').textContent = timeOf(at, place.tz);
    tile.classList.toggle('tile--void', at == null);
    tile.title = at == null ? 'Waktu ini tidak berlaku di latitud ini' : p.hint;
  }

  const next = nextPrayer(today, ms, tomorrow);
  for (const tile of root.querySelectorAll('.tile')) {
    tile.classList.toggle('tile--next', next != null && !next.tomorrow && tile.dataset.key === next.key);
  }
  root.querySelector('[data-next]').innerHTML = next
    ? `<span class="solat__nextlabel">Seterusnya</span>
       <strong>${next.label}${next.tomorrow ? ' <em>esok</em>' : ''}</strong>
       <span class="solat__nexttime">${timeOf(next.at, place.tz)}</span>
       <span class="solat__count">${countdownText(next.at - ms)}</span>`
    : `<span class="solat__nextlabel">Seterusnya</span><span>—</span>`;

  const solarRows = [
    ['Matahari terbit', solar.sunrise == null ? (solar.polar === 'midnight-sun' ? 'matahari sentiasa' : '—') : timeOf(solar.sunrise, place.tz)],
    ['Tengah hari matahari', timeOf(solar.solarNoon, place.tz)],
    ['Matahari terbenam', solar.sunset == null ? (solar.polar === 'polar-night' ? 'matahari tidak terbit' : '—') : timeOf(solar.sunset, place.tz)],
    [
      'Panjang siang',
      solar.polar === 'midnight-sun' ? '24 jam' : solar.polar === 'polar-night' ? '0 jam' : durationText(solar.dayLengthMs),
    ],
  ];
  if (state.showApparent) {
    solarRows.push(['Masa solar', clockFmt(solar.apparentSolarMinutes)]);
  }
  root.querySelector('[data-solar]').innerHTML = solarRows
    .filter(([, value]) => value !== '')
    .map(([label, value]) => `<div><dt>${label}</dt><dd>${value}</dd></div>`)
    .join('');

  const angles = [
    `Subuh −${method.fajr}°`,
    method.isha != null ? `Isyak −${method.isha}°` : `Isyak Maghrib +${method.ishaAfterMaghrib} min`,
    `Asar ×${method.asr}`,
    `Ihtiyati +${(method.zohorIhtiyati || 0) + Number(state.margin)} min`,
  ].join(' · ');
  root.querySelector('[data-foot]').textContent = angles;

  root.querySelector('[data-tomorrow]').textContent =
    'Esok: ' +
    PRAYERS.filter((p) => p.key !== 'imsak' && tomorrow.times[p.key] != null)
      .map((p) => `${p.label} ${timeOf(tomorrow.times[p.key], place.tz)}`)
      .join(' · ');

  if (state.autoSky) {
    document.body.dataset.sky = skyPhase(solar.altitude);
    document.querySelector('.sky').style.setProperty('--glow', SKY_COLOR[skyPhase(solar.altitude)]);
  } else {
    delete document.body.dataset.sky;
    document.querySelector('.sky').style.setProperty('--glow', 'transparent');
  }
}

/* ---------------------------------------------------------------- settings */

function buildOptions() {
  const loc = document.getElementById('optLocation');
  const zoneTz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  const autoCity = cityForZone(zoneTz);
  loc.innerHTML =
    `<option value="auto">Automatik (${autoCity ? autoCity.name : zoneTz})</option>` +
    [...CITIES]
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((c) => `<option value="${c.name}">${c.name} — ${c.country}</option>`)
      .join('');

  const method = document.getElementById('optMethod');
  method.innerHTML =
    '<option value="auto">Automatik (ikut zon waktu)</option>' +
    Object.entries(METHODS)
      .map(([id, m]) => `<option value="${id}">${m.label}</option>`)
      .join('');
}

function syncControls() {
  document.getElementById('opt24').checked = state.h24;
  document.getElementById('optAuto').checked = state.autoSky;
  document.getElementById('optApparent').checked = state.showApparent;
  document.getElementById('optLocation').value = state.location;
  document.getElementById('optMethod').value = state.method;
  document.getElementById('optMargin').value = String(state.margin);
  document.getElementById('locationHint').textContent =
    state.location === 'auto'
      ? 'Lokasi diambil daripada zon waktu peranti.'
      : `Mengira waktu solat untuk ${state.location}, walaupun peranti berada dalam zon ${Intl.DateTimeFormat().resolvedOptions().timeZone}.`;
}

function bindSettings() {
  const dialog = document.getElementById('settings');
  document.getElementById('settingsBtn').addEventListener('click', () => {
    syncControls();
    dialog.showModal();
  });

  document.getElementById('themeBtn').addEventListener('click', () => {
    const root = document.documentElement;
    const order = ['auto', 'light', 'dark'];
    const next = order[(order.indexOf(root.dataset.theme) + 1) % order.length];
    root.dataset.theme = next;
    localStorage.setItem(THEME_KEY, next);
    toast(`Tema: ${next}`);
  });

  const refresh = () => {
    saveState();
    place = resolveLocation();
    renderShell();
    update();
  };

  document.getElementById('optLocation').addEventListener('change', (e) => {
    state.location = e.target.value;
    refresh();
    syncControls();
  });
  document.getElementById('optMethod').addEventListener('change', (e) => {
    state.method = e.target.value;
    refresh();
  });
  document.getElementById('optMargin').addEventListener('change', (e) => {
    state.margin = Number(e.target.value);
    refresh();
  });
  for (const [id, key] of [['opt24', 'h24'], ['optAuto', 'autoSky'], ['optApparent', 'showApparent']]) {
    document.getElementById(id).addEventListener('change', (e) => {
      state[key] = e.target.checked;
      saveState();
      update();
    });
  }

  document.getElementById('resetBtn').addEventListener('click', () => {
    state = { ...DEFAULTS };
    localStorage.removeItem(GEO_KEY);
    saveState();
    place = resolveLocation();
    buildOptions();
    syncControls();
    renderShell();
    update();
    toast('Tetapan dikembalikan');
  });
}

/* -------------------------------------------------------------- misc chrome */

let toastTimer;
function toast(message) {
  const el = document.getElementById('toast');
  el.textContent = message;
  el.classList.add('is-visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('is-visible'), 2800);
}

function updateOnlineState() {
  const el = document.getElementById('offlineState');
  el.textContent = navigator.onLine ? 'dalam talian' : 'tanpa talian — berjalan dari cache';
}

function bindInstall() {
  const btn = document.getElementById('installBtn');
  let deferred = null;
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferred = e;
    btn.hidden = false;
  });
  btn.addEventListener('click', async () => {
    if (!deferred) return;
    deferred.prompt();
    await deferred.userChoice;
    deferred = null;
    btn.hidden = true;
  });
  window.addEventListener('appinstalled', () => {
    btn.hidden = true;
    toast('Dipasang. Buka terus dari skrin utama.');
  });

  const standalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;
  if (!standalone && !('onbeforeinstallprompt' in window)) {
    btn.hidden = false;
    btn.addEventListener('click', () =>
      toast(
        /iphone|ipad|ipod/i.test(navigator.userAgent)
          ? 'Tekan butang Kongsi, kemudian “Add to Home Screen”.'
          : 'Guna menu pelayar → Pasang aplikasi.'
      )
    );
  }
}

function bindLocation() {
  document.getElementById('locateBtn').addEventListener('click', () => {
    if (!navigator.geolocation) return toast('Lokasi GPS tidak tersedia di sini.');
    toast('Meminta GPS…');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        localStorage.setItem(
          GEO_KEY,
          JSON.stringify({ lat: pos.coords.latitude, lon: pos.coords.longitude, name: 'Lokasi GPS' })
        );
        state.location = 'auto';
        saveState();
        place = resolveLocation();
        syncControls();
        renderShell();
        update();
        toast('Menggunakan koordinat GPS anda.');
      },
      () => toast('Lokasi ditolak — kembali kepada zon waktu.')
    );
  });
}

/* -------------------------------------------------------------------- boot */

let lastSecond = -1;
function loop() {
  const now = Date.now();
  const second = Math.floor(now / 1000);
  if (second !== lastSecond) {
    lastSecond = second;
    update(new Date(now));
  }
  setTimeout(loop, 1000 - (now % 1000) + 10);
}

function boot() {
  document.documentElement.dataset.theme = localStorage.getItem(THEME_KEY) || 'auto';
  buildOptions();
  renderShell();
  update();
  syncControls();
  bindSettings();
  bindInstall();
  bindLocation();
  updateOnlineState();
  window.addEventListener('online', updateOnlineState);
  window.addEventListener('offline', updateOnlineState);
  loop();

  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  }

  // Manifest shortcut: ./\?settings=1 opens straight into the settings sheet.
  if (new URLSearchParams(location.search).get('settings') === '1') {
    document.getElementById('settings').showModal();
  }
}

document.addEventListener('DOMContentLoaded', boot, { once: true });