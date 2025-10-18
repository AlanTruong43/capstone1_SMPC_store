const admin = require('firebase-admin');
const path = require('path');

// Initialize Firebase Admin SDK
const serviceAccount = require(path.join(__dirname, '../serviceAccountKey.json'));

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

// ============================================
// CONFIGURATION: Set your target user's UID here
// ============================================
const TARGET_USER_UID = 'f2WNhGM1isgzSerAORmYzS12p2g1';  // Replace with actual UID from Firebase Auth

// ============================================
// Main function to set admin custom claim
// ============================================
async function setAdminClaim() {
  try {
    console.log(`\nAttempting to set admin claim for user: ${TARGET_USER_UID}`);
    
    // Set the custom claim
    await admin.auth().setCustomUserClaims(TARGET_USER_UID, { admin: true });
    
    console.log('✓ Success! Admin claim has been set.');
    console.log(`✓ User ${TARGET_USER_UID} now has admin privileges.`);
    console.log('\nNote: The user may need to sign out and sign back in for changes to take effect.\n');
    
    // Optional: Verify the claim was set
    const user = await admin.auth().getUser(TARGET_USER_UID);
    console.log('Custom claims:', user.customClaims);
    
    process.exit(0);
  } catch (error) {
    console.error('✗ Error setting admin claim:', error.message);
    console.error('\nPossible issues:');
    console.error('  - The User ID (UID) may be incorrect');
    console.error('  - The user may not exist in Firebase Authentication');
    console.error('  - Service account credentials may be invalid\n');
    process.exit(1);
  }
}

// Execute the script
setAdminClaim();

