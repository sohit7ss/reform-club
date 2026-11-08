import React,{createContext,useContext,useEffect,useState,useCallback} from 'react'
import { onAuthStateChanged, signInWithEmailAndPassword, signInWithPopup, GoogleAuthProvider, signOut } from 'firebase/auth'
import { doc, getDoc } from 'firebase/firestore'
import { auth, db, isFirebaseConfigured } from '../config/firebase.js'
import { canPermission } from '../config/roles.js'
const Ctx=createContext(null)
export function AuthProvider({children}){
 const [user,setUser]=useState(null); const [adminProfile,setAdminProfile]=useState(null); const [loading,setLoading]=useState(true)
 const [lastActivity,setLastActivity]=useState(Date.now())
 useEffect(()=>{ if(!isFirebaseConfigured){ setLoading(false); return } const un=onAuthStateChanged(auth, async(u)=>{ setUser(u||null); if(u&&db){ try{ const s=await getDoc(doc(db,'admins',u.uid)); setAdminProfile(s.exists()?{uid:u.uid,...s.data()}:null)}catch{setAdminProfile(null)} } else setAdminProfile(null); setLoading(false)}); return un },[])
 useEffect(()=>{ if(!adminProfile) return; const bump=()=>setLastActivity(Date.now()); ['click','keydown','mousemove'].forEach(e=>window.addEventListener(e,bump)); const t=setInterval(()=>{ if(Date.now()-lastActivity>30*60*1000 && auth){ signOut(auth).catch(()=>{}) } },60000); return ()=>{ ['click','keydown','mousemove'].forEach(e=>window.removeEventListener(e,bump)); clearInterval(t)} },[adminProfile,lastActivity])
 const loginEmail=useCallback((e,p)=>signInWithEmailAndPassword(auth,e,p),[])
 const loginGoogle=useCallback(()=>signInWithPopup(auth,new GoogleAuthProvider()),[])
 const logout=useCallback(()=>signOut(auth),[])
 const can=useCallback((perm)=>canPermission(adminProfile,perm),[adminProfile])
 return <Ctx.Provider value={{user,adminProfile,isAdmin:!!adminProfile,can,loading,loginEmail,loginGoogle,logout,configured:isFirebaseConfigured}}>{children}</Ctx.Provider>
}
export function useAuth(){ return useContext(Ctx) }
export default Ctx
