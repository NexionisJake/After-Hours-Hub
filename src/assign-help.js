// src/assign-help.js

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { 
    getFirestore, 
    collection, 
    addDoc, 
    query, 
    orderBy, 
    onSnapshot, 
    serverTimestamp,
    where
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { firebaseConfig } from './firebase-config.js';

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// DOM Element References
const newRequestForm = document.getElementById('new-request-form');
const requestsContainer = document.getElementById('requests-container');
const skeletonLoader = document.getElementById('skeleton-loader');
const searchInput = document.getElementById('search-requests');
const sortSelect = document.getElementById('sort-requests');
const toggleCompletedCheckbox = document.getElementById('toggle-completed');
const togglePaymentCheckbox = document.getElementById('toggle-payment');
const paymentRangeSlider = document.getElementById('payment-range');
const paymentRangeValue = document.getElementById('payment-range-value');
const filterTagsSelect = document.getElementById('filter-tags');
const emptyStateContainer = document.getElementById('empty-state');
const activeFiltersContainer = document.getElementById('active-filters');
const filterBadgesContainer = document.getElementById('filter-badges');
const clearFiltersBtn = document.getElementById('clear-filters');

// Input validation elements
const titleValidation = document.getElementById('title-validation');
const descriptionValidation = document.getElementById('description-validation');
const titleInput = document.getElementById('request-title');
const descriptionInput = document.getElementById('request-description');
const tagsInput = document.getElementById('request-tags');
const dueDateInput = document.getElementById('due-date');
const quickDateButtons = document.querySelectorAll('.quick-date-btn');
const fileUploadArea = document.getElementById('file-upload-area');
const fileInput = document.getElementById('file-input');
const uploadProgressContainer = document.getElementById('upload-progress');
const uploadProgressBar = document.querySelector('.upload-progress-bar');
const uploadProgressText = document.querySelector('.upload-progress-text');
const submitSpinner = document.getElementById('submit-spinner');

// State Variables
let currentUser = null;
let allRequests = [];
let filteredRequests = [];
let activeFilters = {
    search: '',
    sort: 'newest',
    completed: false,
    payment: false,
    paymentAmount: 0,
    tag: ''
};
let availableTags = new Set();

// Listeners
let requestsListener = null;


// --- 1. AUTHENTICATION ---
onAuthStateChanged(auth, (user) => {
    if (user) {
        if (currentUser?.uid === user.uid) return;
        currentUser = user;
        console.log('User authenticated successfully:', user.uid);
        loadInitialData();
    } else {
        currentUser = null;
        cleanupAllListeners();
        console.log('User signed out.');
        if (window.location.pathname.includes('assign-help.html')) {
             window.location.href = 'login.html';
        }
    }
});


// --- 2. CORE APP LOGIC ---

function loadInitialData() {
    loadRequests();
}

// --- FORM VALIDATION FUNCTIONS ---
function validateTitle() {
    const title = titleInput.value.trim();
    if (title.length < 5) {
        showValidationError(titleValidation, 'Title must be at least 5 characters');
        return false;
    } else if (title.length > 100) {
        showValidationError(titleValidation, 'Title must be less than 100 characters');
        return false;
    } else {
        showValidationSuccess(titleValidation, 'Looks good!');
        return true;
    }
}

function validateDescription() {
    const description = descriptionInput.value.trim();
    if (description.length < 20) {
        showValidationError(descriptionValidation, 'Description must be at least 20 characters');
        return false;
    } else {
        showValidationSuccess(descriptionValidation, 'Looks good!');
        return true;
    }
}

function showValidationError(element, message) {
    element.innerHTML = `<i class="ph-bold ph-warning-circle"></i> ${message}`;
    element.classList.add('error');
    element.classList.remove('success');
}

function showValidationSuccess(element, message) {
    element.innerHTML = `<i class="ph-bold ph-check-circle"></i> ${message}`;
    element.classList.remove('error');
    element.classList.add('success');
}

// Set default due date to tomorrow
function setDefaultDueDate() {
    if (dueDateInput) {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        tomorrow.setHours(23, 59);
        
        // Format the date as required by datetime-local input
        const year = tomorrow.getFullYear();
        const month = String(tomorrow.getMonth() + 1).padStart(2, '0');
        const day = String(tomorrow.getDate()).padStart(2, '0');
        const hours = String(tomorrow.getHours()).padStart(2, '0');
        const minutes = String(tomorrow.getMinutes()).padStart(2, '0');
        
        dueDateInput.value = `${year}-${month}-${day}T${hours}:${minutes}`;
    }
}

// Quick date buttons functionality
function setupQuickDateButtons() {
    quickDateButtons.forEach(button => {
        button.addEventListener('click', () => {
            const daysToAdd = parseInt(button.dataset.days);
            const date = new Date();
            date.setDate(date.getDate() + daysToAdd);
            date.setHours(23, 59);
            
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            const hours = String(date.getHours()).padStart(2, '0');
            const minutes = String(date.getMinutes()).padStart(2, '0');
            
            dueDateInput.value = `${year}-${month}-${day}T${hours}:${minutes}`;
            
            // Animate button to show it's been clicked
            button.classList.add('clicked');
            setTimeout(() => {
                button.classList.remove('clicked');
            }, 300);
        });
    });
}

// --- FILE UPLOAD HANDLING ---
function setupFileUpload() {
    if (!fileUploadArea || !fileInput) return;
    
    fileUploadArea.addEventListener('click', () => {
        fileInput.click();
    });
    
    fileUploadArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        fileUploadArea.classList.add('dragover');
    });
    
    fileUploadArea.addEventListener('dragleave', () => {
        fileUploadArea.classList.remove('dragover');
    });
    
    fileUploadArea.addEventListener('drop', (e) => {
        e.preventDefault();
        fileUploadArea.classList.remove('dragover');
        
        if (e.dataTransfer.files.length) {
            fileInput.files = e.dataTransfer.files;
            handleFileUpload(e.dataTransfer.files);
        }
    });
    
    fileInput.addEventListener('change', () => {
        if (fileInput.files.length) {
            handleFileUpload(fileInput.files);
        }
    });
}

