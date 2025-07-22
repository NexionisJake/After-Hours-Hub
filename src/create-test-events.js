// Test script to create a sample event for testing
// This will be run once to create test data

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { 
    getFirestore, 
    collection, 
    addDoc,
    serverTimestamp 
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { firebaseConfig } from './firebase-config.js';

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Create test event when authenticated
onAuthStateChanged(auth, async (user) => {
    if (!user) {
        console.log('Please login first');
        return;
    }
    
    try {
        // Create a test approved event
        const testEvent = {
            title: "DSU Valorant Championship",
            description: "Join us for the ultimate Valorant tournament! Battle it out with fellow students for glory and prizes.",
            eventType: "esports",
            game: "Valorant",
            startDate: "2025-02-15T14:00:00.000Z",
            endDate: "2025-02-15T18:00:00.000Z",
            location: "Computer Lab A",
            maxParticipants: 32,
            prize: 5000,
            contactInfo: "esports@dsu.edu",
            createdBy: user.uid,
            createdByName: user.displayName || user.email,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
            status: "approved", // Pre-approved for testing
            participants: []
        };
        
        const docRef = await addDoc(collection(db, 'events'), testEvent);
        console.log('Test event created with ID:', docRef.id);
        
        // Create a pending event for moderation testing
        const pendingEvent = {
            title: "Tech Talk on AI",
            description: "An insightful session on the latest developments in Artificial Intelligence.",
            eventType: "campus",
            category: "academic",
            organizer: "Tech Club",
            startDate: "2025-02-20T15:00:00.000Z",
            location: "Auditorium",
            maxParticipants: 100,
            contactInfo: "techclub@dsu.edu",
            createdBy: user.uid,
            createdByName: user.displayName || user.email,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
            status: "pending_approval",
            participants: []
        };
        
        const pendingDocRef = await addDoc(collection(db, 'events'), pendingEvent);
        console.log('Pending event created with ID:', pendingDocRef.id);
        
        alert('Test events created successfully!');
        
    } catch (error) {
        console.error('Error creating test events:', error);
        alert('Error creating test events: ' + error.message);
    }
});

console.log('Test script loaded. Login to create test events.');
