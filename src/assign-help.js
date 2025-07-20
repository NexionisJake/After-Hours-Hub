import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore, collection, addDoc, query, orderBy, onSnapshot, serverTimestamp, doc, updateDoc, where, getDocs } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { firebaseConfig } from './firebase-config.js';

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Get references to DOM elements with safety checks
const newRequestForm = document.getElementById('new-request-form');
const requestsContainer = document.getElementById('requests-container');
const submitButton = newRequestForm?.querySelector('.btn-submit');
const loadingSpinner = submitButton?.querySelector('.loading-spinner');
const buttonText = submitButton?.querySelector('i');
const successMessage = document.getElementById('success-message');
const errorMessage = document.getElementById('error-message');

let currentUser = null;
let currentChatRequestId = null;
let currentChatRequestData = null;
let chatMessagesListener = null;
let requestsData = new Map(); // Store all request data for easy access
let userConversations = new Map(); // Store user's active conversations
let lastReadMessages = new Map(); // Track last read message for each conversation
let overlayMessagesListeners = new Map(); // Store message listeners for overlay
let requestsListener = null; // Main requests listener
let mutationObserver = null; // DOM mutation observer

// Security and utility functions
function sanitizeText(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text.toString();
    return div.innerHTML;
}

function validatePaymentAmount(amount) {
    if (amount === null || amount === undefined || amount === '') return true; // Optional field
    const numAmount = parseFloat(amount);
    return !isNaN(numAmount) && numAmount >= 0 && numAmount <= 100000; // Reasonable limits
}

function validateInput(text, maxLength = 500) {
    if (!text || typeof text !== 'string') return false;
    return text.trim().length > 0 && text.length <= maxLength;
}

// Cleanup functions
function cleanupAllListeners() {
    console.log('Cleaning up Firebase listeners...');
    
    if (chatMessagesListener) {
        chatMessagesListener();
        chatMessagesListener = null;
    }
    
    if (requestsListener) {
        requestsListener();
        requestsListener = null;
    }
    
    overlayMessagesListeners.forEach((unsubscribe, key) => {
        if (typeof unsubscribe === 'function') {
            unsubscribe();
        }
    });
    overlayMessagesListeners.clear();
    
    if (mutationObserver) {
        mutationObserver.disconnect();
        mutationObserver = null;
    }
}

// Add cleanup on page unload and visibility change
window.addEventListener('beforeunload', cleanupAllListeners);
window.addEventListener('pagehide', cleanupAllListeners);

// Handle tab visibility changes
document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
        // Page is hidden, potentially clean up some listeners to save resources
        console.log('Page hidden, listeners remain active for notifications');
    } else {
        // Page is visible again, ensure listeners are active
        if (currentUser && !requestsListener) {
            loadRequests(); // Reload if needed
        }
    }
});

// Utility functions for better UX
function showMessage(element, duration = 3000) {
    if (element) {
        element.style.display = 'flex';
        setTimeout(() => {
            if (element) {
                element.style.display = 'none';
            }
        }, duration);
    }
}

function setSubmitButtonLoading(loading) {
    if (!submitButton) return;
    
    if (loading) {
        submitButton.disabled = true;
        if (loadingSpinner) loadingSpinner.style.display = 'inline-block';
        if (buttonText) buttonText.style.display = 'none';
        submitButton.innerHTML = '<span class="loading-spinner"></span> Posting...';
    } else {
        submitButton.disabled = false;
        if (loadingSpinner) loadingSpinner.style.display = 'none';
        if (buttonText) buttonText.style.display = 'inline-block';
        submitButton.innerHTML = '<i class="ph-bold ph-paper-plane-right"></i> Post Request';
    }
}

// Helper function to safely set error messages
function setErrorMessage(text) {
    if (errorMessage && errorMessage.querySelector('span')) {
        errorMessage.querySelector('span').textContent = text;
        showMessage(errorMessage);
    } else {
        console.error('Error message element not found:', text);
    }
}

function createEmptyState() {
    return `
        <div class="empty-state">
            <i class="ph-bold ph-chat-circle"></i>
            <p>No help requests yet. Be the first to ask for help!</p>
        </div>
    `;
}

function formatTimeAgo(date) {
    const now = new Date();
    const diffInSeconds = Math.floor((now - date) / 1000);
    
    if (diffInSeconds < 60) return 'Just now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} minutes ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} hours ago`;
    return date.toLocaleDateString();
}

