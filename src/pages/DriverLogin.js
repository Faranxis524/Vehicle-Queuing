import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, query, orderBy, doc, updateDoc, addDoc } from 'firebase/firestore';
import { db } from '../firebase';
import './DriverLogin.css';

const DriverLogin = () => {
  const [drivers, setDrivers] = useState([]);
  const [loggedInDriver, setLoggedInDriver] = useState(null);
  const [loginName, setLoginName] = useState('');
  const [status, setStatus] = useState('');

  useEffect(() => {
    const q = query(collection(db, 'drivers'), orderBy('createdAt'));
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const driversData = [];
      querySnapshot.forEach((doc) => {
        driversData.push({ id: doc.id, ...doc.data() });
      });
      setDrivers(driversData);
    });
    return unsubscribe;
  }, []);

  const handleLogin = () => {
    const driver = drivers.find(d => d.name.toLowerCase() === loginName.toLowerCase());
    if (driver) {
      setLoggedInDriver(driver);
      setStatus(driver.status);
    } else {
      alert('Driver not found');
    }
  };

  const handleConfirm = async () => {
    await updateDoc(doc(db, 'drivers', loggedInDriver.id), { confirmed: true });
    setLoggedInDriver({ ...loggedInDriver, confirmed: true });
    // Log to history
    await addDoc(collection(db, 'history'), {
      timestamp: new Date(),
      action: 'Driver Confirmed',
      details: `Driver ${loggedInDriver.name} confirmed`
    });
  };

  const handleStatusUpdate = async () => {
    await updateDoc(doc(db, 'drivers', loggedInDriver.id), { status });
    setLoggedInDriver({ ...loggedInDriver, status });
    // Log to history
    await addDoc(collection(db, 'history'), {
      timestamp: new Date(),
      action: 'Status Updated',
      details: `Driver ${loggedInDriver.name} set status to ${status}`
    });
  };

  return (
    <div className="driver-login">
      <h1>Driver Login</h1>
      {!loggedInDriver ? (
        <div>
          <input placeholder="Enter Driver Name" value={loginName} onChange={(e) => setLoginName(e.target.value)} />
          <button onClick={handleLogin}>Login</button>
        </div>
      ) : (
        <div>
          <h2>Welcome, {loggedInDriver.name}</h2>
          <p>Vehicle: {loggedInDriver.vehicle}</p>
          <p>Confirmed: {loggedInDriver.confirmed ? 'Yes' : 'No'}</p>
          {!loggedInDriver.confirmed && <button onClick={handleConfirm}>Confirm</button>}
          <div>
            <label>Vehicle Status:</label>
            <select value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="Not Set">Not Set</option>
              <option value="Ready">Ready</option>
              <option value="Available">Available</option>
              <option value="Under Maintenance">Under Maintenance</option>
            </select>
            <button onClick={handleStatusUpdate}>Update Status</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default DriverLogin;