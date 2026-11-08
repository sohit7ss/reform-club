import { collection, doc, getDocs, getDoc, addDoc, setDoc, updateDoc, deleteDoc, query, where, orderBy, limit, startAfter, serverTimestamp } from 'firebase/firestore'
import { db, isFirebaseConfigured } from '../config/firebase.js'
import { seed, safeGetDoc } from './_helpers.js'
import { auditService } from './auditService.js'
const COLL='challenges'
function aggregateLeaderboard(subs){
 const by=new Map()
 for(const s of subs){
  const key=s.uid||('name:'+(s.participantName||''))
  const row=by.get(key)||{participantName:s.participantName,uid:s.uid||null,score:0,voteCount:0,judgeScore:0,challengeCount:0,_challenges:new Set()}
  row.score+=(s.voteCount||0)+(s.judgeScore||0)*5
  row.voteCount+=(s.voteCount||0)
  row.judgeScore+=(s.judgeScore||0)
  if(s.challengeId) row._challenges.add(s.challengeId)
  row.challengeCount=row._challenges.size
  by.set(key,row)
 }
 return Array.from(by.values()).map(function strip(r){ const {_challenges,...rest}=r; return rest }).sort((a,b)=>b.score-a.score)
}
export const challengeService={
 async list(filters={}){
  // Last round (item 5): the public list shows only open, voting and
  // closed challenges — never drafts. The where('status','in',...) filter
  // is what makes the query pass the rules for a signed-out reader: an
  // unfiltered query would be denied outright once a draft exists. Single
  // field filter, so no composite index is needed; sorted in JS.
  if(!isFirebaseConfigured) return seed(COLL).filter(c=>['open','voting','closed'].indexOf(c.status)>=0).sort((a,b)=>String(b.createdAt||'').localeCompare(String(a.createdAt||'')))
  const s=await getDocs(query(collection(db,COLL),where('status','in',['open','voting','closed']))); return s.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>String(b.createdAt||'').localeCompare(String(a.createdAt||'')))
 },
 async listAll(filters={}){
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
 
 async getMySubmission(challengeId,uid){ if(!isFirebaseConfigured) return seed('submissions').find(function matchMine(s){ return s.challengeId===challengeId && s.uid===uid })||null; const s=await safeGetDoc(doc(db,COLL,challengeId,'submissions',uid)); return s && s.exists()?Object.assign({id:s.id,challengeId},s.data()):null },
 async submitSubmission(challengeId,data,user){ if(!isFirebaseConfigured) return Object.assign({id:user.uid,challengeId},data,{status:'pending',voteCount:0,judgeScore:null,uid:user.uid,createdAt:new Date().toISOString()}); const existing=await getDoc(doc(db,COLL,challengeId,'submissions',user.uid)); if(existing.exists()) throw new Error('You have already submitted a project to this challenge.'); const payload=Object.assign({},data,{uid:user.uid,status:'pending',voteCount:0,judgeScore:null,createdAt:serverTimestamp(),updatedAt:serverTimestamp()}); await setDoc(doc(db,COLL,challengeId,'submissions',user.uid),payload); return Object.assign({id:user.uid,challengeId},payload) },
 async castVote(challengeId,submissionId,user,actor){ if(!isFirebaseConfigured) return {ok:true,demo:true}; const { runTransaction, doc, getDoc, increment }=await import('firebase/firestore'); return runTransaction(db, async(tx)=>{ const voterRef=doc(db,'challenges',challengeId,'voters',user.uid); const voter=await tx.get(voterRef); if(voter.exists()) throw new Error('You have already voted in this challenge.'); const subRef=doc(db,'challenges',challengeId,'submissions',submissionId); tx.set(doc(db,'challenges',challengeId,'submissions',submissionId,'votes',user.uid),{createdAt:serverTimestamp()}); tx.set(voterRef,{submissionId,createdAt:serverTimestamp()}); tx.update(subRef,{voteCount:increment(1)}); return {ok:true} }) },
 async setJudgeScore(challengeId,submissionId,score,actor){ if(!isFirebaseConfigured) return {id:submissionId,judgeScore:score}; await updateDoc(doc(db,'challenges',challengeId,'submissions',submissionId),{judgeScore:score}); return {id:submissionId,judgeScore:score} },
 async announceWinner(challengeId,submissionId,actor){ return challengeService.update(challengeId,{winnerSubmissionId:submissionId,winnerAnnouncedAt:serverTimestamp(),status:'closed'},actor) },
 async getLeaderboard(semester){
  if(!isFirebaseConfigured){
   const challenges=seed('challenges').filter(c=>!semester||c.semester===semester)
   const ids=new Set(challenges.map(c=>c.id))
   return aggregateLeaderboard(seed('submissions').filter(s=>ids.has(s.challengeId)))
  }
  // Last round (item 5): go through list(), which only returns public
  // (open/voting/closed) challenges. A direct semester query would be
  // denied for a signed-out reader once a draft shares the semester.
  const cs=(await challengeService.list()).filter(c=>!semester||c.semester===semester).sort((a,b)=>String(b.month||'').localeCompare(String(a.month||'')))
  const allSubs=[]
  for(const c of cs){ const subs=await challengeService.listApprovedSubmissions(c.id); for(const s of subs) allSubs.push(Object.assign({},s,{challengeId:c.id})) }
  return aggregateLeaderboard(allSubs)
 },
 async getMonthlyWinnersArchive(){ if(!isFirebaseConfigured) return seed('challenges').filter(c=>c.status==='closed'); const s=await getDocs(query(collection(db,'challenges'),where('status','==','closed'),orderBy('month','desc'))); return s.docs.map(d=>({id:d.id,...d.data()})) },
 async listSubmissions(challengeId){ if(!isFirebaseConfigured) return seed('submissions').filter(function matchChallenge(s){ return s.challengeId===challengeId }); const s=await getDocs(collection(db,'challenges',challengeId,'submissions')); return s.docs.map(function mapSub(d){ return Object.assign({id:d.id},d.data()) }) },
 async listAllSubmissions(challengeId){ return challengeService.listSubmissions(challengeId) },
 async listApprovedSubmissions(challengeId){
  if(!isFirebaseConfigured) return seed('submissions').filter(function matchApproved(s){ return s.challengeId===challengeId && s.status==='approved' })
  const s=await getDocs(query(collection(db,'challenges',challengeId,'submissions'),where('status','==','approved'),orderBy('createdAt','desc'))); return s.docs.map(function mapSub(d){ return Object.assign({id:d.id,challengeId},d.data()) })
 },
 async reviewSubmission(challengeId,submissionId,status,actor){ if(!isFirebaseConfigured) return {id:submissionId,status:status}; await updateDoc(doc(db,'challenges',challengeId,'submissions',submissionId),{status:status,updatedAt:serverTimestamp()}); if(actor) await auditService.log(actor,'update','submissions',submissionId,'submission '+status); return {id:submissionId,status:status} },

}
export default challengeService
