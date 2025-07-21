import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore, collection, addDoc, query, orderBy, onSnapshot, serverTimestamp, doc, updateDoc, where, getDocs } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { firebaseConfig } from './firebase-config.js';
import { handleError, validateInput, requestRateLimit, messagingRateLimit } from './security-utils.js';

// Import Firebase modules
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import { getAuth, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import { getFirestore, collection, addDoc, query, orderBy, onSnapshot, doc, updateDoc, Timestamp, serverTimestamp, where } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';
import { firebaseConfig } from './firebase-config.js';
import { validateInput, requestRateLimit, messagingRateLimit } from './security-utils.js';

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
let allRequests = []; // Store all requests for filtering
let uploadedFiles = new Map(); // Store uploaded files for new requests
let chatUploadedFiles = new Map(); // Store uploaded files for chat

// Security and utility functions with DOMPurify
function sanitizeText(text) {
    if (!text) return '';
    // Use DOMPurify for robust XSS protection
    return DOMPurify.sanitize(text.toString(), { 
        ALLOWED_TAGS: [],
        ALLOWED_ATTR: [],
        KEEP_CONTENT: true
    });
}

function sanitizeHTML(html) {
    if (!html) return '';
    // Allow safe HTML tags for formatted content like code blocks
    return DOMPurify.sanitize(html.toString(), {
        ALLOWED_TAGS: ['code', 'pre', 'br', 'strong', 'em', 'p'],
        ALLOWED_ATTR: [],
        KEEP_CONTENT: true
    });
}

function validatePaymentAmount(amount) {
    if (amount === null || amount === undefined || amount === '') return true; // Optional field
    const numAmount = parseFloat(amount);
    return !isNaN(numAmount) && numAmount >= 0 && numAmount <= 100000; // Reasonable limits
}

// Note: Enhanced validateInput is now imported from security-utils.js
// This provides XSS protection, whitespace validation, and better error messages

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
        // SECURITY: Minimal error logging to prevent sensitive data exposure
        console.error('Toggle completion failed');
        
        // Use centralized error handler for user feedback
        const userMessage = handleError(error, 'toggleCompletion', true);
        showMessage(errorMessage);
        if (errorMessage?.querySelector('span')) {
            errorMessage.querySelector('span').textContent = userMessage;
        }
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
        // Enhanced error handling for chat message loading
        console.error(`Error in loadChatMessages function for requestId: ${requestId}:`, {
            errorCode: error.code,
            errorMessage: error.message,
            requestId: requestId,
            userId: currentUser?.uid,
            timestamp: new Date().toISOString()
        });
        
        const userMessage = handleError(error, 'loadChatMessages', false);
        chatMessages.innerHTML = `
            <div style="text-align: center; color: #ff6b6b; padding: 2rem;">
                <i class="ph ph-warning-circle" style="font-size: 2rem; display: block; margin-bottom: 1rem;"></i>
                <p>${userMessage}</p>
                <button onclick="location.reload()" style="margin-top: 1rem; padding: 0.5rem 1rem; background: var(--primary); color: white; border: none; border-radius: 4px; cursor: pointer;">
                    Retry
                </button>
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
                Price negotiation: ₹${sanitizedPrice.toFixed(2)}
            </div>
        `;
    } else {
        // SECURITY: Format code blocks with XSS protection - formatCodeBlocks now handles sanitization
        const safeContent = formatCodeBlocks(message.content || '');
        contentHTML = `<div class="message-content">${safeContent}</div>`;
    }
    
    // SECURITY: Sanitize all user-provided data
    const sanitizedSenderName = sanitizeText(message.senderName || 'Anonymous User');
    const safeSenderPhoto = sanitizeText(message.senderPhoto || 'https://via.placeholder.com/20');
    
    messageEl.innerHTML = `
        ${!isCurrentUser ? `
            <div class="message-header">
                <img src="${safeSenderPhoto}" alt="${sanitizedSenderName}" onerror="this.src='https://via.placeholder.com/20'">
                <span>${sanitizedSenderName}</span>
            </div>
        ` : ''}
        ${contentHTML}
        <div class="message-time">${sanitizeText(timeStr)}</div>
    `;
    
    return messageEl;
}

