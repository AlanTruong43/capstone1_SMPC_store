// User Management JavaScript
// Handles CRUD operations for admin user management page

const API_BASE_URL = 'http://localhost:4000';

// State management
let currentFilters = {
  search: '',
  role: '',
  status: '',
  page: 1,
  limit: 50
};

// DOM Elements
let usersTableBody;
let searchInput;
let roleSelect;
let statusSelect;
let userCountSpan;

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  // Get DOM elements
  usersTableBody = document.getElementById('usersTableBody');
  searchInput = document.querySelector('.search_user');
  roleSelect = document.querySelector('.roles');
  statusSelect = document.querySelector('.status_user');
  userCountSpan = document.querySelector('.user_management_3_1_1 span');

  // Attach event listeners
  attachEventListeners();

  // Load users on page load
  loadUsers();
});

/**
 * Attach event listeners to UI elements
 */
function attachEventListeners() {
  // Search input with debounce
  let searchTimeout;
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(() => {
        currentFilters.search = e.target.value.trim();
        currentFilters.page = 1; // Reset to first page
        loadUsers();
      }, 300); // Wait 300ms after user stops typing
    });
  }

  // Role filter
  if (roleSelect) {
    roleSelect.addEventListener('change', (e) => {
      currentFilters.role = e.target.value;
      currentFilters.page = 1;
      loadUsers();
    });
  }

  // Status filter
  if (statusSelect) {
    statusSelect.addEventListener('change', (e) => {
      currentFilters.status = e.target.value;
      currentFilters.page = 1;
      loadUsers();
    });
  }

  // Add user button
  const addUserBtn = document.getElementById('addUserBtn');
  if (addUserBtn) {
    addUserBtn.addEventListener('click', openAddUserModal);
  }

  // Delete confirmation checkbox
  const deleteCheckbox = document.getElementById('deleteConfirmCheckbox');
  if (deleteCheckbox) {
    deleteCheckbox.addEventListener('change', (e) => {
      document.getElementById('confirmDeleteBtn').disabled = !e.target.checked;
    });
  }
}

/**
 * Get ID token from localStorage
 */
function getIdToken() {
  return localStorage.getItem('idToken');
}

/**
 * Load users from backend API
 */
