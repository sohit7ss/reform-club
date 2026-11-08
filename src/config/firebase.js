import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'
import { initializeAppCheck, ReCaptchaV3Provider } from 'firebase/app-check'
const cfg={apiKey:import.meta.env.VITE_FIREBASE_API_KEY,authDomain:import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,projectId:import.meta.env.VITE_FIREBASE_PROJECT_ID,storageBucket:import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,messagingSenderId:import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,appId:import.meta.env.VITE_FIREBASE_APP_ID,measurementId:import.meta.env.VITE_FIREBASE_MEASUREMENT_ID}
export const isFirebaseConfigured=Boolean(cfg.apiKey && cfg.projectId)
let app=null,auth=null,db=null
if(isFirebaseConfigured){
 app=initializeApp(cfg)
 // Firebase App Check is optional and free-tier: reCAPTCHA v3 only runs when the
 // club sets VITE_RECAPTCHA_SITE_KEY in .env. With the key blank, or when Firebase
 // is unconfigured (demo mode), this block is skipped and the app works as before.
 const siteKey=import.meta.env.VITE_RECAPTCHA_SITE_KEY
 if(siteKey){
  try{ initializeAppCheck(app,{provider:new ReCaptchaV3Provider(siteKey),isTokenAutoRefreshEnabled:true}) }catch(e){ /* App Check is optional; a failed setup must never break the site. */ }
 }
 auth=getAuth(app); db=getFirestore(app)
}
export { app, auth, db }
