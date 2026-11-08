import { getDoc } from 'firebase/firestore'
import { db, isFirebaseConfigured } from '../config/firebase.js'
import { seedData } from '../data/seed.js'
export const configured=()=>isFirebaseConfigured
export function seed(coll){ return (seedData[coll]||[]).map(x=>({...x})) }
export function demoWrite(coll,data){ const id=`demo-${Date.now()}`; return {id,...data} }
// Last round (item 2): getDoc on a missing document throws
// permission-denied when the read rule touches resource.data (the rule
// cannot evaluate a document that does not exist). Callers that show a
// 404 for a missing id use this instead of getDoc: a denied read becomes
// null (page shows "not found") and any other error still throws.
export async function safeGetDoc(ref){ try{ return await getDoc(ref) }catch(e){ if(e && (e.code==='permission-denied' || e.code==='unauthenticated')) return null; throw e } }
export { db }
