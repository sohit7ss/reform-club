import { collection, doc, getDocs, getDoc, addDoc, updateDoc, deleteDoc, query, where, orderBy, limit, startAfter, serverTimestamp } from 'firebase/firestore'
import { db, isFirebaseConfigured } from '../config/firebase.js'
import { seed, safeGetDoc } from './_helpers.js'
import { auditService } from './auditService.js'
const COLL='comments'
export const commentService={
 async list(filters={}){
  return commentService.listAll(filters)
 },
 async listAll(filters={}){
  if(!isFirebaseConfigured) return seed(COLL)
  const s=await getDocs(query(collection(db,COLL),orderBy('createdAt','desc'))); return s.docs.map(d=>({id:d.id,...d.data()}))
 },
 async listApprovedForArtwork(artworkId){
  if(!isFirebaseConfigured) return seed(COLL).filter(c=>c.artworkId===artworkId && c.status==='approved').sort((a,b)=>String(b.createdAt||'').localeCompare(String(a.createdAt||'')))
  const s=await getDocs(query(collection(db,COLL),where('artworkId','==',artworkId),where('status','==','approved'),orderBy('createdAt','desc'))); return s.docs.map(d=>({id:d.id,...d.data()}))
 },
 async get(id){
  if(!isFirebaseConfigured) return seed(COLL).find(x=>x.id===id)||null
  const s=await safeGetDoc(doc(db,COLL,id)); return s && s.exists()?{id:s.id,...s.data()}:null
 },
 async create(data,actor){
  if(actor && actor.emailVerified===false) throw new Error('Please verify your email before commenting. Check your inbox for the verification link.')
  if(!isFirebaseConfigured) return {id:`demo-${Date.now()}`,...data}
  const ref=await addDoc(collection(db,COLL),{...data,createdAt:serverTimestamp()}); if(actor) await auditService.log(actor,'create',COLL,ref.id,JSON.stringify(data).slice(0,200)); return {id:ref.id,...data}
 },
 async update(id,data,actor){
  if(!isFirebaseConfigured) return {id,...data}
  await updateDoc(doc(db,COLL,id),{...data,updatedAt:serverTimestamp()}); if(actor) await auditService.log(actor,'update',COLL,id,JSON.stringify(data).slice(0,200)); return {id,...data}
 },
 async remove(id,actor){
  if(!isFirebaseConfigured) return true
  await deleteDoc(doc(db,COLL,id)); if(actor) await auditService.log(actor,'delete',COLL,id,''); return true
 },
 
}
export default commentService
