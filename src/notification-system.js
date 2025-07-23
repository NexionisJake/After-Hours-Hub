// src/notification-system.js
// Real-time Notification System for After Hours Hub

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { 
    getFirestore, 
    collection, 
    query, 
    where, 
    orderBy, 
    onSnapshot, 
    getDocs, 
    writeBatch,
    limit
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { firebaseConfig } from './firebase-config.js';

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Notification system state
let notificationListener = null;
let notificationPanel = null;
let bellIcon = null;
let notificationBadge = null;

/**
 * Initialize the notification system
 */
export function initializeNotificationSystem() {
    // Wait for DOM to be ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', setupNotificationElements);
    } else {
        setupNotificationElements();
    }
    
    // Listen for auth state changes
    onAuthStateChanged(auth, (user) => {
        if (user) {
            startNotificationListener(user.uid);
        } else {
            stopNotificationListener();
            clearNotificationUI();
        }
    });
}

/**
 * Set up notification UI elements
 */
function setupNotificationElements() {
    bellIcon = document.querySelector('.notification-bell');
    notificationBadge = document.querySelector('.notification-badge');
    
    if (bellIcon) {
        // Add click event listener to bell icon
        bellIcon.addEventListener('click', toggleNotificationPanel);
        bellIcon.style.cursor = 'pointer';
        
        // Create notification panel if it doesn't exist
        createNotificationPanel();
    }
}

/**
 * Start listening for unread notifications
 * @param {string} userId - The user's UID
 */
function startNotificationListener(userId) {
    if (notificationListener) {
        notificationListener(); // Unsubscribe existing listener
    }
    
    const notificationsRef = collection(db, "notifications");
    const q = query(
        notificationsRef,
        where("recipientId", "==", userId),
        where("isRead", "==", false),
        orderBy("createdAt", "desc")
    );

    notificationListener = onSnapshot(q, (snapshot) => {
        const unreadCount = snapshot.size;
        updateNotificationBadge(unreadCount);
        console.log(`Found ${unreadCount} unread notifications`);
    }, (error) => {
        console.warn('Notifications not available yet:', error.message);
        // Don't show error to user, just hide the notification badge
        updateNotificationBadge(0);
    });
}

/**
 * Stop the notification listener
 */
function stopNotificationListener() {
    if (notificationListener) {
        notificationListener();
        notificationListener = null;
    }
}

/**
 * Update the notification badge
 * @param {number} count - Number of unread notifications
 */
function updateNotificationBadge(count) {
    if (!notificationBadge) return;
    
    if (count > 0) {
        notificationBadge.textContent = count > 9 ? '9+' : count.toString();
        notificationBadge.style.display = 'block';
        bellIcon?.classList.add('has-unread');
    } else {
        notificationBadge.style.display = 'none';
        bellIcon?.classList.remove('has-unread');
    }
}

/**
 * Clear notification UI
 */
function clearNotificationUI() {
    updateNotificationBadge(0);
}

/**
 * Create the notification panel
 */
