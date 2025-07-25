// src/esports-and-events.js
// === ESPORTS & EVENTS DISPLAY PAGE ===
// This page only displays approved events and tournaments

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { 
    getFirestore, 
    collection, 
    query, 
    where, 
    onSnapshot,
    orderBy 
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
const tabButtons = document.querySelectorAll('.tab-btn');

// State
let allEvents = [];
let currentFilter = 'all';

// Auth guard
onAuthStateChanged(auth, (user) => {
    if (!user) {
        window.location.href = 'login.html';
        return;
    }
    // User is authenticated, load events
    loadEvents();
});

// Tab functionality
tabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
        const tab = btn.dataset.tab;
        setActiveTab(tab);
        filterAndDisplayEvents(tab);
    });
});

function setActiveTab(activeTab) {
    tabButtons.forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === activeTab);
    });
    currentFilter = activeTab;
}

// Load events from Firestore
function loadEvents() {
    showLoading();
    
    // Query only approved events, ordered by creation date (newest first)
    // Temporarily removing orderBy until index is created
    const eventsQuery = query(
        collection(db, 'events'),
        where('status', '==', 'approved')
        // orderBy('createdAt', 'desc')  // TODO: Re-enable after index is created
    );
    
    // Listen for real-time updates
    onSnapshot(eventsQuery, (snapshot) => {
        allEvents = [];
        snapshot.forEach((doc) => {
            allEvents.push({
                id: doc.id,
                ...doc.data()
            });
        });
        
        hideLoading();
        filterAndDisplayEvents(currentFilter);
    }, (error) => {
        console.error('Error loading events:', error);
        hideLoading();
        showError('Failed to load events. Please refresh the page.');
    });
}

function filterAndDisplayEvents(filter) {
    let filteredEvents = allEvents;
    
    if (filter === 'esports') {
        filteredEvents = allEvents.filter(event => event.eventType === 'esports');
    } else if (filter === 'campus') {
        filteredEvents = allEvents.filter(event => event.eventType === 'campus');
    }
    
    displayEvents(filteredEvents);
}

function displayEvents(events) {
    if (events.length === 0) {
        showEmptyState();
        return;
    }
    
    hideEmptyState();
    eventsContainer.innerHTML = '';
    
    events.forEach(event => {
        const eventCard = createEventCard(event);
        eventsContainer.appendChild(eventCard);
    });
}

