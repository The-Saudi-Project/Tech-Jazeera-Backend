/**
 * Great-circle distance in meters between two lat/lng points (Haversine
 * formula). Used to check whether a self-marked attendance location falls
 * inside the configured office geofence.
 */
export function distanceMeters(lat1, lng1, lat2, lng2) {
  const R = 6_371_000; // Earth's mean radius, meters
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}
