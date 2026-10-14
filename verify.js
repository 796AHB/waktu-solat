// Sanity checks for the solar maths.
// Run: node verify.js
//
// Four independent angles on the same numbers:
//   1. Published almanac times for a handful of cities.
//   2. A second, structurally different sunrise/sunset implementation (the
//      classic NOAA spreadsheet formulas) for cross-checking.
//   3. Invariants: symmetry about solar noon, altitude at the events, DST.
//   4. Prayer rules: angles, ordering, the Asar shadow rule, the safety margin.

import { solarDay, offsetMinutes, zoneParts } from './solar.js';

const fmt = (ms, tz) =>
  ms == null
    ? '—'
    : new Intl.DateTimeFormat('en-GB', {
        timeZone: tz,
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      }).format(new Date(ms));

let failures = 0;
function check(label, actual, expected, tolerance) {
  const a = Number(actual);
  const b = Number(expected);
  const bothNumeric = Number.isFinite(a) && Number.isFinite(b);
  const ok = bothNumeric ? Math.abs(a - b) <= tolerance : String(actual) === String(expected);
  if (!ok) failures++;
  console.log(
    `${ok ? 'PASS' : 'FAIL'}  ${label.padEnd(48)} ${String(actual).padStart(8)} (expected ${expected} ±${tolerance})`
  );
}

const minutes = (text) => {
  const [h, m] = text.split(':').map(Number);
  return h * 60 + m;
};

const PLACES = [
  { name: 'London', lat: 51.5072, lon: -0.1276, tz: 'Europe/London' },
  { name: 'Tokyo', lat: 35.6762, lon: 139.6503, tz: 'Asia/Tokyo' },
  { name: 'New York', lat: 40.7128, lon: -74.006, tz: 'America/New_York' },
  { name: 'Sydney', lat: -33.8688, lon: 151.2093, tz: 'Australia/Sydney' },
  { name: 'Reykjavík', lat: 64.1466, lon: -21.9426, tz: 'Atlantic/Reykjavik' },
  { name: 'Cape Town', lat: -33.9249, lon: 18.4241, tz: 'Africa/Johannesburg' },
];

/* --------------------------------------------- 1. published reference values */

const CASES = [
  { place: PLACES[0], at: '2026-06-21T12:00:00Z', rise: '04:43', set: '21:21' },
  { place: PLACES[0], at: '2026-12-21T12:00:00Z', rise: '08:03', set: '15:53' },
  { place: PLACES[1], at: '2026-06-21T00:00:00Z', rise: '04:25', set: '19:00' },
  { place: PLACES[2], at: '2026-06-21T00:00:00Z', rise: '05:25', set: '20:31' },
  { place: PLACES[3], at: '2026-06-21T00:00:00Z', rise: '07:00', set: '16:54' },
  { place: PLACES[4], at: '2026-12-21T12:00:00Z', rise: '11:22', set: '15:30' },
  { place: PLACES[5], at: '2026-12-21T12:00:00Z', rise: '05:31', set: '19:58' },
];

for (const c of CASES) {
  const solar = solarDay(c.place, new Date(c.at));
  const label = `${c.place.name} ${c.at.slice(0, 10)}`;
  check(`${label} sunrise`, minutes(fmt(solar.sunrise, c.place.tz)), minutes(c.rise), 3);
  check(`${label} sunset`, minutes(fmt(solar.sunset, c.place.tz)), minutes(c.set), 3);
}

/* ------------------------------- 2. cross-check with the NOAA spreadsheet maths */

const RAD = Math.PI / 180;

/**
 * The classic NOAA spreadsheet solar position, written deliberately differently
 * (fractional-year declination, true-solar-time hour angle, scanned and
 * interpolated rather than solved analytically).
 */