function handleFileUpload(files) {
    // Simulate file upload progress
    if (files.length > 0) {
        const uploadedFiles = document.getElementById('uploaded-files');
        uploadedFiles.innerHTML = '';
        
        uploadProgressContainer.style.display = 'block';
        let progress = 0;
        
        const interval = setInterval(() => {
            progress += 5;
            uploadProgressBar.style.width = `${progress}%`;
            uploadProgressText.textContent = `Uploading: ${progress}%`;
            
            if (progress >= 100) {
                clearInterval(interval);
                setTimeout(() => {
                    uploadProgressContainer.style.display = 'none';
                    
                    // Display uploaded files
                    Array.from(files).forEach(file => {
                        const fileSize = (file.size / 1024).toFixed(1);
                        const fileElement = document.createElement('div');
                        fileElement.className = 'uploaded-file';
                        fileElement.innerHTML = `
                            <i class="ph-bold ph-file-text"></i>
                            <div class="file-info">
                                <div class="file-name">${DOMPurify.sanitize(file.name)}</div>
                                <div class="file-size">${fileSize} KB</div>
                            </div>
                            <button type="button" class="btn-remove-file" aria-label="Remove file">
                                <i class="ph-bold ph-x"></i>
                            </button>
                        `;
                        
                        const removeBtn = fileElement.querySelector('.btn-remove-file');
                        removeBtn.addEventListener('click', () => {
                            fileElement.remove();
                        });
                        
                        uploadedFiles.appendChild(fileElement);
                    });
                }, 500);
            }
        }, 100);
    }
}

