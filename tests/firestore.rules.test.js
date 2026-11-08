/**
 * Firestore security-rules tests for RE:FORM.
 *
 * Run against the local Firestore emulator (Java 21+ required):
 *
 *   npx firebase emulators:exec --only firestore "npm run test:rules"
 *
 * or start the emulator first from this repo root
 * (`npx firebase emulators:start --only firestore`) and then run
 * `npm run test:rules`.
 *
 * The emulator loads the repo's firestore.rules from firebase.json when it
 * starts, so always start it from this directory (or use emulators:exec,
 * which starts a fresh emulator per run) after editing firestore.rules.
 * The test env deliberately does NOT upload rules itself: the rules upload
 * endpoint of the current Firestore emulator (cloud-firestore-emulator
 * 1.22.0) rejects the upload with 500 "http2 exception" over both HTTP/1.1
 * and h2c, so @firebase/rules-unit-testing's `firestore.rules` option
 * cannot be used with this emulator version.
 *
 * The suite seeds admins + siteSettings/main + fixtures with rules
 * disabled, then checks every behaviour in the master prompt's "Mandatory
 * rules behaviour" list with assertSucceeds / assertFails. Project id is
 * demo-* so nothing can touch production.
 */
import assert from 'node:assert';
import { describe, it, before, after, beforeEach } from 'node:test';
import {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
} from '@firebase/rules-unit-testing';
import {
  doc,
  collection,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  addDoc,
  query,
  where,
  writeBatch,
  runTransaction,
  increment,
  serverTimestamp,
} from 'firebase/firestore';

const PROJECT_ID = 'demo-reform-rules';

// ---------------------------------------------------------------------------
// Identities
// ---------------------------------------------------------------------------
const COORD = 'coord-1'; // coordinator, all permissions
const COCO_APPS = 'coco-apps'; // co_coordinator WITH permissions.applications
const COCO_NOAPPS = 'coco-noapps'; // co_coordinator WITHOUT permissions.applications
const MENTOR_APPS = 'mentor-apps'; // mentor WITH permissions.applications
const MENTOR = 'mentor-1'; // mentor WITHOUT permissions.applications
const ADMIN_MEM = 'admin-mem'; // co_coordinator WITH permissions.membership only
const ADMIN_CONTACT = 'admin-contact'; // co_coordinator WITH permissions.contact only
const ADMIN_GALLERY = 'admin-gallery'; // co_coordinator WITH permissions.gallery only
const ADMIN_EVENTS = 'admin-events'; // co_coordinator WITH permissions.events only
const ADMIN_NOTICES = 'admin-notices'; // co_coordinator WITH permissions.notices only
const ADMIN_TEAM = 'admin-team'; // co_coordinator WITH permissions.team only
const ADMIN_W2B = 'admin-w2b'; // co_coordinator WITH permissions.waste2best only
const ADMIN_CONST = 'admin-const'; // co_coordinator WITH permissions.constitution only
const ADMIN_COMMENTS = 'admin-comments'; // co_coordinator WITH permissions.comments only
const ADMIN_LEGACY = 'admin-legacy'; // co_coordinator WITH permissions.legacy only
const ADMIN_BLOG = 'admin-blog'; // co_coordinator WITH permissions.blog only
const ADMIN_NOKEY = 'admin-nokey'; // co_coordinator whose permissions map LACKS 'applications'
const MEMBER = 'member-1'; // signed-in member / voter, not an admin
const MEMBER2 = 'member-2';
const VOTER = 'voter-1';
const ARTIST = 'artist-1';

const ALL_PERMS = {
  gallery: false,
  events: false,
  notices: false,
  team: false,
  membership: false,
  applications: false,
  waste2best: false,
  constitution: false,
  comments: false,
  legacy: false,
  blog: false,
  users: false,
  contact: false,
};
const ALL_TRUE = Object.fromEntries(Object.keys(ALL_PERMS).map((k) => [k, true]));

const adminDoc = (role, perms = {}) => ({
  email: `${role}@example.invalid`,
  name: role,
  role,
  active: true,
  permissions: { ...ALL_PERMS, ...perms },
});

const OPEN_ALL = { coAdmin: true, teamHead: true, teamMember: true };

// ---------------------------------------------------------------------------
// Valid public payloads (mirror the exact key lists in firestore.rules)
// ---------------------------------------------------------------------------
const validMembership = (overrides = {}) => ({
  fullName: 'Test Member',
  branch: 'Computer Science',
  academicYear: '2nd Year',
  email: 'member@example.com',
  phone: '9876543210',
  interests: ['painting'],
  skills: 'Watercolour and sketching',
  intro: 'I love making art from waste materials.',
  status: 'new',
  ...overrides,
});

const validApplication = (role = 'team_member', overrides = {}) => ({
  fullName: 'Test Applicant',
  branch: 'Computer Science',
  academicYear: '2nd Year',
  email: 'applicant@example.com',
  phone: '9876543210',
  preferredRole: role,
  preferredTeam: 'art',
  reason:
    'I want to join because I love art and craft and want to help organise exhibitions and workshops for the club.',
  skills: 'Painting, sketching, event organisation',
  status: 'received',
  ...overrides,
});

const validContact = (overrides = {}) => ({
  name: 'Test Visitor',
  email: 'visitor@example.com',
  subject: 'Question about membership',
  message: 'Hello, I would like to know more about joining the club this semester.',
  status: 'unread',
  ...overrides,
});

const validArtworkCreate = (uid, overrides = {}) => ({
  title: 'Test Artwork',
  artistName: 'Member One',
  artistUid: uid,
  category: 'painting',
  status: 'pending',
  source: 'member',
  likeCount: 0,
  featured: false,
  uploadedAt: serverTimestamp(),
  createdAt: serverTimestamp(),
  ...overrides,
});

const validBlog = (uid, overrides = {}) => ({
  title: 'Hello Watercolour World',
  slug: 'hello-watercolour-world',
  content: 'A short draft post about starting with watercolour paints.',
  authorUid: uid,
  status: 'draft',
  ...overrides,
});

const validW2B = (uid, overrides = {}) => ({
  participantName: 'Member One',
  branch: 'Computer Science',
  academicYear: '2nd Year',
  uid,
  projectTitle: 'Bottle Lamp',
  description: 'A lamp made from a discarded bottle.',
  howMade: 'Cut the bottle, fitted fairy lights inside and sealed the base.',
  materialsUsed: 'Glass bottle, fairy lights',
  imagePaths: ['w2b/test.jpg'],
  imageUrls: ['https://example.invalid/w2b.jpg'],
  status: 'pending',
  voteCount: 0,
  judgeScore: null,
  createdAt: serverTimestamp(),
  updatedAt: serverTimestamp(),
  ...overrides,
});

// ---------------------------------------------------------------------------
// Environment + seeding (rules disabled, so this is setup, not under test)
// ---------------------------------------------------------------------------
let testEnv;

async function seedAll() {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'admins', COORD), adminDoc('coordinator', ALL_TRUE));
    await setDoc(doc(db, 'admins', COCO_APPS), adminDoc('co_coordinator', { applications: true }));
    await setDoc(doc(db, 'admins', COCO_NOAPPS), adminDoc('co_coordinator'));
    await setDoc(doc(db, 'admins', MENTOR_APPS), adminDoc('mentor', { applications: true }));
    await setDoc(doc(db, 'admins', MENTOR), adminDoc('mentor'));
    await setDoc(doc(db, 'admins', ADMIN_MEM), adminDoc('co_coordinator', { membership: true }));
    await setDoc(doc(db, 'admins', ADMIN_CONTACT), adminDoc('co_coordinator', { contact: true }));
    // Last round (item 4): one admin per module, holding ONLY that
    // module's permission, so each payload test proves the exact gate.
    await setDoc(doc(db, 'admins', ADMIN_GALLERY), adminDoc('co_coordinator', { gallery: true }));
    await setDoc(doc(db, 'admins', ADMIN_EVENTS), adminDoc('co_coordinator', { events: true }));
    await setDoc(doc(db, 'admins', ADMIN_NOTICES), adminDoc('co_coordinator', { notices: true }));
    await setDoc(doc(db, 'admins', ADMIN_TEAM), adminDoc('co_coordinator', { team: true }));
    await setDoc(doc(db, 'admins', ADMIN_W2B), adminDoc('co_coordinator', { waste2best: true }));
    await setDoc(doc(db, 'admins', ADMIN_CONST), adminDoc('co_coordinator', { constitution: true }));
    await setDoc(doc(db, 'admins', ADMIN_COMMENTS), adminDoc('co_coordinator', { comments: true }));
    await setDoc(doc(db, 'admins', ADMIN_LEGACY), adminDoc('co_coordinator', { legacy: true }));
    await setDoc(doc(db, 'admins', ADMIN_BLOG), adminDoc('co_coordinator', { blog: true }));
    // Permissions map deliberately missing the 'applications' key (fix 9).
    const permsNoApps = { ...ALL_PERMS };
    delete permsNoApps.applications;
    await setDoc(doc(db, 'admins', ADMIN_NOKEY), {
      email: 'co_coordinator@example.invalid',
      name: 'co_coordinator',
      role: 'co_coordinator',
      active: true,
      permissions: permsNoApps,
    });
    await setDoc(doc(db, 'siteSettings', 'main'), {
      heroTitle: 'Test',
      applicationsOpen: { ...OPEN_ALL },
      membershipOpen: true,
    });
    await setDoc(doc(db, 'membershipSubmissions', 'ms-1'), validMembership());
    await setDoc(doc(db, 'applications', 'app-1'), validApplication());
    // Application that already carries history (fix 2: grow-only + byUid).
    await setDoc(doc(db, 'applications', 'app-2'), validApplication('team_member', {
      statusHistory: [{ status: 'received', at: '2026-11-01T00:00:00Z', byUid: COCO_APPS, byName: 'coco' }],
      reviewNotes: [{ byUid: COCO_APPS, byName: 'coco', text: 'First note', at: '2026-11-01T00:00:00Z' }],
    }));
    await setDoc(doc(db, 'contactMessages', 'cm-1'), validContact());
    await setDoc(doc(db, 'auditLogs', 'log-1'), {
      actorUid: COORD,
      actorEmail: 'coordinator@example.invalid',
      action: 'create',
      collection: 'artworks',
      docId: 'art-approved',
      summary: 'seed log',
      createdAt: serverTimestamp(),
    });
    await setDoc(doc(db, 'artworks', 'art-approved'), {
      title: 'Approved Art',
      artistName: 'Asha Verma',
      artistUid: ARTIST,
      category: 'painting',
      description: 'An approved painting.',
      imageUrl: 'https://example.invalid/a.jpg',
      status: 'approved',
      featured: false,
      likeCount: 5,
      source: 'admin',
    });
    await setDoc(doc(db, 'artworks', 'art-pending'), {
      title: 'Pending Art',
      artistName: 'Member One',
      artistUid: MEMBER,
      category: 'painting',
      description: 'A pending painting.',
      imageUrl: 'https://example.invalid/p.jpg',
      status: 'pending',
      featured: false,
      likeCount: 0,
      source: 'member',
    });
    // Separate artwork that MEMBER already liked (for unlike tests).
    await setDoc(doc(db, 'artworks', 'art-liked'), {
      title: 'Liked Art',
      artistName: 'Asha Verma',
      artistUid: ARTIST,
      category: 'craft',
      description: 'An approved craft piece.',
      imageUrl: 'https://example.invalid/l.jpg',
      status: 'approved',
      featured: false,
      likeCount: 5,
      source: 'admin',
    });
    await setDoc(doc(db, 'artworks', 'art-liked', 'likes', MEMBER), {
      createdAt: serverTimestamp(),
    });
    for (const [id, status] of [
      ['ch-open', 'open'],
      ['ch-closed', 'closed'],
      ['ch-draft', 'draft'],
      ['ch-voting', 'voting'],
    ]) {
      await setDoc(doc(db, 'challenges', id), {
        title: `Challenge ${id}`,
        theme: 'Light from Waste',
        description: 'Make something from waste.',
        rules: 'Original work only.',
        month: '2026-11',
        semester: '2026-ODD',
        category: 'waste_to_best',
        status,
      });
    }
    const sub = (participantName, status, voteCount) => ({
      participantName,
      branch: 'Computer Science',
      academicYear: '2nd Year',
      uid: ARTIST,
      projectTitle: `Project ${participantName}`,
      description: 'A project made from discarded materials.',
      howMade: 'Collected waste, cleaned it and assembled the piece.',
      materialsUsed: 'Plastic bottles, paint',
      imagePaths: ['w2b/sub.jpg'],
      imageUrls: ['https://example.invalid/sub.jpg'],
      status,
      voteCount,
      judgeScore: 8,
    });
    await setDoc(doc(db, 'challenges', 'ch-open', 'submissions', 'sub-1'), sub('Priya Nair', 'approved', 10));
    await setDoc(doc(db, 'challenges', 'ch-open', 'submissions', 'sub-2'), sub('Kavya Singh', 'approved', 3));
    await setDoc(doc(db, 'challenges', 'ch-open', 'submissions', 'sub-pending'), sub('Rohan Mehta', 'pending', 0));
    // Voting-challenge mirrors (fix 4: votes only while status is 'voting').
    await setDoc(doc(db, 'challenges', 'ch-voting', 'submissions', 'sub-v1'), sub('Priya Nair', 'approved', 10));
    await setDoc(doc(db, 'challenges', 'ch-voting', 'submissions', 'sub-v2'), sub('Kavya Singh', 'approved', 3));
    await setDoc(doc(db, 'challenges', 'ch-voting', 'submissions', 'sub-vpending'), sub('Rohan Mehta', 'pending', 0));
    await setDoc(doc(db, 'challenges', 'ch-voting', 'submissions', 'sub-vself'), {
      ...sub('Self Voter', 'approved', 2),
      uid: VOTER,
    });
    // Last round (item 4): one existing doc per admin module, so the
    // payload tests can run the exact update each admin page sends.
    await setDoc(doc(db, 'events', 'ev-1'), {
      title: 'Art Fest', description: 'Annual art festival.', venue: 'Main Hall',
      startDate: '2026-11-20', endDate: '2026-11-21', participationDetails: '',
      registrationLink: 'https://example.invalid/r', status: 'upcoming', published: true,
      highlights: '', posterUrl: 'https://example.invalid/p.jpg', posterPath: 'events/p.jpg',
      photoUrls: [], createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
    });
    await setDoc(doc(db, 'notices', 'n-1'), {
      title: 'Seed Notice', body: 'A seeded notice.', type: 'general',
      important: false, pinned: false, deadline: '', published: true,
      createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
    });
    await setDoc(doc(db, 'comments', 'c-1'), {
      artworkId: 'art-approved', uid: MEMBER, authorName: 'Member One',
      text: 'Nice work!', status: 'pending', createdAt: serverTimestamp(),
    });
    await setDoc(doc(db, 'constitution', 'const-1'), {
      version: '1.0', title: 'Constitution', notes: '', fileUrl: 'https://example.invalid/c.pdf',
      filePath: 'constitution/c.pdf', isLatest: true, uploadedBy: 'coordinator@example.invalid',
      createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
    });
    await setDoc(doc(db, 'legacyEntries', 'leg-1'), {
      year: '2024', title: 'First exhibition', description: 'The first exhibition.',
      kind: 'event', order: 1, createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
    });
    await setDoc(doc(db, 'recognitions', 'rec-1'), {
      type: 'artist_of_month', artistName: 'Asha Verma', period: '2026-11',
      citation: 'For outstanding work.', photoUrl: 'https://example.invalid/r.jpg',
      photoPath: 'rec/r.jpg', createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
    });
    await setDoc(doc(db, 'memberProfiles', 'mp-1'), {
      name: 'Asha Verma', photoUrl: 'https://example.invalid/m.jpg', published: true,
      team: 'art', designation: 'team_member', createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    await setDoc(doc(db, 'blogPosts', 'bp-1'), validBlog(COORD, { status: 'draft' }));
    await setDoc(doc(db, 'teamMembers', 'tm-1'), {
      name: 'Seed Member', designation: 'team_member', teamId: 'art', termId: 't1',
      bio: '', socialLink: '', order: 1, active: true, coCoordinatorOf: [],
      photoUrl: '', photoPath: '', archived: false,
      createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
    });
    await setDoc(doc(db, 'teams', 'team-1'), {
      name: 'Art', slug: 'art', responsibility: 'Making art.', order: 1,
    });
  });
}

