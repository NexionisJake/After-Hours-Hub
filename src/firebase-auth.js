// src/firebase-auth.js

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-analytics.js";
import { getAuth, GoogleAuthProvider, signInWithPopup } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { firebaseConfig } from './firebase-config.js';

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();

// --- Function to handle Google Sign-In ---
const signInWithGoogle = () => {
  signInWithPopup(auth, provider)
    .then((result) => {
      // This gives you a Google Access Token. You can use it to access the Google API.
      const credential = GoogleAuthProvider.credentialFromResult(result);
      const token = credential.accessToken;
      // The signed-in user info.
      const user = result.user;
      
      console.log("Authentication successful:", user);
      
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


