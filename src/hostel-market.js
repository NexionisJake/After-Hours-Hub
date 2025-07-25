// CSRF token generation for form
document.addEventListener('DOMContentLoaded', () => {
    const csrfToken = crypto.randomUUID();
    const csrfInputs = document.querySelectorAll('input[name="csrfToken"]');
    csrfInputs.forEach(input => input.value = csrfToken);
    window.csrfToken = csrfToken;
});
// src/hostel-market.js

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore, collection, addDoc, query, orderBy, onSnapshot, serverTimestamp, doc, updateDoc, getDocs, limit } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { firebaseConfig, cloudinaryConfig } from './firebase-config.js';
import { handleError, validateInput, requestRateLimit, sanitizeText, messagingRateLimit } from './security-utils.js';
import { initiateChat } from './chat-system.js';

// Import notification system
import './notification-system.js';

// Performance monitoring in development
if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    import('./performance-monitor.js').then(module => {
        console.log('🚀 Performance monitoring enabled for development');
    }).catch(err => {
        console.log('Performance monitoring not available:', err.message);
    });
}

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// DOM Elements (will be initialized after DOM loads)
let newItemForm, marketContainer, uploadButton, formMessage, marketLoading;
let cloudinaryWidget = null; // Initialize as null

// We're using Firebase web modules which handle persistence automatically
// No need to explicitly call setPersistence

let currentUser = null;
let uploadedFileUrl = null;

// Track permission check status
let permissionCheckComplete = false;

// Check if we can access the Firestore collection with enhanced logging and diagnostics
async function checkFirestorePermissions() {
    if (!currentUser) {
        console.warn("No authenticated user for permission check");
        return false;
    }
    
    console.group("Firestore Permission Check");
    console.log("User ID:", currentUser.uid);
    console.log("User Email:", currentUser.email);
    console.log("User Display Name:", currentUser.displayName);
    console.log("Auth Provider:", currentUser.providerData[0]?.providerId || "unknown");
    console.log("Testing Firestore permissions...");
    
    try {
        // Check the user's token claims
        const tokenResult = await currentUser.getIdTokenResult();
        console.log("Token issued at:", new Date(tokenResult.issuedAtTime).toLocaleString());
        console.log("Token expiration:", new Date(tokenResult.expirationTime).toLocaleString());
        
        // Try to get a single document from the collection to test permissions
        const testQuery = query(
            collection(db, "marketListings"),
            orderBy("createdAt", "desc"),
            limit(1)
        );
        
        // Wait for the promise to resolve
        console.log("Executing test query...");
        const snapshot = await getDocs(testQuery);
        console.log("Permission check successful - document count:", snapshot.size);
        console.groupEnd();
        return true;
    } catch (error) {
        console.error("Firestore permission check failed:", {
            code: error.code,
            message: error.message,
            fullError: error
        });
        
        // Refresh the token and try again if it's a permission error
        if (error.code === 'permission-denied' || error.code === 'functions/permission-denied') {
            try {
                console.log("Refreshing authentication token...");
                await currentUser.getIdToken(true);
                console.log("Token refreshed, retrying permission check");
                
                // Try once more after token refresh
                try {
                    const retryQuery = query(
                        collection(db, "marketListings"),
                        orderBy("createdAt", "desc"),
                        limit(1)
                    );
                    const snapshot = await getDocs(retryQuery);
                    console.log("Permission check successful after token refresh - document count:", snapshot.size);
                    console.groupEnd();
                    return true;
                } catch (retryError) {
                    console.error("Permission check failed after token refresh:", {
                        code: retryError.code, 
                        message: retryError.message
                    });
                    console.groupEnd();
                    return false;
                }
            } catch (tokenError) {
                console.error("Failed to refresh token:", {
                    code: tokenError.code,
                    message: tokenError.message
                });
                console.groupEnd();
                return false;
            }
        }
        
        console.groupEnd();
        return false;
    }
}

// Auth Guard with improved error handling
onAuthStateChanged(auth, async (user) => {
    try {
        if (user) {
            currentUser = user;
            console.log("User authenticated:", user.uid);
            
            // Test Firestore permissions
            permissionCheckComplete = await checkFirestorePermissions();
            
            if (!permissionCheckComplete) {
                console.warn("Firestore permissions check failed. Trying to proceed anyway...");
            }
            
            // Only initialize market data after authentication is confirmed
            if (document.readyState === 'complete' || document.readyState === 'interactive') {
                initializePageAfterAuth();
            } else {
                document.addEventListener('DOMContentLoaded', initializePageAfterAuth);
            }
        } else {
            currentUser = null;
            console.log("User not authenticated, redirecting to login");
            window.location.href = 'login.html';
        }
    } catch (error) {
        console.error("Error during authentication process:", error);
        if (document.readyState === 'complete' || document.readyState === 'interactive') {
            showErrorMessage("Authentication error. Please refresh the page or try logging in again.");
        } else {
            document.addEventListener('DOMContentLoaded', () => {
                showErrorMessage("Authentication error. Please refresh the page or try logging in again.");
            });
        }
    }
});

