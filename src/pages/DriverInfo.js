import React, { useState, useEffect } from 'react';
import { collection, addDoc, onSnapshot, query, orderBy, updateDoc, doc } from 'firebase/firestore';
import { db } from '../firebase';
import { useVehicles } from '../contexts/VehicleContext';
import './DriverInfo.css';


const DriverInfo = () => {
  const { vehicles, updateVehicle } = useVehicles();
  const [drivers, setDrivers] = useState([]);
  const [form, setForm] = useState({
    name: '',
    vehicle: ''
  });
  const [showForm, setShowForm] = useState(false);
  const [editingDriver, setEditingDriver] = useState(null);

  useEffect(() => {
    const q = query(collection(db, 'drivers'), orderBy('createdAt'));
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const driversData = [];
      querySnapshot.forEach((docSnap) => {
        driversData.push({ id: docSnap.id, ...docSnap.data() });
      });

      // Derive drivers from initialized vehicles, then merge (no duplicates by name)
      // Only include drivers that are assigned to vehicles (exclude old drivers like Alice Brown and John Doe)
      const derivedFromVehicles = vehicles
        .map(v => ({
          id: `veh-${v.id}`,
          name: v.driver,
          vehicle: v.name,
          confirmed: true,
          status: v.status || 'Available'
        }))
        .filter(d => d.name && ['Randy Maduro', 'Adrian Silao', 'Fernando Besa', 'Joseph Allan Saldivar'].includes(d.name));

      const existingByName = new Set(driversData.map(d => (d.name || '').toLowerCase()));
      const merged = [
        ...driversData.filter(d => ['Randy Maduro', 'Adrian Silao', 'Fernando Besa', 'Joseph Allan Saldivar'].includes(d.name)),
        ...derivedFromVehicles.filter(d => !existingByName.has((d.name || '').toLowerCase()))
      ];

      setDrivers(merged);
    });
    return unsubscribe;
  }, [vehicles]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setForm({ ...form, [name]: value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      if (editingDriver) {
        if (!editingDriver.id || String(editingDriver.id).startsWith('veh-')) {
          // Derived from vehicles; create a persistent driver document
          const newDriver = {
            name: form.name,
            vehicle: form.vehicle,
            confirmed: false,
            status: 'Not Set',
            createdAt: new Date()
          };
          const ref = await addDoc(collection(db, 'drivers'), newDriver);
          // Log to history
          await addDoc(collection(db, 'history'), {
            timestamp: new Date(),
            action: 'Added Driver',
            details: `Driver ${newDriver.name} assigned to ${newDriver.vehicle}`
          });
        } else {
          // Update existing Firestore driver
          await updateDoc(doc(db, 'drivers', editingDriver.id), form);
          setDrivers(drivers.map(d => d.id === editingDriver.id ? { ...d, ...form } : d));
          await addDoc(collection(db, 'history'), {
            timestamp: new Date(),
            action: 'Updated Driver',
            details: `Driver ${form.name} updated vehicle to ${form.vehicle}`
          });
        }
      } else {
        // Add new driver
        const newDriver = {
          ...form,
          confirmed: false,
          status: 'Not Set',
          createdAt: new Date()
        };
        await addDoc(collection(db, 'drivers'), newDriver);
        await addDoc(collection(db, 'history'), {
          timestamp: new Date(),
          action: 'Added Driver',
          details: `Driver ${form.name} assigned to ${form.vehicle}`
        });
      }

      // Reflect assignment back to vehicle context
      const vehicle = vehicles.find(v => v.name === form.vehicle);
      if (vehicle) {
        updateVehicle(vehicle.id, { driver: form.name });
      }

      setForm({ name: '', vehicle: '' });
      setShowForm(false);
      setEditingDriver(null);
    } catch (err) {
      console.error('Driver save failed', err);
      alert('Failed to save driver. Please try again.');
    }
  };

  const handleEdit = (driver) => {
    setForm({ name: driver.name, vehicle: driver.vehicle });
    setEditingDriver(driver);
    setShowForm(true);
  };

  return (
    <div className="driver-info">
      <h1>Driver Info</h1>
      {showForm && (
        <form onSubmit={handleSubmit} className="driver-form">
          <input name="name" placeholder="Driver Name" value={form.name} onChange={handleInputChange} required />
          <select name="vehicle" value={form.vehicle} onChange={handleInputChange} required>
            <option value="">Select Vehicle</option>
            {vehicles.map(vehicle => (
              <option key={vehicle.id} value={vehicle.name}>{vehicle.name}</option>
            ))}
          </select>
          <button type="submit">Submit</button>
        </form>
      )}
      <div className="driver-list grid">
        {drivers.map(driver => (
          <div key={driver.id} className="card" title={`${driver.name} • ${driver.vehicle || 'Unassigned'}`}>
            <div className="card-header">
              <div>
                <div className="card-title">{driver.name}</div>
                <div className="card-subtitle">Vehicle: {driver.vehicle || '—'}</div>
              </div>
              <div className={`badge ${driver.status === 'Available' ? 'success' : (driver.status === 'Unavailable' ? 'danger' : (driver.status === 'In-transit' ? 'transit' : 'warning'))}`}>
                <span className="dot"></span>
                {driver.status || 'Not Set'}
              </div>
            </div>
            <div className="card-meta">Confirmed: {driver.confirmed ? 'Yes' : 'No'}</div>
            <div className="card-footer">
              <button className="btn btn-primary" onClick={() => handleEdit(driver)}>Edit</button>
            </div>
          </div>
        ))}
      </div>
      <p className="card-meta" style={{ marginTop: 12 }}>For drivers to log in and update, they can access /driver-login</p>
    </div>
  );
};

export default DriverInfo;