function formatDueDate(dueDate) {
    const now = new Date();
    const due = new Date(dueDate);
    const diffInHours = Math.floor((due - now) / (1000 * 60 * 60));
    
    if (diffInHours < 0) return 'Overdue';
    if (diffInHours < 24) return `Due in ${diffInHours}h`;
    if (diffInHours < 168) return `Due in ${Math.floor(diffInHours / 24)}d`;
    
    return due.toLocaleDateString();
}

function isDueUrgent(dueDate) {
    const now = new Date();
    const due = new Date(dueDate);
    const diffInHours = (due - now) / (1000 * 60 * 60);
    return diffInHours <= 24 && diffInHours > 0; // Due within 24 hours
}

function isOverdue(dueDate) {
    const now = new Date();
    const due = new Date(dueDate);
    return due < now;
}

function createBadges(request) {
    let badgesHTML = '<div class="request-badges">';
    
    // Payment badge
    if (request.paymentAmount && request.paymentAmount > 0) {
        badgesHTML += `<span class="badge badge-payment"><i class="ph-bold ph-currency-inr"></i>₹${request.paymentAmount}</span>`;
    }
    
    // Due date badge
    if (request.dueDate) {
        const dueDate = request.dueDate.toDate ? request.dueDate.toDate() : new Date(request.dueDate);
        const urgentClass = isDueUrgent(dueDate) ? 'urgent' : '';
        const overdueClass = isOverdue(dueDate) ? 'urgent' : '';
        badgesHTML += `<span class="badge badge-due ${urgentClass}${overdueClass}"><i class="ph-bold ph-clock"></i>${formatDueDate(dueDate)}</span>`;
    }
    
    // Completion status badge
    if (request.isCompleted) {
        badgesHTML += `<span class="badge badge-completed"><i class="ph-bold ph-check-circle"></i>Completed</span>`;
    } else {
        badgesHTML += `<span class="badge badge-open"><i class="ph-bold ph-circle"></i>Open</span>`;
    }
    
    badgesHTML += '</div>';
    return badgesHTML;
}

async function toggleCompletion(docId, currentStatus) {
    if (!currentUser || !docId) {
        console.error('Invalid parameters for toggle completion');
        return;
    }
    
    try {
        await updateDoc(doc(db, "assignmentRequests", docId), {
            isCompleted: !currentStatus,
            lastUpdated: serverTimestamp()
        });
        console.log('Completion status updated successfully');
    } catch (error) {
        console.error('Error updating completion status:', error);
        showMessage(errorMessage);
        errorMessage.querySelector('span').textContent = "Failed to update status. Please try again.";
    }
}

// Chat-related functions
async function openChatModal(requestId, requestData) {
    currentChatRequestId = requestId;
    currentChatRequestData = requestData;
    
    const modal = document.getElementById('chat-modal');
    const chatTitle = document.getElementById('chat-request-title');
    const chatParticipants = document.getElementById('chat-participants');
    
    // Safety check for missing elements
    if (!modal) {
        console.error('Chat modal element not found');
        return;
    }
    
    if (chatTitle) {
        chatTitle.textContent = requestData.title || 'Assignment Discussion';
    }
    
    // Determine other participant
    const isAuthor = currentUser.uid === requestData.authorId;
    const otherParticipant = isAuthor ? 'Interested Helpers' : requestData.authorName;
    
    if (chatParticipants) {
        chatParticipants.textContent = `Chat with ${otherParticipant}`;
    }
    
    // Show negotiation controls only for non-authors (helpers) - if elements exist
    const negotiateBtn = document.querySelector('.btn-negotiate-price');
    const currentOfferSpan = document.getElementById('current-offer');
    
    if (negotiateBtn && currentOfferSpan) {
        if (!isAuthor && requestData.paymentAmount) {
            negotiateBtn.style.display = 'flex';
            currentOfferSpan.textContent = requestData.paymentAmount;
        } else {
            negotiateBtn.style.display = 'none';
        }
    }
    
    modal.style.display = 'block';
    
    // Load existing messages
    await loadChatMessages(requestId);
}

