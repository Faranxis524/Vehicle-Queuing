import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import { useVehicles } from '../contexts/VehicleContext';
import './VehicleMonitoring.css';

const VehicleMonitoring = () => {
  const { vehicles, setVehicles } = useVehicles();
  const [selectedVehicle, setSelectedVehicle] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [assignedPOs, setAssignedPOs] = useState([]);

  // Listen for real-time updates from Firestore trucks collection, drivers collection, and POs collection
  useEffect(() => {
    const trucksQuery = query(collection(db, 'trucks'), orderBy('createdAt'));
    const driversQuery = query(collection(db, 'drivers'), orderBy('createdAt'));
    const posQuery = query(collection(db, 'pos'), orderBy('createdAt'));

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

    const unsubscribePOs = onSnapshot(posQuery, (querySnapshot) => {
      const posData = [];
      querySnapshot.forEach((doc) => {
        posData.push({ id: doc.id, customId: doc.data().customId, ...doc.data() });
      });
      // Filter out completed POs
      setAssignedPOs(posData.filter(po => po.status !== 'completed'));
    });

    return () => {
      unsubscribeTrucks();
      unsubscribeDrivers();
      unsubscribePOs();
    };
  }, [setVehicles]);


  return (
    <div className="vehicle-monitoring">
      <h1>Vehicle Monitoring</h1>
      <div className="vehicle-cards grid">
        {vehicles.map(vehicle => {
          // Calculate the maximum load across all delivery dates for this vehicle
          const dateGroups = {};
          assignedPOs
            .filter(po => po.assignedTruck === vehicle.name)
            .forEach(po => {
              if (!dateGroups[po.deliveryDate]) dateGroups[po.deliveryDate] = 0;
              dateGroups[po.deliveryDate] += po.load || 0;
            });
          const maxLoadForVehicle = Math.max(...Object.values(dateGroups), 0);

          const used = maxLoadForVehicle;
          const capacity = vehicle.capacity || 1;
          const pct = Math.min(100, (used / capacity) * 100);
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
                <span className="card-meta">{pct.toFixed(1)}% used • Remaining {remaining.toLocaleString()} cm²</span>
              </div>
            </div>
          );
        })}
      </div>
      {showModal && selectedVehicle && (
        <div className="modal">
          <div className="modal-content">
            <h2>POs Assigned to {selectedVehicle.name}</h2>
            <div className="assigned-pos-grid">
              {assignedPOs
                .filter(po => po.assignedTruck === selectedVehicle.name)
                .map(po => (
                  <div key={po.id} className="po-card vehicle-po-card">
                    <div className="po-header">
                      <span className="po-number">PO {po.customId}</span>
                      <span className={`po-status ${po.status}`}>{po.status || 'pending'}</span>
                    </div>
                    <div className="po-summary">
                      <p><strong>{po.companyName}</strong></p>
                      <p>{po.customerName}</p>
                      <p>{po.location}</p>
                      <p>{po.deliveryDate}</p>
                      <p><strong>Load: {po.load ? po.load.toLocaleString() : '0'} cm²</strong></p>
                    </div>
                  </div>
                ))}
              {assignedPOs.filter(po => po.assignedTruck === selectedVehicle.name).length === 0 && (
                <div className="no-pos-card">
                  <p>No POs assigned to this vehicle.</p>
                </div>
              )}
            </div>
            <button onClick={() => setShowModal(false)}>Close</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default VehicleMonitoring;