import React,{useCallback,useEffect,useState} from 'react'
import DataTable from '../../components/admin/DataTable.jsx'
import PermissionGate from '../../components/admin/PermissionGate.jsx'
import StatusSelect from '../../components/admin/StatusSelect.jsx'
import Modal from '../../components/ui/Modal.jsx'
import ConfirmDialog from '../../components/ui/ConfirmDialog.jsx'
import Button from '../../components/ui/Button.jsx'
import Input from '../../components/ui/Input.jsx'
import Textarea from '../../components/ui/Textarea.jsx'
import { applicationService } from '../../services/applicationService.js'
import { settingsService } from '../../services/settingsService.js'
import { useAdminWrite } from '../../hooks/useAdminWrite.js'
import { useAuth } from '../../context/AuthContext.jsx'
import { useToast } from '../../context/ToastContext.jsx'
import { safeUrl } from '../../utils/sanitize.js'
const APP_STATUSES=['received','under_review','interview_scheduled','selected','not_selected']
const ROLE_TOGGLES=[['coAdmin','Co-Coordinator'],['teamHead','Team Head'],['teamMember','Team Member']]
export default function ApplicationsAdmin(){
 const {user,adminProfile}=useAuth()
 const {push}=useToast()
 const [rows,setRows]=useState([])
 const [detail,setDetail]=useState(null)
 const [noteText,setNoteText]=useState('')
 const [interviewDate,setInterviewDate]=useState('')
 const [deleteRow,setDeleteRow]=useState(null)
 const [settings,setSettings]=useState(null)
 const isCoordinator=adminProfile && adminProfile.role==='coordinator'
 const load=useCallback(async function loadRows(){ setRows(await applicationService.list()) },[])
 useEffect(function onMount(){ load() },[load])
 useEffect(function loadSettings(){ (async function fetchSettings(){ setSettings(await settingsService.get()) })() },[])
 const commit=useAdminWrite(user,push,load)
 const openDetail=function openDetailModal(row){ setDetail(row); setNoteText(''); setInterviewDate(row.interviewDate||'') }
 const changeStatus=async function doChangeStatus(row,status){
  const entry={status:status,at:new Date().toISOString(),byUid:user?user.uid:'',byName:user?user.email:''}
  try{
   await commit({run:function runStatus(){ return applicationService.updateStatus(row.id,status,user) },action:'update',collection:'applications',docId:row.id,summary:'application status set to '+status+': '+row.fullName,success:'Status updated to '+status.replaceAll('_',' ')+'.',local:function localStatus(){ setRows(function mapRows(rs){ return rs.map(function mapRow(r){ return r.id===row.id?Object.assign({},r,{status:status,statusHistory:(r.statusHistory||[]).concat([entry])}):r }) }); setDetail(function mapDetail(d){ return d && d.id===row.id?Object.assign({},d,{status:status,statusHistory:(d.statusHistory||[]).concat([entry])}):d }) }})
  }catch(err){ /* toast already shown */ }
 }
 const addNote=async function doAddNote(){
  if(!detail || !noteText.trim()){ push('Write a review note first.','error'); return }
  const entry={text:noteText.trim(),byUid:user?user.uid:'',byName:user?user.email:'',at:new Date().toISOString()}
  try{
   await commit({run:function runNote(){ return applicationService.addReviewNote(detail.id,{text:noteText.trim()},user) },action:'update',collection:'applications',docId:detail.id,summary:'review note added for '+detail.fullName,success:'Review note added.',local:function localNote(){ setRows(function mapRows(rs){ return rs.map(function mapRow(r){ return r.id===detail.id?Object.assign({},r,{reviewNotes:(r.reviewNotes||[]).concat([entry])}):r }) }); setDetail(function mapDetail(d){ return Object.assign({},d,{reviewNotes:(d.reviewNotes||[]).concat([entry])}) }) }})
   setNoteText('')
  }catch(err){ /* toast already shown */ }
 }
 const schedule=async function doSchedule(){
  if(!detail || !interviewDate){ push('Pick an interview date and time first.','error'); return }
  try{
   await commit({run:function runSchedule(){ return applicationService.scheduleInterview(detail.id,interviewDate,user) },action:'update',collection:'applications',docId:detail.id,summary:'interview scheduled for '+detail.fullName+' at '+interviewDate,success:'Interview scheduled.',local:function localSchedule(){ setRows(function mapRows(rs){ return rs.map(function mapRow(r){ return r.id===detail.id?Object.assign({},r,{interviewDate:interviewDate,status:'interview_scheduled'}):r }) }); setDetail(function mapDetail(d){ return Object.assign({},d,{interviewDate:interviewDate,status:'interview_scheduled'}) }) }})
  }catch(err){ /* toast already shown */ }
 }
 const confirmDelete=async function doDelete(){
  if(!deleteRow) return
  const row=deleteRow
  try{
   await commit({run:function runDelete(){ return applicationService.remove(row.id) },action:'delete',collection:'applications',docId:row.id,summary:'application deleted: '+row.fullName,success:'Application deleted.',local:function localDelete(){ setRows(function filterRows(rs){ return rs.filter(function keep(r){ return r.id!==row.id }) }) }})
   setDeleteRow(null); setDetail(null)
  }catch(err){ /* toast already shown */ }
 }
 const toggleRole=async function toggleRoleOpen(key){
  if(!settings) return
  const current=settings.applicationsOpen||{coAdmin:true,teamHead:true,teamMember:true}
  const next=Object.assign({},current)
  next[key]=current[key]===false?true:false
  try{
   await settingsService.update({applicationsOpen:next},user)
   setSettings(function mapSettings(s){ return Object.assign({},s,{applicationsOpen:next}) })
   push('Role application toggle saved.')
  }catch(err){ push(err.message,'error') }
 }
 return (
  <PermissionGate permission="applications">
   <h2 className="font-display text-2xl font-bold mb-4">Role applications</h2>
   <p className="text-sm mb-3">Statuses: received, under review, interview scheduled, selected, not selected. Status changes append to statusHistory and review notes carry author and time.</p>
   {isCoordinator && <section className="collage-card rounded-2xl p-5 mb-6">
    <h3 className="font-bold mb-3">Open / close role applications (Coordinator only)</h3>
    {ROLE_TOGGLES.map(function mapToggle(pair){
     const key=pair[0]
     const label=pair[1]
     const open=(settings && settings.applicationsOpen)?settings.applicationsOpen[key]!==false:true
     return (<label key={key} className="flex gap-2 items-center py-1 text-sm"><input type="checkbox" checked={open} onChange={function onToggle(){ toggleRole(key) }} /> {label} — {open?'Open':'Closed'}</label>)
    })}
   </section>}
   <DataTable rows={rows} columns={[
    {key:'fullName',label:'Name'},
    {key:'preferredRole',label:'Role'},
    {key:'preferredTeam',label:'Team'},
    {key:'status',label:'Status'},
    {key:'actions',label:'Actions',render:function renderActions(r){ return (<span className="flex flex-wrap gap-2"><button type="button" onClick={function onView(){ openDetail(r) }} className="underline">Review</button>{isCoordinator && <button type="button" onClick={function onDelete(){ setDeleteRow(r) }} className="underline text-red-700">Delete</button>}</span>) }}
   ]} searchKeys={['fullName','email','status']} />
   <Modal open={Boolean(detail)} onClose={function closeDetail(){ setDetail(null) }} title={detail?('Application — '+detail.fullName):'Application'}>
    {detail && <div className="mt-4 space-y-3 text-sm">
     <p><strong>Role:</strong> {detail.preferredRole} {detail.preferredTeam?('· Team: '+detail.preferredTeam):''}</p>
     <p><strong>Email:</strong> {detail.email} · <strong>Phone:</strong> {detail.phone||'—'}</p>
     <p><strong>Branch:</strong> {detail.branch||'—'} · <strong>Year:</strong> {detail.academicYear||'—'}</p>
     <p><strong>Reason:</strong> {detail.reason||'—'}</p>
     <p><strong>Skills:</strong> {detail.skills||'—'}</p>
     <p><strong>Portfolio:</strong> {safeUrl(detail.portfolioLink)?<a href={safeUrl(detail.portfolioLink)} target="_blank" rel="noopener noreferrer" className="text-clay font-bold">Open portfolio</a>:(detail.portfolioLink||'—')}</p>
     <p><strong>Additional info:</strong> {detail.additionalInfo||'—'}</p>
     <div className="flex gap-2 items-center"><span className="font-bold">Status:</span><StatusSelect value={detail.status||'received'} options={APP_STATUSES} onChange={function onStatus(s){ changeStatus(detail,s) }} /></div>
     <div>
      <p className="font-bold mb-1">Status history</p>
      {(detail.statusHistory||[]).length?(detail.statusHistory||[]).map(function mapHist(h,i){ return (<p key={i} className="py-1 border-b">{h.status} — {h.at||''} {h.byName?('by '+h.byName):''}</p>) }):<p>No status changes yet.</p>}
     </div>
     <div>
      <p className="font-bold mb-1">Review notes</p>
      {(detail.reviewNotes||[]).length?(detail.reviewNotes||[]).map(function mapNote(n,i){ return (<p key={i} className="py-1 border-b">{n.text} — {n.byName||''} {n.at||''}</p>) }):<p>No review notes yet.</p>}
      <Textarea label="Add a review note" id="review-note" value={noteText} onChange={function onNote(e){ setNoteText(e.target.value) }} rows={3} />
      <Button onClick={addNote}>Add note</Button>
     </div>
     <div>
      <p className="font-bold mb-1">Interview</p>
      <p>Current interview date: {detail.interviewDate||'not scheduled'}</p>
      <Input label="Interview date and time" id="interview-date" type="datetime-local" value={interviewDate} onChange={function onInterview(e){ setInterviewDate(e.target.value) }} />
      <Button onClick={schedule}>Schedule interview</Button>
     </div>
    </div>}
   </Modal>
   <ConfirmDialog open={Boolean(deleteRow)} onClose={function closeDelete(){ setDeleteRow(null) }} onConfirm={confirmDelete} title="Delete application?" body={deleteRow?('Delete the application from '+deleteRow.fullName+'? This cannot be undone.'):'This action cannot be undone.'} />
  </PermissionGate>
 )
}
