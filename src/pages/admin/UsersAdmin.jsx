import React,{useCallback,useEffect,useState} from 'react'
import { EmailAuthProvider, reauthenticateWithCredential } from 'firebase/auth'
import DataTable from '../../components/admin/DataTable.jsx'
import Modal from '../../components/ui/Modal.jsx'
import ConfirmDialog from '../../components/ui/ConfirmDialog.jsx'
import Button from '../../components/ui/Button.jsx'
import Input from '../../components/ui/Input.jsx'
import Select from '../../components/ui/Select.jsx'
import { userService } from '../../services/userService.js'
import { auth, isFirebaseConfigured } from '../../config/firebase.js'
import { ROLES, PERMISSIONS, PERMISSION_LABELS } from '../../config/roles.js'
import { useAdminWrite } from '../../hooks/useAdminWrite.js'
import { useAuth } from '../../context/AuthContext.jsx'
import { useToast } from '../../context/ToastContext.jsx'
export default function UsersAdmin(){
 const {user,adminProfile}=useAuth()
 const {push}=useToast()
 const [rows,setRows]=useState([])
 const [editing,setEditing]=useState(null)
 const [editRole,setEditRole]=useState('staff')
 const [editPerms,setEditPerms]=useState({})
 const [editActive,setEditActive]=useState(true)
 const [reauthOpen,setReauthOpen]=useState(false)
 const [reauthPassword,setReauthPassword]=useState('')
 const [reauthBusy,setReauthBusy]=useState(false)
 const [pendingAction,setPendingAction]=useState(null)
 const [confirmOpen,setConfirmOpen]=useState(false)
 const load=useCallback(async function loadRows(){ setRows(await userService.listAdmins()) },[])
 useEffect(function onMount(){ load() },[load])
 const commit=useAdminWrite(user,push,load)
 if(adminProfile && adminProfile.role!=='coordinator') return <p className="p-6">Users and Permissions is coordinator-only.</p>
 const openEdit=function openEditForm(row){
  setEditing(row)
  setEditRole(row.role||'staff')
  setEditPerms(Object.assign({},row.permissions||{}))
  setEditActive(row.active!==false)
 }
 const togglePerm=function togglePermission(perm,checked){
  const next=Object.assign({},editPerms)
  next[perm]=checked
  setEditPerms(next)
 }
 const requestSave=function requestSaveEdit(){
  if(!editing) return
  const data={role:editRole,permissions:editPerms,active:editActive}
  setPendingAction({kind:'save',row:editing,data:data})
  if(isFirebaseConfigured){ setReauthPassword(''); setReauthOpen(true) } else { setConfirmOpen(true) }
 }
 const requestToggleActive=function requestToggle(row){
  const data={active:row.active===false}
  setPendingAction({kind:'toggle',row:row,data:data})
  if(isFirebaseConfigured){ setReauthPassword(''); setReauthOpen(true) } else { setConfirmOpen(true) }
 }
 const runPending=async function runPendingAction(){
  if(!pendingAction) return
  const item=pendingAction
  const row=item.row
  try{
   await commit({run:function runUpdate(){ return userService.updateAdmin(row.uid,item.data) },action:'update',collection:'admins',docId:row.uid,summary:'admin updated: '+row.email+' role='+item.data.role,success:item.kind==='toggle'?(item.data.active?'Admin reactivated.':'Admin deactivated.'):'Admin updated. Run node scripts/set-admin-claims.js to sync custom claims.',local:function localUpdate(){ setRows(function mapRows(rs){ return rs.map(function mapRow(r){ return r.uid===row.uid?Object.assign({},r,item.data):r }) }) }})
   setEditing(null); setPendingAction(null)
  }catch(err){ /* toast already shown by commit */ }
 }
 const confirmReauth=async function doReauth(){
  if(!reauthPassword){ push('Enter your current password to confirm.','error'); return }
  if(!user || !user.email){ push('You must be signed in to confirm this change.','error'); return }
  try{
   setReauthBusy(true)
   const cred=EmailAuthProvider.credential(user.email,reauthPassword)
   await reauthenticateWithCredential(auth.currentUser,cred)
   setReauthBusy(false); setReauthOpen(false); setReauthPassword('')
   await runPending()
  }catch(err){ setReauthBusy(false); push('Re-authentication failed: '+err.message,'error') }
 }
 const confirmDemo=async function doDemoConfirm(){
  setConfirmOpen(false)
  await runPending()
 }
 return (
  <div>
   <h2 className="font-display text-2xl font-bold mb-4">Users and Permissions</h2>
   <p className="text-sm mb-3">Set role, toggle each of the 12 permissions, deactivate or reactivate. Only the Coordinator can open this page. Role, permission and deactivation changes ask you to re-enter your password first. After changing permissions, run <code>node scripts/set-admin-claims.js</code> to sync custom claims (see README).</p>
   <DataTable rows={rows} columns={[
    {key:'name',label:'Name'},
    {key:'email',label:'Email'},
    {key:'role',label:'Role'},
    {key:'permissions',label:'Permissions',render:function renderPerms(r){ return PERMISSIONS.filter(function hasPerm(p){ return r.permissions && r.permissions[p] }).map(function labelPerm(p){ return PERMISSION_LABELS[p] }).join(', ')||'None' }},
    {key:'active',label:'Active',render:function renderActive(r){ return r.active===false?'No':'Yes' }},
    {key:'actions',label:'Actions',render:function renderActions(r){ return (<span className="flex flex-wrap gap-2"><button type="button" onClick={function onEdit(){ openEdit(r) }} className="underline">Edit role and permissions</button><button type="button" onClick={function onToggle(){ requestToggleActive(r) }} className="underline">{r.active===false?'Reactivate':'Deactivate'}</button></span>) }}
   ]} searchKeys={['name','email','role']} />
   <Modal open={Boolean(editing)} onClose={function closeEdit(){ setEditing(null) }} title={editing?('Edit admin — '+editing.email):'Edit admin'}>
    {editing && <div className="mt-4">
     <Select label="Role" id="admin-role" value={editRole} onChange={function onRole(e){ setEditRole(e.target.value) }}>{ROLES.map(function mapRole(r){ return <option key={r} value={r}>{r}</option> })}</Select>
     <p className="font-bold text-sm mb-1">Permissions</p>
     <div className="grid grid-cols-2 gap-1 mb-3">{PERMISSIONS.map(function mapPerm(p){ return (<label key={p} className="flex gap-2 items-center py-1 text-sm"><input type="checkbox" checked={Boolean(editPerms[p])} onChange={function onPerm(e){ togglePerm(p,e.target.checked) }} disabled={editRole==='coordinator'} /> {PERMISSION_LABELS[p]}</label>) })}</div>
     {editRole==='coordinator' && <p className="text-sm mb-3">Coordinators have every permission.</p>}
     <label className="flex gap-2 items-center font-bold text-sm mb-3"><input type="checkbox" checked={editActive} onChange={function onActive(e){ setEditActive(e.target.checked) }} /> Account active</label>
     <div className="flex gap-2 justify-end"><button type="button" onClick={function closeEdit(){ setEditing(null) }} className="px-4 py-2 rounded-full border-2">Cancel</button><Button onClick={requestSave}>Save (asks for password)</Button></div>
    </div>}
   </Modal>
   <Modal open={reauthOpen} onClose={function closeReauth(){ setReauthOpen(false) }} title="Confirm with your password">
    <p className="text-sm my-3">This is a sensitive admin change. Re-enter your current password to continue.</p>
    <Input label="Current password" id="reauth-password" type="password" value={reauthPassword} onChange={function onPw(e){ setReauthPassword(e.target.value) }} />
    <div className="flex gap-2 justify-end"><button type="button" onClick={function closeReauth(){ setReauthOpen(false) }} className="px-4 py-2 rounded-full border-2">Cancel</button><Button onClick={confirmReauth} disabled={reauthBusy}>{reauthBusy?'Checking…':'Confirm and save'}</Button></div>
   </Modal>
   <ConfirmDialog open={confirmOpen} onClose={function closeConfirm(){ setConfirmOpen(false) }} onConfirm={confirmDemo} title="Confirm admin change?" body="Demo mode: Firebase is not configured, so no password check is possible. Confirm this admin change?" />
  </div>
 )
}