function closeChatModal() {
    const modal = document.getElementById('chat-modal');
    if (modal) {
        modal.style.display = 'none';
    }
    
    // Clean up listener
    if (chatMessagesListener) {
        chatMessagesListener();
        chatMessagesListener = null;
    }
    
    // Mark conversation as read when closing
    if (currentChatRequestId) {
        markConversationAsRead(currentChatRequestId);
    }
    
    currentChatRequestId = null;
    currentChatRequestData = null;
    
    // Hide price negotiation if showing
    cancelNegotiation();
}

async function loadChatMessages(requestId) {
    const chatMessages = document.getElementById('chat-messages');
    chatMessages.innerHTML = '<div class="chat-loading"><div class="loading-spinner"></div><p>Loading conversation...</p></div>';
    
    try {
        // Create a query for messages related to this request
        const messagesQuery = query(
            collection(db, "chatMessages"),
            where("requestId", "==", requestId),
            orderBy("timestamp", "asc")
        );
        
        // Set up real-time listener
        chatMessagesListener = onSnapshot(messagesQuery, (snapshot) => {
            chatMessages.innerHTML = '';
            
            if (snapshot.empty) {
                chatMessages.innerHTML = `
                    <div style="text-align: center; color: var(--text-secondary); padding: 2rem;">
                        <i class="ph-bold ph-chat-circle" style="font-size: 2rem; margin-bottom: 0.5rem; opacity: 0.5;"></i>
                        <p>No messages yet. Start the conversation!</p>
                    </div>
                `;
                return;
            }
            
            snapshot.forEach((doc) => {
                const message = doc.data();
                const messageEl = createMessageElement(message);
                chatMessages.appendChild(messageEl);
            });
            
            // Scroll to bottom
            chatMessages.scrollTop = chatMessages.scrollHeight;
        });
        
    } catch (error) {
        console.error('Error loading messages:', error);
        chatMessages.innerHTML = `
            <div style="text-align: center; color: #ff6b6b; padding: 2rem;">
                <p>Failed to load messages. Please try again.</p>
            </div>
        `;
    }
}

function createMessageElement(message) {
    const messageEl = document.createElement('div');
    const isCurrentUser = message.senderId === currentUser.uid;
    const messageClass = isCurrentUser ? 'sent' : 'received';
    
    messageEl.className = `message ${messageClass}`;
    
    if (message.isNegotiation) {
        messageEl.classList.add('negotiation-message');
    }
    
    const timestamp = message.timestamp ? message.timestamp.toDate() : new Date();
    const timeStr = timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
    let contentHTML = '';
    
    if (message.isNegotiation) {
        const sanitizedPrice = parseFloat(message.negotiatedPrice) || 0;
        contentHTML = `
            <div class="negotiation-content">
                <i class="ph-bold ph-handshake"></i>
                Price negotiation: ₹${sanitizedPrice}
            </div>
        `;
    } else {
        const sanitizedContent = sanitizeText(message.content || '');
        contentHTML = `<div class="message-content">${sanitizedContent}</div>`;
    }
    
    const sanitizedSenderName = sanitizeText(message.senderName || 'Anonymous User');
    const safeSenderPhoto = message.senderPhoto || 'https://via.placeholder.com/20';
    
    messageEl.innerHTML = `
        ${!isCurrentUser ? `
            <div class="message-header">
                <img src="${safeSenderPhoto}" alt="${sanitizedSenderName}" onerror="this.src='https://via.placeholder.com/20'">
                <span>${sanitizedSenderName}</span>
            </div>
        ` : ''}
        ${contentHTML}
        <div class="message-time">${timeStr}</div>
    `;
    
    return messageEl;
}

async function sendMessage() {
    const chatInput = document.getElementById('chat-input');
    const content = chatInput.value.trim();
    
    if (!content || !currentChatRequestId || !currentUser) {
        return;
    }
    
    // Validate input
    if (!validateInput(content, 1000)) {
        showMessage(errorMessage);
        errorMessage.querySelector('span').textContent = "Message is too long or contains invalid characters.";
        return;
    }
    
    // Sanitize content before storing
    const sanitizedContent = content; // Store original for Firebase, sanitize on display
    
    try {
        await addDoc(collection(db, "chatMessages"), {
            requestId: currentChatRequestId,
            senderId: currentUser.uid,
            senderName: sanitizeText(currentUser.displayName) || 'Anonymous User',
            senderPhoto: currentUser.photoURL || 'https://via.placeholder.com/40',
            content: sanitizedContent,
            isNegotiation: false,
            timestamp: serverTimestamp(),
            supervisorVisible: true
        });
        
        chatInput.value = '';
        
    } catch (error) {
        console.error('Error sending message:', error);
        showMessage(errorMessage);
        errorMessage.querySelector('span').textContent = "Failed to send message. Please try again.";
    }
}

