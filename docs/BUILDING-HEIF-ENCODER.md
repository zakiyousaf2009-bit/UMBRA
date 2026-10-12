# HEIF encoder build and verification

UMBRA uses the published `@pbk20191/icodec@0.9.3` HEIC encoder instead of a locally compiled fork. Its package contains libheif + x265 for HEVC encode and libheif + libde265 for decode. The HEIC encoder module is `dist/heic-enc.js` plus `dist/heic-enc.wasm`; the WASM is 6,843,358 bytes in this release. The wrapper declares RGBA input, 8/10/12-bit support, quality, lossless, preset, and chroma controls. The package requires WebAssembly SIMD.

## Reproduce the installed encoder

From the repository root, with Node.js and npm installed:

```sh
npm ci
npm ls @pbk20191/icodec
```

The root lockfile pins the exact package version. Confirm the published encoder files and sizes:

```sh
node --input-type=module -e "import { stat } from 'node:fs/promises'; for (const f of ['node_modules/@pbk20191/icodec/dist/heic-enc.js','node_modules/@pbk20191/icodec/dist/heic-enc.wasm']) console.log(f, (await stat(f)).size)"
```

The project build copies the selected HEIC encoder glue and WASM to `public/wasm/heif-encoder/`, includes them in the service-worker precache, and initializes them only from the conversion worker when HEIC/HEIF/HIF output is selected:

```sh
npm run build
npm test
```

The output-brand and pixel round-trip tests use generated RGBA patterns, call the package encoder and decoder, check the ISO BMFF `ftyp` major brand, dimensions and PSNR, and check transparent pixel alpha.

## Rebuild the upstream package from source

The upstream project provides its build setup in its repository. To build a modified or audited encoder, use a Linux environment with Docker or the upstream-required Emscripten toolchain, then follow the exact instructions at [Kaciras/icodec](https://github.com/Kaciras/icodec). Pin its source revision and submodule versions before building. Replace the package only after the HEIC output-brand and round-trip tests pass.

UMBRA does not claim its own reproducible source build of x265. The checked-in application consumes the pinned npm release. Its upstream build reports x265 4.1, libheif 1.21.2 and libde265 1.0.18 in the package's `versions.json`.

## Licensing and deployment

The package wrapper is MIT licensed. The HEIC encoder links x265, which is GPL-2.0; `libheif` is LGPL-3.0 and `libde265` is LGPL-3.0-or-later. Publishing a site that ships the encoder must comply with GPL-2.0 distribution obligations, including applicable notices and source availability. HEVC patent licensing is a separate question and can depend on jurisdiction and use. Review the licenses and patent obligations before deployment.
