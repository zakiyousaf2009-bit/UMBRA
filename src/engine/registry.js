import { canEncodeFormat } from './adapterRegistry.js'

const categories = {
  Apple: { engine: 'libheif-js + icodec HEVC', implementation: 'native', notes: 'HEIC exports use a bundled x265 HEVC encoder. Output is 8 or 10-bit SDR from browser-decoded pixels; metadata and HDR preservation are not supported.' },
  RAW: { engine: 'LibRaw', implementation: 'limited', notes: 'The LibRaw decoder is not bundled in this build.' },
  Web: { engine: 'Browser APIs', implementation: 'native', notes: 'Availability depends on the browser. Animation currently exports as a single still frame.' },
  'Pro / Design': { engine: 'Specialized codec', implementation: 'limited', notes: 'No decoder for this image or document container is bundled.' },
  Legacy: { engine: 'Format-specific local codecs', implementation: 'limited', notes: 'No decoder for this legacy image container is bundled.' },
  Scientific: { engine: 'Specialized codec', implementation: 'limited', notes: 'Bit depth and color data may be lost by ordinary browser conversion.' },
}

const specs = [
  ['Apple','heic heif hif heics heifs avci avcs hej2','HEIF / HEIC', 'Selected HEVC stills decode locally. HEIC export uses x265 with quality, bit-depth, chroma and effort controls. Metadata is stripped; HDR, depth maps, sequences and AVC/JPEG 2000 brands are not handled.'],
  ['RAW','cr2 cr3 crw nef nrw arw srf sr2 orf rw2 raf pef dng srw 3fr fff iiq erf mrw dcr kdc k25 mef mos rwl x3f cap bay dcs drf mdc raw rdc','Camera RAW','No LibRaw build is shipped. Export a camera JPEG or TIFF first.'],
  ['Web','jpg jpeg jpe jfif png apng gif webp bmp dib ico cur ani avif avifs jxl jng mng qoi farbfeld svg svgz','Web & common', 'JPEG, PNG, WebP, GIF and BMP can be opened by browser APIs. Still-image conversion only.'],
  ['Pro / Design','tif tiff btf psd psb xcf kra ora ai eps pdf exr hdr dpx cin dds ktx ktx2 basis astc pfm pgf jp2 j2k j2c jpf jpx jpm jxr wdp hdp jls jxs mpo xps cgm','Design & professional','No specialist container or document decoder is bundled.'],
  ['Legacy','pcx tga pnm pbm pgm ppm pam ff farbfeld xbm xpm sgi rgb bw sun ras wbmp pict pcd cut pix miff mtv vicar art avs cip dcm fpx flif jng palm pdb pfa pfb sixel viff xwd wpg yuv tim otb uyvy','Legacy & rare','UMBRA supports uncompressed TGA, PBM, PGM, PAM and Farbfeld locally. Other legacy formats need codecs that are not bundled.'],
  ['Scientific','fits dcm cin dpx exr hdr pfm','Scientific & HDR','Scientific metadata, HDR range, and high bit depth are not preserved in the native path.'],
]

const native = new Set(['jpg','jpeg','jpe','jfif','png','gif','webp','bmp','dib'])
const encode = new Set(['jpg','jpeg','png','webp'])
const extended = new Set(['pbm','pgm','pam','ff','farbfeld','tga'])
const heifExtensions = new Set(['heic','heif','hif','heics','heifs'])
const heifSequenceExtensions = new Set(['heics','heifs'])
const decoderAdapters = [
  { id: 'browser-native', canDecode: extension => native.has(extension) },
  { id: 'libheif-js', canDecode: extension => heifExtensions.has(extension) },
  { id: 'portable-raster', canDecode: extension => ['qoi','ppm'].includes(extension) },
  { id: 'umbra-extended-raster', canDecode: extension => extended.has(extension) },
]

