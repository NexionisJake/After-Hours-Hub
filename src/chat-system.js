// src/chat-system.js
// Real-time Chat System for After Hours Hub

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { 
    getFirestore, 
    collection, 
    addDoc, 
    doc, 
    getDoc,
    setDoc,
    updateDoc,
    query, 
    orderBy, 
    onSnapshot, 
    serverTimestamp,
    where,
    getDocs,
    writeBatch,
    limit
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { firebaseConfig } from './firebase-config.js';
import { handleError, sanitizeText } from './security-utils.js';

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Chat system state
let activeChatId = null;
let messageListener = null;
let chatModal = null;

/**
 * Initialize a chat between two users for a specific item
 * @param {string} itemOwnerUid - UID of the item owner/seller
 * @param {string} itemId - ID of the marketplace/assignment item
 * @param {string} itemTitle - Title of the item for reference
 * @param {string} itemType - Type of item ('market' or 'assignment')
 */
export async function initiateChat(itemOwnerUid, itemId, itemTitle, itemType = 'market') {
    try {
        const currentUserUid = auth.currentUser?.uid;
        
        if (!currentUserUid) {
            throw new Error('You must be logged in to start a chat');
        }

        // Prevent users from chatting with themselves (except for testing)
        if (currentUserUid === itemOwnerUid && !window.location.href.includes('chat-test.html')) {
            alert("You cannot start a chat about your own item.");
            return;
        }

        // For self-chat testing, ensure we don't have undefined values
        const actualItemOwnerUid = itemOwnerUid || currentUserUid;
        
        // Generate a predictable chat ID to prevent duplicate chats for the same item
        // Format: {sorted_user_ids}_{item_type}_{item_id}
        const sortedUids = [currentUserUid, actualItemOwnerUid].sort();
        const chatRefId = `${sortedUids.join('_')}_${itemType}_${itemId}`;
        
        console.log('Creating chat with ID:', chatRefId);
        console.log('Current user:', currentUserUid);
        console.log('Other user:', actualItemOwnerUid);
        
        const chatDocRef = doc(db, "chats", chatRefId);
        
        // Check if a chat already exists
        const chatSnap = await getDoc(chatDocRef);

        if (chatSnap.exists()) {
            // Chat already exists, just open it
            openChatModal(chatRefId, chatSnap.data());
        } else {
            // Get current user info
            const currentUser = auth.currentUser;
            
            // Create participant info - handle self-chat case for testing
            const participantInfo = {
                [currentUserUid]: {
                    name: currentUser.displayName || currentUser.email?.split('@')[0] || 'User',
                    email: currentUser.email || '',
                    avatar: currentUser.photoURL || null
                }
            };

            // If it's not a self-chat, add the other user's info
            if (actualItemOwnerUid !== currentUserUid) {
                participantInfo[actualItemOwnerUid] = {
                    name: 'Item Owner', // This would be fetched from user profile
                    email: 'owner@example.com', // This would be fetched from user profile
                    avatar: null
                };
            }

            // Create the new chat document (ensure no undefined values)
            const chatData = {
                itemId: String(itemId || ''),
                itemTitle: String(sanitizeText(itemTitle) || 'Untitled'),
                itemType: String(itemType || 'market'),
                participants: [currentUserUid, actualItemOwnerUid].filter(Boolean),
                participantInfo: participantInfo,
                lastMessage: null
            };

            // Add timestamps separately to avoid any issues
            try {
                chatData.createdAt = serverTimestamp();
                chatData.updatedAt = serverTimestamp();
            } catch (e) {
                console.warn('Server timestamp not available, using Date:', e);
                const now = new Date();
                chatData.createdAt = now;
                chatData.updatedAt = now;
            }

            console.log('Creating chat document with data:', chatData);
            
            await setDoc(chatDocRef, chatData);
            
            console.log('Chat created successfully');
            
            // Open the newly created chat
            openChatModal(chatRefId, chatData);
        }
    } catch (error) {
        console.error('Error initiating chat:', error);
        handleError(error, 'Failed to start chat. Please try again.');
    }
}

/**
 * Open the chat modal interface
 * @param {string} chatId - The chat document ID
 * @param {Object} chatData - The chat document data
 */
function openChatModal(chatId, chatData) {
    // Close any existing chat
    if (messageListener) {
        messageListener();
        messageListener = null;
    }

    activeChatId = chatId;
    
    // Create or show the chat modal
    createChatModal(chatData);
    
    // Start listening for messages
    listenForMessages(chatId);
}

/**
 * Create the chat modal DOM structure
 * @param {Object} chatData - The chat document data
 */
function createChatModal(chatData) {
    // Remove existing modal if it exists
    const existingModal = document.getElementById('chat-modal');
    if (existingModal) {
        existingModal.remove();
    }

    const currentUserUid = auth.currentUser.uid;
    const otherParticipant = chatData.participants.find(uid => uid !== currentUserUid) || currentUserUid;
    const otherUserInfo = chatData.participantInfo?.[otherParticipant] || {
        name: 'Chat Partner',
        avatar: null
    };

    // For self-chats (testing), use different display
    const displayName = otherParticipant === currentUserUid ? 'Test Chat (Self)' : otherUserInfo.name;

    // Create modal HTML
    const modalHtml = `
        <div id="chat-modal" class="chat-modal">
            <div class="chat-modal-content">
                <div class="chat-header">
                    <div class="chat-header-info">
                        <div class="chat-avatar">
                            ${otherUserInfo.avatar ? 
                                `<img src="${otherUserInfo.avatar}" alt="${displayName}">` : 
                                `<div class="avatar-placeholder">${displayName.charAt(0).toUpperCase()}</div>`
                            }
                        </div>
                        <div class="chat-header-text">
                            <h3>${displayName}</h3>
                            <p class="chat-item-title">About: ${chatData.itemTitle}</p>
                        </div>
                    </div>
                    <button class="chat-close-btn" onclick="closeChatModal()">&times;</button>
                </div>
                <div class="chat-messages" id="chat-messages">
                    <div class="chat-loading">Loading messages...</div>
                </div>
                <div class="chat-input-area">
                    <div class="chat-input-container">
                        <input type="text" id="chat-message-input" placeholder="Type your message..." maxlength="500">
                        <button id="chat-send-btn" onclick="sendMessage()">Send</button>
                    </div>
                </div>
            </div>
        </div>
    `;

    // Add modal to document
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    
    // Store modal reference
    chatModal = document.getElementById('chat-modal');
    
    // Set up event listeners
    setupChatEventListeners();
    
    // Show modal with animation
    setTimeout(() => chatModal.classList.add('show'), 10);
    
    // Focus on input
    document.getElementById('chat-message-input').focus();
}

/**
 * Set up event listeners for the chat modal
 */
function setupChatEventListeners() {
    const messageInput = document.getElementById('chat-message-input');
    const sendBtn = document.getElementById('chat-send-btn');
    
    // Send message on Enter key
    messageInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });
    
    // Enable/disable send button based on input
    messageInput.addEventListener('input', () => {
        const hasText = messageInput.value.trim().length > 0;
        sendBtn.disabled = !hasText;
        sendBtn.classList.toggle('disabled', !hasText);
    });
    
    // Close modal on background click
    chatModal.addEventListener('click', (e) => {
        if (e.target === chatModal) {
            closeChatModal();
        }
    });
}