// --- CREATE NEW ASSIGNMENT REQUEST ---
if (newRequestForm) {
    // Setup form validation
    titleInput.addEventListener('blur', validateTitle);
    descriptionInput.addEventListener('blur', validateDescription);
    
    // Set default due date
    setDefaultDueDate();
    
    // Setup quick date buttons
    setupQuickDateButtons();
    
    // Setup file upload
    setupFileUpload();
    
    newRequestForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!currentUser) return;
        
        // Validate the form
        const isTitleValid = validateTitle();
        const isDescriptionValid = validateDescription();
        
        if (!isTitleValid || !isDescriptionValid) {
            return; // Stop form submission if validation fails
        }
        
        // Get form values
        const title = newRequestForm['request-title'].value;
        const description = newRequestForm['request-description'].value;
        const paymentAmount = newRequestForm['payment-amount'].value || 0;
        const dueDate = newRequestForm['due-date'].value;
        const tagsString = newRequestForm['request-tags'].value;
        const tags = tagsString ? tagsString.split(',').map(tag => tag.trim()) : [];
        
        // Show loading spinner
        submitSpinner.style.display = 'inline-block';
        
        try {
            await addDoc(collection(db, "assignmentRequests"), {
                title: DOMPurify.sanitize(title),
                description: DOMPurify.sanitize(description),
                paymentAmount: Number(DOMPurify.sanitize(paymentAmount)),
                dueDate: dueDate ? new Date(dueDate).toISOString() : null,
                tags: tags.map(tag => DOMPurify.sanitize(tag)),
                authorId: currentUser.uid,
                authorName: currentUser.displayName,
                completed: false,
                createdAt: serverTimestamp()
            });
            
            // Show success message
            const successMessage = document.getElementById('success-message');
            successMessage.style.display = 'flex';
            setTimeout(() => {
                successMessage.style.display = 'none';
            }, 3000);
            
            // Reset form
            newRequestForm.reset();
            setDefaultDueDate();
            document.getElementById('uploaded-files').innerHTML = '';
            
            // Reset validation messages
            titleValidation.className = 'validation-message';
            descriptionValidation.className = 'validation-message';
        } catch (error) {
            console.error("Error adding document: ", error);
            
            // Show error message
            const errorMessage = document.getElementById('error-message');
            errorMessage.style.display = 'flex';
            setTimeout(() => {
                errorMessage.style.display = 'none';
            }, 3000);
        } finally {
            // Hide loading spinner
            submitSpinner.style.display = 'none';
        }
    });
}


// --- READ & DISPLAY REQUESTS ---
function loadRequests() {
    if (requestsListener) requestsListener();
    const q = query(collection(db, "assignmentRequests"), orderBy("createdAt", "desc"));
    
    requestsListener = onSnapshot(q, (querySnapshot) => {
        if (skeletonLoader) skeletonLoader.style.display = 'none';
        allRequests = [];
        availableTags = new Set();
        
        querySnapshot.forEach(doc => {
            const data = doc.data();
            const request = { id: doc.id, ...data };
            allRequests.push(request);
            
            // Collect all unique tags for the filter dropdown
            if (request.tags && Array.isArray(request.tags)) {
                request.tags.forEach(tag => {
                    if (tag) availableTags.add(tag);
                });
            }
        });
        
        // Update tags filter dropdown
        updateTagsFilter();
        
        // Apply filters and display
        applyFiltersAndDisplay();
    }, (error) => {
        console.error("Error loading requests: ", error);
    });
}

function updateTagsFilter() {
    if (!filterTagsSelect) return;
    
    // Save current selection
    const currentSelection = filterTagsSelect.value;
    
    // Clear current options except the first one
    while (filterTagsSelect.options.length > 1) {
        filterTagsSelect.remove(1);
    }
    
    // Add new options
    Array.from(availableTags).sort().forEach(tag => {
        const option = document.createElement('option');
        option.value = tag;
        option.textContent = tag;
        filterTagsSelect.appendChild(option);
    });
    
    // Restore selection if it still exists
    if (currentSelection) {
        filterTagsSelect.value = currentSelection;
    }
}

function applyFiltersAndDisplay() {
    if (!allRequests.length) return;
    
    // Apply all active filters
    filteredRequests = allRequests.filter(request => {
        // Filter by completion status
        if (activeFilters.completed === false && request.completed) {
            return false;
        }
        
        // Filter by payment amount
        if (activeFilters.payment && (!request.paymentAmount || request.paymentAmount <= 0)) {
            return false;
        }
        
        // Filter by minimum payment amount
        if (activeFilters.paymentAmount > 0 && (!request.paymentAmount || request.paymentAmount < activeFilters.paymentAmount)) {
            return false;
        }
        
        // Filter by tag
        if (activeFilters.tag && (!request.tags || !request.tags.includes(activeFilters.tag))) {
            return false;
        }
        
        // Filter by search text
        if (activeFilters.search) {
            const searchLower = activeFilters.search.toLowerCase();
            const titleMatch = request.title && request.title.toLowerCase().includes(searchLower);
            const descMatch = request.description && request.description.toLowerCase().includes(searchLower);
            const authorMatch = request.authorName && request.authorName.toLowerCase().includes(searchLower);
            const tagsMatch = request.tags && request.tags.some(tag => tag.toLowerCase().includes(searchLower));
            
            return titleMatch || descMatch || authorMatch || tagsMatch;
        }
        
        return true;
    });
    
    // Sort the filtered requests
    sortRequests();
    
    // Display the results
    displayRequests(filteredRequests);
    
    // Update active filters UI
    updateActiveFiltersUI();
}

