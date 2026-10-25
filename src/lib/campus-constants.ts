// AIEM Assagao Campus Centroid (15.5975° N, 73.7943° E - Agnel Institute of Engineering & Management)
export const CAMPUS_CENTER: [number, number] = [15.5975, 73.7943];

// Strict Campus + Immediate Periphery Bounds (prevents panning to world view)
export const CAMPUS_BOUNDS_COORDS: [[number, number], [number, number]] = [
  [15.5890, 73.7880], // South-West
  [15.6010, 73.8020], // North-East
];

export function isWithinCampusBounds(lat: number, lng: number): boolean {
  const [[minLat, minLng], [maxLat, maxLng]] = CAMPUS_BOUNDS_COORDS;
  return lat >= minLat && lat <= maxLat && lng >= minLng && lng <= maxLng;
}
