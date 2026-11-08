// Optional demo seed (OFF by default — run only when you explicitly want demo content in Firestore).
// Usage: cd scripts && npm install && node seed-demo-data.js
import 'dotenv/config'
import admin from 'firebase-admin'
import { readFileSync } from 'fs'
admin.initializeApp({ credential: admin.credential.cert(JSON.parse(readFileSync(process.env.GOOGLE_APPLICATION_CREDENTIALS || './serviceAccountKey.json','utf8'))) })
const db = admin.firestore()
const teams = [['art','Art','Painting, sketching, drawing, and visual art activities.'],['craft','Craft','Handmade crafts, upcycling, and creative reuse of waste materials.'],['design_media','Design & Media','Posters, graphics, branding, photography, and digital media.'],['pr','PR','Public relations, communication, and maintaining the club\'s public image.'],['outreach','Outreach','Connecting with students, other clubs, and external communities.'],['content','Content','Captions, descriptions, documentation, and creative writing.'],['events','Events','Planning, organising, and managing club events and workshops.'],['treasurer','Treasurer','Budget records, expense tracking, and financial management.']]
for (const [i,[id,name,resp]] of teams.entries()) await db.doc(`teams/${id}`).set({ name, slug:id, responsibility:resp, order:i+1 })
await db.doc('termRecords/2026-27').set({ label:'2026-27', isCurrent:true, archived:false })
if (!(await db.doc('siteSettings/main').get()).exists) {
  await db.doc('siteSettings/main').set({ heroTitle:'Reimagining Everything From Ordinary Materials', heroSubtitle:'A student art & craft community.', contactEmail:'', institution:'', applicationsOpen:{ coAdmin:false, teamHead:false, teamMember:false }, membershipOpen:true })
  console.log('siteSettings/main created with defaults (membership open, all role applications closed).')
} else {
  console.log('siteSettings/main already exists — left unchanged.')
}
console.log('Demo seed written (teams, term, settings).')
