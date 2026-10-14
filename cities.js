// City reference data. Coordinates drive the solar calculations; the IANA zone
// picks the calendar day and the displayed times.

export const CITIES = [
  { name: 'Tokyo', country: 'Japan', lat: 35.6762, lon: 139.6503, tz: 'Asia/Tokyo' },
  { name: 'Osaka', country: 'Japan', lat: 34.6937, lon: 135.5023, tz: 'Asia/Tokyo' },
  { name: 'Fukuoka', country: 'Japan', lat: 33.5904, lon: 130.4017, tz: 'Asia/Tokyo' },
  { name: 'Sapporo', country: 'Japan', lat: 43.0618, lon: 141.3545, tz: 'Asia/Tokyo' },
  { name: 'Seoul', country: 'South Korea', lat: 37.5665, lon: 126.978, tz: 'Asia/Seoul' },
  { name: 'Shanghai', country: 'China', lat: 31.2304, lon: 121.4737, tz: 'Asia/Shanghai' },
  { name: 'Hong Kong', country: 'Hong Kong', lat: 22.3193, lon: 114.1694, tz: 'Asia/Hong_Kong' },
  { name: 'Taipei', country: 'Taiwan', lat: 25.033, lon: 121.5654, tz: 'Asia/Taipei' },
  { name: 'Singapore', country: 'Singapore', lat: 1.3521, lon: 103.8198, tz: 'Asia/Singapore' },
  { name: 'Jakarta', country: 'Indonesia', lat: -6.2088, lon: 106.8456, tz: 'Asia/Jakarta' },
  { name: 'Bangkok', country: 'Thailand', lat: 13.7563, lon: 100.5018, tz: 'Asia/Bangkok' },
  { name: 'Manila', country: 'Philippines', lat: 14.5995, lon: 120.9842, tz: 'Asia/Manila' },
  { name: 'Kuala Lumpur', country: 'Malaysia', lat: 3.139, lon: 101.6869, tz: 'Asia/Kuala_Lumpur' },
  { name: 'Hanoi', country: 'Vietnam', lat: 21.0278, lon: 105.8342, tz: 'Asia/Ho_Chi_Minh' },
  { name: 'Mumbai', country: 'India', lat: 19.076, lon: 72.8777, tz: 'Asia/Kolkata' },
  { name: 'New Delhi', country: 'India', lat: 28.6139, lon: 77.209, tz: 'Asia/Kolkata' },
  { name: 'Dubai', country: 'UAE', lat: 25.2048, lon: 55.2708, tz: 'Asia/Dubai' },
  { name: 'Istanbul', country: 'Türkiye', lat: 41.0082, lon: 28.9784, tz: 'Europe/Istanbul' },
  { name: 'Moscow', country: 'Russia', lat: 55.7558, lon: 37.6173, tz: 'Europe/Moscow' },
  { name: 'Cairo', country: 'Egypt', lat: 30.0444, lon: 31.2357, tz: 'Africa/Cairo' },
  { name: 'Nairobi', country: 'Kenya', lat: -1.2921, lon: 36.8219, tz: 'Africa/Nairobi' },
  { name: 'Johannesburg', country: 'South Africa', lat: -26.2041, lon: 28.0473, tz: 'Africa/Johannesburg' },
  { name: 'Lagos', country: 'Nigeria', lat: 6.5244, lon: 3.3792, tz: 'Africa/Lagos' },
  { name: 'London', country: 'United Kingdom', lat: 51.5072, lon: -0.1276, tz: 'Europe/London' },
  { name: 'Dublin', country: 'Ireland', lat: 53.3498, lon: -6.2603, tz: 'Europe/Dublin' },
  { name: 'Lisbon', country: 'Portugal', lat: 38.7223, lon: -9.1393, tz: 'Europe/Lisbon' },
  { name: 'Madrid', country: 'Spain', lat: 40.4168, lon: -3.7038, tz: 'Europe/Madrid' },
  { name: 'Barcelona', country: 'Spain', lat: 41.3874, lon: 2.1686, tz: 'Europe/Madrid' },
  { name: 'Paris', country: 'France', lat: 48.8566, lon: 2.3522, tz: 'Europe/Paris' },
  { name: 'Amsterdam', country: 'Netherlands', lat: 52.3676, lon: 4.9041, tz: 'Europe/Amsterdam' },
  { name: 'Berlin', country: 'Germany', lat: 52.52, lon: 13.405, tz: 'Europe/Berlin' },
  { name: 'Zurich', country: 'Switzerland', lat: 47.3769, lon: 8.5417, tz: 'Europe/Zurich' },
  { name: 'Rome', country: 'Italy', lat: 41.9028, lon: 12.4964, tz: 'Europe/Rome' },
  { name: 'Milan', country: 'Italy', lat: 45.4642, lon: 9.19, tz: 'Europe/Rome' },
  { name: 'Stockholm', country: 'Sweden', lat: 59.3293, lon: 18.0686, tz: 'Europe/Stockholm' },
  { name: 'Oslo', country: 'Norway', lat: 59.9139, lon: 10.7522, tz: 'Europe/Oslo' },
  { name: 'Reykjavík', country: 'Iceland', lat: 64.1466, lon: -21.9426, tz: 'Atlantic/Reykjavik' },
  { name: 'New York', country: 'United States', lat: 40.7128, lon: -74.006, tz: 'America/New_York' },
  { name: 'Toronto', country: 'Canada', lat: 43.6532, lon: -79.3832, tz: 'America/Toronto' },
  { name: 'Chicago', country: 'United States', lat: 41.8781, lon: -87.6298, tz: 'America/Chicago' },
  { name: 'Mexico City', country: 'Mexico', lat: 19.4326, lon: -99.1332, tz: 'America/Mexico_City' },
  { name: 'Denver', country: 'United States', lat: 39.7392, lon: -104.9903, tz: 'America/Denver' },
  { name: 'Los Angeles', country: 'United States', lat: 34.0522, lon: -118.2437, tz: 'America/Los_Angeles' },
  { name: 'Vancouver', country: 'Canada', lat: 49.2827, lon: -123.1207, tz: 'America/Vancouver' },
  { name: 'San Francisco', country: 'United States', lat: 37.7749, lon: -122.4194, tz: 'America/Los_Angeles' },
  { name: 'Seattle', country: 'United States', lat: 47.6062, lon: -122.3321, tz: 'America/Los_Angeles' },
  { name: 'Anchorage', country: 'United States', lat: 61.2181, lon: -149.9003, tz: 'America/Anchorage' },
  { name: 'Honolulu', country: 'United States', lat: 21.3069, lon: -157.8583, tz: 'Pacific/Honolulu' },
  { name: 'Bogotá', country: 'Colombia', lat: 4.711, lon: -74.0721, tz: 'America/Bogota' },
  { name: 'Lima', country: 'Peru', lat: -12.0464, lon: -77.0428, tz: 'America/Lima' },
  { name: 'Santiago', country: 'Chile', lat: -33.4489, lon: -70.6693, tz: 'America/Santiago' },
  { name: 'São Paulo', country: 'Brazil', lat: -23.5505, lon: -46.6333, tz: 'America/Sao_Paulo' },
  { name: 'Buenos Aires', country: 'Argentina', lat: -34.6037, lon: -58.3816, tz: 'America/Argentina/Buenos_Aires' },
  { name: 'Perth', country: 'Australia', lat: -31.9505, lon: 115.8605, tz: 'Australia/Perth' },
  { name: 'Adelaide', country: 'Australia', lat: -34.9285, lon: 138.6007, tz: 'Australia/Adelaide' },
  { name: 'Brisbane', country: 'Australia', lat: -27.4698, lon: 153.0251, tz: 'Australia/Brisbane' },
  { name: 'Sydney', country: 'Australia', lat: -33.8688, lon: 151.2093, tz: 'Australia/Sydney' },
  { name: 'Melbourne', country: 'Australia', lat: -37.8136, lon: 144.9631, tz: 'Australia/Melbourne' },
  { name: 'Auckland', country: 'New Zealand', lat: -36.8485, lon: 174.7633, tz: 'Pacific/Auckland' },
  { name: 'Suva', country: 'Fiji', lat: -18.1416, lon: 178.4419, tz: 'Pacific/Fiji' },
];

export function findCity(name) {
  return CITIES.find((c) => c.name === name);
}

/** Best city match for an IANA zone, if we know one. */
export function cityForZone(tz) {
  const exact = CITIES.find((c) => c.tz === tz);
  if (exact) return exact;
  const region = tz.split('/')[0];
  const pools = {
    Asia: ['Tokyo', 'Singapore', 'Dubai'],
    Europe: ['London', 'Paris', 'Berlin'],
    America: ['New York', 'Chicago', 'Los Angeles'],
    Africa: ['Cairo', 'Nairobi', 'Lagos'],
    Pacific: ['Auckland', 'Suva', 'Honolulu'],
    Australia: ['Sydney', 'Brisbane', 'Perth'],
    Atlantic: ['Reykjavík'],
    Indian: ['Jakarta'],
  };
  const pool = pools[region];
  return pool ? findCity(pool[0]) : null;
}