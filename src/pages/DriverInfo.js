import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import { useVehicles } from '../contexts/VehicleContext';
import './DriverInfo.css';

// Icons as SVG components
const PhoneIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
  </svg>
);

const TruckIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"/>
    <path d="M15 18H9"/>
    <path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14"/>
    <circle cx="17" cy="18" r="2"/>
    <circle cx="7" cy="18" r="2"/>
  </svg>
);

const UserIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
    <circle cx="12" cy="7" r="4"/>
  </svg>
);

const UsersIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
    <circle cx="9" cy="7" r="4"/>
    <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
    <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
  </svg>
);

// Extended driver information with contact details and helpers
const driverDetails = {
  'Randy Maduro': {
    vehicle: '6 Wheeler Truck',
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
    vehicle: 'Isuzu Flexi Small',
    contactNumber: '09551453174',
    helpers: [
      { name: 'Noel Bulahog', contactNumber: '09702937219' }
    ]
  },
  'Joseph Allan Saldivar': {
    vehicle: 'Isuzu Flexi Big',
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
      <div className="driver-info-header">
        <h1>Driver Information</h1>
      </div>

      <div className="driver-list">
        {drivers.map(driver => {
          const details = driverDetails[driver.name];
          const statusClass = driver.status === 'Available' ? 'success' :
                            driver.status === 'Unavailable' ? 'danger' :
                            driver.status === 'In-transit' ? 'transit' : 'warning';

          return (
            <div key={driver.id} className="driver-card">
              <div className="driver-card-header">
                <div className="driver-avatar">
                  <UserIcon />
                </div>
                <div className="driver-basic-info">
                  <h3 className="driver-name">{driver.name}</h3>
                  <div className={`driver-status ${statusClass}`}>
                    <span className="status-dot"></span>
                    {driver.status || 'Not Set'}
                  </div>
                </div>
              </div>

              <div className="driver-card-content">
                <div className="info-section">
                  <div className="info-item">
                    <TruckIcon />
                    <div className="info-content">
                      <span className="info-label">Vehicle</span>
                      <span className="info-value">{driver.vehicle || 'Unassigned'}</span>
                    </div>
                  </div>

                  {details?.contactNumber && (
                    <div className="info-item">
                      <PhoneIcon />
                      <div className="info-content">
                        <span className="info-label">Contact</span>
                        <span className="info-value">{details.contactNumber}</span>
                      </div>
                    </div>
                  )}
                </div>

                {details?.helpers && details.helpers.length > 0 && (
                  <div className="helpers-section">
                    <div className="section-header">
                      <UsersIcon />
                      <span className="section-title">Truck Helpers</span>
                    </div>
                    <div className="helpers-list">
                      {details.helpers.map((helper, index) => (
                        <div key={index} className="helper-item">
                          <div className="helper-info">
                            <span className="helper-name">{helper.name}</span>
                            <span className="helper-contact">{helper.contactNumber}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default DriverInfo;
