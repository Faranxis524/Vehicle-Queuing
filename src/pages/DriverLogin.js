import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, query, orderBy, doc, updateDoc, addDoc, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { useVehicles } from '../contexts/VehicleContext';
import './DriverLogin.css';

const DriverLogin = () => {
  const { vehicles, setVehicleReadyByName } = useVehicles();
  const [drivers, setDrivers] = useState([]);
  const [loggedInDriver, setLoggedInDriver] = useState(null);
  const [loginName, setLoginName] = useState('');
  const [status, setStatus] = useState('');
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'light');

  useEffect(() => {
    const value = theme === 'light' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', value);
    localStorage.setItem('theme', value);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => (prev === 'light' ? 'dark' : 'light'));
  };

  const handleLogout = () => {
    setLoggedInDriver(null);
    setLoginName('');
    setStatus('');
  };

  useEffect(() => {
    const q = query(collection(db, 'drivers'), orderBy('createdAt'));
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const driversData = [];
      querySnapshot.forEach((doc) => {
        driversData.push({ id: doc.id, ...doc.data() });
      });

      // Derive driver entries from initialized vehicles, then merge by unique name
      const derivedFromVehicles = (vehicles || [])
        .map(v => ({
          id: `veh-${v.id}`,
          name: v.driver,
          vehicle: v.name,
          confirmed: true,
          status: v.status || 'Available'
        }))
        .filter(d => d.name);

      const existingByName = new Set(driversData.map(d => (d.name || '').toLowerCase()));
      const merged = [
        ...driversData,
        ...derivedFromVehicles.filter(d => !existingByName.has((d.name || '').toLowerCase()))
      ];

      setDrivers(merged);
    });
    return unsubscribe;
  }, [vehicles]);

  // Prefill loginName from centralized login redirect (?name=...) and auto-login when drivers have loaded
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const name = params.get('name');
    if (name) setLoginName(name);
  }, []);

  useEffect(() => {
    if (!loggedInDriver && loginName && drivers.length > 0) {
      const driver = drivers.find(d => d.name.toLowerCase() === loginName.toLowerCase());
      if (driver) {
        setLoggedInDriver(driver);
        setStatus(driver.status);
      }
    }
  }, [drivers, loginName, loggedInDriver]);
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
    let driverDocId = loggedInDriver.id;
    if (!driverDocId || String(driverDocId).startsWith('veh-')) {
      // Create a persistent driver document for derived entries
      const newDocRef = await addDoc(collection(db, 'drivers'), {
        name: loggedInDriver.name,
        vehicle: loggedInDriver.vehicle,
        confirmed: true,
        status: loggedInDriver.status || 'Not Set',
        createdAt: new Date()
      });
      driverDocId = newDocRef.id;
      setLoggedInDriver({ ...loggedInDriver, id: driverDocId, confirmed: true });
    } else {
      await updateDoc(doc(db, 'drivers', driverDocId), { confirmed: true });
      setLoggedInDriver({ ...loggedInDriver, confirmed: true });
    }
    // Log to history
    await addDoc(collection(db, 'history'), {
      timestamp: new Date(),
      action: 'Driver Confirmed',
      details: `Driver ${loggedInDriver.name} confirmed`
    });
  };

  const handleStatusUpdate = async () => {
    // Ensure we have a persistent driver document (create if derived from vehicles)
    let driverDocId = loggedInDriver.id;
    if (!driverDocId || String(driverDocId).startsWith('veh-')) {
      const newDocRef = await addDoc(collection(db, 'drivers'), {
        name: loggedInDriver.name,
        vehicle: loggedInDriver.vehicle,
        confirmed: !!loggedInDriver.confirmed,
        status,
        createdAt: new Date()
      });
      driverDocId = newDocRef.id;
      setLoggedInDriver({ ...loggedInDriver, id: driverDocId, status });
    } else {
      await updateDoc(doc(db, 'drivers', driverDocId), { status });
      setLoggedInDriver({ ...loggedInDriver, status });
    }

    // Update vehicle ready status based on driver status
    const vehicleReady = status === 'Available';

    // Mirror to local context for immediate UI responsiveness
    setVehicleReadyByName(loggedInDriver.vehicle, vehicleReady);

    // Persist to Firestore (kept collection name 'trucks' for backward compatibility)
    const trucksQuery = query(collection(db, 'trucks'));
    const trucksSnapshot = await getDocs(trucksQuery);
    trucksSnapshot.forEach(async (truckDoc) => {
      if (truckDoc.data().name === loggedInDriver.vehicle) {
        await updateDoc(doc(db, 'trucks', truckDoc.id), { ready: vehicleReady });
      }
    });

    // Log to history
    await addDoc(collection(db, 'history'), {
      timestamp: new Date(),
      action: 'Status Updated',
      details: `Driver ${loggedInDriver.name} set status to ${status}, vehicle ${loggedInDriver.vehicle} ready: ${vehicleReady}`
    });
  };

  return (
    <div className="driver-login">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <h1>Driver Login</h1>
        <div style={{ display: 'flex', gap: '8px' }}>
          {loggedInDriver && (
            <button className="btn btn-secondary" onClick={handleLogout} style={{ padding: '6px 10px', fontSize: '11px' }}>
              Logout
            </button>
          )}
          <button className="btn" onClick={toggleTheme} style={{ padding: '6px 10px', fontSize: '11px' }}>
            {theme === 'light' ? 'Dark Mode' : 'Light Mode'}
          </button>
        </div>
      </div>
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
          {!loggedInDriver.confirmed && <button className="btn btn-primary" onClick={handleConfirm}>Confirm</button>}
          <div className="status-row">
            <label className="card-meta">Vehicle Status</label>
            <select value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="Not Set">Not Set</option>
              <option value="Available">Available</option>
              <option value="Unavailable">Unavailable</option>
              <option value="Under Maintenance">Under Maintenance</option>
            </select>
            <button className="btn btn-primary" onClick={handleStatusUpdate}>Update Status</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default DriverLogin;