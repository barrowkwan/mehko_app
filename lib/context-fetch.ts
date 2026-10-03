// Weather (Open-Meteo) and public-holiday (Nager.Date) lookups for an offering's pickup date.

export type WeatherBucket = "clear" | "cloudy" | "rain" | "snow" | "hot" | "cold";

const HOT_C = 30;
const COLD_C = 2;

// Maps WMO weather codes + max temperature to a coarse bucket used by reports.
// Precipitation wins over temperature; temperature extremes win over clear/cloudy.
export function weatherBucket(code: number | null, tempMaxC: number | null): WeatherBucket | null {
  if (code === null && tempMaxC === null) return null;
  if (code !== null) {
    if ((code >= 71 && code <= 77) || code === 85 || code === 86) return "snow";
    if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82) || code >= 95) return "rain";
  }
  if (tempMaxC !== null && tempMaxC >= HOT_C) return "hot";
  if (tempMaxC !== null && tempMaxC <= COLD_C) return "cold";
  if (code !== null && code <= 1) return "clear";
  return "cloudy";
}

export type Weather = {
  bucket: WeatherBucket | null;
  summary: string | null;
  tempMaxC: number | null;
  precipMm: number | null;
};

const DAY_MS = 86_400_000;

export async function fetchWeather(
  lat: number,
  lng: number,
  date: string, // YYYY-MM-DD
  fetchImpl: typeof fetch = fetch,
): Promise<Weather | null> {
  // The forecast API serves ~92 days back and 16 days ahead; older dates use the archive API.
  const ageDays = (Date.now() - new Date(`${date}T00:00:00Z`).getTime()) / DAY_MS;
  const base = ageDays > 80 ? "https://archive-api.open-meteo.com/v1/archive" : "https://api.open-meteo.com/v1/forecast";
  const url =
    `${base}?latitude=${lat}&longitude=${lng}&start_date=${date}&end_date=${date}` +
    `&daily=weather_code,temperature_2m_max,precipitation_sum&timezone=auto`;

  const res = await fetchImpl(url);
  if (!res.ok) return null;
  const json = (await res.json()) as {
    daily?: { weather_code?: (number | null)[]; temperature_2m_max?: (number | null)[]; precipitation_sum?: (number | null)[] };
  };
  const code = json.daily?.weather_code?.[0] ?? null;
  const tempMaxC = json.daily?.temperature_2m_max?.[0] ?? null;
  const precipMm = json.daily?.precipitation_sum?.[0] ?? null;
  const bucket = weatherBucket(code, tempMaxC);
  if (!bucket) return null;
  return {
    bucket,
    summary: `${bucket}${tempMaxC !== null ? `, high ${Math.round(tempMaxC)}°C` : ""}${precipMm ? `, ${precipMm}mm precip` : ""}`,
    tempMaxC,
    precipMm,
  };
}

type Holiday = { date: string; name: string; global: boolean };

// year+country lookups are cached for the duration of one run.
export function createHolidayLookup(fetchImpl: typeof fetch = fetch) {
  const cache = new Map<string, Promise<Holiday[]>>();

  async function load(year: number, country: string): Promise<Holiday[]> {
    const res = await fetchImpl(`https://date.nager.at/api/v3/PublicHolidays/${year}/${country}`);
    if (!res.ok) return [];
    const rows = (await res.json()) as { date: string; name: string; global: boolean }[];
    return rows.map((r) => ({ date: r.date, name: r.name, global: r.global }));
  }

  return async function holidayOn(date: string, country: string): Promise<string | null> {
    const key = `${date.slice(0, 4)}:${country}`;
    if (!cache.has(key)) cache.set(key, load(Number(date.slice(0, 4)), country));
    const holidays = await cache.get(key)!;
    return holidays.find((h) => h.date === date)?.name ?? null;
  };
}