function sortRequests() {
    switch (activeFilters.sort) {
        case 'newest':
            filteredRequests.sort((a, b) => {
                return (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0);
            });
            break;
        case 'due_date':
            filteredRequests.sort((a, b) => {
                const dateA = a.dueDate ? new Date(a.dueDate) : new Date(9999, 11, 31);
                const dateB = b.dueDate ? new Date(b.dueDate) : new Date(9999, 11, 31);
                return dateA - dateB;
            });
            break;
        case 'payment':
            filteredRequests.sort((a, b) => {
                return (b.paymentAmount || 0) - (a.paymentAmount || 0);
            });
            break;
        case 'alphabetical':
            filteredRequests.sort((a, b) => {
                return (a.title || '').localeCompare(b.title || '');
            });
            break;
    }
}

function updateActiveFiltersUI() {
    if (!activeFiltersContainer || !filterBadgesContainer) return;
    
    // Check if any filters are active
    const hasActiveFilters = 
        activeFilters.search || 
        activeFilters.sort !== 'newest' || 
        activeFilters.completed !== false || 
        activeFilters.payment !== false ||
        activeFilters.paymentAmount > 0 ||
        activeFilters.tag;
    
    // Show/hide active filters container
    activeFiltersContainer.style.display = hasActiveFilters ? 'block' : 'none';
    
    if (!hasActiveFilters) return;
    
    // Build filter badges
    filterBadgesContainer.innerHTML = '';
    
    if (activeFilters.search) {
        addFilterBadge(`Search: "${activeFilters.search}"`, () => {
            searchInput.value = '';
            activeFilters.search = '';
            applyFiltersAndDisplay();
        });
    }
    
    if (activeFilters.sort !== 'newest') {
        const sortTexts = {
            'due_date': 'Due Soon',
            'payment': 'Highest Payment',
            'alphabetical': 'A-Z'
        };
        addFilterBadge(`Sort: ${sortTexts[activeFilters.sort]}`, () => {
            sortSelect.value = 'newest';
            activeFilters.sort = 'newest';
            applyFiltersAndDisplay();
        });
    }
    
    if (activeFilters.completed !== false) {
        addFilterBadge('Show Completed', () => {
            toggleCompletedCheckbox.checked = false;
            activeFilters.completed = false;
            applyFiltersAndDisplay();
        });
    }
    
    if (activeFilters.payment !== false) {
        addFilterBadge('Has Payment', () => {
            togglePaymentCheckbox.checked = false;
            activeFilters.payment = false;
            applyFiltersAndDisplay();
        });
    }
    
    if (activeFilters.paymentAmount > 0) {
        addFilterBadge(`Min Payment: ₹${activeFilters.paymentAmount}`, () => {
            paymentRangeSlider.value = 0;
            paymentRangeValue.textContent = '₹0+';
            activeFilters.paymentAmount = 0;
            applyFiltersAndDisplay();
        });
    }
    
    if (activeFilters.tag) {
        addFilterBadge(`Tag: ${activeFilters.tag}`, () => {
            filterTagsSelect.value = '';
            activeFilters.tag = '';
            applyFiltersAndDisplay();
        });
    }
}

function addFilterBadge(text, onRemove) {
    const badge = document.createElement('div');
    badge.className = 'filter-badge';
    badge.innerHTML = `
        ${DOMPurify.sanitize(text)}
        <i class="ph-bold ph-x" role="button" aria-label="Remove filter"></i>
    `;
    
    badge.querySelector('i').addEventListener('click', onRemove);
    filterBadgesContainer.appendChild(badge);
}

function displayRequests(requests) {
    if (!requestsContainer) return;
    requestsContainer.innerHTML = '';
    
    // Show empty state if no requests match the filters
    if (emptyStateContainer) {
        emptyStateContainer.style.display = requests.length === 0 ? 'block' : 'none';
    }
    
    // Display the requests
    requests.forEach(request => {
        const el = createRequestElement(request);
        requestsContainer.appendChild(el);
    });
}

