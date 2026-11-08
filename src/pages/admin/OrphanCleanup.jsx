import React,{useCallback,useEffect,useState} from 'react'
import DataTable from '../../components/admin/DataTable.jsx'
import ConfirmDialog from '../../components/ui/ConfirmDialog.jsx'
import Button from '../../components/ui/Button.jsx'
import { uploadService } from '../../services/uploadService.js'
import { bucket, submissionsBucket, isSupabaseConfigured } from '../../config/supabase.js'
import { artworkService } from '../../services/artworkService.js'
import { challengeService } from '../../services/challengeService.js'
import { eventService } from '../../services/eventService.js'
import { teamService } from '../../services/teamService.js'
import { memberProfileService } from '../../services/memberProfileService.js'
import { recognitionService } from '../../services/recognitionService.js'
import { legacyService } from '../../services/legacyService.js'
import { blogService } from '../../services/blogService.js'
import { constitutionService } from '../../services/constitutionService.js'
import { auditService } from '../../services/auditService.js'
import { isCoordinator } from '../../config/roles.js'
import { useAuth } from '../../context/AuthContext.jsx'
import { useToast } from '../../context/ToastContext.jsx'
// Storage prefixes scanned for orphans, per bucket. reform-submissions holds public
// uploads (submissions/, w2b/); reform-media holds admin content and docs/.
const SCAN_TARGETS=[
 {bucket:submissionsBucket,prefix:'submissions'},
 {bucket:submissionsBucket,prefix:'w2b'},
 {bucket:bucket,prefix:'gallery'},
 {bucket:bucket,prefix:'events'},
 {bucket:bucket,prefix:'team'},
 {bucket:bucket,prefix:'blog'},
 {bucket:bucket,prefix:'recognition'},
 {bucket:bucket,prefix:'legacy'},
 {bucket:bucket,prefix:'docs'}
]
// Demo-mode inventory: the same orphan comparison, run against clearly labelled
// simulated rows. Seed data uses external placeholder image URLs, so no seed row
// maps to a real storage path; these rows stand in for a real bucket listing.
const SIMULATED_FILES=[
 {bucket:submissionsBucket,path:'submissions/demo-art-1.webp',size:182400,updatedAt:'2026-11-05T10:00:00'},
 {bucket:submissionsBucket,path:'submissions/demo-orphan-1.webp',size:210300,updatedAt:'2026-11-04T09:00:00'},
 {bucket:submissionsBucket,path:'w2b/demo-w2b-1.webp',size:195800,updatedAt:'2026-11-05T11:00:00'},
 {bucket:submissionsBucket,path:'w2b/demo-orphan-2.webp',size:240100,updatedAt:'2026-11-03T08:00:00'},
 {bucket:bucket,path:'gallery/demo-gallery-1.webp',size:175200,updatedAt:'2026-11-05T12:00:00'},
 {bucket:bucket,path:'gallery/demo-orphan-3.webp',size:160900,updatedAt:'2026-11-02T07:00:00'},
 {bucket:bucket,path:'events/demo-orphan-4.webp',size:220500,updatedAt:'2026-11-01T07:00:00'}
]
const SIMULATED_REFERENCED=new Set(['submissions/demo-art-1.webp','w2b/demo-w2b-1.webp','gallery/demo-gallery-1.webp'])
function pathFromUrl(url,bkt){
 if(!url||typeof url!=='string') return ''
 const marker='/storage/v1/object/public/'+bkt+'/'
 const i=url.indexOf(marker)
 if(i<0) return ''
 try{ return decodeURIComponent(url.slice(i+marker.length).split('?')[0]) }catch(e){ return url.slice(i+marker.length).split('?')[0] }
}
function addUrlPath(set,url){
 [bucket,submissionsBucket].forEach(function(bkt){ const p=pathFromUrl(url,bkt); if(p) set.add(p) })
}
function addPaths(set,list){ (list||[]).forEach(function(p){ if(p) set.add(p) }) }
async function collectReferenced(){
 const refs=new Set()
 const artworks=await artworkService.list()
 artworks.forEach(function(a){ if(a.imagePath) refs.add(a.imagePath); addUrlPath(refs,a.imageUrl); addUrlPath(refs,a.thumbUrl) })
 const challenges=await challengeService.listAll()
 for(let i=0;i<challenges.length;i++){
  const subs=await challengeService.listSubmissions(challenges[i].id)
  subs.forEach(function(s){ addPaths(refs,s.imagePaths); (s.imageUrls||[]).forEach(function(u){ addUrlPath(refs,u) }) })
 }
 const events=await eventService.list()
 events.forEach(function(e){ if(e.posterPath) refs.add(e.posterPath); addUrlPath(refs,e.posterUrl); (e.photoUrls||[]).forEach(function(u){ addUrlPath(refs,u) }) })
 const members=await teamService.list()
 members.forEach(function(m){ if(m.photoPath) refs.add(m.photoPath); addUrlPath(refs,m.photoUrl) })
 const profiles=await memberProfileService.list()
 profiles.forEach(function(p){ addUrlPath(refs,p.photoUrl) })
 const recogs=await recognitionService.list()
 recogs.forEach(function(r){ addUrlPath(refs,r.photoUrl) })
 const legacy=await legacyService.list()
 legacy.forEach(function(l){ addPaths(refs,l.imageUrls); (l.imageUrls||[]).forEach(function(u){ addUrlPath(refs,u) }) })
 const posts=await blogService.list()
 posts.forEach(function(b){ if(b.coverPath) refs.add(b.coverPath); addUrlPath(refs,b.coverUrl) })
 const docs=await constitutionService.list()
 docs.forEach(function(c){ if(c.filePath) refs.add(c.filePath); addUrlPath(refs,c.fileUrl) })
 return refs
}
function findOrphans(files,referenced){ return files.filter(function(f){ return !referenced.has(f.path) }) }
export default function OrphanCleanup(){
 const {user,adminProfile}=useAuth()
 const {push}=useToast()
 const coordinator=isCoordinator(adminProfile)
 const demo=!isSupabaseConfigured
 const [scanning,setScanning]=useState(false)
 const [scanned,setScanned]=useState(false)
 const [orphans,setOrphans]=useState([])
 const [totalFiles,setTotalFiles]=useState(0)
 const [errors,setErrors]=useState([])
 const [deleteRow,setDeleteRow]=useState(null)
 const scan=useCallback(async function scanStorage(){
  setScanning(true); setErrors([])
  try{
   if(demo){
    const found=findOrphans(SIMULATED_FILES,SIMULATED_REFERENCED)
    setTotalFiles(SIMULATED_FILES.length); setOrphans(found); setScanned(true)
    return
   }
   const refs=await collectReferenced()
   const files=[]; const errs=[]
   for(let i=0;i<SCAN_TARGETS.length;i++){
    const t=SCAN_TARGETS[i]
    try{
     const listed=await uploadService.listFiles(t.bucket,t.prefix)
     listed.forEach(function(f){ files.push({bucket:t.bucket,path:f.path,size:f.size,updatedAt:f.updatedAt}) })
    }catch(e){ errs.push(t.bucket+'/'+t.prefix+': '+(e.message||'list failed')) }
   }
   setErrors(errs)
   setTotalFiles(files.length); setOrphans(findOrphans(files,refs)); setScanned(true)
  }catch(e){ push(e.message||'Scan failed.','error') }
  setScanning(false)
 },[demo,push])
 useEffect(function onMount(){ if(coordinator) scan() },[coordinator,scan])
 const confirmDelete=async function doDelete(){
  if(!deleteRow) return
  const row=deleteRow
  try{
   if(demo){
    setOrphans(function drop(rs){ return rs.filter(function keep(r){ return r.path!==row.path }) })
    push('Simulated delete — no real file was deleted (demo mode).')
   }else{
    await uploadService.deleteFile(row.path,row.bucket)
    await auditService.log(user,'delete','storage:'+row.bucket,row.path,'orphan cleanup: '+row.path)
    setOrphans(function drop(rs){ return rs.filter(function keep(r){ return r.path!==row.path }) })
    push('Orphan deleted: '+row.path)
   }
   setDeleteRow(null)
  }catch(e){ push(e.message,'error') }
 }
 if(!coordinator) return (<div><h2 className="font-display text-2xl font-bold mb-4">Orphan Cleanup</h2><p>Coordinator only. Ask the club coordinator to run storage cleanup.</p></div>)
 return (
  <div>
   <h2 className="font-display text-2xl font-bold mb-4">Orphan Cleanup</h2>
   <p className="text-sm mb-3">Lists files in Supabase Storage that no Firestore document references — member artwork (<code>submissions/</code>), Waste to Best (<code>w2b/</code>), gallery, events, team, blog, recognition, legacy and docs — and lets the coordinator delete them. Deletions ask for confirmation and are written to the audit log.</p>
   {demo && <p className="text-sm mb-3 collage-card rounded-xl p-3"><strong>Demo mode — simulated rows.</strong> Supabase is not configured, so the table below is simulated data run through the same orphan comparison; nothing was listed from or deleted in real storage.</p>}
   <div className="flex gap-2 mb-4"><Button onClick={scan} disabled={scanning}>{scanning?'Scanning…':'Scan again'}</Button></div>
   {scanned && <p className="text-sm mb-3">{totalFiles} file(s) scanned, {orphans.length} orphan(s) found.</p>}
   {errors.length>0 && <p role="alert" className="text-sm text-red-700 mb-3">Some prefixes could not be listed: {errors.join('; ')}</p>}
   <DataTable rows={orphans} columns={[
    {key:'bucket',label:'Bucket'},
    {key:'path',label:'Path'},
    {key:'size',label:'Size (bytes)',render:function renderSize(r){ return r.size==null?'—':String(r.size) }},
    {key:'updatedAt',label:'Updated',render:function renderUpdated(r){ return r.updatedAt||'—' }},
    {key:'actions',label:'Actions',render:function renderActions(r){ return (<button type="button" onClick={function onDelete(){ setDeleteRow(r) }} className="underline">Delete</button>) }}
   ]} searchKeys={['bucket','path']} />
   <ConfirmDialog open={Boolean(deleteRow)} onClose={function closeDelete(){ setDeleteRow(null) }} onConfirm={confirmDelete} title="Delete orphaned file?" body={deleteRow?('Delete '+deleteRow.path+' from bucket '+deleteRow.bucket+'? This cannot be undone.'):''} />
  </div>
 )
}
