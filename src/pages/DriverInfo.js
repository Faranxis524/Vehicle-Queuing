import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import { useVehicles } from '../contexts/VehicleContext';
import './DriverInfo.css';

// Extended driver information with contact details and helpers
const driverDetails = {
  'Randy Maduro': {
    vehicle: 'Isuzu Truck',
    contactNumber: '09154080447',
    helpers: [
      { name: 'Marvin Soriano', contactNumber: '09169334034' },
      { name: 'Raymond Marbella', contactNumber: 'N/A' }
    ]
  },
  'Adrian Silao': {
    vehicle: 'Hyundai H100',
    contactNumber: '09096835513',
    helpers: [
      { name: 'Randolph Villamor', contactNumber: '09123305204' }
    ]
  },
  'Fernando Besa': {
    vehicle: 'Isuzu Flexy Small',
    contactNumber: '09551453174',
    helpers: [
      { name: 'Noel Bulahog', contactNumber: '09702937219' }
    ]
  },
  'Joseph Allan Saldivar': {
    vehicle: 'Isuzu Flexy Big',
    contactNumber: '09751432072',
    helpers: [
      { name: 'Ronilo Ligao', contactNumber: '09932977963' }
    ]
  }
};


const DriverInfo = () => {
  const { vehicles } = useVehicles();
  const [drivers, setDrivers] = useState([]);

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



  return (
    <div className="driver-info">
      <h1>Driver Info</h1>
      <div className="driver-list grid">
        {drivers.map(driver => {
          const details = driverDetails[driver.name];
          return (
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

              {details && (
                <div className="card-content">
                  <div className="driver-contact">
                    <p><strong>Contact Number:</strong> {details.contactNumber}</p>
                  </div>

                  {details.helpers && details.helpers.length > 0 && (
                    <div className="truck-helpers">
                      {details.helpers.map((helper, index) => (
                        <div key={index} className="helper-info">
                          <p><strong>Truck Helper:</strong> {helper.name}</p>
                          <p><strong>Contact Number:</strong> {helper.contactNumber}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
      <p className="card-meta" style={{ marginTop: 12 }}>For drivers to log in and update, they can access /login</p>
    </div>
  );
};

export default DriverInfo;
