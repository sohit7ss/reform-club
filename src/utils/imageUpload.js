import imageCompression from 'browser-image-compression'
import { validateImageFile, checkMagicBytes } from './validateFile.js'
export async function compressToWebP(file){ const err=validateImageFile(file); if(err) throw new Error(err); if(!(await checkMagicBytes(file))) throw new Error('File contents do not look like a valid image.'); const compressed=await imageCompression(file,{maxWidthOrHeight:1600,maxSizeMB:0.5,initialQuality:0.82,fileType:'image/webp',useWebWorker:true}); const thumb=await imageCompression(file,{maxWidthOrHeight:400,maxSizeMB:0.1,initialQuality:0.75,fileType:'image/webp',useWebWorker:true}); return {file:compressed,thumb} }
export function randomFileName(prefix){ return `${prefix}/${crypto.randomUUID()}.webp` }
export default compressToWebP
