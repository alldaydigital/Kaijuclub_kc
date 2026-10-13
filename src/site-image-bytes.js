const invalid = () => { throw new Error('Deze foto is beschadigd of onvolledig. Voeg een geldige PNG-, JPG- of WebP-foto toe.'); };
const dimensions = (width,height) => {
  if(!Number.isInteger(width)||!Number.isInteger(height)||width<1||height<1||width>12000||height>12000||width*height>40000000)invalid();
  return {width,height};
};
const mimeName = mime => typeof mime==='string'?mime.replace(/^image\//,'').replace(/^jpg$/,'jpeg'):'';
const text = (bytes,start,length) => String.fromCharCode(...bytes.subarray(start,start+length));
const u16be = (bytes,index) => bytes[index]*256+bytes[index+1];
const u16le = (bytes,index) => bytes[index]+bytes[index+1]*256;
const u24le = (bytes,index) => bytes[index]+bytes[index+1]*256+bytes[index+2]*65536;
const u32be = (bytes,index) => bytes[index]*16777216+bytes[index+1]*65536+bytes[index+2]*256+bytes[index+3];
const u32le = (bytes,index) => bytes[index]+bytes[index+1]*256+bytes[index+2]*65536+bytes[index+3]*16777216;

const crcTable = Array.from({length:256},(_,index)=>{
  let crc=index;for(let bit=0;bit<8;bit++)crc=crc&1?0xedb88320^(crc>>>1):crc>>>1;return crc>>>0;
});
function crc32(bytes,start,end){
  let crc=0xffffffff;for(let index=start;index<end;index++)crc=crcTable[(crc^bytes[index])&255]^(crc>>>8);return (crc^0xffffffff)>>>0;
}

function pngDimensions(bytes){
  const signature=[137,80,78,71,13,10,26,10];
  if(bytes.length<57||signature.some((value,index)=>bytes[index]!==value))invalid();
  let offset=8,size=null,hasPixels=false,ended=false;
  while(offset<bytes.length){
    if(offset+12>bytes.length)invalid();
    const length=u32be(bytes,offset),name=text(bytes,offset+4,4),payload=offset+8,end=payload+length;
    if(end+4>bytes.length||!/^[A-Za-z]{4}$/.test(name)||crc32(bytes,offset+4,end)!==u32be(bytes,end))invalid();
    if(!size&&name!=='IHDR')invalid();
    if(name==='IHDR'){
      if(size||length!==13)invalid();
      size=dimensions(u32be(bytes,payload),u32be(bytes,payload+4));
      const depths={0:[1,2,4,8,16],2:[8,16],3:[1,2,4,8],4:[8,16],6:[8,16]};
      if(!depths[bytes[payload+9]]?.includes(bytes[payload+8])||bytes[payload+10]!==0||bytes[payload+11]!==0||bytes[payload+12]>1)invalid();
    }else if(name==='IDAT')hasPixels=hasPixels||length>0;
    else if(name==='IEND'){
      if(length!==0||!hasPixels||end+4!==bytes.length)invalid();ended=true;
    }else if(name[0]===name[0].toUpperCase()&&name!=='PLTE')invalid();
    offset=end+4;
  }
  if(!size||!ended)invalid();return size;
}

function jpegDimensions(bytes){
  if(bytes.length<12||bytes[0]!==255||bytes[1]!==216)invalid();
  const frames=new Set([0xc0,0xc1,0xc2,0xc3,0xc5,0xc6,0xc7,0xc9,0xca,0xcb,0xcd,0xce,0xcf]);
  let offset=2,size=null,hasScan=false;
  while(offset<bytes.length){
    if(bytes[offset++]!==255)invalid();
    while(offset<bytes.length&&bytes[offset]===255)offset++;
    if(offset>=bytes.length)invalid();const marker=bytes[offset++];
    if(marker===0xd9){if(!size||!hasScan||offset!==bytes.length)invalid();return size;}
    if(marker===0||marker===0xd8||(marker>=0xd0&&marker<=0xd7))invalid();
    if(marker===0x01)continue;
    if(offset+2>bytes.length)invalid();const length=u16be(bytes,offset),payload=offset+2,end=offset+length;
    if(length<2||end>bytes.length)invalid();
    if(frames.has(marker)){
      if(length<11||length!==8+3*bytes[payload+5])invalid();
      const frame=dimensions(u16be(bytes,payload+3),u16be(bytes,payload+1));
      if(size&&(frame.width!==size.width||frame.height!==size.height))invalid();size=frame;
    }
    offset=end;
    if(marker===0xda){
      if(!size||length<8||length!==6+2*bytes[payload])invalid();hasScan=true;
      let nextMarker=false;
      while(offset<bytes.length){
        if(bytes[offset++]!==255)continue;
        const markerStart=offset-1;while(offset<bytes.length&&bytes[offset]===255)offset++;
        if(offset>=bytes.length)invalid();const code=bytes[offset];
        if(code===0||(code>=0xd0&&code<=0xd7)){offset++;continue;}
        offset=markerStart;nextMarker=true;break;
      }
      if(!nextMarker)invalid();
    }
  }
  invalid();
}

function webpFrame(bytes,start,length,name){
  if(name==='VP8 '){
    if(length<10||(bytes[start]&1)!==0||bytes[start+3]!==0x9d||bytes[start+4]!==1||bytes[start+5]!==0x2a)invalid();
    return dimensions(u16le(bytes,start+6)&0x3fff,u16le(bytes,start+8)&0x3fff);
  }
  if(name==='VP8L'){
    if(length<5||bytes[start]!==0x2f)invalid();const packed=u32le(bytes,start+1);
    if((packed>>>29)!==0)invalid();return dimensions(1+(packed&0x3fff),1+((packed>>>14)&0x3fff));
  }
  return null;
}
function webpDimensions(bytes){
  if(bytes.length<20||text(bytes,0,4)!=='RIFF'||text(bytes,8,4)!=='WEBP'||u32le(bytes,4)+8!==bytes.length)invalid();
  let offset=12,canvas=null,frame=null,animated=false,hasAnimationHeader=false,animationFrames=0;
  while(offset<bytes.length){
    if(offset+8>bytes.length)invalid();const name=text(bytes,offset,4),length=u32le(bytes,offset+4),start=offset+8,end=start+length;
    if(end+(length&1)>bytes.length)invalid();
    if(name==='VP8X'){
      if(canvas||offset!==12||length!==10||(bytes[start]&0xc1)!==0||bytes[start+1]||bytes[start+2]||bytes[start+3])invalid();
      canvas=dimensions(1+u24le(bytes,start+4),1+u24le(bytes,start+7));animated=Boolean(bytes[start]&2);
    }else if(name==='VP8 '||name==='VP8L'){
      if(frame||animated)invalid();frame=webpFrame(bytes,start,length,name);
    }else if(name==='ANIM'){
      if(!animated||hasAnimationHeader||length!==6)invalid();hasAnimationHeader=true;
    }else if(name==='ANMF'){
      if(!animated||!hasAnimationHeader||length<24)invalid();
      const x=2*u24le(bytes,start),y=2*u24le(bytes,start+3),width=1+u24le(bytes,start+6),height=1+u24le(bytes,start+9);
      if(x+width>canvas.width||y+height>canvas.height||(bytes[start+15]&0xfc)!==0)invalid();
      let inner=start+16,frameSize=null;
      while(inner<end){
        if(inner+8>end)invalid();const frameName=text(bytes,inner,4),frameLength=u32le(bytes,inner+4),frameStart=inner+8;
        if(frameStart+frameLength+(frameLength&1)>end)invalid();
        const found=webpFrame(bytes,frameStart,frameLength,frameName);
        if(found){if(frameSize)invalid();frameSize=found;}
        inner=frameStart+frameLength+(frameLength&1);
      }
      if(!frameSize||frameSize.width!==width||frameSize.height!==height)invalid();animationFrames++;
    }
    offset=end+(length&1);
  }
  if(animated){if(!animationFrames)invalid();return canvas;}
  if(!frame||(canvas&&(canvas.width!==frame.width||canvas.height!==frame.height)))invalid();return canvas||frame;
}

/** Inspect the complete raster container before trusting caller-supplied dimensions. */
export function inspectRasterBytes(bytes,mime){
  if(!(bytes instanceof Uint8Array)||bytes.length>10000000)invalid();
  const name=mimeName(mime);
  if(name==='png')return pngDimensions(bytes);
  if(name==='jpeg')return jpegDimensions(bytes);
  if(name==='webp')return webpDimensions(bytes);
  invalid();
}

/** Browser decoding verifies the actual pixel payload before any GitHub upload. */
export async function validateRasterUpload(bytes,mime,image,{decoder=globalThis.createImageBitmap}={}){
  const size=inspectRasterBytes(bytes,mime);
  if(!image||image.width!==size.width||image.height!==size.height)throw new Error('De afmetingen komen niet overeen met de foto. Voeg de foto opnieuw toe.');
  if(typeof decoder==='function'){
    let bitmap;
    try{
      bitmap=await decoder(new Blob([bytes],{type:'image/'+mimeName(mime)}),{imageOrientation:'none'});
      if(bitmap.width!==size.width||bitmap.height!==size.height)invalid();
    }catch{invalid();}
    finally{bitmap?.close?.();}
  }
  return size;
}