function spreadsheetElevation(place, ms) {
  const doy = (ms - Date.UTC(new Date(ms).getUTCFullYear(), 0, 0)) / 86400000;
  const hours = ((ms - Date.UTC(new Date(ms).getUTCFullYear(), 0, 0)) / 3600000) % 24;
  const g = ((2 * Math.PI) / 365) * (doy + hours / 24);
  const eqtime =
    229.18 *
    (0.000075 +
      0.001868 * Math.cos(g) -
      0.032077 * Math.sin(g) -
      0.014615 * Math.cos(2 * g) -
      0.040849 * Math.sin(2 * g));
  const decl =
    0.006918 -
    0.399912 * Math.cos(g) +
    0.070257 * Math.sin(g) -
    0.006758 * Math.cos(2 * g) +
    0.000907 * Math.sin(2 * g) -
    0.002697 * Math.cos(3 * g) +
    0.00148 * Math.sin(3 * g);
  const ha = (((hours * 60 + eqtime + 4 * place.lon) / 4 - 180) * RAD) % (2 * Math.PI);
  const cosZ =
    Math.sin(place.lat * RAD) * Math.sin(decl) +
    Math.cos(place.lat * RAD) * Math.cos(decl) * Math.cos(ha);
  return 90 - Math.acos(Math.max(-1, Math.min(1, cosZ))) / RAD;
}

function spreadsheetEvents(place, isoDay) {
  const year = +isoDay.slice(0, 4);
  const stdOffset = offsetMinutes(place.tz, new Date(`${isoDay}T12:00:00Z`));
  // Start at local 00:00 (approx) and scan forward through the whole day.
  const start = Date.UTC(year, +isoDay.slice(5, 7) - 1, +isoDay.slice(8, 10)) - stdOffset * 60000;
  const step = 5 * 60000;

  // Linear interpolation onto the -0.833° crossing inside the bucket.
  const cross = (t0, a0, t1, a1) => t0 + ((a0 + 0.833) / (a0 - a1)) * (t1 - t0);

  let rise = null;
  let set = null;
  let prevT = start;
  let prevA = spreadsheetElevation(place, start);
  for (let i = 1; i <= (36 * 60) / 5; i++) {
    const t = start + i * step;
    const a = spreadsheetElevation(place, t);
    if (rise === null && prevA < -0.833 && a >= -0.833) rise = cross(prevT, prevA, t, a);
    if (rise !== null && set === null && prevA >= -0.833 && a < -0.833) set = cross(prevT, prevA, t, a);
    prevT = t;
    prevA = a;
    if (rise !== null && set !== null) break;
  }
  return { rise, set };
}

const DAYS = ['2026-01-15', '2026-03-20', '2026-06-21', '2026-09-22', '2026-12-21'];
let crossWorst = 0;
for (const place of PLACES) {
  for (const day of DAYS) {
    const mine = solarDay(place, new Date(`${day}T12:00:00Z`));
    const ref = spreadsheetEvents(place, day);
    if (!mine.sunrise || !ref.rise) continue;
    const dRise = Math.abs(mine.sunrise - ref.rise) / 60000;
    const dSet = Math.abs(mine.sunset - ref.set) / 60000;
    crossWorst = Math.max(crossWorst, dRise, dSet);
  }
}
// The second implementation scans in 5-minute buckets and interpolates, which
// drifts a few minutes at high latitudes where the sun crosses the horizon
// shallowly; 6 minutes is the agreement we expect from that approximation.
check('Worst disagreement vs NOAA spreadsheet (min)', crossWorst.toFixed(2), '0.00', 6.0);

/* ---------------------------------------------------------------- 3. invariants */

for (const place of PLACES) {
  const s = solarDay(place, new Date('2026-04-10T12:00:00Z'));
  // Not exactly zero in reality: declination drifts during the day and the
  // transit formula ignores nutation, so allow a couple of minutes.
  const skew = Math.abs((s.sunrise + s.sunset) / 2 - s.solarNoon) / 60000;
  check(`${place.name}: transit is the midpoint (min)`, skew.toFixed(2), '0.00', 2.0);

  const atRise = solarDay(place, new Date(s.sunrise)).altitude;
  const atSet = solarDay(place, new Date(s.sunset)).altitude;
  check(`${place.name}: altitude at sunrise (deg)`, atRise.toFixed(2), '-0.83', 0.15);
  check(`${place.name}: altitude at sunset (deg)`, atSet.toFixed(2), '-0.83', 0.15);
}

