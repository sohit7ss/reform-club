export const MAX_IMAGE_MB=5
export const MAX_DOC_MB=10
export const ALLOWED_IMAGE_MIMES=['image/jpeg','image/png','image/webp']; export const ALLOWED_IMAGE_EXTS=['jpg','jpeg','png','webp']
export async function checkMagicBytes(file){ const buf=await file.slice(0,12).arrayBuffer(); const b=new Uint8Array(buf); const isJpeg=b[0]===0xFF&&b[1]===0xD8&&b[2]===0xFF; const isPng=b[0]===0x89&&b[1]===0x50&&b[2]===0x4E&&b[3]===0x47; const isWebp=b[8]===0x57&&b[9]===0x45&&b[10]===0x42&&b[11]===0x50; return isJpeg||isPng||isWebp }
export async function checkPdfMagicBytes(file){ if(!file) return false; const buf=await file.slice(0,5).arrayBuffer(); const b=new Uint8Array(buf); return b[0]===0x25&&b[1]===0x50&&b[2]===0x44&&b[3]===0x46&&b[4]===0x2D }
export function validateImageFile(file,maxMB=MAX_IMAGE_MB){ if(!file) return 'No file selected.'; if(!ALLOWED_IMAGE_MIMES.includes(file.type)) return 'Only JPEG, PNG or WebP images are allowed.'; const ext=file.name.split('.').pop().toLowerCase(); if(!ALLOWED_IMAGE_EXTS.includes(ext)) return 'File extension must be .jpg, .jpeg, .png or .webp.'; if(file.size>maxMB*1024*1024) return `Image must be under ${maxMB} MB.`; return null }
export function validateDocFile(file,maxMB=MAX_DOC_MB){ if(!file) return 'No file selected.'; if(file.type!=='application/pdf') return 'Only PDF documents are allowed.'; if(file.size>maxMB*1024*1024) return `Document must be under ${maxMB} MB.`; return null }
export default validateImageFile