async function loadUsers() {
  if (!usersTableBody) return;

  // Show loading state
  usersTableBody.innerHTML = `
    <tr>
      <td colspan="7" style="text-align: center; padding: 40px;">
        <div style="font-size: 16px; color: #6B7280;">Loading users...</div>
      </td>
    </tr>
  `;

  try {
    const idToken = getIdToken();
    if (!idToken) {
      showError('Authentication required. Please login again.');
      return;
    }

    // Build query string
    const params = new URLSearchParams();
    if (currentFilters.search) params.append('search', currentFilters.search);
    if (currentFilters.role && currentFilters.role !== 'role') params.append('role', currentFilters.role);
    if (currentFilters.status && currentFilters.status !== 'status') params.append('status', currentFilters.status);
    params.append('page', currentFilters.page);
    params.append('limit', currentFilters.limit);

    const response = await fetch(`${API_BASE_URL}/users?${params.toString()}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${idToken}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      if (response.status === 403) {
        showError('Admin access required');
      } else if (response.status === 401) {
        showError('Session expired. Please login again.');
      } else {
        throw new Error('Failed to fetch users');
      }
      return;
    }

    const data = await response.json();
    renderUsersTable(data.users);
    updateUserCount(data.pagination.total);

  } catch (error) {
    console.error('Error loading users:', error);
    showError('Failed to load users. Please try again.');
  }
}

/**
 * Render users in the table
 */
function renderUsersTable(users) {
  if (!usersTableBody) return;

  // Clear table
  usersTableBody.innerHTML = '';

  // Check if no users
  if (!users || users.length === 0) {
    usersTableBody.innerHTML = `
      <tr>
        <td colspan="7" style="text-align: center; padding: 40px;">
          <div style="font-size: 16px; color: #6B7280;">No users found</div>
        </td>
      </tr>
    `;
    return;
  }

  // Render each user
  users.forEach(user => {
    const row = createUserRow(user);
    usersTableBody.appendChild(row);
  });
}

/**
 * Create a table row for a user
 */
function createUserRow(user) {
  const tr = document.createElement('tr');
  
  // Format dates
  const joinDate = user.registrationDate ? formatDate(user.registrationDate) : 'N/A';
  
  // Determine role class for styling
  const roleClass = user.role === 'admin' ? 'admin' : user.role === 'seller' ? 'seller' : 'buyer';
  
  // Determine status class
  const statusClass = user.isActive ? 'active' : 'nonactive';
  const statusText = user.isActive ? 'Active' : 'Inactive';
  
  tr.innerHTML = `
    <td>
      <div class="user-info">
        <img src="/img/icon/user.png" alt="">
        <div class="user-info-2">
          <div class="user-name">${escapeHtml(user.displayName || 'No Name')}</div>
          <div class="user-email">${escapeHtml(user.email || 'No Email')}</div>
        </div>
      </div>
    </td>
    <td class="form_table ${roleClass}"><p>${capitalizeFirst(user.role)}</p></td>
    <td class="form_table ${statusClass}"><p>${statusText}</p></td>
    <td>${joinDate}</td>
    <td>-</td>
    <td>-</td>
    <td class="table_action">
      <img src="/img/icon/icons8-edit-50.png" alt="Edit" title="Edit user" style="cursor: pointer;" onclick="editUser('${user.uid}')">
      <img src="/img/icon/icons8-view-24.png" alt="View" title="View details" style="cursor: pointer;" onclick="viewUser('${user.uid}')">
      <img src="/img/icon/icons8-delete-user-male-24.png" alt="Delete" title="Delete user" style="cursor: pointer;" onclick="deleteUser('${user.uid}', '${escapeHtml(user.email || '')}')">
    </td>
  `;
  
  return tr;
}

/**
 * Update user count display
 */
function updateUserCount(count) {
  if (userCountSpan) {
    userCountSpan.textContent = count;
  }
}

/**
 * Show error message
 */
function showError(message) {
  if (usersTableBody) {
    usersTableBody.innerHTML = `
      <tr>
        <td colspan="7" style="text-align: center; padding: 40px;">
          <div style="font-size: 16px; color: #EF4444;">${escapeHtml(message)}</div>
        </td>
      </tr>
    `;
  }
}

/**
 * Format date string
 */
function formatDate(dateString) {
  try {
    const date = new Date(dateString);
    return date.toISOString().split('T')[0]; // YYYY-MM-DD
  } catch (e) {
    return 'N/A';
  }
}

/**
 * Capitalize first letter
 */
function capitalizeFirst(str) {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// ============================================
// CRUD OPERATIONS
// ============================================

// Global variables to store current operation data
let currentDeleteUid = null;
let currentDeleteEmail = null;

/**
 * Delete User - Show confirmation modal
 */
function deleteUser(uid, email) {
  currentDeleteUid = uid;
  currentDeleteEmail = email;
  
  document.getElementById('deleteUserEmail').textContent = email;
  document.getElementById('deleteModal').style.display = 'block';
  document.getElementById('deleteConfirmCheckbox').checked = false;
  document.getElementById('confirmDeleteBtn').disabled = true;
}

/**
 * Close delete modal
 */
function closeDeleteModal() {
  document.getElementById('deleteModal').style.display = 'none';
  currentDeleteUid = null;
  currentDeleteEmail = null;
}

/**
 * Confirm delete - Actually delete the user
 */
async function confirmDelete() {
  if (!currentDeleteUid) return;
  
  const confirmBtn = document.getElementById('confirmDeleteBtn');
  confirmBtn.disabled = true;
  confirmBtn.textContent = 'Deleting...';
  
  try {
    const idToken = getIdToken();
    const response = await fetch(`${API_BASE_URL}/users/${currentDeleteUid}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${idToken}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to delete user');
    }
    
    const result = await response.json();
    console.log('User deleted:', result);
    
    closeDeleteModal();
    alert('User deleted successfully!');
    loadUsers(); // Reload the user list
    
  } catch (error) {
    console.error('Error deleting user:', error);
    alert('Failed to delete user: ' + error.message);
    confirmBtn.disabled = false;
    confirmBtn.textContent = 'Delete User';
  }
}

/**
 * View User - Show details modal
 */