function showPriceNegotiation() {
    const negotiationSection = document.getElementById('price-negotiation');
    const negotiatedPriceInput = document.getElementById('negotiated-price');
    
    negotiationSection.style.display = 'block';
    negotiatedPriceInput.focus();
}

function cancelNegotiation() {
    const negotiationSection = document.getElementById('price-negotiation');
    const negotiatedPriceInput = document.getElementById('negotiated-price');
    
    negotiationSection.style.display = 'none';
    negotiatedPriceInput.value = '';
}

async function sendNegotiation() {
    const negotiatedPriceInput = document.getElementById('negotiated-price');
    const negotiatedPrice = parseFloat(negotiatedPriceInput.value);
    
    if (!currentChatRequestId || !currentUser) {
        showMessage(errorMessage);
        errorMessage.querySelector('span').textContent = "Unable to send negotiation. Please try again.";
        return;
    }
    
    if (!validatePaymentAmount(negotiatedPrice) || negotiatedPrice <= 0) {
        showMessage(errorMessage);
        errorMessage.querySelector('span').textContent = "Please enter a valid price amount (₹1 - ₹100,000).";
        return;
    }
    
    try {
        await addDoc(collection(db, "chatMessages"), {
            requestId: currentChatRequestId,
            senderId: currentUser.uid,
            senderName: sanitizeText(currentUser.displayName) || 'Anonymous User',
            senderPhoto: currentUser.photoURL || 'https://via.placeholder.com/40',
            content: `Proposed new price: ₹${negotiatedPrice}`,
            isNegotiation: true,
            negotiatedPrice: negotiatedPrice,
            timestamp: serverTimestamp(),
            supervisorVisible: true
        });
        
        cancelNegotiation();
        
    } catch (error) {
        console.error('Error sending negotiation:', error);
        showMessage(errorMessage);
        errorMessage.querySelector('span').textContent = "Failed to send price negotiation. Please try again.";
    }
}

// Chat Overlay Functions
function initializeChatOverlay() {
    if (!currentUser) return;
    
    const overlay = document.getElementById('chat-overlay');
    overlay.style.display = 'block';
    
    // Load user's conversations
    loadUserConversations();
}

function toggleChatOverlay() {
    const overlay = document.getElementById('chat-overlay');
    const arrow = document.getElementById('chat-overlay-arrow');
    
    overlay.classList.toggle('expanded');
}

async function loadUserConversations() {
    if (!currentUser) return;
    
    console.log('🔄 Loading user conversations for:', currentUser.email);
    
    // Clean up existing listeners first
    overlayMessagesListeners.forEach((unsubscribe, key) => {
        if (typeof unsubscribe === 'function') {
            unsubscribe();
        }
    });
    overlayMessagesListeners.clear();
    
    try {
        // Query for requests where user is the author (to get incoming messages)
        const userRequestsQuery = query(
            collection(db, "assignmentRequests"),
            where("authorId", "==", currentUser.uid)
        );
        
        // Get user's requests to track conversations on their posts
        const requestsSnapshot = await getDocs(userRequestsQuery);
        const userRequestIds = [];
        requestsSnapshot.forEach(doc => {
            userRequestIds.push(doc.id);
        });
        
        console.log(`📝 Found ${userRequestIds.length} user requests to monitor`);
        
        // Listen for messages on user's requests - OPTIMIZED WITH INDEX
        userRequestIds.forEach(requestId => {
            const messagesQuery = query(
                collection(db, "chatMessages"),
                where("requestId", "==", requestId),
                orderBy("timestamp", "desc")  // ✅ Using Firebase index for optimal performance
            );
            
            const unsubscribe = onSnapshot(messagesQuery, (snapshot) => {
                updateConversationFromMessages(requestId, snapshot);
            }, (error) => {
                console.error(`❌ Error listening to messages for request ${requestId}:`, error);
                console.log('💡 If you see index errors, create the composite index in Firebase Console');
            });
            
            overlayMessagesListeners.set(requestId, unsubscribe);
        });
        
        // Listen for user's own messages (as helper) - OPTIMIZED WITH INDEX
        const userSentQuery = query(
            collection(db, "chatMessages"),
            where("senderId", "==", currentUser.uid),
            orderBy("timestamp", "desc")  // ✅ Using Firebase index for optimal performance
        );
        
        const userSentUnsubscribe = onSnapshot(userSentQuery, (snapshot) => {
            const requestIds = new Set();
            snapshot.forEach(doc => {
                const message = doc.data();
                requestIds.add(message.requestId);
            });
            
            console.log(`💬 User has messaged ${requestIds.size} different requests`);
            
            // Load conversations for requests user has messaged
            requestIds.forEach(requestId => {
                if (!overlayMessagesListeners.has(requestId)) {
                    const messagesQuery = query(
                        collection(db, "chatMessages"),
                        where("requestId", "==", requestId),
                        orderBy("timestamp", "desc")  // ✅ Using Firebase index for optimal performance
                    );
                    
                    const unsubscribe = onSnapshot(messagesQuery, (snapshot) => {
                        updateConversationFromMessages(requestId, snapshot);
                    }, (error) => {
                        console.error(`❌ Error listening to messages for request ${requestId}:`, error);
                        console.log('💡 If you see index errors, create the composite index in Firebase Console');
                    });
                    
                    overlayMessagesListeners.set(requestId, unsubscribe);
                }
            });
        }, (error) => {
            console.error('❌ Error listening to user sent messages:', error);
            console.log('💡 If you see index errors, create the composite index in Firebase Console');
        });
        
        // Store the user sent messages listener with a special key
        overlayMessagesListeners.set('__userSentMessages__', userSentUnsubscribe);
        
        console.log('✅ User conversations loaded successfully with Firebase indexes');
        
    } catch (error) {
        console.error('❌ Error loading conversations:', error);
    }
}

