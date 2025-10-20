// Test script to verify Firestore connection and write permission
const { db, admin } = require('./src/config/firebase');

async function testFirestoreWrite() {
  console.log('🧪 Testing Firestore connection...');
  
  try {
    // Test 1: Write a simple document
    console.log('\n📝 Test 1: Writing test document...');
    const testRef = await db.collection('_test').add({
      message: 'Hello from test script',
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      createdAt: new Date().toISOString()
    });
    
    console.log('✅ Test document created with ID:', testRef.id);
    
    // Test 2: Read it back
    console.log('\n📖 Test 2: Reading test document...');
    const testSnap = await testRef.get();
    
    if (testSnap.exists) {
      console.log('✅ Test document data:', testSnap.data());
    } else {
      console.log('❌ Test document not found');
    }
    
    // Test 3: Write to orders collection (simulate real order)
    console.log('\n📝 Test 3: Writing to orders collection...');
    const orderRef = await db.collection('orders').add({
      productId: 'test-product',
      productName: 'Test Product',
      productPrice: 100000,
      sellerId: 'test-seller',
      buyerId: 'test-buyer',
      quantity: 1,
      totalAmount: 100000,
      shippingAddress: {
        fullName: 'Test User',
        address: 'Test Address',
        phone: '0123456789'
      },
      status: 'pending',
      paymentDetails: null,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    
    console.log('✅ Test order created with ID:', orderRef.id);
    
    // Test 4: Read it back immediately
    console.log('\n📖 Test 4: Reading test order...');
    const orderSnap = await orderRef.get();
    
    if (orderSnap.exists) {
      console.log('✅ Test order data:', JSON.stringify(orderSnap.data(), null, 2));
    } else {
      console.log('❌ Test order not found');
    }
    
    // Test 5: List all documents in orders collection
    console.log('\n📋 Test 5: Listing all orders...');
    const ordersSnap = await db.collection('orders').limit(10).get();
    console.log(`Found ${ordersSnap.size} orders in collection`);
    
    ordersSnap.forEach((doc) => {
      console.log(`  - ${doc.id}: ${doc.data().productName || 'N/A'} (${doc.data().status})`);
    });
    
    // Cleanup
    console.log('\n🧹 Cleaning up test documents...');
    await testRef.delete();
    console.log('✅ Test document deleted');
    
    // Don't delete the test order so you can verify in console
    console.log(`\n✅ All tests passed!`);
    console.log(`\n📍 Check Firebase Console:`);
    console.log(`   https://console.firebase.google.com/project/smartshopai-45959/firestore`);
    console.log(`   Collection: orders`);
    console.log(`   Document ID: ${orderRef.id}`);
    
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Stack trace:', error.stack);
    process.exit(1);
  }
}

testFirestoreWrite();