// Format code blocks in messages with XSS protection
function formatCodeBlocks(text) {
    if (!text) return '';
    
    // First sanitize the raw text to prevent XSS
    const sanitizedText = sanitizeText(text);
    
    // Format multi-line code blocks (```code```)
    let formattedText = sanitizedText.replace(/```([\s\S]*?)```/g, (match, code) => {
        // Extra sanitization for code content
        const safeCode = sanitizeText(code);
        return `<pre><code>${safeCode}</code></pre>`;
    });
    
    // Format inline code (`code`)
    formattedText = formattedText.replace(/`([^`]+)`/g, (match, code) => {
        // Extra sanitization for inline code
        const safeCode = sanitizeText(code);
        return `<code>${safeCode}</code>`;
    });
    
    // Convert line breaks to HTML (safe since we sanitized first)
    formattedText = formattedText.replace(/\n/g, '<br>');
    
    // Final sanitization allowing only safe HTML tags we just added
    return sanitizeHTML(formattedText);
}

// File Upload Functions
function setupFileUpload() {
    const fileUploadArea = document.getElementById('file-upload-area');
    const fileInput = document.getElementById('file-input');
    const uploadedFilesContainer = document.getElementById('uploaded-files');

    if (!fileUploadArea || !fileInput) return;

    // Click to upload
    fileUploadArea.addEventListener('click', () => {
        fileInput.click();
    });

    // Drag and drop
    fileUploadArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        fileUploadArea.classList.add('dragover');
    });

    fileUploadArea.addEventListener('dragleave', (e) => {
        e.preventDefault();
        fileUploadArea.classList.remove('dragover');
    });

    fileUploadArea.addEventListener('drop', (e) => {
        e.preventDefault();
        fileUploadArea.classList.remove('dragover');
        handleFiles(e.dataTransfer.files);
    });

    // File input change
    fileInput.addEventListener('change', (e) => {
        handleFiles(e.target.files);
    });

    function handleFiles(files) {
        Array.from(files).forEach(file => {
            if (validateFile(file)) {
                addFileToUpload(file, uploadedFilesContainer, uploadedFiles);
            }
        });
    }
}

function setupChatFileUpload() {
    const chatFileInput = document.getElementById('chat-file-input');
    const attachFileBtn = document.querySelector('.btn-attach-file');

    if (!chatFileInput || !attachFileBtn) return;

    attachFileBtn.addEventListener('click', () => {
        chatFileInput.click();
    });

    chatFileInput.addEventListener('change', (e) => {
        Array.from(e.target.files).forEach(file => {
            if (validateFile(file)) {
                // For chat, we'll send files immediately
                sendFileMessage(file);
            }
        });
        // Clear the input
        e.target.value = '';
    });
}

function validateFile(file) {
    const maxSize = 10 * 1024 * 1024; // 10MB
    const allowedTypes = [
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'text/plain',
        'image/png',
        'image/jpeg',
        'image/gif',
        'image/jpg'
    ];

    if (file.size > maxSize) {
        alert(`File "${file.name}" is too large. Maximum size is 10MB.`);
        return false;
    }

    if (!allowedTypes.includes(file.type)) {
        alert(`File type "${file.type}" is not allowed.`);
        return false;
    }

    return true;
}

function addFileToUpload(file, container, storage) {
    const fileId = Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    storage.set(fileId, file);

    const fileElement = document.createElement('div');
    fileElement.className = 'uploaded-file';
    fileElement.innerHTML = `
        <i class="ph-bold ph-file"></i>
        <div class="file-info">
            <div class="file-name">${sanitizeText(file.name)}</div>
            <div class="file-size">${formatFileSize(file.size)}</div>
        </div>
        <button class="btn-remove-file" data-file-id="${fileId}">
            <i class="ph-bold ph-x"></i>
        </button>
    `;

    const removeBtn = fileElement.querySelector('.btn-remove-file');
    removeBtn.addEventListener('click', () => {
        storage.delete(fileId);
        fileElement.remove();
    });

    container.appendChild(fileElement);
}

function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

async function sendFileMessage(file) {
    if (!currentChatRequestId || !currentUser) {
        console.error('Cannot send file: missing chat context');
        return;
    }

    try {
        // Create a simple text message about the file
        // Note: For production, you'd upload to Firebase Storage first
        const fileMessage = {
            requestId: currentChatRequestId,
            senderId: currentUser.uid,
            senderName: sanitizeText(currentUser.displayName) || 'Anonymous User',
            senderPhoto: currentUser.photoURL || 'https://via.placeholder.com/40',
            content: `📎 Shared file: ${file.name} (${formatFileSize(file.size)})`,
            timestamp: serverTimestamp(),
            isFile: true,
            fileName: file.name,
            fileSize: file.size,
            supervisorVisible: true
        };

        await addDoc(collection(db, "chatMessages"), fileMessage);
        console.log('File message sent successfully');
        
    } catch (error) {
        console.error('Error sending file message:', error);
        alert('Failed to send file. Please try again.');
    }
}

async function sendMessage() {
    const chatInput = document.getElementById('chat-input');
    const content = chatInput.value.trim();
    
    if (!content || !currentChatRequestId || !currentUser) {
        return;
    }
    
    // SECURITY: Check rate limiting for messaging
    if (!messagingRateLimit(currentUser.uid)) {
        showMessage(errorMessage);
        if (errorMessage?.querySelector('span')) {
            errorMessage.querySelector('span').textContent = "You're sending messages too quickly. Please wait a moment.";
        }
        return;
    }
    
    // Enhanced validation with detailed error messages
    const validation = validateInput(content, 1000);
    if (!validation.isValid) {
        showMessage(errorMessage);
        if (errorMessage?.querySelector('span')) {
            errorMessage.querySelector('span').textContent = validation.error;
        }
        return;
    }
    
    // SECURITY: Store sanitized content to prevent XSS at source
    const sanitizedContent = sanitizeText(content);
    
    try {
        await addDoc(collection(db, "chatMessages"), {
            requestId: currentChatRequestId,
            senderId: currentUser.uid,
            senderName: sanitizeText(currentUser.displayName) || 'Anonymous User',
            senderPhoto: sanitizeText(currentUser.photoURL) || 'https://via.placeholder.com/40',
            content: sanitizedContent,
            isNegotiation: false,
            timestamp: Timestamp.now(),
            supervisorVisible: true
        });
        
        chatInput.value = '';
        
    } catch (error) {
        // SECURITY: Minimize error exposure in console logs
        console.error('Error sending message');
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
    
    if (negotiationSection) {
        negotiationSection.style.display = 'none';
    }
    
    if (negotiatedPriceInput) {
        negotiatedPriceInput.value = '';
    }
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
                 data-request-id="${conversation.requestId}">
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
    
    // Add event listeners to conversation items
    const conversationItems = conversationsList.querySelectorAll('.conversation-item');
    conversationItems.forEach(item => {
        const requestId = item.getAttribute('data-request-id');
        if (requestId) {
            item.addEventListener('click', () => openConversationFromOverlay(requestId));
        }
    });
    
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
        // SECURITY: Minimize sensitive data in console logs
        console.log('User authenticated successfully');
        
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

        // SECURITY: Check rate limiting before processing
        if (!requestRateLimit(currentUser.uid)) {
            setErrorMessage("You're posting too frequently. Please wait a moment before creating another request.");
            return;
        }

        const title = newRequestForm['request-title']?.value?.trim();
        const description = newRequestForm['request-description']?.value?.trim();
        const paymentAmount = parseFloat(newRequestForm['payment-amount']?.value) || null;
        const dueDate = newRequestForm['due-date']?.value;

    // Enhanced validation with detailed error feedback
    const titleValidation = validateInput(title, 100);
    if (!titleValidation.isValid) {
        showMessage(errorMessage);
        errorMessage.querySelector('span').textContent = `Title: ${titleValidation.error}`;
        return;
    }
    
    const descValidation = validateInput(description, 1000);
    if (!descValidation.isValid) {
        showMessage(errorMessage);
        errorMessage.querySelector('span').textContent = `Description: ${descValidation.error}`;
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
        requestsListener();
        requestsListener = null;
    }
    
    const q = query(collection(db, "assignmentRequests"), orderBy("createdAt", "desc"));
    requestsListener = onSnapshot(q, (querySnapshot) => {
        try {
            // Hide skeleton loader
            const skeletonLoader = document.getElementById('skeleton-loader');
            if (skeletonLoader) {
                skeletonLoader.classList.add('hidden');
            }
            
            // Clear existing requests and store all data
            allRequests = [];
            querySnapshot.forEach((doc) => {
                allRequests.push({ id: doc.id, data: doc.data() });
                requestsData.set(doc.id, doc.data());
            });

            // Apply current filters
            applyFilters();
            
        } catch (error) {
            console.error('Error in loadRequests listener:', error);
            handleError(error, 'loadRequests', false);
        }
    }, (error) => {
        console.error('Error loading requests:', error);
        const skeletonLoader = document.getElementById('skeleton-loader');
        if (skeletonLoader) {
            skeletonLoader.classList.add('hidden');
        }
        displayEmptyState('Failed to load requests. Please refresh the page.');
    });
}

// Filter and Search Functions
function applyFilters() {
    const searchTerm = document.getElementById('search-requests')?.value.toLowerCase() || '';
    const sortBy = document.getElementById('sort-requests')?.value || 'newest';
    const showCompleted = document.getElementById('toggle-completed')?.checked || false;
    const hasPayment = document.getElementById('toggle-payment')?.checked || false;

    // Filter requests
    let filteredRequests = allRequests.filter(({ data }) => {
        // Search filter
        if (searchTerm) {
            const title = (data.title || '').toLowerCase();
            const description = (data.description || '').toLowerCase();
            const authorName = (data.authorName || '').toLowerCase();
            
            if (!title.includes(searchTerm) && 
                !description.includes(searchTerm) && 
                !authorName.includes(searchTerm)) {
                return false;
            }
        }

        // Completion filter
        if (!showCompleted && data.isCompleted) {
            return false;
        }

        // Payment filter
        if (hasPayment && (!data.paymentAmount || data.paymentAmount <= 0)) {
            return false;
        }

        return true;
    });

    // Sort requests
    filteredRequests.sort((a, b) => {
        switch (sortBy) {
            case 'due_date':
                const dueDateA = a.data.dueDate ? a.data.dueDate.toDate() : new Date(8640000000000000);
                const dueDateB = b.data.dueDate ? b.data.dueDate.toDate() : new Date(8640000000000000);
                return dueDateA - dueDateB;
            
            case 'payment':
                const paymentA = a.data.paymentAmount || 0;
                const paymentB = b.data.paymentAmount || 0;
                return paymentB - paymentA;
            
            case 'alphabetical':
                const titleA = (a.data.title || '').toLowerCase();
                const titleB = (b.data.title || '').toLowerCase();
                return titleA.localeCompare(titleB);
            
            case 'newest':
            default:
                const timeA = a.data.createdAt ? a.data.createdAt.toDate() : new Date(0);
                const timeB = b.data.createdAt ? b.data.createdAt.toDate() : new Date(0);
                return timeB - timeA;
        }
    });

    displayFilteredRequests(filteredRequests);
}

function displayFilteredRequests(filteredRequests) {
    const requestsContainer = document.getElementById('requests-container');
    
    if (filteredRequests.length === 0) {
        displayEmptyState(getEmptyStateMessage());
        return;
    }

    // Fragment for better performance
    const fragment = document.createDocumentFragment();
    
    filteredRequests.forEach(({ id, data }, index) => {
        const animationDelay = index * 0.1;
        const requestEl = createRequestElement({ id, data: () => data }, data, animationDelay);
        fragment.appendChild(requestEl);
    });

    requestsContainer.innerHTML = '';
    requestsContainer.appendChild(fragment);
}

function getEmptyStateMessage() {
    const searchTerm = document.getElementById('search-requests')?.value || '';
    const showCompleted = document.getElementById('toggle-completed')?.checked || false;
    const hasPayment = document.getElementById('toggle-payment')?.checked || false;

    if (searchTerm) {
        return `No requests found matching "${searchTerm}"`;
    }

    if (!showCompleted && hasPayment) {
        return 'No active paid requests found. Try adjusting filters.';
    }

    if (hasPayment) {
        return 'No paid requests found. Try disabling payment filter.';
    }

    return 'No help requests found. Be the first to ask for help!';
}

function displayEmptyState(message) {
    const requestsContainer = document.getElementById('requests-container');
    requestsContainer.innerHTML = `
        <div class="empty-state">
            <i class="ph-bold ph-chat-circle"></i>
            <p>${message}</p>
        </div>
    `;
}

// PERFORMANCE OPTIMIZATION: Extract request element creation for better maintainability
function createRequestElement(doc, request, animationDelay) {
    const docId = doc.id;
    const requestEl = document.createElement('article');
    const isCompleted = request.isCompleted || false;
    requestEl.className = `request-card ${isCompleted ? 'completed' : ''}`;
    
    // Add staggered animation delay
    requestEl.style.animationDelay = `${animationDelay}s`;

    // Format the timestamp with better time display
    const date = request.createdAt ? formatTimeAgo(request.createdAt.toDate()) : 'Just now';
    
    // SECURITY: Sanitize ALL user-provided content to prevent XSS
    const authorName = sanitizeText(request.authorName || 'Anonymous User');
    const authorPhoto = request.authorPhotoURL || 'https://via.placeholder.com/40';
    const title = sanitizeText(request.title || 'Untitled Request');
    const description = sanitizeText(request.description || 'No description provided.');
    const isAuthor = currentUser && currentUser.uid === request.authorId;

    // Get participant count (mock for now - can be enhanced with real data)
    const participantCount = Math.floor(Math.random() * 8) + 1; // Mock data

    // Create badges for payment, due date, and completion status
    const badgesHTML = createBadges(request);

    // Create completion toggle button (only for the author)
    const completionToggleHTML = isAuthor ? `
        <button class="completion-toggle ${isCompleted ? 'completed' : ''}" 
                title="${isCompleted ? 'Mark as incomplete' : 'Mark as completed'}">
            <i class="ph ${isCompleted ? 'ph-check-circle-fill' : 'ph-circle'}"></i>
            ${isCompleted ? 'Completed' : 'Mark Complete'}
        </button>
    ` : '';

    // Use secure DOM creation with sanitized content
    requestEl.innerHTML = `
        <div class="request-header">
            <img src="${sanitizeText(authorPhoto)}" alt="${authorName}" class="author-avatar" onerror="this.src='https://via.placeholder.com/40'">
            <div class="author-info">
                <span class="author-name">${authorName}</span>
                <span class="post-date">${sanitizeText(date)}</span>
            </div>
            ${completionToggleHTML}
        </div>
        
        <div class="request-content ${isCompleted ? 'completed' : ''}">
            <h3 class="request-title">${title}</h3>
            <p class="request-description">${description}</p>
            ${badgesHTML}
        </div>
        
        <div class="request-actions">
            <button class="btn-secondary btn-chat" data-request-id="${sanitizeText(docId)}">
                <i class="ph ph-chat-circle"></i>
                Chat
                <span class="chat-participant-count">${participantCount}</span>
            </button>
        </div>
    `;

    // Add secure event listeners instead of onclick
    const completionToggle = requestEl.querySelector('.completion-toggle');
    if (completionToggle) {
        completionToggle.addEventListener('click', () => {
            toggleCompletion(docId, isCompleted);
        });
    }

    const chatButton = requestEl.querySelector('.btn-chat');
    if (chatButton) {
        chatButton.addEventListener('click', () => {
            openChatModal(docId, request);
        });
    }

    // Add click interaction for future expansion
    requestEl.addEventListener('click', (e) => {
        if (!e.target.closest('.completion-toggle, .btn-chat')) {
            console.log('Request clicked:', docId);
            // Future: Could expand to show comments or contact options
        }
    });

    return requestEl;
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
// Offer Input Functions
function showOfferInput() {
    const offerInputSection = document.getElementById('offer-input-section');
    const makeOfferBtn = document.querySelector('.btn-make-offer');
    
    if (offerInputSection) {
        offerInputSection.style.display = 'block';
    }
    
    if (makeOfferBtn) {
        makeOfferBtn.style.display = 'none';
    }
    
    // Focus on the amount input
    setTimeout(() => {
        const offerAmountInput = document.getElementById('offer-amount');
        if (offerAmountInput) {
            offerAmountInput.focus();
        }
    }, 100);
}

function hideOfferInput() {
    const offerInputSection = document.getElementById('offer-input-section');
    const makeOfferBtn = document.querySelector('.btn-make-offer');
    const offerAmountInput = document.getElementById('offer-amount');
    
    if (offerInputSection) {
        offerInputSection.style.display = 'none';
    }
    
    if (makeOfferBtn) {
        makeOfferBtn.style.display = 'block';
    }
    
    if (offerAmountInput) {
        offerAmountInput.value = '';
    }
}

async function sendOffer() {
    const offerAmountInput = document.getElementById('offer-amount');
    const sendOfferBtn = document.querySelector('.btn-send-offer');
    
    if (!offerAmountInput || !currentChatRequestId || !currentUser) {
        console.error('Missing required elements or data for sending offer');
        return;
    }
    
    const offerAmount = parseFloat(offerAmountInput.value);
    
    if (!offerAmount || offerAmount <= 0) {
        alert('Please enter a valid offer amount');
        return;
    }
    
    // Disable button during sending
    if (sendOfferBtn) {
        sendOfferBtn.disabled = true;
        sendOfferBtn.innerHTML = '<div class="loading-spinner"></div> Sending...';
    }
    
    try {
        // Create offer message
        const offerMessage = {
            requestId: currentChatRequestId,
            senderId: currentUser.uid,
            senderName: currentUser.displayName || currentUser.email,
            senderEmail: currentUser.email,
            content: `Price offer: ₹${offerAmount}`,
            timestamp: serverTimestamp(),
            type: 'offer',
            offerAmount: offerAmount,
            offerStatus: 'pending'
        };
        
        // Add message to Firestore
        await addDoc(collection(db, "chatMessages"), offerMessage);
        
        // Hide offer input
        hideOfferInput();
        
        console.log('✅ Offer sent successfully');
        
    } catch (error) {
        console.error('❌ Error sending offer:', error);
        alert('Failed to send offer. Please try again.');
    } finally {
        // Re-enable button
        if (sendOfferBtn) {
            sendOfferBtn.disabled = false;
            sendOfferBtn.innerHTML = '<i class="ph-bold ph-handshake"></i> Send Offer';
        }
    }
}

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

    // Set up offer button event listeners
    const makeOfferBtn = document.querySelector('.btn-make-offer');
    const cancelOfferBtn = document.querySelector('.btn-cancel-offer');
    const sendOfferBtn = document.querySelector('.btn-send-offer');

    if (makeOfferBtn) {
        makeOfferBtn.addEventListener('click', showOfferInput);
    }

    if (cancelOfferBtn) {
        cancelOfferBtn.addEventListener('click', hideOfferInput);
    }

    if (sendOfferBtn) {
        sendOfferBtn.addEventListener('click', sendOffer);
    }

    // Set up filter controls
    const searchInput = document.getElementById('search-requests');
    const sortSelect = document.getElementById('sort-requests');
    const completedToggle = document.getElementById('toggle-completed');
    const paymentToggle = document.getElementById('toggle-payment');

    if (searchInput) {
        searchInput.addEventListener('input', applyFilters);
    }

    if (sortSelect) {
        sortSelect.addEventListener('change', applyFilters);
    }

    if (completedToggle) {
        completedToggle.addEventListener('change', applyFilters);
    }

    if (paymentToggle) {
        paymentToggle.addEventListener('change', applyFilters);
    }

    // Set up file upload functionality
    setupFileUpload();
    setupChatFileUpload();
});