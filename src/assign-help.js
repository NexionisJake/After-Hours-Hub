// src/assign-help.js (formerly hostel-market.js)

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore, collection, addDoc, query, orderBy, onSnapshot, serverTimestamp, doc, updateDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// Import centralized configuration (Security Improvement)
import { firebaseConfig, cloudinaryConfig } from './firebase-config.js';

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
    resourceType: 'image',
    clientAllowedFormats: ['image'],
    styles: { /* Your existing styles */ }
}, (error, result) => {
    if (result.event === "success") {
        uploadedFileUrl = result.info.secure_url;
        const preview = document.getElementById('image-preview');
        preview.src = uploadedFileUrl;
        document.getElementById('image-preview-container').style.display = 'block';
        formMessage.textContent = "Image uploaded successfully!";
    }
});

uploadButton.addEventListener('click', () => cloudinaryWidget.open());

// === 2. FORM SUBMISSION LOGIC ===
newItemForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!currentUser || !uploadedFileUrl) {
        formMessage.textContent = "Please upload an image first.";
        return;
    }

    await addDoc(collection(db, "marketListings"), {
        name: newItemForm['item-name'].value.trim(),
        description: newItemForm['item-description'].value.trim(),
        imageUrl: uploadedFileUrl,
        price: parseFloat(newItemForm['item-price'].value),
        sellerName: currentUser.displayName,
        sellerId: currentUser.uid,
        sellerPhotoURL: currentUser.photoURL,
        createdAt: serverTimestamp(),
        isSold: false // Add the 'isSold' flag
    });
    
    newItemForm.reset();
    uploadedFileUrl = null;
    document.getElementById('image-preview-container').style.display = 'none';
    formMessage.textContent = "Item listed successfully!";
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

// === DEPRECATED: Remove Global Function Exposure ===
// This was a security vulnerability - commented out for reference
// window.markItemAsSold = async function(itemId) { ... }

// === 3. READ: Fetch and display items from Firestore ===
const q = query(collection(db, "marketListings"), orderBy("createdAt", "desc"));
marketLoading.style.display = 'block';

onSnapshot(q, (querySnapshot) => {
    marketContainer.innerHTML = '';
    if (querySnapshot.empty) {
        marketContainer.innerHTML = '<p>No items on the market yet.</p>';
    } else {
        querySnapshot.forEach((doc) => {
            const item = doc.data();
            
            // --- HIDE SOLD ITEMS ---
            // If an item is sold, we simply don't create a card for it.
            if (item.isSold) {
                return; // Skip this item
            }

            const itemEl = document.createElement('article');
            itemEl.className = 'item-card';
            
            const isAuthor = currentUser && currentUser.uid === item.sellerId;
            const thumbnailUrl = item.imageUrl.replace('/upload/', '/upload/w_400,h_300,c_fill,q_auto/');
            
            // === SECURE DOM MANIPULATION (No innerHTML) ===
            // Create image element
            const itemImage = document.createElement('img');
            itemImage.src = thumbnailUrl;
            itemImage.alt = item.name; // Safe: alt attribute
            itemImage.className = 'item-image';
            
            // Create content container
            const itemContent = document.createElement('div');
            itemContent.className = 'item-content';
            
            // Create title
            const itemTitle = document.createElement('h3');
            itemTitle.className = 'item-title';
            itemTitle.textContent = item.name; // Safe: textContent prevents XSS
            
            // Create price
            const itemPrice = document.createElement('p');
            itemPrice.className = 'item-price';
            itemPrice.textContent = `₹${item.price.toLocaleString()}`;
            
            // Create description
            const itemDesc = document.createElement('p');
            itemDesc.textContent = item.description; // Safe: textContent prevents XSS
            
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
            if (isAuthor) {
                actionButton.className = 'btn-mark-sold';
                actionButton.textContent = 'Mark as Sold';
                actionButton.addEventListener('click', () => {
                    // Secure: No global function exposure
                    markItemAsSoldSecure(doc.id);
                });
            } else {
                actionButton.className = 'btn-contact';
                actionButton.textContent = 'Contact Seller';
            }
            
            // Assemble the elements
            itemContent.appendChild(itemTitle);
            itemContent.appendChild(itemPrice);
            itemContent.appendChild(itemDesc);
            itemContent.appendChild(itemSeller);
            itemContent.appendChild(actionButton);
            
            itemEl.appendChild(itemImage);
            itemEl.appendChild(itemContent);
            marketContainer.appendChild(itemEl);
        });
    }
    marketLoading.style.display = 'none';
});