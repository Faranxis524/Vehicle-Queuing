// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
// Prefer environment variables for per-environment configuration. These
// fall back to the committed values for local development if env vars
// are not provided.
const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY || "AIzaSyArdGviA_Xk9_O_nAdJbFIVEVo6BqDwXG8",
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN || "capstone-94ad6.firebaseapp.com",
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID || "capstone-94ad6",
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET || "capstone-94ad6.firebasestorage.app",
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID || "384643827894",
  appId: process.env.REACT_APP_FIREBASE_APP_ID || "1:384643827894:web:8d2108d2aeecdcc54ffe17",
  measurementId: process.env.REACT_APP_FIREBASE_MEASUREMENT_ID || "G-C6G3D635FK"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);

// Initialize Cloud Firestore and get a reference to the service
export const db = getFirestore(app);