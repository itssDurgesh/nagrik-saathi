import type { Ward } from "./types";

/** Great-circle distance in metres. */
export function distanceM(aLat: number, aLng: number, bLat: number, bLng: number) {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Mock ward boundaries: the ward whose centre is closest wins. */
export function nearestWard(wards: Ward[], lat: number, lng: number) {
  let best = wards[0];
  let bestD = Infinity;
  for (const w of wards) {
    const d = distanceM(lat, lng, w.lat, w.lng);
    if (d < bestD) {
      best = w;
      bestD = d;
    }
  }
  return { ward: best, distanceM: Math.round(bestD) };
}

export function findWardByName(wards: Ward[], name: string) {
  const q = name.toLowerCase();
  return wards.find(
    (w) => w.name.toLowerCase().includes(q) || q.includes(w.name.toLowerCase().split(" ")[0]),
  );
}