// Initialize Cloudinary widget after DOM is ready
function initializeCloudinaryWidget() {
    if (!window.cloudinary) {
        console.error('Cloudinary library not loaded');
        return;
    }

    // === 1. CLOUDINARY UPLOAD WIDGET (Enhanced Security) ===
    cloudinaryWidget = cloudinary.createUploadWidget({
        cloudName: cloudinaryConfig.cloudName,
        uploadPreset: cloudinaryConfig.uploadPreset,
        folder: 'market-items',
        sources: ['local', 'url', 'camera'],
        multiple: false,
        cropping: true,
        croppingAspectRatio: 1,
        resourceType: 'image', // Enforce image-only uploads
        clientAllowedFormats: ['image'], // Restrict file picker to images
        maxFileSize: 10000000, // 10MB limit
        maxImageWidth: 2000,
        maxImageHeight: 2000,
        styles: {
            palette: {
                window: "#0B0E1A", windowBorder: "#B8BCC8", tabIcon: "#FFD93D", menuIcons: "#B8BCC8",
                textDark: "#F0F2F5", textLight: "#FFFFFF", link: "#FFD93D", action: "#FFD93D",
                inactiveTabIcon: "#B8BCC8", error: "#FD79A8", inProgress: "#00CEC9",
                complete: "#00CEC9", sourceBg: "#141928"
            }
        }
    }, (error, result) => {
        if (error) {
            console.error('Cloudinary upload error:', error);
            formMessage.textContent = handleError(error, 'imageUpload', false);
            formMessage.className = 'error';
            return;
        }

        if (result.event === "success") {
            // Security validation: Verify the uploaded file is from Cloudinary
            if (!result.info.secure_url || !result.info.secure_url.startsWith('https://res.cloudinary.com/')) {
                formMessage.textContent = "Invalid upload source. Please try again.";
                formMessage.className = 'error';
                return;
            }

            // Additional security: Check file format is actually an image
            const allowedFormats = ['jpg', 'jpeg', 'png', 'webp', 'gif'];
            if (!allowedFormats.includes(result.info.format)) {
                formMessage.textContent = "Only image files (JPG, PNG, WebP, GIF) are allowed.";
                formMessage.className = 'error';
                return;
            }

            // Security: Rate limiting for upload actions
            if (!requestRateLimit.isAllowed(`upload_${currentUser?.uid || 'anonymous'}`)) {
                const remainingTime = Math.ceil(requestRateLimit.getRemainingTime(`upload_${currentUser?.uid || 'anonymous'}`) / 1000 / 60);
                formMessage.textContent = `Please wait ${remainingTime} minutes before uploading another image.`;
                formMessage.className = 'error';
                return;
            }

            uploadedFileUrl = result.info.secure_url;
            
            const preview = document.getElementById('image-preview');
            if (preview) {
                preview.src = uploadedFileUrl;
                preview.onerror = () => {
                    formMessage.textContent = "Error loading uploaded image. Please try again.";
                    formMessage.className = 'error';
                    uploadedFileUrl = null;
                };
                
                const previewContainer = document.getElementById('image-preview-container');
                if (previewContainer) {
                    previewContainer.style.display = 'block';
                }
            }

            formMessage.textContent = "Image uploaded successfully!";
            formMessage.className = 'success';
        }
    });
}

// Enhanced upload button with security checks
function initializeUploadButton() {
    uploadButton.addEventListener('click', () => {
        // Security Check 1: User must be authenticated
        if (!currentUser) {
            formMessage.textContent = "Please log in to upload images.";
            formMessage.className = 'error';
            return;
        }
        
        // Security Check 2: Widget must be initialized
        if (!cloudinaryWidget) {
            formMessage.textContent = "Upload widget not ready. Please try again.";
            formMessage.className = 'error';
            return;
        }
        
        // Security Check 3: Basic rate limiting for widget opening
        const uploadKey = `widget_${currentUser.uid}`;
        if (!messagingRateLimit.isAllowed(uploadKey)) {
            const remainingTime = Math.ceil(messagingRateLimit.getRemainingTime(uploadKey) / 1000);
            formMessage.textContent = `Please wait ${remainingTime} seconds before opening upload widget again.`;
            formMessage.className = 'error';
            return;
        }
        
        cloudinaryWidget.open();
    });
}

