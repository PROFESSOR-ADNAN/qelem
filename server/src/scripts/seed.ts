import { Types } from 'mongoose';
import { connectDB, disconnectDB } from '../config/db.js';
import { User } from '../models/User.js';
import { Post } from '../models/Post.js';
import { Follow } from '../models/Follow.js';
import { Cohort } from '../models/Cohort.js';
import { Like } from '../models/Like.js';
import { Comment } from '../models/Comment.js';
import { AuthService } from '../services/auth.service.js';
import { DEFAULT_COHORTS, SYSTEM_LIMITS } from '@qelem/shared';
import { randomUUID } from 'node:crypto';

const ETHIOPIAN_FIRST_NAMES = [
  'Abebe', 'Almaz', 'Sara', 'Dawit', 'Bilen', 'Yohannes', 'Selam', 'Tewodros',
  'Meron', 'Betelhem', 'Natnael', 'Kidus', 'Hiwot', 'Ermias', 'Kalkidan', 'Haile',
  'Marta', 'Binyam', 'Rahel', 'Solomon', 'Tigist', 'Yared', 'Lydia', 'Bereket',
  'Ruth', 'Robel', 'Eden', 'Kaleb', 'Hellen', 'Samuel', 'Senait', 'Henok'
];

const ETHIOPIAN_LAST_NAMES = [
  'Bekele', 'Tadesse', 'Alemu', 'Haile', 'Kebede', 'Gebre', 'Worku', 'Tesfaye',
  'Assefa', 'Girma', 'Desta', 'Mengistu', 'Abebe', 'Tekle', 'Demissie', 'Berhanu',
  'Mulugeta', 'Negash', 'Lemma', 'Araya', 'Fikre', 'Zewde', 'Wolde', 'Tilahun'
];

const SAMPLE_DEVLOGS = [
  {
    text: 'Implemented a B-Tree indexing structure in C today for our operating systems lab. Cache locality matters immensely!',
    code: { lang: 'c' as const, body: '#include <stdio.h>\n#include <stdlib.h>\n\nstruct BTreeNode {\n  int *keys;\n  int t;\n  struct BTreeNode **C;\n  int n;\n  bool leaf;\n};' },
    tags: ['algorithms', 'c', 'systems', 'datastructures']
  },
  {
    text: 'Optimized our Express middleware pipeline using Redis pipeline queries. Reduced p95 response time from 180ms down to 14ms on mobile 3G simulations.',
    code: { lang: 'typescript' as const, body: 'const pipeline = redis.pipeline();\nfor (const id of ids) {\n  pipeline.get(`post:${id}`);\n}\nconst results = await pipeline.exec();' },
    tags: ['performance', 'typescript', 'redis', 'backend']
  },
  {
    text: 'Configuring Nginx reverse proxy with HTTP/2 and Brotli compression for the university study portal. Essential for mobile clients in Addis Ababa.',
    code: { lang: 'bash' as const, body: 'nginx -t && systemctl reload nginx\ncurl -I -H "Accept-Encoding: gzip, deflate, br" https://portal.aau.edu.et' },
    tags: ['devops', 'nginx', 'networking', 'linux']
  },
  {
    text: 'Writing property-based tests using fast-check to verify our distributed feed ranking reference model. Zero regression tolerance!',
    code: { lang: 'typescript' as const, body: 'fc.assert(fc.property(fc.array(fc.record({ id: fc.uuid(), score: fc.nat() })), (items) => {\n  return feedSort(items).length === items.length;\n}));' },
    tags: ['testing', 'quality', 'typescript', 'architecture']
  },
  {
    text: 'Building an offline-first draft composer with IndexedDB and Dexie.js so students can draft devlogs while commuting on the light rail without cellular data.',
    code: { lang: 'javascript' as const, body: 'import Dexie from "dexie";\nconst db = new Dexie("QelemDrafts");\ndb.version(1).stores({ drafts: "++id, text, code, savedAt" });' },
    tags: ['pwa', 'offline', 'javascript', 'frontend']
  }
];

