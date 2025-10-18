const express = require('express');
const router = express.Router();
const { admin, db } = require('../../config/firebase');
const { requireAuth, requireAdmin } = require('../../middlewares/auth_middleware');

// GET /users -> Get all users (Admin only)
router.get('/', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { search, role, status, page = 1, limit = 50 } = req.query;
    
    let query = db.collection('users');
    
    // Apply filters
    if (role && role !== 'role') {
      query = query.where('role', '==', role);
    }
    
    if (status && status !== 'status') {
      const isActive = status === 'active';
      query = query.where('isActive', '==', isActive);
    }
    
    // Get all matching documents
    const snapshot = await query.get();
    let users = [];
    
    snapshot.forEach(doc => {
      const data = doc.data();
      users.push({
        uid: doc.id,
        email: data.email || null,
        displayName: data.displayName || null,
        role: data.role || 'customer',
        isActive: data.isActive !== false,
        registrationDate: data.registrationDate || null,
        lastLogin: data.lastLogin || null
      });
    });
    
    // Apply search filter (client-side for now)
    if (search) {
      const searchLower = search.toLowerCase();
      users = users.filter(u => 
        (u.email && u.email.toLowerCase().includes(searchLower)) ||
        (u.displayName && u.displayName.toLowerCase().includes(searchLower))
      );
    }
    
    // Sort by registration date (newest first)
    users.sort((a, b) => {
      const dateA = new Date(a.registrationDate || 0);
      const dateB = new Date(b.registrationDate || 0);
      return dateB - dateA;
    });
    
    // Pagination
    const startIndex = (parseInt(page) - 1) * parseInt(limit);
    const endIndex = startIndex + parseInt(limit);
    const paginatedUsers = users.slice(startIndex, endIndex);
    
    res.json({
      users: paginatedUsers,
      pagination: {
        total: users.length,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(users.length / parseInt(limit))
      }
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to fetch users', detail: e.message });
  }
});

// POST /users -> Create new user (Admin only)
router.post('/', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { email, password, displayName, role } = req.body;
    
    // Validate required fields
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }
    
    // Create user in Firebase Authentication
    const userRecord = await admin.auth().createUser({
      email,
      password,
      displayName: displayName || email.split('@')[0]
    });
    
    // Create user document in Firestore
    const userData = {
      email,
      displayName: displayName || email.split('@')[0],
      role: role || 'customer',
      isActive: true,
      registrationDate: new Date().toISOString(),
      lastLogin: new Date().toISOString()
    };
    
    await db.collection('users').doc(userRecord.uid).set(userData);
    
    res.status(201).json({
      uid: userRecord.uid,
      ...userData
    });
  } catch (e) {
    console.error(e);
    res.status(400).json({ error: 'Failed to create user', detail: e.message });
  }
});

// PUT /users/:uid -> Update user (Admin only)
router.put('/:uid', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { uid } = req.params;
    const { displayName, role, isActive } = req.body;
    
    if (!uid) {
      return res.status(400).json({ error: 'User ID is required' });
    }
    
    // Check if user exists in Firestore
    const userDoc = await db.collection('users').doc(uid).get();
    if (!userDoc.exists) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Build update object (only include provided fields)
    const updates = {};
    if (displayName !== undefined) updates.displayName = displayName;
    if (role !== undefined) updates.role = role;
    if (isActive !== undefined) updates.isActive = isActive;
    
    // Update Firestore
    await db.collection('users').doc(uid).update(updates);
    
    // Get updated user data
    const updatedDoc = await db.collection('users').doc(uid).get();
    const updatedData = updatedDoc.data();
    
    res.json({
      uid,
      ...updatedData
    });
  } catch (e) {
    console.error(e);
    res.status(400).json({ error: 'Failed to update user', detail: e.message });
  }
});

// DELETE /users/:uid -> Delete user (Admin only) - Hard delete from Auth + Firestore
router.delete('/:uid', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { uid } = req.params;
    
    if (!uid) {
      return res.status(400).json({ error: 'User ID is required' });
    }
    
    // Prevent admin from deleting themselves
    if (uid === req.user.uid) {
      return res.status(403).json({ error: 'Cannot delete your own account' });
    }
    
    // Check if user exists in Firestore
    const userDoc = await db.collection('users').doc(uid).get();
    if (!userDoc.exists) {
      return res.status(404).json({ error: 'User not found in Firestore' });
    }
    
    const userData = userDoc.data();
    
    // Delete from Firebase Authentication
    try {
      await admin.auth().deleteUser(uid);
    } catch (authError) {
      console.warn('User not found in Auth, continuing with Firestore deletion:', authError.message);
    }
    
    // Delete from Firestore
    await db.collection('users').doc(uid).delete();
    
    res.json({ 
      success: true, 
      message: 'User deleted successfully',
      deletedUser: {
        uid,
        email: userData.email
      }
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to delete user', detail: e.message });
  }
});

// GET /users/:id -> minimal public seller info
router.get('/:id', async (req, res) => {
  try {
    const uid = req.params.id;
    if (!uid) return res.status(400).json({ error: 'user id is required' });

    const snap = await db.collection('users').doc(uid).get();
    if (!snap.exists) return res.status(404).json({ error: 'User not found' });

    const data = snap.data() || {};
    // Only expose minimal fields for seller display
    const out = {
      id: snap.id,
      displayName: data.displayName || null,
      email: data.email || null,
      role: data.role || null,
    };
    res.json(out);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'internal_error' });
  }
});

module.exports = router;


