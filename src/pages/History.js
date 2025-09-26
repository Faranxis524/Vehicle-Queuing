import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import './History.css';

const History = () => {
  const [history, setHistory] = useState([]);

  useEffect(() => {
    const q = query(collection(db, 'history'), orderBy('timestamp', 'desc'));
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const historyData = [];
      querySnapshot.forEach((doc) => {
        historyData.push(doc.data());
      });
      setHistory(historyData);
    });
    return unsubscribe;
  }, []);

  return (
    <div className="history">
      <h1>History</h1>
      <ul>
        {history.map((entry, index) => (
          <li key={index}>
            {entry.timestamp.toDate().toLocaleString()}: {entry.action} - {entry.details}
          </li>
        ))}
      </ul>
    </div>
  );
};

export default History;