async function seed() {
  console.log('--- Starting Qelem Database Seeder ---');
  await connectDB();

  const isLoad = process.argv.includes('--load');
  const userCount = isLoad ? 20000 : 1000;

  console.log(`Seeding cohorts...`);
  for (const c of DEFAULT_COHORTS) {
    await Cohort.findOneAndUpdate(
      { code: c.id },
      { code: c.id, name: c.name, isActive: true },
      { upsert: true }
    );
  }

  console.log(`Generating default admin, moderator, and test users...`);
  const defaultPassword = 'Password123!';
  const passwordHash = await AuthService.hashPassword(defaultPassword);

  // 1. Admin user
  const adminUser = await User.findOneAndUpdate(
    { usernameLower: 'admin' },
    {
      username: 'admin',
      usernameLower: 'admin',
      displayName: 'System Admin',
      email: 'admin@qelem.et',
      emailLower: 'admin@qelem.et',
      passwordHash,
      role: 'admin',
      state: 'active',
      isEmailVerified: true,
      cohortId: 'aau-cs'
    },
    { upsert: true, new: true }
  );

  // 2. Celebrity account (to test high-fanout threshold >= 2,000 followers)
  const celebrityUser = await User.findOneAndUpdate(
    { usernameLower: 'dr_abebe' },
    {
      username: 'dr_abebe',
      usernameLower: 'dr_abebe',
      displayName: 'Dr. Abebe Bekele (CS Dept Chair)',
      email: 'abebe@aau.edu.et',
      emailLower: 'abebe@aau.edu.et',
      passwordHash,
      role: 'user',
      state: 'active',
      fanoutMode: 'high_fanout',
      followersCount: 2000,
      isEmailVerified: true,
      cohortId: 'aau-cs',
      bio: 'Chair of Computer Science at Addis Ababa University. Learning in public and mentoring Ethiopian software engineers.'
    },
    { upsert: true, new: true }
  );

  console.log(`Created admin (${adminUser.username}) and celebrity author (${celebrityUser.username})`);

  // 3. Generate synthetic student accounts
  console.log(`Creating ${userCount} synthetic student accounts...`);
  const createdUsers: Types.ObjectId[] = [adminUser._id, celebrityUser._id];

  const batchSize = 250;
  for (let i = 0; i < userCount; i += batchSize) {
    const userDocs: any[] = [];
    const currentBatch = Math.min(batchSize, userCount - i);

    for (let j = 0; j < currentBatch; j++) {
      const idx = i + j + 1;
      const fn = ETHIOPIAN_FIRST_NAMES[idx % ETHIOPIAN_FIRST_NAMES.length];
      const ln = ETHIOPIAN_LAST_NAMES[(idx * 3) % ETHIOPIAN_LAST_NAMES.length];
      const username = `${fn.toLowerCase()}_${ln.toLowerCase()}_${idx}`;
      const cohort = DEFAULT_COHORTS[idx % DEFAULT_COHORTS.length].id;

      userDocs.push({
        username,
        usernameLower: username,
        displayName: `${fn} ${ln}`,
        email: `${username}@student.qelem.et`,
        emailLower: `${username}@student.qelem.et`,
        passwordHash,
        role: 'user',
        state: 'active',
        isEmailVerified: true,
        cohortId: cohort,
        bio: `CS student at ${cohort}. Building scalable systems and sharing devlogs daily.`
      });
    }

    const inserted = await User.insertMany(userDocs, { ordered: false });
    createdUsers.push(...inserted.map(u => u._id));
    process.stdout.write(`\rSeeded ${createdUsers.length} / ${userCount} users`);
  }
  console.log('');

  // 4. Follow graph: Power-law distribution
  console.log(`Generating power-law follow edges...`);
  const followOps: any[] = [];

  // Everyone follows the celebrity mentor
  for (const uId of createdUsers) {
    if (uId.toString() !== celebrityUser._id.toString()) {
      followOps.push({
        followerId: uId,
        followeeId: celebrityUser._id
      });
    }
  }

  // Random follow edges among cohort peers
  for (let i = 0; i < Math.min(createdUsers.length, 500); i++) {
    const follower = createdUsers[i];
    const peerFollowCount = Math.floor(Math.random() * 15) + 3;
    for (let k = 0; k < peerFollowCount; k++) {
      const target = createdUsers[(i + k * 17) % createdUsers.length];
      if (follower.toString() !== target.toString()) {
        followOps.push({ followerId: follower, followeeId: target });
      }
    }
  }

  if (followOps.length > 0) {
    await Follow.insertMany(followOps, { ordered: false }).catch(() => {});
    console.log(`Created ${followOps.length} follow graph edges`);
  }

  // 5. Seed Devlog Posts
  console.log(`Seeding devlog posts and engagement...`);
  const postOps: any[] = [];

  for (let i = 0; i < Math.min(createdUsers.length, 300); i++) {
    const authorId = createdUsers[i];
    const sample = SAMPLE_DEVLOGS[i % SAMPLE_DEVLOGS.length];
    const publishedAt = new Date(Date.now() - Math.floor(Math.random() * 7 * 24 * 60 * 60 * 1000));

    postOps.push({
      authorId,
      clientPostId: randomUUID(),
      text: sample.text,
      code: sample.code,
      tags: sample.tags,
      state: 'published',
      publishedAt,
      likeCount: Math.floor(Math.random() * 25),
      commentCount: Math.floor(Math.random() * 5),
      contentHash: `hash-${i}-${authorId}`,
      createdAt: publishedAt
    });
  }

  const insertedPosts = await Post.insertMany(postOps, { ordered: false });
  console.log(`Seeded ${insertedPosts.length} devlog posts`);

  console.log('--- Seeding Completed Successfully ---');
  await disconnectDB();
}

seed().catch(err => {
  console.error('Seeding failed:', err);
  process.exit(1);
});