// === 2. FORM SUBMISSION LOGIC WITH ENHANCED SECURITY ===
function initializeFormSubmission() {
    newItemForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        // Security Check 1: Authentication
        if (!currentUser || !uploadedFileUrl) {
            formMessage.textContent = "Please upload an image first.";
            formMessage.className = 'error';
            return;
        }

        // Security Check 2: Rate Limiting
        const userKey = currentUser.uid;
        if (!requestRateLimit.isAllowed(userKey)) {
            const remainingTime = Math.ceil(requestRateLimit.getRemainingTime(userKey) / 1000 / 60);
            formMessage.textContent = `Please wait ${remainingTime} minutes before submitting another item.`;
            formMessage.className = 'error';
            return;
        }

        // Security Check 3: Input Validation and Sanitization
        const formData = {
            name: newItemForm['item-name'].value.trim(),
            description: newItemForm['item-description'].value.trim(),
            category: newItemForm['item-category'].value,
            price: newItemForm['item-price'].value.trim(),
            quantity: newItemForm['item-quantity'] ? newItemForm['item-quantity'].value.trim() : null
        };

        // Validate item name
        const nameValidation = validateInput(formData.name, 50, /^[a-zA-Z0-9\s\-.,!()]+$/);
        if (!nameValidation.isValid) {
            formMessage.textContent = `Item name error: ${nameValidation.error}`;
            formMessage.className = 'error';
            return;
        }

        // Validate description
        const descValidation = validateInput(formData.description, 200);
        if (!descValidation.isValid) {
            formMessage.textContent = `Description error: ${descValidation.error}`;
            formMessage.className = 'error';
            return;
        }

        // Validate category (must be from allowed list)
        const allowedCategories = ['food', 'daily-use', 'appliance', 'others'];
        if (!allowedCategories.includes(formData.category)) {
            formMessage.textContent = "Please select a valid category.";
            formMessage.className = 'error';
            return;
        }

        // Validate price
        const priceNum = parseFloat(formData.price);
        if (isNaN(priceNum) || priceNum <= 0 || priceNum > 100000) {
            formMessage.textContent = "Price must be a valid number between ₹1 and ₹1,00,000.";
            formMessage.className = 'error';
            return;
        }

        // Validate quantity for food items
        let quantityNum = null;
        if (formData.category === 'food') {
            if (!formData.quantity || formData.quantity === '') {
                formMessage.textContent = "Quantity is required for food items.";
                formMessage.className = 'error';
                return;
            }
            quantityNum = parseInt(formData.quantity);
            if (isNaN(quantityNum) || quantityNum <= 0 || quantityNum > 1000) {
                formMessage.textContent = "Quantity must be a valid number between 1 and 1,000.";
                formMessage.className = 'error';
                return;
            }
        }

        // Security Check 4: Sanitize text inputs to prevent XSS
        const sanitizedData = {
            name: sanitizeText(formData.name),
            description: sanitizeText(formData.description),
            category: formData.category, // Category is validated against whitelist
            price: priceNum,
            quantity: quantityNum // null for non-food items
        };

        try {
            const itemData = {
                name: sanitizedData.name,
                description: sanitizedData.description,
                category: sanitizedData.category,
                imageUrl: uploadedFileUrl,
                price: sanitizedData.price,
                sellerName: sanitizeText(currentUser.displayName || 'Anonymous'),
                sellerId: currentUser.uid,
                sellerPhotoURL: currentUser.photoURL || '',
                createdAt: serverTimestamp(),
                isSold: false
            };

            // Add quantity field only for food items
            if (sanitizedData.quantity !== null) {
                itemData.quantity = sanitizedData.quantity;
            }

            await addDoc(collection(db, "marketListings"), itemData);
            
            newItemForm.reset();
            uploadedFileUrl = null;
            const previewContainer = document.getElementById('image-preview-container');
            if (previewContainer) {
                previewContainer.style.display = 'none';
            }
            formMessage.textContent = "Item listed successfully!";
            formMessage.className = 'success';

        } catch (error) {
            console.error("Error adding document: ", error);
            const userMessage = handleError(error, 'marketItemSubmission', false);
            formMessage.textContent = userMessage;
            formMessage.className = 'error';
        }
    });
}

// === CATEGORY HANDLER FOR QUANTITY FIELD ===
function initializeCategoryHandler() {
    const categorySelect = document.getElementById('item-category');
    const quantityGroup = document.getElementById('quantity-group');
    const quantityInput = document.getElementById('item-quantity');
    
    if (!categorySelect || !quantityGroup) {
        console.warn('Category select or quantity group not found');
        return;
    }
    
    categorySelect.addEventListener('change', (e) => {
        const selectedCategory = e.target.value;
        
        if (selectedCategory === 'food') {
            // Show quantity field for food items
            quantityGroup.style.display = 'block';
            quantityInput.setAttribute('required', 'true');
            
            // Add subtle animation
            quantityGroup.style.opacity = '0';
            quantityGroup.style.transform = 'translateY(-10px)';
            setTimeout(() => {
                quantityGroup.style.transition = 'all 0.3s ease';
                quantityGroup.style.opacity = '1';
                quantityGroup.style.transform = 'translateY(0)';
            }, 10);
        } else {
            // Hide quantity field for non-food items
            quantityGroup.style.display = 'none';
            quantityInput.removeAttribute('required');
            quantityInput.value = ''; // Clear the value
        }
    });
}

// === SECURE: MARK AS SOLD FUNCTION WITH ENHANCED VALIDATION ===
async function markItemAsSoldSecure(itemId) {
    // Security Check 1: Authentication
    if (!currentUser) {
        alert("You must be logged in to perform this action.");
        return;
    }
    
    // Security Check 2: Input validation
    if (!itemId || typeof itemId !== 'string' || itemId.trim().length === 0) {
        alert("Invalid item identifier.");
        return;
    }

    // Security Check 3: Rate limiting for this action
    const actionKey = `sold_${currentUser.uid}`;
    if (!messagingRateLimit.isAllowed(actionKey)) {
        const remainingTime = Math.ceil(messagingRateLimit.getRemainingTime(actionKey) / 1000);
        alert(`Please wait ${remainingTime} seconds before marking another item as sold.`);
        return;
    }
    
    if (!confirm("Are you sure you want to mark this item as sold?")) return;
    
    try {
        // The REAL security happens in Firebase Rules (see recommendation)
        // This client-side check is just for UX - Firebase Rules are the real protection
        await updateDoc(doc(db, "marketListings", itemId.trim()), {
            isSold: true,
            soldAt: serverTimestamp()
        });
        alert("Item marked as sold!");
    } catch (error) {
        console.error("Error marking item as sold:", error);
        const userMessage = handleError(error, 'markItemAsSold', false);
        alert(userMessage);
    }
}

