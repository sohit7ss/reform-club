import { collection, doc, getDocs, getDoc, addDoc, updateDoc, deleteDoc, query, where, orderBy, limit, startAfter, serverTimestamp } from 'firebase/firestore'
import { db, isFirebaseConfigured } from '../config/firebase.js'
import { seed, safeGetDoc } from './_helpers.js'
import { auditService } from './auditService.js'
const COLL='artworks'
const PAGE_SIZE=12
export const artworkService={
 async list(filters={}){
  return artworkService.listAll(filters)
 },
 async listAll(filters={}){
  if(!isFirebaseConfigured) return seed(COLL)
  const s=await getDocs(query(collection(db,COLL),orderBy('createdAt','desc'))); return s.docs.map(d=>({id:d.id,...d.data()}))
 },
 async listApprovedByCategory(category,cursor){
  const cat=category && category!=='all'?category:null
  if(!isFirebaseConfigured){
   const all=seed(COLL).filter(a=>a.status==='approved' && (!cat || a.category===cat)).sort((a,b)=>String(b.uploadedAt||'').localeCompare(String(a.uploadedAt||'')))
   const offset=typeof cursor==='number'?cursor:0
   const items=all.slice(offset,offset+PAGE_SIZE)
   const next=offset+items.length<all.length?offset+items.length:null
   return {items,lastVisible:next}
  }
  const constraints=[where('status','==','approved')]
  if(cat) constraints.push(where('category','==',cat))
  constraints.push(orderBy('uploadedAt','desc'),limit(PAGE_SIZE))
  if(cursor) constraints.push(startAfter(cursor))
  const s=await getDocs(query(collection(db,COLL),...constraints))
  const items=s.docs.map(d=>({id:d.id,...d.data()}))
  return {items,lastVisible:s.docs.length?s.docs[s.docs.length-1]:null}
 },
 async get(id){
  if(!isFirebaseConfigured) return seed(COLL).find(x=>x.id===id)||null
  const s=await safeGetDoc(doc(db,COLL,id)); return s && s.exists()?{id:s.id,...s.data()}:null
 },
 async create(data,actor){
  if(!isFirebaseConfigured) return {id:`demo-${Date.now()}`,...data}
  const ref=await addDoc(collection(db,COLL),{...data,uploadedAt:data.uploadedAt||serverTimestamp(),createdAt:serverTimestamp(),updatedAt:serverTimestamp()}); if(actor) await auditService.log(actor,'create',COLL,ref.id,JSON.stringify(data).slice(0,200)); return {id:ref.id,...data}
 },
 async update(id,data,actor){
  if(!isFirebaseConfigured) return {id,...data}
  await updateDoc(doc(db,COLL,id),{...data,updatedAt:serverTimestamp()}); if(actor) await auditService.log(actor,'update',COLL,id,JSON.stringify(data).slice(0,200)); return {id,...data}
 },
 async remove(id,actor){
  if(!isFirebaseConfigured) return true
  await deleteDoc(doc(db,COLL,id)); if(actor) await auditService.log(actor,'delete',COLL,id,''); return true
 },
 async like(id,user){
  if(!isFirebaseConfigured) return {ok:true,demo:true,liked:true}
  const { runTransaction, doc, increment }=await import('firebase/firestore')
  return runTransaction(db, async (tx)=>{
   const likeRef=doc(db,COLL,id,'likes',user.uid)
   const likeSnap=await tx.get(likeRef)
   if(likeSnap.exists()) throw new Error('You already liked this artwork.')
   tx.set(likeRef,{createdAt:serverTimestamp()})
   tx.update(doc(db,COLL,id),{likeCount:increment(1)})
   return {ok:true,liked:true}
  })
 },
 async unlike(id,user){
  if(!isFirebaseConfigured) return {ok:true,demo:true,liked:false}
  const { runTransaction, doc, increment }=await import('firebase/firestore')
  return runTransaction(db, async (tx)=>{
   const likeRef=doc(db,COLL,id,'likes',user.uid)
   const likeSnap=await tx.get(likeRef)
   if(!likeSnap.exists()) throw new Error('You have not liked this artwork yet.')
   tx.delete(likeRef)
   tx.update(doc(db,COLL,id),{likeCount:increment(-1)})
   return {ok:true,liked:false}
  })
 },
 async approve(id,actor){ return artworkService.update(id,{status:'approved'},actor) },
 async reject(id,reason,actor){ return artworkService.update(id,{status:'rejected',rejectionReason:reason},actor) },
 async toggleFeatured(id,featured,actor){ return artworkService.update(id,{featured:featured},actor) },
}
export default artworkService
