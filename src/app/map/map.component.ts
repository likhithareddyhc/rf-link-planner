import { Component, OnInit, OnDestroy } from '@angular/core';
import * as L from 'leaflet';
import { v4 as uuidv4 } from 'uuid';
import { FresnelService } from '../services/fresnel.service';
import { haversineDistanceMeters, interpolateLatLng } from '../utils/geo';

interface Tower { id: string; lat: number; lng: number; frequencyGHz: number; }
interface Link { id: string; aId: string; bId: string; }

@Component({
  selector: 'app-map',
  template: `
    <div class="map-container">
      <div id="map"></div>
      <div class="controls">
        <div>Selected Tower: <strong>{{selectedTowerId || 'none'}}</strong></div>
        <div *ngIf="selectedTowerId">
          <button (click)="clearSelection()">Cancel Selection</button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .map-container { position:relative; height:100%; }
    #map { height:100%; }
    .controls { position:absolute; top:12px; right:12px; background:rgba(255,255,255,0.9); padding:8px; border-radius:6px; z-index:1000; }
    .tower-label { font-size:12px; font-weight:bold; }
  `]
})
export class MapComponent implements OnInit, OnDestroy {
  private map!: L.Map;
  towers: Tower[] = [];
  links: Link[] = [];

  private towerLayers: Map<string, L.CircleMarker> = new Map();
  private linkLayers: Map<string, L.Polyline> = new Map();
  private fresnelLayers: L.LayerGroup = L.layerGroup();

  selectedTowerId: string | null = null;
  selectedLinkId: string | null = null;

  constructor(private fresnel: FresnelService) {}

  ngOnInit(): void { this.initMap(); }
  ngOnDestroy(): void { this.map.remove(); }

