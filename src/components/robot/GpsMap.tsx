import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { GpsVehicle } from '../../types';

/** Centro de Neiva, por si todavía no hay ningún vehículo con coordenadas. */
const NEIVA: L.LatLngTuple = [2.9273, -75.2819];

/** Bus chiquito rojo con blanco (estilo Waze) con el número del móvil encima. */
const busIcon = (num: string) =>
  L.divIcon({
    className: 'gps-bus',
    iconSize: [52, 62],
    iconAnchor: [26, 58],
    html: `
      <div style="display:flex;flex-direction:column;align-items:center;filter:drop-shadow(0 2px 3px rgba(0,0,0,.35))">
        <span style="background:#d93025;color:#fff;font:800 12px/1 system-ui,sans-serif;padding:3px 7px;border-radius:9px;border:2px solid #fff;letter-spacing:.5px">${num}</span>
        <svg width="34" height="38" viewBox="0 0 34 38" style="margin-top:2px">
          <rect x="3" y="2" width="28" height="29" rx="6" fill="#d93025" stroke="#fff" stroke-width="2"/>
          <rect x="7" y="6" width="20" height="10" rx="2" fill="#fff"/>
          <rect x="3" y="19" width="28" height="4" fill="#fff"/>
          <circle cx="9.5" cy="26.5" r="1.8" fill="#fff"/>
          <circle cx="24.5" cy="26.5" r="1.8" fill="#fff"/>
          <rect x="6" y="31" width="5" height="5" rx="1.5" fill="#3c4043"/>
          <rect x="23" y="31" width="5" height="5" rx="1.5" fill="#3c4043"/>
        </svg>
      </div>`,
  });

/**
 * Mapa con todos los vehículos. Calles de OpenStreetMap con colores parecidos a Google Maps (CARTO Voyager).
 */
export const GpsMap: React.FC<{ vehicles: GpsVehicle[] }> = ({ vehicles }) => {
  const box = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const layer = useRef<L.LayerGroup | null>(null);
  const fitted = useRef(false);

  useEffect(() => {
    if (!box.current) return;
    const m = L.map(box.current, { zoomControl: true, attributionControl: true }).setView(NEIVA, 13);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
      maxZoom: 19,
      subdomains: 'abcd',
      attribution: '© OpenStreetMap © CARTO',
    }).addTo(m);
    layer.current = L.layerGroup().addTo(m);
    map.current = m;
    // La ventana se abre con animación: recalcular el tamaño cuando ya está visible
    const t = setTimeout(() => m.invalidateSize(), 250);
    return () => { clearTimeout(t); m.remove(); map.current = null; fitted.current = false; };
  }, []);

  useEffect(() => {
    const m = map.current, g = layer.current;
    if (!m || !g) return;
    g.clearLayers();
    const points: L.LatLngTuple[] = [];
    vehicles.forEach(v => {
      if (v.lat == null || v.lng == null) return;
      const num = v.identifier.padStart(3, '0');
      L.marker([v.lat, v.lng], { icon: busIcon(num), title: `Móvil ${num}` })
        .bindPopup(`<b>Móvil ${num}</b><br>${v.pasajeros} pasajeros${v.localizacion ? `<br>${v.localizacion}` : ''}`)
        .addTo(g);
      points.push([v.lat, v.lng]);
    });
    // Encuadrar a los buses solo la primera vez, para no mover el mapa mientras uno lo está mirando
    if (points.length && !fitted.current) {
      fitted.current = true;
      if (points.length === 1) m.setView(points[0], 16);
      else m.fitBounds(L.latLngBounds(points), { padding: [50, 50], maxZoom: 16 });
    }
  }, [vehicles]);

  return <div ref={box} className="w-full h-72 rounded-2xl overflow-hidden border border-line/60 bg-[#e8eaed]" />;
};

export default GpsMap;
