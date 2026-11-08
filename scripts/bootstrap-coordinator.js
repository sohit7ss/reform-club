// One-time bootstrap: creates/locates the coordinator, creates admins/{uid} (role coordinator, all permissions true), sets custom claims, prints a password-reset link.
// Usage: cd scripts && npm install && cp .env.example .env  (fill COORDINATOR_EMAIL/NAME, place serviceAccountKey.json here — NEVER commit it) && node bootstrap-coordinator.js
import 'dotenv/config'
import admin from 'firebase-admin'
import { readFileSync } from 'fs'
const svc = JSON.parse(readFileSync(process.env.GOOGLE_APPLICATION_CREDENTIALS || './serviceAccountKey.json','utf8'))
admin.initializeApp({ credential: admin.credential.cert(svc) })
const email = process.env.COORDINATOR_EMAIL, name = process.env.COORDINATOR_NAME || 'Coordinator'
if (!email) { console.error('Set COORDINATOR_EMAIL in scripts/.env'); process.exit(1) }
let user
try { user = await admin.auth().getUserByEmail(email) } catch { user = await admin.auth().createUser({ email, displayName: name }) }
const perms = { gallery:true, events:true, notices:true, team:true, membership:true, applications:true, waste2best:true, constitution:true, comments:true, legacy:true, blog:true }
await admin.firestore().doc(`admins/${user.uid}`).set({ email, name, role:'coordinator', active:true, permissions:perms, createdAt: admin.firestore.FieldValue.serverTimestamp() }, { merge:true })
const settingsRef = admin.firestore().doc('siteSettings/main')
if (!(await settingsRef.get()).exists) {
  await settingsRef.set({ membershipOpen:true, applicationsOpen:{ coAdmin:false, teamHead:false, teamMember:false } })
  console.log('siteSettings/main created with defaults (membership open, all role applications closed).')
} else {
  console.log('siteSettings/main already exists — left unchanged.')
}
await admin.auth().setCustomUserClaims(user.uid, { role:'authenticated', reform_admin:true, clubRole:'coordinator' })
const link = await admin.auth().generatePasswordResetLink(email)
const verifyLink = await admin.auth().generateEmailVerificationLink(email)
console.log('Coordinator ready:', user.uid, email)
console.log('Password-reset link (send it to the coordinator, do not share publicly):', link)
console.log('Email-verification link (the coordinator must verify this email — blog post creation requires a verified email):', verifyLink)
