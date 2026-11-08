import React,{useCallback,useEffect,useState} from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import DataTable from '../../components/admin/DataTable.jsx'
import PermissionGate from '../../components/admin/PermissionGate.jsx'
import FormField from '../../components/admin/FormField.jsx'
import Modal from '../../components/ui/Modal.jsx'
import ConfirmDialog from '../../components/ui/ConfirmDialog.jsx'
import Button from '../../components/ui/Button.jsx'
import { legacySchema } from '../../schemas/legacy.js'
import { legacyService } from '../../services/legacyService.js'
import { useAdminWrite } from '../../hooks/useAdminWrite.js'
import { useAuth } from '../../context/AuthContext.jsx'
import { useToast } from '../../context/ToastContext.jsx'
const KINDS=[{value:'event',label:'Event'},{value:'achievement',label:'Achievement'},{value:'milestone',label:'Milestone'},{value:'person',label:'Person'}]
const EMPTY={year:'',title:'',description:'',kind:'event',order:0}
export default function LegacyAdmin(){
 const {user}=useAuth()
 const {push}=useToast()
 const [rows,setRows]=useState([])
 const [editing,setEditing]=useState(null)
 const [formOpen,setFormOpen]=useState(false)
 const [deleteRow,setDeleteRow]=useState(null)
 const load=useCallback(async function loadRows(){ setRows(await legacyService.list()) },[])
 useEffect(function onMount(){ load() },[load])
 const commit=useAdminWrite(user,push,load)
 const {control,handleSubmit,reset,formState:{isSubmitting}}=useForm({resolver:zodResolver(legacySchema),defaultValues:EMPTY})
 const openAdd=function openAddForm(){ setEditing(null); reset(EMPTY); setFormOpen(true) }
 const openEdit=function openEditForm(row){
  setEditing(row)
  reset({year:row.year||'',title:row.title||'',description:row.description||'',kind:row.kind||'event',order:row.order||0})
  setFormOpen(true)
 }
 const onSubmit=async function submitLegacy(data){
  try{
   if(editing){
    const payload=Object.assign({},data)
    await commit({run:function runUpdate(){ return legacyService.update(editing.id,payload) },action:'update',collection:'legacyEntries',docId:editing.id,summary:'legacy entry updated: '+payload.title,success:'Legacy entry updated.',local:function localUpdate(){ setRows(function mapRows(rs){ return rs.map(function mapRow(r){ return r.id===editing.id?Object.assign({},r,payload):r }) }) }})
   } else {
    await commit({run:function runCreate(){ return legacyService.create(data) },action:'create',collection:'legacyEntries',docId:'new',summary:'legacy entry created: '+data.title,success:'Legacy entry created.',local:function localAdd(result){ setRows(function prependRows(rs){ return [Object.assign({},data,{id:result.id})].concat(rs) }) }})
   }
   setFormOpen(false)
  }catch(err){ /* toast already shown by commit */ }
 }
 const confirmDelete=async function doDelete(){
  if(!deleteRow) return
  const row=deleteRow
  try{
   await commit({run:function runDelete(){ return legacyService.remove(row.id) },action:'delete',collection:'legacyEntries',docId:row.id,summary:'legacy entry deleted: '+row.title,success:'Legacy entry deleted.',local:function localDelete(){ setRows(function filterRows(rs){ return rs.filter(function keep(r){ return r.id!==row.id }) }) }})
   setDeleteRow(null)
  }catch(err){ /* toast already shown */ }
 }
 return (
  <PermissionGate permission="legacy">
   <h2 className="font-display text-2xl font-bold mb-4">Legacy entries</h2>
   <Button onClick={openAdd} className="mb-4">Add legacy entry</Button>
   <DataTable rows={rows} columns={[
    {key:'year',label:'Year'},
    {key:'title',label:'Title'},
    {key:'kind',label:'Kind'},
    {key:'actions',label:'Actions',render:function renderActions(r){ return (<span className="flex flex-wrap gap-2"><button type="button" onClick={function onEdit(){ openEdit(r) }} className="underline">Edit</button><button type="button" onClick={function onDelete(){ setDeleteRow(r) }} className="underline text-red-700">Delete</button></span>) }}
   ]} searchKeys={['title','year','kind']} />
   <Modal open={formOpen} onClose={function closeForm(){ setFormOpen(false) }} title={editing?'Edit legacy entry':'Add legacy entry'}>
    <form onSubmit={handleSubmit(onSubmit)} className="mt-4">
     <FormField control={control} name="year" label="Year" placeholder="2026" />
     <FormField control={control} name="title" label="Title" />
     <FormField control={control} name="description" label="Description" type="textarea" />
     <FormField control={control} name="kind" label="Kind" type="select" options={KINDS} />
     <FormField control={control} name="order" label="Display order" type="number" />
     <div className="flex gap-2 justify-end mt-4"><button type="button" onClick={function closeForm(){ setFormOpen(false) }} className="px-4 py-2 rounded-full border-2">Cancel</button><Button disabled={isSubmitting}>{isSubmitting?'Saving…':'Save entry'}</Button></div>
    </form>
   </Modal>
   <ConfirmDialog open={Boolean(deleteRow)} onClose={function closeDelete(){ setDeleteRow(null) }} onConfirm={confirmDelete} title="Delete legacy entry?" body={deleteRow?('Delete “'+deleteRow.title+'” ('+deleteRow.year+')? This cannot be undone.'):'This action cannot be undone.'} />
  </PermissionGate>
 )
}
