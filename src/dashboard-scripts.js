// src/dashboard-scripts.js

// ===== START: FIREBASE AUTH GUARD =====
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { 
    getFirestore, 
    collection, 
    query, 
    where, 
    onSnapshot 
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { firebaseConfig } from './firebase-config.js';

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
            elements.themeToggle.innerHTML = '<i class="ph-bold ph-sun"></i>';
            elements.themeToggle.setAttribute('aria-label', 'Switch to light mode');
        } else {
            root.style.setProperty('--bg-color', '#FAFBFC');
            root.style.setProperty('--text-color', '#1A202C');
            root.style.setProperty('--text-secondary', '#4A5568');
            root.style.setProperty('--glass-bg', 'rgba(255, 255, 255, 0.85)');
            root.style.setProperty('--glass-border', 'rgba(0, 0, 0, 0.08)');
            elements.themeToggle.innerHTML = '<i class="ph-bold ph-moon"></i>';
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
            
            // --- NEW LOGIC ---
            // If the card has a data-route, navigate to the new page
            const route = card.dataset.route;
            if (route === 'help') {
                window.location.href = 'assign-help.html';
                return; // Stop further execution
            }
            // ===== ADD THIS NEW CASE =====
            if (route === 'market') {
                window.location.href = 'hostel-market.html';
                return;
            }
            if (route === 'lostfound') {
                window.location.href = 'lost-and-found.html';
                return;
            }
            if (route === 'chats') {
                window.location.href = 'chats.html';
                return;
            }
            // ===== END NEW CASE =====
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

    // --- 6. NOTIFICATION SYSTEM (Enhanced with missing styles) ---
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
    
    // Add keyboard support for notification bell
    elements.notificationBell.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            elements.notificationBell.click();
        }
    });
    
    document.addEventListener('click', closeDropdown);

    // --- 7. PROFILE DROPDOWN FUNCTIONALITY ---
    elements.profileDropdownBtn?.addEventListener('click', (e) => {
        e.stopPropagation();
        const isHidden = elements.profileDropdown?.classList.contains('hidden');
        
        // Close notification dropdown if open
        if (notificationDropdown) {
            notificationDropdown.classList.remove('show');
            isDropdownOpen = false;
        }
        
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
    // Radial Progress Bar Animation
    const radialProgress = document.querySelector('.radial-progress');
    const progressValue = document.querySelector('.progress-value');
    if (radialProgress && progressValue) {
        setTimeout(() => {
            const goalPercentage = 50; // Your dynamic value
            radialProgress.style.background = `conic-gradient(var(--primary-accent) ${goalPercentage * 3.6}deg, rgba(255,255,255,0.1) 0deg)`;
            progressValue.textContent = `${goalPercentage}%`;
            
            // Add a smooth counting animation
            let currentProgress = 0;
            const progressInterval = setInterval(() => {
                if (currentProgress < goalPercentage) {
                    currentProgress += 2;
                    progressValue.textContent = `${currentProgress}%`;
                    radialProgress.style.background = `conic-gradient(var(--primary-accent) ${currentProgress * 3.6}deg, rgba(255,255,255,0.1) 0deg)`;
                } else {
                    clearInterval(progressInterval);
                }
            }, 50);
        }, 1500);
    }
    
    // Replace skeleton loaders with real content
    setTimeout(() => {
        const timelineItems = document.querySelectorAll('.timeline-content');
        const sampleContent = [
            { text: '<b>DSP notes</b> for 3rd sem uploaded by user', time: '2 mins ago' },
            { text: 'New listing in <b>Hostel Market</b>: "Kettle for sale"', time: '15 mins ago' },
            { text: 'Help request for <b>"Compiler Design"</b> assignment', time: '1 hour ago' }
        ];
        
        timelineItems.forEach((item, index) => {
            if (sampleContent[index]) {
                const textElement = item.querySelector('p');
                const timeElement = item.querySelector('.timeline-time');
                
                if (textElement && timeElement) {
                    // Smooth transition from skeleton to content
                    textElement.style.opacity = '0';
                    timeElement.style.opacity = '0';
                    
                    setTimeout(() => {
                        textElement.classList.remove('skeleton');
                        timeElement.classList.remove('skeleton');
                        textElement.innerHTML = sampleContent[index].text;
                        timeElement.textContent = sampleContent[index].time;
                        textElement.style.height = 'auto';
                        textElement.style.width = 'auto';
                        textElement.style.opacity = '1';
                        timeElement.style.opacity = '1';
                    }, 200);
                }
            }
        });
    }, 2000);

    // Progress Value Animation (updated for radial progress)
    if (elements.progressValue) {
        setTimeout(() => { 
            // Animate progress value from 0% to 50%
            let currentProgress = 0;
            const targetProgress = 50;
            const increment = 1;
            const interval = setInterval(() => {
                if (currentProgress >= targetProgress) {
                    clearInterval(interval);
                    return;
                }
                currentProgress += increment;
                elements.progressValue.textContent = `${currentProgress}%`;
            }, 30); // Smooth animation over 1.5 seconds
        }, 1000);
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

    // Enhanced Radial Progress Bar Animation
    function animateRadialProgress() {
        const radialProgress = document.querySelector('.radial-progress');
        const progressValue = document.querySelector('.progress-value');
        
        if (radialProgress && progressValue) {
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

            let currentPercentage = 0;
            const duration = 1500;
            const stepTime = 20;
            const totalSteps = duration / stepTime;
            const increment = goalPercentage / totalSteps;

            // Animate the progress
            const progressTimer = setInterval(() => {
                currentPercentage += increment;
                if (currentPercentage >= goalPercentage) {
                    currentPercentage = goalPercentage;
                    clearInterval(progressTimer);
                    
                    // Add completion glow effect
                    radialProgress.style.animation = 'progressRotate 20s linear infinite, progressGlow 2s ease-in-out 3';
                }
                
                // Update visual elements
                const degrees = currentPercentage * 3.6;
                radialProgress.style.background = `conic-gradient(
                    var(--primary-accent) ${degrees}deg, 
                    rgba(255,255,255,0.1) ${degrees}deg
                )`;
                radialProgress.style.setProperty('--progress-degrees', `${degrees}deg`);
                progressValue.textContent = `${Math.floor(currentPercentage)}%`;
                
                // Add dynamic color based on progress
                if (currentPercentage < 30) {
                    radialProgress.style.setProperty('--progress-color', '#ff6b6b');
                } else if (currentPercentage < 70) {
                    radialProgress.style.setProperty('--progress-color', '#ffd93d');
                } else {
                    radialProgress.style.setProperty('--progress-color', '#00cec9');
                }
            }, stepTime);

            // Add interactive hover effects
            radialProgress.addEventListener('mouseenter', () => {
                progressValue.style.transform = 'scale(1.1)';
                progressValue.style.textShadow = '0 0 20px var(--primary-accent)';
            });

            radialProgress.addEventListener('mouseleave', () => {
                progressValue.style.transform = 'scale(1)';
                progressValue.style.textShadow = '0 0 15px rgba(255, 217, 61, 0.8)';
            });
        }
    }

    setTimeout(animateMetrics, 1000);
    setTimeout(animateRadialProgress, 1500); // Start after metrics animation

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