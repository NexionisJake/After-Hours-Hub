// src/create-event.js
// === EVENT CREATION PAGE ===
// This page handles the creation and submission of new events

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { 
    getFirestore, 
    collection, 
    addDoc,
    serverTimestamp 
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { firebaseConfig } from './firebase-config.js';

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// DOM elements
const tabButtons = document.querySelectorAll('.tab-btn');
const formSections = document.querySelectorAll('.form-section');
const eventForm = document.getElementById('event-form');
const submitBtn = document.getElementById('submit-btn');
const successMessage = document.getElementById('success-message');
const errorMessage = document.getElementById('error-message');
const errorText = document.getElementById('error-text');

// State
let currentTab = 'tournament';
let currentUser = null;

// Auth guard
onAuthStateChanged(auth, (user) => {
    if (!user) {
        window.location.href = 'login.html';
        return;
    }
    currentUser = user;
    console.log('User authenticated:', user.email);
});

// Tab functionality
tabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
        const tab = btn.dataset.tab;
        setActiveTab(tab);
    });
});

function setActiveTab(activeTab) {
    console.log('🔄 Switching to tab:', activeTab);
    
    // Update tab buttons
    tabButtons.forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === activeTab);
    });
    
    // Update form sections and manage ALL fields (not just required ones)
    formSections.forEach(section => {
        const isActive = section.id === `${activeTab}-form`;
        section.classList.toggle('active', isActive);
        
        console.log(`📋 Section ${section.id} is ${isActive ? 'ACTIVE' : 'inactive'}`);
        
        // Handle ALL form fields in this section
        const allFields = section.querySelectorAll('input, select, textarea');
        console.log(`📝 Found ${allFields.length} fields in ${section.id}`);
        
        allFields.forEach(field => {
            if (isActive) {
                // Enable ALL fields in active section
                field.disabled = false;
                
                // Only restore required attribute if the field should be required
                if (field.hasAttribute('data-originally-required') || 
                    field.closest('.form-group')?.querySelector('.required')) {
                    field.setAttribute('required', '');
                }
                
                console.log(`✅ ENABLED field: ${field.id || field.name || 'unnamed'}`);
            } else {
                // Disable ALL fields in inactive sections
                // Store original required state before removing
                if (field.hasAttribute('required')) {
                    field.setAttribute('data-originally-required', 'true');
                }
                field.removeAttribute('required');
                field.disabled = true;
                
                console.log(`❌ disabled field: ${field.id || field.name || 'unnamed'}`);
            }
        });
    });
    
    currentTab = activeTab;
    
    // Clear any previous messages
    hideMessages();
}

// Form submission
eventForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    if (!currentUser) {
        showError('Please login to create events.');
        return;
    }
    
    // Show loading state
    setSubmitLoading(true);
    hideMessages();
    
    try {
        const eventData = collectFormData();
        
        // Validate form data
        if (!validateEventData(eventData)) {
            return;
        }
        
        // Add metadata
        eventData.createdBy = currentUser.uid;
        eventData.createdByName = currentUser.displayName || currentUser.email;
        eventData.createdAt = serverTimestamp();
        eventData.updatedAt = serverTimestamp();
        eventData.status = 'pending_approval'; // CRITICAL: Always set to pending
        eventData.participants = [];
        eventData.submittedBy = {
            uid: currentUser.uid,
            displayName: currentUser.displayName || currentUser.email
        };
        
        // Save to Firestore
        const docRef = await addDoc(collection(db, 'events'), eventData);
        console.log('Event created with ID:', docRef.id);
        
        // Show enhanced success message
        document.getElementById('success-message').innerHTML = `
            <i class="ph-bold ph-check-circle"></i>
            <p>Event submitted successfully! Your event is now pending approval.</p>
            <p style="margin-top: 10px">You'll be redirected back to events in 2 seconds...</p>
        `;
        showSuccess();
        
        // Clear form
        eventForm.reset();
        
        // Redirect after delay - reduced to 2 seconds for better UX
        setTimeout(() => {
            window.location.href = 'esports-and-events.html';
        }, 2000);
        
    } catch (error) {
        console.error('Error creating event:', error);
        showError('Failed to create event. Please try again.');
    } finally {
        setSubmitLoading(false);
    }
});

