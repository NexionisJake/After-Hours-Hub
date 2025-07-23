// src/moderate-events.js
// === EVENT MODERATION PAGE ===
// This page allows moderators to approve or reject pending events

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { 
    getFirestore, 
    collection, 
    query, 
    where, 
    onSnapshot,
    orderBy,
    doc,
    updateDoc,
    serverTimestamp,
    getDocs,
    addDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { firebaseConfig } from './firebase-config.js';

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// DOM elements
const loadingEl = document.getElementById('loading');
const eventsContainer = document.getElementById('events-container');
const emptyStateEl = document.getElementById('empty-state');
const refreshBtn = document.getElementById('refresh-btn');
const pendingCountEl = document.getElementById('pending-count');
const approvedCountEl = document.getElementById('approved-count');
const totalCountEl = document.getElementById('total-count');
const pendingBadgeEl = document.getElementById('pending-badge');
const notificationEl = document.getElementById('notification');

// State
let pendingEvents = [];
let currentUser = null;

// Define moderator emails (in a real app, this would be stored in Firestore)
const MODERATOR_EMAILS = [
    'incredibles23507@gmail.com'
];

// Auth guard and moderator check
onAuthStateChanged(auth, (user) => {
    if (!user) {
        window.location.href = 'login.html';
        return;
    }
    
    currentUser = user;
    
    // Check if user is a moderator
    if (!MODERATOR_EMAILS.includes(user.email.toLowerCase())) {
        showNotification('Access denied. This page is for moderators only.', 'error');
        setTimeout(() => {
            window.location.href = 'dashboard-clean.html';
        }, 3000);
        return;
    }
    
    console.log('Moderator authenticated:', user.email);
    loadEvents();
    loadStats();
});

// Refresh functionality
refreshBtn.addEventListener('click', () => {
    refreshBtn.disabled = true;
    refreshBtn.innerHTML = '<i class="ph-bold ph-spinner" style="animation: spin 1s linear infinite;"></i> Refreshing...';
    
    loadEvents();
    loadStats();
    
    setTimeout(() => {
        refreshBtn.disabled = false;
        refreshBtn.innerHTML = '<i class="ph-bold ph-arrow-clockwise"></i> Refresh';
    }, 1000);
});

// Load pending events
function loadEvents() {
    showLoading();
    
    // Query only pending events
    // Temporarily removing orderBy until index is created
    const pendingQuery = query(
        collection(db, 'events'),
        where('status', '==', 'pending_approval')
        // orderBy('createdAt', 'desc')  // TODO: Re-enable after index is created
    );
    
    // Listen for real-time updates
    onSnapshot(pendingQuery, (snapshot) => {
        pendingEvents = [];
        snapshot.forEach((doc) => {
            pendingEvents.push({
                id: doc.id,
                ...doc.data()
            });
        });
        
        hideLoading();
        displayEvents();
        updatePendingCount();
    }, (error) => {
        console.error('Error loading events:', error);
        hideLoading();
        showNotification('Failed to load events. Please refresh the page.', 'error');
    });
}

// Load statistics
async function loadStats() {
    try {
        // Get total events count
        const allEventsQuery = query(collection(db, 'events'));
        const allEventsSnapshot = await getDocs(allEventsQuery);
        const totalEvents = allEventsSnapshot.size;
        
        // Get approved events today
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const approvedTodayQuery = query(
            collection(db, 'events'),
            where('status', '==', 'approved'),
            where('updatedAt', '>=', today)
        );
        const approvedTodaySnapshot = await getDocs(approvedTodayQuery);
        const approvedToday = approvedTodaySnapshot.size;
        
        // Update stats
        totalCountEl.textContent = totalEvents;
        approvedCountEl.textContent = approvedToday;
        
    } catch (error) {
        console.error('Error loading stats:', error);
    }
}

function displayEvents() {
    if (pendingEvents.length === 0) {
        showEmptyState();
        return;
    }
    
    hideEmptyState();
    eventsContainer.innerHTML = '';
    
    pendingEvents.forEach(event => {
        const eventCard = createEventCard(event);
        eventsContainer.appendChild(eventCard);
    });
}

function createEventCard(event) {
    const card = document.createElement('div');
    card.className = 'event-card';
    
    // Format dates
    const createdAt = event.createdAt ? new Date(event.createdAt.seconds * 1000).toLocaleString() : 'Unknown';
    const startDate = event.startDate ? new Date(event.startDate).toLocaleDateString() : 'TBD';
    
    card.innerHTML = `
        <div class="event-header">
            <span class="event-type">${event.eventType === 'esports' ? 'Tournament' : 'Campus Event'}</span>
            <span class="event-date">Submitted: ${createdAt}</span>
        </div>
        
        <h3 class="event-title">${escapeHtml(event.title)}</h3>
        <div class="event-creator">
            <i class="ph-bold ph-user"></i>
            Created by: ${escapeHtml(event.createdByName || 'Unknown')}
        </div>
        
        <p class="event-description">${escapeHtml(event.description || 'No description provided.')}</p>
        
        <div class="event-details">
            <div class="event-detail">
                <i class="ph-bold ph-calendar"></i>
                <span>Start: ${startDate}</span>
            </div>
            ${event.location ? `
                <div class="event-detail">
                    <i class="ph-bold ph-map-pin"></i>
                    <span>${escapeHtml(event.location)}</span>
                </div>
            ` : ''}
            ${event.game ? `
                <div class="event-detail">
                    <i class="ph-bold ph-game-controller"></i>
                    <span>Game: ${escapeHtml(event.game)}</span>
                </div>
            ` : ''}
            ${event.category ? `
                <div class="event-detail">
                    <i class="ph-bold ph-tag"></i>
                    <span>Category: ${escapeHtml(event.category)}</span>
                </div>
            ` : ''}
            ${event.organizer ? `
                <div class="event-detail">
                    <i class="ph-bold ph-users"></i>
                    <span>Organizer: <a href="profile.html?uid=${event.submittedBy?.uid || ''}" class="user-link">${escapeHtml(event.organizer)}</a></span>
                </div>
            ` : ''}
            ${event.prize ? `
                <div class="event-detail">
                    <i class="ph-bold ph-trophy"></i>
                    <span>Prize: ₹${event.prize}</span>
                </div>
            ` : ''}
            ${event.maxParticipants ? `
                <div class="event-detail">
                    <i class="ph-bold ph-user-check"></i>
                    <span>Max participants: ${event.maxParticipants}</span>
                </div>
            ` : ''}
            <div class="event-detail">
                <i class="ph-bold ph-envelope"></i>
                <span>Contact: ${escapeHtml(event.contactInfo)}</span>
            </div>
        </div>
        
        <div class="event-actions">
            <button class="approve-btn" onclick="approveEvent('${event.id}')">
                <i class="ph-bold ph-check"></i>
                Approve
            </button>
            <button class="reject-btn" onclick="rejectEvent('${event.id}')">
                <i class="ph-bold ph-x"></i>
                Reject
            </button>
        </div>
    `;
    
    return card;
}

// Event moderation functions
window.approveEvent = async function(eventId) {
    if (!confirm('Are you sure you want to approve this event? It will be visible to all users.')) {
        return;
    }
    
    const btn = event.target.closest('.approve-btn');
    const originalContent = btn.innerHTML;
    
    try {
        btn.classList.add('btn-loading');
        btn.innerHTML = '<i class="ph-bold ph-spinner" style="animation: spin 1s linear infinite;"></i> Approving...';
        btn.disabled = true;
        
        // Get the event data to access submitter info
        const eventToApprove = pendingEvents.find(e => e.id === eventId);
        
        await updateDoc(doc(db, 'events', eventId), {
            status: 'approved',
            approvedAt: serverTimestamp(),
            approvedBy: currentUser.uid,
            updatedAt: serverTimestamp()
        });
        
        // Create a notification for the submitter if they exist
        if (eventToApprove && eventToApprove.submittedBy && eventToApprove.submittedBy.uid) {
            try {
                // Add a notification in the notifications collection
                await addDoc(collection(db, 'notifications'), {
                    recipientId: eventToApprove.submittedBy.uid,
                    senderId: currentUser.uid, // Add sender ID for security rules
                    title: 'Event Approved',
                    message: `Your event "${eventToApprove.title}" has been approved and is now visible to all users.`,
                    type: 'event_approval',
                    relatedId: eventId,
                    read: false,
                    createdAt: serverTimestamp()
                });
                
                console.log('Approval notification created for submitter');
            } catch (notifError) {
                console.error('Error creating approval notification:', notifError);
            }
        }
        
        showNotification('Event approved successfully!', 'success');
        
    } catch (error) {
        console.error('Error approving event:', error);
        showNotification('Failed to approve event. Please try again.', 'error');
        btn.innerHTML = originalContent;
        btn.disabled = false;
        btn.classList.remove('btn-loading');
    }
};

// Handle the rejection modal
const rejectionModal = document.getElementById('rejection-modal');
const closeModalBtn = document.getElementById('close-modal');
const cancelRejectionBtn = document.getElementById('cancel-rejection');
const confirmRejectionBtn = document.getElementById('confirm-rejection');
const rejectionReasonInput = document.getElementById('rejection-reason');

let currentEventId = null;
let currentEventButton = null;

window.rejectEvent = function(eventId) {
    // Store the event ID and button for later
    currentEventId = eventId;
    currentEventButton = event.target.closest('.reject-btn');
    
    // Find the event data
    const eventData = pendingEvents.find(e => e.id === eventId);
    
    // Show the modal
    rejectionModal.style.display = 'flex';
    rejectionReasonInput.focus();
};

// Close modal when clicking the close button
closeModalBtn.addEventListener('click', () => {
    rejectionModal.style.display = 'none';
    rejectionReasonInput.value = '';
});

// Close modal when clicking the cancel button
cancelRejectionBtn.addEventListener('click', () => {
    rejectionModal.style.display = 'none';
    rejectionReasonInput.value = '';
});

// Close modal when clicking outside of it
window.addEventListener('click', (e) => {
    if (e.target === rejectionModal) {
        rejectionModal.style.display = 'none';
        rejectionReasonInput.value = '';
    }
});

// Handle the confirmation button
confirmRejectionBtn.addEventListener('click', async () => {
    if (!currentEventId) return;
    
    const reason = rejectionReasonInput.value.trim();
    if (!reason) {
        alert('Please provide a reason for rejection.');
        return;
    }
    
    const originalContent = currentEventButton.innerHTML;
    
    try {
        currentEventButton.classList.add('btn-loading');
        currentEventButton.innerHTML = '<i class="ph-bold ph-spinner" style="animation: spin 1s linear infinite;"></i> Rejecting...';
        currentEventButton.disabled = true;
        
        // Get the event data to access submitter info
        const eventToReject = pendingEvents.find(e => e.id === currentEventId);
        
        // Update the event status
        await updateDoc(doc(db, 'events', currentEventId), {
            status: 'rejected',
            rejectedAt: serverTimestamp(),
            rejectedBy: currentUser.uid,
            rejectionReason: reason,
            updatedAt: serverTimestamp()
        });
        
        // Create a notification for the submitter if they exist
        if (eventToReject && eventToReject.submittedBy && eventToReject.submittedBy.uid) {
            try {
                // Add a notification in the notifications collection
                await addDoc(collection(db, 'notifications'), {
                    recipientId: eventToReject.submittedBy.uid,
                    senderId: currentUser.uid, // Add sender ID for security rules
                    title: 'Event Rejected',
                    message: `Your event "${eventToReject.title}" was rejected. Reason: ${reason}`,
                    type: 'event_rejection',
                    relatedId: currentEventId,
                    read: false,
                    createdAt: serverTimestamp()
                });
                
                console.log('Notification created for submitter');
            } catch (notifError) {
                console.error('Error creating notification:', notifError);
            }
        }
        
        // Close the modal
        rejectionModal.style.display = 'none';
        rejectionReasonInput.value = '';
        
        showNotification('Event rejected and feedback sent to submitter', 'success');
    } catch (error) {
        console.error('Error rejecting event:', error);
        showNotification('Failed to reject event. Please try again.', 'error');
        currentEventButton.innerHTML = originalContent;
        currentEventButton.disabled = false;
        currentEventButton.classList.remove('btn-loading');
    }
});// UI Helper functions
function updatePendingCount() {
    const count = pendingEvents.length;
    pendingCountEl.textContent = count;
    pendingBadgeEl.textContent = count;
}

function showLoading() {
    loadingEl.style.display = 'block';
    eventsContainer.style.display = 'none';
    emptyStateEl.style.display = 'none';
}

function hideLoading() {
    loadingEl.style.display = 'none';
    eventsContainer.style.display = 'grid';
}

function showEmptyState() {
    eventsContainer.style.display = 'none';
    emptyStateEl.style.display = 'block';
}

function hideEmptyState() {
    emptyStateEl.style.display = 'none';
    eventsContainer.style.display = 'grid';
}

function showNotification(message, type) {
    notificationEl.textContent = message;
    notificationEl.className = `notification ${type}`;
    notificationEl.classList.add('show');
    
    setTimeout(() => {
        notificationEl.classList.remove('show');
    }, 5000);
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Initialize theme support
function initTheme() {
    const savedTheme = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
}

// Initialize on load
initTheme();
