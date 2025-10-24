/**
 * Authentication Manager
 * Centralized Firebase authentication module for the application
 * 
 * Features:
 * - Single Firebase initialization point
 * - Auth state management
 * - Token management for API calls
 * - Admin role checking
 * - Backward compatible with existing code (exposes window.firebaseAuth)
 */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-app.js";
import { 
  getAuth, 
  onAuthStateChanged,
  signOut,
  setPersistence,
  browserLocalPersistence
} from "https://www.gstatic.com/firebasejs/10.12.4/firebase-auth.js";

// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyDI1V6BaKvdeLo2kbXAREWweZyiGAF4508",
  authDomain: "smartshopai-45959.firebaseapp.com",
  projectId: "smartshopai-45959",
  storageBucket: "smartshopai-45959.firebasestorage.app",
  messagingSenderId: "550339763780",
  appId: "1:550339763780:web:b9b8957b1597ef09d5a611"
};

// Initialize Firebase
let app;
let auth;
let currentUser = null;
let currentClaims = null;
let authStateReady = false;
let authStateCallbacks = [];

/**
 * Initialize Firebase authentication
 * Call this once per page load
 */
export function initAuth() {
  if (auth) {
    console.log('[Auth] Already initialized');
    return auth;
  }

  try {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    
    // Set persistence to LOCAL (survives browser close)
    setPersistence(auth, browserLocalPersistence).catch(err => {
      console.warn('[Auth] Failed to set persistence:', err.message);
    });

    // Expose globally for backward compatibility (checkout.js uses window.firebaseAuth)
    window.firebaseAuth = auth;

    // Setup auth state listener
    onAuthStateChanged(auth, async (user) => {
      currentUser = user;
      
      if (user) {
        // User is logged in - fetch custom claims
        try {
          const idTokenResult = await user.getIdTokenResult();
          currentClaims = idTokenResult.claims;
          console.log('[Auth] User authenticated:', user.email);
          console.log('[Auth] Claims:', currentClaims);
        } catch (err) {
          console.error('[Auth] Failed to get token claims:', err);
          currentClaims = {};
        }
      } else {
        // User is logged out
        console.log('[Auth] User not authenticated');
        currentClaims = null;
      }

      authStateReady = true;
      
      // Notify all registered callbacks
      authStateCallbacks.forEach(callback => {
        try {
          callback(user, currentClaims);
        } catch (err) {
          console.error('[Auth] Callback error:', err);
        }
      });
    });

    console.log('[Auth] Firebase initialized');
    return auth;

  } catch (error) {
    console.error('[Auth] Initialization failed:', error);
    throw error;
  }
}

/**
 * Register a callback to be called when auth state changes
 * @param {Function} callback - Function(user, claims) to call on auth state change
 */
export function onAuthReady(callback) {
  if (authStateReady) {
    // Auth state already determined, call immediately
    callback(currentUser, currentClaims);
  } else {
    // Register for future callback
    authStateCallbacks.push(callback);
  }
}

/**
 * Get current authenticated user (synchronous)
 * @returns {Object|null} Firebase user object or null
 */
export function getCurrentUser() {
  return currentUser;
}

/**
 * Get current user's custom claims (synchronous)
 * @returns {Object|null} Claims object or null
 */
export function getClaims() {
  return currentClaims;
}

/**
 * Check if current user is authenticated
 * @returns {boolean}
 */
export function isAuthenticated() {
  return currentUser !== null;
}

/**
 * Check if current user has admin role
 * @returns {boolean}
 */
export function isAdmin() {
  return currentClaims?.admin === true;
}

/**
 * Get fresh ID token for API calls
 * @param {boolean} forceRefresh - Force token refresh (default: false)
 * @returns {Promise<string>} ID token
 */
export async function getIdToken(forceRefresh = false) {
  if (!currentUser) {
    throw new Error('User not authenticated');
  }
  
  try {
    const token = await currentUser.getIdToken(forceRefresh);
    return token;
  } catch (error) {
    console.error('[Auth] Failed to get ID token:', error);
    throw error;
  }
}

/**
 * Logout current user
 * @param {string} redirectTo - URL to redirect after logout (optional)
 */
export async function logout(redirectTo = '/pages/index.html') {
  if (!auth) {
    console.warn('[Auth] Not initialized');
    return;
  }

  try {
    await signOut(auth);
    console.log('[Auth] User logged out');
    
    // Clear any local storage tokens
    localStorage.removeItem('idToken');
    localStorage.removeItem('pendingOrderId');
    
    if (redirectTo) {
      window.location.href = redirectTo;
    }
  } catch (error) {
    console.error('[Auth] Logout failed:', error);
    throw error;
  }
}

/**
 * Require admin role - redirect if not admin
 * Use this on admin pages to protect access
 * @returns {Promise<void>}
 */
export async function requireAdmin() {
  return new Promise((resolve, reject) => {
    onAuthReady((user, claims) => {
      if (!user) {
        // Not logged in
        console.warn('[Auth] Admin access denied - not logged in');
        alert('Please login to access admin panel');
        window.location.href = '/login';
        reject(new Error('Not authenticated'));
        return;
      }

      if (claims?.admin !== true) {
        // Logged in but not admin
        console.warn('[Auth] Admin access denied - insufficient permissions');
        alert('Admin access required');
        window.location.href = '/pages/index.html';
        reject(new Error('Not authorized'));
        return;
      }

      // User is admin
      console.log('[Auth] Admin access granted');
      resolve();
    });
  });
}

/**
 * Require authentication - redirect to login if not authenticated
 * Use this on pages that require login (but not admin)
 * @returns {Promise<void>}
 */
export async function requireAuth() {
  return new Promise((resolve, reject) => {
    onAuthReady((user) => {
      if (!user) {
        console.warn('[Auth] Access denied - not logged in');
        alert('Please login to continue');
        window.location.href = '/login';
        reject(new Error('Not authenticated'));
        return;
      }

      console.log('[Auth] User authenticated');
      resolve();
    });
  });
}

/**
 * Show loading state while auth is being checked
 * @param {string} loadingElementId - ID of loading element to show/hide
 */
export function showAuthLoading(loadingElementId = 'authLoading') {
  const loadingEl = document.getElementById(loadingElementId);
  if (loadingEl) {
    loadingEl.style.display = 'block';
  }

  onAuthReady(() => {
    if (loadingEl) {
      loadingEl.style.display = 'none';
    }
  });
}

// Auto-initialize if this script is loaded
// This ensures backward compatibility
if (typeof window !== 'undefined') {
  window.addEventListener('DOMContentLoaded', () => {
    // Only auto-init if not already initialized
    if (!auth) {
      console.log('[Auth] Auto-initializing...');
      initAuth();
    }
  });
}

