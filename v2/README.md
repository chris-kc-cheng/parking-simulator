# PrecisionPark 3D - Version 2

React / TypeScript / Three.js app imported from AI Studio.

From the repository root, run `npm run setup`, then `npm run dev` to serve
both versions. Use `npm run dev:v2` for Vite hot reload on port 3000.
Run `npm run check:v2` to type-check and `npm run build` to build the whole site.

No API key is required. Unused AI Studio backend and Gemini dependencies were
removed. `vite.config.ts` uses relative assets for deployment under `/v2/`,
including GitHub Pages repository prefixes. Keep framework sources here; the
root build copies only `v2/dist/` to the published site.

Acceleration and reverse do not pitch the car body forward or backward.
