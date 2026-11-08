import { collection, doc, getDocs, getDoc, addDoc, updateDoc, deleteDoc, query, where, orderBy, limit, startAfter, serverTimestamp } from 'firebase/firestore'
import { db, isFirebaseConfigured } from '../config/firebase.js'
import { seed, safeGetDoc } from './_helpers.js'
import { auditService } from './auditService.js'
const COLL='teamMembers'
export const teamService={
 async list(filters={}){
  return teamService.listAll(filters)
 },
 async listAll(filters={}){
  if(!isFirebaseConfigured) return seed(COLL)
  const s=await getDocs(query(collection(db,COLL),orderBy('createdAt','desc'))); return s.docs.map(d=>({id:d.id,...d.data()}))
 },
 async listByTerm(termId){
  if(!isFirebaseConfigured) return seed(COLL).filter(m=>m.termId===termId && !m.archived).sort((a,b)=>(a.order||0)-(b.order||0))
  const s=await getDocs(query(collection(db,COLL),where('termId','==',termId),where('archived','==',false),orderBy('order','asc'))); return s.docs.map(d=>({id:d.id,...d.data()}))
 },
 async listCurrentTermMembers(){
  const st=await teamService.getCurrentStructure()
  return st.members||[]
 },
 async get(id){
  if(!isFirebaseConfigured) return seed(COLL).find(x=>x.id===id)||null
  const s=await safeGetDoc(doc(db,COLL,id)); return s && s.exists()?{id:s.id,...s.data()}:null
 },
 async create(data,actor){
  if(!isFirebaseConfigured) return {id:`demo-${Date.now()}`,...data}
  const ref=await addDoc(collection(db,COLL),{...data,archived:data.archived===true,createdAt:serverTimestamp(),updatedAt:serverTimestamp()}); if(actor) await auditService.log(actor,'create',COLL,ref.id,JSON.stringify(data).slice(0,200)); return {id:ref.id,...data}
 },
 async update(id,data,actor){
  if(!isFirebaseConfigured) return {id,...data}
  await updateDoc(doc(db,COLL,id),{...data,updatedAt:serverTimestamp()}); if(actor) await auditService.log(actor,'update',COLL,id,JSON.stringify(data).slice(0,200)); return {id,...data}
 },
 async remove(id,actor){
  if(!isFirebaseConfigured) return true
  await deleteDoc(doc(db,COLL,id)); if(actor) await auditService.log(actor,'delete',COLL,id,''); return true
 },
 
 async getCurrentStructure(){ if(!isFirebaseConfigured) return {terms:seed('termRecords'),members:seed('teamMembers'),teams:seed('teams')}; const termSnap=await getDocs(collection(db,'termRecords')); const terms=termSnap.docs.map(d=>({id:d.id,...d.data()})); terms.sort((a,b)=>String(b.label||'').localeCompare(String(a.label||''))); const current=terms.find(t=>t.isCurrent)||terms[0]||null; const members=current?await teamService.listByTerm(current.id):[]; return {terms,members,teams:[]} },
 async archiveTerm(termId,actor){ if(!isFirebaseConfigured) return true; await updateDoc(doc(db,'termRecords',termId),{archived:true,isCurrent:false,updatedAt:serverTimestamp()}); if(actor) await auditService.log(actor,'update','termRecords',termId,'archive term'); return true },
 async startNewTerm(label,copyMemberIds,actor){ if(!isFirebaseConfigured) return {id:label,label,isCurrent:true}; const oldTerms=await getDocs(query(collection(db,'termRecords'),where('isCurrent','==',true))); const ref=await addDoc(collection(db,'termRecords'),{label,isCurrent:true,archived:false,createdAt:serverTimestamp()}); for(const t of oldTerms.docs){ await updateDoc(doc(db,'termRecords',t.id),{isCurrent:false,archived:true,updatedAt:serverTimestamp()}) } if(copyMemberIds && copyMemberIds.length){ for(const memberId of copyMemberIds){ await updateDoc(doc(db,COLL,memberId),{termId:ref.id,updatedAt:serverTimestamp()}) } } if(actor) await auditService.log(actor,'create','termRecords',ref.id,label); return {id:ref.id,label} },
 async assignMember(id,data,actor){ return teamService.update(id,data,actor) },
 async replaceMember(id,data,actor){ return teamService.update(id,{...data,archived:false},actor) },
 async reassignCoCoordinator(id,teamIds,actor){ return teamService.update(id,{coCoordinatorOf:teamIds},actor) },

}
export default teamService