  initMap() {
    this.map = L.map('map', { center: [20.5937, 78.9629], zoom: 5 });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: 'OpenStreetMap contributors'
    }).addTo(this.map);

    this.fresnelLayers.addTo(this.map);

    // Map click to add tower
    this.map.on('click', (e: any) => {
      const lat = e.latlng.lat;
      const lng = e.latlng.lng;
      this.addTower(lat, lng);
    });
  }

  addTower(lat: number, lng: number) {
    const id = uuidv4();
    const tower: Tower = { id, lat, lng, frequencyGHz: 5 };
    this.towers.push(tower);
    this.drawTower(tower);
  }

  drawTower(t: Tower) {
    const marker = L.circleMarker([t.lat, t.lng], {
      radius: 10,
      fillColor: '#2b8cff',
      color: '#fff',
      weight: 2,
      fillOpacity: 1
    }).addTo(this.map);

    marker.bindPopup(this.popupHtmlForTower(t));

    marker.on('popupopen', () => {
      const el = document.getElementById('freq-input-' + t.id) as HTMLInputElement | null;
      if (el) el.onchange = () => this.updateTowerFrequency(t.id, Number(el.value));
      const del = document.getElementById('del-btn-' + t.id);
      if (del) del.onclick = () => this.deleteTower(t.id);
    });

    // Prevent map click when tower is clicked
    marker.on('click', (e) => {
      L.DomEvent.stopPropagation(e);

      if (!this.selectedTowerId) {
        this.selectedTowerId = t.id;
        marker.setStyle({ fillColor: '#ffa500' });
      } else if (this.selectedTowerId === t.id) {
        this.clearSelection();
      } else {
        this.tryCreateLink(this.selectedTowerId, t.id);
      }
    });

    this.towerLayers.set(t.id, marker);
  }

  popupHtmlForTower(t: Tower) {
    return `
      <div>
        <div class="tower-label">Tower</div>
        <div>Lat: ${t.lat.toFixed(5)}, Lng: ${t.lng.toFixed(5)}</div>
        <div>Frequency (GHz): <input id="freq-input-${t.id}" type="number" step="0.1" value="${t.frequencyGHz}" style="width:80px"/></div>
        <div><button id="del-btn-${t.id}">Delete</button></div>
      </div>
    `;
  }

  updateTowerFrequency(id: string, freqGHz: number) {
    const t = this.towers.find(x => x.id === id);
    if (!t) return;
    t.frequencyGHz = freqGHz;
  }

  deleteTower(id: string) {
    this.towers = this.towers.filter(t => t.id !== id);
    const layer = this.towerLayers.get(id);
    if (layer) { this.map.removeLayer(layer); this.towerLayers.delete(id); }
    const toRemove = this.links.filter(l => l.aId === id || l.bId === id).map(l => l.id);
    toRemove.forEach(linkId => this.deleteLink(linkId));
    if (this.selectedTowerId === id) this.selectedTowerId = null;
  }

  tryCreateLink(aId: string | null, bId: string) {
    if (!aId) return;
    const a = this.towers.find(t => t.id === aId);
    const b = this.towers.find(t => t.id === bId);
    if (!a || !b) return;
    if (a.frequencyGHz !== b.frequencyGHz) {
      alert('Cannot connect towers with different frequencies.');
      const la = this.towerLayers.get(aId); if (la) la.setStyle({ fillColor: '#2b8cff' });
      this.selectedTowerId = null;
      return;
    }
    const exists = this.links.some(l => (l.aId === aId && l.bId === bId) || (l.aId === bId && l.bId === aId));
    if (exists) { this.clearSelection(); return; }
    const link: Link = { id: uuidv4(), aId: aId, bId: bId };
    this.links.push(link);
    this.drawLink(link);
    this.clearSelection();
  }

  drawLink(l: Link) {
    const a = this.towers.find(t => t.id === l.aId)!;
    const b = this.towers.find(t => t.id === l.bId)!;
    const pl = L.polyline([[a.lat, a.lng], [b.lat, b.lng]], { color: 'blue' }).addTo(this.map);

    // Prevent map click when link is clicked
    pl.on('click', (e) => {
      L.DomEvent.stopPropagation(e);

      if (this.selectedLinkId === l.id) {
        this.clearFresnel();
        this.selectedLinkId = null;
        pl.setStyle({ color: 'blue' });
      } else {
        const prev = this.linkLayers.get(this.selectedLinkId || '');
        if (prev) prev.setStyle({ color: 'blue' });
        this.clearFresnel();
        this.selectedLinkId = l.id;
        pl.setStyle({ color: 'red' });
        this.showFresnelForLink(l);
      }
    });

    pl.bindTooltip(() => {
      const aT = this.towers.find(t => t.id === l.aId)!;
      const bT = this.towers.find(t => t.id === l.bId)!;
      const dist = haversineDistanceMeters([aT.lat, aT.lng], [bT.lat, bT.lng]);
      return `Dist: ${(dist/1000).toFixed(2)} km, Freq: ${aT.frequencyGHz} GHz`;
    }, { sticky: true });

    this.linkLayers.set(l.id, pl);
  }

  deleteLink(id: string) {
    this.links = this.links.filter(l => l.id !== id);
    const layer = this.linkLayers.get(id);
    if (layer) { this.map.removeLayer(layer); this.linkLayers.delete(id); }
    if (this.selectedLinkId === id) { this.clearFresnel(); this.selectedLinkId = null; }
  }

  clearSelection() {
    if (this.selectedTowerId) {
      const marker = this.towerLayers.get(this.selectedTowerId);
      if (marker) marker.setStyle({ fillColor: '#2b8cff' });
    }
    this.selectedTowerId = null;
  }

  /** ---------------------- Fresnel Zone ---------------------- */
  async showFresnelForLink(l: Link) {
    const a = this.towers.find(t => t.id === l.aId)!;
    const b = this.towers.find(t => t.id === l.bId)!;
    const samples = 50;
    const points = interpolateLatLng(a.lat, a.lng, b.lat, b.lng, samples);
    const totalDist = haversineDistanceMeters([a.lat, a.lng], [b.lat, b.lng]);

    this.fresnelLayers.clearLayers();

    const leftPoints: L.LatLngLiteral[] = [];
    const rightPoints: L.LatLngLiteral[] = [];

    for (let i = 0; i < points.length; i++) {
      const pt = points[i];
      const d1 = haversineDistanceMeters([a.lat, a.lng], [pt.lat, pt.lng]);
      const d2 = totalDist - d1;
      const lambda = 3e8 / (a.frequencyGHz * 1e9); // wavelength in meters
      const r = Math.sqrt((lambda * d1 * d2) / (d1 + d2)); // Fresnel radius

      // perpendicular offset
      const next = points[i + 1] || pt;
      const dx = next.lng - pt.lng;
      const dy = next.lat - pt.lat;
      const length = Math.sqrt(dx * dx + dy * dy) || 1;
      const offsetX = -dy / length * (r / 1000); // rough degree offset
      const offsetY = dx / length * (r / 1000);

      leftPoints.push({ lat: pt.lat + offsetY, lng: pt.lng + offsetX });
      rightPoints.unshift({ lat: pt.lat - offsetY, lng: pt.lng - offsetX });
    }

    const polygonPoints = [...leftPoints, ...rightPoints];

    L.polygon(polygonPoints, {
      color: 'red',
      fillColor: 'rgba(255,0,0,0.2)',
      weight: 1,
      interactive: false
    }).addTo(this.fresnelLayers);
  }

  clearFresnel() {
    this.fresnelLayers.clearLayers();
  }
}
