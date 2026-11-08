import React,{useCallback,useEffect,useState} from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import DataTable from '../../components/admin/DataTable.jsx'
import PermissionGate from '../../components/admin/PermissionGate.jsx'
import FormField from '../../components/admin/FormField.jsx'
import Modal from '../../components/ui/Modal.jsx'
import ConfirmDialog from '../../components/ui/ConfirmDialog.jsx'
import Button from '../../components/ui/Button.jsx'
import { noticeSchema } from '../../schemas/notice.js'
import { noticeService } from '../../services/noticeService.js'
import { NOTICE_TYPES } from '../../config/constants.js'
import { useAdminWrite } from '../../hooks/useAdminWrite.js'
import { useAuth } from '../../context/AuthContext.jsx'
import { useToast } from '../../context/ToastContext.jsx'
const EMPTY={title:'',body:'',type:'general',important:false,pinned:false,deadline:'',published:true}
export default function NoticesAdmin(){
 const {user}=useAuth()
 const {push}=useToast()
 const [rows,setRows]=useState([])
 const [editing,setEditing]=useState(null)
 const [formOpen,setFormOpen]=useState(false)
 const [deleteRow,setDeleteRow]=useState(null)
 const load=useCallback(async function loadRows(){ setRows(await noticeService.listAll()) },[])
 useEffect(function onMount(){ load() },[load])
 const commit=useAdminWrite(user,push,load)
 const {control,handleSubmit,reset,formState:{isSubmitting}}=useForm({resolver:zodResolver(noticeSchema),defaultValues:EMPTY})
 const typeOptions=NOTICE_TYPES.map(function mapType(t){ return {value:t,label:t.charAt(0).toUpperCase()+t.slice(1)} })
 const openAdd=function openAddForm(){ setEditing(null); reset(EMPTY); setFormOpen(true) }
 const openEdit=function openEditForm(row){
  setEditing(row)
  reset({title:row.title||'',body:row.body||'',type:row.type||'general',important:Boolean(row.important),pinned:Boolean(row.pinned),deadline:row.deadline||'',published:row.published!==false})
  setFormOpen(true)
 }
 const onSubmit=async function submitNotice(data){
  try{
   const payload=Object.assign({},data,{deadline:data.deadline||''})
   if(editing){
    await commit({run:function runUpdate(){ return noticeService.update(editing.id,payload) },action:'update',collection:'notices',docId:editing.id,summary:'notice updated: '+payload.title,success:'Notice updated.',local:function localUpdate(){ setRows(function mapRows(rs){ return rs.map(function mapRow(r){ return r.id===editing.id?Object.assign({},r,payload):r }) }) }})
   } else {
    await commit({run:function runCreate(){ return noticeService.create(payload) },action:'create',collection:'notices',docId:'new',summary:'notice created: '+payload.title,success:'Notice created.',local:function localAdd(result){ setRows(function prependRows(rs){ return [Object.assign({},payload,{id:result.id})].concat(rs) }) }})
   }
   setFormOpen(false)
  }catch(err){ /* toast already shown by commit */ }
 }
 const toggleField=async function toggleNoticeField(row,field){
  const patch={}
  patch[field]=!row[field]
  try{
   await commit({run:function runToggle(){ return noticeService.update(row.id,patch) },action:'update',collection:'notices',docId:row.id,summary:'notice '+field+' set to '+String(patch[field])+': '+row.title,success:'Notice updated.',local:function localToggle(){ setRows(function mapRows(rs){ return rs.map(function mapRow(r){ return r.id===row.id?Object.assign({},r,patch):r }) }) }})
  }catch(err){ /* toast already shown */ }
 }
 const confirmDelete=async function doDelete(){
  if(!deleteRow) return
  const row=deleteRow
  try{
   await commit({run:function runDelete(){ return noticeService.remove(row.id) },action:'delete',collection:'notices',docId:row.id,summary:'notice deleted: '+row.title,success:'Notice deleted.',local:function localDelete(){ setRows(function filterRows(rs){ return rs.filter(function keep(r){ return r.id!==row.id }) }) }})
   setDeleteRow(null)
  }catch(err){ /* toast already shown */ }
 }
 return (
  <PermissionGate permission="notices">
   <h2 className="font-display text-2xl font-bold mb-4">Announcements / Notices</h2>
   <Button onClick={openAdd} className="mb-4">Add notice</Button>
   <DataTable rows={rows} columns={[
    {key:'title',label:'Title'},
    {key:'type',label:'Type'},
    {key:'important',label:'Important',render:function renderImportant(r){ return r.important?'Yes':'No' }},
    {key:'pinned',label:'Pinned',render:function renderPinned(r){ return r.pinned?'Yes':'No' }},
    {key:'published',label:'Published',render:function renderPublished(r){ return r.published?'Yes':'No' }},
    {key:'deadline',label:'Deadline',render:function renderDeadline(r){ return r.deadline||'—' }},
    {key:'actions',label:'Actions',render:function renderActions(r){ return (<span className="flex flex-wrap gap-2"><button type="button" onClick={function onEdit(){ openEdit(r) }} className="underline">Edit</button><button type="button" onClick={function onPin(){ toggleField(r,'pinned') }} className="underline">{r.pinned?'Unpin':'Pin'}</button><button type="button" onClick={function onPublish(){ toggleField(r,'published') }} className="underline">{r.published?'Unpublish':'Publish'}</button><button type="button" onClick={function onDelete(){ setDeleteRow(r) }} className="underline text-red-700">Delete</button></span>) }}
   ]} searchKeys={['title','type']} />
   <Modal open={formOpen} onClose={function closeForm(){ setFormOpen(false) }} title={editing?'Edit notice':'Add notice'}>
    <form onSubmit={handleSubmit(onSubmit)} className="mt-4">
     <FormField control={control} name="title" label="Title" />
     <FormField control={control} name="body" label="Body" type="textarea" />
     <FormField control={control} name="type" label="Type" type="select" options={typeOptions} />
     <FormField control={control} name="deadline" label="Deadline (optional)" type="date" />
     <FormField control={control} name="important" label="Important (shown with emphasis)" type="checkbox" />
     <FormField control={control} name="pinned" label="Pinned to the top of the notice board" type="checkbox" />
     <FormField control={control} name="published" label="Published" type="checkbox" />
     <div className="flex gap-2 justify-end mt-4"><button type="button" onClick={function closeForm(){ setFormOpen(false) }} className="px-4 py-2 rounded-full border-2">Cancel</button><Button disabled={isSubmitting}>{isSubmitting?'Saving…':'Save notice'}</Button></div>
    </form>
   </Modal>
   <ConfirmDialog open={Boolean(deleteRow)} onClose={function closeDelete(){ setDeleteRow(null) }} onConfirm={confirmDelete} title="Delete notice?" body={deleteRow?('Delete “'+deleteRow.title+'”? This cannot be undone.'):'This action cannot be undone.'} />
  </PermissionGate>
 )
}
