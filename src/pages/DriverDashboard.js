import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, query, orderBy, doc, updateDoc, addDoc, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { useVehicles } from '../contexts/VehicleContext';
import './DriverDashboard.css';

const DriverDashboard = () => {
  const { vehicles, setVehicleReadyByName } = useVehicles();
  const [drivers, setDrivers] = useState([]);
  const [loggedInDriver, setLoggedInDriver] = useState(null);
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

  // Assume driver is passed via props or context, for now use localStorage or something
  useEffect(() => {
    const driverName = localStorage.getItem('loggedInDriver');
    if (driverName && drivers.length > 0) {
      const driver = drivers.find(d => d.name === driverName);
      if (driver) {
        setLoggedInDriver(driver);
        setStatus(driver.status);
      }
    }
  }, [drivers]);

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

  const handleLogout = () => {
    localStorage.removeItem('loggedInDriver');
    window.location.href = '/driver-login';
  };

  if (!loggedInDriver) {
    return <div>Loading...</div>;
  }

  return (
    <div className="driver-dashboard">
      <header className="dashboard-header">
        <h1>Driver Dashboard</h1>
        <div className="header-actions">
          <button className="btn" onClick={toggleTheme}>
            {theme === 'light' ? 'Dark Mode' : 'Light Mode'}
          </button>
          <button className="btn btn-secondary" onClick={handleLogout}>
            Logout
          </button>
        </div>
      </header>

      <div className="dashboard-content">
        <div className="welcome-card card">
          <h2>Welcome, {loggedInDriver.name}</h2>
          <p><strong>Vehicle:</strong> {loggedInDriver.vehicle}</p>
          <p><strong>Confirmed:</strong> {loggedInDriver.confirmed ? 'Yes' : 'No'}</p>
          {!loggedInDriver.confirmed && (
            <button className="btn btn-primary" onClick={handleConfirm}>
              Confirm Assignment
            </button>
          )}
        </div>

        <div className="status-card card">
          <h3>Update Vehicle Status</h3>
          <div className="status-controls">
            <label>Current Status</label>
            <select value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="Not Set">Not Set</option>
              <option value="Available">Available</option>
              <option value="Unavailable">Unavailable</option>
              <option value="Under Maintenance">Under Maintenance</option>
            </select>
            <button className="btn btn-primary" onClick={handleStatusUpdate}>
              Update Status
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DriverDashboard;