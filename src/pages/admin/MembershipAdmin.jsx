import React,{useCallback,useEffect,useState} from 'react'
import DataTable from '../../components/admin/DataTable.jsx'
import PermissionGate from '../../components/admin/PermissionGate.jsx'
import Modal from '../../components/ui/Modal.jsx'
import Button from '../../components/ui/Button.jsx'
import Select from '../../components/ui/Select.jsx'
import Textarea from '../../components/ui/Textarea.jsx'
import { membershipService } from '../../services/membershipService.js'
import { useAdminWrite } from '../../hooks/useAdminWrite.js'
import { useAuth } from '../../context/AuthContext.jsx'
import { useToast } from '../../context/ToastContext.jsx'
import { safeUrl } from '../../utils/sanitize.js'
const STATUSES=[{value:'new',label:'New'},{value:'contacted',label:'Contacted'},{value:'approved',label:'Approved'},{value:'rejected',label:'Rejected'}]
function csvCell(v){ const s=String(v==null?'':v); return '"'+s.replaceAll('"','""')+'"' }
export default function MembershipAdmin(){
 const {user}=useAuth()
 const {push}=useToast()
 const [rows,setRows]=useState([])
 const [detail,setDetail]=useState(null)
 const [detailStatus,setDetailStatus]=useState('new')
 const [detailNotes,setDetailNotes]=useState('')
 const load=useCallback(async function loadRows(){ setRows(await membershipService.list()) },[])
 useEffect(function onMount(){ load() },[load])
 const commit=useAdminWrite(user,push,load)
 const openDetail=function openDetailModal(row){ setDetail(row); setDetailStatus(row.status||'new'); setDetailNotes(row.notes||'') }
 const saveDetail=async function saveDetailForm(){
  if(!detail) return
  const patch={status:detailStatus,notes:detailNotes}
  try{
   await commit({run:function runUpdate(){ return membershipService.update(detail.id,patch) },action:'update',collection:'membershipSubmissions',docId:detail.id,summary:'membership '+detailStatus+': '+detail.fullName,success:'Membership updated.',local:function localUpdate(){ setRows(function mapRows(rs){ return rs.map(function mapRow(r){ return r.id===detail.id?Object.assign({},r,patch):r }) }) }})
   setDetail(null)
  }catch(err){ /* toast already shown by commit */ }
 }
 const exportCsv=function exportCsvFile(){
  if(!rows.length){ push('Nothing to export yet.','error'); return }
  const header=['fullName','email','phone','branch','academicYear','interests','skills','portfolioLink','intro','status','notes']
  const lines=[header.join(',')].concat(rows.map(function mapRow(r){ return header.map(function mapCell(k){ const v=k==='interests'?((r.interests||[]).join('; ')):r[k]; return csvCell(v) }).join(',') }))
  const blob=new Blob([lines.join('\n')],{type:'text/csv'})
  const url=URL.createObjectURL(blob)
  const a=document.createElement('a')
  a.href=url; a.download='membership-submissions.csv'; a.click()
  URL.revokeObjectURL(url)
  push('CSV exported.')
 }
 return (
  <PermissionGate permission="membership">
   <h2 className="font-display text-2xl font-bold mb-4">Membership submissions</h2>
   <p className="text-sm mb-3">General membership is separate from role applications. Personal data is never shown publicly.</p>
   <Button onClick={exportCsv} className="mb-4">Export CSV</Button>
   <DataTable rows={rows} columns={[
    {key:'fullName',label:'Name'},
    {key:'email',label:'Email'},
    {key:'branch',label:'Branch'},
    {key:'academicYear',label:'Year'},
    {key:'status',label:'Status'},
    {key:'actions',label:'Actions',render:function renderActions(r){ return (<button type="button" onClick={function onView(){ openDetail(r) }} className="underline">View detail</button>) }}
   ]} searchKeys={['fullName','email','branch','status']} />
   <Modal open={Boolean(detail)} onClose={function closeDetail(){ setDetail(null) }} title={detail?('Membership — '+detail.fullName):'Membership detail'}>
    {detail && <div className="mt-4 space-y-2 text-sm">
     <p><strong>Email:</strong> {detail.email}</p>
     <p><strong>Phone:</strong> {detail.phone||'—'}</p>
     <p><strong>Branch:</strong> {detail.branch||'—'}</p>
     <p><strong>Academic year:</strong> {detail.academicYear||'—'}</p>
     <p><strong>Interests:</strong> {(detail.interests||[]).join(', ')||'—'}</p>
     <p><strong>Skills:</strong> {detail.skills||'—'}</p>
     <p><strong>Portfolio:</strong> {safeUrl(detail.portfolioLink)?<a href={safeUrl(detail.portfolioLink)} target="_blank" rel="noopener noreferrer" className="text-clay font-bold">Open portfolio</a>:(detail.portfolioLink||'—')}</p>
     <p><strong>Introduction:</strong> {detail.intro||'—'}</p>
     <Select label="Status" id="membership-status" value={detailStatus} onChange={function onStatus(e){ setDetailStatus(e.target.value) }}>{STATUSES.map(function mapStatus(s){ return <option key={s.value} value={s.value}>{s.label}</option> })}</Select>
     <Textarea label="Admin notes" id="membership-notes" value={detailNotes} onChange={function onNotes(e){ setDetailNotes(e.target.value) }} rows={4} />
     <div className="flex gap-2 justify-end"><button type="button" onClick={function closeDetail(){ setDetail(null) }} className="px-4 py-2 rounded-full border-2">Cancel</button><Button onClick={saveDetail}>Save status and notes</Button></div>
    </div>}
   </Modal>
  </PermissionGate>
 )
}
