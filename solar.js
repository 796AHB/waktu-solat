// Solar position maths and timezone helpers.
// Sunrise and sunset follow the NOAA general solar position algorithm, with a
// generic altitude solver on top so prayer times can reuse the same engine.

const RAD = Math.PI / 180;
const DAY_MS = 86400000;

const norm360 = (d) => ((d % 360) + 360) % 360;
const norm180 = (d) => {
  const x = norm360(d);
  return x > 180 ? x - 360 : x;
};

const formatterCache = new Map();

function partsFormatter(timeZone) {
  let f = formatterCache.get(timeZone);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    formatterCache.set(timeZone, f);
  }
  return f;
}

/** Wall-clock fields for `timeZone` at a given instant. */
export function zoneParts(timeZone, date = new Date()) {
  const out = {};
  for (const p of partsFormatter(timeZone).formatToParts(date)) {
    if (p.type !== 'literal') out[p.type] = p.value;
  }
  return {
    timeZone,
    year: +out.year,
    month: +out.month,
    day: +out.day,
    hour: +out.hour % 24,
    minute: +out.minute,
    second: +out.second,
  };
}

/** Minutes east of UTC in `timeZone` at a given instant (DST aware). */
export function offsetMinutes(timeZone, date = new Date()) {
  const p = zoneParts(timeZone, date);
  const asUTC = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return Math.round((asUTC - Math.floor(date.getTime() / 1000) * 1000) / 60000);
}

/** Offset at the start of the year, used to guess a zone's longitude. */
export function standardOffsetMinutes(timeZone, year) {
  const jan = new Date(Date.UTC(year, 0, 4, 12));
  const jul = new Date(Date.UTC(year, 6, 4, 12));
  return Math.min(offsetMinutes(timeZone, jan), offsetMinutes(timeZone, jul));
}

function sunGeometry(jd, latDeg, lonDeg) {
  const n = jd - 2451545.0 + 0.0008;
  const T = n / 36525;
  const L = norm360(280.46646 + T * (36000.76983 + T * 0.0003032));
  const g = (357.52911 + T * (35999.05029 - 0.0001537 * T)) * RAD;
  const lambda = (L + 1.914602 * Math.sin(g) + 0.019993 * Math.sin(2 * g) + 0.000289 * Math.sin(3 * g)) * RAD;
  const eps = (23.439291 - 0.0130042 * T) * RAD;

  const dec = Math.asin(Math.sin(eps) * Math.sin(lambda));
  const ra = Math.atan2(Math.cos(eps) * Math.sin(lambda), Math.cos(lambda)) / RAD;

  const gmst = (18.697374558 + 24.06570982441908 * n) % 24;
  const lst = (gmst * 15 + lonDeg) / 15; // sidereal-ish hours

  return { dec, ra, lst };
}

/** Hour angle in degrees (-180..180) of `lonDeg` at UTC instant `ms`. */
function hourAngleAt(ms, latDeg, lonDeg) {
  const jd = ms / DAY_MS + 2440587.5;
  const { ra, lst } = sunGeometry(jd, latDeg, lonDeg);
  return norm180((lst * 15) - ra);
}

/** Sun altitude and azimuth in degrees at an instant, for a place. */
export function solarAltitude({ lat, lon }, ms) {
  return altitudeAt(ms, lat, lon);
}

function altitudeAt(ms, latDeg, lonDeg) {
  const jd = ms / DAY_MS + 2440587.5;
  const { dec } = sunGeometry(jd, latDeg, lonDeg);
  const H = hourAngleAt(ms, latDeg, lonDeg) * RAD;
  const lat = latDeg * RAD;
  const sinAlt = clamp1(
    Math.sin(lat) * Math.sin(dec) + Math.cos(lat) * Math.cos(dec) * Math.cos(H)
  );
  const altitude = Math.asin(sinAlt);
  // Azimuth measured clockwise from north.
  const az = Math.atan2(
    -Math.sin(H) * Math.cos(dec),
    Math.cos(lat) * Math.sin(dec) - Math.sin(lat) * Math.cos(dec) * Math.cos(H)
  ) / RAD;
  return { altitude: altitude / RAD, azimuth: norm360(az) };
}

const clamp1 = (v) => (v > 1 ? 1 : v < -1 ? -1 : v);

// Sunrise/sunset use a horizon depressed by refraction and the solar radius.
const HORIZON = 0.833;

/** Sun declination in degrees at an instant, for a place. */
export function declinationAt(place, ms) {
  return sunGeometry(ms / DAY_MS + 2440587.5, place.lat, place.lon).dec / RAD;
}

