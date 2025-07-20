// src/hostel-market.js

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
    cloudName: CLOUDINARY_CLOUD_NAME,
    uploadPreset: CLOUDINARY_UPLOAD_PRESET,
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

// === MARK AS SOLD FUNCTION ===
window.markItemAsSold = async function(itemId) {
    try {
        await updateDoc(doc(db, "marketListings", itemId), {
            isSold: true
        });
    } catch (error) {
        console.error("Error marking item as sold:", error);
        alert("Failed to mark item as sold. Please try again.");
    }
}

// === 3. READ: Fetch and display items from Firestore ===
const q = query(collection(db, "marketListings"), orderBy("createdAt", "desc"));
marketLoading.style.display = 'block';

onSnapshot(q, (querySnapshot) => {
    marketContainer.innerHTML = '';
    if (querySnapshot.empty) {
        marketContainer.innerHTML = '<p style="grid-column: 1 / -1; text-align: center; color: var(--text-secondary);">No items on the market yet.</p>';
    } else {
        querySnapshot.forEach((doc) => {
            const item = doc.data();
            const itemEl = document.createElement('article');
            itemEl.className = 'item-card';
            
            // Check if current user is the author
            const isAuthor = currentUser && currentUser.uid === item.sellerId;
            const isSold = item.isSold || false;

            // Create a transformed thumbnail URL for faster loading
            const thumbnailUrl = item.imageUrl.replace('/upload/', '/upload/w_400,h_300,c_fill,q_auto/');
            const previewHtml = `<img src="${thumbnailUrl}" alt="${item.name}" class="item-image" style="${isSold ? 'opacity: 0.6; filter: grayscale(50%);' : ''}">`;

            // Add sold badge if item is sold
            const soldBadge = isSold ? '<div class="sold-badge">SOLD</div>' : '';

            // Determine button text based on user and item status
            let actionButton = '';
            if (isAuthor && !isSold) {
                actionButton = `<button class="btn-mark-sold" onclick="markItemAsSold('${doc.id}')">Mark as Sold</button>`;
            } else if (!isSold) {
                actionButton = `<button class="btn-contact">Contact Seller</button>`;
            } else {
                actionButton = `<button class="btn-sold" disabled>SOLD</button>`;
            }

            itemEl.innerHTML = `
                ${soldBadge}
                ${previewHtml}
                <div class="item-content">
                    <h3 class="item-title" style="${isSold ? 'opacity: 0.7;' : ''}">${item.name}</h3>
                    <p class="item-price" style="${isSold ? 'text-decoration: line-through; opacity: 0.7;' : ''}">₹${item.price.toLocaleString()}</p>
                    <p style="${isSold ? 'opacity: 0.7;' : ''}">${item.description}</p>
                    <div class="item-seller">
                        <img src="${item.sellerPhotoURL}" alt="${item.sellerName}">
                        <span>${item.sellerName}</span>
                    </div>
                    ${actionButton}
                </div>
            `;
            marketContainer.appendChild(itemEl);
        });
    }
    marketLoading.style.display = 'none';
});