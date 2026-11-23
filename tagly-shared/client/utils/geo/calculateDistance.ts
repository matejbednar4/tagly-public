export const calculateDistance = (
  location: { lon: number; lat: number },
  currentLat: number,
  currentLon: number,
  distanceUnit: "KM" | "MI"
): string => {
  const toRad = (value: number) => (value * Math.PI) / 180;

  const R = 6371e3;

  const φ1 = toRad(currentLat);
  const φ2 = toRad(location.lat);
  const Δφ = toRad(location.lat - currentLat);
  const Δλ = toRad(location.lon - currentLon);

  const a =
    Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distanceInMeters = R * c;
  const distanceInKm = distanceInMeters / 1000;

  const value =
    distanceUnit === "KM"
      ? parseFloat(distanceInKm.toFixed(1))
      : parseFloat((distanceInKm * 0.621371).toFixed(1));

  return `${value} ${distanceUnit === "KM" ? "km" : "mi"}`;
};