// === CATEGORY UTILITY FUNCTIONS ===
function getCategoryIcon(category) {
    const icons = {
        'food': '🍕',
        'daily-use': '🧴',
        'appliance': '⚡',
        'others': '📦'
    };
    return icons[category] || '📦';
}

function getCategoryName(category) {
    const names = {
        'food': 'Food & Snacks',
        'daily-use': 'Daily Use',
        'appliance': 'Appliances',
        'others': 'Others'
    };
    return names[category] || 'Others';
}

// === FILTERING FUNCTIONALITY ===
let currentFilter = 'all';
let allItems = [];

function filterItems(category) {
    currentFilter = category;
    
    // Update active filter button (safely)
    try {
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.classList.remove('active');
            if (btn.dataset.category === category) {
                btn.classList.add('active');
            }
        });
    } catch (error) {
        console.warn('Filter buttons not available:', error);
    }
    
    // Filter and display items
    const filteredItems = category === 'all' ? allItems : allItems.filter(item => item.category === category);
    displayItems(filteredItems);
}

function displayItems(items) {
    if (!marketContainer) {
        console.error('Market container not available');
        return;
    }
    
    marketContainer.textContent = '';
    
    if (items.length === 0) {
        const emptyMessage = document.createElement('p');
        emptyMessage.style.cssText = 'grid-column: 1 / -1; text-align: center; color: var(--text-secondary);';
        emptyMessage.textContent = currentFilter === 'all' ? 'No items on the market yet.' : `No items found in the ${getCategoryName(currentFilter)} category.`;
        marketContainer.appendChild(emptyMessage);
        return;
    }
    
    items.forEach(({ doc, item }) => {
        const itemEl = createSecureItemCard(doc, item);
        marketContainer.appendChild(itemEl);
    });
}