// Arctic behaviour: Tromsø sits inside the Arctic Circle.
const arctic = { name: 'Tromsø', lat: 69.6492, lon: 18.9553, tz: 'Europe/Oslo' };
const polarNight = solarDay(arctic, new Date('2026-12-21T12:00:00Z'));
check('Tromsø polar night flagged', polarNight.polar === 'polar-night' ? 1 : 0, 1, 0);
check('Tromsø no sunrise in December', polarNight.sunrise === null ? 1 : 0, 1, 0);
const midnightSun = solarDay(arctic, new Date('2026-06-21T12:00:00Z'));
check('Tromsø midnight sun in June', midnightSun.polar === 'midnight-sun' ? 1 : 0, 1, 0);
check('Tromsø midnight sun day length (h)', (midnightSun.dayLengthMs / 3600000).toFixed(1), '24.0', 0.1);

/* ------------------------------------------------------------ timezone rules */

check('Tokyo offset (no DST)', offsetMinutes('Asia/Tokyo'), 540, 0);
check('London offset in January', offsetMinutes('Europe/London', new Date('2026-01-15T12:00:00Z')), 0, 0);
check('London offset in July', offsetMinutes('Europe/London', new Date('2026-07-15T12:00:00Z')), 60, 0);
check('New York offset in January', offsetMinutes('America/New_York', new Date('2026-01-15T12:00:00Z')), -300, 0);
check('New York offset in July', offsetMinutes('America/New_York', new Date('2026-07-15T12:00:00Z')), -240, 0);

const jp = zoneParts('Asia/Tokyo', new Date('2026-02-03T15:00:00Z'));
check('Tokyo wall clock rolls to the next day', `${jp.day}-${jp.hour}`, '4-0', 0);

/* ------------------------------------------------- equation of time anchors */

const feb = solarDay(PLACES[0], new Date('2026-02-11T12:00:00Z'));
const nov = solarDay(PLACES[0], new Date('2026-11-03T12:00:00Z'));
check('Equation of time in February (min)', feb.eqTime.toFixed(1), '-14.2', 0.5);
check('Equation of time in November (min)', nov.eqTime.toFixed(1), '16.4', 0.5);

/* ------------------------------------------------------- prayer (solat) times */

import { prayerTimes, asrAltitude, nextPrayer, METHODS, defaultMethod } from './prayer.js';
import { solarAltitude } from './solar.js';

const KL = { name: 'Kuala Lumpur', lat: 3.139, lon: 101.6869, tz: 'Asia/Kuala_Lumpur' };
const JKT = { name: 'Jakarta', lat: -6.2088, lon: 106.8456, tz: 'Asia/Jakarta' };
const TRM = { name: 'Tromsø', lat: 69.6492, lon: 18.9553, tz: 'Europe/Oslo' };

const hhmmOf = (ms, tz) =>
  ms == null
    ? '—'
    : new Intl.DateTimeFormat('en-GB', {
        timeZone: tz,
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      }).format(new Date(ms));

function audit(place, isoDay, methodId) {
  const day = new Date(`${isoDay}T12:00:00Z`);
  const p = prayerTimes(place, day, methodId);
  const { times } = p;
  const m = p.method;

  // Ordering: fast starts before dawn, prayers fall between sunrise and sunset.
  const okOrder =
    times.imsak < times.subuh &&
    times.subuh < p.sunrise &&
    p.sunrise <= times.zohor &&
    times.zohor < times.asar &&
    times.asar < p.sunset &&
    p.sunset <= times.maghrib &&
    times.maghrib < times.isyak;
  check(`${place.name} ${isoDay}: order imsak→isyak`, okOrder ? 1 : 0, 1, 0);

  // Each definition must actually hold at the reported time.
  const alt = (ms) => solarAltitude(place, ms).altitude;
  check(`${place.name}: Subuh altitude (deg)`, alt(times.subuh).toFixed(2), (-m.fajr).toFixed(2), 0.1);
  if (m.isha != null) {
    check(`${place.name}: Isyak altitude (deg)`, alt(times.isyak).toFixed(2), (-m.isha).toFixed(2), 0.1);
  } else {
    const gap = (times.isyak - times.maghrib) / 60000;
    check(`${place.name}: Umm al-Qura Isyak = Maghrib + 90 min`, gap.toFixed(1), '90.0', 0.5);
  }
  check(`${place.name}: Asar altitude (deg)`, alt(times.asar).toFixed(2), p.asrAltitude.toFixed(2), 0.1);

  // Independent reading of the Asr rule: shadow = object + shadow at noon.
  const shadow = (ms) => 1 / Math.tan((alt(ms) * Math.PI) / 180);
  const actualGap = shadow(times.asar) - shadow(p.sunrise + (p.sunset - p.sunrise) / 2);
  check(`${place.name}: Asar shadow = noon + 1 (units)`, actualGap.toFixed(3), '1.000', 0.02);

  return p;
}

