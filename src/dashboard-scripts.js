// src/dashboard-scripts.js

// ===== START: FIREBASE AUTH GUARD =====
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { 
    getFirestore, 
    collection, 
    query, 
    where, 
    onSnapshot,
    orderBy,
    limit,
    getDocs
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { firebaseConfig } from './firebase-config.js';

// Import notification system
import './notification-system.js';

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Function to extract first name and update greeting
function updateGreetingWithUser(user) {
    // Get time-based greeting
    const hour = new Date().getHours();
    let timeGreeting = '';
    if (hour < 12) timeGreeting = 'Good morning';
    else if (hour < 17) timeGreeting = 'Good afternoon';
    else timeGreeting = 'Good evening';
    
    let motivationalText = '';
    if (hour < 12) motivationalText = 'Ready to start strong?';
    else if (hour < 17) motivationalText = 'Keep the momentum going!';
    else motivationalText = 'Ready to conquer the night?';
    
    // Extract first name from user display name
    let firstName = 'Stud'; // Default fallback
    if (user && user.displayName) {
        // Split display name and get first part
        const nameParts = user.displayName.trim().split(' ');
        const firstPart = nameParts[0];
        
        // Keep "Stud" for demo users or generic names, otherwise use first name
        if (firstPart && firstPart.toLowerCase() !== 'user' && firstPart.toLowerCase() !== 'student') {
            firstName = firstPart;
        }
    }
    
    // Update greeting element if it exists with enhanced animations
    const greetingElement = document.querySelector('.greeting h2');
    if (greetingElement) {
        // SECURE: Create elements programmatically to prevent XSS
        greetingElement.textContent = `${timeGreeting}, `;
        
        const nameSpan = document.createElement('span');
        nameSpan.id = 'user-name';
        nameSpan.textContent = firstName; // Safe: textContent prevents XSS
        nameSpan.style.display = 'inline-block';
        nameSpan.style.opacity = '0'; // Will be animated in by CSS
        nameSpan.style.animation = 'greetingSlideIn 0.8s ease-out 0.3s forwards, nameGlow 3s ease-in-out 1s infinite';
        
        const motivationText = document.createTextNode(`! ${motivationalText}`);
        
        greetingElement.appendChild(nameSpan);
        greetingElement.appendChild(motivationText);

        // Add a subtle greeting container animation
        const greetingContainer = document.querySelector('.greeting');
        if (greetingContainer) {
            greetingContainer.style.animation = 'fadeInUp 0.6s ease-out';
        }
    }
}

// Check if user is authenticated

onAuthStateChanged(auth, (user) => {
    if (user) {
        // User is signed in, stay on the page.
        console.log("User is logged in:", user);
        // We can now update the UI with user info
        const userDisplayName = document.getElementById('user-display-name');
        const userProfilePic = document.getElementById('user-profile-pic');
        if (userDisplayName) userDisplayName.textContent = user.displayName;
        if (userProfilePic) {
            if (user.photoURL) {
                userProfilePic.src = user.photoURL;
            } else {
                const userName = user.displayName || user.email || 'Student';
                userProfilePic.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(userName)}&size=150&background=random`;
            }
        }
        
        // Update greeting with user's first name
        updateGreetingWithUser(user);
        
        // Update Lost & Found stats
        updateLostAndFoundStats();
        
        // Update Assignment Help stats
        updateAssignmentHelpStats();
        
        // Update Hostel Market stats
        updateHostelMarketStats();
        
        // Update My Chats stats
        updateMyChatsStats(user);
        
        // === ENHANCED SESSION MANAGEMENT ===
        setupSessionManagement(user);
    } else {
        // No user is signed in. Redirect to login page.
        console.log("No user found, redirecting to login.");
        window.location.href = 'login.html';
    }
});

// === SESSION MANAGEMENT FUNCTIONS ===
function setupSessionManagement(user) {
    // Auto logout after 24 hours of inactivity
    const AUTO_LOGOUT_TIME = 24 * 60 * 60 * 1000; // 24 hours
    let inactivityTimer = null;
    let lastActivity = Date.now();
    
    // Track user activity
    const trackActivity = () => {
        lastActivity = Date.now();
        resetInactivityTimer();
    };
    
    const resetInactivityTimer = () => {
        if (inactivityTimer) {
            clearTimeout(inactivityTimer);
        }
        
        inactivityTimer = setTimeout(() => {
            console.log('Auto-logout due to inactivity');
            handleSignOut();
        }, AUTO_LOGOUT_TIME);
    };
    
    // Add activity listeners
    const activityEvents = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];
    activityEvents.forEach(event => {
        document.addEventListener(event, trackActivity, { passive: true });
    });
    
    // Token refresh every hour
    const TOKEN_REFRESH_INTERVAL = 60 * 60 * 1000; // 1 hour
    const refreshAuthToken = () => {
        if (auth.currentUser) {
            auth.currentUser.getIdToken(true)
                .then(token => {
                    console.log('Token refreshed successfully');
                })
                .catch(error => {
                    console.error('Token refresh failed:', error);
                    // If token refresh fails, sign out for security
                    if (error.code === 'auth/user-token-expired') {
                        console.log('Token expired, signing out');
                        handleSignOut();
                    }
                });
        }
    };
    
    // Set up token refresh interval
    setInterval(refreshAuthToken, TOKEN_REFRESH_INTERVAL);
    
    // Initial timer setup
    resetInactivityTimer();
    
    // Session information for debugging (remove in production)
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        console.log('Session management initialized for user:', user.uid);
        console.log('Auto-logout set to:', AUTO_LOGOUT_TIME / (1000 * 60 * 60), 'hours');
    }
}


const handleSignOut = () => {
    signOut(auth).then(() => {
        // Sign-out successful. Redirect to login.
        console.log("User signed out successfully.");
        window.location.href = 'login.html';
    }).catch((error) => {
        // An error happened.
        console.error("Sign out error:", error);
    });
};

// Make handleSignOut globally accessible
window.handleSignOut = handleSignOut;

// ===== LOST & FOUND STATS UPDATE =====
function updateLostAndFoundStats() {
    const lostFoundCard = document.querySelector('[data-route="lostfound"]');
    const analyticsMetric = document.getElementById('lost-found-metric');
    
    console.log('Attempting to load Lost & Found stats...');
    
    // Simple query to get all items first, then filter manually if needed
    const allItemsQuery = collection(db, 'lostAndFoundItems');

    // Real-time listener for stats
    onSnapshot(allItemsQuery, (querySnapshot) => {
        // Filter for open items manually
        let openItemsCount = 0;
        querySnapshot.forEach((doc) => {
            const data = doc.data();
            if (data.status === 'open') {
                openItemsCount++;
            }
        });
        
        console.log('Found open items:', openItemsCount);
        
        // Update card stat
        if (lostFoundCard) {
            const statElement = lostFoundCard.querySelector('.card-stat');
            if (statElement) {
                if (openItemsCount === 0) {
                    statElement.textContent = 'No open cases';
                } else if (openItemsCount === 1) {
                    statElement.textContent = '1 open case';
                } else {
                    statElement.textContent = `${openItemsCount} open cases`;
                }
            }
        }
        
        // Update analytics metric
        if (analyticsMetric) {
            analyticsMetric.textContent = openItemsCount.toString();
        }
    }, (error) => {
        console.error('Error fetching lost & found stats:', error);
        console.error('Error code:', error.code);
        console.error('Error message:', error.message);
        
        // Update with error state
        if (lostFoundCard) {
            const statElement = lostFoundCard.querySelector('.card-stat');
            if (statElement) {
                statElement.textContent = 'Stats unavailable';
            }
        }
        
        if (analyticsMetric) {
            analyticsMetric.textContent = 'Error';
        }
    });
}

// ===== ASSIGNMENT HELP STATS UPDATE =====
function updateAssignmentHelpStats() {
    console.log('Attempting to load Assignment Help stats...');
    
    // First, let's try to get all assignment requests to debug
    const allAssignmentsQuery = collection(db, 'assignmentRequests');
    
    onSnapshot(allAssignmentsQuery, (querySnapshot) => {
        console.log('Total assignment requests in database:', querySnapshot.size);
        
        // Debug: Log all documents to see their structure
        let openCount = 0;
        querySnapshot.forEach((doc) => {
            const data = doc.data();
            console.log('Assignment request:', {
                id: doc.id,
                title: data.title,
                completed: data.completed
            });
            if (data.completed === false) {
                openCount++;
            }
        });
        
        console.log('Found open assignment requests:', openCount);
        
        // Update card stat
        const statElement = document.getElementById('assignment-help-stat');
        if (statElement) {
            if (openCount === 0) {
                statElement.textContent = 'No open requests';
            } else if (openCount === 1) {
                statElement.textContent = '1 open request';
            } else {
                statElement.textContent = `${openCount} open requests`;
            }
        }
    }, (error) => {
        console.error('Error fetching assignment help stats:', error);
        
        // Update with error state
        const statElement = document.getElementById('assignment-help-stat');
        if (statElement) {
            statElement.textContent = 'Stats unavailable';
        }
    });
}

// ===== HOSTEL MARKET STATS UPDATE =====
function updateHostelMarketStats() {
    console.log('Attempting to load Hostel Market stats...');
    
    // Updated to use the correct field name: isSold instead of status
    const allListingsQuery = collection(db, 'marketListings');
    
    onSnapshot(allListingsQuery, (querySnapshot) => {
        console.log('Total market listings in database:', querySnapshot.size);
        
        // Debug: Log all documents to see their structure
        let availableCount = 0;
        querySnapshot.forEach((doc) => {
            const data = doc.data();
            console.log('Market listing:', {
                id: doc.id,
                name: data.name,
                isSold: data.isSold,
                price: data.price
            });
            if (data.isSold === false) {
                availableCount++;
            }
        });
        
        console.log('Found available market items:', availableCount);
        
        // Update card stat
        const statElement = document.getElementById('hostel-market-stat');
        if (statElement) {
            if (availableCount === 0) {
                statElement.textContent = 'No items available';
            } else if (availableCount === 1) {
                statElement.textContent = '1 item available';
            } else {
                statElement.textContent = `${availableCount} items available`;
            }
        }
    }, (error) => {
        console.error('Error fetching hostel market stats:', error);
        
        // Update with error state
        const statElement = document.getElementById('hostel-market-stat');
        if (statElement) {
            statElement.textContent = 'Stats unavailable';
        }
    });
}

// ===== MY CHATS STATS UPDATE =====
function updateMyChatsStats(user) {
    if (!user) {
        console.log('No user provided for chat stats');
        return;
    }
    
    console.log('Attempting to load My Chats stats for user:', user.uid);
    
    // Query for all chats to debug the structure
    const allChatsQuery = collection(db, 'chats');
    
    onSnapshot(allChatsQuery, (querySnapshot) => {
        console.log('Total chats in database:', querySnapshot.size);
        
        // Debug: Log all documents to see their structure
        let userChatsCount = 0;
        querySnapshot.forEach((doc) => {
            const data = doc.data();
            console.log('Chat document:', {
                id: doc.id,
                participants: data.participants,
                userInChat: data.participants && data.participants.includes(user.uid)
            });
            if (data.participants && data.participants.includes(user.uid)) {
                userChatsCount++;
            }
        });
        
        console.log('Found active chats for user:', userChatsCount);
        
        // Update card stat
        const statElement = document.getElementById('my-chats-stat');
        if (statElement) {
            if (userChatsCount === 0) {
                statElement.textContent = 'No active chats';
            } else if (userChatsCount === 1) {
                statElement.textContent = '1 active chat';
            } else {
                statElement.textContent = `${userChatsCount} active chats`;
            }
        }
    }, (error) => {
        console.error('Error fetching my chats stats:', error);
        
        // Update with error state
        const statElement = document.getElementById('my-chats-stat');
        if (statElement) {
            statElement.textContent = 'Stats unavailable';
        }
    });
}

// ===== FETCH LATEST ACTIVITY FOR BUZZ WIDGET =====
async function fetchLatestActivity() {
    try {
        console.log('Fetching latest activity across platform...');

        // Create queries for each collection to get the most recent item
        const assignmentRequestsQuery = query(
            collection(db, 'assignmentRequests'),
            orderBy('createdAt', 'desc'),
            limit(1)
        );

        const marketListingsQuery = query(
            collection(db, 'marketListings'),
            orderBy('createdAt', 'desc'),
            limit(1)
        );

        const lostAndFoundQuery = query(
            collection(db, 'lostAndFoundItems'),
            orderBy('createdAt', 'desc'),
            limit(1)
        );

        // Execute all queries concurrently for better performance
        const [assignmentSnapshot, marketSnapshot, lostFoundSnapshot] = await Promise.all([
            getDocs(assignmentRequestsQuery),
            getDocs(marketListingsQuery),
            getDocs(lostAndFoundQuery)
        ]);

        // Collect all latest items with their metadata
        const latestItems = [];

        // Process assignment requests
        assignmentSnapshot.forEach(doc => {
            const data = doc.data();
            latestItems.push({
                type: 'assignment',
                data: data,
                createdAt: data.createdAt?.toDate() || new Date(),
                id: doc.id
            });
        });

        // Process market listings
        marketSnapshot.forEach(doc => {
            const data = doc.data();
            latestItems.push({
                type: 'market',
                data: data,
                createdAt: data.createdAt?.toDate() || new Date(),
                id: doc.id
            });
        });

        // Process lost & found items
        lostFoundSnapshot.forEach(doc => {
            const data = doc.data();
            latestItems.push({
                type: 'lostfound',
                data: data,
                createdAt: data.createdAt?.toDate() || new Date(),
                id: doc.id
            });
        });

        // Sort by createdAt timestamp to get the most recent activities
        latestItems.sort((a, b) => b.createdAt - a.createdAt);

        // Take only the top 3 most recent activities
        const topThreeActivities = latestItems.slice(0, 3);

        console.log('Latest activities fetched:', topThreeActivities);
        return topThreeActivities;

    } catch (error) {
        console.error('Error fetching latest activity:', error);
        // Return fallback content
        return [
            {
                type: 'fallback',
                data: { title: 'Welcome to After Hours Hub!' },
                createdAt: new Date(),
                id: 'fallback-1'
            },
            {
                type: 'fallback', 
                data: { title: 'Connect with your study community' },
                createdAt: new Date(Date.now() - 60000),
                id: 'fallback-2'
            },
            {
                type: 'fallback',
                data: { title: 'Share, learn, and grow together' },
                createdAt: new Date(Date.now() - 120000),
                id: 'fallback-3'
            }
        ];
    }
}

// ===== UPDATE BUZZ WIDGET WITH LIVE DATA =====
function updateBuzzWidget(activities) {
    const timelineItems = document.querySelectorAll('.timeline-content');
    
    activities.forEach((activity, index) => {
        if (index < timelineItems.length && timelineItems[index]) {
            const timelineContent = timelineItems[index];
            const textElement = timelineContent.querySelector('p');
            const timeElement = timelineContent.querySelector('.timeline-time');
            const timelineItem = timelineContent.closest('.timeline-item');
            const dotIcon = timelineItem?.querySelector('.timeline-dot i');

            if (textElement && timeElement) {
                // Generate content based on activity type
                let contentElements = [];
                let timeAgo = getTimeAgo(activity.createdAt);
                let icon = 'ph-fill ph-pulse'; // Default icon

                switch (activity.type) {
                    case 'assignment':
                        const title = activity.data.title || 'Assignment Help Request';
                        const authorName = activity.data.authorName || 'Someone';
                        
                        const authorBold = document.createElement('b');
                        authorBold.textContent = authorName;
                        contentElements = [authorBold, ' needs help with: "', title, '"'];
                        icon = 'ph-fill ph-books';
                        break;

                    case 'market':
                        const itemName = activity.data.name || 'Item';
                        const sellerName = activity.data.sellerName || 'Someone';
                        
                        const sellerBold = document.createElement('b');
                        sellerBold.textContent = sellerName;
                        contentElements = [sellerBold, ' listed: "', itemName, '" in marketplace'];
                        icon = 'ph-fill ph-tag';
                        break;

                    case 'lostfound':
                        const lostFoundTitle = activity.data.itemName || 'Item';
                        const reporterName = activity.data.reportedBy?.displayName || 'Someone';
                        const isLost = activity.data.itemType === 'lost';
                        
                        const reporterBold = document.createElement('b');
                        reporterBold.textContent = reporterName;
                        contentElements = [reporterBold, ` ${isLost ? 'lost' : 'found'}: "`, lostFoundTitle, '"'];
                        icon = 'ph-fill ph-magnifying-glass';
                        break;

                    case 'fallback':
                        const fallbackBold = document.createElement('b');
                        fallbackBold.textContent = activity.data.title || '';
                        contentElements = [fallbackBold];
                        icon = 'ph-fill ph-hands-clapping';
                        break;

                    default:
                        content = '<b>New activity</b> in After Hours Hub';
                        icon = 'ph-fill ph-pulse';
                }

                // Update the icon
                if (dotIcon) {
                    dotIcon.className = `${icon}`;
                    dotIcon.style.fontSize = '0.8rem';
                    dotIcon.style.color = 'var(--bg-color)';
                }

                // Smooth transition from skeleton to content
                textElement.style.opacity = '0';
                timeElement.style.opacity = '0';
                
                setTimeout(() => {
                    textElement.classList.remove('skeleton');
                    timeElement.classList.remove('skeleton');
                    
                    // Clear existing content and append new elements safely
                    textElement.textContent = '';
                    for (const element of contentElements) {
                        if (typeof element === 'string') {
                            textElement.appendChild(document.createTextNode(element));
                        } else {
                            textElement.appendChild(element);
                        }
                    }
                    
                    timeElement.textContent = timeAgo;
                    textElement.style.height = 'auto';
                    textElement.style.width = 'auto';
                    textElement.style.opacity = '1';
                    timeElement.style.opacity = '1';
                }, 200 + (index * 100)); // Stagger the animations
            }
        }
    });
}

