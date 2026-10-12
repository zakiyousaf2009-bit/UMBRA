import fs from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const publicDir = path.join(root, 'public')
const fontDir = path.join(publicDir, 'fonts')
const heifWasmDir = path.join(publicDir, 'wasm', 'heif-encoder')
await fs.mkdir(fontDir, { recursive: true })
await fs.mkdir(heifWasmDir, { recursive: true })
for (const [packageName, sourceName, targetName] of [
  ['inter','inter-latin-wght-normal.woff2','inter-latin.woff2'],
  ['space-grotesk','space-grotesk-latin-wght-normal.woff2','space-grotesk-latin.woff2'],
  ['jetbrains-mono','jetbrains-mono-latin-wght-normal.woff2','jetbrains-mono-latin.woff2'],
]) {
  await fs.copyFile(path.join(root,'node_modules','@fontsource-variable',packageName,'files',sourceName),path.join(fontDir,targetName))
}
await fs.copyFile(path.join(root, 'node_modules', '@pbk20191', 'icodec', 'dist', 'heic-enc.wasm'), path.join(heifWasmDir, 'heic-enc.wasm'))
await fs.copyFile(path.join(root, 'node_modules', '@pbk20191', 'icodec', 'dist', 'heic-enc.js'), path.join(heifWasmDir, 'heic-enc.js'))
const mark = await fs.readFile(path.join(path.dirname(fileURLToPath(import.meta.url)), 'umbra-symbol.svg'))
const svg = (size, maskable = false) => Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 512 512">${maskable ? '<rect width="512" height="512" fill="#050506"/>' : ''}<g transform="translate(0 0)">${mark.toString().replace('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" fill="none">','').replace('</svg>','')}</g></svg>`)

await fs.writeFile(path.join(publicDir, 'favicon.svg'), svg(512))
for (const [name, size, mask] of [['apple-touch-icon.png',180,false],['pwa-192.png',192,false],['pwa-512.png',512,false],['pwa-maskable-512.png',512,true]]) {
  await sharp(svg(size, mask)).png().toFile(path.join(publicDir, name))
}

const icons = await Promise.all([16,32,48].map(size => sharp(svg(size)).png().toBuffer()))
const header = Buffer.alloc(6 + icons.length * 16)
header.writeUInt16LE(0,0); header.writeUInt16LE(1,2); header.writeUInt16LE(icons.length,4)
let offset = header.length
icons.forEach((png,index) => {
  const size = [16,32,48][index], entry = 6 + index * 16
  header[entry] = size; header[entry+1] = size; header[entry+2] = 0; header[entry+3] = 0
  header.writeUInt16LE(1,entry+4); header.writeUInt16LE(32,entry+6); header.writeUInt32LE(png.length,entry+8); header.writeUInt32LE(offset,entry+12)
  offset += png.length
})
await fs.writeFile(path.join(publicDir, 'favicon.ico'), Buffer.concat([header, ...icons]))

const ogSvg = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630"><defs><radialGradient id="glow"><stop stop-color="#16375d"/><stop offset="1" stop-color="#050506"/></radialGradient></defs><rect width="1200" height="630" fill="#050506"/><ellipse cx="900" cy="280" rx="520" ry="460" fill="url(#glow)" opacity=".66"/><g transform="translate(446 65) scale(.60)">${mark.toString().replace('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" fill="none">','').replace('</svg>','')}</g><text x="600" y="404" text-anchor="middle" fill="#F4F4F6" font-family="Arial,sans-serif" font-size="72" font-weight="700" letter-spacing="19">UMBRA</text><text x="600" y="465" text-anchor="middle" fill="#9A9AA6" font-family="Arial,sans-serif" font-size="25" letter-spacing="1">Convert anything. Leave no trace.</text></svg>`)
await sharp(ogSvg).png().toFile(path.join(publicDir, 'og-image.png'))
