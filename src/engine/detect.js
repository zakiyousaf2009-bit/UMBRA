const signatures=[
  {mime:'image/png',ext:'png',test:b=>b[0]===137&&b[1]===80&&b[2]===78&&b[3]===71},
  {mime:'image/jpeg',ext:'jpg',test:b=>b[0]===255&&b[1]===216&&b[2]===255},
  {mime:'image/gif',ext:'gif',test:b=>b[0]===71&&b[1]===73&&b[2]===70},
  {mime:'image/webp',ext:'webp',test:b=>String.fromCharCode(...b.slice(0,4))==='RIFF'&&String.fromCharCode(...b.slice(8,12))==='WEBP'},
  {mime:'image/bmp',ext:'bmp',test:b=>b[0]===66&&b[1]===77},
  {mime:'image/qoi',ext:'qoi',test:b=>String.fromCharCode(...b.slice(0,4))==='qoif'},
  {mime:'image/x-portable-bitmap',ext:'pbm',test:b=>b[0]===0x50&&b[1]===0x34},
  {mime:'image/x-portable-graymap',ext:'pgm',test:b=>b[0]===0x50&&b[1]===0x35},
  {mime:'image/x-portable-pixmap',ext:'ppm',test:b=>b[0]===0x50&&b[1]===0x36},
  {mime:'image/x-portable-arbitrarymap',ext:'pam',test:b=>b[0]===0x50&&b[1]===0x37},
  {mime:'image/farbfeld',ext:'ff',test:b=>String.fromCharCode(...b.slice(0,8))==='farbfeld'},
]
const brands = new Set(['heic','heix','hevc','hevx','heim','heis','hevm','hevs','mif1','msf1','avif','avis','jpeg','j2k1','avci','avcs','hej2'])
const readAscii=(bytes,start,end)=>String.fromCharCode(...bytes.slice(start,end))

export function detectBytes(bytes) {
  const match=signatures.find(signature=>signature.test(bytes))
  if(match)return {...match,format:match.ext,container:'image'}
  if(readAscii(bytes,4,8)==='ftyp') {
    const boxSize=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength).getUint32(0)
    const end=Math.min(bytes.length,Math.max(16,Math.min(boxSize,bytes.length)))
    const found=[]
    for(let offset=8;offset+4<=end;offset+=4){const brand=readAscii(bytes,offset,offset+4);if(brands.has(brand)&&!found.includes(brand))found.push(brand)}
    const avif=found.some(brand=>brand==='avif'||brand==='avis')
    return {mime:avif?'image/avif':'image/heif',ext:avif?'avif':'heic',format:avif?'avif':'heif',container:'heif',brands:found,unknown:found.length===0}
  }
  return null
}

export async function detectFormat(file){
  const bytes=new Uint8Array(await file.slice(0,4096).arrayBuffer())
  const detected=detectBytes(bytes)
  const extension=file.name.split('.').pop()?.toLowerCase()||''
  if(detected)return {...detected,extension,mismatch:detected.container==='heif'? !['heic','heif','hif','heics','heifs','avci','avcs','hej2','avif','avifs'].includes(extension):detected.ext==='ff'? !['ff','farbfeld'].includes(extension):extension!==detected.ext}
  if(extension==='tga')return {mime:'image/x-tga',ext:'tga',format:'tga',extension,container:'image',unknown:false,mismatch:false}
  return {mime:file.type||'',ext:extension,extension,format:extension,unknown:true,mismatch:false}
}