/**
 * Send a new message in the active chat
 */
window.sendMessage = async function() {
    const messageInput = document.getElementById('chat-message-input');
    const text = messageInput.value.trim();
    
    if (!text || !activeChatId) return;
    
    try {
        const currentUserUid = auth.currentUser.uid;
        const messagesColRef = collection(db, "chats", activeChatId, "messages");
        
        // Sanitize the message text
        const sanitizedText = sanitizeText(text);
        
        // Get chat data to find the recipient
        const chatDocRef = doc(db, "chats", activeChatId);
        const chatSnap = await getDoc(chatDocRef);
        const chatData = chatSnap.data();
        
        // Find the recipient (the other participant)
        const recipientUid = chatData.participants.find(p => p !== currentUserUid);
        
        // Add the new message to the subcollection
        await addDoc(messagesColRef, {
            senderId: currentUserUid,
            text: sanitizedText,
            timestamp: serverTimestamp()
        });

        // Update the 'lastMessage' field on the parent chat document
        await updateDoc(chatDocRef, {
            lastMessage: { 
                text: sanitizedText, 
                senderId: currentUserUid, 
                timestamp: serverTimestamp() 
            },
            updatedAt: serverTimestamp()
        });
        
        // Create notification for the recipient (if not sending to self)
        if (recipientUid && recipientUid !== currentUserUid) {
            await createNotification(recipientUid, currentUserUid, chatData, activeChatId);
        }
        
        // Clear input
        messageInput.value = '';
        document.getElementById('chat-send-btn').disabled = true;
        document.getElementById('chat-send-btn').classList.add('disabled');
        
    } catch (error) {
        console.error('Error sending message:', error);
        handleError(error, 'Failed to send message. Please try again.');
    }
};

/**
 * Listen for real-time messages in the active chat
 * @param {string} chatId - The chat document ID
 */
