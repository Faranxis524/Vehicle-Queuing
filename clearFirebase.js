const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, deleteDoc, doc, addDoc } = require('firebase/firestore');

// Your Firebase config
const firebaseConfig = {
  apiKey: "AIzaSyArdGviA_Xk9_O_nAdJbFIVEVo6BqDwXG8",
  authDomain: "capstone-94ad6.firebaseapp.com",
  projectId: "capstone-94ad6",
  storageBucket: "capstone-94ad6.firebasestorage.app",
  messagingSenderId: "384643827894",
  appId: "1:384643827894:web:8d2108d2aeecdcc54ffe17",
  measurementId: "G-C6G3D635FK"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const clearCollection = async (collectionName) => {
  const querySnapshot = await getDocs(collection(db, collectionName));
  const deletePromises = querySnapshot.docs.map(doc => deleteDoc(doc.ref));
  await Promise.all(deletePromises);
  console.log(`Cleared ${querySnapshot.docs.length} documents from ${collectionName}`);
};

const initializeDrivers = async () => {
  const drivers = [
    { name: 'Fernando Besa', vehicle: 'Isuzu Flexy Small', confirmed: true, status: 'Available' },
    { name: 'Joseph Allan Saldivar', vehicle: 'Isuzu Flexy Big', confirmed: true, status: 'Available' },
    { name: 'Randy Maduro', vehicle: 'Isuzu Truck', confirmed: true, status: 'Available' },
    { name: 'Adrian Silao', vehicle: 'H100', confirmed: true, status: 'Available' }
  ];

  for (const driver of drivers) {
    await addDoc(collection(db, 'drivers'), { ...driver, createdAt: new Date() });
  }
  console.log('Initialized drivers.');
};

const clearAll = async () => {
  try {
    await clearCollection('pos');
    await clearCollection('history');
    await clearCollection('drivers');
    // Add other collections if needed
    console.log('All collections cleared.');
    await initializeDrivers();
  } catch (error) {
    console.error('Error clearing Firebase:', error);
  }
};

clearAll();
