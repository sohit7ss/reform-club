import React,{useEffect,useState} from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import FormField from '../../components/admin/FormField.jsx'
import Button from '../../components/ui/Button.jsx'
import { settingsSchema } from '../../schemas/settings.js'
import { settingsService } from '../../services/settingsService.js'
import { useAdminWrite } from '../../hooks/useAdminWrite.js'
import { useAuth } from '../../context/AuthContext.jsx'
import { useToast } from '../../context/ToastContext.jsx'
const DEFAULTS={heroTitle:'',heroSubtitle:'',about:{intro:'',background:'',vision:'',mission:'',objectives:'',philosophy:''},contactEmail:'',contactPhone:'',institution:'',address:'',socialLinks:{instagram:'',facebook:'',youtube:'',twitter:''},membershipOpen:true,applicationsOpen:{coAdmin:false,teamHead:false,teamMember:false},featuredArtworkIds:[],artistOfMonth:''}
function toFormValues(s){
 const src=s||{}
 return {
  heroTitle:src.heroTitle||'',
  heroSubtitle:src.heroSubtitle||'',
  about:Object.assign({},DEFAULTS.about,src.about||{}),
  contactEmail:(src.contactEmail && String(src.contactEmail).indexOf('@')>=0)?src.contactEmail:'',
  contactPhone:src.contactPhone||'',
  institution:src.institution||'',
  address:src.address||'',
  socialLinks:Object.assign({},DEFAULTS.socialLinks,src.socialLinks||{}),
  membershipOpen:src.membershipOpen!==false,
  applicationsOpen:Object.assign({},DEFAULTS.applicationsOpen,src.applicationsOpen||{}),
  featuredArtworkIds:src.featuredArtworkIds||[],
  artistOfMonth:src.artistOfMonth||''
 }
}
export default function SettingsAdmin(){
 const {user}=useAuth()
 const {push}=useToast()
 const [loaded,setLoaded]=useState(false)
 const commit=useAdminWrite(user,push,null)
 const {control,handleSubmit,reset,formState:{isSubmitting}}=useForm({resolver:zodResolver(settingsSchema),defaultValues:DEFAULTS})
 useEffect(function onMount(){ (async function fetchSettings(){ const s=await settingsService.get(); reset(toFormValues(s)); setLoaded(true) })() },[reset])
 const onSubmit=async function saveSettings(data){
  try{
   await commit({run:function runSave(){ return settingsService.update(data) },action:'update',collection:'siteSettings',docId:'main',summary:'site settings updated',success:'Settings saved.',local:function localSave(){ /* form already holds the saved values */ }})
  }catch(err){ /* toast already shown by commit */ }
 }
 if(!loaded) return <p>Loading…</p>
 return (
  <div>
   <h2 className="font-display text-2xl font-bold mb-4">Settings</h2>
   <form onSubmit={handleSubmit(onSubmit)} className="max-w-2xl space-y-6">
    <section className="collage-card rounded-2xl p-5">
     <h3 className="font-bold mb-3">Home hero</h3>
     <FormField control={control} name="heroTitle" label="Hero title" />
     <FormField control={control} name="heroSubtitle" label="Hero subtitle" type="textarea" />
    </section>
    <section className="collage-card rounded-2xl p-5">
     <h3 className="font-bold mb-3">About the club</h3>
     <FormField control={control} name="about.intro" label="Introduction" type="textarea" />
     <FormField control={control} name="about.background" label="Background" type="textarea" />
     <FormField control={control} name="about.vision" label="Vision" type="textarea" />
     <FormField control={control} name="about.mission" label="Mission" type="textarea" />
     <FormField control={control} name="about.objectives" label="Objectives" type="textarea" />
     <FormField control={control} name="about.philosophy" label="Philosophy" type="textarea" />
    </section>
    <section className="collage-card rounded-2xl p-5">
     <h3 className="font-bold mb-3">Contact</h3>
     <FormField control={control} name="contactEmail" label="Contact email" />
     <FormField control={control} name="contactPhone" label="Contact phone (optional)" />
     <FormField control={control} name="institution" label="Institution" />
     <FormField control={control} name="address" label="Address (optional)" type="textarea" />
    </section>
    <section className="collage-card rounded-2xl p-5">
     <h3 className="font-bold mb-3">Social links</h3>
     <FormField control={control} name="socialLinks.instagram" label="Instagram URL" placeholder="https://instagram.com/reform" />
     <FormField control={control} name="socialLinks.facebook" label="Facebook URL" placeholder="https://facebook.com/reform" />
     <FormField control={control} name="socialLinks.youtube" label="YouTube URL" placeholder="https://youtube.com/@reform" />
     <FormField control={control} name="socialLinks.twitter" label="X / Twitter URL" placeholder="https://x.com/reform" />
    </section>
    <section className="collage-card rounded-2xl p-5">
     <h3 className="font-bold mb-3">Joining</h3>
     <FormField control={control} name="membershipOpen" label="General membership is open" type="checkbox" />
     <FormField control={control} name="applicationsOpen.coAdmin" label="Co-Coordinator applications open" type="checkbox" />
     <FormField control={control} name="applicationsOpen.teamHead" label="Team Head applications open" type="checkbox" />
     <FormField control={control} name="applicationsOpen.teamMember" label="Team Member applications open" type="checkbox" />
    </section>
    <section className="collage-card rounded-2xl p-5">
     <h3 className="font-bold mb-3">Featured on the home page</h3>
     <FormField control={control} name="featuredArtworkIds" label="Featured artwork IDs" type="commalist" placeholder="art-1, art-3" hint="Comma-separated artwork IDs shown as featured on the home page." />
     <FormField control={control} name="artistOfMonth" label="Artist of the Month (name or recognition ID)" />
    </section>
    <Button disabled={isSubmitting}>{isSubmitting?'Saving…':'Save settings'}</Button>
   </form>
  </div>
 )
}
