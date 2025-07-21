// src/hostel-market.js

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore, collection, addDoc, query, orderBy, onSnapshot, serverTimestamp, doc, updateDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { firebaseConfig, cloudinaryConfig } from './firebase-config.js';
import { handleError, validateInput, requestRateLimit } from './security-utils.js';

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// DOM Elements
const newItemForm = document.getElementById('new-item-form');
const marketContainer = document.getElementById('market-container');
const uploadButton = document.getElementById('upload-button');
const formMessage = document.getElementById('form-message');
const marketLoading = document.getElementById('market-loading');

let currentUser = null;
let uploadedFileUrl = null;

// Auth Guard
onAuthStateChanged(auth, (user) => {
    if (user) {
        currentUser = user;
    } else {
        window.location.href = 'login.html';
    }
});

// === 1. CLOUDINARY UPLOAD WIDGET (IMAGE ONLY) ===
const cloudinaryWidget = cloudinary.createUploadWidget({
    cloudName: cloudinaryConfig.cloudName,
    uploadPreset: cloudinaryConfig.uploadPreset,
    folder: 'market-items',
    sources: ['local', 'url', 'camera'],
    multiple: false,
    cropping: true,
    croppingAspectRatio: 1,
    resourceType: 'image', // Enforce image-only uploads
    clientAllowedFormats: ['image'], // Restrict file picker to images
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
        formMessage.textContent = "Image upload failed. Please try again.";
        formMessage.className = 'error';
        return;
    }

    if (result.event === "success") {
        uploadedFileUrl = result.info.secure_url;
        
        const preview = document.getElementById('image-preview');
        preview.src = uploadedFileUrl;
        document.getElementById('image-preview-container').style.display = 'block';

        formMessage.textContent = "Image uploaded successfully!";
        formMessage.className = 'success';
    }
});

uploadButton.addEventListener('click', () => {
    cloudinaryWidget.open();
});

// === 2. FORM SUBMISSION LOGIC ===
newItemForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!currentUser || !uploadedFileUrl) {
        formMessage.textContent = "Please upload an image first.";
        formMessage.className = 'error';
        return;
    }

    try {
        await addDoc(collection(db, "marketListings"), {
            name: newItemForm['item-name'].value.trim(),
            description: newItemForm['item-description'].value.trim(),
            category: newItemForm['item-category'].value,
            imageUrl: uploadedFileUrl,
            price: parseFloat(newItemForm['item-price'].value),
            sellerName: currentUser.displayName,
            sellerId: currentUser.uid,
            sellerPhotoURL: currentUser.photoURL,
            createdAt: serverTimestamp(),
            isSold: false // Add sold status
        });
        
        newItemForm.reset();
        uploadedFileUrl = null;
        document.getElementById('image-preview-container').style.display = 'none';
        formMessage.textContent = "Item listed successfully!";
        formMessage.className = 'success';

    } catch (error) {
        formMessage.textContent = "Failed to list item.";
        formMessage.className = 'error';
    }
});

// === SECURE: MARK AS SOLD FUNCTION (No Global Exposure) ===
async function markItemAsSoldSecure(itemId) {
    // Security Check: Only authenticated users can proceed
    if (!currentUser) {
        alert("You must be logged in to perform this action.");
        return;
    }
    
    if (!confirm("Are you sure you want to mark this item as sold?")) return;
    
    try {
        // The REAL security happens in Firebase Rules (see recommendation)
        // This client-side check is just for UX - Firebase Rules are the real protection
        await updateDoc(doc(db, "marketListings", itemId), {
            isSold: true
        });
        alert("Item marked as sold!");
    } catch (error) {
        console.error("Error marking item as sold:", error);
        // Don't expose internal error details to users
        alert("Failed to update item. Please try again.");
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
    
    // Update active filter button
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.category === category) {
            btn.classList.add('active');
        }
    });
    
    // Filter and display items
    const filteredItems = category === 'all' ? allItems : allItems.filter(item => item.category === category);
    displayItems(filteredItems);
}

