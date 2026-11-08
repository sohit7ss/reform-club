// Sets the coordinator's password directly (no reset link needed) and marks the
// email verified, so blog creation works. Use when reset links keep failing.
// Usage: cd scripts && node set-coordinator-password.js
//   (it will ask for the new password; nothing is saved to any file)
//   or: node set-coordinator-password.js "YourNewPassword123"
// Requires: scripts/.env with COORDINATOR_EMAIL, and serviceAccountKey.json here.
import 'dotenv/config'
import admin from 'firebase-admin'
import { readFileSync } from 'fs'
import readline from 'readline'

const svc = JSON.parse(readFileSync(process.env.GOOGLE_APPLICATION_CREDENTIALS || './serviceAccountKey.json', 'utf8'))
admin.initializeApp({ credential: admin.credential.cert(svc) })
const email = process.env.COORDINATOR_EMAIL
if (!email) { console.error('Set COORDINATOR_EMAIL in scripts/.env'); process.exit(1) }

let password = process.argv[2]
if (!password) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
  password = await new Promise((resolve) => rl.question('New password (min 6 characters): ', (a) => { rl.close(); resolve(a) }))
}
if (!password || password.length < 6) { console.error('Password must be at least 6 characters.'); process.exit(1) }

const user = await admin.auth().getUserByEmail(email)
await admin.auth().updateUser(user.uid, { password, emailVerified: true })
console.log('Password set for', email)
console.log('Email marked verified. Log in at https://reform-website-338a2.web.app/admin/login')
process.exit(0)
