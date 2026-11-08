import { collection, addDoc, getDocs, query, orderBy, limit, serverTimestamp } from 'firebase/firestore'
import { db, isFirebaseConfigured } from '../config/firebase.js'
export const auditService={ async log(actor,action,coll,docId,summary){ if(!isFirebaseConfigured) { console.info('[audit-demo]',action,coll,docId); return } try{ await addDoc(collection(db,'auditLogs'),{actorUid:actor?.uid||'',actorEmail:actor?.email||'',action,collection:coll,docId,summary:summary||'',createdAt:serverTimestamp()}) }catch(e){ console.error('audit log failed',e)} }, async list(n=50){ if(!isFirebaseConfigured) return []; const s=await getDocs(query(collection(db,'auditLogs'),orderBy('createdAt','desc'),limit(n))); return s.docs.map(d=>({id:d.id,...d.data()})) } }
export default auditService
