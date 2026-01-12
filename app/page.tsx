"use client";

import * as React from "react";
import { useIpInfo } from "@/lib/hooks/use-ip-info";
import { IpSearch } from "@/components/modules/ip-search";
import { IpOverview } from "@/components/modules/ip-overview";
import { IpDetails } from "@/components/modules/ip-details";
import { IpNetwork } from "@/components/modules/ip-network";
import { IpLocationMap } from "@/components/modules/ip-location-map";
import { isPresent } from "@/lib/utils";

export default function Home() {
  const { 
    query, 
    setQuery, 
    loading, 
    data, 
    ip, 
    nowString, 
    fetchIpInfo 
  } = useIpInfo();

  const coordsPresent = React.useMemo(() => {
    return isPresent(data?.coordinates?.lat) && isPresent(data?.coordinates?.lon);
  }, [data?.coordinates]);

  const coordsLabel = React.useMemo(() => {
    if (!coordsPresent) return "";
    return `${data!.coordinates!.lat}, ${data!.coordinates!.lon}`;
  }, [coordsPresent, data]);

  const mapUrl = React.useMemo(() => {
    if (!coordsPresent) return undefined;
    return `https://www.google.com/maps/search/?api=1&query=${data!.coordinates!.lat},${data!.coordinates!.lon}`;
  }, [coordsPresent, data]);

  return (
    <div className="container mx-auto max-w-7xl p-4 sm:p-6 lg:p-8 space-y-8 pb-20">
      <IpSearch 
        query={query} 
        setQuery={setQuery} 
        onSearch={() => fetchIpInfo(query)} 
        loading={loading} 
      />

      <div className="space-y-6">
        <IpOverview data={data} ip={ip} />

        {coordsPresent && (
          <IpLocationMap data={data} />
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <IpDetails 
            data={data} 
            coordsLabel={coordsLabel} 
            mapUrl={mapUrl} 
            nowString={nowString} 
          />
          <IpNetwork data={data} />
        </div>
      </div>
    </div>
  );
}