// === SECURE ITEM CARD CREATION (Enhanced XSS Protection) ===
function createSecureItemCard(doc, item) {
    const isAuthor = currentUser && currentUser.uid === item.sellerId;
    const isSold = item.isSold || false;
    const category = item.category || 'others';
    
    // Security: Validate and sanitize all item data
    const sanitizedItem = {
        name: sanitizeText(item.name || 'Unnamed Item'),
        description: sanitizeText(item.description || 'No description'),
        sellerName: sanitizeText(item.sellerName || 'Anonymous'),
        price: parseFloat(item.price) || 0,
        imageUrl: item.imageUrl || '',
        sellerPhotoURL: item.sellerPhotoURL || ''
    };
    
    // Enhanced validation for URLs to prevent malicious content
    const validateImageUrl = (url) => {
        if (!url || typeof url !== 'string') return false;
        
        // Allow specific trusted domains and data URLs for images
        const trustedDomains = [
            'https://res.cloudinary.com/',
            'https://images.unsplash.com/',
            'https://firebasestorage.googleapis.com/',
            'https://lh3.googleusercontent.com/',  // Google user photos
            'https://avatars.githubusercontent.com/' // GitHub avatars (if used)
        ];
        
        // Check for data URLs (base64 images)
        if (url.startsWith('data:image/')) {
            // Validate data URL format
            const dataUrlPattern = /^data:image\/(jpeg|jpg|png|gif|webp);base64,/i;
            return dataUrlPattern.test(url);
        }
        
        // Check against trusted domains
        return trustedDomains.some(domain => url.startsWith(domain));
    };
    
    const isValidImageUrl = validateImageUrl(sanitizedItem.imageUrl);
    const isValidSellerPhoto = validateImageUrl(sanitizedItem.sellerPhotoURL);
    
    // Block potentially unsafe URLs
    if (!isValidImageUrl && sanitizedItem.imageUrl !== '') {
        console.warn('Potentially unsafe image URL blocked:', sanitizedItem.imageUrl);
        sanitizedItem.imageUrl = ''; // Block potentially unsafe URLs
    }
    
    if (!isValidSellerPhoto && sanitizedItem.sellerPhotoURL !== '') {
        console.warn('Potentially unsafe seller photo URL blocked:', sanitizedItem.sellerPhotoURL);
        sanitizedItem.sellerPhotoURL = ''; // Block potentially unsafe URLs
    }
    
    // Create main card element
    const itemEl = document.createElement('article');
    itemEl.className = `item-card category-${category}`;
    
    // Create category badge
    const categoryBadge = document.createElement('div');
    categoryBadge.className = 'category-badge';
    categoryBadge.textContent = `${getCategoryIcon(category)} ${getCategoryName(category)}`;
    
    // Create sold badge if needed
    if (isSold) {
        const soldBadge = document.createElement('div');
        soldBadge.className = 'sold-badge';
        soldBadge.textContent = 'SOLD';
        itemEl.appendChild(soldBadge);
    }
    
    // Create image element with enhanced security and optimization
    const itemImage = document.createElement('img');
    if (sanitizedItem.imageUrl) {
        // Enhanced Cloudinary transformations for better performance
        const optimizedUrl = sanitizedItem.imageUrl.replace('/upload/', '/upload/f_auto,q_auto,w_400,h_300,c_fill,dpr_auto/');
        itemImage.src = optimizedUrl;
        itemImage.alt = sanitizedItem.name; // Using sanitized name
        itemImage.loading = 'lazy'; // Enable lazy loading for better performance
    } else {
        // Fallback placeholder
        itemImage.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAwIiBoZWlnaHQ9IjMwMCIgdmlld0JveD0iMCAwIDQwMCAzMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSI0MDAiIGhlaWdodD0iMzAwIiBmaWxsPSIjRjNGNEY2Ii8+CjxwYXRoIGQ9Ik0yMDAgMTUwQzIwMCAxNzIuMDkxIDE4Mi4wOTEgMTkwIDE2MCAxOTBDMTM3LjkwOSAxOTAgMTIwIDE3Mi4wOTEgMTIwIDE1MEMxMjAgMTI3LjkwOSAxMzcuOTA5IDExMCAxNjAgMTEwQzE4Mi4wOTEgMTEwIDIwMCAxMjcuOTA5IDIwMCAxNTBaIiBmaWxsPSIjOUI5Q0ExIi8+Cjx0ZXh0IHg9IjIwMCIgeT0iMjIwIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmaWxsPSIjNkI3MjgwIiBmb250LXNpemU9IjE0cHgiPk5vIEltYWdlPC90ZXh0Pgo8L3N2Zz4K';
        itemImage.alt = 'No image available';
    }
    itemImage.className = 'item-image';
    if (isSold) {
        itemImage.style.cssText = 'opacity: 0.6; filter: grayscale(50%);';
    }
    
    // Create content container
    const itemContent = document.createElement('div');
    itemContent.className = 'item-content';
    
    // Create title with length limit for display
    const itemTitle = document.createElement('h3');
    itemTitle.className = 'item-title';
    const displayName = sanitizedItem.name.length > 30 ? 
        sanitizedItem.name.substring(0, 30) + '...' : sanitizedItem.name;
    itemTitle.textContent = displayName;
    itemTitle.title = sanitizedItem.name; // Full name in tooltip
    if (isSold) itemTitle.style.opacity = '0.7';
    
    // Create price with validation
    const itemPrice = document.createElement('p');
    itemPrice.className = 'item-price';
    const validPrice = !isNaN(sanitizedItem.price) && sanitizedItem.price > 0 ? 
        `₹${sanitizedItem.price.toLocaleString()}` : 'Price not available';
    itemPrice.textContent = validPrice;
    if (isSold) itemPrice.style.cssText = 'text-decoration: line-through; opacity: 0.7;';
    
    // Create description with length limit
    const itemDesc = document.createElement('p');
    const displayDesc = sanitizedItem.description.length > 100 ? 
        sanitizedItem.description.substring(0, 100) + '...' : sanitizedItem.description;
    itemDesc.textContent = displayDesc;
    itemDesc.title = sanitizedItem.description; // Full description in tooltip
    if (isSold) itemDesc.style.opacity = '0.7';
    
    // Create seller info container with enhanced security
    const itemSeller = document.createElement('div');
    itemSeller.className = 'item-seller';
    
    const sellerImg = document.createElement('img');
    if (sanitizedItem.sellerPhotoURL && 
        (sanitizedItem.sellerPhotoURL.startsWith('https://lh3.googleusercontent.com/') ||
         sanitizedItem.sellerPhotoURL.startsWith('https://graph.facebook.com/'))) {
        sellerImg.src = sanitizedItem.sellerPhotoURL;
    } else {
        // Default avatar if no valid photo URL
        sellerImg.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCA0MCA0MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPGNpcmNsZSBjeD0iMjAiIGN5PSIyMCIgcj0iMjAiIGZpbGw9IiNGM0Y0RjYiLz4KPGNpcmNsZSBjeD0iMjAiIGN5PSIxNiIgcj0iNiIgZmlsbD0iIzlCOUNBMSIvPgo8cGF0aCBkPSJNMzIgMzJDMzIgMjYuNDc3MiAyNy41MjI4IDIyIDIyIDIySDE4QzEyLjQ3NzIgMjIgOCAyNi40NzcyIDggMzJIMzJaIiBmaWxsPSIjOUI5Q0ExIi8+Cjwvc3ZnPgo=';
    }
    sellerImg.alt = sanitizedItem.sellerName;
    sellerImg.loading = 'lazy'; // Add lazy loading for profile images
    
    const sellerName = document.createElement('a');
    sellerName.href = `profile.html?uid=${sanitizedItem.sellerId || item.sellerId}`;
    sellerName.className = 'user-link';
    const displaySellerName = sanitizedItem.sellerName.length > 15 ? 
        sanitizedItem.sellerName.substring(0, 15) + '...' : sanitizedItem.sellerName;
    sellerName.textContent = displaySellerName;
    sellerName.title = sanitizedItem.sellerName; // Full name in tooltip
    
    itemSeller.appendChild(sellerImg);
    itemSeller.appendChild(sellerName);
    
    // Create action button/interface with secure event listener
    let actionContainer;
    
    if (isAuthor && !isSold) {
        // Author can mark as sold
        actionContainer = document.createElement('button');
        actionContainer.className = 'btn-mark-sold';
        actionContainer.textContent = 'Mark as Sold';
        actionContainer.addEventListener('click', () => {
            // Secure: No global function exposure, with input validation
            if (doc && doc.id) {
                markItemAsSoldSecure(doc.id);
            }
        });
    } else if (!isSold) {
        // Non-author buyers - different interface for food vs other items
        if (category === 'food' && item.quantity && item.quantity > 0) {
            // Food items: Quantity selector + Request to Buy
            actionContainer = document.createElement('div');
            actionContainer.className = 'food-action-container';
            
            // Quantity info
            const quantityInfo = document.createElement('div');
            quantityInfo.className = 'quantity-info';
            quantityInfo.textContent = `Available: ${item.quantity} units`;
            
            // Quantity selector
            const quantitySelector = document.createElement('div');
            quantitySelector.className = 'quantity-selector';
            
            const minusBtn = document.createElement('button');
            minusBtn.className = 'quantity-btn minus-btn';
            minusBtn.textContent = '-';
            
            const quantityValue = document.createElement('span');
            quantityValue.className = 'quantity-value';
            quantityValue.textContent = '1';
            
            const plusBtn = document.createElement('button');
            plusBtn.className = 'quantity-btn plus-btn';
            plusBtn.textContent = '+';
            
            // Quantity selector event listeners
            let selectedQuantity = 1;
            
            minusBtn.addEventListener('click', () => {
                if (selectedQuantity > 1) {
                    selectedQuantity--;
                    quantityValue.textContent = selectedQuantity;
                }
                minusBtn.disabled = selectedQuantity <= 1;
            });
            
            plusBtn.addEventListener('click', () => {
                if (selectedQuantity < item.quantity) {
                    selectedQuantity++;
                    quantityValue.textContent = selectedQuantity;
                }
                plusBtn.disabled = selectedQuantity >= item.quantity;
            });
            
            // Initialize button states
            minusBtn.disabled = true;
            plusBtn.disabled = item.quantity <= 1;
            
            quantitySelector.appendChild(minusBtn);
            quantitySelector.appendChild(quantityValue);
            quantitySelector.appendChild(plusBtn);
            
            // Request to Buy button
            const requestBuyBtn = document.createElement('button');
            requestBuyBtn.className = 'request-buy-btn';
            requestBuyBtn.textContent = 'Request to Buy';
            requestBuyBtn.addEventListener('click', () => {
                // Secure: No global function exposure, with input validation
                if (doc && doc.id && item.sellerId) {
                    const message = `Hi! I'd like to buy ${selectedQuantity} unit${selectedQuantity > 1 ? 's' : ''} of your "${sanitizedItem.name}".`;
                    initiateChat(item.sellerId, doc.id, item.name, 'market', message);
                }
            });
            
            actionContainer.appendChild(quantityInfo);
            actionContainer.appendChild(quantitySelector);
            actionContainer.appendChild(requestBuyBtn);
        } else {
            // Non-food items or food items without quantity: Regular contact button
            actionContainer = document.createElement('button');
            actionContainer.className = 'btn-contact contact-seller-btn';
            actionContainer.textContent = 'Contact Seller';
            actionContainer.addEventListener('click', () => {
                // Secure: No global function exposure, with input validation
                if (doc && doc.id && item.sellerId) {
                    initiateChat(item.sellerId, doc.id, item.name, 'market');
                }
            });
        }
    } else {
        // Sold items
        actionContainer = document.createElement('button');
        actionContainer.className = 'btn-sold';
        actionContainer.textContent = 'SOLD';
        actionContainer.disabled = true;
    }
    
    // Assemble the elements
    itemEl.appendChild(categoryBadge);
    itemEl.appendChild(itemImage);
    itemContent.appendChild(itemTitle);
    itemContent.appendChild(itemPrice);
    itemContent.appendChild(itemDesc);
    itemContent.appendChild(itemSeller);
    itemContent.appendChild(actionContainer);
    itemEl.appendChild(itemContent);
    
    return itemEl;
}

