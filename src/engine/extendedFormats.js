const MAX_PIXELS = 100_000_000

function dimensions(width, height) {
  if (!Number.isSafeInteger(width) || !Number.isSafeInteger(height) || width < 1 || height < 1 || width * height > MAX_PIXELS) throw new Error('file-too-large')
}

function luminance(r, g, b) { return Math.round(.2126 * r + .7152 * g + .0722 * b) }
function flatten(channel, alpha) { return Math.round(channel * alpha / 255 + 255 * (255 - alpha) / 255) }

function readToken(bytes, state) {
  while (state.cursor < bytes.length) {
    const byte = bytes[state.cursor]
    if ([9, 10, 13, 32].includes(byte)) state.cursor++
    else if (byte === 35) { while (state.cursor < bytes.length && bytes[state.cursor++] !== 10) {} }
    else break
  }
  const start = state.cursor
  while (state.cursor < bytes.length && ![9, 10, 13, 32, 35].includes(bytes[state.cursor])) state.cursor++
  if (start === state.cursor) throw new Error('decode-failed')
  return new TextDecoder().decode(bytes.subarray(start, state.cursor))
}

function netpbmRaster(bytes, magic, channels, binary = true) {
  if (String.fromCharCode(bytes[0], bytes[1]) !== magic) throw new Error('decode-failed')
  const state = { cursor:2 }
  const width = Number(readToken(bytes, state)), height = Number(readToken(bytes, state))
  dimensions(width, height)
  // PBM's P4 binary bitmap header ends after the height; P5 carries MAXVAL.
  const maximum = magic === 'P4' ? 1 : Number(readToken(bytes, state))
  if (!Number.isInteger(maximum) || maximum < 1 || maximum > 255) throw new Error('decode-failed')
  if (!binary) throw new Error('unsupported-format')
  if (bytes[state.cursor] === 13 && bytes[state.cursor + 1] === 10) state.cursor += 2
  else if ([9, 10, 13, 32].includes(bytes[state.cursor])) state.cursor++
  else throw new Error('decode-failed')
  return { width, height, maximum, cursor:state.cursor, channels }
}

export function encodePbm({data,width,height}) {
  dimensions(width,height)
  const header = new TextEncoder().encode(`P4\n${width} ${height}\n`)
  const stride = Math.ceil(width/8), bytes = new Uint8Array(header.length+stride*height)
  bytes.set(header)
  for(let y=0;y<height;y++) for(let x=0;x<width;x++) {
    const i=(y*width+x)*4, a=data[i+3], r=flatten(data[i],a), g=flatten(data[i+1],a), b=flatten(data[i+2],a)
    if(luminance(r,g,b)<128) bytes[header.length+y*stride+(x>>3)] |= 0x80>>(x&7)
  }
  return new Blob([bytes],{type:'image/x-portable-bitmap'})
}

export function decodePbm(bytes) {
  const h=netpbmRaster(bytes,'P4',1), stride=Math.ceil(h.width/8)
  if(bytes.length<h.cursor+stride*h.height)throw new Error('decode-failed')
  const data=new Uint8ClampedArray(h.width*h.height*4)
  for(let y=0;y<h.height;y++)for(let x=0;x<h.width;x++){const black=bytes[h.cursor+y*stride+(x>>3)]&(0x80>>(x&7)),v=black?0:255,i=(y*h.width+x)*4;data[i]=data[i+1]=data[i+2]=v;data[i+3]=255}
  return {data,width:h.width,height:h.height}
}

export function encodePgm({data,width,height}) {
  dimensions(width,height)
  const header=new TextEncoder().encode(`P5\n${width} ${height}\n255\n`),bytes=new Uint8Array(header.length+width*height)
  bytes.set(header)
  for(let p=0;p<width*height;p++){const i=p*4,a=data[i+3];bytes[header.length+p]=luminance(flatten(data[i],a),flatten(data[i+1],a),flatten(data[i+2],a))}
  return new Blob([bytes],{type:'image/x-portable-graymap'})
}

export function decodePgm(bytes) {
  const h=netpbmRaster(bytes,'P5',1),count=h.width*h.height
  if(bytes.length<h.cursor+count)throw new Error('decode-failed')
  const data=new Uint8ClampedArray(count*4)
  for(let p=0;p<count;p++){const value=Math.round(bytes[h.cursor+p]*255/h.maximum),i=p*4;data[i]=data[i+1]=data[i+2]=value;data[i+3]=255}
  return {data,width:h.width,height:h.height}
}

export function encodePam({data,width,height}) {
  dimensions(width,height)
  const header=new TextEncoder().encode(`P7\nWIDTH ${width}\nHEIGHT ${height}\nDEPTH 4\nMAXVAL 255\nTUPLTYPE RGB_ALPHA\nENDHDR\n`)
  const bytes=new Uint8Array(header.length+width*height*4);bytes.set(header);bytes.set(data,header.length)
  return new Blob([bytes],{type:'image/x-portable-arbitrarymap'})
}

