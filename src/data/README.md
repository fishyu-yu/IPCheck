The globe dots in `globe-land.json` are sampled from Natural Earth's public-domain
1:110m land dataset. They describe coastlines for a small decorative globe, not boundaries.

- Source: https://github.com/nvkelso/natural-earth-vector/blob/master/geojson/ne_110m_land.geojson
- Terms: https://www.naturalearthdata.com/about/terms-of-use/
- Refresh: `node scripts/build-globe-map.mjs`

The map is bundled locally. Rendering the globe sends no IP address or coordinates to a map service.
