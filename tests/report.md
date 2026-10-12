# UMBRA conversion capability report

## Automated checks

The app creates a real 2×2 RGBA fixture and probes JPEG, PNG, WebP, AVIF, BMP and ICO. An output is listed only when it has the expected signature and decodes back to the expected dimensions in the current browser. BMP and ICO use bundled local encoders. AVIF and ICO remain hidden in browsers that cannot decode their result. HEIC, HEIF and HIF use the local x265 encoder; each output is decoded again before download.

The final test run passed: 8 files and 40 tests. Tests include format detector fixtures, image fixture smoke tests, HEVC output checks, and BMP header/pixel-layout checks. The production build succeeds. The complete source-format × target-format matrix has not been run; the table below identifies coverage without claiming untested pairs passed.

## Source × target coverage

| Source | JPEG | PNG | WebP | AVIF | BMP | ICO | HEIC / HEIF / HIF |
|---|---|---|---|---|---|---|---|
| JPEG | Not run | Not run | Not run | Browser dependent | Not run | Not run | HEVC encoder unit coverage |
| PNG with alpha | Not run | Not run | Not run | Browser dependent | Not run | Not run | HEVC encoder unit coverage; alpha is flattened |
| WebP | Not run | Not run | Not run | Browser dependent | Not run | Not run | Not run |
| AVIF | Not run | Not run | Not run | Not run | Not run | Not run | Not run |
| HEIC / HEIF | Not run | Not run | Not run | Browser dependent | Not run | Not run | Output decode validation is in the worker |
| HIF | Not run | Not run | Not run | Browser dependent | Not run | Not run | Decoder fixture and `mif1` encoder brand covered separately |
| GIF (animated) | Not run | Not run | Not run | Browser dependent | Not run | Not run | Not run; browser path exports a still |
| 16-bit TIFF | Not run | Not run | Not run | Not run | Not run | Not run | Not run; no TIFF decoder is bundled |
| BMP | Not run | Not run | Not run | Browser dependent | Not run | Not run | Not run |
| ICO | Not run | Not run | Not run | Browser dependent | Not run | Not run | Not run |
| SVG, PSD, RAW | Not supported | Not supported | Not supported | Not supported | Not supported | Not supported | Not supported |

## Known limits

- Runtime support depends on the browser. The dropdown only shows encoders that pass its output probe, plus HEIF formats whose bundled encoder is verified by unit tests and validated per output.
- The full matrix is untested. The UI does not claim every image format can be converted.
- SVG inputs are rejected to prevent embedded remote references. Animated images currently export as a single still. HEIF sequence conversion uses the primary still.
- There are no bundled RAW, PSD, TIFF, JPEG XL, GIF, or PDF encoders/decoders. Files using unsupported codecs receive an error popup.
- Metadata, GPS, source HDR detail and ICC profiles are not preserved by the pixel pipeline.
