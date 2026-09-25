export const riskWeights = {
  vpn: 20,
  proxy: 20,
  tor: 35,
  hosting: 0,
  datacenter: 10,
  bot: 15,
  abuse: 30,
  spam: 15,
  blacklist: 25,
  anonymous: 10,
} as const;
export const riskModel =
  'Weighted evidence model v1. Missing signals are not negative findings. Hosting has zero weight to avoid double-counting datacenter. Conflicts use the highest reported severity and remain visible.';
