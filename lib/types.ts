export type NormalizedIpInfo = {
  // 基础信息
  ip_address: string | null;
  country: string | null;
  region: string | null;
  city: string | null;
  coordinates: { lat: number | null; lon: number | null };
  isp: string | null;
  time_zone: string | null;
  local_time: string | null;
  domain: string | null;
  // 网络信息
  net_speed: string | null;
  idd_code: string | null;
  zip_code: string | null;
  usage_type: string | null;
  address_type: string | null;
  asn: string | null;
  as_domain: string | null;
  as_cidr: string | null;
  as_usage_type: string | null;
  // 位置详情
  district: string | null;
  elevation: number | null;
  weather_station: string | null;
  // 安全信息
  fraud_score: number | null;
  is_proxy: boolean | null;
  proxy_type: string | null;
  proxy_asn: string | null;
  proxy_last_seen: string | null;
  proxy_provider: string | null;
  // 移动信息
  mobile_carrier: string | null;
  mobile_country_code: string | null;
  mobile_network_code: string | null;
};