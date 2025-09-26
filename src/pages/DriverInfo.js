import React, { useState, useEffect } from 'react';
import { collection, addDoc, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import './DriverInfo.css';

const DriverInfo = () => {
  const [drivers, setDrivers] = useState([]);
  const [form, setForm] = useState({
    name: '',
    vehicle: ''
  });
  const [showForm, setShowForm] = useState(false);

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

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setForm({ ...form, [name]: value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const newDriver = {
      ...form,
      confirmed: false,
      status: 'Not Set',
      createdAt: new Date()
    };
    await addDoc(collection(db, 'drivers'), newDriver);
    setForm({ name: '', vehicle: '' });
    setShowForm(false);
    // Log to history
    await addDoc(collection(db, 'history'), {
      timestamp: new Date(),
      action: 'Added Driver',
      details: `Driver ${form.name} assigned to ${form.vehicle}`
    });
  };

  return (
    <div className="driver-info">
      <h1>Driver Info</h1>
      <button onClick={() => setShowForm(!showForm)}>+ Add Driver</button>
      {showForm && (
        <form onSubmit={handleSubmit} className="driver-form">
          <input name="name" placeholder="Driver Name" value={form.name} onChange={handleInputChange} required />
          <input name="vehicle" placeholder="Vehicle" value={form.vehicle} onChange={handleInputChange} required />
          <button type="submit">Submit</button>
        </form>
      )}
      <div className="driver-list">
        {drivers.map(driver => (
          <div key={driver.id} className="driver-card">
            <p>Name: {driver.name}</p>
            <p>Vehicle: {driver.vehicle}</p>
            <p>Confirmed: {driver.confirmed ? 'Yes' : 'No'}</p>
            <p>Status: {driver.status}</p>
          </div>
        ))}
      </div>
      <p>For drivers to log in and update, they can access /driver-login</p>
    </div>
  );
};

export default DriverInfo;