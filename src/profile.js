// src/profile.js
// User Profile Page Logic for After Hours Hub

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { 
    getFirestore, 
    collection, 
    query, 
    where, 
    getDocs, 
    orderBy,
    doc,
    getDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { 
    getAuth, 
    onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { firebaseConfig } from './firebase-config.js';

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// Global variables
let profileUserId = null;
let profileUserData = null;
let currentUser = null;

// DOM Elements
const profileName = document.getElementById('profileName');
const profileAvatar = document.getElementById('profileAvatar');
const marketListingsCount = document.getElementById('marketListingsCount');
const assignmentRequestsCount = document.getElementById('assignmentRequestsCount');
const eventsCount = document.getElementById('eventsCount');
const lostFoundCount = document.getElementById('lostFoundCount');
const errorState = document.getElementById('errorState');
const errorMessage = document.getElementById('errorMessage');

// Tab elements
const tabButtons = document.querySelectorAll('.tab-button');
const tabContents = document.querySelectorAll('.tab-content');

// Initialize the profile page
document.addEventListener('DOMContentLoaded', () => {
    // Get user ID from URL parameters
    const urlParams = new URLSearchParams(window.location.search);
    profileUserId = urlParams.get('uid');
    
    if (!profileUserId) {
        showError('No user ID provided in URL');
        return;
    }
    
    // Initialize auth and load profile
    onAuthStateChanged(auth, (user) => {
        if (!user) {
            window.location.href = 'login.html';
            return;
        }
        currentUser = user;
        loadUserProfile();
    });
    
    // Set up tab functionality
    initializeTabs();
});

/**
 * Initialize tab switching functionality
 */
function initializeTabs() {
    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            const tabName = button.dataset.tab;
            switchTab(tabName);
        });
    });
}

/**
 * Switch between profile tabs
 */
function switchTab(tabName) {
    // Update button states
    tabButtons.forEach(btn => btn.classList.remove('active'));
    document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
    
    // Update content visibility
    tabContents.forEach(content => content.classList.remove('active'));
    document.getElementById(`${tabName}Tab`).classList.add('active');
    
    // Load tab data if not already loaded
    loadTabData(tabName);
}

/**
 * Load user profile data
 */
async function loadUserProfile() {
    try {
        // Try to get user data from a users collection first
        // If it doesn't exist, we'll create basic info from their activity
        const userDoc = await getDoc(doc(db, 'users', profileUserId));
        
        if (userDoc.exists()) {
            profileUserData = userDoc.data();
            
            // If this is the current user, also get their photoURL from auth
            if (currentUser && currentUser.uid === profileUserId) {
                profileUserData.photoURL = currentUser.photoURL;
            }
            
            updateProfileHeader();
        } else {
            // If no user document exists, we'll get the name from their first activity
            await loadUserDataFromActivity();
            
            // If this is the current user, get their photo from auth
            if (currentUser && currentUser.uid === profileUserId) {
                profileUserData.photoURL = currentUser.photoURL;
                updateProfileHeader();
            }
        }
        
        // Load initial tab data (market listings by default)
        loadTabData('market');
        
    } catch (error) {
        console.error('Error loading profile:', error);
        showError('Failed to load user profile');
    }
}

/**
 * Load user data from their activity if no user document exists
 */
async function loadUserDataFromActivity() {
    try {
        // Try to find user info from market listings first
        const marketQuery = query(
            collection(db, 'marketListings'),
            where('sellerId', '==', profileUserId),
            orderBy('createdAt', 'desc')
        );
        
        const marketSnapshot = await getDocs(marketQuery);
        
        if (!marketSnapshot.empty) {
            const firstListing = marketSnapshot.docs[0].data();
            profileUserData = {
                displayName: firstListing.sellerName || 'Unknown User',
                uid: profileUserId
            };
            updateProfileHeader();
            return;
        }
        
        // Try assignment requests
        const assignmentQuery = query(
            collection(db, 'assignmentRequests'),
            where('authorId', '==', profileUserId),
            orderBy('createdAt', 'desc')
        );
        
        const assignmentSnapshot = await getDocs(assignmentQuery);
        
        if (!assignmentSnapshot.empty) {
            const firstRequest = assignmentSnapshot.docs[0].data();
            profileUserData = {
                displayName: firstRequest.authorName || 'Unknown User',
                uid: profileUserId
            };
            updateProfileHeader();
            return;
        }
        
        // Try events
        const eventsQuery = query(
            collection(db, 'events'),
            where('submittedBy.uid', '==', profileUserId),
            orderBy('createdAt', 'desc')
        );
        
        const eventsSnapshot = await getDocs(eventsQuery);
        
        if (!eventsSnapshot.empty) {
            const firstEvent = eventsSnapshot.docs[0].data();
            profileUserData = {
                displayName: firstEvent.submittedBy.displayName || 'Unknown User',
                uid: profileUserId
            };
            updateProfileHeader();
            return;
        }
        
        // Try lost and found
        const lostFoundQuery = query(
            collection(db, 'lostAndFoundItems'),
            where('reportedBy.uid', '==', profileUserId),
            orderBy('createdAt', 'desc')
        );
        
        const lostFoundSnapshot = await getDocs(lostFoundQuery);
        
        if (!lostFoundSnapshot.empty) {
            const firstItem = lostFoundSnapshot.docs[0].data();
            profileUserData = {
                displayName: firstItem.reportedBy.displayName || 'Unknown User',
                uid: profileUserId
            };
            updateProfileHeader();
            return;
        }
        
        // If no activity found
        profileUserData = {
            displayName: 'Unknown User',
            uid: profileUserId
        };
        updateProfileHeader();
        
    } catch (error) {
        console.error('Error loading user data from activity:', error);
        profileUserData = {
            displayName: 'Unknown User',
            uid: profileUserId
        };
        updateProfileHeader();
    }
}

