// src/chats-page.js
// Chat inbox page functionality

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { firebaseConfig } from './firebase-config.js';
import { getUserChats, listenToUserChats } from './chat-system.js';

// Import notification system
import './notification-system.js';

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

// DOM elements
const chatsLoading = document.getElementById('chats-loading');
const chatsList = document.getElementById('chats-list');
const emptyState = document.getElementById('empty-state');

let currentUser = null;
let chatsListener = null;

// Authentication state handler
onAuthStateChanged(auth, (user) => {
    if (user) {
        currentUser = user;
        loadUserChats();
    } else {
        // Redirect to login if not authenticated
        window.location.href = 'login.html';
    }
});

/**
 * Load and display user's chats
 */
function loadUserChats() {
    // Show loading state
    chatsLoading.style.display = 'flex';
    chatsList.style.display = 'none';
    emptyState.style.display = 'none';

    // Clean up existing listener
    if (chatsListener) {
        chatsListener();
    }

    // Set up real-time listener for chats
    chatsListener = listenToUserChats((chats) => {
        // Hide loading
        chatsLoading.style.display = 'none';

        if (chats.length === 0) {
            // Show empty state
            emptyState.style.display = 'block';
            chatsList.style.display = 'none';
        } else {
            // Show chats list
            emptyState.style.display = 'none';
            chatsList.style.display = 'flex';
            renderChats(chats);
        }
    });
}

/**
 * Render the list of chats
 * @param {Array} chats - Array of chat objects
 */
function renderChats(chats) {
    chatsList.textContent = '';

    chats.forEach(chat => {
        const chatElement = createChatElement(chat);
        chatsList.appendChild(chatElement);
    });
}

/**
 * Create a chat element
 * @param {Object} chat - Chat object
 * @returns {HTMLElement} Chat element
 */
function createChatElement(chat) {
    const currentUserUid = auth.currentUser.uid;
    
    // Get the other participant's info
    const otherParticipant = chat.participants.find(uid => uid !== currentUserUid);
    const otherUserInfo = chat.participantInfo[otherParticipant] || {
        name: 'Unknown User',
        avatar: null
    };

    // Format the last message timestamp
    const lastMessageTime = chat.lastMessage?.timestamp?.toDate?.() || chat.updatedAt?.toDate?.() || new Date();
    const timeString = formatRelativeTime(lastMessageTime);

    // Create chat element
    const chatElement = document.createElement('div');
    chatElement.className = 'chat-item';
    chatElement.onclick = () => openChat(chat.id, chat);

    // Avatar
    const avatarDiv = document.createElement('div');
    avatarDiv.className = 'chat-avatar';
    if (otherUserInfo.avatar) {
        const img = document.createElement('img');
        img.src = otherUserInfo.avatar;
        img.alt = otherUserInfo.name;
        avatarDiv.appendChild(img);
    } else {
        const placeholder = document.createElement('div');
        placeholder.className = 'avatar-placeholder';
        placeholder.textContent = otherUserInfo.name.charAt(0).toUpperCase();
        avatarDiv.appendChild(placeholder);
    }
    chatElement.appendChild(avatarDiv);
    // Info
    const infoDiv = document.createElement('div');
    infoDiv.className = 'chat-info';
    const nameDiv = document.createElement('div');
    nameDiv.className = 'chat-name';
    nameDiv.textContent = otherUserInfo.name;
    infoDiv.appendChild(nameDiv);
    const lastMsgDiv = document.createElement('div');
    lastMsgDiv.className = 'chat-last-message';
    lastMsgDiv.textContent = chat.lastMessage?.text || '';
    infoDiv.appendChild(lastMsgDiv);
    chatElement.appendChild(infoDiv);
    // Meta
    const metaDiv = document.createElement('div');
    metaDiv.className = 'chat-meta';
    const timeSpan = document.createElement('span');
    timeSpan.className = 'chat-time';
    timeSpan.textContent = timeString;
    metaDiv.appendChild(timeSpan);
    if (chat.unreadCount) {
        const unreadSpan = document.createElement('span');
        unreadSpan.className = 'chat-unread';
        unreadSpan.textContent = chat.unreadCount;
        metaDiv.appendChild(unreadSpan);
    }
    chatElement.appendChild(metaDiv);

    return chatElement;
}

/**
 * Open a chat (reuse the modal from chat-system.js)
 * @param {string} chatId - Chat ID
 * @param {Object} chatData - Chat data
 */
function openChat(chatId, chatData) {
    // Import the chat modal function dynamically
    import('./chat-system.js').then(module => {
        // We need to create a temporary initiateChat call to open the existing chat
        // This is a bit of a workaround since the chat system is designed for new chats
        // In a production app, you'd have a dedicated openExistingChat function
        
        // For now, we'll trigger the chat by simulating the initiate process
        const otherParticipant = chatData.participants.find(uid => uid !== auth.currentUser.uid);
        module.initiateChat(otherParticipant, chatData.itemId, chatData.itemTitle, chatData.itemType || 'market');
    });
}

/**
 * Format relative time (e.g., "2 hours ago", "Yesterday")
 * @param {Date} date - Date to format
 * @returns {string} Formatted time string
 */
function formatRelativeTime(date) {
    const now = new Date();
    const diffInMs = now - date;
    const diffInMinutes = Math.floor(diffInMs / (1000 * 60));
    const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60));
    const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));

    if (diffInMinutes < 1) {
        return 'Just now';
    } else if (diffInMinutes < 60) {
        return `${diffInMinutes}m ago`;
    } else if (diffInHours < 24) {
        return `${diffInHours}h ago`;
    } else if (diffInDays === 1) {
        return 'Yesterday';
    } else if (diffInDays < 7) {
        return `${diffInDays}d ago`;
    } else {
        return date.toLocaleDateString();
    }
}

// Cleanup listeners when page unloads
window.addEventListener('beforeunload', () => {
    if (chatsListener) {
        chatsListener();
    }
});
