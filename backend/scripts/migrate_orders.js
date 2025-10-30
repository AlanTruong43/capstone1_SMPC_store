/**
 * Order Migration Script
 * 
 * Purpose: Migrate existing orders from old schema to new schema
 * 
 * Changes:
 * - Converts old 'status' field to new 'orderStatus' field
 * - Removes old 'status' field
 * - Adds new lifecycle fields
 * 
 * Run this ONCE before deploying new order management system:
 * $ node backend/scripts/migrate_orders.js
 */

const { db, admin } = require('../src/config/firebase');

// Status mapping from old to new
const STATUS_MAPPING = {
  'pending': 'pending',
  'paid': 'paid',
  'confirmed': 'paid',  // Old 'confirmed' becomes 'paid'
  'failed': 'cancelled',
  'cancelled': 'cancelled'
};

async function migrateOrders() {
  console.log('🔄 Starting order migration...\n');

  try {
    // Fetch all orders
    const ordersSnapshot = await db.collection('orders').get();
    
    if (ordersSnapshot.empty) {
      console.log('✅ No orders found. Nothing to migrate.');
      return;
    }

    console.log(`📦 Found ${ordersSnapshot.size} orders to process\n`);

    let migratedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    // Process each order
    for (const doc of ordersSnapshot.docs) {
      const orderId = doc.id;
      const orderData = doc.data();

      try {
        // Check if already migrated (has orderStatus field)
        if (orderData.orderStatus) {
          console.log(`⏭️  Order ${orderId}: Already migrated, skipping`);
          skippedCount++;
          continue;
        }

        // Prepare update data
        const updateData = {
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        };

        // Map old status to new orderStatus
        const oldStatus = orderData.status || 'pending';
        updateData.orderStatus = STATUS_MAPPING[oldStatus] || 'pending';

        // Add new lifecycle fields with defaults
        updateData.shippingStatus = 'not_shipped';
        updateData.cancelledBy = null;
        updateData.cancellationReason = null;
        updateData.sellerNotes = null;
        updateData.buyerNotes = null;

        // Initialize status history with current state
        updateData.statusHistory = [{
          status: updateData.orderStatus,
          changedBy: 'system',
          changedAt: orderData.createdAt || admin.firestore.FieldValue.serverTimestamp(),
          notes: 'Migrated from old schema'
        }];

        // Set timestamps based on current status
        if (updateData.orderStatus === 'paid' && orderData.paidAt) {
          updateData.statusHistory.push({
            status: 'paid',
            changedBy: 'system',
            changedAt: orderData.paidAt,
            notes: 'Payment confirmed'
          });
        }

        // Remove old status field
        updateData.status = admin.firestore.FieldValue.delete();

        // Update the order
        await db.collection('orders').doc(orderId).update(updateData);

        console.log(`✅ Order ${orderId}: Migrated from '${oldStatus}' to '${updateData.orderStatus}'`);
        migratedCount++;

      } catch (error) {
        console.error(`❌ Order ${orderId}: Migration failed - ${error.message}`);
        errorCount++;
      }
    }

    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 Migration Summary:');
    console.log('='.repeat(60));
    console.log(`✅ Successfully migrated: ${migratedCount}`);
    console.log(`⏭️  Already migrated (skipped): ${skippedCount}`);
    console.log(`❌ Errors: ${errorCount}`);
    console.log(`📦 Total processed: ${ordersSnapshot.size}`);
    console.log('='.repeat(60) + '\n');

    if (errorCount === 0) {
      console.log('🎉 Migration completed successfully!\n');
    } else {
      console.log('⚠️  Migration completed with some errors. Please review the logs above.\n');
    }

  } catch (error) {
    console.error('❌ Fatal error during migration:', error);
    process.exit(1);
  }
}

// Run migration
console.log('╔════════════════════════════════════════════════════════╗');
console.log('║         Order Schema Migration Script                 ║');
console.log('╚════════════════════════════════════════════════════════╝\n');

migrateOrders()
  .then(() => {
    console.log('✅ Migration script completed. You can now deploy the new order management system.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Migration script failed:', error);
    process.exit(1);
  });

