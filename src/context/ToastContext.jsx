import React,{createContext,useContext,useState,useCallback} from 'react'
const Ctx=createContext(null)
export function ToastProvider({children}){ const [toasts,setToasts]=useState([]); const push=useCallback((msg,type='success')=>{ const id=Date.now()+Math.random(); setToasts(t=>[...t,{id,msg,type}]); setTimeout(()=>setToasts(t=>t.filter(x=>x.id!==id)),4500)},[]); return <Ctx.Provider value={{push,toast:push}}>{children}<div aria-live="polite" className="fixed bottom-4 right-4 z-50 space-y-2">{toasts.map(t=><div key={t.id} role="status" className={`px-4 py-3 rounded-xl shadow-card text-white ${t.type==='error'?'bg-red-700':'bg-teal-700'}`}>{t.msg}</div>)}</div></Ctx.Provider> }
export function useToast(){ return useContext(Ctx) }
export default Ctx
