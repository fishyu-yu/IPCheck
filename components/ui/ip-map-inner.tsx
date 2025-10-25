"use client";

import * as React from "react";
import "leaflet/dist/leaflet.css";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";

// Fix default marker icons in bundlers
L.Icon.Default.mergeOptions({
  iconRetinaUrl: (markerIcon2x as unknown as { src?: string }).src || (markerIcon2x as unknown as string),
  iconUrl: (markerIcon as unknown as { src?: string }).src || (markerIcon as unknown as string),
  shadowUrl: (markerShadow as unknown as { src?: string }).src || (markerShadow as unknown as string),
});

export type IpMapProps = {
  lat?: number | null;
  lon?: number | null;
};

export default function IpMapInner({ lat, lon }: IpMapProps) {
  const hasCoords = typeof lat === "number" && typeof lon === "number";

  if (!hasCoords) {
    return (
      <div className="rounded-xl border bg-card text-card-foreground shadow p-4 text-sm">
        无法获取坐标数据，无法显示地图。
      </div>
    );
  }

  const center: [number, number] = [lat as number, lon as number];

  return (
    <div className="w-full h-[280px] sm:h-[360px] rounded-xl overflow-hidden border">
      <MapContainer center={center} zoom={12} scrollWheelZoom className="w-full h-full">
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
          crossOrigin={true}
        />
        <Marker position={center}>
          <Popup>
            经纬度：{center[0].toFixed(6)}, {center[1].toFixed(6)}
          </Popup>
        </Marker>
      </MapContainer>
    </div>
  );
}
