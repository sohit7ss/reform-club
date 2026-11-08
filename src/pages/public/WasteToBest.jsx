import React,{useEffect,useState} from 'react'
import PageShell from '../../components/layout/PageShell.jsx'
import ChallengeBanner from '../../components/w2b/ChallengeBanner.jsx'
import SubmissionCard from '../../components/w2b/SubmissionCard.jsx'
import WinnerBanner from '../../components/w2b/WinnerBanner.jsx'
import Leaderboard from '../../components/w2b/Leaderboard.jsx'
import VoteButton from '../../components/w2b/VoteButton.jsx'
import Button from '../../components/ui/Button.jsx'
import Input from '../../components/ui/Input.jsx'
import Textarea from '../../components/ui/Textarea.jsx'
import Select from '../../components/ui/Select.jsx'
import Modal from '../../components/ui/Modal.jsx'
import { useAuth } from '../../context/AuthContext.jsx'
import { useToast } from '../../context/ToastContext.jsx'
import { challengeService } from '../../services/challengeService.js'
import { uploadService } from '../../services/uploadService.js'
import { w2bSubmissionSchema } from '../../schemas/submission.js'
import { validateImageFile } from '../../utils/validateFile.js'
const EMPTY_FORM={participantName:'',branch:'',academicYear:'1st Year',projectTitle:'',description:'',howMade:'',materialsUsed:''}
function closedMessage(status){
 if(status==='voting') return 'Submissions are closed for this challenge — voting is now open. You can vote for an approved project below.'
 if(status==='closed') return 'This challenge is closed. The winner is shown above and the next monthly challenge will open soon.'
 if(status==='draft') return 'This challenge is not open for submissions yet. Check back once the club opens it.'
 return 'No Waste to Best challenge is open right now. Check back soon for the next monthly challenge.'
}
export default function WasteToBest(){
 const {user,loginGoogle}=useAuth()
 const {push}=useToast()
 const [challenges,setChallenges]=useState([])
 const [board,setBoard]=useState([])
 const [subs,setSubs]=useState([])
 const [archive,setArchive]=useState([])
 const [form,setForm]=useState(EMPTY_FORM)
 const [files,setFiles]=useState([])
 const [fileError,setFileError]=useState('')
 const [fieldErrors,setFieldErrors]=useState({})
 const [progress,setProgress]=useState('')
 const [uploadPct,setUploadPct]=useState(null)
 const [submitting,setSubmitting]=useState(false)
 const [showSuccess,setShowSuccess]=useState(false)
 useEffect(()=>{ (async()=>{ setChallenges(await challengeService.list()); setBoard(await challengeService.getLeaderboard('2026-ODD')); setArchive(await challengeService.getMonthlyWinnersArchive()) })() },[])
 const current=challenges.find(c=>c.status==='open'||c.status==='voting')||challenges[0]
 const isOpen=current && current.status==='open'
 useEffect(()=>{ if(!current) { setSubs([]); return }; (async()=>{ setSubs(await challengeService.listApprovedSubmissions(current.id)) })() },[current?.id])
 const winner=current?.winnerSubmissionId?subs.find(s=>s.id===current.winnerSubmissionId):null
 function setField(name,value){ const next=Object.assign({},form); next[name]=value; setForm(next) }
 function onFilesPicked(list){
  const picked=Array.prototype.slice.call(list)
  if(picked.length<1||picked.length>5){ setFileError('Choose 1 to 5 images.'); setFiles([]); return }
  for(let i=0;i<picked.length;i++){ const err=validateImageFile(picked[i]); if(err){ setFileError(err); setFiles([]); return } }
  setFileError('')
  setFiles(picked)
 }
 async function onSubmit(e){
  e.preventDefault()
  if(!isOpen||!user||submitting) return
  if(user.emailVerified===false){ push('Please verify your email before submitting. Check your inbox for the verification link.','error'); return }
  const existing=await challengeService.getMySubmission(current.id,user.uid)
  if(existing){ push('You have already submitted a project to this challenge.','error'); return }
  if(files.length<1||files.length>5){ setFileError('Choose 1 to 5 images.'); return }
  setSubmitting(true)
  setProgress('')
  setFieldErrors({})
  try{
   const imageUrls=[]
   const imagePaths=[]
   for(let i=0;i<files.length;i++){
    setProgress('Uploading image ' + (i+1) + ' of ' + files.length + '…')
    setUploadPct(0)
    const up=await uploadService.uploadImage(files[i],'w2b',function onProgress(p){ setUploadPct(p) })
    imageUrls.push(up.url)
    imagePaths.push(up.path)
   }
   setUploadPct(null)
   setProgress('')
   const payload=Object.assign({},form,{imageUrls:imageUrls,imagePaths:imagePaths})
   const check=w2bSubmissionSchema.safeParse(payload)
   if(!check.success){
    const errs={}
    check.error.issues.forEach(function(issue){ errs[issue.path[0]]=issue.message })
    setFieldErrors(errs)
    setSubmitting(false)
    return
   }
   await challengeService.submitSubmission(current.id,payload,user)
   setForm(EMPTY_FORM)
   setFiles([])
   setShowSuccess(true)
   push('Submitted for review. Thank you!')
  }catch(err){ setUploadPct(null); push(err.message||'Submission failed. Please try again.','error') }
  setSubmitting(false)
 }
 return (<PageShell title="Waste to Best" description="Waste to Best — turn discarded materials into creative, useful products."><h1 className="font-display text-3xl font-black mb-4">Waste to Best</h1><p className="mb-4">Transform discarded or unused materials into useful, creative products. Challenges are category-generic — each challenge carries its own <code>category</code> (default <code>waste_to_best</code>), so future categories work without code changes.</p><ChallengeBanner challenge={current} /><WinnerBanner winner={winner} />
 <section className="collage-card rounded-2xl p-5 mb-8"><h2 className="font-display text-2xl font-bold mb-3">Submit your project</h2>
 {isOpen ? (user ? (
 <form onSubmit={onSubmit}>
  {user.emailVerified===false && <p role="alert" className="text-red-700 text-sm mb-3">Please verify your email before submitting. Check your inbox for the verification link — Google sign-in accounts are normally verified already.</p>}
  <Input label="Participant name" id="w2b-participantName" value={form.participantName} onChange={function(e){ setField('participantName',e.target.value) }} error={fieldErrors.participantName} />
  <Input label="Branch / Department" id="w2b-branch" value={form.branch} onChange={function(e){ setField('branch',e.target.value) }} error={fieldErrors.branch} />
  <Select label="Academic year" id="w2b-academicYear" value={form.academicYear} onChange={function(e){ setField('academicYear',e.target.value) }} error={fieldErrors.academicYear}><option value="1st Year">1st Year</option><option value="2nd Year">2nd Year</option><option value="3rd Year">3rd Year</option><option value="4th Year">4th Year</option><option value="Postgraduate">Postgraduate</option><option value="Other">Other</option></Select>
  <Input label="Project title" id="w2b-projectTitle" value={form.projectTitle} onChange={function(e){ setField('projectTitle',e.target.value) }} error={fieldErrors.projectTitle} />
  <Textarea label="Description" id="w2b-description" value={form.description} onChange={function(e){ setField('description',e.target.value) }} error={fieldErrors.description} />
  <Textarea label="How it was made" id="w2b-howMade" value={form.howMade} onChange={function(e){ setField('howMade',e.target.value) }} error={fieldErrors.howMade} />
  <Textarea label="Materials used" id="w2b-materialsUsed" value={form.materialsUsed} onChange={function(e){ setField('materialsUsed',e.target.value) }} error={fieldErrors.materialsUsed} />
  <div className="mb-3"><label htmlFor="w2b-images" className="block font-bold text-sm mb-1">Project images (1 to 5, JPEG / PNG / WebP, max 5 MB each)</label><input id="w2b-images" type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={function(e){ onFilesPicked(e.target.files) }} className="w-full" />{files.length>0 && <p className="text-sm mt-1">{files.length} image(s) selected.</p>}{fileError && <p role="alert" className="text-red-700 text-sm">{fileError}</p>}{fieldErrors.imageUrls && <p role="alert" className="text-red-700 text-sm">{fieldErrors.imageUrls}</p>}</div>
  {progress && <p role="status" className="text-sm font-bold mb-3">{progress}{uploadPct!==null?' '+uploadPct+'%':''}</p>}
  {uploadPct!==null && <div className="mb-3"><progress className="w-full" value={uploadPct} max="100">{uploadPct}%</progress><p role="status" className="text-sm text-center">{uploadPct}% uploaded</p></div>}
  <Button type="submit" disabled={submitting}>{submitting?'Submitting…':'Submit for review'}</Button>
  <p className="text-sm mt-3">Your project goes to the club for review with status pending. Approved projects appear in the grid below.</p>
 </form>
 ) : (<div><p className="font-bold mb-3">Sign in with Google to submit a project to the open challenge.</p><Button onClick={loginGoogle}>Sign in with Google</Button></div>)
 ) : (<div><p className="font-bold mb-2">Submissions are not open right now.</p><p>{closedMessage(current ? current.status : '')}</p><Button disabled={true} className="mt-3">Submit for review</Button></div>)}
 </section>
 <h2 className="font-display text-2xl font-bold mb-3">Approved projects</h2><div className="grid sm:grid-cols-2 gap-5 mb-8">{subs.map(s=><div key={s.id}><SubmissionCard s={s} />{current?.status==='voting' && <div className="mt-2"><VoteButton challengeId={current.id} submissionId={s.id} /></div>}</div>)}{!subs.length && <p>No approved submissions yet for this challenge.</p>}</div><div className="grid md:grid-cols-2 gap-6"><section><h2 className="font-display text-2xl font-bold mb-3">Semester leaderboard</h2><Leaderboard rows={board} /></section><section><h2 className="font-display text-2xl font-bold mb-3">Monthly winners archive</h2>{archive.length?archive.map(c=><p key={c.id} className="collage-card rounded-xl p-3 mb-2"><strong>{c.month}</strong> — {c.title} ({c.theme})</p>):<p>No archived winners yet.</p>}</section></div>
 <Modal open={showSuccess} onClose={function(){ setShowSuccess(false) }} title="Submission received"><p>Thank you! Your Waste to Best project was submitted for review. The club will approve it before it appears in the approved projects grid.</p><div className="mt-4"><Button onClick={function(){ setShowSuccess(false) }}>Done</Button></div></Modal>
 </PageShell>) }
