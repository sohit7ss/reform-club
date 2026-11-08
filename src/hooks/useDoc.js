import {useEffect,useState} from 'react'
import { doc, getDoc } from 'firebase/firestore'
import { db, isFirebaseConfigured } from '../config/firebase.js'
export function useDoc(coll,id,fallback=null){ const [data,setData]=useState(fallback); const [loading,setLoading]=useState(true); useEffect(()=>{ let live=true; (async()=>{ if(!isFirebaseConfigured||!id){ setData(fallback); setLoading(false); return } try{ const s=await getDoc(doc(db,coll,id)); if(live) setData(s.exists()?{id:s.id,...s.data()}:fallback)}catch{ if(live) setData(fallback)} finally{ if(live) setLoading(false)} })(); return ()=>{live=false} },[coll,id]); return {data,loading} }
export default useDoc
