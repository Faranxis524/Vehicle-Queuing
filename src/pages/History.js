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
      <table className="history-table table-elevated">
        <thead>
          <tr>
            <th>Timestamp</th>
            <th>Action</th>
            <th>Details</th>
          </tr>
        </thead>
        <tbody>
          {history.map((entry, index) => (
            <tr key={index}>
              <td>{entry.timestamp.toDate().toLocaleString()}</td>
              <td>{entry.action}</td>
              <td style={{ whiteSpace: 'pre-line' }}>{entry.details.replace(/, /g, '\n')}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default History;