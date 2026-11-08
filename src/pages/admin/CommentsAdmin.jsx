import React,{useCallback,useEffect,useState} from 'react'
import DataTable from '../../components/admin/DataTable.jsx'
import PermissionGate from '../../components/admin/PermissionGate.jsx'
import ConfirmDialog from '../../components/ui/ConfirmDialog.jsx'
import Select from '../../components/ui/Select.jsx'
import { commentService } from '../../services/commentService.js'
import { useAdminWrite } from '../../hooks/useAdminWrite.js'
import { useAuth } from '../../context/AuthContext.jsx'
import { useToast } from '../../context/ToastContext.jsx'
export default function CommentsAdmin(){
 const {user}=useAuth()
 const {push}=useToast()
 const [rows,setRows]=useState([])
 const [statusFilter,setStatusFilter]=useState('all')
 const [deleteRow,setDeleteRow]=useState(null)
 const load=useCallback(async function loadRows(){ setRows(await commentService.listAll()) },[])
 useEffect(function onMount(){ load() },[load])
 const commit=useAdminWrite(user,push,load)
 const filtered=statusFilter==='all'?rows:rows.filter(function matchStatus(r){ return r.status===statusFilter })
 const setStatus=async function doSetStatus(row,status){
  try{
   await commit({run:function runStatus(){ return commentService.update(row.id,{status:status}) },action:'update',collection:'comments',docId:row.id,summary:'comment '+status+' by '+row.authorName,success:'Comment '+status+'.',local:function localStatus(){ setRows(function mapRows(rs){ return rs.map(function mapRow(r){ return r.id===row.id?Object.assign({},r,{status:status}):r }) }) }})
  }catch(err){ /* toast already shown */ }
 }
 const confirmDelete=async function doDelete(){
  if(!deleteRow) return
  const row=deleteRow
  try{
   await commit({run:function runDelete(){ return commentService.remove(row.id) },action:'delete',collection:'comments',docId:row.id,summary:'comment deleted from '+row.authorName,success:'Comment deleted.',local:function localDelete(){ setRows(function filterRows(rs){ return rs.filter(function keep(r){ return r.id!==row.id }) }) }})
   setDeleteRow(null)
  }catch(err){ /* toast already shown */ }
 }
 return (
  <PermissionGate permission="comments">
   <h2 className="font-display text-2xl font-bold mb-4">Comments moderation</h2>
   <p className="text-sm mb-3">Approve comments to show them publicly, hide ones that break the rules, or delete them.</p>
   <div className="max-w-xs mb-4">
    <Select label="Filter by status" id="comment-status" value={statusFilter} onChange={function onFilter(e){ setStatusFilter(e.target.value) }}><option value="all">All statuses</option><option value="pending">Pending</option><option value="approved">Approved</option><option value="hidden">Hidden</option></Select>
   </div>
   <DataTable rows={filtered} columns={[
    {key:'authorName',label:'Author'},
    {key:'artworkId',label:'Artwork'},
    {key:'text',label:'Comment'},
    {key:'status',label:'Status'},
    {key:'actions',label:'Actions',render:function renderActions(r){ return (<span className="flex flex-wrap gap-2">{r.status!=='approved' && <button type="button" onClick={function onApprove(){ setStatus(r,'approved') }} className="underline">Approve</button>}{r.status!=='hidden' && <button type="button" onClick={function onHide(){ setStatus(r,'hidden') }} className="underline">Hide</button>}<button type="button" onClick={function onDelete(){ setDeleteRow(r) }} className="underline text-red-700">Delete</button></span>) }}
   ]} searchKeys={['authorName','text','status']} />
   <ConfirmDialog open={Boolean(deleteRow)} onClose={function closeDelete(){ setDeleteRow(null) }} onConfirm={confirmDelete} title="Delete comment?" body={deleteRow?('Delete the comment by '+deleteRow.authorName+'? This cannot be undone.'):'This action cannot be undone.'} />
  </PermissionGate>
 )
}
