"use client";

import dynamic from "next/dynamic";
import * as React from "react";

const IpMapInner = dynamic(() => import("./ip-map-inner"), { ssr: false });

export type IpMapProps = {
  lat?: number | null;
  lon?: number | null;
};

export function IpMap({ lat, lon }: IpMapProps) {
  return <IpMapInner lat={lat} lon={lon} />;
}

export default IpMap;
