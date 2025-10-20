// Test script to simulate MoMo IPN for order payment
const axios = require('axios');

async function testPayment() {
  // Order ID from your MoMo payment page
  const orderId = 'Gifw5fst6PRPlltOk74W';
  
  console.log('🧪 Testing MoMo IPN simulation');
  console.log('📦 Order ID:', orderId);
  console.log('');
  
  try {
    const response = await axios.post('http://localhost:4000/api/payment/momo_ipn_test', {
      orderId: orderId
    }, {
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    console.log('✅ Payment simulation successful!');
    console.log('📥 Response:', response.data);
    console.log('');
    console.log('🔍 Check Firestore:');
    console.log('   Collection: orders');
    console.log('   Document:', orderId);
    console.log('   Expected status: "paid"');
    console.log('');
    console.log('🔍 Check Firestore:');
    console.log('   Collection: transactions');
    console.log('   Should have new document for this order');
    
  } catch (error) {
    console.error('❌ Test failed!');
    
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Error:', error.response.data);
    } else if (error.request) {
      console.error('No response received. Is backend running?');
      console.error('Run: npm run dev');
    } else {
      console.error('Error:', error.message);
    }
  }
}

// Run test
testPayment();

