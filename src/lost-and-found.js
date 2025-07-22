// src/lost-and-found.js
// Lost and Found functionality for After Hours Hub

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { 
    getFirestore, 
    collection, 
    addDoc, 
    onSnapshot, 
    query, 
    orderBy, 
    doc, 
    updateDoc, 
    serverTimestamp,
    getDocs 
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
let currentUser = null;
let currentFilter = 'all';
let allItems = [];

// DOM Elements
const reportForm = document.getElementById('report-form');
const itemsContainer = document.getElementById('items-container');
const filterButtons = document.querySelectorAll('.filter-btn');

// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
    initializeAuth();
    setupEventListeners();
    // loadLostAndFoundItems(); // Now called from testFirestoreConnection()
});

/**
 * Initialize authentication and check user status
 */
function initializeAuth() {
    onAuthStateChanged(auth, (user) => {
        currentUser = user;
        if (!user) {
            // Redirect to login if not authenticated
            window.location.href = 'login.html';
            return;
        }
        console.log('User authenticated:', user.email);
        console.log('User UID:', user.uid);
        
        // Test Firestore connection
        testFirestoreConnection();
    });
}

/**
 * Test Firestore connection and permissions
 */
async function testFirestoreConnection() {
    try {
        console.log('Testing Firestore connection...');
        const testCollection = collection(db, 'lostAndFoundItems');
        
        // Try to get the collection (this will test read permissions)
        const testSnapshot = await getDocs(testCollection);
        console.log('Firestore test successful. Collection exists with', testSnapshot.size, 'documents');
        
        // If collection is empty, let's create a sample document for testing
        if (testSnapshot.size === 0) {
            console.log('Collection is empty. Creating a sample document for testing...');
            await createSampleDocument();
        }
        
        // Now load the actual data
        loadLostAndFoundItems();
    } catch (error) {
        console.error('Firestore connection test failed:', error);
        console.error('Error code:', error.code);
        showErrorState('Unable to connect to database. Please check your internet connection and try refreshing the page.');
    }
}

/**
 * Create a sample document for testing (temporary)
 */
async function createSampleDocument() {
    try {
        const sampleData = {
            itemName: 'Sample Lost Item',
            itemType: 'lost',
            description: 'This is a sample item created for testing. You can delete this after creating your first real report.',
            location: 'Test Location',
            timeSpan: 'Test Time',
            contactInfo: 'test@example.com',
            reportedBy: {
                uid: currentUser.uid,
                email: currentUser.email,
                displayName: currentUser.displayName || 'Test User'
            },
            status: 'open',
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
        };
        
        await addDoc(collection(db, 'lostAndFoundItems'), sampleData);
        console.log('Sample document created successfully');
    } catch (error) {
        console.error('Error creating sample document:', error);
    }
}

/**
 * Setup all event listeners
 */
function setupEventListeners() {
    // Form submission
    reportForm.addEventListener('submit', handleFormSubmission);
    
    // Filter buttons
    filterButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            const filter = e.target.closest('.filter-btn').dataset.filter;
            setActiveFilter(filter);
            applyFilter(filter);
        });
    });
}

/**
 * Handle form submission to report new item
 */
async function handleFormSubmission(e) {
    e.preventDefault();
    
    if (!currentUser) {
        alert('Please log in to report an item.');
        return;
    }

    const formData = new FormData(reportForm);
    const itemData = {
        itemName: formData.get('itemName').trim(),
        itemType: formData.get('itemType'),
        description: formData.get('description').trim(),
        location: formData.get('location').trim(),
        timeSpan: formData.get('timeSpan').trim(),
        contactInfo: formData.get('contactInfo')?.trim() || '',
        reportedBy: {
            uid: currentUser.uid,
            email: currentUser.email,
            displayName: currentUser.displayName || currentUser.email.split('@')[0]
        },
        status: 'open',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
    };

    // Validate required fields
    if (!itemData.itemName || !itemData.itemType || !itemData.description || 
        !itemData.location || !itemData.timeSpan) {
        alert('Please fill in all required fields.');
        return;
    }

    try {
        // Show loading state
        const submitBtn = reportForm.querySelector('.submit-btn');
        const originalText = submitBtn.innerHTML;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Submitting...';
        submitBtn.disabled = true;

        // Add to Firestore
        await addDoc(collection(db, 'lostAndFoundItems'), itemData);
        
        // Reset form and show success
        reportForm.reset();
        showSuccessMessage('Item reported successfully!');
        
        // Restore button state
        submitBtn.innerHTML = originalText;
        submitBtn.disabled = false;
        
    } catch (error) {
        console.error('Error adding item:', error);
        alert('Failed to report item. Please try again.');
        
        // Restore button state
        const submitBtn = reportForm.querySelector('.submit-btn');
        submitBtn.innerHTML = '<i class="fas fa-paper-plane"></i> Submit Report';
        submitBtn.disabled = false;
    }
}

