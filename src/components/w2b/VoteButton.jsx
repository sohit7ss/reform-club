import React,{useState} from 'react'
import { useAuth } from '../../context/AuthContext.jsx'
import { useToast } from '../../context/ToastContext.jsx'
import { challengeService } from '../../services/challengeService.js'
import Button from '../ui/Button.jsx'
export default function VoteButton({challengeId,submissionId}){ const {user,loginGoogle}=useAuth(); const {push}=useToast(); const [voted,setVoted]=useState(false); if(!user) return <Button onClick={loginGoogle}>Sign in to vote</Button>; return <Button disabled={voted} onClick={async()=>{ try{ await challengeService.castVote(challengeId,submissionId,user); setVoted(true); push('Vote recorded — thank you!') }catch(e){ push(e.message,'error') } }}>{voted?'Voted ✓':'Vote for this project'}</Button> }
