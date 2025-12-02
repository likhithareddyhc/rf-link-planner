import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';

@Injectable({ providedIn: 'root' })
export class FresnelService {
  private c = 3e8;

  constructor(private http: HttpClient) {}

  // Calculate Fresnel radius (meters)
  fresnelRadiusMeters(freqGHz: number, d1: number, d2: number): number {
    const fHz = freqGHz * 1e9;
    const lambda = this.c / fHz;
    if (d1 + d2 === 0) return 0;
    return Math.sqrt((lambda * d1 * d2) / (d1 + d2));
  }

  // Fetch elevations for an array of points [{lat,lng}] using Open-Elevation.
  // Returns an array of elevation numbers (meters). Falls back to zeros on error.
  async fetchElevations(points: {lat:number,lng:number}[]): Promise<number[]> {
    if (!points.length) return [];
    const body = { locations: points.map(p => ({ latitude: p.lat, longitude: p.lng })) };
    const url = 'https://api.open-elevation.com/api/v1/lookup';
    try {
      const res: any = await this.http.post(url, body).toPromise();
      if (res && res.results) {
        return res.results.map((r: any) => r.elevation);
      } else {
        return points.map(() => 0);
      }
    } catch (err) {
      console.warn('Elevation API error, using fallback zeros', err);
      return points.map(() => 0);
    }
  }
}
