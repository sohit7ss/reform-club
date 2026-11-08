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
import { eventSchema } from '../../schemas/event.js'
import { eventService } from '../../services/eventService.js'
import { useAdminWrite } from '../../hooks/useAdminWrite.js'
import { useAuth } from '../../context/AuthContext.jsx'
import { useToast } from '../../context/ToastContext.jsx'
const STATUSES=[{value:'upcoming',label:'Upcoming'},{value:'ongoing',label:'Ongoing'},{value:'completed',label:'Completed'}]
const EMPTY={title:'',description:'',venue:'',startDate:'',endDate:'',participationDetails:'',registrationLink:'',status:'upcoming',published:true,highlights:'',posterUrl:'',posterPath:'',photoUrls:[]}
export default function EventsAdmin(){
 const {user}=useAuth()
 const {push}=useToast()
 const [rows,setRows]=useState([])
 const [editing,setEditing]=useState(null)
 const [formOpen,setFormOpen]=useState(false)
 const [poster,setPoster]=useState(null)
 const [photos,setPhotos]=useState([])
 const [deleteRow,setDeleteRow]=useState(null)
 const load=useCallback(async function loadRows(){ setRows(await eventService.listAll()) },[])
 useEffect(function onMount(){ load() },[load])
 const commit=useAdminWrite(user,push,load)
 const {control,handleSubmit,reset,setValue,formState:{isSubmitting}}=useForm({resolver:zodResolver(eventSchema),defaultValues:EMPTY})
 const openAdd=function openAddForm(){ setEditing(null); reset(EMPTY); setPoster(null); setPhotos([]); setFormOpen(true) }
 const openEdit=function openEditForm(row){
  setEditing(row)
  reset({title:row.title||'',description:row.description||'',venue:row.venue||'',startDate:row.startDate||'',endDate:row.endDate||'',participationDetails:row.participationDetails||'',registrationLink:row.registrationLink||'',status:row.status||'upcoming',published:row.published!==false,highlights:row.highlights||'',posterUrl:row.posterUrl||'',posterPath:row.posterPath||'',photoUrls:row.photoUrls||[]})
  setPoster(row.posterUrl?{url:row.posterUrl,path:row.posterPath||''}:null)
  setPhotos(row.photoUrls||[])
  setFormOpen(true)
 }
 const onSubmit=async function submitEvent(data){
  try{
   const payload=Object.assign({},data,{photoUrls:photos})
   if(editing){
    await commit({run:function runUpdate(){ return eventService.update(editing.id,payload) },action:'update',collection:'events',docId:editing.id,summary:'event updated: '+payload.title,success:'Event updated.',local:function localUpdate(){ setRows(function mapRows(rs){ return rs.map(function mapRow(r){ return r.id===editing.id?Object.assign({},r,payload):r }) }) }})
   } else {
    await commit({run:function runCreate(){ return eventService.create(payload) },action:'create',collection:'events',docId:'new',summary:'event created: '+payload.title,success:'Event created.',local:function localAdd(result){ setRows(function prependRows(rs){ return [Object.assign({},payload,{id:result.id})].concat(rs) }) }})
   }
   setFormOpen(false)
  }catch(err){ /* toast already shown by commit */ }
 }
 const togglePublished=async function togglePublish(row){
  try{
   await commit({run:function runPublish(){ return eventService.update(row.id,{published:!row.published}) },action:'update',collection:'events',docId:row.id,summary:'event publish set to '+String(!row.published)+': '+row.title,success:row.published?'Event unpublished.':'Event published.',local:function localPublish(){ setRows(function mapRows(rs){ return rs.map(function mapRow(r){ return r.id===row.id?Object.assign({},r,{published:!row.published}):r }) }) }})
  }catch(err){ /* toast already shown */ }
 }
 const confirmDelete=async function doDelete(){
  if(!deleteRow) return
  const row=deleteRow
  try{
   await commit({run:function runDelete(){ return eventService.remove(row.id) },action:'delete',collection:'events',docId:row.id,summary:'event deleted: '+row.title,success:'Event deleted.',local:function localDelete(){ setRows(function filterRows(rs){ return rs.filter(function keep(r){ return r.id!==row.id }) }) }})
   setDeleteRow(null)
  }catch(err){ /* toast already shown */ }
 }
 const addPhoto=function addPhotoUpload(up){ const next=photos.concat([up.url]); setPhotos(next); setValue('photoUrls',next) }
 const removePhoto=function removePhotoAt(i){ const next=photos.filter(function keep(u,idx){ return idx!==i }); setPhotos(next); setValue('photoUrls',next) }
 return (
  <PermissionGate permission="events">
   <h2 className="font-display text-2xl font-bold mb-4">Events</h2>
   <Button onClick={openAdd} className="mb-4">Add event</Button>
   <DataTable rows={rows} columns={[
    {key:'title',label:'Title'},
    {key:'venue',label:'Venue'},
    {key:'status',label:'Status'},
    {key:'startDate',label:'Start'},
    {key:'published',label:'Published',render:function renderPublished(r){ return r.published?'Yes':'No' }},
    {key:'actions',label:'Actions',render:function renderActions(r){ return (<span className="flex flex-wrap gap-2"><button type="button" onClick={function onEdit(){ openEdit(r) }} className="underline">Edit</button><button type="button" onClick={function onPublish(){ togglePublished(r) }} className="underline">{r.published?'Unpublish':'Publish'}</button><button type="button" onClick={function onDelete(){ setDeleteRow(r) }} className="underline text-red-700">Delete</button></span>) }}
   ]} searchKeys={['title','venue','status']} />
   <Modal open={formOpen} onClose={function closeForm(){ setFormOpen(false) }} title={editing?'Edit event':'Add event'}>
    <form onSubmit={handleSubmit(onSubmit)} className="mt-4">
     <FormField control={control} name="title" label="Title" />
     <FormField control={control} name="description" label="Description" type="textarea" />
     <FormField control={control} name="venue" label="Venue" />
     <FormField control={control} name="startDate" label="Start date and time" type="datetime-local" />
     <FormField control={control} name="endDate" label="End date and time" type="datetime-local" />
     <FormField control={control} name="status" label="Status" type="select" options={STATUSES} />
     <FormField control={control} name="published" label="Published (visible on the public Events page)" type="checkbox" />
     <FormField control={control} name="highlights" label="Highlights" hint="One short line shown on the event card." />
     <FormField control={control} name="participationDetails" label="Participation details" type="textarea" />
     <FormField control={control} name="registrationLink" label="Registration link" placeholder="https://example.invalid/register" />
     <p className="font-bold text-sm mb-1">Poster image</p>
     <ImageUploader prefix="events" onUploaded={function onPoster(up){ setPoster(up); setValue('posterUrl',up.url); setValue('posterPath',up.path) }} />
     {poster && <img src={poster.url} alt="Event poster preview" className="w-full max-w-xs rounded-xl mt-2" />}
     <p className="font-bold text-sm mb-1 mt-4">Event photos (upload one at a time)</p>
     <ImageUploader prefix="events" onUploaded={addPhoto} />
     {photos.length>0 && <div className="flex flex-wrap gap-2 mt-2">{photos.map(function mapPhoto(u,i){ return (<span key={u+i} className="relative"><img src={u} alt={'Event photo '+(i+1)} className="w-20 h-20 object-cover rounded-xl" /><button type="button" aria-label="Remove photo" onClick={function onRemove(){ removePhoto(i) }} className="absolute top-0 right-0 bg-white rounded-full px-1 text-xs">×</button></span>) })}</div>}
     <div className="flex gap-2 justify-end mt-4"><button type="button" onClick={function closeForm(){ setFormOpen(false) }} className="px-4 py-2 rounded-full border-2">Cancel</button><Button disabled={isSubmitting}>{isSubmitting?'Saving…':'Save event'}</Button></div>
    </form>
   </Modal>
   <ConfirmDialog open={Boolean(deleteRow)} onClose={function closeDelete(){ setDeleteRow(null) }} onConfirm={confirmDelete} title="Delete event?" body={deleteRow?('Delete “'+deleteRow.title+'”? This cannot be undone.'):'This action cannot be undone.'} />
  </PermissionGate>
 )
}