/**
 * Load and listen for real-time updates of lost and found items
 */
function loadLostAndFoundItems() {
    console.log('Attempting to load lost and found items...');
    
    // First try a simple query without ordering to test permissions
    const simpleQuery = collection(db, 'lostAndFoundItems');

    // Real-time listener
    onSnapshot(simpleQuery, (querySnapshot) => {
        allItems = [];
        querySnapshot.forEach((doc) => {
            const data = doc.data();
            allItems.push({
                id: doc.id,
                ...data
            });
        });
        
        // Sort manually to avoid Firestore index issues
        allItems.sort((a, b) => {
            const aTime = a.createdAt?.seconds || 0;
            const bTime = b.createdAt?.seconds || 0;
            return bTime - aTime; // descending order
        });
        
        console.log('Loaded items:', allItems.length);
        applyFilter(currentFilter);
    }, (error) => {
        console.error('Error loading items:', error);
        console.error('Error code:', error.code);
        console.error('Error message:', error.message);
        showErrorState('Failed to load items. Please check your permissions.');
    });
}

/**
 * Apply filter to items and update display
 */
function applyFilter(filter) {
    currentFilter = filter;
    let filteredItems = allItems;

    switch (filter) {
        case 'lost':
            filteredItems = allItems.filter(item => item.itemType === 'lost');
            break;
        case 'found':
            filteredItems = allItems.filter(item => item.itemType === 'found');
            break;
        case 'open':
            filteredItems = allItems.filter(item => item.status === 'open');
            break;
        case 'resolved':
            filteredItems = allItems.filter(item => item.status === 'resolved');
            break;
        case 'all':
        default:
            filteredItems = allItems;
            break;
    }

    displayItems(filteredItems);
}

/**
 * Display items in the grid
 */
function displayItems(items) {
    if (items.length === 0) {
        showEmptyState();
        return;
    }

    const itemsHTML = items.map(item => createItemCard(item)).join('');
    itemsContainer.innerHTML = `<div class="items-grid">${itemsHTML}</div>`;
    
    // Add event listeners to resolve buttons
    addResolveButtonListeners();
}

/**
 * Create HTML for a single item card
 */
function createItemCard(item) {
    const createdDate = item.createdAt ? 
        new Date(item.createdAt.seconds * 1000).toLocaleDateString() : 'Recently';
    
    const isOwner = currentUser && item.reportedBy.uid === currentUser.uid;
    const canResolve = isOwner && item.status === 'open';
    
    return `
        <div class="item-card" data-item-id="${item.id}">
            <div class="item-header">
                <span class="item-type ${item.itemType}">${item.itemType}</span>
                <span class="item-status ${item.status}">${item.status}</span>
            </div>
            
            <h3 class="item-title">${escapeHtml(item.itemName)}</h3>
            <p class="item-description">${escapeHtml(item.description)}</p>
            
            <div class="item-details">
                <div class="item-detail">
                    <i class="fas fa-map-marker-alt"></i>
                    <span>${escapeHtml(item.location)}</span>
                </div>
                <div class="item-detail">
                    <i class="fas fa-clock"></i>
                    <span>${escapeHtml(item.timeSpan)}</span>
                </div>
                <div class="item-detail">
                    <i class="fas fa-calendar"></i>
                    <span>Reported: ${createdDate}</span>
                </div>
                ${item.contactInfo ? `
                <div class="item-detail">
                    <i class="fas fa-phone"></i>
                    <span>${escapeHtml(item.contactInfo)}</span>
                </div>` : ''}
            </div>
            
            <div class="item-actions">
                <div class="reported-by">
                    <i class="fas fa-user"></i> 
                    Reported by: ${escapeHtml(item.reportedBy.displayName)}
                </div>
                ${canResolve ? `
                <button class="resolve-btn" data-item-id="${item.id}">
                    <i class="fas fa-check"></i> Mark Resolved
                </button>` : ''}
            </div>
        </div>
    `;
}