// ===== HELPER FUNCTIONS =====
function getTimeAgo(date) {
    const now = new Date();
    const diffInMilliseconds = now - date;
    const diffInMinutes = Math.floor(diffInMilliseconds / (1000 * 60));
    const diffInHours = Math.floor(diffInMinutes / 60);
    const diffInDays = Math.floor(diffInHours / 24);

    if (diffInMinutes < 1) {
        return 'Just now';
    } else if (diffInMinutes < 60) {
        return `${diffInMinutes} min${diffInMinutes !== 1 ? 's' : ''} ago`;
    } else if (diffInHours < 24) {
        return `${diffInHours} hour${diffInHours !== 1 ? 's' : ''} ago`;
    } else if (diffInDays < 7) {
        return `${diffInDays} day${diffInDays !== 1 ? 's' : ''} ago`;
    } else {
        return date.toLocaleDateString();
    }
}

// ===== END: FIREBASE AUTH GUARD =====


// Your existing dashboard-scripts.js code follows...
// Wait for the DOM to be fully loaded before running scripts
document.addEventListener('DOMContentLoaded', () => {

    // === ELEMENT SELECTION & VALIDATION ===
    const elements = {
        timeDisplay: document.getElementById('time-display'),
        dateDisplay: document.getElementById('date-display'),
        searchInput: document.querySelector('.search-input'),
        searchIcon: document.querySelector('.search-icon'),
        // ...existing code...
        notificationBell: document.querySelector('.notification-bell'),
        notificationBadge: document.querySelector('.notification-badge'),
        // ...existing code...
        themeToggle: document.getElementById('theme-toggle'),
        featureCards: document.querySelectorAll('.card'),
        sidebarToggle: document.getElementById('sidebar-toggle'),
        sidebar: document.querySelector('aside'),
        progressValue: document.querySelector('.progress-value'), // Updated from progressFill
        greeting: document.querySelector('.greeting h2'),
        metrics: document.querySelectorAll('.metric-value'),
        profileDropdownBtn: document.getElementById('profile-dropdown-btn'),
        profileDropdown: document.getElementById('profile-dropdown'),
        signOutBtn: document.getElementById('sign-out-btn')
    };

    // Basic validation to ensure critical elements exist
    const missingElements = [];
    const criticalElements = ['timeDisplay', 'dateDisplay', 'themeToggle', 'sidebar']; // Essential elements
    
    for (const key in elements) {
        if (!elements[key] || (elements[key] instanceof NodeList && elements[key].length === 0)) {
            missingElements.push(key);
            // Only warn for critical elements
            if (criticalElements.includes(key)) {
                console.warn(`Critical element not found: ${key}. Dashboard functionality may be limited.`);
            }
        }
    }
    
    if (missingElements.length === 0) {
        console.log('✅ Dashboard initialized successfully - All elements found');
    } else {
        console.log(`✅ Dashboard initialized - ${Object.keys(elements).length - missingElements.length}/${Object.keys(elements).length} elements found`);
        if (missingElements.some(el => criticalElements.includes(el))) {
            console.warn('⚠️ Some critical elements are missing. Dashboard may have limited functionality.');
        }
    }
    
    // --- VARIABLE DECLARATIONS FOR INTERVALS & STATE ---
    let clockIntervalId = null;
    let notificationIntervalId = null;
    let isDarkMode = true;
    let searchTimeout;

    // --- COMING SOON NOTIFICATION FUNCTION ---
    function showComingSoonNotification(featureName) {
        // Create notification element
        const notification = document.createElement('div');
        notification.className = 'coming-soon-notification';
        
        // Create notification content with proper escaping
        const iconElement = document.createElement('i');
        iconElement.className = 'ph-bold ph-rocket-launch';
        const titleText = document.createElement('div');
        titleText.className = 'notification-title';
        titleText.textContent = 'Coming Soon!';
        
        const messageText = document.createElement('div');
        messageText.className = 'notification-message';
        messageText.textContent = `${featureName} is currently under development. Stay tuned!`;
        
        // Assemble notification
        notification.appendChild(iconElement);
        notification.appendChild(titleText);
        notification.appendChild(messageText);
        
        // Add to body
        document.body.appendChild(notification);
        
        // Animate in
        setTimeout(() => {
            notification.classList.add('show');
        }, 100);
        
        // Animate out and remove
        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => {
                if (document.body.contains(notification)) {
                    document.body.removeChild(notification);
                }
            }, 300); // Wait for animation to complete
        }, 3000); // Show for 3 seconds
    }

    // --- 1. DYNAMIC CLOCK AND DATE ---
    function updateClock() {
        try { 
            const now = new Date();
            const timeString = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
            const dateString = now.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' });
            elements.timeDisplay.textContent = timeString;
            elements.dateDisplay.textContent = dateString;
        } catch (error) {
            console.error('Clock update failed:', error);
            elements.timeDisplay.textContent = 'Time unavailable';
            elements.dateDisplay.textContent = 'Date unavailable';
        }
    }
    updateClock();
    clockIntervalId = setInterval(updateClock, 1000);

    // --- 2. THEME TOGGLE FUNCTIONALITY ---
    const root = document.documentElement;
    elements.themeToggle.addEventListener('click', () => {
        isDarkMode = !isDarkMode;
        
        // Update ARIA attribute
        elements.themeToggle.setAttribute('aria-pressed', isDarkMode ? 'true' : 'false');
        
        if (isDarkMode) {
            root.style.setProperty('--bg-color', '#0B0E1A');
            root.style.setProperty('--text-color', '#F0F2F5');
            root.style.setProperty('--text-secondary', '#B8BCC8');
            root.style.setProperty('--glass-bg', 'rgba(20, 25, 40, 0.75)');
            root.style.setProperty('--glass-border', 'rgba(255, 255, 255, 0.15)');
            // Clear existing content and add sun icon
            elements.themeToggle.textContent = '';
            const sunIcon = document.createElement('i');
            sunIcon.className = 'ph-bold ph-sun';
            elements.themeToggle.appendChild(sunIcon);
            elements.themeToggle.setAttribute('aria-label', 'Switch to light mode');
        } else {
            root.style.setProperty('--bg-color', '#FAFBFC');
            root.style.setProperty('--text-color', '#1A202C');
            root.style.setProperty('--text-secondary', '#4A5568');
            root.style.setProperty('--glass-bg', 'rgba(255, 255, 255, 0.85)');
            root.style.setProperty('--glass-border', 'rgba(0, 0, 0, 0.08)');
            // Clear existing content and add moon icon
            elements.themeToggle.textContent = '';
            const moonIcon = document.createElement('i');
            moonIcon.className = 'ph-bold ph-moon';
            elements.themeToggle.appendChild(moonIcon);
            elements.themeToggle.setAttribute('aria-label', 'Switch to dark mode');
        }
    });
    
    // Add keyboard support for theme toggle
    elements.themeToggle.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            elements.themeToggle.click();
        }
    });

    // --- 3. SIDEBAR TOGGLE FOR MOBILE ---
    function handleResize() {
        if (window.innerWidth <= 1024) {
            elements.sidebarToggle.style.display = 'flex';
        } else {
            elements.sidebarToggle.style.display = 'none';
            elements.sidebar.classList.remove('open');
        }
    }
    elements.sidebarToggle.addEventListener('click', () => elements.sidebar.classList.toggle('open'));
    window.addEventListener('resize', handleResize);
    handleResize(); // Initial check

    // --- 4. ENHANCED CARD INTERACTIONS ---
    elements.featureCards.forEach(card => {
        card.addEventListener('click', (e) => {
            e.stopPropagation();
            
            // Get route and feature name
            const route = card.dataset.route;
            const featureName = card.querySelector('.card-title')?.textContent || 'Feature';
            
            // Handle different routes
            switch (route) {
                case 'help':
                    window.location.href = 'assign-help.html';
                    return;
                case 'market':
                    window.location.href = 'hostel-market.html';
                    return;
                case 'lostfound':
                    window.location.href = 'lost-and-found.html';
                    return;
                case 'chats':
                    window.location.href = 'chats.html';
                    return;
                case 'esports':
                    window.location.href = 'esports-and-events.html';
                    return;
                case 'notes':
                case 'pyqs':
                case 'events':
                case 'clubs':
                    // These are in development - show coming soon notification
                    showComingSoonNotification(featureName);
                    return;
                default:
                    // For any other routes without specific handlers, show coming soon
                    if (route) {
                        showComingSoonNotification(featureName);
                        return;
                    }
                    break;
            }

            // Fallback to the original expand/collapse behavior for cards without routes
            const isExpanded = card.classList.contains('expanded');
            elements.featureCards.forEach(otherCard => otherCard.classList.remove('expanded'));
            if (!isExpanded) {
                card.classList.add('expanded');
            }
        });
    });
    document.addEventListener('click', () => {
        elements.featureCards.forEach(card => card.classList.remove('expanded'));
    });

    // --- 5. ENHANCED SEARCH FUNCTIONALITY ---
    function performSearch(query) {
        const normalizedQuery = query.toLowerCase().trim();
        let visibleCount = 0;
        
        elements.featureCards.forEach(card => {
            if (!card._searchData) {
                card._searchData = {
                    title: card.querySelector('.card-title')?.textContent.toLowerCase() || '',
                    tagline: card.querySelector('.card-tagline')?.textContent.toLowerCase() || '',
                    details: card.querySelector('.card-details p')?.textContent.toLowerCase() || '',
                    route: card.dataset.route || ''
                };
            }
            const searchableText = `${card._searchData.title} ${card._searchData.tagline} ${card._searchData.details} ${card._searchData.route}`;
            const matches = normalizedQuery === '' || searchableText.includes(normalizedQuery);
            
            if (matches) {
                card.style.opacity = '1';
                card.style.transform = 'scale(1)';
                visibleCount++;
            } else {
                card.style.opacity = '0.2';
                card.style.transform = 'scale(0.95)';
            }
        });
    }

    elements.searchInput.addEventListener('input', (e) => {
        clearTimeout(searchTimeout);
        elements.searchIcon.className = 'ph-bold ph-spinner search-icon'; // Loading state
        searchTimeout = setTimeout(() => {
            performSearch(e.target.value);
            elements.searchIcon.className = 'ph-bold ph-magnifying-glass search-icon'; // Reset icon
        }, 300);
    });

    // --- 6. NOTIFICATION SYSTEM ---
    // Note: Notification functionality is handled by notification-system.js
    // Add keyboard support for notification bell
    elements.notificationBell?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            elements.notificationBell.click();
        }
    });

    // --- 7. PROFILE DROPDOWN FUNCTIONALITY ---
    elements.profileDropdownBtn?.addEventListener('click', (e) => {
        e.stopPropagation();
        const isHidden = elements.profileDropdown?.classList.contains('hidden');
        
        elements.profileDropdown?.classList.toggle('hidden');
        
        // Update ARIA attributes
        const isExpanded = !elements.profileDropdown?.classList.contains('hidden');
        elements.profileDropdownBtn?.setAttribute('aria-expanded', isExpanded.toString());
        
        // Rotate the caret icon
        const caretIcon = elements.profileDropdownBtn.querySelector('i');
        if (caretIcon) {
            caretIcon.style.transform = isExpanded ? 'rotate(180deg)' : 'rotate(0deg)';
        }
    });
    
    // Close profile dropdown when clicking outside
    document.addEventListener('click', (e) => {
        if (!elements.profileDropdownBtn?.contains(e.target)) {
            elements.profileDropdown?.classList.add('hidden');
            elements.profileDropdownBtn?.setAttribute('aria-expanded', 'false');
            const caretIcon = elements.profileDropdownBtn?.querySelector('i');
            if (caretIcon) {
                caretIcon.style.transform = 'rotate(0deg)';
            }
        }
    });

    // --- 8. WIDGET ANIMATIONS ---
    
    // Load dynamic content for buzz widget
    setTimeout(async () => {
        try {
            const latestActivities = await fetchLatestActivity();
            updateBuzzWidget(latestActivities);
        } catch (error) {
            console.error('Error loading buzz widget content:', error);
            // Fallback to default content
            updateBuzzWidget([
                {
                    type: 'fallback',
                    data: { title: 'Welcome to After Hours Hub!' },
                    createdAt: new Date(),
                    id: 'fallback-1'
                },
                {
                    type: 'fallback', 
                    data: { title: 'Connect with your study community' },
                    createdAt: new Date(Date.now() - 60000),
                    id: 'fallback-2'
                },
                {
                    type: 'fallback',
                    data: { title: 'Share, learn, and grow together' },
                    createdAt: new Date(Date.now() - 120000),
                    id: 'fallback-3'
                }
            ]);
        }
    }, 2000);

    // Analytics Number Counting
    function animateMetrics() {
        elements.metrics.forEach(metric => {
            const finalValue = parseInt(metric.textContent.trim().replace(/,/g, ''), 10);
            if (isNaN(finalValue)) {
                console.warn('Invalid metric value:', metric.textContent);
                return; // Correctly skip non-numeric metrics
            }
            let startValue = 0;
            const duration = 2000; // 2 seconds
            const stepTime = 30; // ~33fps
            const totalSteps = duration / stepTime;
            const increment = finalValue / totalSteps;

            const timer = setInterval(() => {
                startValue += increment;
                if (startValue >= finalValue) {
                    metric.textContent = finalValue.toLocaleString('en-US');
                    clearInterval(timer);
                } else {
                    metric.textContent = Math.floor(startValue).toLocaleString('en-US');
                }
            }, stepTime);
        });
    }

    // ===== UNIFIED RADIAL PROGRESS ANIMATION =====
    function animateRadialProgress() {
        const radialProgress = document.querySelector('.radial-progress');
        const progressValue = document.querySelector('.progress-value');
        
        if (!radialProgress || !progressValue) return;

        // Dynamic goal calculation based on time of day
        const currentHour = new Date().getHours();
        let goalPercentage;
        
        if (currentHour < 9) {
            goalPercentage = Math.min(30 + currentHour * 2, 45); // Early morning
        } else if (currentHour < 17) {
            goalPercentage = Math.min(50 + (currentHour - 9) * 3, 85); // Daytime
        } else if (currentHour < 22) {
            goalPercentage = Math.max(85 - (currentHour - 17) * 5, 60); // Evening
        } else {
            goalPercentage = Math.max(60 - (currentHour - 22) * 10, 25); // Late night
        }

        // Determine progress color based on percentage
        let progressColor;
        if (goalPercentage < 30) {
            progressColor = '#ff6b6b'; // Red for low progress
        } else if (goalPercentage < 70) {
            progressColor = '#FFD93D'; // Yellow for medium progress
        } else {
            progressColor = '#00cec9'; // Green for high progress
        }

        // Animation variables
        let currentPercentage = 0;
        const duration = 1500; // 1.5 seconds
        const stepTime = 16; // ~60fps
        const totalSteps = duration / stepTime;
        const increment = goalPercentage / totalSteps;

        // Clear any existing animation
        if (window.progressAnimationId) {
            clearInterval(window.progressAnimationId);
        }

        // Unified animation function - controls EVERYTHING in sync
        window.progressAnimationId = setInterval(() => {
            currentPercentage += increment;
            
            if (currentPercentage >= goalPercentage) {
                currentPercentage = goalPercentage;
                clearInterval(window.progressAnimationId);
            }
            
            // Update CSS variables (this controls both circle and dot position)
            radialProgress.style.setProperty('--progress-percent', currentPercentage);
            radialProgress.style.setProperty('--progress-color', progressColor);
            
            // Update text content
            progressValue.textContent = `${Math.round(currentPercentage)}%`;
            
        }, stepTime);

        console.log(`🎯 Goal set to ${goalPercentage}% based on time: ${currentHour}:00`);
    }

    setTimeout(animateMetrics, 1000);
    setTimeout(animateRadialProgress, 1200); // Start after metrics, single unified animation

    // Scroll-triggered animations
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('in-view');
            }
        });
    }, { threshold: 0.1 });

    document.querySelectorAll('.widget, .card').forEach(el => {
        el.classList.add('animate-on-scroll');
        observer.observe(el);
    });
    
    // --- 9. ACCESSIBILITY & CLEANUP ---
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Tab') document.body.classList.add('keyboard-navigation');
    });
    document.addEventListener('mousedown', () => {
        document.body.classList.remove('keyboard-navigation');
    });
    
    // Cleanup on page unload
    window.addEventListener('beforeunload', () => {
        console.log('Cleaning up intervals and observers...');
        if (clockIntervalId) clearInterval(clockIntervalId);
        if (notificationIntervalId) clearInterval(notificationIntervalId);
        if (observer) observer.disconnect();
    });

    // ===== ADD THIS AT THE END =====
    const signOutBtn = document.getElementById('sign-out-btn');
    if (signOutBtn) {
        // This makes the dropdown appear/disappear, for now, we just link the button directly
        signOutBtn.parentElement.parentElement.addEventListener('click', () => {
             signOutBtn.parentElement.classList.toggle('hidden');
        });
        signOutBtn.addEventListener('click', handleSignOut);
    }
});