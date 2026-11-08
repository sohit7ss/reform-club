import React,{useCallback,useEffect,useState} from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import PermissionGate from '../../components/admin/PermissionGate.jsx'
import FormField from '../../components/admin/FormField.jsx'
import ImageUploader from '../../components/admin/ImageUploader.jsx'
import Modal from '../../components/ui/Modal.jsx'
import ConfirmDialog from '../../components/ui/ConfirmDialog.jsx'
import Button from '../../components/ui/Button.jsx'
import Input from '../../components/ui/Input.jsx'
import Select from '../../components/ui/Select.jsx'
import { artworkSchema } from '../../schemas/artwork.js'
import { artworkService } from '../../services/artworkService.js'
import { useAdminWrite } from '../../hooks/useAdminWrite.js'
import { useAuth } from '../../context/AuthContext.jsx'
import { useToast } from '../../context/ToastContext.jsx'
const CATEGORIES=[{value:'painting',label:'Painting'},{value:'sketching',label:'Sketching'},{value:'craft',label:'Craft'},{value:'waste_to_best',label:'Waste to Best'}]
const EMPTY={title:'',artistName:'',category:'painting',description:'',imageUrl:'',imagePath:''}
export default function GalleryAdmin(){
 const {user}=useAuth()
 const {push}=useToast()
 const [rows,setRows]=useState([])
 const [statusFilter,setStatusFilter]=useState('all')
 const [categoryFilter,setCategoryFilter]=useState('all')
 const [search,setSearch]=useState('')
 const [selected,setSelected]=useState([])
 const [editing,setEditing]=useState(null)
 const [formOpen,setFormOpen]=useState(false)
 const [image,setImage]=useState(null)
 const [rejectRows,setRejectRows]=useState(null)
 const [rejectReason,setRejectReason]=useState('')
 const [deleteRow,setDeleteRow]=useState(null)
 const load=useCallback(async function loadRows(){ setRows(await artworkService.listAll()) },[])
 useEffect(function onMount(){ load() },[load])
 const commit=useAdminWrite(user,push,load)
 const {control,handleSubmit,reset,setValue,formState:{isSubmitting}}=useForm({resolver:zodResolver(artworkSchema),defaultValues:EMPTY})
 const filtered=rows.filter(function matchRow(r){
  if(statusFilter!=='all' && r.status!==statusFilter) return false
  if(categoryFilter!=='all' && r.category!==categoryFilter) return false
  if(search && String(r.title||'').toLowerCase().indexOf(search.toLowerCase())<0 && String(r.artistName||'').toLowerCase().indexOf(search.toLowerCase())<0) return false
  return true
 })
 const openAdd=function openAddForm(){ setEditing(null); reset(EMPTY); setImage(null); setFormOpen(true) }
 const openEdit=function openEditForm(row){
  setEditing(row)
  reset({title:row.title||'',artistName:row.artistName||'',category:row.category||'painting',description:row.description||'',imageUrl:row.imageUrl||'',imagePath:row.imagePath||''})
  setImage(row.imageUrl?{url:row.imageUrl,path:row.imagePath||''}:null)
  setFormOpen(true)
 }
 const onSubmit=async function submitArtwork(data){
  try{
   if(editing){
    const payload=Object.assign({},data)
    await commit({run:function runUpdate(){ return artworkService.update(editing.id,payload) },action:'update',collection:'artworks',docId:editing.id,summary:'artwork updated: '+payload.title,success:'Artwork updated.',local:function localUpdate(){ setRows(function mapRows(rs){ return rs.map(function mapRow(r){ return r.id===editing.id?Object.assign({},r,payload):r }) }) }})
   } else {
    const created=Object.assign({},data,{status:'pending',source:'admin',likeCount:0,featured:false})
    await commit({run:function runCreate(){ return artworkService.create(created) },action:'create',collection:'artworks',docId:'new',summary:'artwork created: '+data.title,success:'Artwork added and pending review.',local:function localAdd(result){ setRows(function prependRows(rs){ return [Object.assign({},created,{id:result.id})].concat(rs) }) }})
   }
   setFormOpen(false)
  }catch(err){ /* toast already shown by commit */ }
 }
 const approveOne=async function approveArtwork(row){
  try{
   await commit({run:function runApprove(){ return artworkService.approve(row.id) },action:'update',collection:'artworks',docId:row.id,summary:'artwork approved: '+row.title,success:'Artwork approved.',local:function localApprove(){ setRows(function mapRows(rs){ return rs.map(function mapRow(r){ return r.id===row.id?Object.assign({},r,{status:'approved'}):r }) }) }})
  }catch(err){ /* toast already shown */ }
 }
 const confirmReject=async function doReject(){
  if(!rejectReason.trim()){ push('Enter a rejection reason.','error'); return }
  const targets=rejectRows||[]
  try{
   await commit({run:async function runReject(){ for(const t of targets){ await artworkService.reject(t.id,rejectReason) } return {count:targets.length} },action:'update',collection:'artworks',docId:targets.map(function getId(t){ return t.id }).join(','),summary:'artworks rejected: '+targets.length,success:targets.length+' artwork(s) rejected.',local:function localReject(){ setRows(function mapRows(rs){ return rs.map(function mapRow(r){ return targets.some(function isTarget(t){ return t.id===r.id })?Object.assign({},r,{status:'rejected',rejectionReason:rejectReason}):r }) }) }})
   setRejectRows(null); setRejectReason('')
  }catch(err){ /* toast already shown */ }
 }
 const bulkApprove=async function doBulkApprove(){
  const targets=rows.filter(function isSelected(r){ return selected.indexOf(r.id)>=0 })
  if(!targets.length){ push('Select at least one artwork first.','error'); return }
  try{
   await commit({run:async function runBulk(){ for(const t of targets){ await artworkService.approve(t.id) } return {count:targets.length} },action:'update',collection:'artworks',docId:targets.map(function getId(t){ return t.id }).join(','),summary:'artworks bulk approved: '+targets.length,success:targets.length+' artwork(s) approved.',local:function localBulk(){ setRows(function mapRows(rs){ return rs.map(function mapRow(r){ return selected.indexOf(r.id)>=0?Object.assign({},r,{status:'approved'}):r }) }); setSelected([]) }})
  }catch(err){ /* toast already shown */ }
 }
 const toggleFeatured=async function toggleFeature(row){
  try{
   await commit({run:function runFeature(){ return artworkService.toggleFeatured(row.id,!row.featured) },action:'update',collection:'artworks',docId:row.id,summary:'artwork featured flag set to '+String(!row.featured)+': '+row.title,success:row.featured?'Removed from featured.':'Marked as featured.',local:function localFeature(){ setRows(function mapRows(rs){ return rs.map(function mapRow(r){ return r.id===row.id?Object.assign({},r,{featured:!row.featured}):r }) }) }})
  }catch(err){ /* toast already shown */ }
 }
 const confirmDelete=async function doDelete(){
  if(!deleteRow) return
  const row=deleteRow
  try{
   await commit({run:function runDelete(){ return artworkService.remove(row.id) },action:'delete',collection:'artworks',docId:row.id,summary:'artwork deleted: '+row.title,success:'Artwork deleted.',local:function localDelete(){ setRows(function filterRows(rs){ return rs.filter(function keep(r){ return r.id!==row.id }) }) }})
   setDeleteRow(null)
  }catch(err){ /* toast already shown */ }
 }
 const toggleSelect=function toggleRow(id,checked){ setSelected(function updateSelected(prev){ return checked?prev.concat([id]):prev.filter(function keep(x){ return x!==id }) }) }
 const toggleSelectAll=function toggleAll(checked){ setSelected(checked?filtered.map(function getId(r){ return r.id }):[]) }
 const allSelected=filtered.length>0 && filtered.every(function isSel(r){ return selected.indexOf(r.id)>=0 })
 return (
  <PermissionGate permission="gallery">
   <h2 className="font-display text-2xl font-bold mb-4">Gallery — approve / reject / feature</h2>
   <div className="flex flex-wrap gap-3 items-end mb-4">
    <Button onClick={openAdd}>Add artwork</Button>
    <Select label="Status" id="gallery-status" value={statusFilter} onChange={function onStatus(e){ setStatusFilter(e.target.value) }}><option value="all">All statuses</option><option value="pending">Pending</option><option value="approved">Approved</option><option value="rejected">Rejected</option></Select>
    <Select label="Category" id="gallery-category" value={categoryFilter} onChange={function onCategory(e){ setCategoryFilter(e.target.value) }}><option value="all">All categories</option>{CATEGORIES.map(function mapCat(c){ return <option key={c.value} value={c.value}>{c.label}</option> })}</Select>
    <Input label="Search" id="gallery-search" value={search} onChange={function onSearch(e){ setSearch(e.target.value) }} placeholder="Title or artist" />
   </div>
   {selected.length>0 && <div className="flex gap-2 items-center mb-3"><span className="text-sm font-bold">{selected.length} selected</span><Button onClick={bulkApprove}>Bulk approve</Button><Button onClick={function openBulkReject(){ setRejectRows(rows.filter(function isSel(r){ return selected.indexOf(r.id)>=0 })); setRejectReason('') }}>Bulk reject</Button><button type="button" onClick={function clearSel(){ setSelected([]) }} className="underline text-sm">Clear selection</button></div>}
   <div className="overflow-x-auto bg-white rounded-2xl border border-sand">
    <table className="w-full text-sm">
     <thead><tr><th className="text-left p-3 border-b"><input type="checkbox" aria-label="Select all shown artworks" checked={allSelected} onChange={function onAll(e){ toggleSelectAll(e.target.checked) }} /></th><th className="text-left p-3 border-b">Title</th><th className="text-left p-3 border-b">Artist</th><th className="text-left p-3 border-b">Category</th><th className="text-left p-3 border-b">Status</th><th className="text-left p-3 border-b">Featured</th><th className="text-left p-3 border-b">Likes</th><th className="text-left p-3 border-b">Actions</th></tr></thead>
     <tbody>
      {filtered.map(function mapArt(r){ return (
       <tr key={r.id} className="border-b">
        <td className="p-3"><input type="checkbox" aria-label={'Select '+r.title} checked={selected.indexOf(r.id)>=0} onChange={function onSel(e){ toggleSelect(r.id,e.target.checked) }} /></td>
        <td className="p-3">{r.title}</td>
        <td className="p-3">{r.artistName}</td>
        <td className="p-3">{r.category}</td>
        <td className="p-3">{r.status}{r.status==='rejected' && r.rejectionReason ? ' — '+r.rejectionReason : ''}</td>
        <td className="p-3">{r.featured?'Yes':'No'}</td>
        <td className="p-3">{r.likeCount||0}</td>
        <td className="p-3"><span className="flex flex-wrap gap-2">
         <button type="button" onClick={function onEdit(){ openEdit(r) }} className="underline">Edit</button>
         {r.status!=='approved' && <button type="button" onClick={function onApprove(){ approveOne(r) }} className="underline">Approve</button>}
         {r.status!=='rejected' && <button type="button" onClick={function onReject(){ setRejectRows([r]); setRejectReason('') }} className="underline">Reject</button>}
         <button type="button" onClick={function onFeature(){ toggleFeatured(r) }} className="underline">{r.featured?'Unfeature':'Feature'}</button>
         <button type="button" onClick={function onDelete(){ setDeleteRow(r) }} className="underline text-red-700">Delete</button>
        </span></td>
       </tr>
      ) })}
      {!filtered.length && <tr><td colSpan="8" className="p-6 text-center">No artworks match the filters.</td></tr>}
     </tbody>
    </table>
   </div>
   <Modal open={formOpen} onClose={function closeForm(){ setFormOpen(false) }} title={editing?'Edit artwork':'Add artwork'}>
    <form onSubmit={handleSubmit(onSubmit)} className="mt-4">
     <FormField control={control} name="title" label="Title" />
     <FormField control={control} name="artistName" label="Artist name" />
     <FormField control={control} name="category" label="Category" type="select" options={CATEGORIES} />
     <FormField control={control} name="description" label="Description" type="textarea" />
     <p className="font-bold text-sm mb-1">Artwork image</p>
     <ImageUploader prefix="gallery" onUploaded={function onImage(up){ setImage(up); setValue('imageUrl',up.url); setValue('imagePath',up.path) }} />
     {image && <img src={image.url} alt="Artwork preview" className="w-32 h-32 object-cover rounded-xl mt-2" />}
     <div className="flex gap-2 justify-end mt-4"><button type="button" onClick={function closeForm(){ setFormOpen(false) }} className="px-4 py-2 rounded-full border-2">Cancel</button><Button disabled={isSubmitting}>{isSubmitting?'Saving…':'Save artwork'}</Button></div>
    </form>
   </Modal>
   <Modal open={Boolean(rejectRows)} onClose={function closeReject(){ setRejectRows(null) }} title={'Reject '+(rejectRows?rejectRows.length:0)+' artwork(s)'}>
    <p className="text-sm my-3">The reason is stored on each artwork and shown to the artist.</p>
    <Input label="Rejection reason" id="reject-reason" value={rejectReason} onChange={function onReason(e){ setRejectReason(e.target.value) }} placeholder="Tell the artist why this work was not approved" />
    <div className="flex gap-2 justify-end"><button type="button" onClick={function closeReject(){ setRejectRows(null) }} className="px-4 py-2 rounded-full border-2">Cancel</button><Button onClick={confirmReject}>Reject</Button></div>
   </Modal>
   <ConfirmDialog open={Boolean(deleteRow)} onClose={function closeDelete(){ setDeleteRow(null) }} onConfirm={confirmDelete} title="Delete artwork?" body={deleteRow?('Delete “'+deleteRow.title+'” by '+deleteRow.artistName+'? This cannot be undone.'):'This action cannot be undone.'} />
  </PermissionGate>
 )
}