/**
 * Add event listeners to resolve buttons
 */
function addResolveButtonListeners() {
    const resolveButtons = document.querySelectorAll('.resolve-btn');
    resolveButtons.forEach(btn => {
        btn.addEventListener('click', handleResolveItem);
    });
}

/**
 * Handle marking an item as resolved
 */
async function handleResolveItem(e) {
    const itemId = e.target.dataset.itemId;
    const button = e.target;
    
    if (!confirm('Are you sure you want to mark this item as resolved?')) {
        return;
    }
    
    try {
        // Show loading state
        const originalText = button.innerHTML;
        button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Resolving...';
        button.disabled = true;
        
        // Update in Firestore
        const itemRef = doc(db, 'lostAndFoundItems', itemId);
        await updateDoc(itemRef, {
            status: 'resolved',
            resolvedAt: serverTimestamp(),
            updatedAt: serverTimestamp()
        });
        
        showSuccessMessage('Item marked as resolved!');
        
    } catch (error) {
        console.error('Error resolving item:', error);
        alert('Failed to resolve item. Please try again.');
        
        // Restore button state
        button.innerHTML = originalText;
        button.disabled = false;
    }
}

/**
 * Set active filter button
 */
function setActiveFilter(filter) {
    filterButtons.forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.filter === filter) {
            btn.classList.add('active');
        }
    });
}

/**
 * Show empty state when no items match filter
 */
function showEmptyState() {
    const emptyMessages = {
        all: 'No items reported yet. Be the first to report a lost or found item!',
        lost: 'No lost items reported currently.',
        found: 'No found items reported currently.',
        open: 'No open cases at the moment.',
        resolved: 'No resolved cases yet.'
    };
    
    const message = emptyMessages[currentFilter] || emptyMessages.all;
    
    itemsContainer.innerHTML = `
        <div class="empty-state">
            <i class="fas fa-search"></i>
            <h3>Nothing Here Yet</h3>
            <p>${message}</p>
        </div>
    `;
}

/**
 * Show error state
 */
function showErrorState(message) {
    itemsContainer.innerHTML = `
        <div class="empty-state">
            <i class="fas fa-exclamation-triangle"></i>
            <h3>Error Loading Items</h3>
            <p>${message}</p>
        </div>
    `;
}

/**
 * Show success message
 */
function showSuccessMessage(message) {
    // Create and show a temporary success message
    const successDiv = document.createElement('div');
    successDiv.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: var(--success-color);
        color: #000;
        padding: 15px 25px;
        border-radius: 12px;
        font-weight: 600;
        z-index: 1000;
        box-shadow: 0 10px 30px rgba(0, 206, 201, 0.3);
        animation: slideInRight 0.3s ease forwards;
    `;
    successDiv.innerHTML = `<i class="fas fa-check-circle"></i> ${message}`;
    
    document.body.appendChild(successDiv);
    
    // Add animation styles if not already present
    if (!document.getElementById('success-animation-styles')) {
        const style = document.createElement('style');
        style.id = 'success-animation-styles';
        style.textContent = `
            @keyframes slideInRight {
                from { transform: translateX(100%); opacity: 0; }
                to { transform: translateX(0); opacity: 1; }
            }
            @keyframes slideOutRight {
                from { transform: translateX(0); opacity: 1; }
                to { transform: translateX(100%); opacity: 0; }
            }
        `;
        document.head.appendChild(style);
    }
    
    // Remove after 3 seconds
    setTimeout(() => {
        successDiv.style.animation = 'slideOutRight 0.3s ease forwards';
        setTimeout(() => {
            if (successDiv.parentNode) {
                successDiv.parentNode.removeChild(successDiv);
            }
        }, 300);
    }, 3000);
}

/**
 * Escape HTML to prevent XSS attacks
 */
function escapeHtml(text) {
    if (!text) return '';
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, (m) => map[m]);
}

/**
 * Enhanced error handling for network issues
 */
window.addEventListener('online', () => {
    console.log('Network connection restored');
    if (allItems.length === 0) {
        loadLostAndFoundItems();
    }
});

window.addEventListener('offline', () => {
    console.log('Network connection lost');
    showErrorState('You are currently offline. Please check your internet connection.');
});

// Export functions for potential testing or external access
export {
    loadLostAndFoundItems,
    applyFilter,
    handleResolveItem
};