async function viewUser(uid) {
  try {
    const idToken = getIdToken();
    const response = await fetch(`${API_BASE_URL}/users/${uid}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${idToken}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      throw new Error('Failed to fetch user details');
    }
    
    const user = await response.json();
    
    // Populate modal
    document.getElementById('viewEmail').textContent = user.email || 'N/A';
    document.getElementById('viewDisplayName').textContent = user.displayName || 'N/A';
    document.getElementById('viewRole').textContent = capitalizeFirst(user.role || 'customer');
    document.getElementById('viewStatus').textContent = user.isActive ? 'Active' : 'Inactive';
    document.getElementById('viewRegistrationDate').textContent = formatDate(user.registrationDate) || 'N/A';
    document.getElementById('viewLastLogin').textContent = formatDate(user.lastLogin) || 'N/A';
    document.getElementById('viewUid').textContent = uid;
    
    document.getElementById('viewUserModal').style.display = 'block';
    
  } catch (error) {
    console.error('Error viewing user:', error);
    alert('Failed to load user details: ' + error.message);
  }
}

/**
 * Close view modal
 */
function closeViewUserModal() {
  document.getElementById('viewUserModal').style.display = 'none';
}

/**
 * Edit User - Show edit modal
 */
async function editUser(uid) {
  try {
    const idToken = getIdToken();
    const response = await fetch(`${API_BASE_URL}/users/${uid}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${idToken}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      throw new Error('Failed to fetch user details');
    }
    
    const user = await response.json();
    
    // Populate form
    document.getElementById('editUid').value = uid;
    document.getElementById('editEmail').value = user.email || '';
    document.getElementById('editDisplayName').value = user.displayName || '';
    document.getElementById('editRole').value = user.role || 'customer';
    document.getElementById('editStatus').value = user.isActive ? 'true' : 'false';
    
    document.getElementById('editUserModal').style.display = 'block';
    
  } catch (error) {
    console.error('Error loading user for edit:', error);
    alert('Failed to load user details: ' + error.message);
  }
}

/**
 * Close edit modal
 */
function closeEditUserModal() {
  document.getElementById('editUserModal').style.display = 'none';
}

/**
 * Submit edit user form
 */
async function submitEditUser() {
  const uid = document.getElementById('editUid').value;
  const displayName = document.getElementById('editDisplayName').value.trim();
  const role = document.getElementById('editRole').value;
  const isActive = document.getElementById('editStatus').value === 'true';
  
  if (!displayName) {
    alert('Display name is required');
    return;
  }
  
  try {
    const idToken = getIdToken();
    const response = await fetch(`${API_BASE_URL}/users/${uid}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${idToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ displayName, role, isActive })
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to update user');
    }
    
    const result = await response.json();
    console.log('User updated:', result);
    
    closeEditUserModal();
    alert('User updated successfully!');
    loadUsers(); // Reload the user list
    
  } catch (error) {
    console.error('Error updating user:', error);
    alert('Failed to update user: ' + error.message);
  }
}

/**
 * Open add user modal
 */
function openAddUserModal() {
  // Clear form
  document.getElementById('addEmail').value = '';
  document.getElementById('addPassword').value = '';
  document.getElementById('addDisplayName').value = '';
  document.getElementById('addRole').value = 'customer';
  
  document.getElementById('addUserModal').style.display = 'block';
}

/**
 * Close add user modal
 */
function closeAddUserModal() {
  document.getElementById('addUserModal').style.display = 'none';
}

/**
 * Submit add user form
 */
async function submitAddUser() {
  const email = document.getElementById('addEmail').value.trim();
  const password = document.getElementById('addPassword').value;
  const displayName = document.getElementById('addDisplayName').value.trim();
  const role = document.getElementById('addRole').value;
  
  if (!email || !password) {
    alert('Email and password are required');
    return;
  }
  
  if (password.length < 6) {
    alert('Password must be at least 6 characters');
    return;
  }
  
  try {
    const idToken = getIdToken();
    const response = await fetch(`${API_BASE_URL}/users`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${idToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ email, password, displayName, role })
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to create user');
    }
    
    const result = await response.json();
    console.log('User created:', result);
    
    closeAddUserModal();
    alert('User created successfully!');
    loadUsers(); // Reload the user list
    
  } catch (error) {
    console.error('Error creating user:', error);
    alert('Failed to create user: ' + error.message);
  }
}