function updateConversationFromMessages(requestId, messagesSnapshot) {
    if (messagesSnapshot.empty) return;
    
    const messages = [];
    messagesSnapshot.forEach(doc => {
        messages.push({ id: doc.id, ...doc.data() });
    });
    
    const lastMessage = messages[0]; // Most recent message
    const requestData = requestsData.get(requestId);
    
    if (!requestData) return;
    
    // Check if user is involved in this conversation
    const userInvolved = messages.some(msg => 
        msg.senderId === currentUser.uid || 
        (requestData.authorId === currentUser.uid && msg.senderId !== currentUser.uid)
    );
    
    if (!userInvolved) return;
    
    const conversation = {
        requestId: requestId,
        title: requestData.title || 'Assignment Discussion',
        lastMessage: lastMessage,
        unreadCount: getUnreadCount(requestId, messages),
        isAuthor: requestData.authorId === currentUser.uid
    };
    
    userConversations.set(requestId, conversation);
    updateChatOverlayDisplay();
}

function getUnreadCount(requestId, messages) {
    const lastReadTimestamp = lastReadMessages.get(requestId);
    if (!lastReadTimestamp) {
        // Count messages from others
        return messages.filter(msg => msg.senderId !== currentUser.uid).length;
    }
    
    return messages.filter(msg => 
        msg.senderId !== currentUser.uid && 
        msg.timestamp && 
        msg.timestamp.toDate() > lastReadTimestamp
    ).length;
}