/**
 * Instant near `guessMs` at which the sun crosses `altitudeDeg`.
 * The hour angle sweeps 15° per hour, so a couple of Newton steps converge.
 * Returns null when the sun never reaches that altitude on that day — which is
 * how prayer times behave inside the polar circles in summer or winter.
 */
export function altitudeCrossing({ lat, lon }, guessMs, altitudeDeg, rising) {
  const sinTarget = Math.sin(altitudeDeg * RAD);
  const latR = lat * RAD;
  const sinLat = Math.sin(latR);
  const cosLat = Math.cos(latR);
  let t = guessMs;

  for (let i = 0; i < 3; i++) {
    const dec = sunGeometry(t / DAY_MS + 2440587.5, lat, lon).dec;
    const cosH = (sinTarget - sinLat * Math.sin(dec)) / (cosLat * Math.cos(dec));
    if (cosH < -1 || cosH > 1) return null;
    const target = rising ? -Math.acos(cosH) / RAD : Math.acos(cosH) / RAD;
    t += ((target - hourAngleAt(t, lat, lon)) / 15) * 3600000;
  }
  return t;
}

/**
 * Full solar picture for one calendar day at a place.
 * `day` is the calendar date as seen in that place's timezone.
 */
export function solarDay(place, date = new Date()) {
  const { lat, lon, tz } = place;
  const p = zoneParts(tz, date);
  const midnightUtc = Date.UTC(p.year, p.month - 1, p.day);
  const stdOffset = standardOffsetMinutes(tz, p.year);

  // Meridian transit: NOAA's solar-noon formula (minutes UTC). Anchor it to the
  // local calendar date, then snap to whichever UTC day is nearest local noon.
  const localStdNoonUtc = Date.UTC(p.year, p.month - 1, p.day, 12) - stdOffset * 60000;
  let solarNoon =
    midnightUtc +
    (720 - 4 * lon - eqTimeMinutes(localStdNoonUtc)) * 60000;
  if (Math.abs(solarNoon - localStdNoonUtc) > 12 * 3600000) solarNoon += DAY_MS;

  const noonAltitude = altitudeAt(solarNoon, lat, lon).altitude;
  const sunrise = altitudeCrossing(place, solarNoon, -HORIZON, true);
  const sunset = altitudeCrossing(place, solarNoon, -HORIZON, false);
  const polar = sunrise == null ? (noonAltitude > -HORIZON ? 'midnight-sun' : 'polar-night') : 'none';

  const now = date.getTime();
  const nowAlt = altitudeAt(now, lat, lon);
  const eqTime = eqTimeMinutes(now);

  // Apparent solar time: local clock, corrected for the standard meridian and
  // for the equation of time.
  const offsetMin = offsetMinutes(tz, date);
  const localMinutes = ((now / 60000 + offsetMin) % 1440 + 1440) % 1440;
  const apparentSolar = localMinutes - stdOffset + lon * 4 + eqTime;

  return {
    sunrise,
    sunset,
    solarNoon,
    polar,
    dayLengthMs: sunrise && sunset ? sunset - sunrise : polar === 'midnight-sun' ? DAY_MS : 0,
    altitude: nowAlt.altitude,
    azimuth: nowAlt.azimuth,
    noonAltitude,
    apparentSolarMinutes: ((apparentSolar % 1440) + 1440) % 1440,
    eqTime,
  };
}

/** Equation of time in minutes (apparent minus mean solar time). */
function eqTimeMinutes(ms) {
  const jd = ms / DAY_MS + 2440587.5;
  const n = jd - 2451545.0 + 0.0008;
  const T = n / 36525;
  const L = norm360(280.46646 + T * (36000.76983 + T * 0.0003032));
  const g = (357.52911 + T * (35999.05029 - 0.0001537 * T)) * RAD;
  const eps = (23.439291 - 0.0130042 * T) * RAD;
  const e = 0.016708634 - 0.000042037 / 36525;
  const y = Math.tan(eps / 2) ** 2;
  const series =
    y * Math.sin(2 * L * RAD) -
    2 * e * Math.sin(g) +
    4 * e * y * Math.sin(g) * Math.cos(2 * L * RAD) -
    0.5 * y * y * Math.sin(4 * L * RAD) -
    1.25 * e * e * Math.sin(2 * g);
  return 4 * (series / RAD);
}

/** Coarse sky-colour bucket from solar altitude. */
export function skyPhase(altitude) {
  if (altitude >= 15) return 'day';
  if (altitude >= 6) return 'golden';
  if (altitude >= 0.5) return 'civil';
  if (altitude >= -6) return 'blue';
  if (altitude >= -12) return 'nautical';
  return 'night';
}
