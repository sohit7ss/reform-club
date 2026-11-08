import React,{useState} from 'react'
import ArtworkCard from './ArtworkCard.jsx'
import Lightbox from '../ui/Lightbox.jsx'
import EmptyState from '../ui/EmptyState.jsx'
import Skeleton from '../ui/Skeleton.jsx'
import { useAuth } from '../../context/AuthContext.jsx'
import { useToast } from '../../context/ToastContext.jsx'
import { AnimatePresence } from 'framer-motion'
import { artworkService } from '../../services/artworkService.js'
export default function GalleryGrid({items,loading}){
 const [idx,setIdx]=useState(null)
 const [liked,setLiked]=useState({})
 const [counts,setCounts]=useState({})
 const {user,loginGoogle}=useAuth()
 const {push}=useToast()
 async function toggleLike(art){
  if(!user){ push('Sign in with Google to like artwork.','error'); try{ await loginGoogle() }catch(e){ push('Sign-in was cancelled.','error') } return }
  const wasLiked=!!liked[art.id]
  const nextLiked=Object.assign({},liked)
  nextLiked[art.id]=!wasLiked
  setLiked(nextLiked)
  const base=counts[art.id]!==undefined?counts[art.id]:(art.likeCount||0)
  const nextCounts=Object.assign({},counts)
  nextCounts[art.id]=base+(wasLiked?-1:1)
  setCounts(nextCounts)
  try{
   if(wasLiked){ await artworkService.unlike(art.id,user) } else { await artworkService.like(art.id,user) }
  }catch(e){
   const revertLiked=Object.assign({},liked)
   revertLiked[art.id]=wasLiked
   setLiked(revertLiked)
   const revertCounts=Object.assign({},counts)
   revertCounts[art.id]=base
   setCounts(revertCounts)
   push(e && e.message ? e.message : 'Could not update the like.','error')
  }
 }
 if(loading) return <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5"><Skeleton/><Skeleton/><Skeleton/></div>
 if(!items || !items.length) return <EmptyState title="No artworks yet" body="Approved artworks will appear here." />
 const shown=items.map(function(a){ const c=Object.assign({},a); if(counts[a.id]!==undefined){ c.likeCount=counts[a.id] } return c })
 return (<><div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">{shown.map((a,i)=><ArtworkCard key={a.id} art={a} onOpen={()=>setIdx(i)} liked={liked[a.id]} onLike={()=>toggleLike(a)} />)}</div><AnimatePresence>{idx!==null && <Lightbox items={shown} index={idx} onClose={()=>setIdx(null)} onPrev={()=>setIdx((idx-1+shown.length)%shown.length)} onNext={()=>setIdx((idx+1)%shown.length)} />}</AnimatePresence></>)
}
