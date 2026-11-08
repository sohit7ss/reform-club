import { supabase, supabaseWithToken, bucket, submissionsBucket, supabaseUrl, supabaseAnonKey, isSupabaseConfigured } from '../config/supabase.js'
import { auth } from '../config/firebase.js'
import { compressToWebP, randomFileName } from '../utils/imageUpload.js'
import { validateDocFile, checkPdfMagicBytes, MAX_DOC_MB } from '../utils/validateFile.js'
// Public member artwork (submissions/) and Waste to Best (w2b/) uploads live in the
// public submissions bucket; every other prefix (gallery, events, team, blog,
// recognition, legacy, docs) is admin content in the reform-media bucket.
export const PUBLIC_UPLOAD_PREFIXES=['submissions','w2b']
export function bucketForPrefix(prefix){ return PUBLIC_UPLOAD_PREFIXES.includes(prefix)?submissionsBucket:bucket }
// Explicit auth mode for an upload: 'public' sends the Supabase anon key only and
// never a Firebase token (public prefixes, even when the uploader is signed in);
// 'admin' sends the signed-in admin's Firebase ID token via supabaseWithToken.
export function authModeForPrefix(prefix){ return PUBLIC_UPLOAD_PREFIXES.includes(prefix)?'public':'admin' }
function encodeStoragePath(path){ return path.split('/').map(function(seg){ return encodeURIComponent(seg) }).join('/') }
async function tokenForMode(authMode){
 if(authMode==='public') return supabaseAnonKey
 const currentUser=auth?.currentUser
 if(!currentUser) throw new Error('Sign in to upload admin content.')
 return currentUser.getIdToken()
}
function clientForMode(authMode,token){
 if(authMode==='public') return supabase
 return supabaseWithToken(token)
}
// Upload one file to Supabase Storage over XMLHttpRequest so the caller gets real
// network upload progress (xhr.upload progress events). Returns a promise that
// resolves when the storage server answers 2xx. Falls back to the supabase-js
// client only when XMLHttpRequest is unavailable (no progress then). The auth
// mode is explicit: public uploads use Authorization: Bearer <anon key> only and
// never send a Firebase token, even when the uploader is signed in.
async function uploadViaXhr(targetBucket,path,file,contentType,onProgress,authMode){
 const mode=authMode||'admin'
 const token=await tokenForMode(mode)
 const client=clientForMode(mode,token)
 if(typeof XMLHttpRequest==='undefined'){
  const {error}=await client.storage.from(targetBucket).upload(path,file,{contentType,upsert:false})
  if(error) throw error
  return
 }
 return new Promise(function(resolve,reject){
  const xhr=new XMLHttpRequest()
  xhr.open('POST',supabaseUrl+'/storage/v1/object/'+encodeURIComponent(targetBucket)+'/'+encodeStoragePath(path))
  xhr.setRequestHeader('apikey',supabaseAnonKey)
  xhr.setRequestHeader('Authorization','Bearer '+token)
  xhr.setRequestHeader('Content-Type',contentType)
  xhr.setRequestHeader('x-upsert','false')
  if(onProgress){ onProgress(0); xhr.upload.onprogress=function(e){ if(e.lengthComputable) onProgress(Math.round(e.loaded/e.total*100)) } }
  xhr.onload=function(){
   if(xhr.status>=200&&xhr.status<300){ if(onProgress) onProgress(100); resolve() }
   else{ let msg='Upload failed ('+xhr.status+')'; try{ const body=JSON.parse(xhr.responseText); if(body&&body.message) msg=body.message }catch(e){ /* keep default message */ } reject(new Error(msg)) }
  }
  xhr.onerror=function(){ reject(new Error('Upload failed: network error.')) }
  xhr.send(file)
 })
}
export const uploadService={
 async uploadImage(file,prefix='gallery',onProgress){ const {file:webp,thumb}=await compressToWebP(file); const targetBucket=bucketForPrefix(prefix); const authMode=authModeForPrefix(prefix); if(!isSupabaseConfigured) return {path:randomFileName(prefix),url:URL.createObjectURL(webp),thumbUrl:URL.createObjectURL(thumb),demo:true,bucket:targetBucket}; const path=randomFileName(prefix); const token=await tokenForMode(authMode); const client=clientForMode(authMode,token); await uploadViaXhr(targetBucket,path,webp,'image/webp',onProgress,authMode); const {data}=client.storage.from(targetBucket).getPublicUrl(path); const thumbPath=path.replace('.webp','-thumb.webp'); await client.storage.from(targetBucket).upload(thumbPath,thumb,{contentType:'image/webp',upsert:false}); const t=client.storage.from(targetBucket).getPublicUrl(thumbPath); return {path,url:data.publicUrl,thumbUrl:t.data.publicUrl,bucket:targetBucket} },
 async uploadDoc(file){ const err=validateDocFile(file,MAX_DOC_MB); if(err) throw new Error(err); if(!(await checkPdfMagicBytes(file))) throw new Error('File is not a valid PDF (missing %PDF- header).'); if(!isSupabaseConfigured) return {path:`docs/${crypto.randomUUID()}.pdf`,url:'',demo:true,bucket}; if(!auth?.currentUser) throw new Error('Sign in to upload a constitution PDF.'); const path=`docs/${crypto.randomUUID()}.pdf`; const client=supabaseWithToken(await auth.currentUser.getIdToken()); const {error}=await client.storage.from(bucket).upload(path,file,{contentType:'application/pdf'}); if(error) throw error; const {data}=client.storage.from(bucket).getPublicUrl(path); return {path,url:data.publicUrl,bucket} },
 async deleteFile(path,targetBucket){ const bkt=targetBucket||bucket; if(!isSupabaseConfigured) return true; const client=supabaseWithToken(await auth.currentUser.getIdToken()); const {error}=await client.storage.from(bkt).remove([path]); if(error) throw error; return true },
 // List files under one prefix of one bucket. Options: {limit, offset, recursive}.
 // Pagination walks offset pages of `limit` rows; recursion descends into
 // subfolders (a list entry with no metadata is a folder, not a file). Returns
 // [{name, path, size, updatedAt}] or [] in demo mode.
 async listFiles(targetBucket,prefix,options){ if(!isSupabaseConfigured) return []; const opts=options||{}; const limit=opts.limit||1000; const startOffset=opts.offset||0; const recursive=opts.recursive===true; const bkt=targetBucket||bucket; const client=auth?.currentUser?supabaseWithToken(await auth.currentUser.getIdToken()):supabase; async function listFolder(folder,offset){ const out=[]; let off=offset; for(;;){ const {data,error}=await client.storage.from(bkt).list(folder,{limit:limit,offset:off}); if(error) throw error; const page=data||[]; for(let i=0;i<page.length;i++){ const f=page[i]; if(!f||!f.name||f.name.endsWith('/')) continue; const folderPath=folder+'/'+f.name; if(f.metadata==null){ if(recursive){ const nested=await listFolder(folderPath,0); nested.forEach(function(n){ out.push(n) }) } continue } out.push({name:f.name,path:folderPath,size:f.metadata?f.metadata.size:null,updatedAt:f.updated_at||null}) } if(page.length<limit) break; off+=page.length } return out } return listFolder(prefix,startOffset) }
}
export default uploadService