function updateChatOverlayDisplay() {
    const conversationsList = document.getElementById('chat-conversations-list');
    const notificationDot = document.getElementById('chat-notification-dot');
    
    if (userConversations.size === 0) {
        conversationsList.innerHTML = `
            <div class="no-conversations">
                <i class="ph-bold ph-chat-circle"></i>
                <p>No active conversations</p>
            </div>
        `;
        notificationDot.style.display = 'none';
        return;
    }
    
    let totalUnread = 0;
    let conversationsHTML = '';
    
    // Sort conversations by last message time
    const sortedConversations = Array.from(userConversations.values())
        .sort((a, b) => {
            const timeA = a.lastMessage.timestamp?.toDate() || new Date(0);
            const timeB = b.lastMessage.timestamp?.toDate() || new Date(0);
            return timeB - timeA;
        });
    
    sortedConversations.forEach(conversation => {
        const hasUnread = conversation.unreadCount > 0;
        totalUnread += conversation.unreadCount;
        
        const lastMessageTime = conversation.lastMessage.timestamp ? 
            formatTimeAgo(conversation.lastMessage.timestamp.toDate()) : 'Now';
        
        let messagePreview = '';
        if (conversation.lastMessage.isNegotiation) {
            const safePrice = parseFloat(conversation.lastMessage.negotiatedPrice) || 0;
            messagePreview = `💰 Price: ₹${safePrice}`;
        } else {
            messagePreview = sanitizeText(conversation.lastMessage.content) || 'No message';
        }
        
        if (messagePreview.length > 30) {
            messagePreview = messagePreview.substring(0, 30) + '...';
        }
        
        conversationsHTML += `
            <div class="conversation-item ${hasUnread ? 'has-unread' : ''}" 
                 onclick="openConversationFromOverlay('${conversation.requestId}')">
                <div class="conversation-header">
                    <div class="conversation-title">${conversation.title}</div>
                    <div class="conversation-time">${lastMessageTime}</div>
                </div>
                <div class="conversation-preview">${messagePreview}</div>
                ${hasUnread ? '<div class="conversation-unread"></div>' : ''}
            </div>
        `;
    });
    
    conversationsList.innerHTML = conversationsHTML;
    
    // Show/hide notification dot
    if (totalUnread > 0) {
        notificationDot.style.display = 'block';
    } else {
        notificationDot.style.display = 'none';
    }
}

function openConversationFromOverlay(requestId) {
    const requestData = requestsData.get(requestId);
    if (requestData) {
        // Mark as read
        markConversationAsRead(requestId);
        
        // Open chat modal
        openChatModal(requestId, requestData);
        
        // Collapse overlay
        const overlay = document.getElementById('chat-overlay');
        overlay.classList.remove('expanded');
    }
}

function markConversationAsRead(requestId) {
    lastReadMessages.set(requestId, new Date());
    
    // Update conversation unread count
    const conversation = userConversations.get(requestId);
    if (conversation) {
        conversation.unreadCount = 0;
        userConversations.set(requestId, conversation);
        updateChatOverlayDisplay();
    }
}

// Listen for auth state changes to get the current user
onAuthStateChanged(auth, (user) => {
    if (user) {
        currentUser = user;
        console.log('User authenticated:', user.email);
        
        // Initialize chat overlay when user is authenticated
        setTimeout(() => {
            initializeChatOverlay();
        }, 1000); // Small delay to ensure DOM is ready
    } else {
        console.log('User signed out, cleaning up...');
        
        // Clean up all listeners when user logs out
        cleanupAllListeners();
        
        // Clear user-related data
        currentUser = null;
        userConversations.clear();
        lastReadMessages.clear();
        requestsData.clear();
        
        // Redirect to login
        window.location.href = 'login.html';
    }
});

// === CREATE: Add a new request to Firestore ===
if (newRequestForm) {
    newRequestForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!currentUser) {
            showMessage(errorMessage);
            if (errorMessage?.querySelector('span')) {
                errorMessage.querySelector('span').textContent = "You must be logged in to post a request.";
            }
            return;
        }

        const title = newRequestForm['request-title']?.value?.trim();
        const description = newRequestForm['request-description']?.value?.trim();
        const paymentAmount = parseFloat(newRequestForm['payment-amount']?.value) || null;
        const dueDate = newRequestForm['due-date']?.value;

    // Enhanced validation
    if (!validateInput(title, 100)) {
        showMessage(errorMessage);
        errorMessage.querySelector('span').textContent = "Please enter a valid title (1-100 characters).";
        return;
    }
    
    if (!validateInput(description, 1000)) {
        showMessage(errorMessage);
        errorMessage.querySelector('span').textContent = "Please enter a valid description (1-1000 characters).";
        return;
    }
    
    if (!validatePaymentAmount(paymentAmount)) {
        showMessage(errorMessage);
        errorMessage.querySelector('span').textContent = "Please enter a valid payment amount (₹0 - ₹100,000).";
        return;
    }

    if (!dueDate) {
        showMessage(errorMessage);
        errorMessage.querySelector('span').textContent = "Please select a due date.";
        return;
    }

    // Validate due date is in the future
    const dueDateObj = new Date(dueDate);
    const now = new Date();
    if (dueDateObj <= now) {
        showMessage(errorMessage);
        errorMessage.querySelector('span').textContent = "Due date must be in the future.";
        return;
    }

    setSubmitButtonLoading(true);

    try {
        await addDoc(collection(db, "assignmentRequests"), {
            title: sanitizeText(title),
            description: sanitizeText(description),
            paymentAmount: paymentAmount,
            dueDate: dueDateObj,
            authorName: sanitizeText(currentUser.displayName) || 'Anonymous User',
            authorId: currentUser.uid,
            authorPhotoURL: currentUser.photoURL || 'https://via.placeholder.com/40',
            isCompleted: false,
            createdAt: serverTimestamp()
        });
        
        newRequestForm.reset();
        showMessage(successMessage);
        console.log("Request posted successfully!");
        
        // Add a subtle animation to the form
        newRequestForm.style.transform = 'scale(0.98)';
        setTimeout(() => {
            newRequestForm.style.transform = 'scale(1)';
        }, 150);
        
    } catch (error) {
        console.error("Error adding document: ", error);
        showMessage(errorMessage);
        errorMessage.querySelector('span').textContent = "Failed to post request. Please try again.";
    } finally {
        setSubmitButtonLoading(false);
    }
});
} // End of newRequestForm safety check

