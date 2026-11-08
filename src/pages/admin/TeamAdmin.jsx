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
import Input from '../../components/ui/Input.jsx'
import { teamMemberSchema } from '../../schemas/team.js'
import { teamService } from '../../services/teamService.js'
import { TEAMS } from '../../config/constants.js'
import { useAdminWrite } from '../../hooks/useAdminWrite.js'
import { useAuth } from '../../context/AuthContext.jsx'
import { useToast } from '../../context/ToastContext.jsx'
const DESIGNATIONS=[{value:'faculty_advisor',label:'Faculty Advisor'},{value:'mentor',label:'Mentor'},{value:'coordinator',label:'Coordinator'},{value:'co_coordinator',label:'Co-Coordinator'},{value:'team_head',label:'Team Head'},{value:'team_member',label:'Team Member'}]
const EMPTY={name:'',designation:'team_member',teamId:'',termId:'2026-27',bio:'',socialLink:'',order:0,active:true,photoUrl:'',photoPath:''}
export default function TeamAdmin(){
 const {user}=useAuth()
 const {push}=useToast()
 const [rows,setRows]=useState([])
 const [terms,setTerms]=useState([])
 const [editing,setEditing]=useState(null)
 const [replacing,setReplacing]=useState(null)
 const [formOpen,setFormOpen]=useState(false)
 const [photo,setPhoto]=useState(null)
 const [deleteRow,setDeleteRow]=useState(null)
 const [reassignRow,setReassignRow]=useState(null)
 const [reassignTeams,setReassignTeams]=useState([])
 const [wizardOpen,setWizardOpen]=useState(false)
 const [wizardStep,setWizardStep]=useState(1)
 const [newTermLabel,setNewTermLabel]=useState('')
 const [carryIds,setCarryIds]=useState([])
 const load=useCallback(async function loadStructure(){ const st=await teamService.getCurrentStructure(); setRows(await teamService.listAll()); setTerms(st.terms||[]) },[])
 useEffect(function onMount(){ load() },[load])
 const commit=useAdminWrite(user,push,load)
 const {control,handleSubmit,reset,setValue,formState:{isSubmitting}}=useForm({resolver:zodResolver(teamMemberSchema),defaultValues:EMPTY})
 const teamOptions=[{value:'',label:'No team (club-level role)'}].concat(TEAMS.map(function mapTeam(t){ return {value:t.id,label:t.name} }))
 const currentTerm=terms.find(function isCurrent(t){ return t.isCurrent })||null
 const openAdd=function openAddForm(){ setEditing(null); setReplacing(null); reset(Object.assign({},EMPTY,{termId:currentTerm?currentTerm.label:'2026-27'})); setPhoto(null); setFormOpen(true) }
 const openEdit=function openEditForm(row){
  setEditing(row); setReplacing(null)
  reset({name:row.name||'',designation:row.designation||'team_member',teamId:row.teamId||'',termId:row.termId||'2026-27',bio:row.bio||'',socialLink:row.socialLink||'',order:row.order||0,active:row.active!==false,photoUrl:row.photoUrl||'',photoPath:row.photoPath||''})
  setPhoto(row.photoUrl?{url:row.photoUrl,path:row.photoPath||''}:null)
  setFormOpen(true)
 }
 const openReplace=function openReplaceForm(row){
  setEditing(null); setReplacing(row)
  reset({name:'',designation:row.designation||'team_member',teamId:row.teamId||'',termId:currentTerm?currentTerm.label:(row.termId||'2026-27'),bio:'',socialLink:'',order:row.order||0,active:true,photoUrl:'',photoPath:''})
  setPhoto(null)
  setFormOpen(true)
 }
 const onSubmit=async function submitMember(data){
  try{
   const payload=Object.assign({},data,{teamId:data.teamId||null})
   if(replacing){
    await commit({run:function runReplace(){ return teamService.replaceMember(replacing.id,payload) },action:'update',collection:'teamMembers',docId:replacing.id,summary:'member replaced: '+replacing.name+' with '+payload.name,success:'Member replaced.',local:function localReplace(){ setRows(function mapRows(rs){ return rs.map(function mapRow(r){ return r.id===replacing.id?Object.assign({},r,payload):r }) }) }})
   } else if(editing){
    await commit({run:function runUpdate(){ return teamService.update(editing.id,payload) },action:'update',collection:'teamMembers',docId:editing.id,summary:'member updated: '+payload.name,success:'Member updated.',local:function localUpdate(){ setRows(function mapRows(rs){ return rs.map(function mapRow(r){ return r.id===editing.id?Object.assign({},r,payload):r }) }) }})
   } else {
    await commit({run:function runCreate(){ return teamService.create(payload) },action:'create',collection:'teamMembers',docId:'new',summary:'member added: '+payload.name,success:'Member added.',local:function localAdd(result){ setRows(function prependRows(rs){ return [Object.assign({},payload,{id:result.id})].concat(rs) }) }})
   }
   setFormOpen(false)
  }catch(err){ /* toast already shown by commit */ }
 }
 const toggleActive=async function toggleMemberActive(row){
  try{
   await commit({run:function runArchive(){ return teamService.update(row.id,{active:!row.active}) },action:'update',collection:'teamMembers',docId:row.id,summary:'member active set to '+String(!row.active)+': '+row.name,success:row.active?'Member archived.':'Member restored.',local:function localArchive(){ setRows(function mapRows(rs){ return rs.map(function mapRow(r){ return r.id===row.id?Object.assign({},r,{active:!row.active}):r }) }) }})
  }catch(err){ /* toast already shown */ }
 }
 const confirmDelete=async function doDelete(){
  if(!deleteRow) return
  const row=deleteRow
  try{
   await commit({run:function runDelete(){ return teamService.remove(row.id) },action:'delete',collection:'teamMembers',docId:row.id,summary:'member deleted: '+row.name,success:'Member deleted.',local:function localDelete(){ setRows(function filterRows(rs){ return rs.filter(function keep(r){ return r.id!==row.id }) }) }})
   setDeleteRow(null)
  }catch(err){ /* toast already shown */ }
 }
 const openReassign=function openReassignForm(row){ setReassignRow(row); setReassignTeams(row.coCoordinatorOf||[]) }
 const confirmReassign=async function doReassign(){
  if(!reassignRow) return
  const row=reassignRow
  try{
   await commit({run:function runReassign(){ return teamService.reassignCoCoordinator(row.id,reassignTeams) },action:'update',collection:'teamMembers',docId:row.id,summary:'co-coordinator teams reassigned for '+row.name+': '+reassignTeams.join(', '),success:'Team assignments updated.',local:function localReassign(){ setRows(function mapRows(rs){ return rs.map(function mapRow(r){ return r.id===row.id?Object.assign({},r,{coCoordinatorOf:reassignTeams}):r }) }) }})
   setReassignRow(null)
  }catch(err){ /* toast already shown */ }
 }
 const toggleReassignTeam=function toggleTeam(id,checked){ setReassignTeams(function updateTeams(prev){ return checked?prev.concat([id]):prev.filter(function keep(x){ return x!==id }) }) }
 const openWizard=function startWizard(){ setWizardStep(1); setNewTermLabel(''); setCarryIds(rows.filter(function isActive(r){ return r.active!==false }).map(function getId(r){ return r.id })); setWizardOpen(true) }
 const toggleCarry=function toggleCarryId(id,checked){ setCarryIds(function updateCarry(prev){ return checked?prev.concat([id]):prev.filter(function keep(x){ return x!==id }) }) }
 const confirmNewTerm=async function doNewTerm(){
  if(!newTermLabel.trim()){ push('Enter a new term label, for example 2027-28.','error'); return }
  const label=newTermLabel.trim()
  const carried=carryIds.slice()
  try{
   await commit({run:async function runNewTerm(){ const created=await teamService.startNewTerm(label,carried); for(const id of carried){ await teamService.update(id,{termId:label}) } return created },action:'create',collection:'termRecords',docId:label,summary:'new term started: '+label+' carrying over '+carried.length+' members',success:'New term '+label+' started.',local:function localNewTerm(){ setTerms(function mapTerms(ts){ return ts.map(function mapTerm(t){ return Object.assign({},t,{isCurrent:false}) }).concat([{id:label,label:label,isCurrent:true,archived:false}]) }); setRows(function mapRows(rs){ return rs.map(function mapRow(r){ return carried.indexOf(r.id)>=0?Object.assign({},r,{termId:label}):r }) }) }})
   setWizardOpen(false)
  }catch(err){ /* toast already shown */ }
 }
 const archiveTerm=async function doArchiveTerm(term){
  try{
   await commit({run:function runArchiveTerm(){ return teamService.archiveTerm(term.id) },action:'update',collection:'termRecords',docId:term.id,summary:'term archived: '+term.label,success:'Term '+term.label+' archived.',local:function localArchiveTerm(){ setTerms(function mapTerms(ts){ return ts.map(function mapTerm(t){ return t.id===term.id?Object.assign({},t,{archived:true,isCurrent:false}):t }) }) }})
  }catch(err){ /* toast already shown */ }
 }
 return (
  <PermissionGate permission="team">
   <h2 className="font-display text-2xl font-bold mb-4">Team Management</h2>
   <p className="text-sm mb-3">Current term: {currentTerm?currentTerm.label:'not set'}. Changes appear on the public Team page without code changes.</p>
   <div className="flex gap-2 mb-4"><Button onClick={openAdd}>Add member</Button><Button onClick={openWizard}>Start new term</Button></div>
   <h3 className="font-bold mb-2">Terms</h3>
   <div className="space-y-2 mb-6">{terms.map(function mapTerm(t){ return (<div key={t.id} className="collage-card rounded-xl p-3 flex justify-between items-center text-sm"><span><strong>{t.label}</strong>{t.isCurrent?' — current':''}{t.archived?' — archived':''}</span>{!t.archived && <button type="button" onClick={function onArchive(){ archiveTerm(t) }} className="underline">Archive term</button>}</div>) })}{!terms.length && <p className="text-sm">No term records yet.</p>}</div>
   <h3 className="font-bold mb-2">Members</h3>
   <DataTable rows={rows} columns={[
    {key:'name',label:'Name'},
    {key:'designation',label:'Designation'},
    {key:'teamId',label:'Team',render:function renderTeam(r){ const t=TEAMS.find(function findTeam(x){ return x.id===r.teamId }); return t?t.name:'—' }},
    {key:'coCoordinatorOf',label:'Co-Coordinator of',render:function renderCo(r){ return (r.coCoordinatorOf||[]).join(', ')||'—' }},
    {key:'termId',label:'Term'},
    {key:'active',label:'Active',render:function renderActive(r){ return r.active===false?'No':'Yes' }},
    {key:'actions',label:'Actions',render:function renderActions(r){ return (<span className="flex flex-wrap gap-2"><button type="button" onClick={function onEdit(){ openEdit(r) }} className="underline">Edit</button><button type="button" onClick={function onReplace(){ openReplace(r) }} className="underline">Replace</button>{r.designation==='co_coordinator' && <button type="button" onClick={function onReassign(){ openReassign(r) }} className="underline">Teams</button>}<button type="button" onClick={function onArchive(){ toggleActive(r) }} className="underline">{r.active===false?'Restore':'Archive'}</button><button type="button" onClick={function onDelete(){ setDeleteRow(r) }} className="underline text-red-700">Delete</button></span>) }}
   ]} searchKeys={['name','designation','teamId']} />
   <Modal open={formOpen} onClose={function closeForm(){ setFormOpen(false) }} title={replacing?('Replace member — '+replacing.name):(editing?'Edit member':'Add member')}>
    {replacing && <p className="text-sm my-3">Enter the replacement member. Team, designation and order carry over from {replacing.name}.</p>}
    <form onSubmit={handleSubmit(onSubmit)} className="mt-4">
     <FormField control={control} name="name" label="Full name" />
     <FormField control={control} name="designation" label="Designation" type="select" options={DESIGNATIONS} />
     <FormField control={control} name="teamId" label="Team" type="select" options={teamOptions} />
     <FormField control={control} name="termId" label="Term" />
     <FormField control={control} name="bio" label="Bio" type="textarea" />
     <FormField control={control} name="socialLink" label="Social link" placeholder="https://example.invalid/profile" />
     <FormField control={control} name="order" label="Display order" type="number" />
     <FormField control={control} name="active" label="Active" type="checkbox" />
     <p className="font-bold text-sm mb-1">Photo</p>
     <ImageUploader prefix="team" onUploaded={function onPhoto(up){ setPhoto(up); setValue('photoUrl',up.url); setValue('photoPath',up.path) }} />
     {photo && <img src={photo.url} alt="Member photo preview" className="w-24 h-24 object-cover rounded-full mt-2" />}
     <div className="flex gap-2 justify-end mt-4"><button type="button" onClick={function closeForm(){ setFormOpen(false) }} className="px-4 py-2 rounded-full border-2">Cancel</button><Button disabled={isSubmitting}>{isSubmitting?'Saving…':(replacing?'Replace member':'Save member')}</Button></div>
    </form>
   </Modal>
   <Modal open={Boolean(reassignRow)} onClose={function closeReassign(){ setReassignRow(null) }} title={reassignRow?('Co-Coordinator teams — '+reassignRow.name):'Assign teams'}>
    <p className="text-sm my-3">Pick the teams this Co-Coordinator oversees.</p>
    {TEAMS.map(function mapTeam(t){ return (<label key={t.id} className="flex gap-2 items-center py-1 text-sm font-bold"><input type="checkbox" checked={reassignTeams.indexOf(t.id)>=0} onChange={function onTeam(e){ toggleReassignTeam(t.id,e.target.checked) }} /> {t.name}</label>) })}
    <div className="flex gap-2 justify-end mt-4"><button type="button" onClick={function closeReassign(){ setReassignRow(null) }} className="px-4 py-2 rounded-full border-2">Cancel</button><Button onClick={confirmReassign}>Save assignments</Button></div>
   </Modal>
   <Modal open={wizardOpen} onClose={function closeWizard(){ setWizardOpen(false) }} title="Start new term">
    {wizardStep===1 && <div><p className="text-sm my-3">Step 1 of 3 — name the new term. The current term stays in history.</p><Input label="New term label" id="new-term-label" value={newTermLabel} onChange={function onLabel(e){ setNewTermLabel(e.target.value) }} placeholder="2027-28" /><div className="flex gap-2 justify-end"><Button onClick={function nextStep(){ if(!newTermLabel.trim()){ push('Enter a new term label first.','error'); return } setWizardStep(2) }}>Next — choose members</Button></div></div>}
    {wizardStep===2 && <div><p className="text-sm my-3">Step 2 of 3 — select members to carry over into {newTermLabel||'the new term'}.</p><div className="max-h-64 overflow-auto">{rows.filter(function isActive(r){ return r.active!==false }).map(function mapMember(r){ return (<label key={r.id} className="flex gap-2 items-center py-1 text-sm"><input type="checkbox" checked={carryIds.indexOf(r.id)>=0} onChange={function onCarry(e){ toggleCarry(r.id,e.target.checked) }} /> {r.name} — {r.designation}</label>) })}</div><div className="flex gap-2 justify-end mt-4"><button type="button" onClick={function backStep(){ setWizardStep(1) }} className="px-4 py-2 rounded-full border-2">Back</button><Button onClick={function nextStep(){ setWizardStep(3) }}>Next — confirm</Button></div></div>}
    {wizardStep===3 && <div><p className="text-sm my-3">Step 3 of 3 — confirm. This creates term “{newTermLabel}” and carries over {carryIds.length} member(s). The old term record is kept in history.</p><div className="flex gap-2 justify-end"><button type="button" onClick={function backStep(){ setWizardStep(2) }} className="px-4 py-2 rounded-full border-2">Back</button><Button onClick={confirmNewTerm}>Start term {newTermLabel||''}</Button></div></div>}
   </Modal>
   <ConfirmDialog open={Boolean(deleteRow)} onClose={function closeDelete(){ setDeleteRow(null) }} onConfirm={confirmDelete} title="Delete member?" body={deleteRow?('Delete '+deleteRow.name+' from the team? This cannot be undone.'):'This action cannot be undone.'} />
  </PermissionGate>
 )
}
