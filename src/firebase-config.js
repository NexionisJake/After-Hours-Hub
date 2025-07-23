// src/firebase-config.js
// === CENTRALIZED FIREBASE CONFIGURATION ===
// This consolidates all Firebase config in one place for better security and maintainability

// src/firebase-config.js
// === CENTRALIZED FIREBASE CONFIGURATION ===
// This consolidates all Firebase config in one place for better security and maintainability

/**
 * Firebase configuration object
 * Note: These values are safe to be public - they identify your Firebase project
 * The real security comes from Firebase Security Rules on the server-side
 */

// Check if we're in production environment
// Production is only when we're on the actual Firebase hosting domain
const isProduction = window.location.hostname.includes('after-hours-hub.web.app') ||
                    window.location.hostname.includes('after-hours-hub.firebaseapp.com');

console.log('Environment detection:', {
    hostname: window.location.hostname,
    protocol: window.location.protocol,
    isProduction: isProduction
});

// Base configuration without analytics
const baseConfig = {
    apiKey: "AIzaSyBCO6Q8aCJBNF1dMy34TlviwQ3ivc3NvkE",
    authDomain: "after-hours-hub.firebaseapp.com",
    databaseURL: "https://after-hours-hub-default-rtbd.asia-southeast1.firebasedatabase.app",
    projectId: "after-hours-hub",
    storageBucket: "after-hours-hub.appspot.com",
    messagingSenderId: "267243470607",
    appId: "1:267243470607:web:b45dab5ba0828f2adf487a"
};

// Add measurementId only in production to prevent analytics cookies in development
export const firebaseConfig = isProduction ? {
    ...baseConfig,
    measurementId: "G-0ZYV2HJNBE"
} : baseConfig;

/**
 * Cloudinary configuration for image uploads
 * Note: Upload preset should be configured with appropriate restrictions in Cloudinary dashboard
 */
export const cloudinaryConfig = {
    cloudName: "dxnfremyd",
    uploadPreset: "pkgcbofk"
};
