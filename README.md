# UMBRA

**Convert anything. Leave no trace.**

UMBRA is a private, offline-first image converter. Images are processed in your browser and are not uploaded. The project is designed and developed by Zaki Yousaf.

**Use UMBRA:** [umbra-convert.vercel.app](https://umbra-convert.vercel.app/) · [GitHub repository](https://github.com/zakiyousaf2009-bit/UMBRA)

## Run locally

Requires Node.js and npm.

```sh
npm ci
npm run dev
```

Other project commands:

```sh
npm test          # Run unit and fixture smoke tests
npm run build     # Build production assets and generate icons
npm run preview   # Serve the production build locally
npm run fixtures  # Regenerate the small checked-in test fixtures
```

The production build injects the strict Content Security Policy. The deployment header files repeat it. The service worker caches the app and bundled codec assets, not selected images or conversion results.

## Conversion support

The output menu is populated from runtime encoder checks. A format appears only when its local encoder passes the available verification for that browser.

- Browser image APIs handle common JPEG, PNG, WebP, GIF, and BMP inputs. Animated files currently export their first frame.
- JPEG, PNG, WebP, BMP, ICO, QOI, PPM, PBM, PGM, PAM, Farbfeld, and uncompressed TGA have local output encoders. Browser support affects formats that use canvas encoders.
- HEIC, HEIF, and HIF output use the bundled x265 HEVC encoder in a worker. The WASM loads on first use and is cached for offline use. Outputs are decoded again before download.
- HEIC, HEIF, and HIF inputs use the bundled libheif decoder for supported HEVC stills. HEIF sequences currently use the primary still.
- TGA support is limited to uncompressed grayscale and true-color variants. SVG, TIFF, PSD, RAW, and other unsupported containers are not presented as working conversions.

Some formats preserve all pixel values. For lossy browser encoders, **Improve quality** raises the requested JPEG, WebP, and AVIF quality to 97%. For HEIC, HEIF, and HIF it requests quality 100 with the slower x265 preset. Lossless formats already retain their pixel data, so the option does not alter them. JPEG output composites transparency against white. The pixel pipeline does not preserve source metadata, GPS, HDR range, or ICC profiles.

## Add a format adapter

Register real decode and encode support in `src/engine/adapterRegistry.js` and `src/engine/registry.js`. Implement the codec, route it through `src/workers/convert.worker.js`, add a signature and round-trip test, and include a fixture when licensing permits. Only expose the output after a real encode and validation pass. Heavy WASM should load lazily and all assets must be bundled locally.

## HEVC licensing

The HEIC encoder wrapper is MIT licensed and links x265, which is GPL-2.0. Publishing a site that ships x265 must comply with GPL-2.0 distribution requirements. libheif and libde265 are LGPL licensed. HEVC patent licensing may apply separately. Review applicable licenses and patent obligations before distributing a build. See [the encoder build notes](docs/BUILDING-HEIF-ENCODER.md).

## Privacy and offline checks

Build and preview the production app, open it once while online, and let its service worker install. Then switch to airplane mode and reload. In DevTools Network, clear the request list and convert a local image. Conversion should not contact an external origin. The app does not write image bytes, filenames, previews, or results to browser storage.

## Repository contents

The checked-in `public/wasm/heif-encoder/` files are required runtime assets and should be included in the repository. `dist/`, `node_modules/`, local environment files, and test outputs are excluded by `.gitignore`.