/** Toggle siteSettings/main.applicationsOpen (setup helper, rules disabled). */
async function setApplicationsOpen(open) {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(
      doc(ctx.firestore(), 'siteSettings', 'main'),
      { applicationsOpen: open },
      { merge: true },
    );
  });
}

/** Toggle siteSettings/main.membershipOpen (setup helper, rules disabled). */
async function setMembershipOpen(open) {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(
      doc(ctx.firestore(), 'siteSettings', 'main'),
      { membershipOpen: open },
      { merge: true },
    );
  });
}

/** Seed that VOTER has already voted in ch-voting (for sub-v1). Setup only. */
async function seedVoterHasVoted() {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'challenges', 'ch-voting', 'submissions', 'sub-v1', 'votes', VOTER), {
      createdAt: serverTimestamp(),
    });
    await setDoc(doc(db, 'challenges', 'ch-voting', 'voters', VOTER), {
      submissionId: 'sub-v1',
      createdAt: serverTimestamp(),
    });
  });
}

/** Seed that MEMBER already liked art-approved. Setup only. */
async function seedMemberLiked() {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'artworks', 'art-approved', 'likes', MEMBER), {
      createdAt: serverTimestamp(),
    });
  });
}

const unauth = () => testEnv.unauthenticatedContext();
const as = (uid) => testEnv.authenticatedContext(uid);
// Hardening: contexts carrying token claims. asVerified passes a verified
// email (matching the uid by default); asUnverified passes email_verified
// false. Rules that check request.auth.token.email_verified / .email only
// pass under asVerified with the matching email.
const asVerified = (uid, email) =>
  testEnv.authenticatedContext(uid, { email: email || uid + '@example.invalid', email_verified: true });
const asUnverified = (uid) =>
  testEnv.authenticatedContext(uid, { email: uid + '@example.invalid', email_verified: false });

before(async () => {
  // Rules come from the emulator itself: it loads firestore.rules from
  // firebase.json at startup (see header comment for why the library's
  // rules-upload option is not used here).
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: { host: '127.0.0.1', port: 8080 },
  });
});

after(async () => {
  if (testEnv) await testEnv.cleanup();
});

beforeEach(async () => {
  await resetDb();
  await seedAll();
});

/**
 * Wipe every document the suite can create or seed, using the public SDK
 * with rules disabled. This replaces testEnv.clearFirestore(), whose
 * emulator admin endpoint returns 500 "http2 exception" on this emulator
 * version (same breakage as the rules-upload endpoint). Subcollections are
 * wiped before their parents.
 */
async function resetDb() {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    const wipe = async (colRef) => {
      const snap = await getDocs(colRef);
      for (const d of snap.docs) await deleteDoc(d.ref);
    };
    const artworks = await getDocs(collection(db, 'artworks'));
    for (const a of artworks.docs) {
      await wipe(collection(db, 'artworks', a.id, 'likes'));
    }
    const challenges = await getDocs(collection(db, 'challenges'));
    for (const c of challenges.docs) {
      const subs = await getDocs(collection(db, 'challenges', c.id, 'submissions'));
      for (const s of subs.docs) {
        await wipe(collection(db, 'challenges', c.id, 'submissions', s.id, 'votes'));
      }
      await wipe(collection(db, 'challenges', c.id, 'submissions'));
      await wipe(collection(db, 'challenges', c.id, 'voters'));
    }
    for (const name of [
      'admins',
      'siteSettings',
      'membershipSubmissions',
      'applications',
      'contactMessages',
      'auditLogs',
      'artworks',
      'challenges',
      'blogPosts',
      'comments',
      'events',
      'notices',
      'teams',
      'teamMembers',
      'termRecords',
      'constitution',
      'recognitions',
      'legacyEntries',
      'memberProfiles',
    ]) {
      await wipe(collection(db, name));
    }
  });
}

