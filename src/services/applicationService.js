import { collection, doc, getDocs, getDoc, addDoc, updateDoc, deleteDoc, query, where, orderBy, limit, startAfter, serverTimestamp } from 'firebase/firestore'
import { db, isFirebaseConfigured } from '../config/firebase.js'
import { seed, safeGetDoc } from './_helpers.js'
import { auditService } from './auditService.js'
const COLL='applications'
export const applicationService={
 async list(filters={}){
  if(!isFirebaseConfigured) return seed(COLL)
  const s=await getDocs(query(collection(db,COLL),orderBy('createdAt','desc'))); return s.docs.map(d=>({id:d.id,...d.data()}))
 },
 async get(id){
  if(!isFirebaseConfigured) return seed(COLL).find(x=>x.id===id)||null
  const s=await safeGetDoc(doc(db,COLL,id)); return s && s.exists()?{id:s.id,...s.data()}:null
 },
 async create(data,actor){
  if(!isFirebaseConfigured) return {id:`demo-${Date.now()}`,...data}
  const ref=await addDoc(collection(db,COLL),{...data,createdAt:serverTimestamp(),updatedAt:serverTimestamp()}); if(actor) await auditService.log(actor,'create',COLL,ref.id,JSON.stringify(data).slice(0,200)); return {id:ref.id,...data}
 },
 async update(id,data,actor){
  if(!isFirebaseConfigured) return {id,...data}
  await updateDoc(doc(db,COLL,id),{...data,updatedAt:serverTimestamp()}); if(actor) await auditService.log(actor,'update',COLL,id,JSON.stringify(data).slice(0,200)); return {id,...data}
 },
 async remove(id,actor){
  if(!isFirebaseConfigured) return true
  await deleteDoc(doc(db,COLL,id)); if(actor) await auditService.log(actor,'delete',COLL,id,''); return true
 },
 
 async updateStatus(id,status,actor,note){ const patch={status}; if(!isFirebaseConfigured) return {id,...patch}; if(!actor || !actor.uid) throw new Error('updateStatus needs the signed-in admin user as actor: without it the history entry would carry an empty byUid and the rules reject it.'); const s=await getDoc(doc(db,'applications',id)); const prev=s.exists()?s.data():{}; const history=[...(prev.statusHistory||[]),{status,at:new Date().toISOString(),byUid:actor.uid,byName:actor.email||''}]; return applicationService.update(id,{status,statusHistory:history},actor) },
 async addReviewNote(id,note,actor){ if(!isFirebaseConfigured) return {id}; if(!actor || !actor.uid) throw new Error('addReviewNote needs the signed-in admin user as actor: without it the note would carry an empty byUid and the rules reject it.'); const s=await getDoc(doc(db,'applications',id)); const prev=s.exists()?s.data():{}; return applicationService.update(id,{reviewNotes:[...(prev.reviewNotes||[]),{...note,byUid:actor.uid,byName:actor.email||'',at:new Date().toISOString()}]},actor) },
 async scheduleInterview(id,date,actor){ return applicationService.update(id,{interviewDate:date,status:'interview_scheduled'},actor) },

}
export default applicationService