// === READ: Fetch and display requests from Firestore in real-time ===
function loadRequests() {
    if (requestsListener) {
        // Clean up existing listener
        requestsListener();
    }
    
    const q = query(collection(db, "assignmentRequests"), orderBy("createdAt", "desc"));
    requestsListener = onSnapshot(q, (querySnapshot) => {
        // Clear existing requests
        requestsContainer.innerHTML = '';
        
        if (querySnapshot.empty) {
            requestsContainer.innerHTML = createEmptyState();
            return;
        }

        let animationDelay = 0;
    
    querySnapshot.forEach((doc) => {
        const request = doc.data();
        const docId = doc.id;
        
        // Store request data for easy access
        requestsData.set(docId, request);
        
        const requestEl = document.createElement('article');
        requestEl.className = 'request-card';
        
        // Add staggered animation delay
        requestEl.style.animationDelay = `${animationDelay}s`;
        animationDelay += 0.1;

        // Format the timestamp with better time display
        const date = request.createdAt ? formatTimeAgo(request.createdAt.toDate()) : 'Just now';
        
        // Safely handle missing data
        const authorName = request.authorName || 'Anonymous User';
        const authorPhoto = request.authorPhotoURL || 'https://via.placeholder.com/40';
        const title = request.title || 'Untitled Request';
        const description = request.description || 'No description provided.';
        const isCompleted = request.isCompleted || false;
        const isAuthor = currentUser && currentUser.uid === request.authorId;

        // Create badges for payment, due date, and completion status
        const badgesHTML = createBadges(request);

        // Create completion toggle button (only for the author)
        const completionToggleHTML = isAuthor ? `
            <button class="completion-toggle ${isCompleted ? 'completed' : ''}" 
                    onclick="toggleRequestCompletion('${docId}', ${isCompleted})">
                <i class="ph-bold ${isCompleted ? 'ph-check-circle' : 'ph-circle'}"></i>
                ${isCompleted ? 'Mark as Open' : 'Mark as Completed'}
            </button>
        ` : '';

        // Create contact button (for non-authors and non-completed requests)
        const contactButtonHTML = !isAuthor && !isCompleted ? `
            <button class="contact-button" onclick="openChat('${docId}')">
                <i class="ph-bold ph-chat-circle"></i>
                Contact & Negotiate
            </button>
        ` : '';

        requestEl.innerHTML = `
            <div class="request-author">
                <img src="${authorPhoto}" alt="${authorName}" onerror="this.src='https://via.placeholder.com/40'">
                <span>${authorName}</span>
            </div>
            <h3>${title}</h3>
            <p class="request-description">${description}</p>
            ${badgesHTML}
            <p class="request-meta">
                <i class="ph-bold ph-clock"></i>
                Posted ${date}
            </p>
            ${completionToggleHTML}
            ${contactButtonHTML}
        `;
        
        // Add click interaction for future expansion (like comments)
        requestEl.addEventListener('click', (e) => {
            // Don't trigger if clicking on the completion toggle button
            if (!e.target.closest('.completion-toggle')) {
                console.log('Request clicked:', docId);
                // Future: Could expand to show comments or contact options
            }
        });
        
        requestsContainer.appendChild(requestEl);
    });
}, (error) => {
    console.error('Error loading requests:', error);
    requestsContainer.innerHTML = `
        <div style="text-align: center; color: #ff6b6b; padding: 2rem;">
            <p>Failed to load requests. Please refresh the page.</p>
        </div>
    `;
});
}

