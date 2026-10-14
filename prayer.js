// Prayer (solat) times derived from the same solar position maths.
//
// Every method is a set of depression angles plus an Asr shadow rule:
//   Subuh  — sun `fajr` degrees below the horizon, rising
//   Zohor  — meridian transit (+ ihtiyati)
//   Asar   — shadow of an object equals its own height plus the noon shadow
//   Maghrib— sunset (+ ihtiyati)
//   Isyak  — sun `isha` degrees below the horizon, setting

import { altitudeCrossing, declinationAt, solarDay } from './solar.js';

export const PRAYERS = [
  { key: 'imsak', label: 'Imsak', hint: 'permulaan puasa' },
  { key: 'subuh', label: 'Subuh', hint: 'fajar' },
  { key: 'zohor', label: 'Zohor', hint: 'tengah hari' },
  { key: 'asar', label: 'Asar', hint: 'petang' },
  { key: 'maghrib', label: 'Maghrib', hint: 'senja hari' },
  { key: 'isyak', label: 'Isyak', hint: 'malam' },
];

export const METHODS = {
  MY: {
    label: 'JAKIM (Malaysia)',
    fajr: 20,
    isha: 18,
    asr: 1,
    zohorIhtiyati: 2,
    maghribIhtiyati: 2,
  },
  ID: {
    label: 'Kemenag (Indonesia)',
    fajr: 20,
    isha: 18,
    asr: 1,
    zohorIhtiyati: 2,
    maghribIhtiyati: 2,
  },
  SA: {
    label: 'Umm al-Qura (Saudi)',
    fajr: 18.5,
    ishaAfterMaghrib: 90,
    asr: 1,
    zohorIhtiyati: 0,
    maghribIhtiyati: 0,
  },
  EG: {
    label: 'Egypt / Gulf',
    fajr: 19.5,
    isha: 17.5,
    asr: 1,
    zohorIhtiyati: 0,
    maghribIhtiyati: 0,
  },
  PK: {
    label: 'Karachi (South Asia)',
    fajr: 18,
    isha: 18,
    asr: 1,
    zohorIhtiyati: 2,
    maghribIhtiyati: 2,
  },
  TR: {
    label: 'Diyanet (Türkiye)',
    fajr: 18,
    isha: 17,
    asr: 1,
    zohorIhtiyati: 0,
    maghribIhtiyati: 2,
  },
};

/** Pick the conventional method for a timezone. */
export function defaultMethod(tz = '') {
  if (tz.startsWith('Asia/Jakarta') || tz.startsWith('Asia/Makassar') || tz.startsWith('Asia/Jayapura')) {
    return 'ID';
  }
  if (tz.startsWith('Asia/Riyadh') || tz.startsWith('Asia/Qatar') || tz.startsWith('Asia/Baghdad')) {
    return 'SA';
  }
  if (tz.startsWith('Africa/Cairo')) return 'EG';
  if (tz.startsWith('Asia/Karachi') || tz.startsWith('Asia/Dhaka') || tz.startsWith('Asia/Kolkata')) return 'PK';
  if (tz.startsWith('Europe/Istanbul')) return 'TR';
  return 'MY';
}

const RAD = Math.PI / 180;
const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

/** Sun altitude at which the Asr shadow rule is satisfied. */
export function asrAltitude(lat, dec, factor = 1) {
  const delta = Math.abs(lat - dec);
  if (delta >= 89.9) return 0.1;
  return Math.atan(1 / (Math.tan(delta * RAD) + factor)) / RAD;
}

/**
 * Prayer times for the calendar day of `date` as seen in `place.tz`.
 * Times that never occur (polar summer/winter) come back as null.
 * `margin` is an extra safety margin in minutes, applied to the four times
 * where people actually act on them.
 */
export function prayerTimes(place, date = new Date(), methodId = 'MY', margin = 0) {
  const method = METHODS[methodId] || METHODS.MY;
  const solar = solarDay(place, date);
  const noon = solar.solarNoon;

  const asrAlt = asrAltitude(place.lat, declinationAt(place, noon), method.asr);

  const subuh = altitudeCrossing(place, noon, -method.fajr, true);
  const imsak = shift(subuh, -IMSAK_GAP - margin);
  const zohor = shift(noon, (method.zohorIhtiyati || 0) + margin);
  const asar = altitudeCrossing(place, noon, asrAlt, false);
  const maghrib = shift(solar.sunset, (method.maghribIhtiyati || 0) + margin);
  const isyak =
    method.ishaAfterMaghrib != null
      ? shift(solar.sunset, method.ishaAfterMaghrib)
      : altitudeCrossing(place, noon, -method.isha, false);

  return {
    method,
    asrAltitude: asrAlt,
    times: { imsak, subuh, zohor, asar, maghrib, isyak },
    sunrise: solar.sunrise,
    sunset: solar.sunset,
  };
}

const IMSAK_GAP = 10; // minutes before Subuh, the usual Malaysian table convention

function shift(ms, minutes) {
  return ms == null ? null : ms + minutes * 60000;
}

/**
 * The next prayer at or after `now`. Pass tomorrow's set so that the rollover
 * uses real tomorrow's times rather than today's shifted by 24 hours.
 */
export function nextPrayer(prayers, now = Date.now(), tomorrow = null) {
  const ordered = PRAYERS.filter((p) => p.key !== 'imsak' && prayers.times[p.key] != null);
  for (const p of ordered) {
    if (prayers.times[p.key] >= now) return { ...p, at: prayers.times[p.key], tomorrow: false };
  }
  const first = ordered[0];
  if (!first) return null;
  const at = tomorrow ? tomorrow.times[first.key] : prayers.times[first.key] + 86400000;
  if (at < now) return null;
  return { ...first, at, tomorrow: true };
}

/** Percentage of the way through the current prayer interval. */
export function periodProgress(prayers, now = Date.now()) {
  const points = PRAYERS.filter((p) => p.key !== 'imsak')
    .map((p) => prayers.times[p.key])
    .filter((t) => t != null);
  for (let i = 1; i < points.length; i++) {
    if (now >= points[i - 1] && now < points[i]) {
      return { from: i - 1, to: i, fraction: clamp((now - points[i - 1]) / (points[i] - points[i - 1]), 0, 1) };
    }
  }
  return null;
}