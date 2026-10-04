// Engineering weights, not a calibrated probability of fraud or abuse.
export const purityWeights = { asn: 15, company: 20, anonymity: 30, abuse: 25, neighborhood: 10 } as const;
export const purityModel = 'local-purity-v2';
