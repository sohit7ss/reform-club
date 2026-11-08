import React,{useCallback,useEffect,useState} from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import DataTable from '../../components/admin/DataTable.jsx'
import PermissionGate from '../../components/admin/PermissionGate.jsx'
import FormField from '../../components/admin/FormField.jsx'
import Modal from '../../components/ui/Modal.jsx'
import ConfirmDialog from '../../components/ui/ConfirmDialog.jsx'
import Button from '../../components/ui/Button.jsx'
import Input from '../../components/ui/Input.jsx'
import { constitutionSchema } from '../../schemas/constitution.js'
import { constitutionService } from '../../services/constitutionService.js'
import { uploadService } from '../../services/uploadService.js'
import { validateDocFile } from '../../utils/validateFile.js'
import { safeUrl } from '../../utils/sanitize.js'
import { useAdminWrite } from '../../hooks/useAdminWrite.js'
import { useAuth } from '../../context/AuthContext.jsx'
import { useToast } from '../../context/ToastContext.jsx'
const EMPTY={version:'',title:'',notes:'',fileUrl:'',filePath:'',isLatest:true,uploadedBy:''}
export default function ConstitutionAdmin(){
 const {user,adminProfile}=useAuth()
 const {push}=useToast()
 const [rows,setRows]=useState([])
 const [uploadOpen,setUploadOpen]=useState(false)
 const [pdfFile,setPdfFile]=useState(null)
 const [uploading,setUploading]=useState(false)
 const [editing,setEditing]=useState(null)
 const [editOpen,setEditOpen]=useState(false)
 const [deleteRow,setDeleteRow]=useState(null)
 const isCoordinator=adminProfile && adminProfile.role==='coordinator'
 const load=useCallback(async function loadRows(){ setRows(await constitutionService.list()) },[])
 useEffect(function onMount(){ load() },[load])
 const commit=useAdminWrite(user,push,load)
 const {control,handleSubmit,reset,formState:{isSubmitting}}=useForm({resolver:zodResolver(constitutionSchema),defaultValues:EMPTY})
 const openUpload=function openUploadForm(){ setPdfFile(null); reset(Object.assign({},EMPTY,{uploadedBy:user?user.email:''})); setUploadOpen(true) }
 const openEdit=function openEditForm(row){
  setEditing(row)
  reset({version:row.version||'',title:row.title||'',notes:row.notes||'',fileUrl:row.fileUrl||'',filePath:row.filePath||'',isLatest:Boolean(row.isLatest),uploadedBy:row.uploadedBy||''})
  setEditOpen(true)
 }
 const onUpload=async function submitUpload(data){
  if(!pdfFile){ push('Choose a PDF file first.','error'); return }
  const fileError=validateDocFile(pdfFile)
  if(fileError){ push(fileError,'error'); return }
  try{
   setUploading(true)
   const up=await uploadService.uploadDoc(pdfFile)
   const payload=Object.assign({},data,{fileUrl:up.url||'',filePath:up.path,isLatest:true,uploadedBy:user?user.email:''})
   await commit({run:async function runUpload(){
     for(const old of rows.filter(function isLatest(r){ return r.isLatest })){ await constitutionService.update(old.id,{isLatest:false}) }
     return constitutionService.create(payload)
    },action:'create',collection:'constitution',docId:'new',summary:'constitution uploaded: '+payload.title+' v'+payload.version,success:'New Constitution version uploaded and marked latest.',local:function localUpload(result){
     setRows(function mapRows(rs){ return [Object.assign({},payload,{id:result.id})].concat(rs.map(function mapRow(r){ return Object.assign({},r,{isLatest:false}) })) })
    }})
   setUploading(false); setUploadOpen(false); setPdfFile(null)
  }catch(err){ setUploading(false); push(err.message,'error') }
 }
 const onEdit=async function submitEdit(data){
  if(!editing) return
  try{
   const payload=Object.assign({},data)
   await commit({run:function runUpdate(){ return constitutionService.update(editing.id,payload) },action:'update',collection:'constitution',docId:editing.id,summary:'constitution notes updated: '+payload.title,success:'Constitution updated.',local:function localUpdate(){ setRows(function mapRows(rs){ return rs.map(function mapRow(r){ return r.id===editing.id?Object.assign({},r,payload):r }) }) }})
   setEditOpen(false)
  }catch(err){ /* toast already shown by commit */ }
 }
 const confirmDelete=async function doDelete(){
  if(!deleteRow) return
  const row=deleteRow
  if(!isCoordinator){ push('Only the Coordinator can delete old Constitution versions.','error'); return }
  if(row.isLatest){ push('The latest version cannot be deleted. Upload a newer version first.','error'); return }
  try{
   await commit({run:function runDelete(){ return constitutionService.remove(row.id) },action:'delete',collection:'constitution',docId:row.id,summary:'constitution version deleted: '+row.title+' v'+row.version,success:'Old version deleted.',local:function localDelete(){ setRows(function filterRows(rs){ return rs.filter(function keep(r){ return r.id!==row.id }) }) }})
   setDeleteRow(null)
  }catch(err){ /* toast already shown */ }
 }
 return (
  <PermissionGate permission="constitution">
   <h2 className="font-display text-2xl font-bold mb-4">Constitution</h2>
   <p className="text-sm mb-3">Uploading a new PDF makes it the latest version and marks the previous version as archived. Deleting old versions is coordinator-only, and the latest version can never be deleted.</p>
   <Button onClick={openUpload} className="mb-4">Upload new version (PDF)</Button>
   <DataTable rows={rows} columns={[
    {key:'title',label:'Title'},
    {key:'version',label:'Version'},
    {key:'isLatest',label:'Latest',render:function renderLatest(r){ return r.isLatest?'Yes':'No' }},
    {key:'notes',label:'Notes'},
    {key:'actions',label:'Actions',render:function renderActions(r){ return (<span className="flex flex-wrap gap-2">{safeUrl(r.fileUrl) && <a href={safeUrl(r.fileUrl)} target="_blank" rel="noopener noreferrer" className="underline">Open PDF</a>}<button type="button" onClick={function onEdit(){ openEdit(r) }} className="underline">Edit notes</button>{isCoordinator && !r.isLatest && <button type="button" onClick={function onDelete(){ setDeleteRow(r) }} className="underline text-red-700">Delete</button>}</span>) }}
   ]} searchKeys={['title','version']} />
   <Modal open={uploadOpen} onClose={function closeUpload(){ setUploadOpen(false) }} title="Upload new Constitution version">
    <form onSubmit={handleSubmit(onUpload)} className="mt-4">
     <FormField control={control} name="version" label="Version" placeholder="2.0" />
     <FormField control={control} name="title" label="Title" />
     <FormField control={control} name="notes" label="Notes" type="textarea" />
     <Input label="Constitution PDF" id="constitution-pdf" type="file" value={undefined} onChange={function onFile(e){ setPdfFile(e.target.files[0]||null) }} />
     {pdfFile && <p className="text-sm mb-3">Selected file: {pdfFile.name}</p>}
     {uploading && <p className="text-sm mb-3 font-bold">Uploading PDF…</p>}
     <div className="flex gap-2 justify-end mt-4"><button type="button" onClick={function closeUpload(){ setUploadOpen(false) }} className="px-4 py-2 rounded-full border-2">Cancel</button><Button disabled={isSubmitting||uploading}>{uploading?'Uploading…':'Upload as latest'}</Button></div>
    </form>
   </Modal>
   <Modal open={editOpen} onClose={function closeEdit(){ setEditOpen(false) }} title="Edit Constitution entry">
    <form onSubmit={handleSubmit(onEdit)} className="mt-4">
     <FormField control={control} name="version" label="Version" />
     <FormField control={control} name="title" label="Title" />
     <FormField control={control} name="notes" label="Notes" type="textarea" />
     <div className="flex gap-2 justify-end mt-4"><button type="button" onClick={function closeEdit(){ setEditOpen(false) }} className="px-4 py-2 rounded-full border-2">Cancel</button><Button disabled={isSubmitting}>{isSubmitting?'Saving…':'Save changes'}</Button></div>
    </form>
   </Modal>
   <ConfirmDialog open={Boolean(deleteRow)} onClose={function closeDelete(){ setDeleteRow(null) }} onConfirm={confirmDelete} title="Delete old version?" body={deleteRow?('Delete '+deleteRow.title+' v'+deleteRow.version+'? This cannot be undone.'):'This action cannot be undone.'} />
  </PermissionGate>
 )
}
