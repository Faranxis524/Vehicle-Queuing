import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import { useVehicles } from '../contexts/VehicleContext';
import './VehicleMonitoring.css';

const VehicleMonitoring = () => {
  const { vehicles, setVehicles } = useVehicles();
  const [selectedVehicle, setSelectedVehicle] = useState(null);
  const [showModal, setShowModal] = useState(false);

  // Listen for real-time updates from Firestore trucks collection
  useEffect(() => {
    const q = query(collection(db, 'trucks'), orderBy('createdAt'));
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const trucksData = [];
      querySnapshot.forEach((doc) => {
        trucksData.push({ id: doc.id, ...doc.data() });
      });

      // Update vehicle ready status in context based on Firestore data
      setVehicles(prevVehicles =>
        prevVehicles.map(vehicle => {
          const truckData = trucksData.find(truck => truck.name === vehicle.name);
          if (truckData) {
            return { ...vehicle, ready: truckData.ready };
          }
          return vehicle;
        })
      );
    });

    return unsubscribe;
  }, [setVehicles]);


  return (
    <div className="vehicle-monitoring">
      <h1>Vehicle Monitoring</h1>
      <div className="vehicle-cards grid">
        {vehicles.map(vehicle => {
          const used = vehicle.currentLoad || 0;
          const capacity = vehicle.capacity || 1;
          const pct = Math.min(100, Math.round((used / capacity) * 100));
          const remaining = Math.max(0, capacity - used);
          return (
            <div
              key={vehicle.id}
              className="card"
              onClick={() => { setSelectedVehicle(vehicle); setShowModal(true); }}
              title={`${vehicle.name} • Remaining: ${remaining.toLocaleString()} cm²`}
            >
              <div className="card-header">
                <div>
                  <div className="card-title">{vehicle.name}</div>
                  <div className="card-subtitle">Plate: {vehicle.plateNumber}</div>
                </div>
                <div className={`badge ${vehicle.ready ? 'success' : 'warning'}`}>
                  <span className="dot"></span>
                  {vehicle.ready ? 'Available' : 'In Use'}
                </div>
              </div>
              <div className="card-meta">Driver: {vehicle.driver}</div>
              <div className="progress" aria-label="Load utilization">
                <span style={{ width: `${pct}%` }} />
              </div>
              <div className="card-footer">
                <span className="card-meta">{pct}% used • Remaining {remaining.toLocaleString()} cm²</span>
              </div>
            </div>
          );
        })}
      </div>
      {showModal && selectedVehicle && (
        <div className="modal">
          <div className="modal-content">
            <h2>{selectedVehicle.name}</h2>
            <p>Driver: {selectedVehicle.driver}</p>
            <p>Plate Number: {selectedVehicle.plateNumber}</p>
            <p>Capacity: {selectedVehicle.capacity.toLocaleString()} cm²</p>
            <p>Current Load: {selectedVehicle.currentLoad.toLocaleString()} cm²</p>
            <p>Remaining Capacity: {(selectedVehicle.capacity - selectedVehicle.currentLoad).toLocaleString()} cm²</p>
            <p>Status: {selectedVehicle.ready ? 'Available' : 'In Use'}</p>
            <p>Driver Status: {selectedVehicle.status || 'Not Set'}</p>
            <button onClick={() => setShowModal(false)}>Close</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default VehicleMonitoring;