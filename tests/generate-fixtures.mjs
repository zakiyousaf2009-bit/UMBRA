import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import sharp from 'sharp'
import { encodeHeifPixels } from '../src/engine/heifEncoder.js'

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..')
const out=path.join(root,'tests','fixtures')
await fs.mkdir(out,{recursive:true})
const width=24,height=18
function pixels(frame=0,alpha=false){
  const data=new Uint8Array(width*height*4)
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
    const at=(y*width+x)*4
    data[at]=(x*11+frame*80)%256;data[at+1]=(y*14+frame*25)%256;data[at+2]=((x+y)*7)%256;data[at+3]=alpha&&x<width/2?0:255
  }
  return data
}
const rgb=pixels(),rgba=pixels(0,true)
const sharpImage=(data)=>sharp(data,{raw:{width,height,channels:4}})

function write16BitGrayTiff(file){
  const entries=[[256,4,1,width],[257,4,1,height],[258,3,1,16],[259,3,1,1],[262,3,1,1],[273,4,1,134],[277,3,1,1],[278,4,1,height],[279,4,1,width*height*2],[339,3,1,1]]
  const data=Buffer.alloc(134+width*height*2)
  data.write('II',0);data.writeUInt16LE(42,2);data.writeUInt32LE(8,4);data.writeUInt16LE(entries.length,8)
  entries.forEach(([tag,type,count,value],index)=>{const at=10+index*12;data.writeUInt16LE(tag,at);data.writeUInt16LE(type,at+2);data.writeUInt32LE(count,at+4);if(type===3)data.writeUInt16LE(value,at+8);else data.writeUInt32LE(value,at+8)})
  data.writeUInt32LE(0,10+entries.length*12)
  for(let y=0;y<height;y++)for(let x=0;x<width;x++)data.writeUInt16LE(Math.round((x/(width-1))*65535),134+(y*width+x)*2)
  return fs.writeFile(file,data)
}
await Promise.all([
  sharpImage(rgb).jpeg({quality:90}).toFile(path.join(out,'sample.jpg')),
  sharpImage(rgba).png().toFile(path.join(out,'alpha.png')),
  sharpImage(rgb).webp({quality:85}).toFile(path.join(out,'sample.webp')),
  sharpImage(rgb).heif({compression:'av1',quality:65}).toFile(path.join(out,'sample.avif')),
])
await write16BitGrayTiff(path.join(out,'sample-16bit.tiff'))

const frames=Buffer.concat([Buffer.from(pixels(0)),Buffer.from(pixels(1))])
await sharp(frames,{raw:{width,height:height*2,channels:4,pageHeight:height}}).gif({delay:[120,180],loop:0}).toFile(path.join(out,'animated.gif'))
await fs.writeFile(path.join(out,'sample.svg'),'<svg xmlns="http://www.w3.org/2000/svg" width="24" height="18"><rect width="24" height="18" fill="#6633cc"/></svg>')

const glueUrl=pathToFileURL(path.join(root,'public','wasm','heif-encoder','heic-enc.js')).href
const [{default:createEncoder},wasm]=await Promise.all([import(/* @vite-ignore */ glueUrl),fs.readFile(path.join(root,'public','wasm','heif-encoder','heic-enc.wasm'))])
const encoder=await createEncoder({wasmBinary:new Uint8Array(wasm)})
for(const extension of ['heic','hif']){
  const bytes=encodeHeifPixels(encoder,{data:new Uint8ClampedArray(rgb),width,height,depth:8},{extension,quality:88,preset:'ultrafast',chroma:'420'})
  await fs.writeFile(path.join(out,`sample.${extension}`),bytes)
}
console.log('Generated local JPG, alpha PNG, WebP, AVIF, animated GIF, 16-bit TIFF, SVG, HEIC and HIF fixtures.')