function createRequestElement(request) {
    const el = document.createElement('div');
    el.className = request.completed ? 'request-card completed' : 'request-card';
    
    // Calculate urgency based on due date
    let urgencyClass = '';
    let urgencyText = '';
    let daysUntilDue = 0;
    
    if (request.dueDate) {
        const dueDate = new Date(request.dueDate);
        const now = new Date();
        daysUntilDue = Math.ceil((dueDate - now) / (1000 * 60 * 60 * 24));
        
        if (daysUntilDue <= 1) {
            urgencyClass = 'urgency-high';
            urgencyText = 'Due Today';
        } else if (daysUntilDue <= 3) {
            urgencyClass = 'urgency-medium';
            urgencyText = `Due in ${daysUntilDue} days`;
        } else {
            urgencyClass = 'urgency-low';
            urgencyText = `Due in ${daysUntilDue} days`;
        }
    }
    
    // Format date for display
    const formattedDueDate = request.dueDate ? 
        new Date(request.dueDate).toLocaleDateString('en-US', { 
            month: 'short', 
            day: 'numeric', 
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        }) : 'No due date';
    
    // Build tags HTML
    const tagsHTML = request.tags && request.tags.length 
        ? `<div class="request-badges">
            ${request.tags.map(tag => `<span class="badge badge-tag">${DOMPurify.sanitize(tag)}</span>`).join('')}
           </div>`
        : '';
    
    // Payment badge
    const paymentBadge = request.paymentAmount && request.paymentAmount > 0
        ? `<span class="badge badge-payment">
             <i class="ph-bold ph-currency-inr"></i> ${DOMPurify.sanitize(request.paymentAmount)}
           </span>`
        : '';
    
    // Status badge
    const statusBadge = request.completed
        ? `<span class="badge badge-completed">
             <i class="ph-bold ph-check-circle"></i> Completed
           </span>`
        : `<span class="badge badge-open">
             <i class="ph-bold ph-clock"></i> Open
           </span>`;
    
    el.innerHTML = `
        <div class="urgency-indicator ${urgencyClass}"></div>
        <h3>${DOMPurify.sanitize(request.title)}</h3>
        <p class="request-author">By: ${DOMPurify.sanitize(request.authorName || 'Anonymous')}</p>
        <p class="request-description">${DOMPurify.sanitize(request.description || '')}</p>
        
        ${tagsHTML}
        
        <div class="request-badges">
            ${paymentBadge}
            <span class="badge badge-due ${daysUntilDue <= 1 ? 'urgent' : ''}">
                <i class="ph-bold ph-calendar"></i> ${urgencyText}
            </span>
            ${statusBadge}
        </div>
        
        <div class="request-meta">
            <i class="ph-bold ph-calendar-check"></i> Due: ${formattedDueDate}
        </div>
        
        <button class="view-details-btn">
            <i class="ph-bold ph-chat-centered-text"></i>
            Offer Help
        </button>
    `;
    
    // Add event listener to the "Offer Help" button
    const offerHelpButton = el.querySelector('.view-details-btn');
    offerHelpButton.addEventListener('click', () => {
        // Handle "Offer Help" click (could open a chat or details modal)
        console.log(`Offering help for request: ${request.id}`);
        // This would be implemented to open a chat or modal
    });
    
    return el;
}

// --- UTILITIES & EVENT LISTENERS ---
function cleanupAllListeners() {
    if (requestsListener) requestsListener();
}