describe('firestore.rules', { concurrency: 1 }, () => {

  // -------------------------------------------------------------------------
  // (a) Public / unauthenticated user cannot read private collections
  // -------------------------------------------------------------------------
  describe('(a) unauthenticated reads are denied', () => {
    it('cannot read a membership submission', async () => {
      const db = unauth().firestore();
      await assertFails(getDoc(doc(db, 'membershipSubmissions', 'ms-1')));
    });
    it('cannot list membership submissions', async () => {
      const db = unauth().firestore();
      await assertFails(getDocs(query(collection(db, 'membershipSubmissions'))));
    });
    it('cannot read an application', async () => {
      const db = unauth().firestore();
      await assertFails(getDoc(doc(db, 'applications', 'app-1')));
    });
    it('cannot list applications', async () => {
      const db = unauth().firestore();
      await assertFails(getDocs(query(collection(db, 'applications'))));
    });
    it('cannot read a contact message', async () => {
      const db = unauth().firestore();
      await assertFails(getDoc(doc(db, 'contactMessages', 'cm-1')));
    });
    it('cannot read an admin doc', async () => {
      const db = unauth().firestore();
      await assertFails(getDoc(doc(db, 'admins', COORD)));
    });
    it('cannot read an audit log', async () => {
      const db = unauth().firestore();
      await assertFails(getDoc(doc(db, 'auditLogs', 'log-1')));
    });
    it('signed-in non-admin member cannot read them either', async () => {
      const db = as(MEMBER).firestore();
      await assertFails(getDoc(doc(db, 'membershipSubmissions', 'ms-1')));
      await assertFails(getDoc(doc(db, 'applications', 'app-1')));
      await assertFails(getDoc(doc(db, 'contactMessages', 'cm-1')));
      await assertFails(getDoc(doc(db, 'admins', COORD)));
      await assertFails(getDoc(doc(db, 'auditLogs', 'log-1')));
    });
  });

  // -------------------------------------------------------------------------
  // (b) Public creates: exact keys, valid lengths, correct initial status
  // -------------------------------------------------------------------------
  describe('(b) public creates are strictly validated', () => {
    describe('membershipSubmissions', () => {
      it('valid create succeeds', async () => {
        const db = unauth().firestore();
        await assertSucceeds(addDoc(collection(db, 'membershipSubmissions'), validMembership()));
      });
      it('fails with an extra key', async () => {
        const db = unauth().firestore();
        await assertFails(
          addDoc(collection(db, 'membershipSubmissions'), validMembership({ role: 'admin' })),
        );
      });
      it('fails with the wrong initial status', async () => {
        const db = unauth().firestore();
        await assertFails(
          addDoc(collection(db, 'membershipSubmissions'), validMembership({ status: 'reviewed' })),
        );
      });
      it('fails when fullName is too short', async () => {
        const db = unauth().firestore();
        await assertFails(
          addDoc(collection(db, 'membershipSubmissions'), validMembership({ fullName: 'A' })),
        );
      });
      it('fails when intro is too short', async () => {
        const db = unauth().firestore();
        await assertFails(
          addDoc(collection(db, 'membershipSubmissions'), validMembership({ intro: 'Hi' })),
        );
      });
      it('fails with a bad email', async () => {
        const db = unauth().firestore();
        await assertFails(
          addDoc(collection(db, 'membershipSubmissions'), validMembership({ email: 'not-an-email' })),
        );
      });
      it('fails when phone is too short', async () => {
        const db = unauth().firestore();
        await assertFails(
          addDoc(collection(db, 'membershipSubmissions'), validMembership({ phone: '123' })),
        );
      });
      it('fails when interests is empty', async () => {
        const db = unauth().firestore();
        await assertFails(
          addDoc(collection(db, 'membershipSubmissions'), validMembership({ interests: [] })),
        );
      });
      it('fails when a required field is missing', async () => {
        const db = unauth().firestore();
        const { intro, ...noIntro } = validMembership();
        await assertFails(addDoc(collection(db, 'membershipSubmissions'), noIntro));
      });
    });

    describe('applications', () => {
      it('valid create succeeds', async () => {
        const db = unauth().firestore();
        await assertSucceeds(addDoc(collection(db, 'applications'), validApplication()));
      });
      it('valid create with only the required fields succeeds', async () => {
        const db = unauth().firestore();
        const minimal = (({ fullName, branch, academicYear, email, phone, preferredRole, reason, skills, status }) => ({
          fullName, branch, academicYear, email, phone, preferredRole, reason, skills, status,
        }))(validApplication());
        await assertSucceeds(addDoc(collection(db, 'applications'), minimal));
      });
      it('fails with an extra key', async () => {
        const db = unauth().firestore();
        await assertFails(
          addDoc(collection(db, 'applications'), validApplication('team_member', { isAdmin: true })),
        );
      });
      it('fails with the wrong initial status', async () => {
        const db = unauth().firestore();
        await assertFails(
          addDoc(collection(db, 'applications'), validApplication('team_member', { status: 'under_review' })),
        );
      });
      it('fails when reason is too short', async () => {
        const db = unauth().firestore();
        await assertFails(
          addDoc(collection(db, 'applications'), validApplication('team_member', { reason: 'I want in' })),
        );
      });
      it('fails when skills is too short', async () => {
        const db = unauth().firestore();
        await assertFails(
          addDoc(collection(db, 'applications'), validApplication('team_member', { skills: 'Art' })),
        );
      });
      it('fails when phone is too short', async () => {
        const db = unauth().firestore();
        await assertFails(
          addDoc(collection(db, 'applications'), validApplication('team_member', { phone: '123' })),
        );
      });
      it('fails when academicYear is empty', async () => {
        const db = unauth().firestore();
        await assertFails(
          addDoc(collection(db, 'applications'), validApplication('team_member', { academicYear: '' })),
        );
      });
      it('fails with a bad email', async () => {
        const db = unauth().firestore();
        await assertFails(
          addDoc(collection(db, 'applications'), validApplication('team_member', { email: 'bad@' })),
        );
      });
      it('fails with a preferredRole outside the allowed list', async () => {
        const db = unauth().firestore();
        await assertFails(
          addDoc(collection(db, 'applications'), validApplication('coordinator')),
        );
      });
    });

    describe('contactMessages', () => {
      it('valid create succeeds', async () => {
        const db = unauth().firestore();
        await assertSucceeds(addDoc(collection(db, 'contactMessages'), validContact()));
      });
      it('fails with an extra key', async () => {
        const db = unauth().firestore();
        await assertFails(
          addDoc(collection(db, 'contactMessages'), validContact({ handledBy: 'someone' })),
        );
      });
      it('fails with the wrong initial status', async () => {
        const db = unauth().firestore();
        await assertFails(
          addDoc(collection(db, 'contactMessages'), validContact({ status: 'read' })),
        );
      });
      it('fails when message is too short', async () => {
        const db = unauth().firestore();
        await assertFails(
          addDoc(collection(db, 'contactMessages'), validContact({ message: 'Hello' })),
        );
      });
      it('fails when subject is too short', async () => {
        const db = unauth().firestore();
        await assertFails(
          addDoc(collection(db, 'contactMessages'), validContact({ subject: 'x' })),
        );
      });
      it('fails with a bad email', async () => {
        const db = unauth().firestore();
        await assertFails(
          addDoc(collection(db, 'contactMessages'), validContact({ email: 'nope' })),
        );
      });
    });
  });

  // -------------------------------------------------------------------------
  // (c) Application create follows siteSettings/main.applicationsOpen
  // -------------------------------------------------------------------------
  describe('(c) applicationsOpen gate', () => {
    it('co_coordinator create fails when coAdmin is closed, succeeds when open', async () => {
      await setApplicationsOpen({ coAdmin: false, teamHead: true, teamMember: true });
      const db = unauth().firestore();
      await assertFails(addDoc(collection(db, 'applications'), validApplication('co_coordinator')));
      await setApplicationsOpen({ ...OPEN_ALL });
      await assertSucceeds(addDoc(collection(db, 'applications'), validApplication('co_coordinator')));
    });
    it('team_head create fails when teamHead is closed, succeeds when open', async () => {
      await setApplicationsOpen({ coAdmin: true, teamHead: false, teamMember: true });
      const db = unauth().firestore();
      await assertFails(addDoc(collection(db, 'applications'), validApplication('team_head')));
      await setApplicationsOpen({ ...OPEN_ALL });
      await assertSucceeds(addDoc(collection(db, 'applications'), validApplication('team_head')));
    });
    it('team_member create fails when teamMember is closed, succeeds when open', async () => {
      await setApplicationsOpen({ coAdmin: true, teamHead: true, teamMember: false });
      const db = unauth().firestore();
      await assertFails(addDoc(collection(db, 'applications'), validApplication('team_member')));
      await setApplicationsOpen({ ...OPEN_ALL });
      await assertSucceeds(addDoc(collection(db, 'applications'), validApplication('team_member')));
    });
    it('closing one role does not close the others', async () => {
      await setApplicationsOpen({ coAdmin: false, teamHead: true, teamMember: true });
      const db = unauth().firestore();
      await assertSucceeds(addDoc(collection(db, 'applications'), validApplication('team_head')));
      await assertSucceeds(addDoc(collection(db, 'applications'), validApplication('team_member')));
    });
  });

  // -------------------------------------------------------------------------
  // (d) A member can never write status / featured / likeCount / role /
  //     permissions on their own creates or updates
  // -------------------------------------------------------------------------
  describe('(d) members cannot self-assign privileged fields', () => {
    it('artwork create with status approved fails', async () => {
      const db = as(MEMBER).firestore();
      await assertFails(addDoc(collection(db, 'artworks'), validArtworkCreate(MEMBER, { status: 'approved' })));
    });
    it('artwork create with featured true fails', async () => {
      const db = as(MEMBER).firestore();
      await assertFails(addDoc(collection(db, 'artworks'), validArtworkCreate(MEMBER, { featured: true })));
    });
    it('artwork create with likeCount != 0 fails', async () => {
      const db = as(MEMBER).firestore();
      await assertFails(addDoc(collection(db, 'artworks'), validArtworkCreate(MEMBER, { likeCount: 5 })));
    });
    it('artwork create with source admin fails', async () => {
      const db = as(MEMBER).firestore();
      await assertFails(addDoc(collection(db, 'artworks'), validArtworkCreate(MEMBER, { source: 'admin' })));
    });
    it('artwork create with another user as artistUid fails', async () => {
      const db = as(MEMBER).firestore();
      await assertFails(addDoc(collection(db, 'artworks'), validArtworkCreate(MEMBER2)));
    });
    it('valid member artwork create succeeds', async () => {
      const db = asVerified(MEMBER).firestore();
      await assertSucceeds(addDoc(collection(db, 'artworks'), validArtworkCreate(MEMBER)));
    });
    it('member cannot set featured on an artwork update', async () => {
      const db = as(MEMBER).firestore();
      await assertFails(updateDoc(doc(db, 'artworks', 'art-approved'), { featured: true }));
    });
    it('member cannot set status on an artwork update', async () => {
      const db = as(MEMBER).firestore();
      await assertFails(updateDoc(doc(db, 'artworks', 'art-approved'), { status: 'rejected' }));
    });
    it('member cannot set an arbitrary likeCount on an artwork update', async () => {
      const db = as(MEMBER).firestore();
      await assertFails(updateDoc(doc(db, 'artworks', 'art-approved'), { likeCount: 99 }));
    });
    it('member cannot change the title of an approved artwork', async () => {
      const db = as(MEMBER).firestore();
      await assertFails(updateDoc(doc(db, 'artworks', 'art-approved'), { title: 'Mine now' }));
    });
    it('member cannot create an admin doc with a role and permissions', async () => {
      const db = as(MEMBER).firestore();
      await assertFails(
        setDoc(doc(db, 'admins', MEMBER), adminDoc('coordinator', ALL_TRUE)),
      );
    });
    it('member cannot update an admin doc', async () => {
      const db = as(MEMBER).firestore();
      await assertFails(updateDoc(doc(db, 'admins', COCO_NOAPPS), { active: false }));
    });
    it('member blog create with status published fails, draft succeeds', async () => {
      const db = as(MEMBER).firestore();
      await assertFails(addDoc(collection(db, 'blogPosts'), validBlog(MEMBER, { status: 'published' })));
      await assertSucceeds(addDoc(collection(asVerified(MEMBER).firestore(), 'blogPosts'), validBlog(MEMBER)));
    });
    it('comment create with status approved fails (must be pending)', async () => {
      const db = as(MEMBER).firestore();
      await assertFails(
        addDoc(collection(db, 'comments'), {
          artworkId: 'art-approved', uid: MEMBER, authorName: 'Member One',
          text: 'Nice work!', status: 'approved', createdAt: serverTimestamp(),
        }),
      );
    });
    it('W2B submission create with status approved or voteCount != 0 fails', async () => {
      const db = as(MEMBER).firestore();
      await assertFails(
        addDoc(collection(db, 'challenges', 'ch-open', 'submissions'), validW2B(MEMBER, { status: 'approved' })),
      );
      await assertFails(
        addDoc(collection(db, 'challenges', 'ch-open', 'submissions'), validW2B(MEMBER, { voteCount: 7 })),
      );
    });
  });

  // -------------------------------------------------------------------------
  // (e) Likes: +1 only with a new likes/{uid} doc in the same batch
  // -------------------------------------------------------------------------
  describe('(e) artwork likes', () => {
    it('+1 with a new likes/{uid} doc in the same batch succeeds', async () => {
      const db = as(MEMBER).firestore();
      const batch = writeBatch(db);
      batch.update(doc(db, 'artworks', 'art-approved'), { likeCount: increment(1) });
      batch.set(doc(db, 'artworks', 'art-approved', 'likes', MEMBER), { createdAt: serverTimestamp() });
      await assertSucceeds(batch.commit());
      const snap = await getDoc(doc(db, 'artworks', 'art-approved'));
      assert.equal(snap.data().likeCount, 6);
    });
    it('fails when repeated (like doc already exists)', async () => {
      await seedMemberLiked();
      const db = as(MEMBER).firestore();
      const batch = writeBatch(db);
      batch.update(doc(db, 'artworks', 'art-approved'), { likeCount: increment(1) });
      batch.set(doc(db, 'artworks', 'art-approved', 'likes', MEMBER), { createdAt: serverTimestamp() });
      await assertFails(batch.commit());
    });
    it('fails when the likes doc id is not the voter uid', async () => {
      const db = as(MEMBER).firestore();
      const batch = writeBatch(db);
      batch.update(doc(db, 'artworks', 'art-approved'), { likeCount: increment(1) });
      batch.set(doc(db, 'artworks', 'art-approved', 'likes', MEMBER2), { createdAt: serverTimestamp() });
      await assertFails(batch.commit());
    });
    it('fails when the change is +2', async () => {
      const db = as(MEMBER).firestore();
      const batch = writeBatch(db);
      batch.update(doc(db, 'artworks', 'art-approved'), { likeCount: increment(2) });
      batch.set(doc(db, 'artworks', 'art-approved', 'likes', MEMBER), { createdAt: serverTimestamp() });
      await assertFails(batch.commit());
    });
    it('fails when likeCount is bumped without creating the like doc', async () => {
      const db = as(MEMBER).firestore();
      await assertFails(updateDoc(doc(db, 'artworks', 'art-approved'), { likeCount: increment(1) }));
    });
    it('fails on a pending artwork', async () => {
      const db = as(MEMBER).firestore();
      const batch = writeBatch(db);
      batch.update(doc(db, 'artworks', 'art-pending'), { likeCount: increment(1) });
      batch.set(doc(db, 'artworks', 'art-pending', 'likes', MEMBER), { createdAt: serverTimestamp() });
      await assertFails(batch.commit());
    });
    it('artworkService.like transaction flow succeeds, then rejects as already-liked', async () => {
      const db = as(MEMBER).firestore();
      const likeOnce = () =>
        runTransaction(db, async (tx) => {
          const likeRef = doc(db, 'artworks', 'art-approved', 'likes', MEMBER);
          const likeSnap = await tx.get(likeRef);
          if (likeSnap.exists()) throw new Error('You already liked this artwork.');
          tx.set(likeRef, { createdAt: serverTimestamp() });
          tx.update(doc(db, 'artworks', 'art-approved'), { likeCount: increment(1) });
          return { ok: true, liked: true };
        });
      // The second call is rejected by the service's own guard (a plain
      // Error thrown inside the transaction before any write), not by the
      // rules — so assertFails (permission-denied only) is the wrong
      // assertion here; assert.rejects checks the guard's message.
      await assertSucceeds(likeOnce());
      await assert.rejects(likeOnce(), /You already liked this artwork\./);
    });
  });

  // -------------------------------------------------------------------------
  // (f) Unlike: -1 only when the like exists
  // -------------------------------------------------------------------------
  describe('(f) artwork unlikes', () => {
    it('-1 with the like doc deleted in the same batch succeeds', async () => {
      const db = as(MEMBER).firestore();
      const batch = writeBatch(db);
      batch.delete(doc(db, 'artworks', 'art-liked', 'likes', MEMBER));
      batch.update(doc(db, 'artworks', 'art-liked'), { likeCount: increment(-1) });
      await assertSucceeds(batch.commit());
      const snap = await getDoc(doc(db, 'artworks', 'art-liked'));
      assert.equal(snap.data().likeCount, 4);
    });
    it('fails when the user has not liked the artwork', async () => {
      const db = as(MEMBER).firestore();
      const batch = writeBatch(db);
      batch.delete(doc(db, 'artworks', 'art-approved', 'likes', MEMBER));
      batch.update(doc(db, 'artworks', 'art-approved'), { likeCount: increment(-1) });
      await assertFails(batch.commit());
    });
    it('fails when the change is -2', async () => {
      const db = as(MEMBER).firestore();
      const batch = writeBatch(db);
      batch.delete(doc(db, 'artworks', 'art-liked', 'likes', MEMBER));
      batch.update(doc(db, 'artworks', 'art-liked'), { likeCount: increment(-2) });
      await assertFails(batch.commit());
    });
    it('artworkService.unlike transaction flow succeeds, then rejects as not-liked', async () => {
      const db = as(MEMBER).firestore();
      const unlikeOnce = () =>
        runTransaction(db, async (tx) => {
          const likeRef = doc(db, 'artworks', 'art-liked', 'likes', MEMBER);
          const likeSnap = await tx.get(likeRef);
          if (!likeSnap.exists()) throw new Error('You have not liked this artwork yet.');
          tx.delete(likeRef);
          tx.update(doc(db, 'artworks', 'art-liked'), { likeCount: increment(-1) });
          return { ok: true, liked: false };
        });
      // Same as the like test above: the second call throws the service
      // guard's plain Error, not a permission-denied from the rules.
      await assertSucceeds(unlikeOnce());
      await assert.rejects(unlikeOnce(), /You have not liked this artwork yet\./);
    });
  });

  // -------------------------------------------------------------------------
  // (g) Votes: voteCount +1 only with both votes/{uid} and voters/{uid}
  // -------------------------------------------------------------------------
  describe('(g) W2B votes', () => {
    const voteBatch = (db, challengeId, subId, count) => {
      const batch = writeBatch(db);
      batch.update(doc(db, 'challenges', challengeId, 'submissions', subId), { voteCount: increment(count) });
      batch.set(doc(db, 'challenges', challengeId, 'submissions', subId, 'votes', VOTER), {
        createdAt: serverTimestamp(),
      });
      batch.set(doc(db, 'challenges', challengeId, 'voters', VOTER), {
        submissionId: subId,
        createdAt: serverTimestamp(),
      });
      return batch;
    };
    it('+1 with both votes/{uid} and voters/{uid} created succeeds', async () => {
      const db = as(VOTER).firestore();
      await assertSucceeds(voteBatch(db, 'ch-voting', 'sub-v1', 1).commit());
      const snap = await getDoc(doc(as(COORD).firestore(), 'challenges', 'ch-voting', 'submissions', 'sub-v1'));
      assert.equal(snap.data().voteCount, 11);
    });
    it('fails without the votes/{uid} doc', async () => {
      const db = as(VOTER).firestore();
      const batch = writeBatch(db);
      batch.update(doc(db, 'challenges', 'ch-voting', 'submissions', 'sub-v1'), { voteCount: increment(1) });
      batch.set(doc(db, 'challenges', 'ch-voting', 'voters', VOTER), {
        submissionId: 'sub-v1',
        createdAt: serverTimestamp(),
      });
      await assertFails(batch.commit());
    });
    it('fails without the voters/{uid} doc', async () => {
      const db = as(VOTER).firestore();
      const batch = writeBatch(db);
      batch.update(doc(db, 'challenges', 'ch-voting', 'submissions', 'sub-v1'), { voteCount: increment(1) });
      batch.set(doc(db, 'challenges', 'ch-voting', 'submissions', 'sub-v1', 'votes', VOTER), {
        createdAt: serverTimestamp(),
      });
      await assertFails(batch.commit());
    });
    it('fails when the change is +2', async () => {
      const db = as(VOTER).firestore();
      await assertFails(voteBatch(db, 'ch-voting', 'sub-v1', 2).commit());
    });
    it('fails on a pending submission', async () => {
      const db = as(VOTER).firestore();
      await assertFails(voteBatch(db, 'ch-voting', 'sub-vpending', 1).commit());
    });
    it('second vote on the same submission fails', async () => {
      await seedVoterHasVoted();
      const db = as(VOTER).firestore();
      await assertFails(voteBatch(db, 'ch-voting', 'sub-v1', 1).commit());
    });
    it('second vote on a different submission in the same challenge fails', async () => {
      await seedVoterHasVoted();
      const db = as(VOTER).firestore();
      await assertFails(voteBatch(db, 'ch-voting', 'sub-v2', 1).commit());
    });
    it('challengeService.castVote transaction flow succeeds, then rejects as already-voted', async () => {
      const db = as(VOTER).firestore();
      const castVote = (subId) =>
        runTransaction(db, async (tx) => {
          const voterRef = doc(db, 'challenges', 'ch-voting', 'voters', VOTER);
          const voter = await tx.get(voterRef);
          if (voter.exists()) throw new Error('You have already voted in this challenge.');
          tx.set(doc(db, 'challenges', 'ch-voting', 'submissions', subId, 'votes', VOTER), {
            createdAt: serverTimestamp(),
          });
          tx.set(voterRef, { submissionId: subId, createdAt: serverTimestamp() });
          tx.update(doc(db, 'challenges', 'ch-voting', 'submissions', subId), { voteCount: increment(1) });
          return { ok: true };
        });
      // Same as the like test above: the second call throws the service
      // guard's plain Error, not a permission-denied from the rules.
      await assertSucceeds(castVote('sub-v1'));
      await assert.rejects(castVote('sub-v2'), /You have already voted in this challenge\./);
    });
  });

  // -------------------------------------------------------------------------
  // (h) W2B submission create requires the parent challenge to be open
  // -------------------------------------------------------------------------
  describe('(h) W2B submissions need an open challenge', () => {
    it('succeeds when the challenge is open', async () => {
      const db = asVerified(MEMBER).firestore();
      await assertSucceeds(
        setDoc(doc(db, 'challenges', 'ch-open', 'submissions', MEMBER), validW2B(MEMBER)),
      );
    });
    it('fails when the challenge is closed', async () => {
      const db = as(MEMBER).firestore();
      await assertFails(
        addDoc(collection(db, 'challenges', 'ch-closed', 'submissions'), validW2B(MEMBER)),
      );
    });
    it('fails when the challenge is a draft', async () => {
      const db = as(MEMBER).firestore();
      await assertFails(
        addDoc(collection(db, 'challenges', 'ch-draft', 'submissions'), validW2B(MEMBER)),
      );
    });
    it('fails when the challenge is in voting', async () => {
      const db = as(MEMBER).firestore();
      await assertFails(
        addDoc(collection(db, 'challenges', 'ch-voting', 'submissions'), validW2B(MEMBER)),
      );
    });
    it('fails when the submission uid is not the caller', async () => {
      const db = as(MEMBER).firestore();
      await assertFails(
        addDoc(collection(db, 'challenges', 'ch-open', 'submissions'), validW2B(MEMBER2)),
      );
    });
  });

  // -------------------------------------------------------------------------
  // (i) Applications visibility follows permissions.applications
  // -------------------------------------------------------------------------
  describe('(i) applications permission gate', () => {
    it('co_coordinator without permissions.applications cannot read applications', async () => {
      const db = as(COCO_NOAPPS).firestore();
      await assertFails(getDoc(doc(db, 'applications', 'app-1')));
    });
    it('mentor without permissions.applications cannot read applications', async () => {
      const db = as(MENTOR).firestore();
      await assertFails(getDoc(doc(db, 'applications', 'app-1')));
    });
    it('co_coordinator with permissions.applications can read applications', async () => {
      const db = as(COCO_APPS).firestore();
      await assertSucceeds(getDoc(doc(db, 'applications', 'app-1')));
    });
    it('mentor with permissions.applications can read applications', async () => {
      const db = as(MENTOR_APPS).firestore();
      await assertSucceeds(getDoc(doc(db, 'applications', 'app-1')));
    });
    it('co_coordinator with the permission can change only allowed fields', async () => {
      const db = as(COCO_APPS).firestore();
      await assertSucceeds(
        updateDoc(doc(db, 'applications', 'app-1'), {
          status: 'under_review',
          reviewNotes: [{ byUid: COCO_APPS, byName: 'coco', text: 'Looks good', at: 'now' }],
          updatedAt: serverTimestamp(),
        }),
      );
    });
    it('mentor with the permission can change status and interview date', async () => {
      const db = as(MENTOR_APPS).firestore();
      await assertSucceeds(
        updateDoc(doc(db, 'applications', 'app-1'), {
          status: 'interview_scheduled',
          interviewDate: '2026-11-20',
          updatedAt: serverTimestamp(),
        }),
      );
    });
    it('with the permission, changing a disallowed field fails', async () => {
      const db = as(COCO_APPS).firestore();
      await assertFails(
        updateDoc(doc(db, 'applications', 'app-1'), {
          status: 'under_review',
          preferredRole: 'team_head',
        }),
      );
    });
    it('with the permission, an invalid status value fails', async () => {
      const db = as(COCO_APPS).firestore();
      await assertFails(updateDoc(doc(db, 'applications', 'app-1'), { status: 'hired' }));
    });
    it('without the permission, even an allowed-fields update fails', async () => {
      const db = as(COCO_NOAPPS).firestore();
      await assertFails(
        updateDoc(doc(db, 'applications', 'app-1'), { status: 'under_review' }),
      );
    });
  });

  // -------------------------------------------------------------------------
  // (j) Only the coordinator manages admins, deletes applications,
  //     changes applicationsOpen, and reads auditLogs
  // -------------------------------------------------------------------------
  describe('(j) coordinator-only powers', () => {
    it('co_coordinator cannot create an admin, coordinator can', async () => {
      const db = as(COCO_APPS).firestore();
      await assertFails(setDoc(doc(db, 'admins', 'admin-new'), adminDoc('mentor')));
      const coordDb = as(COORD).firestore();
      await assertSucceeds(setDoc(doc(coordDb, 'admins', 'admin-new'), adminDoc('mentor')));
    });
    it('co_coordinator cannot update or delete an admin, coordinator can', async () => {
      const db = as(COCO_APPS).firestore();
      await assertFails(updateDoc(doc(db, 'admins', COCO_NOAPPS), { active: false }));
      await assertFails(deleteDoc(doc(db, 'admins', COCO_NOAPPS)));
      const coordDb = as(COORD).firestore();
      await assertSucceeds(updateDoc(doc(coordDb, 'admins', COCO_NOAPPS), { active: false }));
      await assertSucceeds(deleteDoc(doc(coordDb, 'admins', MENTOR)));
    });
    it('admin can read their own admin doc, but not another admin doc', async () => {
      const db = as(COCO_APPS).firestore();
      await assertSucceeds(getDoc(doc(db, 'admins', COCO_APPS)));
      await assertFails(getDoc(doc(db, 'admins', COORD)));
    });
    it('co_coordinator cannot delete an application, coordinator can', async () => {
      const db = as(COCO_APPS).firestore();
      await assertFails(deleteDoc(doc(db, 'applications', 'app-1')));
      const coordDb = as(COORD).firestore();
      await assertSucceeds(deleteDoc(doc(coordDb, 'applications', 'app-1')));
    });
    it('co_coordinator cannot change applicationsOpen, coordinator can', async () => {
      const db = as(COCO_APPS).firestore();
      await assertFails(
        updateDoc(doc(db, 'siteSettings', 'main'), {
          applicationsOpen: { coAdmin: false, teamHead: true, teamMember: true },
        }),
      );
      const coordDb = as(COORD).firestore();
      await assertSucceeds(
        updateDoc(doc(coordDb, 'siteSettings', 'main'), {
          applicationsOpen: { coAdmin: false, teamHead: true, teamMember: true },
        }),
      );
    });
    it('only the coordinator can read auditLogs', async () => {
      const coordDb = as(COORD).firestore();
      await assertSucceeds(getDoc(doc(coordDb, 'auditLogs', 'log-1')));
      await assertFails(getDoc(doc(as(COCO_APPS).firestore(), 'auditLogs', 'log-1')));
      await assertFails(getDoc(doc(as(ADMIN_MEM).firestore(), 'auditLogs', 'log-1')));
    });
    it('an admin with membership permission can read membership, but not contact or auditLogs', async () => {
      const db = as(ADMIN_MEM).firestore();
      await assertSucceeds(getDoc(doc(db, 'membershipSubmissions', 'ms-1')));
      await assertFails(getDoc(doc(db, 'contactMessages', 'cm-1')));
      await assertFails(getDoc(doc(db, 'auditLogs', 'log-1')));
    });
  });

  // -------------------------------------------------------------------------
  // (k) auditLogs are append-only: no update or delete by anyone
  // -------------------------------------------------------------------------
  describe('(k) auditLogs cannot be updated or deleted', () => {
    it('coordinator cannot update or delete an audit log', async () => {
      const db = as(COORD).firestore();
      await assertFails(updateDoc(doc(db, 'auditLogs', 'log-1'), { summary: 'edited' }));
      await assertFails(deleteDoc(doc(db, 'auditLogs', 'log-1')));
    });
    it('another admin cannot update or delete an audit log', async () => {
      const db = as(COCO_APPS).firestore();
      await assertFails(updateDoc(doc(db, 'auditLogs', 'log-1'), { summary: 'edited' }));
      await assertFails(deleteDoc(doc(db, 'auditLogs', 'log-1')));
    });
    it('a member cannot update or delete an audit log', async () => {
      const db = as(MEMBER).firestore();
      await assertFails(updateDoc(doc(db, 'auditLogs', 'log-1'), { summary: 'edited' }));
      await assertFails(deleteDoc(doc(db, 'auditLogs', 'log-1')));
    });
    it('an admin can still create an audit log (append-only, not write-never)', async () => {
      // asVerified, not plain as(): the audit rule compares actorEmail to
      // request.auth.token.email, and a plain authenticatedContext carries
      // no email claim, so the rule errors on an undefined token email.
      // Real admins always have an email in their token (email/password
      // sign-in), so the verified context is the faithful one here.
      const db = asVerified(COCO_APPS, 'co_coordinator@example.invalid').firestore();
      await assertSucceeds(
        addDoc(collection(db, 'auditLogs'), {
          actorUid: COCO_APPS,
          actorEmail: 'co_coordinator@example.invalid',
          action: 'update',
          collection: 'applications',
          docId: 'app-1',
          summary: 'status changed',
          createdAt: serverTimestamp(),
        }),
      );
    });
    it('an unauthenticated user cannot create an audit log', async () => {
      const db = unauth().firestore();
      await assertFails(
        addDoc(collection(db, 'auditLogs'), {
          actorUid: 'nobody',
          actorEmail: 'nobody@example.invalid',
          action: 'update',
          collection: 'applications',
          docId: 'app-1',
          summary: 'forged',
          createdAt: serverTimestamp(),
        }),
      );
    });
  });

  // -------------------------------------------------------------------------
  // (l) Part B fixes. Every test here must FAIL against the pre-fix rules:
  // the payload is valid except for the one thing the fix blocks.
  // -------------------------------------------------------------------------
  describe('(l) Part B fixes', () => {
    const voteBatch = (db, challengeId, subId, count) => {
      const batch = writeBatch(db);
      batch.update(doc(db, 'challenges', challengeId, 'submissions', subId), { voteCount: increment(count) });
      batch.set(doc(db, 'challenges', challengeId, 'submissions', subId, 'votes', VOTER), {
        createdAt: serverTimestamp(),
      });
      batch.set(doc(db, 'challenges', challengeId, 'voters', VOTER), {
        submissionId: subId,
        createdAt: serverTimestamp(),
      });
      return batch;
    };
    const validAudit = (overrides = {}) => ({
      actorUid: COCO_APPS,
      actorEmail: 'co_coordinator@example.invalid',
      action: 'update',
      collection: 'applications',
      docId: 'app-1',
      summary: 'status changed',
      createdAt: serverTimestamp(),
      ...overrides,
    });

    describe('fix 1: admin-only fields empty on create, max lengths, interests cap', () => {
      it('fails without fix: membership create with admin notes fails', async () => {
        const db = unauth().firestore();
        await assertFails(
          addDoc(collection(db, 'membershipSubmissions'), validMembership({ notes: 'admin note' })),
        );
      });
      it('fails without fix: application create with reviewNotes fails', async () => {
        const db = unauth().firestore();
        await assertFails(
          addDoc(collection(db, 'applications'), validApplication('team_member', {
            reviewNotes: [{ byUid: 'x', text: 'hi' }],
          })),
        );
      });
      it('fails without fix: application create with a non-empty statusHistory fails', async () => {
        const db = unauth().firestore();
        await assertFails(
          addDoc(collection(db, 'applications'), validApplication('team_member', {
            statusHistory: [{ status: 'received', at: 'now' }],
          })),
        );
      });
      it('fails without fix: application create with interviewDate fails', async () => {
        const db = unauth().firestore();
        await assertFails(
          addDoc(collection(db, 'applications'), validApplication('team_member', { interviewDate: '2026-11-20' })),
        );
      });
      it('application create with empty reviewNotes and statusHistory succeeds', async () => {
        const db = unauth().firestore();
        await assertSucceeds(
          addDoc(collection(db, 'applications'), validApplication('team_member', { reviewNotes: [], statusHistory: [] })),
        );
      });
      it('fails without fix: membership create with 11 interests fails', async () => {
        const db = unauth().firestore();
        await assertFails(
          addDoc(collection(db, 'membershipSubmissions'), validMembership({
            interests: Array.from({ length: 11 }, (_, i) => 'interest-' + i),
          })),
        );
      });
      it('fails without fix: membership create with a 41-char interest fails', async () => {
        const db = unauth().firestore();
        await assertFails(
          addDoc(collection(db, 'membershipSubmissions'), validMembership({ interests: ['a'.repeat(41)] })),
        );
      });
      it('fails without fix: membership create with skills over 500 chars fails', async () => {
        const db = unauth().firestore();
        await assertFails(
          addDoc(collection(db, 'membershipSubmissions'), validMembership({ skills: 'x'.repeat(501) })),
        );
      });
      it('fails without fix: application create with a bad portfolioLink fails', async () => {
        const db = unauth().firestore();
        await assertFails(
          addDoc(collection(db, 'applications'), validApplication('team_member', { portfolioLink: 'not-a-url' })),
        );
      });
      it('fails without fix: membership create with a bad portfolioLink fails', async () => {
        const db = unauth().firestore();
        await assertFails(
          addDoc(collection(db, 'membershipSubmissions'), validMembership({ portfolioLink: 'ftp://example.invalid/x' })),
        );
      });
      it('fails without fix: application create with additionalInfo over 1000 chars fails', async () => {
        const db = unauth().firestore();
        await assertFails(
          addDoc(collection(db, 'applications'), validApplication('team_member', { additionalInfo: 'x'.repeat(1001) })),
        );
      });
      it('fails without fix: application create with preferredTeam over 50 chars fails', async () => {
        const db = unauth().firestore();
        await assertFails(
          addDoc(collection(db, 'applications'), validApplication('team_member', { preferredTeam: 'x'.repeat(51) })),
        );
      });
    });

    describe('fix 2: application history is append-only and by the caller', () => {
      const firstNote = { byUid: COCO_APPS, byName: 'coco', text: 'First note', at: '2026-11-01T00:00:00Z' };
      const firstHistory = { status: 'received', at: '2026-11-01T00:00:00Z', byUid: COCO_APPS, byName: 'coco' };
      it('fails without fix: shrinking reviewNotes fails', async () => {
        const db = as(COCO_APPS).firestore();
        await assertFails(updateDoc(doc(db, 'applications', 'app-2'), { reviewNotes: [] }));
      });
      it('fails without fix: shrinking statusHistory fails', async () => {
        const db = as(COCO_APPS).firestore();
        await assertFails(updateDoc(doc(db, 'applications', 'app-2'), { statusHistory: [] }));
      });
      it('fails without fix: appending a review note with a forged byUid fails', async () => {
        const db = as(COCO_APPS).firestore();
        await assertFails(updateDoc(doc(db, 'applications', 'app-2'), {
          reviewNotes: [firstNote, { byUid: MEMBER, byName: 'mallory', text: 'Forged note', at: 'now' }],
        }));
      });
      it('appending a review note with the caller as byUid succeeds', async () => {
        const db = as(COCO_APPS).firestore();
        await assertSucceeds(updateDoc(doc(db, 'applications', 'app-2'), {
          reviewNotes: [firstNote, { byUid: COCO_APPS, byName: 'coco', text: 'Second note', at: 'now' }],
          updatedAt: serverTimestamp(),
        }));
      });
      it('appending a statusHistory entry with the caller as byUid succeeds', async () => {
        const db = as(COCO_APPS).firestore();
        await assertSucceeds(updateDoc(doc(db, 'applications', 'app-2'), {
          status: 'under_review',
          statusHistory: [firstHistory, { status: 'under_review', at: 'now', byUid: COCO_APPS, byName: 'coco' }],
          updatedAt: serverTimestamp(),
        }));
      });
    });

    describe('fix 3: likes need the matching likeCount step, reads are owner/admin only', () => {
      it('fails without fix: like doc created without the +1 likeCount bump fails', async () => {
        const db = as(MEMBER).firestore();
        await assertFails(setDoc(doc(db, 'artworks', 'art-approved', 'likes', MEMBER), { createdAt: serverTimestamp() }));
      });
      it('fails without fix: like doc deleted without the -1 likeCount bump fails', async () => {
        await seedMemberLiked();
        const db = as(MEMBER).firestore();
        await assertFails(deleteDoc(doc(db, 'artworks', 'art-approved', 'likes', MEMBER)));
      });
      it('fails without fix: a stranger cannot read a like doc, owner and gallery admin can', async () => {
        const db = as(MEMBER2).firestore();
        await assertFails(getDoc(doc(db, 'artworks', 'art-liked', 'likes', MEMBER)));
        await assertSucceeds(getDoc(doc(as(MEMBER).firestore(), 'artworks', 'art-liked', 'likes', MEMBER)));
        await assertSucceeds(getDoc(doc(as(COORD).firestore(), 'artworks', 'art-liked', 'likes', MEMBER)));
      });
    });

    describe('fix 4: votes only while voting, never self-votes, reads are owner/admin only', () => {
      it('fails without fix: voting on an open (not voting) challenge fails', async () => {
        const db = as(VOTER).firestore();
        await assertFails(voteBatch(db, 'ch-open', 'sub-1', 1).commit());
      });
      it('fails without fix: self-vote fails', async () => {
        const db = as(VOTER).firestore();
        await assertFails(voteBatch(db, 'ch-voting', 'sub-vself', 1).commit());
      });
      it('fails without fix: vote doc created without the voteCount +1 fails', async () => {
        const db = as(VOTER).firestore();
        await assertFails(setDoc(doc(db, 'challenges', 'ch-voting', 'submissions', 'sub-v1', 'votes', VOTER), { createdAt: serverTimestamp() }));
      });
      it('fails without fix: voters doc created without the voteCount +1 fails', async () => {
        const db = as(VOTER).firestore();
        await assertFails(setDoc(doc(db, 'challenges', 'ch-voting', 'voters', VOTER), { submissionId: 'sub-v1', createdAt: serverTimestamp() }));
      });
      it('fails without fix: a stranger cannot read a vote or voters doc, owner and waste2best admin can', async () => {
        const db = as(VOTER).firestore();
        await assertSucceeds(voteBatch(db, 'ch-voting', 'sub-v1', 1).commit());
        await assertFails(getDoc(doc(as(MEMBER).firestore(), 'challenges', 'ch-voting', 'submissions', 'sub-v1', 'votes', VOTER)));
        await assertFails(getDoc(doc(as(MEMBER).firestore(), 'challenges', 'ch-voting', 'voters', VOTER)));
        await assertSucceeds(getDoc(doc(db, 'challenges', 'ch-voting', 'submissions', 'sub-v1', 'votes', VOTER)));
        await assertSucceeds(getDoc(doc(db, 'challenges', 'ch-voting', 'voters', VOTER)));
        await assertSucceeds(getDoc(doc(as(COORD).firestore(), 'challenges', 'ch-voting', 'submissions', 'sub-v1', 'votes', VOTER)));
      });
    });

    describe('fix 5: W2B submission create validation', () => {
      it('fails without fix: W2B create with judgeScore set fails', async () => {
        const db = as(MEMBER).firestore();
        await assertFails(
          addDoc(collection(db, 'challenges', 'ch-open', 'submissions'), validW2B(MEMBER, { judgeScore: 9 })),
        );
      });
      it('fails without fix: W2B create with a 1-char branch fails', async () => {
        const db = as(MEMBER).firestore();
        await assertFails(
          addDoc(collection(db, 'challenges', 'ch-open', 'submissions'), validW2B(MEMBER, { branch: 'X' })),
        );
      });
      it('fails without fix: W2B create with a 21-char academicYear fails', async () => {
        const db = as(MEMBER).firestore();
        await assertFails(
          addDoc(collection(db, 'challenges', 'ch-open', 'submissions'), validW2B(MEMBER, { academicYear: 'x'.repeat(21) })),
        );
      });
      it('fails without fix: W2B create with an imageUrl over 500 chars fails', async () => {
        const db = as(MEMBER).firestore();
        await assertFails(
          addDoc(collection(db, 'challenges', 'ch-open', 'submissions'), validW2B(MEMBER, {
            imageUrls: ['https://example.invalid/' + 'x'.repeat(500)],
          })),
        );
      });
      it('fails without fix: W2B create with a non-URL imageUrl fails', async () => {
        const db = as(MEMBER).firestore();
        await assertFails(
          addDoc(collection(db, 'challenges', 'ch-open', 'submissions'), validW2B(MEMBER, { imageUrls: ['not-a-url'] })),
        );
      });
    });

    describe('fix 6: blog post create validation', () => {
      it('fails without fix: blog create with a bad slug fails', async () => {
        const db = as(MEMBER).firestore();
        await assertFails(addDoc(collection(db, 'blogPosts'), validBlog(MEMBER, { slug: 'Bad Slug!' })));
      });
      it('fails without fix: blog create with content over 20000 chars fails', async () => {
        const db = as(MEMBER).firestore();
        await assertFails(addDoc(collection(db, 'blogPosts'), validBlog(MEMBER, { content: 'x'.repeat(20001) })));
      });
      it('fails without fix: blog create with another user as authorUid fails', async () => {
        const db = as(MEMBER).firestore();
        await assertFails(addDoc(collection(db, 'blogPosts'), validBlog(MEMBER2)));
      });
      it('fails without fix: blog create with an http (not https) coverUrl fails', async () => {
        const db = as(MEMBER).firestore();
        await assertFails(addDoc(collection(db, 'blogPosts'), validBlog(MEMBER, { coverUrl: 'http://example.invalid/c.jpg' })));
      });
      it('fails without fix: blog create with a 2-char title fails', async () => {
        const db = as(MEMBER).firestore();
        await assertFails(addDoc(collection(db, 'blogPosts'), validBlog(MEMBER, { title: 'Hi' })));
      });
      it('valid blog draft create succeeds', async () => {
        const db = asVerified(MEMBER).firestore();
        await assertSucceeds(addDoc(collection(db, 'blogPosts'), validBlog(MEMBER)));
      });
    });

    describe('fix 7: artwork/comment create timestamps and admin-only fields', () => {
      it('fails without fix: artwork create with a forged uploadedAt fails', async () => {
        const db = as(MEMBER).firestore();
        await assertFails(addDoc(collection(db, 'artworks'), validArtworkCreate(MEMBER, { uploadedAt: '2026-01-01' })));
      });
      it('fails without fix: artwork create with reviewedBy set fails', async () => {
        const db = as(MEMBER).firestore();
        await assertFails(addDoc(collection(db, 'artworks'), validArtworkCreate(MEMBER, { reviewedBy: 'someone' })));
      });
      it('fails without fix: artwork create with a description over 1000 chars fails', async () => {
        const db = as(MEMBER).firestore();
        await assertFails(addDoc(collection(db, 'artworks'), validArtworkCreate(MEMBER, { description: 'x'.repeat(1001) })));
      });
      it('fails without fix: artwork create with an http imageUrl fails, https succeeds', async () => {
        const db = as(MEMBER).firestore();
        await assertFails(addDoc(collection(db, 'artworks'), validArtworkCreate(MEMBER, { imageUrl: 'http://example.invalid/a.jpg' })));
        await assertSucceeds(addDoc(collection(asVerified(MEMBER).firestore(), 'artworks'), validArtworkCreate(MEMBER, { imageUrl: 'https://example.invalid/a.jpg', thumbUrl: 'https://example.invalid/t.jpg' })));
      });
      it('fails without fix: comment create with a forged createdAt fails', async () => {
        const db = as(MEMBER).firestore();
        await assertFails(addDoc(collection(db, 'comments'), {
          artworkId: 'art-approved', uid: MEMBER, authorName: 'Member One',
          text: 'Nice work!', status: 'pending', createdAt: '2020-01-01',
        }));
      });
      it('valid comment create succeeds', async () => {
        const db = asVerified(MEMBER).firestore();
        await assertSucceeds(addDoc(collection(db, 'comments'), {
          artworkId: 'art-approved', uid: MEMBER, authorName: 'Member One',
          text: 'Nice work!', status: 'pending', createdAt: serverTimestamp(),
        }));
      });
    });

    describe('fix 8: audit log create validation', () => {
      it('fails without fix: audit log with another admin as actorUid fails', async () => {
        const db = asVerified(COCO_APPS, 'co_coordinator@example.invalid').firestore();
        await assertFails(addDoc(collection(db, 'auditLogs'), validAudit({ actorUid: MEMBER })));
      });
      it('fails without fix: audit log with an extra key fails', async () => {
        const db = asVerified(COCO_APPS, 'co_coordinator@example.invalid').firestore();
        await assertFails(addDoc(collection(db, 'auditLogs'), validAudit({ extra: 1 })));
      });
      it('fails without fix: audit log with a forged createdAt fails', async () => {
        const db = asVerified(COCO_APPS, 'co_coordinator@example.invalid').firestore();
        await assertFails(addDoc(collection(db, 'auditLogs'), validAudit({ createdAt: '2020-01-01' })));
      });
      it('fails without fix: audit log with a summary over 500 chars fails', async () => {
        const db = asVerified(COCO_APPS, 'co_coordinator@example.invalid').firestore();
        await assertFails(addDoc(collection(db, 'auditLogs'), validAudit({ summary: 'x'.repeat(501) })));
      });
    });

    describe('fix 9: can() uses permissions.get(p, false)', () => {
      it('fails without fix: admin whose permissions map lacks the key cannot read applications', async () => {
        const db = as(ADMIN_NOKEY).firestore();
        await assertFails(getDoc(doc(db, 'applications', 'app-1')));
      });
    });

    describe('fix 10: membershipOpen gate', () => {
      it('fails without fix: membership create fails while membershipOpen is false', async () => {
        await setMembershipOpen(false);
        const db = unauth().firestore();
        await assertFails(addDoc(collection(db, 'membershipSubmissions'), validMembership()));
        await setMembershipOpen(true);
        await assertSucceeds(addDoc(collection(db, 'membershipSubmissions'), validMembership()));
      });
    });

    describe('fix 11: contact messages need the contact permission', () => {
      it('fails without fix: contact read with only the membership permission fails', async () => {
        const db = as(ADMIN_MEM).firestore();
        await assertFails(getDoc(doc(db, 'contactMessages', 'cm-1')));
      });
      it('fails without fix: contact read with the contact permission succeeds, membership read still fails', async () => {
        const db = as(ADMIN_CONTACT).firestore();
        await assertSucceeds(getDoc(doc(db, 'contactMessages', 'cm-1')));
        await assertFails(getDoc(doc(db, 'membershipSubmissions', 'ms-1')));
        await assertSucceeds(updateDoc(doc(db, 'contactMessages', 'cm-1'), { status: 'read' }));
      });
    });

    describe('fix 12: URL fields must be empty or http(s) URLs', () => {
      it('fails without fix: event create with a bad registrationLink fails, good and empty links succeed', async () => {
        const db = as(COORD).firestore();
        await assertFails(addDoc(collection(db, 'events'), { title: 'T', registrationLink: 'not-a-url' }));
        await assertSucceeds(addDoc(collection(db, 'events'), { title: 'T', registrationLink: 'https://example.invalid/r' }));
        await assertSucceeds(addDoc(collection(db, 'events'), { title: 'T', registrationLink: '' }));
      });
      it('fails without fix: event create with a bad posterUrl fails', async () => {
        const db = as(COORD).firestore();
        await assertFails(addDoc(collection(db, 'events'), { title: 'T', posterUrl: 'notaurl' }));
      });
      it('fails without fix: event update with a bad registrationLink fails', async () => {
        const db = as(COORD).firestore();
        const ref = await assertSucceeds(addDoc(collection(db, 'events'), { title: 'T', registrationLink: 'https://example.invalid/r' }));
        await assertFails(updateDoc(ref, { registrationLink: 'notaurl' }));
      });
      it('fails without fix: constitution create with a bad fileUrl fails, empty succeeds', async () => {
        const db = as(COORD).firestore();
        await assertFails(addDoc(collection(db, 'constitution'), { title: 'C', fileUrl: 'ftp://example.invalid/c.pdf' }));
        await assertSucceeds(addDoc(collection(db, 'constitution'), { title: 'C', fileUrl: '' }));
      });
      it('fails without fix: team member create with a bad photoUrl or socialLink fails', async () => {
        const db = as(COORD).firestore();
        await assertFails(addDoc(collection(db, 'teamMembers'), { name: 'X', archived: false, photoUrl: 'notaurl' }));
        await assertFails(addDoc(collection(db, 'teamMembers'), { name: 'X', archived: false, socialLink: 'notaurl' }));
        await assertSucceeds(addDoc(collection(db, 'teamMembers'), { name: 'X', archived: false, photoUrl: 'https://example.invalid/x.jpg', socialLink: 'https://example.invalid/x' }));
      });
      it('fails without fix: recognition create with a bad photoUrl fails', async () => {
        const db = as(COORD).firestore();
        await assertFails(addDoc(collection(db, 'recognitions'), { type: 'artist_of_month', artistName: 'X', photoUrl: 'notaurl' }));
      });
      it('fails without fix: member profile create with a bad photoUrl fails', async () => {
        const db = as(COORD).firestore();
        await assertFails(addDoc(collection(db, 'memberProfiles'), { name: 'X', photoUrl: 'notaurl' }));
      });
      it('fails without fix: legacy entry create with a bad imageUrls entry fails, good URL succeeds', async () => {
        const db = as(COORD).firestore();
        await assertFails(addDoc(collection(db, 'legacyEntries'), { title: 'L', imageUrls: ['notaurl'] }));
        await assertSucceeds(addDoc(collection(db, 'legacyEntries'), { title: 'L', imageUrls: ['https://example.invalid/l.jpg'] }));
      });
    });
  // -------------------------------------------------------------------------
  // (m) Final hardening fixes — each test fails without its fix
  // -------------------------------------------------------------------------
  describe('(m) Final hardening fixes', () => {
    describe('fix H1: admin artwork uploadedAt + teamMember archived bool', () => {
      it('fails without fix: admin artwork create without uploadedAt fails', async () => {
        const db = as(COORD).firestore();
        await assertFails(addDoc(collection(db, 'artworks'), { title: 'Admin Art', artistName: 'Admin', imageUrl: 'https://example.invalid/a.jpg', createdAt: serverTimestamp() }));
      });
      it('fails without fix: admin artwork create with uploadedAt == request.time succeeds', async () => {
        const db = as(COORD).firestore();
        await assertSucceeds(addDoc(collection(db, 'artworks'), { title: 'Admin Art', artistName: 'Admin', imageUrl: 'https://example.invalid/a.jpg', createdAt: serverTimestamp(), uploadedAt: serverTimestamp() }));
      });
      it('fails without fix: team member create without archived fails', async () => {
        const db = as(COORD).firestore();
        await assertFails(addDoc(collection(db, 'teamMembers'), { name: 'X' }));
      });
      it('fails without fix: team member create with archived:false succeeds, archived:true succeeds', async () => {
        const db = as(COORD).firestore();
        await assertSucceeds(addDoc(collection(db, 'teamMembers'), { name: 'X', archived: false }));
        await assertSucceeds(addDoc(collection(db, 'teamMembers'), { name: 'Y', archived: true }));
      });
      it('fails without fix: team member update without archived still succeeds', async () => {
        const db = as(COORD).firestore();
        const ref = await assertSucceeds(addDoc(collection(db, 'teamMembers'), { name: 'X', archived: false }));
        await assertSucceeds(updateDoc(ref, { bio: 'Hello' }));
      });
    });

    describe('fix H2: events URL fields are https-only', () => {
      it('fails without fix: event create with an http registrationLink fails, https succeeds', async () => {
        const db = as(COORD).firestore();
        await assertFails(addDoc(collection(db, 'events'), { title: 'T', registrationLink: 'http://example.invalid/r' }));
        await assertSucceeds(addDoc(collection(db, 'events'), { title: 'T', registrationLink: 'https://example.invalid/r' }));
      });
      it('fails without fix: event create with an http posterUrl fails', async () => {
        const db = as(COORD).firestore();
        await assertFails(addDoc(collection(db, 'events'), { title: 'T', posterUrl: 'http://example.invalid/p.jpg' }));
      });
      it('fails without fix: event create with an http photoUrls entry fails, https entries succeed', async () => {
        const db = as(COORD).firestore();
        await assertFails(addDoc(collection(db, 'events'), { title: 'T', photoUrls: ['https://example.invalid/1.jpg', 'http://example.invalid/2.jpg'] }));
        await assertSucceeds(addDoc(collection(db, 'events'), { title: 'T', photoUrls: ['https://example.invalid/1.jpg'] }));
      });
      it('fails without fix: posterPath is a plain storage path, not a URL', async () => {
        const db = as(COORD).firestore();
        await assertSucceeds(addDoc(collection(db, 'events'), { title: 'T', posterUrl: 'https://example.invalid/p.jpg', posterPath: 'events/poster.jpg' }));
      });
    });

    describe('fix H3: likes/votes/voters carry exactly the allowed keys', () => {
      it('fails without fix: like doc with an extra key fails even with the +1 bump', async () => {
        const db = as(MEMBER).firestore();
        const batch = writeBatch(db);
        batch.update(doc(db, 'artworks', 'art-approved'), { likeCount: increment(1) });
        batch.set(doc(db, 'artworks', 'art-approved', 'likes', MEMBER), { createdAt: serverTimestamp(), extra: 1 });
        await assertFails(batch.commit());
      });
      it('fails without fix: like doc with a forged createdAt fails even with the +1 bump', async () => {
        const db = as(MEMBER).firestore();
        const batch = writeBatch(db);
        batch.update(doc(db, 'artworks', 'art-approved'), { likeCount: increment(1) });
        batch.set(doc(db, 'artworks', 'art-approved', 'likes', MEMBER), { createdAt: '2020-01-01' });
        await assertFails(batch.commit());
      });
      it('fails without fix: vote doc with an extra key fails', async () => {
        const db = as(VOTER).firestore();
        const batch = writeBatch(db);
        batch.update(doc(db, 'challenges', 'ch-voting', 'submissions', 'sub-v1'), { voteCount: increment(1) });
        batch.set(doc(db, 'challenges', 'ch-voting', 'submissions', 'sub-v1', 'votes', VOTER), { createdAt: serverTimestamp(), extra: 1 });
        batch.set(doc(db, 'challenges', 'ch-voting', 'voters', VOTER), { submissionId: 'sub-v1', createdAt: serverTimestamp() });
        await assertFails(batch.commit());
      });
      it('fails without fix: voters doc with an extra key fails', async () => {
        const db = as(VOTER).firestore();
        const batch = writeBatch(db);
        batch.update(doc(db, 'challenges', 'ch-voting', 'submissions', 'sub-v1'), { voteCount: increment(1) });
        batch.set(doc(db, 'challenges', 'ch-voting', 'submissions', 'sub-v1', 'votes', VOTER), { createdAt: serverTimestamp() });
        batch.set(doc(db, 'challenges', 'ch-voting', 'voters', VOTER), { submissionId: 'sub-v1', createdAt: serverTimestamp(), extra: 1 });
        await assertFails(batch.commit());
      });
      it('fails without fix: voters doc with a forged createdAt fails', async () => {
        const db = as(VOTER).firestore();
        const batch = writeBatch(db);
        batch.update(doc(db, 'challenges', 'ch-voting', 'submissions', 'sub-v1'), { voteCount: increment(1) });
        batch.set(doc(db, 'challenges', 'ch-voting', 'submissions', 'sub-v1', 'votes', VOTER), { createdAt: serverTimestamp() });
        batch.set(doc(db, 'challenges', 'ch-voting', 'voters', VOTER), { submissionId: 'sub-v1', createdAt: '2020-01-01' });
        await assertFails(batch.commit());
      });
    });

    describe('fix H4: one W2B submission per user + verified email for member creates', () => {
      it('fails without fix: W2B submission whose doc id is not the caller uid fails', async () => {
        const db = asVerified(MEMBER).firestore();
        await assertFails(setDoc(doc(db, 'challenges', 'ch-open', 'submissions', MEMBER2), validW2B(MEMBER)));
      });
      it('fails without fix: W2B submission with doc id == caller uid succeeds', async () => {
        const db = asVerified(MEMBER).firestore();
        await assertSucceeds(setDoc(doc(db, 'challenges', 'ch-open', 'submissions', MEMBER), validW2B(MEMBER)));
      });
      it('fails without fix: a second W2B submission from the same user fails', async () => {
        const db = asVerified(MEMBER).firestore();
        await assertSucceeds(setDoc(doc(db, 'challenges', 'ch-open', 'submissions', MEMBER), validW2B(MEMBER)));
        await assertFails(setDoc(doc(db, 'challenges', 'ch-open', 'submissions', MEMBER), validW2B(MEMBER)));
      });
      it('fails without fix: unverified member cannot create artwork', async () => {
        const db = asUnverified(MEMBER).firestore();
        await assertFails(addDoc(collection(db, 'artworks'), validArtworkCreate(MEMBER)));
      });
      it('fails without fix: unverified member cannot create a comment', async () => {
        const db = asUnverified(MEMBER).firestore();
        await assertFails(addDoc(collection(db, 'comments'), { artworkId: 'art-approved', uid: MEMBER, authorName: 'Member One', text: 'Nice work!', status: 'pending', createdAt: serverTimestamp() }));
      });
      it('fails without fix: unverified member cannot create a blog post', async () => {
        const db = asUnverified(MEMBER).firestore();
        await assertFails(addDoc(collection(db, 'blogPosts'), validBlog(MEMBER)));
      });
      it('fails without fix: unverified member cannot create a W2B submission', async () => {
        const db = asUnverified(MEMBER).firestore();
        await assertFails(setDoc(doc(db, 'challenges', 'ch-open', 'submissions', MEMBER), validW2B(MEMBER)));
      });
      it('fails without fix: verified member can create artwork, comment, blog post and W2B submission', async () => {
        const db = asVerified(MEMBER).firestore();
        await assertSucceeds(addDoc(collection(db, 'artworks'), validArtworkCreate(MEMBER)));
        await assertSucceeds(addDoc(collection(db, 'comments'), { artworkId: 'art-approved', uid: MEMBER, authorName: 'Member One', text: 'Nice work!', status: 'pending', createdAt: serverTimestamp() }));
        await assertSucceeds(addDoc(collection(db, 'blogPosts'), validBlog(MEMBER)));
        await assertSucceeds(setDoc(doc(db, 'challenges', 'ch-open', 'submissions', MEMBER), validW2B(MEMBER)));
      });
    });

    describe('fix H6: audit log actorEmail must match the token email', () => {
      const auditPayload = (overrides = {}) => ({
        actorUid: COCO_APPS,
        actorEmail: 'co_coordinator@example.invalid',
        action: 'update',
        collection: 'applications',
        docId: 'app-1',
        summary: 'status changed',
        createdAt: serverTimestamp(),
        ...overrides,
      });
      it('fails without fix: audit log with an actorEmail that is not the caller token email fails', async () => {
        const db = asVerified(COCO_APPS, 'co_coordinator@example.invalid').firestore();
        await assertFails(addDoc(collection(db, 'auditLogs'), auditPayload({ actorEmail: 'someone-else@example.invalid' })));
      });
      it('fails without fix: audit log with actorEmail matching the token email succeeds', async () => {
        const db = asVerified(COCO_APPS, 'co_coordinator@example.invalid').firestore();
        await assertSucceeds(addDoc(collection(db, 'auditLogs'), auditPayload()));
      });
    });

    describe('fix H7: Users & Permissions is coordinator-only (rules side)', () => {
      it('fails without fix: a co_coordinator with all permissions cannot update an admins doc', async () => {
        const db = as(COCO_APPS).firestore();
        await assertFails(updateDoc(doc(db, 'admins', COCO_NOAPPS), { active: false }));
      });
      it('fails without fix: a co_coordinator cannot read another admin doc, the coordinator can', async () => {
        await assertFails(getDoc(doc(as(COCO_APPS).firestore(), 'admins', COORD)));
        await assertSucceeds(getDoc(doc(as(COORD).firestore(), 'admins', COCO_APPS)));
      });
    });
  });

  // -------------------------------------------------------------------------
  // (n) Last-round fixes — each test fails without its fix
  // -------------------------------------------------------------------------
  describe('(n) Last-round fixes', () => {
    const adminBlog = (overrides = {}) => ({
      title: 'Admin Post', slug: 'admin-post', category: 'tutorial',
      authorName: 'Coordinator', authorUid: COORD, status: 'draft',
      content: 'An admin post.', coverUrl: '', coverPath: '',
      createdAt: serverTimestamp(), updatedAt: serverTimestamp(), ...overrides,
    });

    describe('fix N1: one vote per challenge — the multi-vote batch bypass', () => {
      it('fails without fix: one batch voting for two different submissions fails', async () => {
        const db = as(VOTER).firestore();
        const batch = writeBatch(db);
        batch.update(doc(db, 'challenges', 'ch-voting', 'submissions', 'sub-v1'), { voteCount: increment(1) });
        batch.update(doc(db, 'challenges', 'ch-voting', 'submissions', 'sub-v2'), { voteCount: increment(1) });
        batch.set(doc(db, 'challenges', 'ch-voting', 'submissions', 'sub-v1', 'votes', VOTER), { createdAt: serverTimestamp() });
        batch.set(doc(db, 'challenges', 'ch-voting', 'submissions', 'sub-v2', 'votes', VOTER), { createdAt: serverTimestamp() });
        // One voters doc can only name one submission, so the second vote
        // has no matching voters doc — the old rules let this through.
        batch.set(doc(db, 'challenges', 'ch-voting', 'voters', VOTER), { submissionId: 'sub-v1', createdAt: serverTimestamp() });
        await assertFails(batch.commit());
      });
      it('fails without fix: a vote doc whose voters doc names another submission fails', async () => {
        const db = as(VOTER).firestore();
        const batch = writeBatch(db);
        batch.update(doc(db, 'challenges', 'ch-voting', 'submissions', 'sub-v2'), { voteCount: increment(1) });
        batch.set(doc(db, 'challenges', 'ch-voting', 'submissions', 'sub-v2', 'votes', VOTER), { createdAt: serverTimestamp() });
        batch.set(doc(db, 'challenges', 'ch-voting', 'voters', VOTER), { submissionId: 'sub-v1', createdAt: serverTimestamp() });
        await assertFails(batch.commit());
      });
      it('the normal single vote still passes, and the voteCount moves by exactly 1', async () => {
        const db = as(VOTER).firestore();
        const batch = writeBatch(db);
        batch.update(doc(db, 'challenges', 'ch-voting', 'submissions', 'sub-v1'), { voteCount: increment(1) });
        batch.set(doc(db, 'challenges', 'ch-voting', 'submissions', 'sub-v1', 'votes', VOTER), { createdAt: serverTimestamp() });
        batch.set(doc(db, 'challenges', 'ch-voting', 'voters', VOTER), { submissionId: 'sub-v1', createdAt: serverTimestamp() });
        await assertSucceeds(batch.commit());
        const snap = await getDoc(doc(as(COORD).firestore(), 'challenges', 'ch-voting', 'submissions', 'sub-v1'));
        assert.equal(snap.data().voteCount, 11);
      });
    });

    describe('fix N2: reading documents that do not exist', () => {
      it('a member can getDoc their own not-yet-existing submission without error', async () => {
        const db = as(MEMBER).firestore();
        const snap = await assertSucceeds(getDoc(doc(db, 'challenges', 'ch-open', 'submissions', MEMBER)));
        assert.equal(snap.exists(), false);
      });
      it("another user's missing submission id is denied", async () => {
        const db = as(MEMBER).firestore();
        await assertFails(getDoc(doc(db, 'challenges', 'ch-open', 'submissions', MEMBER2)));
      });
      it('the "already submitted" pre-check works for a first-time submitter, then the create succeeds', async () => {
        const db = asVerified(MEMBER).firestore();
        const pre = await assertSucceeds(getDoc(doc(db, 'challenges', 'ch-open', 'submissions', MEMBER)));
        assert.equal(pre.exists(), false);
        await assertSucceeds(setDoc(doc(db, 'challenges', 'ch-open', 'submissions', MEMBER), validW2B(MEMBER)));
      });
      it('list queries with where status == approved still work for the public', async () => {
        const db = unauth().firestore();
        const snap = await assertSucceeds(getDocs(query(collection(db, 'challenges', 'ch-open', 'submissions'), where('status', '==', 'approved'))));
        assert.deepEqual(snap.docs.map((d) => d.id).sort(), ['sub-1', 'sub-2']);
      });
      it('an admin get() on a missing id succeeds (not-exists) now that the permission check comes first', async () => {
        const db = as(COORD).firestore();
        assert.equal((await assertSucceeds(getDoc(doc(db, 'artworks', 'no-such-art')))).exists(), false);
        assert.equal((await assertSucceeds(getDoc(doc(db, 'events', 'no-such-event')))).exists(), false);
        assert.equal((await assertSucceeds(getDoc(doc(db, 'blogPosts', 'no-such-post')))).exists(), false);
        assert.equal((await assertSucceeds(getDoc(doc(as(ADMIN_COMMENTS).firestore(), 'comments', 'no-such-comment')))).exists(), false);
      });
      it('a public get() on a missing id is still denied at the rules (services catch this and return null)', async () => {
        const db = unauth().firestore();
        await assertFails(getDoc(doc(db, 'artworks', 'no-such-art')));
        await assertFails(getDoc(doc(db, 'events', 'no-such-event')));
        await assertFails(getDoc(doc(db, 'memberProfiles', 'no-such-profile')));
      });
    });

    describe('fix N3: admin blog create', () => {
      it('admin create as draft succeeds with the exact BlogAdmin payload', async () => {
        const db = as(COORD).firestore();
        await assertSucceeds(addDoc(collection(db, 'blogPosts'), adminBlog()));
      });
      it('admin create as published succeeds, with publishedAt as a date string', async () => {
        const db = as(COORD).firestore();
        await assertSucceeds(addDoc(collection(db, 'blogPosts'), adminBlog({ status: 'published', publishedAt: '2026-11-07' })));
      });
      it('admin create as published also succeeds without publishedAt', async () => {
        const db = as(COORD).firestore();
        await assertSucceeds(addDoc(collection(db, 'blogPosts'), adminBlog({ status: 'published' })));
      });
      it('member create as published still fails, draft still succeeds', async () => {
        const db = asVerified(MEMBER).firestore();
        await assertFails(addDoc(collection(db, 'blogPosts'), validBlog(MEMBER, { status: 'published' })));
        await assertSucceeds(addDoc(collection(db, 'blogPosts'), validBlog(MEMBER)));
      });
      it('admin create with another user as authorUid fails, and with a 2-char title fails', async () => {
        const db = as(COORD).firestore();
        await assertFails(addDoc(collection(db, 'blogPosts'), adminBlog({ authorUid: MEMBER })));
        await assertFails(addDoc(collection(db, 'blogPosts'), adminBlog({ title: 'Hi' })));
      });
    });

    describe('fix N4: admin payloads — the exact payload each page/service sends', () => {
      it('Gallery: admin create / edit / approve / reject / feature with the exact GalleryAdmin payloads', async () => {
        const galleryDb = as(ADMIN_GALLERY).firestore();
        await assertSucceeds(addDoc(collection(galleryDb, 'artworks'), {
          title: 'Admin Art', artistName: 'Admin', category: 'painting',
          description: 'An admin-uploaded painting.', imageUrl: 'https://example.invalid/a.jpg',
          imagePath: 'gallery/a.jpg', status: 'pending', source: 'admin', likeCount: 0,
          featured: false, uploadedAt: serverTimestamp(), createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        }));
        await assertFails(addDoc(collection(as(ADMIN_BLOG).firestore(), 'artworks'), {
          title: 'Admin Art', artistName: 'Admin', category: 'painting',
          description: 'An admin-uploaded painting.', imageUrl: 'https://example.invalid/a.jpg',
          imagePath: 'gallery/a.jpg', status: 'pending', source: 'admin', likeCount: 0,
          featured: false, uploadedAt: serverTimestamp(), createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        }));
        await assertSucceeds(updateDoc(doc(galleryDb, 'artworks', 'art-approved'), {
          title: 'Approved Art v2', artistName: 'Asha Verma', category: 'painting',
          description: 'Updated.', imageUrl: 'https://example.invalid/a2.jpg',
          imagePath: 'gallery/a2.jpg', updatedAt: serverTimestamp(),
        }));
        await assertSucceeds(updateDoc(doc(galleryDb, 'artworks', 'art-pending'), { status: 'approved', updatedAt: serverTimestamp() }));
        await assertSucceeds(updateDoc(doc(galleryDb, 'artworks', 'art-pending'), { status: 'rejected', rejectionReason: 'Not suitable', updatedAt: serverTimestamp() }));
        await assertSucceeds(updateDoc(doc(galleryDb, 'artworks', 'art-approved'), { featured: true, updatedAt: serverTimestamp() }));
        await assertFails(updateDoc(doc(as(ADMIN_EVENTS).firestore(), 'artworks', 'art-approved'), { featured: true, updatedAt: serverTimestamp() }));
      });
      it('Events: admin create with the exact EventsAdmin payload, and publish toggle', async () => {
        const eventsDb = as(ADMIN_EVENTS).firestore();
        await assertSucceeds(addDoc(collection(eventsDb, 'events'), {
          title: 'New Event', description: 'A new event.', venue: 'Hall',
          startDate: '2026-12-01', endDate: '2026-12-02', participationDetails: 'Open to all',
          registrationLink: 'https://example.invalid/r', status: 'upcoming', published: true,
          highlights: 'Fun', posterUrl: 'https://example.invalid/p.jpg', posterPath: 'events/p.jpg',
          photoUrls: ['https://example.invalid/1.jpg'],
          createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
        }));
        await assertFails(addDoc(collection(as(ADMIN_GALLERY).firestore(), 'events'), {
          title: 'New Event', description: 'A new event.', venue: 'Hall',
          startDate: '2026-12-01', endDate: '2026-12-02', participationDetails: 'Open to all',
          registrationLink: 'https://example.invalid/r', status: 'upcoming', published: true,
          highlights: 'Fun', posterUrl: 'https://example.invalid/p.jpg', posterPath: 'events/p.jpg',
          photoUrls: ['https://example.invalid/1.jpg'],
          createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
        }));
        await assertSucceeds(updateDoc(doc(eventsDb, 'events', 'ev-1'), { published: false, updatedAt: serverTimestamp() }));
      });
      it('Notices: admin create with the exact NoticesAdmin payload, and pin toggle', async () => {
        const noticesDb = as(ADMIN_NOTICES).firestore();
        await assertSucceeds(addDoc(collection(noticesDb, 'notices'), {
          title: 'New Notice', body: 'Body text here.', type: 'general',
          important: false, pinned: true, deadline: '', published: true,
          createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
        }));
        await assertFails(addDoc(collection(as(ADMIN_EVENTS).firestore(), 'notices'), {
          title: 'New Notice', body: 'Body text here.', type: 'general',
          important: false, pinned: true, deadline: '', published: true,
          createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
        }));
        await assertSucceeds(updateDoc(doc(noticesDb, 'notices', 'n-1'), { pinned: true, updatedAt: serverTimestamp() }));
      });
      it('Team: admin create with the exact TeamAdmin payload, archive toggle, and teams create', async () => {
        const teamDb = as(ADMIN_TEAM).firestore();
        await assertSucceeds(addDoc(collection(teamDb, 'teamMembers'), {
          name: 'New Member', designation: 'team_member', teamId: 'art', termId: 't1',
          bio: '', socialLink: 'https://example.invalid/x', order: 2, active: true,
          coCoordinatorOf: [], photoUrl: 'https://example.invalid/m.jpg', photoPath: 'team/m.jpg',
          archived: false, createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
        }));
        await assertFails(addDoc(collection(as(ADMIN_NOTICES).firestore(), 'teamMembers'), {
          name: 'New Member', designation: 'team_member', teamId: 'art', termId: 't1',
          bio: '', socialLink: 'https://example.invalid/x', order: 2, active: true,
          coCoordinatorOf: [], photoUrl: 'https://example.invalid/m.jpg', photoPath: 'team/m.jpg',
          archived: false, createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
        }));
        await assertSucceeds(updateDoc(doc(teamDb, 'teamMembers', 'tm-1'), { active: false, updatedAt: serverTimestamp() }));
        await assertSucceeds(addDoc(collection(teamDb, 'teams'), { name: 'Craft', slug: 'craft', responsibility: 'Crafts.', order: 2 }));
        await assertFails(addDoc(collection(as(ADMIN_GALLERY).firestore(), 'teams'), { name: 'Craft', slug: 'craft', responsibility: 'Crafts.', order: 2 }));
      });
      it('Membership: admin status + notes update with the exact MembershipAdmin payload', async () => {
        const db = as(ADMIN_MEM).firestore();
        await assertSucceeds(updateDoc(doc(db, 'membershipSubmissions', 'ms-1'), { status: 'reviewed', notes: 'Good fit', updatedAt: serverTimestamp() }));
        await assertFails(updateDoc(doc(as(ADMIN_CONTACT).firestore(), 'membershipSubmissions', 'ms-1'), { status: 'reviewed', notes: 'Good fit', updatedAt: serverTimestamp() }));
      });
      it('Applications: status / review-note / interview payloads carry byUid = the caller', async () => {
        const firstNote = { byUid: COCO_APPS, byName: 'coco', text: 'First note', at: '2026-11-01T00:00:00Z' };
        const firstHistory = { status: 'received', at: '2026-11-01T00:00:00Z', byUid: COCO_APPS, byName: 'coco' };
        const db = as(COCO_APPS).firestore();
        // applicationService.updateStatus shape (ApplicationsAdmin now passes
        // the signed-in user as actor, so the appended entry is by the caller).
        await assertSucceeds(updateDoc(doc(db, 'applications', 'app-2'), {
          status: 'under_review',
          statusHistory: [firstHistory, { status: 'under_review', at: '2026-11-07T00:00:00Z', byUid: COCO_APPS, byName: 'co_coordinator@example.invalid' }],
          updatedAt: serverTimestamp(),
        }));
        // applicationService.addReviewNote shape.
        await assertSucceeds(updateDoc(doc(db, 'applications', 'app-2'), {
          reviewNotes: [firstNote, { byUid: COCO_APPS, byName: 'co_coordinator@example.invalid', text: 'Second note', at: '2026-11-07T00:00:00Z' }],
          updatedAt: serverTimestamp(),
        }));
        // applicationService.scheduleInterview shape.
        await assertSucceeds(updateDoc(doc(as(MENTOR_APPS).firestore(), 'applications', 'app-1'), {
          interviewDate: '2026-11-20T10:00', status: 'interview_scheduled', updatedAt: serverTimestamp(),
        }));
        // The bug this round fixed: an appended entry with byUid '' (actor
        // never passed) is still rejected by the rules.
        await assertFails(updateDoc(doc(db, 'applications', 'app-2'), {
          status: 'under_review',
          statusHistory: [firstHistory, { status: 'under_review', at: '2026-11-07T00:00:00Z', byUid: '', byName: '' }],
          updatedAt: serverTimestamp(),
        }));
        await assertFails(updateDoc(doc(db, 'applications', 'app-2'), {
          reviewNotes: [firstNote, { byUid: '', byName: '', text: 'No actor', at: '2026-11-07T00:00:00Z' }],
          updatedAt: serverTimestamp(),
        }));
      });
      it('Waste to Best: challenge create / status / review / judge score / announce winner', async () => {
        const w2bDb = as(ADMIN_W2B).firestore();
        await assertSucceeds(addDoc(collection(w2bDb, 'challenges'), {
          title: 'December Challenge', theme: 'Light', description: 'Make light.',
          rules: 'Original only.', month: '2026-12', semester: '2026-ODD',
          category: 'waste_to_best', status: 'draft', submissionDeadline: '2026-12-20',
          votingMode: 'both', createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
        }));
        await assertFails(addDoc(collection(as(ADMIN_TEAM).firestore(), 'challenges'), {
          title: 'December Challenge', theme: 'Light', description: 'Make light.',
          rules: 'Original only.', month: '2026-12', semester: '2026-ODD',
          category: 'waste_to_best', status: 'draft', submissionDeadline: '2026-12-20',
          votingMode: 'both', createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
        }));
        await assertSucceeds(updateDoc(doc(w2bDb, 'challenges', 'ch-open'), { status: 'voting', updatedAt: serverTimestamp() }));
        await assertSucceeds(updateDoc(doc(w2bDb, 'challenges', 'ch-open', 'submissions', 'sub-pending'), { status: 'approved', updatedAt: serverTimestamp() }));
        await assertSucceeds(updateDoc(doc(w2bDb, 'challenges', 'ch-open', 'submissions', 'sub-1'), { judgeScore: 9 }));
        await assertSucceeds(updateDoc(doc(w2bDb, 'challenges', 'ch-open'), {
          winnerSubmissionId: 'sub-1', winnerAnnouncedAt: serverTimestamp(), status: 'closed',
          updatedAt: serverTimestamp(),
        }));
      });
      it('Constitution: admin upload payload, and marking the old latest version not-latest', async () => {
        const constDb = as(ADMIN_CONST).firestore();
        await assertSucceeds(addDoc(collection(constDb, 'constitution'), {
          version: '2.0', title: 'Constitution', notes: 'Updated.',
          fileUrl: 'https://example.invalid/c2.pdf', filePath: 'constitution/c2.pdf',
          isLatest: true, uploadedBy: 'co_coordinator@example.invalid',
          createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
        }));
        await assertFails(addDoc(collection(as(ADMIN_W2B).firestore(), 'constitution'), {
          version: '2.0', title: 'Constitution', notes: 'Updated.',
          fileUrl: 'https://example.invalid/c2.pdf', filePath: 'constitution/c2.pdf',
          isLatest: true, uploadedBy: 'co_coordinator@example.invalid',
          createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
        }));
        await assertSucceeds(updateDoc(doc(constDb, 'constitution', 'const-1'), { isLatest: false, updatedAt: serverTimestamp() }));
      });
      it('Comments: admin status update with the exact CommentsAdmin payload', async () => {
        const db = as(ADMIN_COMMENTS).firestore();
        await assertSucceeds(updateDoc(doc(db, 'comments', 'c-1'), { status: 'approved', updatedAt: serverTimestamp() }));
        await assertFails(updateDoc(doc(as(ADMIN_CONST).firestore(), 'comments', 'c-1'), { status: 'approved', updatedAt: serverTimestamp() }));
      });
      it('Legacy: admin create with the exact LegacyAdmin payload', async () => {
        const db = as(ADMIN_LEGACY).firestore();
        await assertSucceeds(addDoc(collection(db, 'legacyEntries'), {
          year: '2025', title: 'Second exhibition', description: 'The second exhibition.',
          kind: 'event', order: 2, createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
        }));
        await assertFails(addDoc(collection(as(ADMIN_COMMENTS).firestore(), 'legacyEntries'), {
          year: '2025', title: 'Second exhibition', description: 'The second exhibition.',
          kind: 'event', order: 2, createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
        }));
      });
      it('Blog: admin update with the exact BlogAdmin payload', async () => {
        const db = as(ADMIN_BLOG).firestore();
        await assertSucceeds(updateDoc(doc(db, 'blogPosts', 'bp-1'), {
          title: 'Seed Post v2', slug: 'seed-post', category: 'tutorial',
          authorName: 'Coordinator', authorUid: COORD, status: 'draft',
          content: 'Updated content.', coverUrl: '', coverPath: '',
          updatedAt: serverTimestamp(),
        }));
        await assertFails(updateDoc(doc(as(ADMIN_LEGACY).firestore(), 'blogPosts', 'bp-1'), {
          title: 'Seed Post v2', slug: 'seed-post', category: 'tutorial',
          authorName: 'Coordinator', authorUid: COORD, status: 'draft',
          content: 'Updated content.', coverUrl: '', coverPath: '',
          updatedAt: serverTimestamp(),
        }));
      });
      it('Recognition: admin create with the exact RecognitionAdmin payload (uses the gallery permission)', async () => {
        const db = as(ADMIN_GALLERY).firestore();
        await assertSucceeds(addDoc(collection(db, 'recognitions'), {
          type: 'artist_of_month', artistName: 'New Artist', period: '2026-12',
          citation: 'Great work.', photoUrl: 'https://example.invalid/r2.jpg',
          photoPath: 'rec/r2.jpg', createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
        }));
        await assertFails(addDoc(collection(as(ADMIN_BLOG).firestore(), 'recognitions'), {
          type: 'artist_of_month', artistName: 'New Artist', period: '2026-12',
          citation: 'Great work.', photoUrl: 'https://example.invalid/r2.jpg',
          photoPath: 'rec/r2.jpg', createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
        }));
      });
      it('Contact: admin status update with the exact ContactAdmin payload', async () => {
        const db = as(ADMIN_CONTACT).firestore();
        await assertSucceeds(updateDoc(doc(db, 'contactMessages', 'cm-1'), { status: 'read', updatedAt: serverTimestamp() }));
        await assertFails(updateDoc(doc(as(ADMIN_MEM).firestore(), 'contactMessages', 'cm-1'), { status: 'read', updatedAt: serverTimestamp() }));
      });
      it('Users/Settings: coordinator-only admin update and settings save with the exact payloads', async () => {
        const coordDb = as(COORD).firestore();
        await assertSucceeds(updateDoc(doc(coordDb, 'admins', COCO_NOAPPS), {
          role: 'mentor', permissions: { ...ALL_PERMS, blog: true }, active: true,
          updatedAt: serverTimestamp(),
        }));
        await assertFails(updateDoc(doc(as(COCO_APPS).firestore(), 'admins', COCO_NOAPPS), {
          role: 'mentor', permissions: { ...ALL_PERMS, blog: true }, active: true,
          updatedAt: serverTimestamp(),
        }));
        await assertSucceeds(setDoc(doc(coordDb, 'siteSettings', 'main'), {
          heroTitle: 'New hero', heroSubtitle: 'Sub',
          about: { intro: 'i', background: 'b', vision: 'v', mission: 'm', objectives: 'o', philosophy: 'p' },
          contactEmail: 'club@example.invalid', contactPhone: '9876543210',
          institution: 'NIELIT Ropar', address: 'Ropar',
          socialLinks: { instagram: '', facebook: '', youtube: '', twitter: '' },
          membershipOpen: true, applicationsOpen: { ...OPEN_ALL },
          featuredArtworkIds: [], artistOfMonth: '',
          updatedAt: serverTimestamp(),
        }, { merge: true }));
        await assertFails(setDoc(doc(as(COCO_APPS).firestore(), 'siteSettings', 'main'), {
          heroTitle: 'New hero', membershipOpen: true, applicationsOpen: { ...OPEN_ALL },
          updatedAt: serverTimestamp(),
        }, { merge: true }));
      });
    });

    describe('fix N5: draft challenges are readable only by waste2best admins', () => {
      it('fails without fix: a draft challenge is denied to the public and to other members', async () => {
        await assertFails(getDoc(doc(unauth().firestore(), 'challenges', 'ch-draft')));
        await assertFails(getDoc(doc(as(MEMBER).firestore(), 'challenges', 'ch-draft')));
        await assertFails(getDoc(doc(as(ADMIN_TEAM).firestore(), 'challenges', 'ch-draft')));
      });
      it('a draft challenge is readable by a waste2best admin and the coordinator; open/voting/closed stay public', async () => {
        await assertSucceeds(getDoc(doc(as(ADMIN_W2B).firestore(), 'challenges', 'ch-draft')));
        await assertSucceeds(getDoc(doc(as(COORD).firestore(), 'challenges', 'ch-draft')));
        await assertSucceeds(getDoc(doc(unauth().firestore(), 'challenges', 'ch-open')));
        await assertSucceeds(getDoc(doc(unauth().firestore(), 'challenges', 'ch-voting')));
        await assertSucceeds(getDoc(doc(unauth().firestore(), 'challenges', 'ch-closed')));
      });
      it('fails without fix: an unfiltered public list query is denied once a draft exists', async () => {
        await assertFails(getDocs(query(collection(unauth().firestore(), 'challenges'))));
      });
      it('the public list query (status in open/voting/closed) succeeds and never returns a draft', async () => {
        const snap = await assertSucceeds(getDocs(query(
          collection(unauth().firestore(), 'challenges'),
          where('status', 'in', ['open', 'voting', 'closed']),
        )));
        assert.deepEqual(snap.docs.map((d) => d.id).sort(), ['ch-closed', 'ch-open', 'ch-voting']);
        await assertFails(getDocs(query(
          collection(unauth().firestore(), 'challenges'),
          where('status', '==', 'draft'),
        )));
      });
      it('a waste2best admin can still list all challenges including drafts', async () => {
        const snap = await assertSucceeds(getDocs(query(collection(as(ADMIN_W2B).firestore(), 'challenges'))));
        assert.deepEqual(snap.docs.map((d) => d.id).sort(), ['ch-closed', 'ch-draft', 'ch-open', 'ch-voting']);
      });
    });
  });

  });
});
