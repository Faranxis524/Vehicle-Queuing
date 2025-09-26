// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyArdGviA_Xk9_O_nAdJbFIVEVo6BqDwXG8",
  authDomain: "capstone-94ad6.firebaseapp.com",
  projectId: "capstone-94ad6",
  storageBucket: "capstone-94ad6.firebasestorage.app",
  messagingSenderId: "384643827894",
  appId: "1:384643827894:web:8d2108d2aeecdcc54ffe17",
  measurementId: "G-C6G3D635FK"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);

// Initialize Cloud Firestore and get a reference to the service
export const db = getFirestore(app);