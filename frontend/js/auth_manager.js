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

/**
 * Show login required modal
 * Used to block protected actions for non-authenticated users
 */
export function showLoginRequiredModal(message = 'You need to log in to buy this product') {
  // Remove existing modal if any
  const existingModal = document.getElementById('loginRequiredModal');
  if (existingModal) {
    existingModal.remove();
  }

  // Create modal HTML
  const modalHTML = `
    <div id="loginRequiredModal" style="
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.6);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 10000;
      animation: fadeIn 0.2s ease-out;
    ">
      <div style="
        background: white;
        border-radius: 12px;
        padding: 32px;
        max-width: 400px;
        width: 90%;
        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
        animation: slideUp 0.3s ease-out;
      ">
        <div style="
          width: 64px;
          height: 64px;
          background: #FEE2E2;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0 auto 20px;
        ">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#DC2626" stroke-width="2">
            <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"/>
            <path d="M12 8v4M12 16h.01"/>
          </svg>
        </div>
        
        <h3 style="
          margin: 0 0 12px;
          font-size: 20px;
          font-weight: 600;
          color: #111827;
          text-align: center;
        ">Login Required</h3>
        
        <p style="
          margin: 0 0 24px;
          font-size: 14px;
          color: #6B7280;
          text-align: center;
          line-height: 1.5;
        ">${message}</p>
        
        <div style="display: flex; gap: 12px;">
          <button id="loginModalCancel" style="
            flex: 1;
            padding: 12px 24px;
            border: 2px solid #E5E7EB;
            background: white;
            color: #374151;
            border-radius: 8px;
            font-size: 14px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.2s;
          ">Cancel</button>
          
          <button id="loginModalConfirm" style="
            flex: 1;
            padding: 12px 24px;
            border: none;
            background: #2563EB;
            color: white;
            border-radius: 8px;
            font-size: 14px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.2s;
          ">Go to Login</button>
        </div>
      </div>
    </div>
    
    <style>
      @keyframes fadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
      }
      
      @keyframes slideUp {
        from { 
          opacity: 0;
          transform: translateY(20px);
        }
        to { 
          opacity: 1;
          transform: translateY(0);
        }
      }
      
      #loginModalCancel:hover {
        background: #F3F4F6;
        border-color: #D1D5DB;
      }
      
      #loginModalConfirm:hover {
        background: #1D4ED8;
      }
    </style>
  `;

  // Insert modal into page
  document.body.insertAdjacentHTML('beforeend', modalHTML);

  // Get modal and buttons
  const modal = document.getElementById('loginRequiredModal');
  const cancelBtn = document.getElementById('loginModalCancel');
  const confirmBtn = document.getElementById('loginModalConfirm');

  // Close modal function
  const closeModal = () => {
    modal.style.animation = 'fadeOut 0.2s ease-out';
    setTimeout(() => modal.remove(), 200);
  };

  // Cancel button - just close modal
  cancelBtn.addEventListener('click', closeModal);

  // Confirm button - redirect to login
  confirmBtn.addEventListener('click', () => {
    window.location.href = '/login';
  });

  // Click outside to close
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      closeModal();
    }
  });

  // ESC key to close
  const escHandler = (e) => {
    if (e.key === 'Escape') {
      closeModal();
      document.removeEventListener('keydown', escHandler);
    }
  };
  document.addEventListener('keydown', escHandler);
}

/**
 * Protect action buttons (Buy Now, Add to Cart, etc.)
 * Checks if user is authenticated before allowing action
 * @param {string} buttonSelector - CSS selector for buttons to protect
 * @param {string} message - Custom message to show in modal
 */
export function protectActionButtons(buttonSelector = '.btn-add, .buy-now-btn', message = 'You need to log in to buy this product') {
  // Wait for auth state to be ready
  onAuthReady(() => {
    // Find all buttons matching selector
    const buttons = document.querySelectorAll(buttonSelector);
    
    buttons.forEach(button => {
      // Skip if already protected
      if (button.dataset.authProtected === 'true') {
        return;
      }
      button.dataset.authProtected = 'true';
      
      // Clone the button to remove ALL existing event listeners
      const newButton = button.cloneNode(true);
      button.parentNode.replaceChild(newButton, button);
      
      // Get the new button reference
      const protectedButton = newButton;
      
      // Store original attributes
      const originalHref = protectedButton.getAttribute('href');
      
      // Add click interceptor with capture phase AND high priority
      protectedButton.addEventListener('click', (e) => {
        // Check CURRENT auth state (not captured closure)
        const currentUser = getCurrentUser();
        
        if (!currentUser) {
          // User not logged in - block action completely
          e.preventDefault();
          e.stopPropagation();
          e.stopImmediatePropagation();
          showLoginRequiredModal(message);
          return false;
        }
        
        // User is logged in - allow normal behavior by letting event continue
      }, { capture: true, passive: false }); // Use capture phase, non-passive
      
      // If button is a link, also protect href navigation
      if (originalHref && originalHref !== '#') {
        protectedButton.addEventListener('click', (e) => {
          const currentUser = getCurrentUser();
          if (!currentUser) {
            e.preventDefault();
          }
        }, { capture: true });
      }
      
      console.log(`[Auth] Button protected with cloned node approach: ${protectedButton.className}`);
    });
    
    console.log(`[Auth] Protected ${buttons.length} action buttons with selector: ${buttonSelector}`);
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