/**
 * Update the profile header with user information
 */
function updateProfileHeader() {
    if (!profileUserData) return;
    
    const displayName = profileUserData.displayName || 'Unknown User';
    profileName.textContent = displayName;
    
    // Handle profile avatar
    const avatarImg = document.getElementById('profileAvatarImg');
    const avatarText = document.getElementById('profileAvatarText');
    
    // Check if we have a photoURL from the user data
    if (profileUserData.photoURL) {
        avatarImg.src = profileUserData.photoURL;
        avatarImg.style.display = 'block';
        avatarText.style.display = 'none';
        
        // Handle image load error
        avatarImg.onerror = () => {
            generateFallbackAvatar(displayName);
        };
    } else {
        generateFallbackAvatar(displayName);
    }
}

/**
 * Generate fallback avatar using ui-avatars.com or first letter
 */
function generateFallbackAvatar(displayName) {
    const avatarImg = document.getElementById('profileAvatarImg');
    const avatarText = document.getElementById('profileAvatarText');
    
    // Try to use ui-avatars.com service
    const userName = displayName || 'User';
    const avatarUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(userName)}&size=120&background=6c5ce7&color=ffffff&bold=true`;
    
    avatarImg.src = avatarUrl;
    avatarImg.style.display = 'block';
    avatarText.style.display = 'none';
    
    // If ui-avatars fails, fall back to first letter
    avatarImg.onerror = () => {
        avatarImg.style.display = 'none';
        avatarText.style.display = 'block';
        const firstLetter = userName.charAt(0).toUpperCase();
        avatarText.innerHTML = firstLetter;
    };
}

/**
 * Load data for a specific tab
 */
async function loadTabData(tabName) {
    switch (tabName) {
        case 'market':
            await loadMarketListings();
            break;
        case 'assignments':
            await loadAssignmentRequests();
            break;
        case 'events':
            await loadEvents();
            break;
        case 'lostfound':
            await loadLostFoundItems();
            break;
    }
}

/**
 * Load market listings for the user
 */
async function loadMarketListings() {
    const loadingEl = document.getElementById('marketLoading');
    const itemsEl = document.getElementById('marketItems');
    const emptyEl = document.getElementById('marketEmpty');
    
    try {
        loadingEl.style.display = 'block';
        itemsEl.innerHTML = '';
        emptyEl.style.display = 'none';
        
        const q = query(
            collection(db, 'marketListings'),
            where('sellerId', '==', profileUserId),
            orderBy('createdAt', 'desc')
        );
        
        const snapshot = await getDocs(q);
        loadingEl.style.display = 'none';
        
        if (snapshot.empty) {
            emptyEl.style.display = 'block';
            marketListingsCount.textContent = '0';
            return;
        }
        
        marketListingsCount.textContent = snapshot.size.toString();
        
        snapshot.forEach(doc => {
            const item = { id: doc.id, ...doc.data() };
            const card = createMarketCard(item);
            itemsEl.appendChild(card);
        });
        
    } catch (error) {
        console.error('Error loading market listings:', error);
        loadingEl.style.display = 'none';
        showTabError('market', 'Error loading market listings');
    }
}

/**
 * Load assignment requests for the user
 */
async function loadAssignmentRequests() {
    const loadingEl = document.getElementById('assignmentsLoading');
    const itemsEl = document.getElementById('assignmentItems');
    const emptyEl = document.getElementById('assignmentsEmpty');
    
    try {
        loadingEl.style.display = 'block';
        itemsEl.innerHTML = '';
        emptyEl.style.display = 'none';
        
        const q = query(
            collection(db, 'assignmentRequests'),
            where('authorId', '==', profileUserId),
            orderBy('createdAt', 'desc')
        );
        
        const snapshot = await getDocs(q);
        loadingEl.style.display = 'none';
        
        if (snapshot.empty) {
            emptyEl.style.display = 'block';
            assignmentRequestsCount.textContent = '0';
            return;
        }
        
        assignmentRequestsCount.textContent = snapshot.size.toString();
        
        snapshot.forEach(doc => {
            const item = { id: doc.id, ...doc.data() };
            const card = createAssignmentCard(item);
            itemsEl.appendChild(card);
        });
        
    } catch (error) {
        console.error('Error loading assignment requests:', error);
        loadingEl.style.display = 'none';
        showTabError('assignments', 'Error loading assignment requests');
    }
}

/**
 * Load events organized by the user
 */
async function loadEvents() {
    const loadingEl = document.getElementById('eventsLoading');
    const itemsEl = document.getElementById('eventItems');
    const emptyEl = document.getElementById('eventsEmpty');
    
    try {
        loadingEl.style.display = 'block';
        itemsEl.innerHTML = '';
        emptyEl.style.display = 'none';
        
        const q = query(
            collection(db, 'events'),
            where('submittedBy.uid', '==', profileUserId),
            orderBy('createdAt', 'desc')
        );
        
        const snapshot = await getDocs(q);
        loadingEl.style.display = 'none';
        
        if (snapshot.empty) {
            emptyEl.style.display = 'block';
            eventsCount.textContent = '0';
            return;
        }
        
        eventsCount.textContent = snapshot.size.toString();
        
        snapshot.forEach(doc => {
            const item = { id: doc.id, ...doc.data() };
            const card = createEventCard(item);
            itemsEl.appendChild(card);
        });
        
    } catch (error) {
        console.error('Error loading events:', error);
        loadingEl.style.display = 'none';
        showTabError('events', 'Error loading events');
    }
}

/**
 * Load lost and found items reported by the user
 */
async function loadLostFoundItems() {
    const loadingEl = document.getElementById('lostfoundLoading');
    const itemsEl = document.getElementById('lostfoundItems');
    const emptyEl = document.getElementById('lostfoundEmpty');
    
    try {
        loadingEl.style.display = 'block';
        itemsEl.innerHTML = '';
        emptyEl.style.display = 'none';
        
        const q = query(
            collection(db, 'lostAndFoundItems'),
            where('reportedBy.uid', '==', profileUserId),
            orderBy('createdAt', 'desc')
        );
        
        const snapshot = await getDocs(q);
        loadingEl.style.display = 'none';
        
        if (snapshot.empty) {
            emptyEl.style.display = 'block';
            lostFoundCount.textContent = '0';
            return;
        }
        
        lostFoundCount.textContent = snapshot.size.toString();
        
        snapshot.forEach(doc => {
            const item = { id: doc.id, ...doc.data() };
            const card = createLostFoundCard(item);
            itemsEl.appendChild(card);
        });
        
    } catch (error) {
        console.error('Error loading lost and found items:', error);
        loadingEl.style.display = 'none';
        showTabError('lostfound', 'Error loading lost and found items');
    }
}

/**
 * Create a market listing card
 */
function createMarketCard(item) {
    const card = document.createElement('div');
    card.className = 'profile-card';
    
    const statusClass = item.status === 'sold' ? 'status-sold' : 'status-active';
    const statusText = item.status === 'sold' ? 'Sold' : 'Available';
    
    card.innerHTML = `
        <div class="card-header">
            <h3 class="card-title">${escapeHtml(item.name)}</h3>
            <span class="card-status ${statusClass}">${statusText}</span>
        </div>
        <p class="card-description">${escapeHtml(item.description || 'No description available')}</p>
        <div class="card-meta">
            <div class="meta-item">
                <i class="ph-bold ph-currency-inr"></i>
                <span>₹${item.price}</span>
            </div>
            <div class="meta-item">
                <i class="ph-bold ph-calendar"></i>
                <span>${formatDate(item.createdAt)}</span>
            </div>
            ${item.category ? `
                <div class="meta-item">
                    <i class="ph-bold ph-tag"></i>
                    <span>${escapeHtml(item.category)}</span>
                </div>
            ` : ''}
        </div>
    `;
    
    return card;
}

/**
 * Create an assignment request card
 */
function createAssignmentCard(item) {
    const card = document.createElement('div');
    card.className = 'profile-card';
    
    const statusClass = item.status === 'completed' ? 'status-completed' : 'status-active';
    const statusText = item.status === 'completed' ? 'Completed' : 'Open';
    
    card.innerHTML = `
        <div class="card-header">
            <h3 class="card-title">${escapeHtml(item.title)}</h3>
            <span class="card-status ${statusClass}">${statusText}</span>
        </div>
        <p class="card-description">${escapeHtml(item.description || 'No description available')}</p>
        <div class="card-meta">
            <div class="meta-item">
                <i class="ph-bold ph-calendar"></i>
                <span>Due: ${formatDate(item.deadline)}</span>
            </div>
            ${item.payment ? `
                <div class="meta-item">
                    <i class="ph-bold ph-currency-inr"></i>
                    <span>₹${item.payment}</span>
                </div>
            ` : ''}
            <div class="meta-item">
                <i class="ph-bold ph-clock"></i>
                <span>Posted ${formatDate(item.createdAt)}</span>
            </div>
        </div>
    `;
    
    return card;
}

/**
 * Create an event card
 */
function createEventCard(item) {
    const card = document.createElement('div');
    card.className = 'profile-card';
    
    let statusClass = 'status-pending';
    let statusText = 'Pending';
    
    if (item.status === 'approved') {
        statusClass = 'status-active';
        statusText = 'Approved';
    } else if (item.status === 'rejected') {
        statusClass = 'status-sold';
        statusText = 'Rejected';
    }
    
    card.innerHTML = `
        <div class="card-header">
            <h3 class="card-title">${escapeHtml(item.title)}</h3>
            <span class="card-status ${statusClass}">${statusText}</span>
        </div>
        <p class="card-description">${escapeHtml(item.description || 'No description available')}</p>
        <div class="card-meta">
            <div class="meta-item">
                <i class="ph-bold ph-calendar"></i>
                <span>${formatDate(item.startDate)}</span>
            </div>
            <div class="meta-item">
                <i class="ph-bold ph-game-controller"></i>
                <span>${escapeHtml(item.eventType || 'Event')}</span>
            </div>
            ${item.prize ? `
                <div class="meta-item">
                    <i class="ph-bold ph-trophy"></i>
                    <span>₹${item.prize}</span>
                </div>
            ` : ''}
            ${item.participants ? `
                <div class="meta-item">
                    <i class="ph-bold ph-users"></i>
                    <span>${item.participants.length} participants</span>
                </div>
            ` : ''}
        </div>
    `;
    
    return card;
}

/**
 * Create a lost and found card
 */
function createLostFoundCard(item) {
    const card = document.createElement('div');
    card.className = 'profile-card';
    
    const statusClass = item.status === 'resolved' ? 'status-resolved' : 'status-active';
    const statusText = item.status === 'resolved' ? 'Resolved' : item.type === 'lost' ? 'Lost' : 'Found';
    
    card.innerHTML = `
        <div class="card-header">
            <h3 class="card-title">${escapeHtml(item.title)}</h3>
            <span class="card-status ${statusClass}">${statusText}</span>
        </div>
        <p class="card-description">${escapeHtml(item.description || 'No description available')}</p>
        <div class="card-meta">
            <div class="meta-item">
                <i class="ph-bold ph-map-pin"></i>
                <span>${escapeHtml(item.location || 'Location not specified')}</span>
            </div>
            <div class="meta-item">
                <i class="ph-bold ph-calendar"></i>
                <span>${formatDate(item.createdAt)}</span>
            </div>
            <div class="meta-item">
                <i class="ph-bold ph-${item.type === 'lost' ? 'magnifying-glass' : 'hand'}"></i>
                <span>${item.type === 'lost' ? 'Lost Item' : 'Found Item'}</span>
            </div>
        </div>
    `;
    
    return card;
}

/**
 * Show error state
 */
function showError(message) {
    errorState.style.display = 'block';
    errorMessage.textContent = message;
    
    // Hide all other content
    document.querySelector('.profile-header').style.display = 'none';
    document.querySelector('.profile-tabs').style.display = 'none';
    tabContents.forEach(content => content.style.display = 'none');
}

/**
 * Show error in a specific tab
 */
function showTabError(tabName, message) {
    const tabContent = document.getElementById(`${tabName}Tab`);
    tabContent.innerHTML = `
        <div class="error-state">
            <i class="ph-bold ph-warning"></i>
            <h3>Error</h3>
            <p>${message}</p>
        </div>
    `;
}

/**
 * Utility function to escape HTML
 */
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * Format date for display
 */
function formatDate(date) {
    if (!date) return 'Unknown';
    
    let dateObj;
    if (date.toDate) {
        // Firestore timestamp
        dateObj = date.toDate();
    } else if (typeof date === 'string') {
        dateObj = new Date(date);
    } else {
        dateObj = date;
    }
    
    return dateObj.toLocaleDateString('en-IN', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
}
