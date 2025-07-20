// src/firebase-config.js
// === CENTRALIZED FIREBASE CONFIGURATION ===
// This consolidates all Firebase config in one place for better security and maintainability

/**
 * Firebase configuration object
 * Note: These values are safe to be public - they identify your Firebase project
 * The real security comes from Firebase Security Rules on the server-side
 */
export const firebaseConfig = {
    apiKey: "AIzaSyBCO6Q8aCJBNF1dMy34TlviwQ3ivc3NvkE",
    authDomain: "after-hours-hub.firebaseapp.com",
    databaseURL: "https://after-hours-hub-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "after-hours-hub",
    storageBucket: "after-hours-hub.appspot.com",
    messagingSenderId: "267243470607",
    appId: "1:267243470607:web:b45dab5ba0828f2adf487a",
    measurementId: "G-0ZYV2HJNBE"
};

/**
 * Cloudinary configuration for image uploads
 * Note: Upload preset should be configured with appropriate restrictions in Cloudinary dashboard
 */
export const cloudinaryConfig = {
    cloudName: "dxnfremyd",
    uploadPreset: "pkgcbofk"
};