function collectFormData() {
    const isEsports = currentTab === 'tournament';
    const prefix = isEsports ? 'tournament' : 'campus';
    
    const baseData = {
        eventType: isEsports ? 'esports' : 'campus',
        title: document.getElementById(`${prefix}-title`).value.trim(),
        description: document.getElementById(`${prefix}-description`).value.trim(),
        startDate: document.getElementById(`${prefix}-start-date`).value,
        endDate: document.getElementById(`${prefix}-end-date`).value || null,
        location: document.getElementById(`${prefix}-location`).value.trim(),
        maxParticipants: parseInt(document.getElementById(`${prefix}-max-participants`).value) || null,
        contactInfo: document.getElementById(`${prefix}-contact`).value.trim()
    };
    
    if (isEsports) {
        return {
            ...baseData,
            game: document.getElementById('tournament-game').value.trim(),
            prize: parseInt(document.getElementById('tournament-prize').value) || null
        };
    } else {
        return {
            ...baseData,
            category: document.getElementById('campus-category').value,
            organizer: document.getElementById('campus-organizer').value.trim()
        };
    }
}

function validateEventData(data) {
    const errors = [];
    
    // Basic validation
    if (!data.title) errors.push('Event title is required');
    if (!data.startDate) errors.push('Start date is required');
    if (!data.contactInfo) errors.push('Contact information is required');
    
    // Type-specific validation
    if (data.eventType === 'esports') {
        if (!data.game) errors.push('Game name is required for tournaments');
    } else {
        if (!data.category) errors.push('Event category is required');
        if (!data.organizer) errors.push('Organizer information is required');
        if (!data.location) errors.push('Location is required for campus events');
    }
    
    // Date validation
    if (data.startDate) {
        const startDate = new Date(data.startDate);
        const now = new Date();
        
        if (startDate <= now) {
            errors.push('Start date must be in the future');
        }
        
        if (data.endDate) {
            const endDate = new Date(data.endDate);
            if (endDate <= startDate) {
                errors.push('End date must be after start date');
            }
        }
    }
    
    // Contact info validation (basic email or phone pattern)
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const phonePattern = /^[\d\s\-\+\(\)]+$/;
    if (!emailPattern.test(data.contactInfo) && !phonePattern.test(data.contactInfo)) {
        errors.push('Please provide a valid email address or phone number');
    }
    
    if (errors.length > 0) {
        showError(errors.join('. '));
        return false;
    }
    
    return true;
}

// UI Helper functions
function setSubmitLoading(loading) {
    submitBtn.disabled = loading;
    submitBtn.classList.toggle('loading', loading);
}

function showSuccess() {
    hideMessages();
    successMessage.style.display = 'block';
    successMessage.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function showError(message) {
    hideMessages();
    errorText.textContent = message;
    errorMessage.style.display = 'block';
    errorMessage.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function hideMessages() {
    successMessage.style.display = 'none';
    errorMessage.style.display = 'none';
}

// Set minimum date to now
function initializeDateFields() {
    const now = new Date();
    // Format for datetime-local input (YYYY-MM-DDTHH:MM)
    const minDateTime = new Date(now.getTime() - now.getTimezoneOffset() * 60000)
        .toISOString()
        .slice(0, 16);
    
    // Set minimum date for all date inputs
    const dateInputs = document.querySelectorAll('input[type="datetime-local"]');
    dateInputs.forEach(input => {
        input.min = minDateTime;
    });
}

// Initialize theme support
function initTheme() {
    const savedTheme = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
}

// Initialize on load
document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 Page loaded, initializing...');
    
    // Check if elements exist
    console.log('Tab buttons found:', tabButtons.length);
    console.log('Form sections found:', formSections.length);
    
    initTheme();
    initializeDateFields();
    
    // Initialize the default active tab to ensure proper form validation
    console.log('Setting default tab to tournament...');
    setActiveTab('tournament');
    
    // Add a global function for debugging
    window.debugTabSwitch = (tabName) => {
        console.log(`🐛 Debug: Switching to ${tabName} tab`);
        setActiveTab(tabName);
        
        // Test campus fields after switch
        if (tabName === 'campus') {
            setTimeout(() => {
                const titleField = document.getElementById('campus-title');
                const categoryField = document.getElementById('campus-category');
                console.log('Campus title field disabled?', titleField?.disabled);
                console.log('Campus category field disabled?', categoryField?.disabled);
                console.log('Campus form section active?', document.getElementById('campus-form')?.classList.contains('active'));
            }, 100);
        }
    };
    
    console.log('✅ Initialization complete. Try: debugTabSwitch("campus") in console');
});
