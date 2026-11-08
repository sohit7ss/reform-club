import React,{useCallback,useEffect,useState} from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import DataTable from '../../components/admin/DataTable.jsx'
import PermissionGate from '../../components/admin/PermissionGate.jsx'
import FormField from '../../components/admin/FormField.jsx'
import StatusSelect from '../../components/admin/StatusSelect.jsx'
import Modal from '../../components/ui/Modal.jsx'
import ConfirmDialog from '../../components/ui/ConfirmDialog.jsx'
import Button from '../../components/ui/Button.jsx'
import Input from '../../components/ui/Input.jsx'
import { challengeSchema } from '../../schemas/challenge.js'
import { challengeService } from '../../services/challengeService.js'
import { useAdminWrite } from '../../hooks/useAdminWrite.js'
import { useAuth } from '../../context/AuthContext.jsx'
import { useToast } from '../../context/ToastContext.jsx'
const FLOW=['draft','open','voting','closed']
const STATUS_OPTIONS=FLOW.map(function mapStatus(s){ return {value:s,label:s.charAt(0).toUpperCase()+s.slice(1)} })
const VOTING_OPTIONS=[{value:'public',label:'Public voting'},{value:'judges',label:'Judges only'},{value:'both',label:'Public and judges'}]
const EMPTY={title:'',theme:'',description:'',rules:'',month:'',semester:'',category:'waste_to_best',status:'draft',submissionDeadline:'',votingMode:'both'}
export default function WasteToBestAdmin(){
 const {user}=useAuth()
 const {push}=useToast()
 const [rows,setRows]=useState([])
 const [editing,setEditing]=useState(null)
 const [formOpen,setFormOpen]=useState(false)
 const [deleteRow,setDeleteRow]=useState(null)
 const [reviewChallenge,setReviewChallenge]=useState(null)
 const [submissions,setSubmissions]=useState([])
 const [scores,setScores]=useState({})
 const [archive,setArchive]=useState([])
 const [board,setBoard]=useState([])
 const load=useCallback(async function loadRows(){ setRows(await challengeService.listAll()) },[])
 useEffect(function onMount(){ load() },[load])
 useEffect(function loadExtra(){ (async function fetchExtra(){ setArchive(await challengeService.getMonthlyWinnersArchive()); setBoard(await challengeService.getLeaderboard('2026-ODD')) })() },[])
 const commit=useAdminWrite(user,push,load)
 const {control,handleSubmit,reset,formState:{isSubmitting}}=useForm({resolver:zodResolver(challengeSchema),defaultValues:EMPTY})
 const openAdd=function openAddForm(){ setEditing(null); reset(EMPTY); setFormOpen(true) }
 const openEdit=function openEditForm(row){
  setEditing(row)
  reset({title:row.title||'',theme:row.theme||'',description:row.description||'',rules:row.rules||'',month:row.month||'',semester:row.semester||'',category:row.category||'waste_to_best',status:row.status||'draft',submissionDeadline:row.submissionDeadline||'',votingMode:row.votingMode||'both'})
  setFormOpen(true)
 }
 const onSubmit=async function submitChallenge(data){
  try{
   if(editing){
    const payload=Object.assign({},data)
    await commit({run:function runUpdate(){ return challengeService.update(editing.id,payload) },action:'update',collection:'challenges',docId:editing.id,summary:'challenge updated: '+payload.title,success:'Challenge updated.',local:function localUpdate(){ setRows(function mapRows(rs){ return rs.map(function mapRow(r){ return r.id===editing.id?Object.assign({},r,payload):r }) }) }})
   } else {
    await commit({run:function runCreate(){ return challengeService.create(data) },action:'create',collection:'challenges',docId:'new',summary:'challenge created: '+data.title,success:'Challenge created.',local:function localAdd(result){ setRows(function prependRows(rs){ return [Object.assign({},data,{id:result.id})].concat(rs) }) }})
   }
   setFormOpen(false)
  }catch(err){ /* toast already shown by commit */ }
 }
 const setStatus=async function doSetStatus(row,status){
  try{
   await commit({run:function runStatus(){ return challengeService.update(row.id,{status:status}) },action:'update',collection:'challenges',docId:row.id,summary:'challenge status set to '+status+': '+row.title,success:'Challenge moved to '+status+'.',local:function localStatus(){ setRows(function mapRows(rs){ return rs.map(function mapRow(r){ return r.id===row.id?Object.assign({},r,{status:status}):r }) }) }})
  }catch(err){ /* toast already shown */ }
 }
 const advanceStatus=function advance(row){
  const idx=FLOW.indexOf(row.status)
  if(idx<0 || idx>=FLOW.length-1){ push('This challenge is already at the final stage.','error'); return }
  setStatus(row,FLOW[idx+1])
 }
 const confirmDelete=async function doDelete(){
  if(!deleteRow) return
  const row=deleteRow
  try{
   await commit({run:function runDelete(){ return challengeService.remove(row.id) },action:'delete',collection:'challenges',docId:row.id,summary:'challenge deleted: '+row.title,success:'Challenge deleted.',local:function localDelete(){ setRows(function filterRows(rs){ return rs.filter(function keep(r){ return r.id!==row.id }) }) }})
   setDeleteRow(null)
  }catch(err){ /* toast already shown */ }
 }
 const openReview=async function openReviewPanel(row){
  setReviewChallenge(row)
  setSubmissions(await challengeService.listSubmissions(row.id))
  setScores({})
 }
 const reviewSubmission=async function doReview(sub,status){
  if(!reviewChallenge) return
  try{
   await commit({run:function runReview(){ return challengeService.reviewSubmission(reviewChallenge.id,sub.id,status) },action:'update',collection:'submissions',docId:sub.id,summary:'submission '+status+': '+sub.projectTitle,success:'Submission '+status+'.',local:function localReview(){ setSubmissions(function mapSubs(ss){ return ss.map(function mapSub(s){ return s.id===sub.id?Object.assign({},s,{status:status}):s }) }) }})
  }catch(err){ /* toast already shown */ }
 }
 const saveScore=async function doSaveScore(sub){
  if(!reviewChallenge) return
  const raw=scores[sub.id]
  const score=Number(raw)
  if(raw==null || raw==='' || Number.isNaN(score) || score<0 || score>10){ push('Enter a judge score from 0 to 10.','error'); return }
  try{
   await commit({run:function runScore(){ return challengeService.setJudgeScore(reviewChallenge.id,sub.id,score) },action:'update',collection:'submissions',docId:sub.id,summary:'judge score '+score+' for '+sub.projectTitle,success:'Judge score saved.',local:function localScore(){ setSubmissions(function mapSubs(ss){ return ss.map(function mapSub(s){ return s.id===sub.id?Object.assign({},s,{judgeScore:score}):s }) }) }})
  }catch(err){ push(err.message,'error') }
 }
 const announce=async function doAnnounce(sub){
  if(!reviewChallenge) return
  try{
   await commit({run:function runWinner(){ return challengeService.announceWinner(reviewChallenge.id,sub.id) },action:'update',collection:'challenges',docId:reviewChallenge.id,summary:'winner announced for '+reviewChallenge.title+': '+sub.projectTitle,success:'Winner announced and challenge closed.',local:function localWinner(){ setRows(function mapRows(rs){ return rs.map(function mapRow(r){ return r.id===reviewChallenge.id?Object.assign({},r,{winnerSubmissionId:sub.id,status:'closed'}):r }) }); setReviewChallenge(function mapChallenge(c){ return Object.assign({},c,{winnerSubmissionId:sub.id,status:'closed'}) }) }})
  }catch(err){ /* toast already shown */ }
 }
 return (
  <PermissionGate permission="waste2best">
   <h2 className="font-display text-2xl font-bold mb-4">Waste to Best — challenges</h2>
   <p className="text-sm mb-3">Lifecycle: draft, open, voting, closed. Voting is one vote per user per challenge. Judge scores count toward the semester leaderboard.</p>
   <Button onClick={openAdd} className="mb-4">Add challenge</Button>
   <DataTable rows={rows} columns={[
    {key:'title',label:'Title'},
    {key:'month',label:'Month'},
    {key:'semester',label:'Semester'},
    {key:'status',label:'Status',render:function renderStatus(r){ return (<StatusSelect value={r.status||'draft'} options={FLOW} onChange={function onStatus(s){ setStatus(r,s) }} />) }},
    {key:'votingMode',label:'Voting'},
    {key:'actions',label:'Actions',render:function renderActions(r){ return (<span className="flex flex-wrap gap-2"><button type="button" onClick={function onEdit(){ openEdit(r) }} className="underline">Edit</button><button type="button" onClick={function onAdvance(){ advanceStatus(r) }} className="underline">Advance stage</button><button type="button" onClick={function onReview(){ openReview(r) }} className="underline">Review submissions</button><button type="button" onClick={function onDelete(){ setDeleteRow(r) }} className="underline text-red-700">Delete</button></span>) }}
   ]} searchKeys={['title','month','semester','status']} />
   {reviewChallenge && <section className="collage-card rounded-2xl p-5 mt-6">
    <div className="flex justify-between items-center"><h3 className="font-bold text-lg">Submissions — {reviewChallenge.title} ({reviewChallenge.status})</h3><button type="button" onClick={function closeReview(){ setReviewChallenge(null) }} className="underline text-sm">Close review</button></div>
    {reviewChallenge.winnerSubmissionId && <p className="text-sm mt-2">Winner submission: {reviewChallenge.winnerSubmissionId}</p>}
    <div className="space-y-3 mt-3">{submissions.map(function mapSub(s){ return (
     <div key={s.id} className="bg-white rounded-xl border border-sand p-4 text-sm">
      <p><strong>{s.projectTitle}</strong> by {s.participantName} — status: {s.status||'pending'} · votes: {s.voteCount||0} · judge score: {s.judgeScore==null?'—':s.judgeScore}</p>
      <p className="mt-1">{s.description||''}</p>
      <p className="mt-1">Made from: {s.materialsUsed||'—'}</p>
      <div className="flex flex-wrap gap-2 items-center mt-3">
       <button type="button" onClick={function onApprove(){ reviewSubmission(s,'approved') }} className="underline">Approve</button>
       <button type="button" onClick={function onReject(){ reviewSubmission(s,'rejected') }} className="underline">Reject</button>
       <Input label="Judge score (0-10)" id={'score-'+s.id} type="number" value={scores[s.id]==null?'':scores[s.id]} onChange={function onScore(e){ const next=Object.assign({},scores); next[s.id]=e.target.value; setScores(next) }} />
       <Button onClick={function onSaveScore(){ saveScore(s) }}>Save score</Button>
       {s.status==='approved' && <Button onClick={function onAnnounce(){ announce(s) }}>Announce as winner</Button>}
      </div>
     </div>
    ) })}{!submissions.length && <p className="text-sm">No submissions for this challenge yet.</p>}</div>
   </section>}
   <div className="grid md:grid-cols-2 gap-6 mt-6">
    <section className="collage-card rounded-2xl p-5">
     <h3 className="font-bold mb-3">Semester leaderboard</h3>
     {board.length?board.map(function mapBoard(b,i){ return (<p key={i} className="text-sm py-1 border-b">{b.participantName||b.name} — {b.score??b.points} points</p>) }):<p className="text-sm">No leaderboard entries yet.</p>}
    </section>
    <section className="collage-card rounded-2xl p-5">
     <h3 className="font-bold mb-3">Monthly winners archive</h3>
     {archive.length?archive.map(function mapArch(c){ return (<p key={c.id} className="text-sm py-1 border-b"><strong>{c.month}</strong> — {c.title}</p>) }):<p className="text-sm">No closed challenges yet.</p>}
    </section>
   </div>
   <Modal open={formOpen} onClose={function closeForm(){ setFormOpen(false) }} title={editing?'Edit challenge':'Add challenge'}>
    <form onSubmit={handleSubmit(onSubmit)} className="mt-4">
     <FormField control={control} name="title" label="Title" />
     <FormField control={control} name="theme" label="Theme" />
     <FormField control={control} name="description" label="Description" type="textarea" />
     <FormField control={control} name="rules" label="Rules" type="textarea" />
     <FormField control={control} name="month" label="Month (YYYY-MM)" placeholder="2026-11" />
     <FormField control={control} name="semester" label="Semester" placeholder="2026-ODD" />
     <FormField control={control} name="category" label="Category" />
     <FormField control={control} name="status" label="Status" type="select" options={STATUS_OPTIONS} />
     <FormField control={control} name="submissionDeadline" label="Submission deadline" type="datetime-local" />
     <FormField control={control} name="votingMode" label="Voting mode" type="select" options={VOTING_OPTIONS} />
     <div className="flex gap-2 justify-end mt-4"><button type="button" onClick={function closeForm(){ setFormOpen(false) }} className="px-4 py-2 rounded-full border-2">Cancel</button><Button disabled={isSubmitting}>{isSubmitting?'Saving…':'Save challenge'}</Button></div>
    </form>
   </Modal>
   <ConfirmDialog open={Boolean(deleteRow)} onClose={function closeDelete(){ setDeleteRow(null) }} onConfirm={confirmDelete} title="Delete challenge?" body={deleteRow?('Delete “'+deleteRow.title+'”? This cannot be undone.'):'This action cannot be undone.'} />
  </PermissionGate>
 )
}