// === DEPRECATED: Remove Global Function Exposure ===
// This was a security vulnerability - commented out for reference
// window.markItemAsSold = async function(itemId) { ... }

// === 3. MARKET DATA LOADING INITIALIZATION ===
function initializeMarketDataLoading() {
    if (!marketLoading || !marketContainer) {
        console.error('Market loading elements not initialized');
        return;
    }
    
    // Verify authentication before proceeding
    if (!currentUser || !currentUser.uid) {
        console.error('User not authenticated for market data loading');
        marketContainer.textContent = '';
        const errorDiv = document.createElement('div');
        errorDiv.style.cssText = 'grid-column: 1 / -1; text-align: center; color: #ff6b6b; padding: 2rem;';
        const icon = document.createElement('i');
        icon.className = 'ph ph-warning-circle';
        icon.style.cssText = 'font-size: 2rem; display: block; margin-bottom: 1rem;';
        errorDiv.appendChild(icon);
        const p = document.createElement('p');
        p.textContent = 'Authentication required. Please sign in to view the market.';
        errorDiv.appendChild(p);
        const btn = document.createElement('button');
        btn.textContent = 'Sign In';
        btn.style.cssText = 'margin-top: 1rem; padding: 0.5rem 1rem; background: var(--primary-accent); color: white; border: none; border-radius: 4px; cursor: pointer;';
        btn.onclick = () => { window.location.href = 'login.html'; };
        errorDiv.appendChild(btn);
        marketContainer.appendChild(errorDiv);
        marketLoading.style.display = 'none';
        return;
    }

    console.log("Loading market data for user:", currentUser.uid);
    marketLoading.style.display = 'block';
    
    // Create a query with the user's authentication context
    try {
        const q = query(collection(db, "marketListings"), orderBy("createdAt", "desc"));
        
        // Set up the snapshot listener with retry logic
        let retryCount = 0;
        const maxRetries = 3;
        const setupListener = () => {
            console.group("Market Data Listener Setup");
            console.log(`Setting up market data listener (attempt ${retryCount + 1}/${maxRetries + 1})`);
            console.log("User authentication status:", currentUser ? "Authenticated" : "Not authenticated");
            if (currentUser) {
                console.log("User ID:", currentUser.uid);
            }
            console.log("Collection path:", "marketListings");
            console.groupEnd();
            
            const unsubscribe = onSnapshot(q, (querySnapshot) => {
                // Store all items for filtering
                allItems = [];
                
                if (querySnapshot.empty) {
                    console.log("No market items found");
                    allItems = [];
                    // Show empty state message
                    marketContainer.textContent = '';
                    const emptyDiv = document.createElement('div');
                    emptyDiv.style.cssText = 'grid-column: 1 / -1; text-align: center; padding: 2rem;';
                    const icon = document.createElement('i');
                    icon.className = 'ph ph-shopping-bag';
                    icon.style.cssText = 'font-size: 3rem; color: var(--text-secondary); margin-bottom: 1rem;';
                    emptyDiv.appendChild(icon);
                    const h3 = document.createElement('h3');
                    h3.textContent = 'No items listed yet';
                    emptyDiv.appendChild(h3);
                    const p = document.createElement('p');
                    p.textContent = 'Be the first to list something in the market!';
                    emptyDiv.appendChild(p);
                    marketContainer.appendChild(emptyDiv);
                } else {
                    console.log(`Found ${querySnapshot.size} market items`);
                    querySnapshot.forEach((doc) => {
                        const item = doc.data();
                        allItems.push({ doc, item });
                    });
                }
                
                // Apply current filter
                filterItems(currentFilter);
                marketLoading.style.display = 'none';
            }, (error) => {
                // Enhanced error handling with detailed diagnostics for market items loading
                console.group("Market Data Error");
                console.error('Error in market items onSnapshot:', {
                    errorCode: error.code,
                    errorMessage: error.message,
                    timestamp: new Date().toISOString(),
                    retryCount: retryCount,
                    userId: currentUser?.uid || 'not authenticated',
                    fullError: error
                });
                
                // Check if the error is related to permissions
                const isPermissionError = error.code === 'permission-denied' || 
                                          error.message.includes('Missing or insufficient permissions');
                
                console.log("Is permission error:", isPermissionError);
                console.log("Retry count:", retryCount, "Max retries:", maxRetries);
                console.groupEnd();
                
                if (isPermissionError && retryCount < maxRetries) {
                    // Retry with exponential backoff
                    retryCount++;
                    const backoffTime = Math.min(1000 * Math.pow(2, retryCount), 10000);
                    console.log(`Retrying in ${backoffTime/1000} seconds...`);
                    
                    // Show temporary message to user
                    marketContainer.textContent = '';
                    const reconnectDiv = document.createElement('div');
                    reconnectDiv.style.cssText = 'grid-column: 1 / -1; text-align: center; padding: 2rem;';
                    const spinnerIcon = document.createElement('i');
                    spinnerIcon.className = 'ph ph-spinner';
                    spinnerIcon.style.cssText = 'font-size: 2rem; animation: spin 1s infinite linear;';
                    reconnectDiv.appendChild(spinnerIcon);
                    const p = document.createElement('p');
                    p.textContent = 'Reconnecting to market data...';
                    reconnectDiv.appendChild(p);
                    const small = document.createElement('small');
                    small.textContent = `(Attempt ${retryCount} of ${maxRetries})`;
                    reconnectDiv.appendChild(small);
                    marketContainer.appendChild(reconnectDiv);
                    
                    setTimeout(() => {
                        // Re-authenticate and try again
                        if (currentUser) {
                            console.log("Refreshing authentication token...");
                            currentUser.getIdToken(true)
                                .then((token) => {
                                    console.log("Token refreshed successfully, length:", token.length);
                                    // Unsubscribe from previous listener before setting up a new one
                                    if (unsubscribe && typeof unsubscribe === 'function') {
                                        unsubscribe();
                                    }
                                    setupListener();
                                })
                                .catch(tokenError => {
                                    console.error("Failed to refresh authentication token:", tokenError);
                                    showErrorMessage("Authentication refresh failed. Please reload the page.");
                                });
                        } else {
                            showErrorMessage("Session expired. Please sign in again.");
                        }
                    }, backoffTime);
                } else {
                    // Max retries reached or different error - show error message
                    const userMessage = handleError ? 
                        handleError(error, 'marketItemsLoading', false) : 
                        "Failed to load market items. Please check your connection and try again.";
                    
                    showErrorMessage(userMessage);
                }
            });
        };
        
        // Initial setup
        setupListener();
    } catch (setupError) {
        console.error("Error setting up market data loading:", setupError);
        showErrorMessage("Failed to set up market view. Please refresh the page.");
        marketLoading.style.display = 'none';
    }
}

