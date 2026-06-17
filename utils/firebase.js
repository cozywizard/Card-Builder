import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';
import { getFirestore } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import { getStorage } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-storage.js';

// Fill in your Firebase project config here.
// Get it from: Firebase Console → Project Settings → Your apps → Web app → SDK setup
const firebaseConfig = {
  apiKey: "AIzaSyCL8v2YOoIKLD2MIP3XAGSeBRz2ym42B2U",
  authDomain: "card-builder-dd32d.firebaseapp.com",
  projectId: "card-builder-dd32d",
  storageBucket: "card-builder-dd32d.firebasestorage.app",
  messagingSenderId: "952211618454",
  appId: "1:952211618454:web:699fd07236842ecf1d60b7",
  measurementId: "G-NK1T22SBDE"
};

export const isFirebaseConfigured = !firebaseConfig.apiKey.startsWith('REPLACE');

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const firestoreDb = getFirestore(app);
export const storage = getStorage(app);