export const formatRegistry = [...new Map(specs.flatMap(([category, extensions, family, detail]) => extensions.split(' ').map(extension => {
  const info = categories[category]
  const enabled = decoderAdapters.some(adapter => adapter.id === 'browser-native' && adapter.canDecode(extension))
  const heifDecode = decoderAdapters.some(adapter => adapter.id === 'libheif-js' && adapter.canDecode(extension))
  const portableDecode = decoderAdapters.some(adapter => adapter.id === 'portable-raster' && adapter.canDecode(extension))
  const extendedDecode = decoderAdapters.some(adapter => adapter.id === 'umbra-extended-raster' && adapter.canDecode(extension))
  const canEncode = encode.has(extension) || canEncodeFormat(extension)
  const localDecode = enabled || heifDecode || portableDecode || extendedDecode
  return {
    id: extension,
    extension: `.${extension}`,
    label: `.${extension.toUpperCase()}`,
    badge: extension.slice(0, 5).toUpperCase(),
    category,
    family,
    decoder: heifSequenceExtensions.has(extension) ? 'HEIF WASM (first image)' : heifDecode ? 'HEIF WASM (selected stills)' : portableDecode || extendedDecode ? 'UMBRA local raster' : enabled ? 'Browser native' : 'Not bundled',
    decode: localDecode,
    encode: canEncode,
    implementation: portableDecode || extendedDecode ? 'bundled' : enabled || canEncode ? 'native' : info.implementation,
    capability: heifExtensions.has(extension) ? canEncodeFormat(extension) ? (heifSequenceExtensions.has(extension) ? 'Decode first image + Encode' : 'Decode + Encode (HEVC)') : 'Decode only (limited)' : ['avci','avcs'].includes(extension) ? 'Limited: AVC decoder not bundled' : extension === 'hej2' ? 'Limited: JPEG 2000 decoder not bundled' : (portableDecode || extendedDecode) && canEncode ? 'Decode + Encode' : enabled ? (canEncode ? 'Decode + Encode' : 'Decode only') : 'Limited support',
    alpha: ['png','webp','gif','apng','tiff','tif','heic','heif','hif'].includes(extension),
    animation: ['gif','webp','apng','avifs','mng','ani'].includes(extension),
    hdr: ['heic','heif','hif','avif','avifs','exr','hdr','dpx'].includes(extension),
    lossless: ['png','tiff','tif','qoi','farbfeld','bmp'].includes(extension),
    detail: `${family}: ${detail}`,
    alternative: heifSequenceExtensions.has(extension) ? 'The local decoder exposes contained images, but the converter exports only the primary still.' : ['avci','avcs'].includes(extension) ? 'AVC-in-HEIF requires an AVC decoder; this build contains a HEVC decoder only.' : extension === 'hej2' ? 'JPEG 2000-in-HEIF requires a JPEG 2000 decoder, which is not bundled.' : extendedDecode ? ({tga:'Uncompressed true-color and grayscale TGA are supported. RLE and color-mapped variants are unsupported.',pbm:'Binary PBM images convert locally; transparency is flattened to white.',pgm:'Binary grayscale PGM images convert locally.',pam:'RGB and RGBA PAM images convert locally.',ff:'Farbfeld converts locally; values are mapped to 8-bit RGBA for ordinary formats.'}[extension] || 'This local raster format converts without an external codec.') : portableDecode ? extension === 'qoi' ? 'QOI is decoded and encoded locally as a lossless 8-bit RGBA image.' : 'Binary PPM (P6) is decoded and encoded locally; alpha is composited onto white.' : heifDecode ? info.notes : enabled ? 'Browser-native decode path; encoding is tested separately.' : category==='RAW' ? 'LibRaw is not bundled, so this camera RAW input cannot be decoded.' : category==='Scientific' ? 'A scientific image decoder is not bundled for this format.' : category==='Pro / Design' ? 'A decoder for this design or document container is not bundled.' : category==='Legacy' ? 'A decoder for this legacy image format is not bundled.' : 'No verified decoder is registered for this input format.',
    engine: portableDecode || extendedDecode ? `UMBRA ${extension.toUpperCase()} codec` : info.engine,
  }
})).map(format => [format.id, format])).values()]

export const outputFormats = [
  { id: 'image/jpeg', label: 'JPEG', extension: 'jpg', available: true },
  { id: 'image/png', label: 'PNG', extension: 'png', available: true },
  { id: 'image/webp', label: 'WebP', extension: 'webp', available: true },
  { id: 'image/avif', label: 'AVIF', extension: 'avif', available: false },
  { id: 'image/bmp', label: 'BMP', extension: 'bmp', available: false },
  { id: 'image/x-icon', label: 'ICO', extension: 'ico', available: false },
  { id: 'image/qoi', label: 'QOI', extension: 'qoi', available: false },
  { id: 'image/x-portable-pixmap', label: 'PPM', extension: 'ppm', available: false },
  { id: 'image/x-portable-bitmap', label: 'PBM', extension: 'pbm', available: false },
  { id: 'image/x-portable-graymap', label: 'PGM', extension: 'pgm', available: false },
  { id: 'image/x-portable-arbitrarymap', label: 'PAM', extension: 'pam', available: false },
  { id: 'image/farbfeld', label: 'Farbfeld', extension: 'ff', available: false },
  { id: 'image/x-tga', label: 'TGA', extension: 'tga', available: false },
  { id: 'image/heic', label: 'HEIC', extension: 'heic', category: 'Apple', available: canEncodeFormat('heic') },
  { id: 'image/heif', label: 'HEIF', extension: 'heif', category: 'Apple', available: canEncodeFormat('heif') },
  { id: 'image/hif', label: 'HIF', extension: 'hif', category: 'Apple', available: canEncodeFormat('hif') },
]
