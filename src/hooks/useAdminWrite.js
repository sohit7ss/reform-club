import { useCallback } from 'react'
import { isFirebaseConfigured } from '../config/firebase.js'
import { auditService } from '../services/auditService.js'
export function useAdminWrite(user,push,load){
 const commit=useCallback(async function commitJob(job){
  try{
   const result=await job.run()
   await auditService.log(user,job.action,job.collection,job.docId,job.summary||'')
   if(isFirebaseConfigured){
    if(load){ await load() }
   } else if(job.local){
    job.local(result)
   }
   push(job.success||'Saved.')
   return result
  }catch(err){
   push(err && err.message ? err.message : 'Something went wrong.','error')
   throw err
  }
 },[user,push,load])
 return commit
}
export default useAdminWrite