function createNotificationPanel() {
    // Remove existing panel if it exists
    const existingPanel = document.getElementById('notification-panel');
    if (existingPanel) {
        existingPanel.remove();
    }
    
    const panelHtml = `
        <div id="notification-panel" class="notification-panel hidden">
            <div class="notification-header">
                <h3>Notifications</h3>
                <button id="mark-all-read-btn" class="mark-all-read-btn">Mark All Read</button>
            </div>
            <div id="notification-list" class="notification-list">
                <div class="notification-loading">Loading...</div>
            </div>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', panelHtml);
    notificationPanel = document.getElementById('notification-panel');
    
    // Add event listeners
    document.getElementById('mark-all-read-btn').addEventListener('click', markAllNotificationsAsRead);
    
    // Close panel when clicking outside
    document.addEventListener('click', (e) => {
        if (notificationPanel && !notificationPanel.contains(e.target) && !bellIcon?.contains(e.target)) {
            hideNotificationPanel();
        }
    });
}

/**
 * Toggle notification panel visibility
 */
async function toggleNotificationPanel() {
    if (!notificationPanel) return;
    
    if (notificationPanel.classList.contains('hidden')) {
        await showNotificationPanel();
    } else {
        hideNotificationPanel();
    }
}

/**
 * Show notification panel and load notifications
 */
async function showNotificationPanel() {
    if (!notificationPanel || !auth.currentUser) return;
    
    notificationPanel.classList.remove('hidden');
    
    // Position the panel near the bell icon
    if (bellIcon) {
        const rect = bellIcon.getBoundingClientRect();
        notificationPanel.style.position = 'absolute';
        notificationPanel.style.top = `${rect.bottom + 10}px`;
        notificationPanel.style.right = '20px';
    }
    
    await loadNotifications();
}

/**
 * Hide notification panel
 */
function hideNotificationPanel() {
    if (notificationPanel) {
        notificationPanel.classList.add('hidden');
    }
}

/**
 * Load and display notifications
 */
async function loadNotifications() {
    const userId = auth.currentUser?.uid;
    if (!userId) return;
    
    const notificationList = document.getElementById('notification-list');
    notificationList.textContent = '';
    const loadingDiv = document.createElement('div');
    loadingDiv.className = 'notification-loading';
    loadingDiv.textContent = 'Loading...';
    notificationList.appendChild(loadingDiv);
    
    try {
        const notificationsRef = collection(db, "notifications");
        const q = query(
            notificationsRef,
            where("recipientId", "==", userId),
            orderBy("createdAt", "desc"),
            limit(10)
        );
        
        const snapshot = await getDocs(q);
        notificationList.textContent = '';
        
        const notificationsToMarkAsRead = [];
        
        if (snapshot.empty) {
            const noDiv = document.createElement('div');
            noDiv.className = 'no-notifications';
            const p = document.createElement('p');
            p.textContent = 'No notifications yet';
            const small = document.createElement('small');
            small.textContent = "You'll see notifications here when someone sends you messages";
            noDiv.appendChild(p);
            noDiv.appendChild(small);
            notificationList.appendChild(noDiv);
            return;
        }
        
        snapshot.forEach(doc => {
            const notification = doc.data();
            const notificationEl = createNotificationElement(notification);
            notificationList.appendChild(notificationEl);
            
            // Collect unread notifications to mark as read
            if (!notification.isRead) {
                notificationsToMarkAsRead.push(doc.ref);
            }
        });
        
        // Mark displayed notifications as read
        if (notificationsToMarkAsRead.length > 0) {
            const batch = writeBatch(db);
            notificationsToMarkAsRead.forEach(ref => {
                batch.update(ref, { isRead: true });
            });
            await batch.commit();
        }
        
    } catch (error) {
        console.warn('Could not load notifications:', error.message);
        notificationList.textContent = '';
        const noDiv = document.createElement('div');
        noDiv.className = 'no-notifications';
        const p = document.createElement('p');
        p.textContent = 'Notifications not available';
        const small = document.createElement('small');
        small.textContent = 'The notification system is being set up';
        noDiv.appendChild(p);
        noDiv.appendChild(small);
        notificationList.appendChild(noDiv);
    }
}

/**
 * Create a notification element
 * @param {Object} notification - The notification data
 * @returns {HTMLElement} The notification element
 */
function createNotificationElement(notification) {
    const notificationEl = document.createElement('div');
    notificationEl.className = `notification-item ${notification.isRead ? 'read' : 'unread'}`;
    
    // Format timestamp
    const timestamp = notification.createdAt?.toDate?.() || new Date();
    const timeString = formatRelativeTime(timestamp);
    
    // Build notification content safely
    const contentDiv = document.createElement('div');
    contentDiv.className = 'notification-content';
    const iconDiv = document.createElement('div');
    iconDiv.className = 'notification-icon';
    const icon = document.createElement('i');
    
    // Set icon based on notification type
    if (notification.type === 'event_approval') {
        icon.className = 'ph-fill ph-check-circle';
        icon.style.color = '#22c55e'; // Green for approval
    } else if (notification.type === 'event_rejection') {
        icon.className = 'ph-fill ph-x-circle';
        icon.style.color = '#ef4444'; // Red for rejection
    } else {
        icon.className = 'ph-fill ph-chat-circle';
    }
    
    iconDiv.appendChild(icon);
    contentDiv.appendChild(iconDiv);
    
    const textDiv = document.createElement('div');
    textDiv.className = 'notification-text';
    const messageP = document.createElement('p');
    messageP.className = 'notification-message';
    
    // Handle different notification types
    if (notification.type === 'event_approval' || notification.type === 'event_rejection') {
        // Event approval/rejection notifications
        const titleStrong = document.createElement('strong');
        titleStrong.textContent = notification.title || 'Event Update';
        messageP.appendChild(titleStrong);
        
        if (notification.message) {
            messageP.appendChild(document.createElement('br'));
            const messageSpan = document.createElement('span');
            messageSpan.textContent = notification.message;
            messageSpan.style.fontSize = '0.9em';
            messageSpan.style.opacity = '0.9';
            messageP.appendChild(messageSpan);
        }
    } else {
        // Chat notifications (existing behavior)
        const strong = document.createElement('strong');
        strong.textContent = notification.senderName || 'Someone';
        messageP.appendChild(strong);
        messageP.appendChild(document.createTextNode(' sent you a message about '));
        const itemSpan = document.createElement('span');
        itemSpan.className = 'item-title';
        itemSpan.textContent = `"${notification.relatedItemTitle || 'an item'}"`;
        messageP.appendChild(itemSpan);
    }
    
    textDiv.appendChild(messageP);
    const timeP = document.createElement('p');
    timeP.className = 'notification-time';
    timeP.textContent = timeString;
    textDiv.appendChild(timeP);
    contentDiv.appendChild(textDiv);
    notificationEl.appendChild(contentDiv);
    
    // Add click handler based on notification type
    notificationEl.addEventListener('click', () => {
        if (notification.type === 'event_approval' || notification.type === 'event_rejection') {
            // For event notifications, redirect to events page
            window.location.href = 'esports-and-events.html';
        } else if (notification.chatId) {
            // For chat notifications, navigate to chat
            window.location.href = `chats.html?chatId=${notification.chatId}`;
        }
        hideNotificationPanel();
    });
    
    return notificationEl;
}

/**
 * Mark all notifications as read
 */
async function markAllNotificationsAsRead() {
    const userId = auth.currentUser?.uid;
    if (!userId) return;
    
    try {
        const notificationsRef = collection(db, "notifications");
        const q = query(
            notificationsRef,
            where("recipientId", "==", userId),
            where("isRead", "==", false)
        );
        
        const snapshot = await getDocs(q);
        
        if (!snapshot.empty) {
            const batch = writeBatch(db);
            snapshot.forEach(doc => {
                batch.update(doc.ref, { isRead: true });
            });
            await batch.commit();
        }
        
        // Refresh the panel
        await loadNotifications();
        
    } catch (error) {
        console.warn('Could not mark notifications as read:', error.message);
    }
}

/**
 * Format relative time
 * @param {Date} date - The date to format
 * @returns {string} Formatted relative time string
 */
function formatRelativeTime(date) {
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    
    if (diffMins < 1) {
        return 'Just now';
    } else if (diffMins < 60) {
        return `${diffMins} minute${diffMins !== 1 ? 's' : ''} ago`;
    } else if (diffHours < 24) {
        return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
    } else if (diffDays < 7) {
        return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;
    } else {
        return date.toLocaleDateString();
    }
}

// Auto-initialize when module is loaded
initializeNotificationSystem();

// Export functions for external use
export { 
    startNotificationListener, 
    stopNotificationListener, 
    updateNotificationBadge 
};