function listenForMessages(chatId) {
    const messagesColRef = collection(db, "chats", chatId, "messages");
    const q = query(messagesColRef, orderBy("timestamp", "asc"));

    messageListener = onSnapshot(q, (querySnapshot) => {
        const messagesContainer = document.getElementById('chat-messages');
        messagesContainer.textContent = '';
        
        if (querySnapshot.empty) {
            const noMsgDiv = document.createElement('div');
            noMsgDiv.className = 'no-messages';
            const p = document.createElement('p');
            p.textContent = 'Start the conversation! 👋';
            noMsgDiv.appendChild(p);
            messagesContainer.appendChild(noMsgDiv);
            return;
        }
        
        const currentUserUid = auth.currentUser.uid;
        
        querySnapshot.forEach((doc) => {
            const message = doc.data();
            displayMessage(message, currentUserUid);
        });
        
        // Scroll to bottom
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }, (error) => {
        console.error('Error listening to messages:', error);
        handleError(error, 'Error loading messages');
    });
}

/**
 * Display a single message in the chat interface
 * @param {Object} message - The message data
 * @param {string} currentUserUid - The current user's UID
 */
function displayMessage(message, currentUserUid) {
    const messagesContainer = document.getElementById('chat-messages');
    const isOwnMessage = message.senderId === currentUserUid;
    
    // Format timestamp
    const timestamp = message.timestamp?.toDate?.() || new Date();
    const timeString = timestamp.toLocaleTimeString([], { 
        hour: '2-digit', 
        minute: '2-digit' 
    });
    
    const messageElement = document.createElement('div');
    messageElement.className = `chat-message ${isOwnMessage ? 'own-message' : 'other-message'}`;
    const bubbleDiv = document.createElement('div');
    bubbleDiv.className = 'message-bubble';
    const textDiv = document.createElement('div');
    textDiv.className = 'message-text';
    textDiv.textContent = message.text;
    const timeDiv = document.createElement('div');
    timeDiv.className = 'message-time';
    timeDiv.textContent = timeString;
    bubbleDiv.appendChild(textDiv);
    bubbleDiv.appendChild(timeDiv);
    messageElement.appendChild(bubbleDiv);
    
    messagesContainer.appendChild(messageElement);
}

/**
 * Close the chat modal
 */
window.closeChatModal = function() {
    if (chatModal) {
        chatModal.classList.remove('show');
        
        // Clean up listener
        if (messageListener) {
            messageListener();
            messageListener = null;
        }
        
        // Remove modal after animation
        setTimeout(() => {
            chatModal.remove();
            chatModal = null;
            activeChatId = null;
        }, 300);
    }
};

/**
 * Get all chats for the current user
 * @returns {Promise<Array>} Array of chat documents
 */
export async function getUserChats() {
    try {
        const currentUserUid = auth.currentUser?.uid;
        if (!currentUserUid) throw new Error('User not authenticated');

        const chatsQuery = query(
            collection(db, "chats"),
            where("participants", "array-contains", currentUserUid),
            orderBy("updatedAt", "desc")
        );

        const querySnapshot = await getDocs(chatsQuery);
        return querySnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
        
    } catch (error) {
        console.error('Error getting user chats:', error);
        throw error;
    }
}

/**
 * Listen for real-time updates to user's chats
 * @param {Function} callback - Callback function to handle chat updates
 */
export function listenToUserChats(callback) {
    const currentUserUid = auth.currentUser?.uid;
    if (!currentUserUid) return null;

    const chatsQuery = query(
        collection(db, "chats"),
        where("participants", "array-contains", currentUserUid),
        orderBy("updatedAt", "desc")
    );

    return onSnapshot(chatsQuery, (querySnapshot) => {
        const chats = querySnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
        callback(chats);
    });
}

/**
 * Create a notification for a user
 * @param {string} recipientUid - The user who should receive the notification
 * @param {string} senderUid - The user who triggered the notification
 * @param {Object} chatData - The chat document data
 * @param {string} chatId - The chat ID
 */
async function createNotification(recipientUid, senderUid, chatData, chatId) {
    try {
        const currentUser = auth.currentUser;
        const senderName = currentUser.displayName || currentUser.email?.split('@')[0] || 'Someone';
        
        const notificationsRef = collection(db, "notifications");
        await addDoc(notificationsRef, {
            recipientId: recipientUid,
            senderId: senderUid,
            senderName: senderName,
            type: "NEW_CHAT_MESSAGE",
            isRead: false,
            relatedItemId: chatData.itemId || '',
            relatedItemTitle: chatData.itemTitle || 'Chat',
            chatId: chatId,
            createdAt: serverTimestamp()
        });
        
        console.log('Notification created successfully');
    } catch (error) {
        console.error('Error creating notification:', error);
        // Don't throw error to avoid disrupting message sending
    }
}

// Export the main function for global access
window.initiateChat = initiateChat;