function createEventCard(event) {
    const card = document.createElement('div');
    card.className = 'event-card';
    card.onclick = () => viewEventDetails(event);
    
    // Determine event status
    const now = new Date();
    const startDate = event.startDate ? new Date(event.startDate) : null;
    const endDate = event.endDate ? new Date(event.endDate) : null;
    
    let status = 'upcoming';
    if (startDate && endDate) {
        if (now >= startDate && now <= endDate) {
            status = 'ongoing';
        } else if (now > endDate) {
            status = 'completed';
        }
    }
    
    // Format date for display
    const formatDate = (dateString) => {
        if (!dateString) return 'TBD';
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', { 
            month: 'short', 
            day: 'numeric',
            year: 'numeric'
        });
    };
    
    card.innerHTML = `
        <div class="event-header">
            <span class="event-type">${event.eventType === 'esports' ? 'Tournament' : 'Campus Event'}</span>
            <span class="event-status ${status}">${status}</span>
        </div>
        <h3 class="event-title">${escapeHtml(event.title)}</h3>
        <p class="event-description">${escapeHtml(event.description || 'No description available.')}</p>
        <div class="event-details">
            <div class="event-detail">
                <i class="ph-bold ph-calendar"></i>
                <span>${formatDate(event.startDate)}</span>
            </div>
            ${event.location ? `
                <div class="event-detail">
                    <i class="ph-bold ph-map-pin"></i>
                    <span>${escapeHtml(event.location)}</span>
                </div>
            ` : ''}
            ${event.prize ? `
                <div class="event-detail">
                    <i class="ph-bold ph-trophy"></i>
                    <span>₹${event.prize}</span>
                </div>
            ` : ''}
            ${event.maxParticipants ? `
                <div class="event-detail">
                    <i class="ph-bold ph-users"></i>
                    <span>Max ${event.maxParticipants} participants</span>
                </div>
            ` : ''}
        </div>
        <div class="event-footer">
            <div class="participant-count">
                <i class="ph-bold ph-user-check"></i>
                <span>${event.participants ? event.participants.length : 0} registered</span>
            </div>
            <button class="contact-btn" onclick="event.stopPropagation(); showContactInfo('${event.id}')">
                ${event.eventType === 'esports' ? 'Contact Organizer' : 'View Contact'}
            </button>
        </div>
        
        <!-- Contact Modal -->
        <div class="contact-modal hidden" id="contact-modal-${event.id}">
            <div class="modal-content">
                <div class="modal-header">
                    <h3>Contact Information</h3>
                    <button class="close-modal-btn" onclick="event.stopPropagation(); hideContactInfo('${event.id}')">
                        <i class="ph-bold ph-x"></i>
                    </button>
                </div>
                <div class="modal-body">
                    <p>To join or ask questions about this ${event.eventType === 'esports' ? 'tournament' : 'event'}, please contact:</p>
                    <div class="organizer-info">
                        <div class="contact-item">
                            <i class="ph-bold ph-user"></i>
                            <span>${escapeHtml(event.organizer || 'Not specified')}</span>
                        </div>
                        ${event.contactInfo ? `
                            <div class="contact-item">
                                <i class="ph-bold ph-envelope"></i>
                                <span>${escapeHtml(event.contactInfo)}</span>
                            </div>
                        ` : ''}
                        ${event.contactPhone ? `
                            <div class="contact-item">
                                <i class="ph-bold ph-phone"></i>
                                <span>${escapeHtml(event.contactPhone)}</span>
                            </div>
                        ` : ''}
                        ${event.contactEmail ? `
                            <div class="contact-item">
                                <i class="ph-bold ph-at"></i>
                                <span>${escapeHtml(event.contactEmail)}</span>
                            </div>
                        ` : ''}
                    </div>
                </div>
            </div>
        </div>
    `;
    
    return card;
}

// Event interaction functions
function viewEventDetails(event) {
    // Create a modal or navigate to a detailed view
    alert(`Event Details:\n\nTitle: ${event.title}\nType: ${event.eventType}\nDescription: ${event.description}\nStart Date: ${event.startDate}\nLocation: ${event.location || 'TBD'}`);
}

// Contact modal functions
function showContactInfo(eventId) {
    const modal = document.getElementById(`contact-modal-${eventId}`);
    if (modal) {
        modal.classList.remove('hidden');
        // Prevent body scroll when modal is open
        document.body.style.overflow = 'hidden';
    }
}

function hideContactInfo(eventId) {
    const modal = document.getElementById(`contact-modal-${eventId}`);
    if (modal) {
        modal.classList.add('hidden');
        // Restore body scroll
        document.body.style.overflow = 'auto';
    }
}

// Close modal when clicking outside of it
document.addEventListener('click', (e) => {
    if (e.target.classList.contains('contact-modal')) {
        const modalId = e.target.id;
        const eventId = modalId.replace('contact-modal-', '');
        hideContactInfo(eventId);
    }
});

// Close modal with Escape key
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        const openModals = document.querySelectorAll('.contact-modal:not(.hidden)');
        openModals.forEach(modal => {
            const eventId = modal.id.replace('contact-modal-', '');
            hideContactInfo(eventId);
        });
    }
});

// Make functions global so they can be called from onclick attributes
window.showContactInfo = showContactInfo;
window.hideContactInfo = hideContactInfo;

// Utility functions
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

function showError(message) {
    // Simple error display - could be enhanced with a proper notification system
    console.error(message);
    alert(message);
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Initialize theme support (check for existing theme preference)
function initTheme() {
    const savedTheme = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
}

// Initialize on load
initTheme();
