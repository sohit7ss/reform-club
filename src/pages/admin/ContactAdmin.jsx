import React,{useCallback,useEffect,useState} from 'react'
import DataTable from '../../components/admin/DataTable.jsx'
import PermissionGate from '../../components/admin/PermissionGate.jsx'
import ConfirmDialog from '../../components/ui/ConfirmDialog.jsx'
import Select from '../../components/ui/Select.jsx'
import { contactService } from '../../services/contactService.js'
import { useAdminWrite } from '../../hooks/useAdminWrite.js'
import { useAuth } from '../../context/AuthContext.jsx'
import { useToast } from '../../context/ToastContext.jsx'
export default function ContactAdmin(){
 const {user}=useAuth()
 const {push}=useToast()
 const [rows,setRows]=useState([])
 const [statusFilter,setStatusFilter]=useState('all')
 const [deleteRow,setDeleteRow]=useState(null)
 const load=useCallback(async function loadRows(){ setRows(await contactService.list()) },[])
 useEffect(function onMount(){ load() },[load])
 const commit=useAdminWrite(user,push,load)
 const filtered=statusFilter==='all'?rows:rows.filter(function matchStatus(r){ return r.status===statusFilter })
 const setStatus=async function doSetStatus(row,status){
  try{
   await commit({run:function runStatus(){ return contactService.update(row.id,{status:status}) },action:'update',collection:'contactMessages',docId:row.id,summary:'contact message '+status+' from '+row.name,success:'Message marked '+status+'.',local:function localStatus(){ setRows(function mapRows(rs){ return rs.map(function mapRow(r){ return r.id===row.id?Object.assign({},r,{status:status}):r }) }) }})
  }catch(err){ /* toast already shown */ }
 }
 const confirmDelete=async function doDelete(){
  if(!deleteRow) return
  const row=deleteRow
  try{
   await commit({run:function runDelete(){ return contactService.remove(row.id) },action:'delete',collection:'contactMessages',docId:row.id,summary:'contact message deleted from '+row.name,success:'Message deleted.',local:function localDelete(){ setRows(function filterRows(rs){ return rs.filter(function keep(r){ return r.id!==row.id }) }) }})
   setDeleteRow(null)
  }catch(err){ /* toast already shown */ }
 }
 return (
  <PermissionGate permission="contact">
   <h2 className="font-display text-2xl font-bold mb-4">Contact Messages</h2>
   <p className="text-sm mb-3">Messages sent from the public contact form. Mark them read once answered, or delete them.</p>
   <div className="max-w-xs mb-4">
    <Select label="Filter by status" id="contact-status" value={statusFilter} onChange={function onFilter(e){ setStatusFilter(e.target.value) }}><option value="all">All statuses</option><option value="unread">Unread</option><option value="read">Read</option></Select>
   </div>
   <DataTable rows={filtered} columns={[
    {key:'name',label:'Name'},
    {key:'email',label:'Email'},
    {key:'subject',label:'Subject'},
    {key:'message',label:'Message'},
    {key:'status',label:'Status'},
    {key:'actions',label:'Actions',render:function renderActions(r){ return (<span className="flex flex-wrap gap-2">{r.status!=='read' && <button type="button" onClick={function onRead(){ setStatus(r,'read') }} className="underline">Mark read</button>}{r.status!=='unread' && <button type="button" onClick={function onUnread(){ setStatus(r,'unread') }} className="underline">Mark unread</button>}<button type="button" onClick={function onDelete(){ setDeleteRow(r) }} className="underline text-red-700">Delete</button></span>) }}
   ]} searchKeys={['name','email','subject','message','status']} />
   <ConfirmDialog open={Boolean(deleteRow)} onClose={function closeDelete(){ setDeleteRow(null) }} onConfirm={confirmDelete} title="Delete message?" body={deleteRow?('Delete the message from '+deleteRow.name+'? This cannot be undone.'):'This action cannot be undone.'} />
  </PermissionGate>
 )
}
