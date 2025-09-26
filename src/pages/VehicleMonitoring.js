import React, { useState, useEffect } from 'react';
import { collection, addDoc, onSnapshot, doc, deleteDoc, query, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import './VehicleMonitoring.css';

const VehicleMonitoring = () => {
  const [vehicles, setVehicles] = useState([]);
  const [form, setForm] = useState({
    sampleInfo1: '',
    sampleInfo2: '',
    sampleInfo3: '',
    quantity: '',
    particulars: '',
    unitPrice: '',
    totalPrice: ''
  });
  const [showForm, setShowForm] = useState(false);
  const [selectedVehicle, setSelectedVehicle] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [vehicleCounter, setVehicleCounter] = useState(1);

  useEffect(() => {
    const q = query(collection(db, 'vehicles'), orderBy('createdAt'));
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const vehiclesData = [];
      querySnapshot.forEach((doc) => {
        vehiclesData.push({ id: doc.id, customId: doc.data().customId, ...doc.data() });
      });
      setVehicles(vehiclesData);
      if (vehiclesData.length > 0) {
        const maxId = Math.max(...vehiclesData.map(v => parseInt(v.customId.replace('V', ''))));
        setVehicleCounter(maxId + 1);
      }
    });
    return unsubscribe;
  }, []);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setForm({ ...form, [name]: value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const newVehicle = {
      customId: `V${vehicleCounter}`,
      ...form,
      createdAt: new Date()
    };
    await addDoc(collection(db, 'vehicles'), newVehicle);
    setVehicleCounter(vehicleCounter + 1);
    setForm({
      sampleInfo1: '',
      sampleInfo2: '',
      sampleInfo3: '',
      quantity: '',
      particulars: '',
      unitPrice: '',
      totalPrice: ''
    });
    setShowForm(false);
    // Log to history
    await addDoc(collection(db, 'history'), {
      timestamp: new Date(),
      action: 'Added Vehicle',
      details: `Vehicle ${newVehicle.customId}: Info1: ${newVehicle.sampleInfo1}, Info2: ${newVehicle.sampleInfo2}, Info3: ${newVehicle.sampleInfo3}, Quantity: ${newVehicle.quantity}, Particulars: ${newVehicle.particulars}, Unit Price: ${newVehicle.unitPrice}, Total: ${newVehicle.totalPrice}`
    });
  };

  const handleCardClick = (vehicle) => {
    setSelectedVehicle(vehicle);
    setShowModal(true);
  };

  const handleUpdate = () => {
    setShowModal(false);
  };

  const handleDelete = async () => {
    if (window.confirm('Are you sure you want to delete this vehicle?')) {
      await deleteDoc(doc(db, 'vehicles', selectedVehicle.id));
      setShowModal(false);
      // Log to history
      await addDoc(collection(db, 'history'), {
        timestamp: new Date(),
        action: 'Deleted Vehicle',
        details: `Vehicle ${selectedVehicle.customId}: Info1: ${selectedVehicle.sampleInfo1}, Info2: ${selectedVehicle.sampleInfo2}`
      });
    }
  };

  return (
    <div className="vehicle-monitoring">
      <h1>Vehicle Monitoring</h1>
      <button onClick={() => setShowForm(!showForm)}>+ Add Vehicle</button>
      {showForm && (
        <form onSubmit={handleSubmit} className="vehicle-form">
          <label>Vehicle ID: {`V${vehicleCounter}`} (Automatic)</label>
          <input name="sampleInfo1" placeholder="Sample Info 1" value={form.sampleInfo1} onChange={handleInputChange} required />
          <input name="sampleInfo2" placeholder="Sample Info 2" value={form.sampleInfo2} onChange={handleInputChange} required />
          <input name="sampleInfo3" placeholder="Sample Info 3" value={form.sampleInfo3} onChange={handleInputChange} required />
          <input name="quantity" placeholder="Quantity" value={form.quantity} onChange={handleInputChange} required />
          <input name="particulars" placeholder="Particulars" value={form.particulars} onChange={handleInputChange} required />
          <input name="unitPrice" type="number" placeholder="Unit Price" value={form.unitPrice} onChange={handleInputChange} required />
          <input name="totalPrice" type="number" placeholder="Total Price" value={form.totalPrice} onChange={handleInputChange} required />
          <button type="submit">Submit</button>
        </form>
      )}
      <div className="vehicle-cards">
        {vehicles.map(vehicle => (
          <div key={vehicle.id} className="vehicle-card" onClick={() => handleCardClick(vehicle)}>
            {vehicle.customId}
          </div>
        ))}
      </div>
      {showModal && selectedVehicle && (
        <div className="modal">
          <div className="modal-content">
            <h2>{selectedVehicle.customId}</h2>
            <p>Sample Info 1: {selectedVehicle.sampleInfo1}</p>
            <p>Sample Info 2: {selectedVehicle.sampleInfo2}</p>
            <p>Sample Info 3: {selectedVehicle.sampleInfo3}</p>
            <p>Quantity: {selectedVehicle.quantity}</p>
            <p>Particulars: {selectedVehicle.particulars}</p>
            <p>Unit Price: {selectedVehicle.unitPrice}</p>
            <p>Total Price: {selectedVehicle.totalPrice}</p>
            <button onClick={handleUpdate}>Update</button>
            <button onClick={handleDelete}>Delete</button>
            <button onClick={() => setShowModal(false)}>Close</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default VehicleMonitoring;