// Setup filter event listeners
function setupFilterListeners() {
    // Search input
    if (searchInput) {
        searchInput.addEventListener('input', debounce(function() {
            activeFilters.search = this.value.trim();
            applyFiltersAndDisplay();
        }, 300));
    }
    
    // Sort select
    if (sortSelect) {
        sortSelect.addEventListener('change', function() {
            activeFilters.sort = this.value;
            applyFiltersAndDisplay();
        });
    }
    
    // Toggle completed checkbox
    if (toggleCompletedCheckbox) {
        toggleCompletedCheckbox.addEventListener('change', function() {
            activeFilters.completed = this.checked;
            applyFiltersAndDisplay();
        });
    }
    
    // Toggle payment checkbox
    if (togglePaymentCheckbox) {
        togglePaymentCheckbox.addEventListener('change', function() {
            activeFilters.payment = this.checked;
            applyFiltersAndDisplay();
        });
    }
    
    // Payment range slider
    if (paymentRangeSlider && paymentRangeValue) {
        paymentRangeSlider.addEventListener('input', function() {
            const value = parseInt(this.value);
            paymentRangeValue.textContent = `₹${value}+`;
            activeFilters.paymentAmount = value;
            applyFiltersAndDisplay();
        });
    }
    
    // Tags filter
    if (filterTagsSelect) {
        filterTagsSelect.addEventListener('change', function() {
            activeFilters.tag = this.value;
            applyFiltersAndDisplay();
        });
    }
    
    // Clear all filters button
    if (clearFiltersBtn) {
        clearFiltersBtn.addEventListener('click', () => {
            // Reset all filters
            if (searchInput) searchInput.value = '';
            if (sortSelect) sortSelect.value = 'newest';
            if (toggleCompletedCheckbox) toggleCompletedCheckbox.checked = false;
            if (togglePaymentCheckbox) togglePaymentCheckbox.checked = false;
            if (paymentRangeSlider) {
                paymentRangeSlider.value = 0;
                paymentRangeValue.textContent = '₹0+';
            }
            if (filterTagsSelect) filterTagsSelect.value = '';
            
            // Reset filter state
            activeFilters = {
                search: '',
                sort: 'newest',
                completed: false,
                payment: false,
                paymentAmount: 0,
                tag: ''
            };
            
            // Apply filters
            applyFiltersAndDisplay();
        });
    }
}

// Debounce function to limit how often a function is called
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func.apply(this, args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Calculate time difference in a human-readable format
function getTimeDifference(timestamp) {
    if (!timestamp) return 'Unknown time';
    
    const now = new Date();
    const date = new Date(timestamp);
    const diffInSeconds = Math.floor((now - date) / 1000);
    
    if (diffInSeconds < 60) {
        return 'Just now';
    } else if (diffInSeconds < 3600) {
        const minutes = Math.floor(diffInSeconds / 60);
        return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
    } else if (diffInSeconds < 86400) {
        const hours = Math.floor(diffInSeconds / 3600);
        return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    } else if (diffInSeconds < 604800) {
        const days = Math.floor(diffInSeconds / 86400);
        return `${days} day${days > 1 ? 's' : ''} ago`;
    } else {
        return date.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric'
        });
    }
}

// Enhance accessibility by adding aria attributes dynamically
function enhanceAccessibility() {
    const interactiveElements = document.querySelectorAll('button, a, input, select, textarea');
    interactiveElements.forEach(el => {
        if (!el.hasAttribute('aria-label') && !el.hasAttribute('aria-labelledby') && !el.hasAttribute('aria-hidden')) {
            // For buttons with icons only
            if (el.tagName === 'BUTTON' && !el.textContent.trim() && el.querySelector('i')) {
                const iconClass = el.querySelector('i').className;
                if (iconClass.includes('check')) {
                    el.setAttribute('aria-label', 'Mark as complete');
                } else if (iconClass.includes('x')) {
                    el.setAttribute('aria-label', 'Remove');
                } else if (iconClass.includes('chat')) {
                    el.setAttribute('aria-label', 'Open chat');
                }
            }
        }
    });
}

window.addEventListener('beforeunload', cleanupAllListeners);

document.addEventListener('DOMContentLoaded', () => {
    // Initialize the date picker with default value
    setDefaultDueDate();
    
    // Setup filter listeners
    setupFilterListeners();
    
    // Initialize toggles based on URL parameters
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.has('tag')) {
        const tagValue = urlParams.get('tag');
        if (filterTagsSelect) {
            // Wait for tags to load
            setTimeout(() => {
                filterTagsSelect.value = tagValue;
                activeFilters.tag = tagValue;
                applyFiltersAndDisplay();
            }, 1000);
        }
    }
    
    // Enhance accessibility
    enhanceAccessibility();
    
    // Animation on scroll - add class when elements come into view
    const animateOnScroll = () => {
        const elements = document.querySelectorAll('.request-card');
        elements.forEach(el => {
            const rect = el.getBoundingClientRect();
            const isInViewport = rect.top <= window.innerHeight && rect.bottom >= 0;
            
            if (isInViewport && !el.classList.contains('animated')) {
                el.classList.add('animated');
            }
        });
    };
    
    window.addEventListener('scroll', debounce(animateOnScroll, 100));
});

