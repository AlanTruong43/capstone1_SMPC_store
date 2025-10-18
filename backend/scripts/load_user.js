const { admin, db } = require('../src/config/firebase');

async function syncAuthUsersToFirestore() {
  console.log('Starting user sync...');
  console.log('Fetching users from Firebase Authentication...\n');

  let stats = {
    totalAuthUsers: 0,
    alreadyExists: 0,
    added: 0,
    errors: 0
  };

  try {
    const usersCollection = db.collection('users');
    
    // Fetch all users from Firebase Authentication (with pagination)
    const allUsers = [];
    let pageToken;
    
    do {
      const listUsersResult = await admin.auth().listUsers(1000, pageToken);
      allUsers.push(...listUsersResult.users);
      pageToken = listUsersResult.pageToken;
    } while (pageToken);

    stats.totalAuthUsers = allUsers.length;
    console.log(`Found ${stats.totalAuthUsers} users in Authentication\n`);
    console.log('Processing users...\n');

    // Process each user
    for (const userRecord of allUsers) {
      try {
        const uid = userRecord.uid;
        const email = userRecord.email || 'no-email@unknown.com';
        
        // Check if user already exists in Firestore
        const userDoc = await usersCollection.doc(uid).get();
        
        if (userDoc.exists) {
          console.log(`✓ ${email} - Already exists in Firestore (skipped)`);
          stats.alreadyExists++;
        } else {
          // Create new user document in Firestore
          const userData = {
            email: email,
            displayName: userRecord.displayName || email.split('@')[0],
            role: 'customer',
            isActive: true,
            registrationDate: userRecord.metadata.creationTime || new Date().toISOString(),
            lastLogin: userRecord.metadata.lastSignInTime || userRecord.metadata.creationTime || new Date().toISOString()
          };
          
          await usersCollection.doc(uid).set(userData);
          console.log(`+ ${email} - Added to Firestore`);
          stats.added++;
        }
      } catch (error) {
        console.error(`✗ ${userRecord.email || userRecord.uid} - Error: ${error.message}`);
        stats.errors++;
      }
    }

    // Print summary
    console.log('\n' + '='.repeat(50));
    console.log('Sync Complete!');
    console.log('='.repeat(50));
    console.log(`Total Auth users:      ${stats.totalAuthUsers}`);
    console.log(`Already in Firestore:  ${stats.alreadyExists}`);
    console.log(`Added to Firestore:    ${stats.added}`);
    console.log(`Errors:                ${stats.errors}`);
    console.log('='.repeat(50));

  } catch (error) {
    console.error('Fatal error during sync:', error.message);
    process.exit(1);
  }
}

// Run the sync
syncAuthUsersToFirestore()
  .then(() => {
    console.log('\nScript finished successfully.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Script failed:', error);
    process.exit(1);
  });

