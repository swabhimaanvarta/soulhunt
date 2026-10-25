const mongoose = require('mongoose');

async function main() {
  await mongoose.connect('mongodb://127.0.0.1:27017/aiem_hunt');
  const db = mongoose.connection.db;

  // 1. Update SystemConfig allowed domains
  await db.collection('systemconfigs').updateOne(
    { key: 'GLOBAL_CONFIG' },
    { $set: { allowedEmailDomains: ['@aiemgoa.ac.in', '@aitdgoa.edu.in'] } },
    { upsert: true }
  );
  console.log('Updated systemconfigs allowedEmailDomains to: ["@aiemgoa.ac.in", "@aitdgoa.edu.in"]');

  // 2. Also update seed users to the official domains so admin and test accounts use the real college domain
  await db.collection('users').updateOne(
    { username: 'commander_aiem' },
    { $set: { email: 'admin@aiemgoa.ac.in' } }
  );
  await db.collection('users').updateOne(
    { username: 'warden_sen' },
    { $set: { email: 'mod@aiemgoa.ac.in' } }
  );
  await db.collection('users').updateOne(
    { username: 'vishnu_trace' },
    { $set: { email: 'vishnu@aiemgoa.ac.in' } }
  );
  await db.collection('users').updateOne(
    { username: 'rahul_seeker' },
    { $set: { email: 'rahul@aiemgoa.ac.in' } }
  );
  await db.collection('users').updateOne(
    { username: 'priya_cipher' },
    { $set: { email: 'priya@aitdgoa.edu.in' } } // supported legacy domain
  );

  console.log('Seeded users updated with official college emails.');
  const users = await db.collection('users').find({}, { projection: { username: 1, email: 1, role: 1 } }).toArray();
  console.log('Current DB Users:', users);

  await mongoose.disconnect();
}

main().catch(console.error);

