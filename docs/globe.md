# IP location globe

The overview keeps its centered pixel IP address and adds a small Three.js land-dot
globe beside it on desktop, or below it on mobile. It uses the existing IP response's
latitude and longitude, accepts zero coordinates, and rejects missing, non-finite,
or out-of-range coordinates. A city label alone never creates a location pin.

The initial view faces the current IP location. Dragging and the left/right buttons
rotate the globe; the recenter button restores the IP view. The IP location is an
approximation from the API, not browser GPS.

Three.js loads when the globe approaches the viewport. The scene redraws on
interaction, resizing, or theme changes, with no idle animation loop. Geometry,
materials, textures, controls, observers and the WebGL context are released when
the user leaves the page. Browsers without WebGL retain a static SVG globe and
the same geographic marker.

The land dots are bundled from [Natural Earth's public-domain land data](https://www.naturalearthdata.com/about/terms-of-use/).
No map service receives the IP address or its coordinates. See [the map data notes](../src/data/README.md).

Validation: 3 coordinate tests, 3 globe browser tests, the existing pixel IP browser
test, lint, type checking and the beta build. Browser checks cover recentering,
mobile layout, missing coordinates, a valid `(0, 0)` location, WebGL fallback, and
leaving the page. Screenshot locations use explicitly labeled sample data.