export function decodePam(bytes) {
  if(String.fromCharCode(bytes[0],bytes[1])!=='P7')throw new Error('decode-failed')
  let end=-1
  for(let i=2;i<bytes.length-6;i++)if(bytes[i]===69&&String.fromCharCode(...bytes.subarray(i,i+6))==='ENDHDR'){end=i+6;break}
  if(end<0)throw new Error('decode-failed')
  // ENDHDR is followed by one line ending. Do not skip arbitrary bytes here:
  // the first pixel may itself be whitespace (e.g. an alpha value of 10).
  if(bytes[end]===13&&bytes[end+1]===10)end+=2
  else if(bytes[end]===10||bytes[end]===13)end++
  else throw new Error('decode-failed')
  const header=new TextDecoder().decode(bytes.subarray(2,end)).split(/\r?\n/),fields={}
  for(const line of header){const [key,value]=line.trim().split(/\s+/,2);if(key&&value)fields[key]=value}
  const width=Number(fields.WIDTH),height=Number(fields.HEIGHT),depth=Number(fields.DEPTH),maximum=Number(fields.MAXVAL)
  dimensions(width,height)
  if(![3,4].includes(depth)||!Number.isInteger(maximum)||maximum<1||maximum>255||bytes.length<end+width*height*depth)throw new Error('decode-failed')
  const data=new Uint8ClampedArray(width*height*4)
  for(let p=0;p<width*height;p++){const s=end+p*depth,d=p*4;data[d]=Math.round(bytes[s]*255/maximum);data[d+1]=Math.round(bytes[s+1]*255/maximum);data[d+2]=Math.round(bytes[s+2]*255/maximum);data[d+3]=depth===4?Math.round(bytes[s+3]*255/maximum):255}
  return {data,width,height}
}

export function encodeFarbfeld({data,width,height}) {
  dimensions(width,height)
  const bytes=new Uint8Array(16+width*height*8),view=new DataView(bytes.buffer)
  bytes.set(new TextEncoder().encode('farbfeld'))
  view.setUint32(8,width);view.setUint32(12,height)
  for(let i=0;i<data.length;i++)view.setUint16(16+i*2,data[i]*257)
  return new Blob([bytes],{type:'image/farbfeld'})
}

export function decodeFarbfeld(bytes) {
  if(new TextDecoder().decode(bytes.subarray(0,8))!=='farbfeld'||bytes.length<16)throw new Error('decode-failed')
  const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength),width=view.getUint32(8),height=view.getUint32(12)
  dimensions(width,height)
  if(bytes.length<16+width*height*8)throw new Error('decode-failed')
  const data=new Uint8ClampedArray(width*height*4)
  for(let i=0;i<data.length;i++)data[i]=Math.round(view.getUint16(16+i*2)/257)
  return {data,width,height}
}

export function encodeTga({data,width,height}) {
  dimensions(width,height)
  if(width>65535||height>65535)throw new Error('canvas-limit')
  const bytes=new Uint8Array(18+width*height*4),view=new DataView(bytes.buffer)
  bytes[2]=2;view.setUint16(12,width,true);view.setUint16(14,height,true);bytes[16]=32;bytes[17]=0x28
  for(let p=0;p<width*height;p++){const s=p*4,d=18+p*4;bytes[d]=data[s+2];bytes[d+1]=data[s+1];bytes[d+2]=data[s];bytes[d+3]=data[s+3]}
  return new Blob([bytes],{type:'image/x-tga'})
}

export function decodeTga(bytes) {
  if(bytes.length<18)throw new Error('decode-failed')
  const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength),idLength=bytes[0],colorMap=bytes[1],kind=bytes[2],width=view.getUint16(12,true),height=view.getUint16(14,true),depth=bytes[16]
  dimensions(width,height)
  if(colorMap!==0||![2,3].includes(kind)||!(kind===2&&[24,32].includes(depth)||kind===3&&depth===8))throw Object.assign(new Error('unsupported-format'),{cause:'Only uncompressed grayscale and true-color TGA images are supported.'})
  const channels=depth/8,start=18+idLength,count=width*height
  if(bytes.length<start+count*channels)throw new Error('decode-failed')
  const top=Boolean(bytes[17]&0x20),right=Boolean(bytes[17]&0x10),data=new Uint8ClampedArray(count*4)
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){const sx=right?width-1-x:x,sy=top?y:height-1-y,s=start+(sy*width+sx)*channels,d=(y*width+x)*4;if(kind===3)data[d]=data[d+1]=data[d+2]=bytes[s];else{data[d]=bytes[s+2];data[d+1]=bytes[s+1];data[d+2]=bytes[s]}data[d+3]=channels===4?bytes[s+3]:255}
  return {data,width,height}
}
