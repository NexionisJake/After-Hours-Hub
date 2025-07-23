// src/firebase-auth.js

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore, doc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { firebaseConfig } from './firebase-config.js';

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Analytics will only be initialized if measurementId is present in config (production only)
let analytics = null;
if (firebaseConfig.measurementId) {
    try {
        import("https://www.gstatic.com/firebasejs/10.12.2/firebase-analytics.js")
            .then(({ getAnalytics }) => {
                analytics = getAnalytics(app);
                console.log('Analytics enabled in production environment');
            })
            .catch(error => {
                console.log('Analytics initialization failed:', error);
            });
    } catch (error) {
        console.log('Analytics import failed:', error);
    }
} else {
    console.log('Analytics disabled - no measurementId in config (development mode)');
}
const auth = getAuth(app);
const provider = new GoogleAuthProvider();

// Function to create or update user document
async function createUserDocument(user) {
    try {
        const userRef = doc(db, 'users', user.uid);
        const userData = {
            uid: user.uid,
            displayName: user.displayName || 'Anonymous User',
            email: user.email,
            photoURL: user.photoURL || '',
            lastLoginAt: serverTimestamp(),
            createdAt: serverTimestamp()
        };
        
        // Use merge: true to update only new fields and not overwrite existing data
        await setDoc(userRef, userData, { merge: true });
        console.log('User document created/updated successfully');
    } catch (error) {
        console.error('Error creating user document:', error);
        // Don't block login if user document creation fails
    }
}

// --- Function to handle Google Sign-In ---
const signInWithGoogle = () => {
  signInWithPopup(auth, provider)
    .then(async (result) => {
      // This gives you a Google Access Token. You can use it to access the Google API.
      const credential = GoogleAuthProvider.credentialFromResult(result);
      const token = credential.accessToken;
      // The signed-in user info.
      const user = result.user;
      
      console.log("Authentication successful:", user);
      
      // Create or update user document in Firestore
      await createUserDocument(user);
      
      // Redirect to dashboard on successful login
      window.location.href = 'dashboard-clean.html';
    })
    .catch((error) => {
      // Handle Errors here.
      const errorCode = error.code;
      const errorMessage = error.message;
      // The email of the user's account used.
      const email = error.customData.email;
      // The AuthCredential type that was used.
      const credential = GoogleAuthProvider.credentialFromError(error);
      
      console.error("Authentication failed:", errorMessage);
      alert(`Login Failed: ${errorMessage}`);
    });
};

// --- Add Event Listener to the Google Login Button ---
document.addEventListener('DOMContentLoaded', () => {
    const googleLoginBtn = document.getElementById('google-login-btn');
    if (googleLoginBtn) {
        googleLoginBtn.addEventListener('click', () => {
            // Show a loading state on the button
            googleLoginBtn.textContent = '';
            const spinner = document.createElement('div');
            spinner.className = 'spinner';
            googleLoginBtn.appendChild(spinner);
            const span = document.createElement('span');
            span.textContent = 'Authenticating...';
            googleLoginBtn.appendChild(span);
            googleLoginBtn.disabled = true;
            signInWithGoogle();
        });
    }
});