function displayItems(items) {
    marketContainer.innerHTML = '';
    
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

// === SECURE ITEM CARD CREATION (XSS Safe) ===
function createSecureItemCard(doc, item) {
    const isAuthor = currentUser && currentUser.uid === item.sellerId;
    const isSold = item.isSold || false;
    const category = item.category || 'others';
    
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
    
    // Create image element
    const itemImage = document.createElement('img');
    const thumbnailUrl = item.imageUrl.replace('/upload/', '/upload/w_400,h_300,c_fill,q_auto/');
    itemImage.src = thumbnailUrl;
    itemImage.alt = item.name; // Safe: alt attribute
    itemImage.className = 'item-image';
    if (isSold) {
        itemImage.style.cssText = 'opacity: 0.6; filter: grayscale(50%);';
    }
    
    // Create content container
    const itemContent = document.createElement('div');
    itemContent.className = 'item-content';
    
    // Create title
    const itemTitle = document.createElement('h3');
    itemTitle.className = 'item-title';
    itemTitle.textContent = item.name; // Safe: textContent prevents XSS
    if (isSold) itemTitle.style.opacity = '0.7';
    
    // Create price
    const itemPrice = document.createElement('p');
    itemPrice.className = 'item-price';
    itemPrice.textContent = `₹${item.price.toLocaleString()}`;
    if (isSold) itemPrice.style.cssText = 'text-decoration: line-through; opacity: 0.7;';
    
    // Create description
    const itemDesc = document.createElement('p');
    itemDesc.textContent = item.description; // Safe: textContent prevents XSS
    if (isSold) itemDesc.style.opacity = '0.7';
    
    // Create seller info container
    const itemSeller = document.createElement('div');
    itemSeller.className = 'item-seller';
    
    const sellerImg = document.createElement('img');
    sellerImg.src = item.sellerPhotoURL;
    sellerImg.alt = item.sellerName; // Safe: alt attribute
    
    const sellerName = document.createElement('span');
    sellerName.textContent = item.sellerName; // Safe: textContent prevents XSS
    
    itemSeller.appendChild(sellerImg);
    itemSeller.appendChild(sellerName);
    
    // Create action button with secure event listener
    const actionButton = document.createElement('button');
    if (isAuthor && !isSold) {
        actionButton.className = 'btn-mark-sold';
        actionButton.textContent = 'Mark as Sold';
        actionButton.addEventListener('click', () => {
            // Secure: No global function exposure
            markItemAsSoldSecure(doc.id);
        });
    } else if (!isSold) {
        actionButton.className = 'btn-contact';
        actionButton.textContent = 'Contact Seller';
    } else {
        actionButton.className = 'btn-sold';
        actionButton.textContent = 'SOLD';
        actionButton.disabled = true;
    }
    
    // Assemble the elements
    itemEl.appendChild(categoryBadge);
    itemEl.appendChild(itemImage);
    itemContent.appendChild(itemTitle);
    itemContent.appendChild(itemPrice);
    itemContent.appendChild(itemDesc);
    itemContent.appendChild(itemSeller);
    itemContent.appendChild(actionButton);
    itemEl.appendChild(itemContent);
    
    return itemEl;
}

// === DEPRECATED: Remove Global Function Exposure ===
// This was a security vulnerability - commented out for reference
// window.markItemAsSold = async function(itemId) { ... }

// === 3. SECURE: Fetch and display items from Firestore ===
const q = query(collection(db, "marketListings"), orderBy("createdAt", "desc"));
marketLoading.style.display = 'block';

onSnapshot(q, (querySnapshot) => {
    // Store all items for filtering
    allItems = [];
    
    if (querySnapshot.empty) {
        allItems = [];
    } else {
        querySnapshot.forEach((doc) => {
            const item = doc.data();
            allItems.push({ doc, item });
        });
    }
    
    // Apply current filter
    filterItems(currentFilter);
    marketLoading.style.display = 'none';
}, (error) => {
    // Enhanced error handling for market items loading
    console.error('Error in market items onSnapshot:', {
        errorCode: error.code,
        errorMessage: error.message,
        timestamp: new Date().toISOString()
    });
    
    const userMessage = handleError(error, 'marketItemsLoading', false);
    marketContainer.innerHTML = `
        <div style="grid-column: 1 / -1; text-align: center; color: #ff6b6b; padding: 2rem;">
            <i class="ph ph-warning-circle" style="font-size: 2rem; display: block; margin-bottom: 1rem;"></i>
            <p>${userMessage}</p>
            <button onclick="location.reload()" style="margin-top: 1rem; padding: 0.5rem 1rem; background: var(--primary); color: white; border: none; border-radius: 4px; cursor: pointer;">
                Refresh Page
            </button>
        </div>
    `;
    marketLoading.style.display = 'none';
});

// === INITIALIZE FILTER BUTTONS ===
document.addEventListener('DOMContentLoaded', () => {
    // Add event listeners to filter buttons
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const category = btn.dataset.category;
            filterItems(category);
        });
    });
});