// Initialize requests loading when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadRequests);
} else {
    loadRequests();
}

// === ADDITIONAL UI ENHANCEMENTS ===

// Add auto-resize functionality for textarea
const textarea = document.getElementById('request-description');
textarea.addEventListener('input', function() {
    this.style.height = 'auto';
    this.style.height = (this.scrollHeight) + 'px';
});

// Add character counter for description
const descriptionGroup = textarea.parentElement;
const charCounter = document.createElement('div');
charCounter.style.cssText = `
    font-size: 0.8rem;
    color: var(--text-secondary);
    text-align: right;
    margin-top: 0.5rem;
`;
descriptionGroup.appendChild(charCounter);

textarea.addEventListener('input', function() {
    const length = this.value.length;
    charCounter.textContent = `${length}/500 characters`;
    if (length > 400) {
        charCounter.style.color = '#ff6b6b';
    } else {
        charCounter.style.color = 'var(--text-secondary)';
    }
});

// Initialize character counter
textarea.dispatchEvent(new Event('input'));

// Add smooth scrolling when new request is added
let lastRequestCount = 0;
mutationObserver = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
        if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
            const currentRequestCount = requestsContainer.children.length;
            if (currentRequestCount > lastRequestCount && !requestsContainer.querySelector('.empty-state')) {
                // Scroll to the new request smoothly
                setTimeout(() => {
                    const newRequest = requestsContainer.firstElementChild;
                    if (newRequest && newRequest.classList.contains('request-card')) {
                        newRequest.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }
                }, 300);
            }
            lastRequestCount = currentRequestCount;
        }
    });
});

mutationObserver.observe(requestsContainer, { childList: true });

// === SECURE EVENT LISTENERS (NO GLOBAL FUNCTION EXPOSURE) ===
// This replaces the insecure window.functionName pattern

document.addEventListener('DOMContentLoaded', function() {
    // Setup secure event listeners for modal buttons
    const closeChatBtn = document.querySelector('.close-chat');
    if (closeChatBtn) {
        closeChatBtn.addEventListener('click', closeChatModal);
    }

    const sendMessageBtn = document.querySelector('.btn-send-message');
    if (sendMessageBtn) {
        sendMessageBtn.addEventListener('click', sendMessage);
    }

    const chatOverlayHeader = document.querySelector('.chat-overlay-header');
    if (chatOverlayHeader) {
        chatOverlayHeader.addEventListener('click', toggleChatOverlay);
    }

    // Note: Dynamic buttons (like toggleRequestCompletion, openChat) 
    // are handled in the displayRequests function where they are created
});

// Initialize due date field with minimum date as current date/time
const dueDateInput = document.getElementById('due-date');
const now = new Date();
const currentDateTime = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
dueDateInput.min = currentDateTime;

// Set default due date to 1 week from now
const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
const defaultDateTime = new Date(nextWeek.getTime() - nextWeek.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
dueDateInput.value = defaultDateTime;

// Add keyboard shortcuts
document.addEventListener('keydown', (e) => {
    // Ctrl/Cmd + Enter to submit form
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        const titleInput = document.getElementById('request-title');
        const descriptionInput = document.getElementById('request-description');
        const paymentInput = document.getElementById('payment-amount');
        const chatInput = document.getElementById('chat-input');
        
        if (document.activeElement === titleInput || 
            document.activeElement === descriptionInput || 
            document.activeElement === paymentInput ||
            document.activeElement === dueDateInput) {
            e.preventDefault();
            newRequestForm.dispatchEvent(new Event('submit'));
        } else if (document.activeElement === chatInput) {
            e.preventDefault();
            sendMessage();
        }
    }
    
    // Escape to close chat modal
    if (e.key === 'Escape') {
        const modal = document.getElementById('chat-modal');
        if (modal.style.display === 'block') {
            closeChatModal();
        }
    }
});

// Add auto-resize functionality for chat input
document.addEventListener('DOMContentLoaded', () => {
    const chatInput = document.getElementById('chat-input');
    if (chatInput) {
        chatInput.addEventListener('input', function() {
            this.style.height = 'auto';
            this.style.height = Math.min(this.scrollHeight, 100) + 'px';
        });
        
        // Enter to send, Shift+Enter for new line
        chatInput.addEventListener('keydown', function(e) {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
            }
        });
    }
});