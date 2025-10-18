import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import { useVehicles } from '../contexts/VehicleContext';
import './VehicleMonitoring.css';

const VehicleMonitoring = () => {
  const { vehicles, setVehicles } = useVehicles();
  const [selectedVehicle, setSelectedVehicle] = useState(null);
  const [showModal, setShowModal] = useState(false);

  // Listen for real-time updates from Firestore trucks collection and drivers collection
  useEffect(() => {
    const trucksQuery = query(collection(db, 'trucks'), orderBy('createdAt'));
    const driversQuery = query(collection(db, 'drivers'), orderBy('createdAt'));

    const unsubscribeTrucks = onSnapshot(trucksQuery, (querySnapshot) => {
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

    const unsubscribeDrivers = onSnapshot(driversQuery, (querySnapshot) => {
      const driversData = [];
      querySnapshot.forEach((doc) => {
        driversData.push({ id: doc.id, ...doc.data() });
      });

      // Update vehicle driver status in context based on Firestore data
      setVehicles(prevVehicles =>
        prevVehicles.map(vehicle => {
          const driverData = driversData.find(driver => driver.name === vehicle.driver);
          if (driverData) {
            return { ...vehicle, status: driverData.status || 'Not Set' };
          }
          return vehicle;
        })
      );
    });

    return () => {
      unsubscribeTrucks();
      unsubscribeDrivers();
    };
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
                <div className={`badge ${vehicle.ready && vehicle.status === 'Available' ? 'success' : 'warning'}`}>
                  <span className="dot"></span>
                  {vehicle.ready && vehicle.status === 'Available' ? 'Available' : 'Unavailable'}
                </div>
              </div>
              <div className="card-meta">Driver: {vehicle.driver}</div>
              <div className="card-meta">Status: {vehicle.status || 'Not Set'}</div>
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
            <p>Status: {selectedVehicle.ready && selectedVehicle.status === 'Available' ? 'Available' : 'Unavailable'}</p>
            <p>Driver Status: {selectedVehicle.status || 'Not Set'}</p>
            <p>Vehicle Ready: {selectedVehicle.ready ? 'Yes' : 'No'}</p>
            <button onClick={() => setShowModal(false)}>Close</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default VehicleMonitoring;