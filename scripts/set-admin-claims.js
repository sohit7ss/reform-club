// Syncs admins/{uid} docs to Firebase custom claims. Run after any role/permission change.
// Usage: cd scripts && npm install && node set-admin-claims.js
import 'dotenv/config'
import admin from 'firebase-admin'
import { readFileSync } from 'fs'
admin.initializeApp({ credential: admin.credential.cert(JSON.parse(readFileSync(process.env.GOOGLE_APPLICATION_CREDENTIALS || './serviceAccountKey.json','utf8'))) })
const snap = await admin.firestore().collection('admins').get()
for (const d of snap.docs) { const a = d.data(); if (a.active) await admin.auth().setCustomUserClaims(d.id, { role:'authenticated', reform_admin:true, clubRole:a.role }); else await admin.auth().setCustomUserClaims(d.id, { role:'authenticated', reform_admin:false, clubRole:a.role }) ; console.log(d.id, a.email, a.role, a.active ? 'claims set' : 'claims revoked') }
console.log('Done.')
