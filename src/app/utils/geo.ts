export function toRad(v: number) { return v * Math.PI / 180; }
export function toDeg(v: number) { return v * 180 / Math.PI; }

// Haversine: returns meters
export function haversineDistanceMeters(a:[number,number], b:[number,number]) {
  const R = 6371000;
  const dLat = toRad(b[0] - a[0]);
  const dLon = toRad(b[1] - a[1]);
  const lat1 = toRad(a[0]);
  const lat2 = toRad(b[0]);
  const sa = Math.sin(dLat/2);
  const so = Math.sin(dLon/2);
  const aa = sa*sa + Math.cos(lat1) * Math.cos(lat2) * so*so;
  const cc = 2 * Math.atan2(Math.sqrt(aa), Math.sqrt(1-aa));
  return R * cc;
}

// linear interpolation of lat/lng (simple)
export function interpolateLatLng(lat1:number, lng1:number, lat2:number, lng2:number, n:number) {
  const pts: {lat:number,lng:number}[] = [];
  for (let i=0;i<=n;i++){
    const t = i / n;
    const lat = lat1 + (lat2 - lat1) * t;
    const lng = lng1 + (lng2 - lng1) * t;
    pts.push({lat, lng});
  }
  return pts;
}
