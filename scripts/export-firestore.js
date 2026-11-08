// Backup: reads all collections with the Admin SDK to a timestamped JSON file. Works on the Spark plan.
// Usage: cd scripts && npm install && node export-firestore.js
import 'dotenv/config'
import admin from 'firebase-admin'
import { readFileSync, writeFileSync } from 'fs'
admin.initializeApp({ credential: admin.credential.cert(JSON.parse(readFileSync(process.env.GOOGLE_APPLICATION_CREDENTIALS || './serviceAccountKey.json','utf8'))) })
const db = admin.firestore()
const cols = ['admins','siteSettings','artworks','comments','events','notices','teams','termRecords','teamMembers','membershipSubmissions','applications','contactMessages','constitution','challenges','recognitions','legacyEntries','memberProfiles','blogPosts','auditLogs']
const out = {}
for (const c of cols) { const s = await db.collection(c).get(); out[c] = s.docs.map(d => ({ id:d.id, ...d.data(), _createdAt: d.createTime?.toDate?.()?.toISOString?.() })) }
const file = `firestore-backup-${new Date().toISOString().slice(0,19).replaceAll(':','-')}.json`
writeFileSync(file, JSON.stringify(out, null, 2))
console.log('Backup written to', file)
