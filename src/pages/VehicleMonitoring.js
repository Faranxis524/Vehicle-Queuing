import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import { useVehicles } from '../contexts/VehicleContext';
import './VehicleMonitoring.css';

const VehicleMonitoring = () => {
  const { vehicles, setVehicles } = useVehicles();
  const [selectedVehicle, setSelectedVehicle] = useState(null);
  const [selectedPO, setSelectedPO] = useState(null);
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
        {[...vehicles].sort((a, b) => a.capacity - b.capacity).map(vehicle => {
          // Calculate the maximum load across all delivery dates for this vehicle
          const dateGroups = {};
          assignedPOs
            .filter(po => po.assignedTruck === vehicle.name)
            .forEach(po => {
              if (!dateGroups[po.deliveryDate]) dateGroups[po.deliveryDate] = 0;
              dateGroups[po.deliveryDate] += po.load || 0;
            });
          const maxLoadForVehicle = Math.max(...Object.values(dateGroups), 0);

          // Check if vehicle has any POs in transit
          const hasInTransitPOs = assignedPOs.some(po =>
            po.assignedTruck === vehicle.name && po.status === 'in-transit'
          );

          const used = maxLoadForVehicle;
          const capacity = vehicle.capacity || 1;
          const pct = Math.min(100, (used / capacity) * 100);
          const remaining = Math.max(0, capacity - used);

          // Determine vehicle status display
          let statusDisplay = vehicle.status || 'Not Set';
          let badgeClass = 'warning';
          let badgeText = 'Unavailable';

          if (hasInTransitPOs) {
            statusDisplay = 'In-transit';
            badgeClass = 'transit';
            badgeText = 'In-transit';
          } else if (vehicle.ready && vehicle.status === 'Available') {
            badgeClass = 'success';
            badgeText = 'Available';
          }

          return (
            <div
              key={vehicle.id}
              className="card"
              onClick={() => { setSelectedVehicle(vehicle); setShowModal(true); }}
              title={`${vehicle.name} • Remaining: ${remaining.toLocaleString()} cm³`}
            >
              <div className="card-header">
                <div>
                  <div className="card-title">{vehicle.name}</div>
                  <div className="card-subtitle">Plate: {vehicle.plateNumber}</div>
                </div>
                <div className={`badge ${badgeClass}`}>
                  <span className="dot"></span>
                  {badgeText}
                </div>
              </div>
              <div className="card-meta">Driver: {vehicle.driver}</div>
              <div className="card-meta">Status: {statusDisplay}</div>
              <div className="progress" aria-label="Load utilization">
                <span style={{ width: `${pct}%` }} />
              </div>
              <div className="card-footer">
                <span className="card-meta">{pct.toFixed(1)}% used • Remaining {remaining.toLocaleString()} cm³</span>
              </div>
            </div>
          );
        })}
      </div>
      {showModal && selectedVehicle && !selectedPO && (
        <div className="modal">
          <div className="modal-content">
            <h2>POs Assigned to {selectedVehicle.name}</h2>
            <div className="assigned-pos-grid">
              {assignedPOs
                .filter(po => po.assignedTruck === selectedVehicle.name)
                .map(po => (
                  <div key={po.id} className="po-card vehicle-po-card" onClick={() => setSelectedPO(po)}>
                    <div className="po-header">
                      <span className="po-number">PO {po.customId}</span>
                      <span className={`po-status ${po.status}`}>{po.status || 'pending'}</span>
                    </div>
                    <div className="po-summary">
                      <p><strong>{po.companyName}</strong></p>
                      <p>{po.customerName}</p>
                      <p>{po.location}</p>
                      <p>{po.deliveryDate}</p>
                      <p><strong>Load: {po.load ? po.load.toLocaleString() : '0'} cm³</strong></p>
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

      {showModal && selectedPO && (
        <div className="modal">
          <div className="modal-content po-detail-modal">
            <div className="modal-header">
              <h2>Purchase Order {selectedPO.customId}</h2>
            </div>

            <div className="info-grid">
              <div className="info-box vendor-info">
                <h3>Vendor Information</h3>
                <div className="vendor-details">
                  <p><strong>HILTAC MANUFACTURING AND TRADING, INC.</strong></p>
                  <p>10000014896 GATCHALIAN SUBDIVISION</p>
                  <p>BRGY. BANAYBANAY, CABUYAO</p>
                  <p>PH</p>
                  <p>Telephone: 09175168415</p>
                  <p>Email: tristan@hiltac.com</p>
                </div>
              </div>

              <div className="info-box delivery-info">
                <h3>Delivery</h3>
                <div className="delivery-details">
                  <p><strong>Requested date:</strong> {selectedPO.deliveryDate}</p>
                  <p><strong>{selectedPO.customerName}</strong></p>
                  <p>{selectedPO.address || 'Address not provided'}</p>
                </div>
              </div>

              <div className="info-box po-details">
                <h3>Purchase Order Details</h3>
                <div className="po-details-content">
                  <p><strong>Requisitioner:</strong> {selectedPO.customerName}</p>
                  <p><strong>Order:</strong> {selectedPO.customId}</p>
                  <p><strong>Date:</strong> {selectedPO.poDate}</p>
                  <p><strong>Contact:</strong> {selectedPO.contact || 'Not provided'}</p>
                </div>
              </div>

              <div className="info-box billing-info">
                <h3>Billing Information</h3>
                <div className="billing-details">
                  <p>{selectedPO.address || 'Address not provided'}</p>
                  <p>PH</p>
                  <p><strong>Phone:</strong> {selectedPO.phone || 'Not provided'}</p>
                </div>
              </div>
            </div>

            <div className="products-table-section">
              <h3>Order Items</h3>
              <table className="products-table">
                <thead>
                  <tr>
                    <th>Item</th>
                    <th>Description</th>
                    <th>External Code</th>
                    <th>Quantity</th>
                    <th>Unit</th>
                    <th>Delivery</th>
                    <th>Price</th>
                    <th>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedPO.products.map((item, index) => {
                    const product = {
                      'Interfolded': {
                        packaging: { type: 'case', quantity: 30 },
                        pricing: {
                          perPiece: { price: 26, unit: 'piece' },
                          perPackage: { price: 780, unit: 'case' }
                        }
                      },
                      'Jumbo Roll': {
                        packaging: [
                          { type: 'case', quantity: 12 },
                          { type: 'case', quantity: 16 }
                        ],
                        pricing: {
                          perPiece: { price: 51, unit: 'roll' },
                          perPackage: [
                            { price: 612, unit: 'case', quantity: 12 },
                            { price: 816, unit: 'case', quantity: 16 }
                          ]
                        }
                      },
                      'Bathroom': {
                        packaging: { type: 'bundle', quantity: 48 },
                        pricing: {
                          perPiece: { price: 8.15, unit: 'roll' },
                          perPackage: { price: 408, unit: 'bundle' }
                        }
                      },
                      'Hand Roll': {
                        packaging: { type: 'bundle', quantity: 6 },
                        pricing: {
                          perPiece: { price: 134, unit: 'roll' },
                          perPackage: { price: 804, unit: 'bundle' }
                        }
                      }
                    }[item.product];

                    let price = 0;
                    let unit = 'PCS';

                    if (product) {
                      if (item.pricingType === 'perPiece') {
                        price = product.pricing.perPiece.price;
                        unit = product.pricing.perPiece.unit.toUpperCase();
                      } else if (item.pricingType === 'perPackage') {
                        if (Array.isArray(product.pricing.perPackage)) {
                          const selectedPackage = product.pricing.perPackage.find(p => p.quantity === item.packageQuantity);
                          price = selectedPackage ? selectedPackage.price : product.pricing.perPackage[0].price;
                        } else {
                          price = product.pricing.perPackage.price;
                        }
                        unit = Array.isArray(product.packaging) ? 'CASE' : product.packaging.type.toUpperCase();
                      }
                    }

                    return (
                      <tr key={index}>
                        <td>{index + 1}</td>
                        <td>{item.product}</td>
                        <td>-</td>
                        <td>{item.quantity}</td>
                        <td>{unit}</td>
                        <td>{selectedPO.deliveryDate}</td>
                        <td>₱{price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                        <td>₱{(item.quantity * price).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="summary-section">
              <div className="summary-left">
                <p><strong>Currency:</strong> {selectedPO.currency || 'PHP'}</p>
                <p><strong>Terms of payment:</strong> {selectedPO.termsOfPayment || 'Not specified'}</p>
              </div>
              <div className="summary-right">
                <p><strong>Subtotal:</strong> ₱{selectedPO.totalPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                <p><strong>Sales tax (12%):</strong> ₱{(selectedPO.totalPrice * 0.12).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                <p><strong>Total amount:</strong> ₱{(selectedPO.totalPrice * 1.12).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
              </div>
            </div>

            <div className="modal-actions">
              <button onClick={() => setSelectedPO(null)}>Back to Vehicle</button>
              <button onClick={() => { setSelectedPO(null); setShowModal(false); }}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default VehicleMonitoring;
