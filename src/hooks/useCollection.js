import {useEffect,useState} from 'react'
import { collection, query, where, orderBy, limit, getDocs } from 'firebase/firestore'
import { db, isFirebaseConfigured } from '../config/firebase.js'
export function useCollection(coll, constraints=[], fallback=[]){
 const [data,setData]=useState(fallback); const [loading,setLoading]=useState(true); const [error,setError]=useState(null)
 useEffect(()=>{ let live=true; (async()=>{ if(!isFirebaseConfigured){ setData(fallback); setLoading(false); return } try{ const q=query(collection(db,coll),...constraints); const s=await getDocs(q); if(live) setData(s.docs.map(d=>({id:d.id,...d.data()}))) }catch(e){ if(live) setError(e) } finally{ if(live) setLoading(false)} })(); return ()=>{live=false} },[coll, JSON.stringify(constraints.map(c=>String(c)) )])
 return {data,loading,error}
}
export default useCollection