// Helper function to show error message in the market container
function showErrorMessage(message) {
    if (!marketContainer) return;
    marketContainer.textContent = '';
    const errorDiv = document.createElement('div');
    errorDiv.style.cssText = 'grid-column: 1 / -1; text-align: center; color: #ff6b6b; padding: 2rem;';
    const icon = document.createElement('i');
    icon.className = 'ph ph-warning-circle';
    icon.style.cssText = 'font-size: 2rem; display: block; margin-bottom: 1rem;';
    errorDiv.appendChild(icon);
    const p = document.createElement('p');
    p.textContent = message;
    errorDiv.appendChild(p);
    const btn = document.createElement('button');
    btn.textContent = 'Refresh Page';
    btn.style.cssText = 'margin-top: 1rem; padding: 0.5rem 1rem; background: var(--primary-accent); color: white; border: none; border-radius: 4px; cursor: pointer;';
    btn.onclick = () => { location.reload(); };
    errorDiv.appendChild(btn);
    marketContainer.appendChild(errorDiv);
    if (marketLoading) {
        marketLoading.style.display = 'none';
    }
}

// === INITIALIZE COMPONENTS ONLY AFTER AUTHENTICATION ===
function initializePageAfterAuth() {
    console.group("Page Initialization");
    console.log("Initializing page components after authentication");
    console.log("User ID:", currentUser?.uid);
    
    // Initialize DOM elements with safety checks
    try {
        newItemForm = document.getElementById('new-item-form');
        marketContainer = document.getElementById('market-container');
        uploadButton = document.getElementById('upload-button');
        formMessage = document.getElementById('form-message');
        marketLoading = document.getElementById('market-loading');
        
        // Log element initialization status for debugging
        console.log("DOM element initialization status:", {
            newItemForm: !!newItemForm,
            marketContainer: !!marketContainer,
            uploadButton: !!uploadButton,
            formMessage: !!formMessage,
            marketLoading: !!marketLoading
        });
        
        // Check if required elements exist
        const missingElements = [];
        if (!newItemForm) missingElements.push('new-item-form');
        if (!marketContainer) missingElements.push('market-container');
        if (!uploadButton) missingElements.push('upload-button');
        if (!formMessage) missingElements.push('form-message');
        if (!marketLoading) missingElements.push('market-loading');
        
        if (missingElements.length > 0) {
            console.error(`Required DOM elements not found: ${missingElements.join(', ')}`);
            
            // Create message in the body if the container isn't available
            const bodyElement = document.querySelector('body');
            if (bodyElement) {
                const errorDiv = document.createElement('div');
                errorDiv.style.cssText = 'position: fixed; top: 0; left: 0; right: 0; background-color: #ff6b6b; color: white; padding: 1rem; text-align: center; z-index: 9999;';
                errorDiv.textContent = '';
                const p1 = document.createElement('p');
                const strong = document.createElement('strong');
                strong.textContent = 'Page Error:';
                p1.appendChild(strong);
                p1.appendChild(document.createTextNode(' Some required elements are missing from the page.'));
                errorDiv.appendChild(p1);
                const p2 = document.createElement('p');
                p2.textContent = 'Please refresh the page or contact support if the issue persists.';
                errorDiv.appendChild(p2);
                bodyElement.prepend(errorDiv);
            }
            
            console.groupEnd();
            return;
        }
    } catch (error) {
        console.error("Error during DOM initialization:", error);
        console.groupEnd();
        return;
    }
    
    // Initialize Cloudinary widget
    initializeCloudinaryWidget();
    
    // Initialize upload button event listener
    initializeUploadButton();
    
    // Initialize form submission handler
    initializeFormSubmission();

    // Initialize category change handler for quantity field
    initializeCategoryHandler();

    // Initialize market data loading
    initializeMarketDataLoading();    // Add event listeners to filter buttons
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const category = btn.dataset.category;
            filterItems(category);
        });
    });
    
    console.log("Page initialization complete");
    console.groupEnd();
}

// === INITIALIZE DOM ELEMENTS ON PAGE LOAD ===
document.addEventListener('DOMContentLoaded', () => {
    console.log("DOM loaded, waiting for authentication");
    
    // If user is already authenticated at this point, initialize the page
    if (currentUser) {
        console.log("User already authenticated on DOM load");
        initializePageAfterAuth();
    }
});