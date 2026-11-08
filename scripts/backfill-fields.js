// One-time backfill for the final hardening round (run once, then delete or keep for reference).
// Sets uploadedAt on artworks that lack it (from createdAt when present, else the server time)
// and archived:false on teamMembers that lack the archived field. Never deletes anything.
// Usage: cd scripts && npm install && node backfill-fields.js [--dry-run]
//   --dry-run prints what would change without writing.
import 'dotenv/config'
import admin from 'firebase-admin'
import { readFileSync } from 'fs'
const dryRun = process.argv.includes('--dry-run')
admin.initializeApp({ credential: admin.credential.cert(JSON.parse(readFileSync(process.env.GOOGLE_APPLICATION_CREDENTIALS || './serviceAccountKey.json', 'utf8'))) })
const db = admin.firestore()
async function backfillCollection(name, needsFix, fix) {
  let checked = 0, fixed = 0
  const snap = await db.collection(name).get()
  for (const d of snap.docs) {
    checked++
    const data = d.data()
    if (!needsFix(data)) continue
    if (dryRun) { console.log('[dry-run] would fix', name + '/' + d.id) } else { await d.ref.update(fix(data)); console.log('fixed', name + '/' + d.id) }
    fixed++
  }
  return { checked, fixed }
}
const art = await backfillCollection('artworks',
  (d) => d.uploadedAt === undefined,
  (d) => ({ uploadedAt: d.createdAt || admin.firestore.FieldValue.serverTimestamp() }))
const members = await backfillCollection('teamMembers',
  (d) => d.archived === undefined,
  () => ({ archived: false }))
console.log('artworks: checked ' + art.checked + ', ' + (dryRun ? 'would fix ' : 'fixed ') + art.fixed)
console.log('teamMembers: checked ' + members.checked + ', ' + (dryRun ? 'would fix ' : 'fixed ') + members.fixed)
console.log(dryRun ? 'Dry run — nothing was written.' : 'Backfill complete.')
