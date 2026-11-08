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
import { blogSchema } from '../../schemas/blog.js'
import { blogService } from '../../services/blogService.js'
import { BLOG_CATEGORIES } from '../../config/constants.js'
import { useAdminWrite } from '../../hooks/useAdminWrite.js'
import { useAuth } from '../../context/AuthContext.jsx'
import { useToast } from '../../context/ToastContext.jsx'
const CATEGORIES=BLOG_CATEGORIES.map(function mapCat(c){ return {value:c,label:c.replaceAll('_',' ')} })
const STATUSES=[{value:'draft',label:'Draft'},{value:'pending',label:'Pending review'},{value:'published',label:'Published'}]
const EMPTY={title:'',slug:'',category:'tutorial',authorName:'',status:'draft',content:'',coverUrl:'',coverPath:''}
function slugify(text){ return String(text||'').toLowerCase().trim().replaceAll(/[^a-z0-9]+/g,'-').replaceAll(/^-+|-+$/g,'') }
export default function BlogAdmin(){
 const {user}=useAuth()
 const {push}=useToast()
 const [rows,setRows]=useState([])
 const [editing,setEditing]=useState(null)
 const [formOpen,setFormOpen]=useState(false)
 const [cover,setCover]=useState(null)
 const [deleteRow,setDeleteRow]=useState(null)
 const load=useCallback(async function loadRows(){ setRows(await blogService.listAll()) },[])
 useEffect(function onMount(){ load() },[load])
 const commit=useAdminWrite(user,push,load)
 const {control,handleSubmit,reset,setValue,getValues,formState:{isSubmitting}}=useForm({resolver:zodResolver(blogSchema),defaultValues:EMPTY})
 const openAdd=function openAddForm(){ setEditing(null); reset(EMPTY); setCover(null); setFormOpen(true) }
 const openEdit=function openEditForm(row){
  setEditing(row)
  reset({title:row.title||'',slug:row.slug||'',category:row.category||'tutorial',authorName:row.authorName||'',status:row.status||'draft',content:row.content||'',coverUrl:row.coverUrl||'',coverPath:row.coverPath||''})
  setCover(row.coverUrl?{url:row.coverUrl,path:row.coverPath||''}:null)
  setFormOpen(true)
 }
 const onSubmit=async function submitPost(data){
  try{
   const payload=Object.assign({},data,{authorUid:user?user.uid:''})
   // Last round (item 3): a create with status 'published' carries
   // publishedAt, matching the date string setPostStatus sends on publish.
   if(!editing && data.status==='published'){ payload.publishedAt=new Date().toISOString().slice(0,10) }
   if(editing){
    await commit({run:function runUpdate(){ return blogService.update(editing.id,payload) },action:'update',collection:'blogPosts',docId:editing.id,summary:'blog post updated: '+payload.title,success:'Blog post updated.',local:function localUpdate(){ setRows(function mapRows(rs){ return rs.map(function mapRow(r){ return r.id===editing.id?Object.assign({},r,payload):r }) }) }})
   } else {
    await commit({run:function runCreate(){ return blogService.create(payload) },action:'create',collection:'blogPosts',docId:'new',summary:'blog post created: '+payload.title,success:'Blog post created.',local:function localAdd(result){ setRows(function prependRows(rs){ return [Object.assign({},payload,{id:result.id})].concat(rs) }) }})
   }
   setFormOpen(false)
  }catch(err){ /* toast already shown by commit */ }
 }
 const setPostStatus=async function doSetStatus(row,status){
  const patch={status:status}
  if(status==='published'){ patch.publishedAt=new Date().toISOString().slice(0,10) }
  try{
   await commit({run:function runStatus(){ return blogService.update(row.id,patch) },action:'update',collection:'blogPosts',docId:row.id,summary:'blog post '+status+': '+row.title,success:status==='published'?'Blog post published.':'Blog post sent back to draft.',local:function localStatus(){ setRows(function mapRows(rs){ return rs.map(function mapRow(r){ return r.id===row.id?Object.assign({},r,patch):r }) }) }})
  }catch(err){ /* toast already shown */ }
 }
 const confirmDelete=async function doDelete(){
  if(!deleteRow) return
  const row=deleteRow
  try{
   await commit({run:function runDelete(){ return blogService.remove(row.id) },action:'delete',collection:'blogPosts',docId:row.id,summary:'blog post deleted: '+row.title,success:'Blog post deleted.',local:function localDelete(){ setRows(function filterRows(rs){ return rs.filter(function keep(r){ return r.id!==row.id }) }) }})
   setDeleteRow(null)
  }catch(err){ /* toast already shown */ }
 }
 return (
  <PermissionGate permission="blog">
   <h2 className="font-display text-2xl font-bold mb-4">Blog posts</h2>
   {user && user.emailVerified===false && <p role="alert" className="text-sm mb-3 text-red-700">Your email is not verified — new blog posts cannot be created until you verify your email. You can still edit existing posts.</p>}
   <p className="text-sm mb-3">Member-submitted posts arrive as pending; approve to publish or send back to draft. Content is markdown, sanitised on render (DOMPurify).</p>
   <Button onClick={openAdd} disabled={Boolean(user && user.emailVerified===false)} className="mb-4">Add blog post</Button>
   <DataTable rows={rows} columns={[
    {key:'title',label:'Title'},
    {key:'category',label:'Category'},
    {key:'authorName',label:'Author'},
    {key:'status',label:'Status'},
    {key:'actions',label:'Actions',render:function renderActions(r){ return (<span className="flex flex-wrap gap-2"><button type="button" onClick={function onEdit(){ openEdit(r) }} className="underline">Edit</button>{r.status==='pending' && <button type="button" onClick={function onApprove(){ setPostStatus(r,'published') }} className="underline">Approve and publish</button>}{r.status==='pending' && <button type="button" onClick={function onDraft(){ setPostStatus(r,'draft') }} className="underline">Send back to draft</button>}{r.status==='published' && <button type="button" onClick={function onUnpublish(){ setPostStatus(r,'draft') }} className="underline">Unpublish</button>}<button type="button" onClick={function onDelete(){ setDeleteRow(r) }} className="underline text-red-700">Delete</button></span>) }}
   ]} searchKeys={['title','authorName','status']} />
   <Modal open={formOpen} onClose={function closeForm(){ setFormOpen(false) }} title={editing?'Edit blog post':'Add blog post'}>
    <form onSubmit={handleSubmit(onSubmit)} className="mt-4">
     <FormField control={control} name="title" label="Title" />
     <FormField control={control} name="slug" label="Slug (used in the post URL)" hint="Lowercase letters, numbers and hyphens only." />
     <button type="button" onClick={function makeSlug(){ setValue('slug',slugify(getValues('title'))) }} className="underline text-sm mb-3">Use title as slug</button>
     <FormField control={control} name="authorName" label="Author name" />
     <FormField control={control} name="category" label="Category" type="select" options={CATEGORIES} />
     <FormField control={control} name="status" label="Status" type="select" options={STATUSES} />
     <FormField control={control} name="content" label="Content (Markdown)" type="textarea" rows={10} />
     <p className="font-bold text-sm mb-1">Cover image</p>
     <ImageUploader prefix="blog" onUploaded={function onCover(up){ setCover(up); setValue('coverUrl',up.url); setValue('coverPath',up.path) }} />
     {cover && <img src={cover.url} alt="Blog cover preview" className="w-full max-w-xs rounded-xl mt-2" />}
     <div className="flex gap-2 justify-end mt-4"><button type="button" onClick={function closeForm(){ setFormOpen(false) }} className="px-4 py-2 rounded-full border-2">Cancel</button><Button disabled={isSubmitting}>{isSubmitting?'Saving…':'Save post'}</Button></div>
    </form>
   </Modal>
   <ConfirmDialog open={Boolean(deleteRow)} onClose={function closeDelete(){ setDeleteRow(null) }} onConfirm={confirmDelete} title="Delete blog post?" body={deleteRow?('Delete “'+deleteRow.title+'”? This cannot be undone.'):'This action cannot be undone.'} />
  </PermissionGate>
 )
}