audit(KL, '2026-10-14', 'MY');
audit(JKT, '2026-06-21', 'ID');
audit(KL, '2026-12-21', 'SA');

// Published JAKIM style table for Kuala Lumpur, 14 October 2026 (sun times agree
// with our solar module to the minute), so these anchor the rules themselves.
const kl = prayerTimes(KL, new Date('2026-10-14T12:00:00Z'), 'MY');
check('KL Subuh', minutes(hhmmOf(kl.times.subuh, KL.tz)), 5 * 60 + 40, 2);
check('KL Zohor', minutes(hhmmOf(kl.times.zohor, KL.tz)), 13 * 60 + 1, 2);
check('KL Asar', minutes(hhmmOf(kl.times.asar, KL.tz)), 16 * 60 + 15, 3);
check('KL Maghrib', minutes(hhmmOf(kl.times.maghrib, KL.tz)), 19 * 60 + 1, 2);
check('KL Isyak', minutes(hhmmOf(kl.times.isyak, KL.tz)), 20 * 60 + 10, 3);

// The safety margin must push every actionable time later.
const plain = prayerTimes(KL, new Date('2026-10-14T12:00:00Z'), 'MY');
const safe = prayerTimes(KL, new Date('2026-10-14T12:00:00Z'), 'MY', 5);
for (const key of ['zohor', 'maghrib']) {
  check(`Margin shifts ${key} later by 5 min`, (safe.times[key] - plain.times[key]) / 60000, 5, 0);
}
check('Margin keeps Imsak before Subuh', safe.times.imsak < safe.times.subuh ? 1 : 0, 1, 0);

// Walk two days in 45-minute steps, the way the app does: each step uses the
// prayer set of the day it falls in, plus that day's successor.
const setFor = (ms) => prayerTimes(KL, new Date(ms), 'MY');
const nextOf = (ms) => {
  const today = setFor(ms);
  return nextPrayer(today, ms, setFor(ms + 86400000));
};
let now = Date.parse('2026-10-13T20:00:00Z');
let regressions = 0;
for (let i = 0; i < 70; i++) {
  const n = nextOf(now);
  if (!n || n.at < now) regressions++;
  now += 45 * 60000;
}
check('nextPrayer never returns a past time', regressions, 0, 0);
check('nextPrayer rolls over to tomorrow', nextOf(Date.parse('2026-10-14T13:00:00Z')).tomorrow ? 1 : 0, 1, 0);
check('nextPrayer picks Subuh after Isyak', nextOf(Date.parse('2026-10-14T14:00:00Z')).key, 'subuh', 0);

// Midnight sun: Isyak and Subuh simply do not exist that day.
const polar = prayerTimes(TRM, new Date('2026-06-21T12:00:00Z'), 'MY');
check('Tromsø Subuh absent in June', polar.times.subuh === null ? 1 : 0, 1, 0);
check('Tromsø Isyak absent in June', polar.times.isyak === null ? 1 : 0, 1, 0);

check('Method auto for Kuala Lumpur', defaultMethod('Asia/Kuala_Lumpur'), 'MY', 0);
check('Method auto for Jakarta', defaultMethod('Asia/Jakarta'), 'ID', 0);
check('Method auto for Riyadh', defaultMethod('Asia/Riyadh'), 'SA', 0);

check('Asar angle at the equator on the equinox (deg)', asrAltitude(0, 0, 1).toFixed(2), '45.00', 0.05);
check('Hanafi-style factor 2 gives a lower sun', asrAltitude(21, 8, 2) < asrAltitude(21, 8, 1) ? 1 : 0, 1, 0);

console.log(failures ? `\n${failures} check(s) failed.` : '\nAll checks passed.');
process.exit(failures ? 1 : 0);
