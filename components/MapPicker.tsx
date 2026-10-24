"use client";

import "leaflet/dist/leaflet.css";
import { useEffect } from "react";
import { CircleMarker, MapContainer, TileLayer, Tooltip, useMap, useMapEvents } from "react-leaflet";

export interface MapPoint {
  lat: number;
  lng: number;
  label?: string;
  color?: string;
}

function ClickHandler({ onPick }: { onPick?: (lat: number, lng: number) => void }) {
  useMapEvents({ click: (e) => onPick?.(+e.latlng.lat.toFixed(5), +e.latlng.lng.toFixed(5)) });
  return null;
}

function Recenter({ point }: { point?: MapPoint | null }) {
  const map = useMap();
  useEffect(() => {
    if (point) map.setView([point.lat, point.lng], Math.max(map.getZoom(), 14));
  }, [point, map]);
  return null;
}

export default function MapPicker({
  selected,
  points = [],
  onPick,
  height = 220,
}: {
  selected?: MapPoint | null;
  points?: MapPoint[];
  onPick?: (lat: number, lng: number) => void;
  height?: number;
}) {
  return (
    <MapContainer
      center={[23.03, 72.57]}
      zoom={12}
      scrollWheelZoom={false}
      style={{ height, width: "100%", borderRadius: 12, cursor: onPick ? "crosshair" : undefined }}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <ClickHandler onPick={onPick} />
      <Recenter point={selected} />
      {points.map((p, i) => (
        <CircleMarker
          key={i}
          center={[p.lat, p.lng]}
          radius={6}
          pathOptions={{ color: p.color ?? "#6b6878", fillColor: p.color ?? "#6b6878", fillOpacity: 0.6, weight: 1 }}
        >
          {p.label && <Tooltip>{p.label}</Tooltip>}
        </CircleMarker>
      ))}
      {selected && (
        <CircleMarker
          center={[selected.lat, selected.lng]}
          radius={11}
          pathOptions={{ color: "#e8590c", fillColor: "#e8590c", fillOpacity: 0.85, weight: 3 }}
        >
          <Tooltip permanent direction="top" offset={[0, -10]}>
            {selected.label ?? "Issue location"}
          </Tooltip>
        </CircleMarker>
      )}
    </MapContainer>
  );
}
