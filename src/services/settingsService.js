import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore'
import { db, isFirebaseConfigured } from '../config/firebase.js'
import { seedData } from '../data/seed.js'
import { auditService } from './auditService.js'
export const settingsService={ async get(){ if(!isFirebaseConfigured) return seedData.siteSettings; const s=await getDoc(doc(db,'siteSettings','main')); return s.exists()?s.data():seedData.siteSettings }, async update(data,actor){ if(!isFirebaseConfigured) return data; await setDoc(doc(db,'siteSettings','main'),{...data,updatedAt:serverTimestamp()},{merge:true}); if(actor) await auditService.log(actor,'update','siteSettings','main','settings updated'); return data } }
export default settingsService
