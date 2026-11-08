import React,{useCallback,useEffect,useState} from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import DataTable from '../../components/admin/DataTable.jsx'
import PermissionGate from '../../components/admin/PermissionGate.jsx'
import FormField from '../../components/admin/FormField.jsx'
import ImageUploader from '../../components/admin/ImageUploader.jsx'
import Modal from '../../components/ui/Modal.jsx'
import ConfirmDialog from '../../components/ui/ConfirmDialog.jsx'
import Button from '../../components/ui/Button.jsx'
import Select from '../../components/ui/Select.jsx'
import { recognitionSchema } from '../../schemas/recognition.js'
import { recognitionService } from '../../services/recognitionService.js'
import { useAdminWrite } from '../../hooks/useAdminWrite.js'
import { useAuth } from '../../context/AuthContext.jsx'
import { useToast } from '../../context/ToastContext.jsx'
const TYPES=[{value:'artist_of_month',label:'Artist of the Month'},{value:'artist_of_semester',label:'Artist of the Semester'},{value:'hall_of_fame',label:'Hall of Fame'}]
const EMPTY={type:'artist_of_month',artistName:'',period:'',citation:'',photoUrl:'',photoPath:''}
export default function RecognitionAdmin(){
 const {user}=useAuth()
 const {push}=useToast()
 const [rows,setRows]=useState([])
 const [typeFilter,setTypeFilter]=useState('all')
 const [editing,setEditing]=useState(null)
 const [formOpen,setFormOpen]=useState(false)
 const [photo,setPhoto]=useState(null)
 const [deleteRow,setDeleteRow]=useState(null)
 const load=useCallback(async function loadRows(){ setRows(await recognitionService.list()) },[])
 useEffect(function onMount(){ load() },[load])
 const commit=useAdminWrite(user,push,load)
 const {control,handleSubmit,reset,setValue,formState:{isSubmitting}}=useForm({resolver:zodResolver(recognitionSchema),defaultValues:EMPTY})
 const filtered=typeFilter==='all'?rows:rows.filter(function matchType(r){ return r.type===typeFilter })
 const typeLabel=function labelForType(t){ const found=TYPES.find(function findType(x){ return x.value===t }); return found?found.label:t }
 const openAdd=function openAddForm(){ setEditing(null); reset(EMPTY); setPhoto(null); setFormOpen(true) }
 const openEdit=function openEditForm(row){
  setEditing(row)
  reset({type:row.type||'artist_of_month',artistName:row.artistName||'',period:row.period||'',citation:row.citation||'',photoUrl:row.photoUrl||'',photoPath:row.photoPath||''})
  setPhoto(row.photoUrl?{url:row.photoUrl,path:row.photoPath||''}:null)
  setFormOpen(true)
 }
 const onSubmit=async function submitRecognition(data){
  try{
   if(editing){
    const payload=Object.assign({},data)
    await commit({run:function runUpdate(){ return recognitionService.update(editing.id,payload) },action:'update',collection:'recognitions',docId:editing.id,summary:'recognition updated: '+payload.artistName+' ('+payload.type+')',success:'Recognition updated.',local:function localUpdate(){ setRows(function mapRows(rs){ return rs.map(function mapRow(r){ return r.id===editing.id?Object.assign({},r,payload):r }) }) }})
   } else {
    await commit({run:function runCreate(){ return recognitionService.create(data) },action:'create',collection:'recognitions',docId:'new',summary:'recognition created: '+data.artistName+' ('+data.type+')',success:'Recognition created.',local:function localAdd(result){ setRows(function prependRows(rs){ return [Object.assign({},data,{id:result.id})].concat(rs) }) }})
   }
   setFormOpen(false)
  }catch(err){ /* toast already shown by commit */ }
 }
 const confirmDelete=async function doDelete(){
  if(!deleteRow) return
  const row=deleteRow
  try{
   await commit({run:function runDelete(){ return recognitionService.remove(row.id) },action:'delete',collection:'recognitions',docId:row.id,summary:'recognition deleted: '+row.artistName+' ('+row.type+')',success:'Recognition deleted.',local:function localDelete(){ setRows(function filterRows(rs){ return rs.filter(function keep(r){ return r.id!==row.id }) }) }})
   setDeleteRow(null)
  }catch(err){ /* toast already shown */ }
 }
 return (
  <PermissionGate permission="legacy">
   <h2 className="font-display text-2xl font-bold mb-4">Recognition — Artist of the Month / Semester and Hall of Fame</h2>
   <div className="flex flex-wrap gap-3 items-end mb-4">
    <Button onClick={openAdd}>Add recognition</Button>
    <Select label="Type" id="recognition-type" value={typeFilter} onChange={function onFilter(e){ setTypeFilter(e.target.value) }}><option value="all">All types</option>{TYPES.map(function mapType(t){ return <option key={t.value} value={t.value}>{t.label}</option> })}</Select>
   </div>
   <DataTable rows={filtered} columns={[
    {key:'type',label:'Type',render:function renderType(r){ return typeLabel(r.type) }},
    {key:'artistName',label:'Artist'},
    {key:'period',label:'Period'},
    {key:'citation',label:'Citation'},
    {key:'actions',label:'Actions',render:function renderActions(r){ return (<span className="flex flex-wrap gap-2"><button type="button" onClick={function onEdit(){ openEdit(r) }} className="underline">Edit</button><button type="button" onClick={function onDelete(){ setDeleteRow(r) }} className="underline text-red-700">Delete</button></span>) }}
   ]} searchKeys={['artistName','period']} />
   <Modal open={formOpen} onClose={function closeForm(){ setFormOpen(false) }} title={editing?'Edit recognition':'Add recognition'}>
    <form onSubmit={handleSubmit(onSubmit)} className="mt-4">
     <FormField control={control} name="type" label="Type" type="select" options={TYPES} />
     <FormField control={control} name="artistName" label="Artist name" />
     <FormField control={control} name="period" label="Period" placeholder="November 2026" />
     <FormField control={control} name="citation" label="Citation" type="textarea" />
     <p className="font-bold text-sm mb-1">Photo</p>
     <ImageUploader prefix="recognition" onUploaded={function onPhoto(up){ setPhoto(up); setValue('photoUrl',up.url); setValue('photoPath',up.path) }} />
     {photo && <img src={photo.url} alt="Recognition photo preview" className="w-24 h-24 object-cover rounded-full mt-2" />}
     <div className="flex gap-2 justify-end mt-4"><button type="button" onClick={function closeForm(){ setFormOpen(false) }} className="px-4 py-2 rounded-full border-2">Cancel</button><Button disabled={isSubmitting}>{isSubmitting?'Saving…':'Save recognition'}</Button></div>
    </form>
   </Modal>
   <ConfirmDialog open={Boolean(deleteRow)} onClose={function closeDelete(){ setDeleteRow(null) }} onConfirm={confirmDelete} title="Delete recognition?" body={deleteRow?('Delete the recognition for '+deleteRow.artistName+'? This cannot be undone.'):'This action cannot be undone.'} />
  </PermissionGate>
 )
}
