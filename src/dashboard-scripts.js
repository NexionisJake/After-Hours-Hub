// src/dashboard-scripts.js

// ===== START: FIREBASE AUTH GUARD =====
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

// IMPORTANT: Use the SAME firebaseConfig from your firebase-auth.js file
const firebaseConfig = {
    apiKey: "AIzaSyBCO6Q8aCJBNF1dMy34TlviwQ3ivc3NvkE",
    authDomain: "after-hours-hub.firebaseapp.com",
    databaseURL: "https://after-hours-hub-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "after-hours-hub",
    storageBucket: "after-hours-hub.appspot.com",
    messagingSenderId: "267243470607",
    appId: "1:267243470607:web:b45dab5ba0828f2adf487a",
    measurementId: "G-0ZYV2HJNBE"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
// Check if user is authenticated

onAuthStateChanged(auth, (user) => {
    if (user) {
        // User is signed in, stay on the page.
        console.log("User is logged in:", user);
        // We can now update the UI with user info
        const userDisplayName = document.getElementById('user-display-name');
        const userProfilePic = document.getElementById('user-profile-pic');
        if (userDisplayName) userDisplayName.textContent = user.displayName;
        if (userProfilePic) userProfilePic.src = user.photoURL;
    } else {
        // No user is signed in. Redirect to login page.
        console.log("No user found, redirecting to login.");
        window.location.href = 'login.html';
    }
});

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
        progressFill: document.querySelector('.progress-fill'),
        greeting: document.querySelector('.greeting h2'),
        metrics: document.querySelectorAll('.metric-value'),
        profileDropdownBtn: document.getElementById('profile-dropdown-btn'),
        profileDropdown: document.getElementById('profile-dropdown'),
        signOutBtn: document.getElementById('sign-out-btn')
    };

    // Basic validation to ensure critical elements exist
    for (const key in elements) {
        if (!elements[key] || (elements[key] instanceof NodeList && elements[key].length === 0)) {
            console.error(`Critical element not found: ${key}. Dashboard may not function correctly.`);
            // return; // Optional: Stop script execution if a critical element is missing
        }
    }
    console.log('✅ Dashboard initialized successfully - All elements found');
    
    // --- VARIABLE DECLARATIONS FOR INTERVALS & STATE ---
    let clockIntervalId = null;
    let notificationIntervalId = null;
    let isDarkMode = true;
    let isDropdownOpen = false;
    let searchTimeout;

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

    // --- 2. DYNAMIC GREETING BASED ON TIME ---
    const hour = new Date().getHours();
    let timeGreeting = '';
    if (hour < 12) timeGreeting = 'Good morning';
    else if (hour < 17) timeGreeting = 'Good afternoon';
    else timeGreeting = 'Good evening';
    
    let motivationalText = '';
    if (hour < 12) motivationalText = 'Ready to start strong?';
    else if (hour < 17) motivationalText = 'Keep the momentum going!';
    else motivationalText = 'Ready to conquer the night?';

    if (elements.greeting) {
        elements.greeting.innerHTML = `${timeGreeting}, <span id="user-name">Stud</span>! ${motivationalText}`;
    }

    // --- 3. THEME TOGGLE FUNCTIONALITY ---
    const root = document.documentElement;
    elements.themeToggle.addEventListener('click', () => {
        isDarkMode = !isDarkMode;
        if (isDarkMode) {
            root.style.setProperty('--bg-color', '#0B0E1A');
            root.style.setProperty('--text-color', '#F0F2F5');
            root.style.setProperty('--text-secondary', '#B8BCC8');
            root.style.setProperty('--glass-bg', 'rgba(20, 25, 40, 0.75)');
            root.style.setProperty('--glass-border', 'rgba(255, 255, 255, 0.15)');
            elements.themeToggle.innerHTML = '<i class="ph-bold ph-sun"></i>';
        } else {
            root.style.setProperty('--bg-color', '#FAFBFC');
            root.style.setProperty('--text-color', '#1A202C');
            root.style.setProperty('--text-secondary', '#4A5568');
            root.style.setProperty('--glass-bg', 'rgba(255, 255, 255, 0.85)');
            root.style.setProperty('--glass-border', 'rgba(0, 0, 0, 0.08)');
            elements.themeToggle.innerHTML = '<i class="ph-bold ph-moon"></i>';
        }
    });

    // --- 4. SIDEBAR TOGGLE FOR MOBILE ---
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

    // --- 5. ENHANCED CARD INTERACTIONS ---
    elements.featureCards.forEach(card => {
        card.addEventListener('click', (e) => {
            e.stopPropagation();
            
            // --- NEW LOGIC ---
            // If the card has a data-route, navigate to the new page
            const route = card.dataset.route;
            if (route === 'help') {
                window.location.href = 'assignment-help.html';
                return; // Stop further execution
            }
            // --- END NEW LOGIC ---

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

    // --- 6. ENHANCED SEARCH FUNCTIONALITY ---
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

    // --- 7. NOTIFICATION SYSTEM (Enhanced with missing styles) ---
    const notificationDropdown = document.createElement('div');
    notificationDropdown.className = 'notification-dropdown';
    notificationDropdown.innerHTML = `<div style="padding: 1rem; text-align: center; color: var(--text-secondary);">No new notifications.</div>`;
    
    // Ensure notification bell has relative positioning
    elements.notificationBell.style.position = 'relative';
    elements.notificationBell.appendChild(notificationDropdown);
    
    function closeDropdown() {
        isDropdownOpen = false;
        notificationDropdown.classList.remove('show');
    }

    elements.notificationBell.addEventListener('click', (e) => {
        e.stopPropagation();
        isDropdownOpen = !isDropdownOpen;
        if (isDropdownOpen) {
            notificationDropdown.classList.add('show');
        } else {
            closeDropdown();
        }
    });
    document.addEventListener('click', closeDropdown);

    // --- 8. PROFILE DROPDOWN FUNCTIONALITY ---
    elements.profileDropdownBtn?.addEventListener('click', (e) => {
        e.stopPropagation();
        const isHidden = elements.profileDropdown?.classList.contains('hidden');
        
        // Close notification dropdown if open
        if (notificationDropdown) {
            notificationDropdown.classList.remove('show');
            isDropdownOpen = false;
        }
        
        elements.profileDropdown?.classList.toggle('hidden');
        
        // Rotate the caret icon
        const caretIcon = elements.profileDropdownBtn.querySelector('i');
        if (caretIcon) {
            caretIcon.style.transform = isHidden ? 'rotate(180deg)' : 'rotate(0deg)';
        }
    });
    
    // Close profile dropdown when clicking outside
    document.addEventListener('click', (e) => {
        if (!elements.profileDropdownBtn?.contains(e.target)) {
            elements.profileDropdown?.classList.add('hidden');
            const caretIcon = elements.profileDropdownBtn?.querySelector('i');
            if (caretIcon) {
                caretIcon.style.transform = 'rotate(0deg)';
            }
        }
    });

    // --- 9. WIDGET ANIMATIONS ---
    // Progress Bar
    if (elements.progressFill) {
        setTimeout(() => { elements.progressFill.style.width = '50%'; }, 1000);
    }

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
    setTimeout(animateMetrics, 1000);

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
    
    // --- 10. ACCESSIBILITY & CLEANUP ---
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
