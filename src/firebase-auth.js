// src/firebase-auth.js

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-analytics.js";
import { getAuth, GoogleAuthProvider, signInWithPopup } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
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
            googleLoginBtn.innerHTML = `
                <div class="spinner"></div>
                <span>Authenticating...</span>
            `;
            googleLoginBtn.disabled = true;
            
            signInWithGoogle();
        });
    }
});


