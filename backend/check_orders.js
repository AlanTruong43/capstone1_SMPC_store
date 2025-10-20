// Quick script to check if order exists in Firestore
const { db } = require('./src/config/firebase');

async function checkOrder() {
  const orderId = '1MtefMCm5B9ZyWHAzqGX';
  
  console.log(`🔍 Checking order: ${orderId}`);
  console.log(`📍 Project: smartshopai-45959`);
  console.log('');
  
  try {
    // Check specific order
    const orderRef = db.collection('orders').doc(orderId);
    const orderSnap = await orderRef.get();
    
    if (orderSnap.exists) {
      console.log('✅ Order FOUND in Firestore!');
      console.log('📦 Order data:');
      console.log(JSON.stringify(orderSnap.data(), null, 2));
    } else {
      console.log('❌ Order NOT FOUND in Firestore');
      console.log('');
      
      // List all orders to see what's in the collection
      console.log('📋 Listing all orders in collection:');
      const allOrders = await db.collection('orders').limit(20).get();
      
      if (allOrders.empty) {
        console.log('   ⚠️  Orders collection is EMPTY');
        console.log('   Possible causes:');
        console.log('   1. Firestore rules blocking writes');
        console.log('   2. Wrong Firebase project');
        console.log('   3. Order creation failed silently');
      } else {
        console.log(`   Found ${allOrders.size} orders:`);
        allOrders.forEach(doc => {
          const data = doc.data();
          console.log(`   - ${doc.id}`);
          console.log(`     Product: ${data.productName || 'N/A'}`);
          console.log(`     Status: ${data.status}`);
          console.log(`     Amount: ${data.totalAmount} VND`);
          console.log('');
        });
      }
    }
    
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

checkOrder();

