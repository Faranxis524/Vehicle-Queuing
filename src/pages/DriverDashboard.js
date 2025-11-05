import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, query, orderBy, doc, updateDoc, addDoc, getDocs } from 'firebase/firestore';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db } from '../firebase';
import { useVehicles } from '../contexts/VehicleContext';
import './DriverDashboard.css';

const products = {
  'Interfolded': {
    size: 70780.5,
    packaging: { type: 'case', quantity: 30, name: 'Case (30 pcs)' },
    pricing: {
      perPiece: { price: 26, unit: 'piece', capacity: 0 },
      perPackage: { price: 780, unit: 'case' }
    }
  },
  'Jumbo Roll': {
    size: 39016.5, // Updated to match 12-roll case volume
    packaging: [
      { type: 'case', quantity: 12, name: 'Case (12 rolls)' },
      { type: 'case', quantity: 16, name: 'Case (16 rolls)' }
    ],
    pricing: {
      perPiece: { price: 51, unit: 'roll', capacity: 0 },
      perPackage: [
        { price: 612, unit: 'case', quantity: 12 },
        { price: 816, unit: 'case', quantity: 16 }
      ]
    }
  },
  'Bathroom': {
    size: 45630,
    packaging: { type: 'bundle', quantity: 48, name: 'Bundle (48 rolls)' },
    pricing: {
      perPiece: { price: 8.15, unit: 'roll', capacity: 0 },
      perPackage: { price: 408, unit: 'bundle' }
    }
  },
  'Hand Roll': {
    size: 46200,
    packaging: { type: 'bundle', quantity: 6, name: 'Bundle (6 rolls)' },
    pricing: {
      perPiece: { price: 134, unit: 'roll', capacity: 0 },
      perPackage: { price: 804, unit: 'bundle' }
    }
  }
};

const DriverDashboard = () => {
  const { vehicles, setVehicleReadyByName } = useVehicles();
  const [drivers, setDrivers] = useState([]);
  const [pos, setPos] = useState([]);
  const [loggedInDriver, setLoggedInDriver] = useState(null);
  const [status, setStatus] = useState('');
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'light');
  const [selectedPO, setSelectedPO] = useState(null);
  const [updatingStatus, setUpdatingStatus] = useState(false);

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
  useEffect(() => {
    const q = query(collection(db, 'pos'), orderBy('createdAt'));
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const posData = [];
      querySnapshot.forEach((doc) => {
        posData.push({ id: doc.id, ...doc.data() });
      });
      setPos(posData);
    });
    return unsubscribe;
  }, []);

  // Assume driver is passed via props or context, for now use localStorage or something
  useEffect(() => {
    const driverName = localStorage.getItem('loggedInDriver');
    if (driverName && drivers.length > 0) {
      const driver = drivers.find(d => d.name === driverName);
      if (driver) {
        setLoggedInDriver(driver);
        setStatus(driver.status);
        console.log('Driver logged in:', driver.name, 'Vehicle:', driver.vehicle);
      } else {
        console.log('Driver not found in drivers list:', driverName);
      }
    }
  }, [drivers]);

  // Debug: Log POs and filtering
  useEffect(() => {
    if (loggedInDriver && pos.length > 0) {
      const assignedPOs = pos.filter(po => po.assignedDriver === loggedInDriver.name);
      console.log('=== DRIVER DASHBOARD DEBUG ===');
      console.log('Logged in driver:', loggedInDriver.name);
      console.log('Driver vehicle:', loggedInDriver.vehicle);
      console.log('Total POs in system:', pos.length);
      console.log('POs with assignedDriver field:', pos.filter(po => po.assignedDriver).length);
      console.log('POs assigned to this driver:', assignedPOs.length);
      console.log('All POs with assignedDriver:', pos.filter(po => po.assignedDriver).map(po => ({
        id: po.id,
        customId: po.customId,
        assignedDriver: po.assignedDriver,
        assignedTruck: po.assignedTruck
      })));
      console.log('POs that should show for this driver:', pos.filter(po =>
        po.assignedDriver === loggedInDriver.name ||
        po.assignedTruck === loggedInDriver.vehicle
      ).map(po => ({ id: po.id, customId: po.customId, assignedDriver: po.assignedDriver, assignedTruck: po.assignedTruck })));
    }
  }, [loggedInDriver, pos]);

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
    // Check if trying to change from In-transit status
    if (loggedInDriver.status === 'In-transit' && status !== 'In-transit') {
      const assignedPOs = pos.filter(po => po.assignedDriver === loggedInDriver.name || po.assignedTruck === loggedInDriver.vehicle);
      const allDone = assignedPOs.every(po => po.deliveryStatus === 'done');
      if (!allDone) {
        alert('You cannot change your status from In-transit until all assigned POs are marked as done.');
        setUpdatingStatus(false);
        return;
      }
    }

    setUpdatingStatus(true);
    try {
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

      // Handle status changes that affect PO statuses
      if (status === 'Available') {
        const vehicle = vehicles.find(v => v.name === loggedInDriver.vehicle);
        if (vehicle) {
          const onHoldPOs = pos.filter(po => po.assignedTruck === loggedInDriver.vehicle && po.status === 'on-hold');
          for (const po of onHoldPOs) {
            await updateDoc(doc(db, 'pos', po.id), { status: 'assigned' });
            await addDoc(collection(db, 'history'), {
              timestamp: new Date(),
              action: 'PO Status Auto-Updated',
              details: `PO ${po.customId} status changed from on-hold to assigned - driver ${loggedInDriver.name} became available`
            });
          }
        }
      } else if (status === 'In-transit') {
        // When driver goes in-transit, set all assigned POs to in-transit status
        const vehicle = vehicles.find(v => v.name === loggedInDriver.vehicle);
        if (vehicle) {
          const assignedPOs = pos.filter(po => po.assignedTruck === loggedInDriver.vehicle && po.status === 'assigned');
          for (const po of assignedPOs) {
            await updateDoc(doc(db, 'pos', po.id), { status: 'in-transit' });
            await addDoc(collection(db, 'history'), {
              timestamp: new Date(),
              action: 'PO Status Auto-Updated',
              details: `PO ${po.customId} status changed to in-transit - driver ${loggedInDriver.name} started delivery`
            });
          }
        }
      } else if (status !== 'In-transit' && loggedInDriver.status === 'In-transit') {
        // When driver changes from in-transit to another status, reset PO statuses back to assigned
        const vehicle = vehicles.find(v => v.name === loggedInDriver.vehicle);
        if (vehicle) {
          const inTransitPOs = pos.filter(po => po.assignedTruck === loggedInDriver.vehicle && po.status === 'in-transit');
          for (const po of inTransitPOs) {
            await updateDoc(doc(db, 'pos', po.id), { status: 'assigned' });
            await addDoc(collection(db, 'history'), {
              timestamp: new Date(),
              action: 'PO Status Auto-Updated',
              details: `PO ${po.customId} status changed back to assigned - driver ${loggedInDriver.name} status changed from in-transit`
            });
          }
        }
      }

      // Log to history
      await addDoc(collection(db, 'history'), {
        timestamp: new Date(),
        action: 'Status Updated',
        details: `Driver ${loggedInDriver.name} set status to ${status}, vehicle ${loggedInDriver.vehicle} ready: ${vehicleReady}`
      });

      // Show success feedback
      alert(`Status updated to ${status} successfully!`);
    } catch (error) {
      console.error('Status update failed:', error);
      alert('Failed to update status. Please try again.');
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('loggedInDriver');
    window.location.href = '/login';
  };

  const updateDeliveryStatus = async (poId, newStatus) => {
    const po = pos.find(p => p.id === poId);
    if (newStatus === 'done') {
      // Change status to 'delivered' for admin confirmation instead of moving to history immediately
      await updateDoc(doc(db, 'pos', poId), { status: 'delivered', deliveryStatus: newStatus });
    } else {
      await updateDoc(doc(db, 'pos', poId), { deliveryStatus: newStatus });
    }

    await addDoc(collection(db, 'history'), {
      timestamp: new Date(),
      action: newStatus === 'done' ? 'PO Marked as Delivered (Awaiting Admin Confirmation)' : 'Updated Delivery Status',
      details: `PO ${po.customId} status updated to ${newStatus} by ${loggedInDriver.name}`
    });
  };

  const handlePhotoUpload = async (e, poId) => {
    const file = e.target.files[0];
    if (file) {
      const storage = getStorage();
      const storageRef = ref(storage, `delivery-photos/${poId}/${file.name}`);
      await uploadBytes(storageRef, file);
      const downloadURL = await getDownloadURL(storageRef);
      await updateDoc(doc(db, 'pos', poId), { deliveryPhoto: downloadURL });
      await addDoc(collection(db, 'history'), {
        timestamp: new Date(),
        action: 'Uploaded Delivery Photo',
        details: `Photo uploaded for PO ${pos.find(p => p.id === poId).customId} by ${loggedInDriver.name}`
      });
    }
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
          {(() => {
            // Get driver details from the same data structure used in DriverInfo
            const driverDetails = {
              'Randy Maduro': {
                contactNumber: '09154080447',
                helpers: [
                  { name: 'Marvin Soriano', contactNumber: '09169334034' },
                  { name: 'Raymond Marbella', contactNumber: 'N/A' }
                ]
              },
              'Adrian Silao': {
                contactNumber: '09096835513',
                helpers: [
                  { name: 'Randolph Villamor', contactNumber: '09123305204' }
                ]
              },
              'Fernando Besa': {
                contactNumber: '09551453174',
                helpers: [
                  { name: 'Noel Bulahog', contactNumber: '09702937219' }
                ]
              },
              'Joseph Allan Saldivar': {
                contactNumber: '09751432072',
                helpers: [
                  { name: 'Ronilo Ligao', contactNumber: '09932977963' }
                ]
              }
            };

            const details = driverDetails[loggedInDriver.name];
            return details ? (
              <div className="driver-details">
                <p><strong>Contact Number:</strong> {details.contactNumber}</p>
                {details.helpers && details.helpers.length > 0 && (
                  <div className="dashboard-helpers">
                    {details.helpers.map((helper, index) => (
                      <div key={index} className="helper-detail">
                        <p><strong>Truck Helper:</strong> {helper.name}</p>
                        <p><strong>Contact Number:</strong> {helper.contactNumber}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : null;
          })()}
        </div>

        <div className="status-card card">
          <h3>Update Vehicle Status</h3>
          <div className="status-controls">
            <label>Current Status</label>
            <select value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="Available">Available</option>
              <option value="In-transit">In-transit</option>
              <option value="Unavailable">Unavailable</option>
              <option value="Under Maintenance">Under Maintenance</option>
            </select>
            <button
              className={`btn btn-primary status-${status?.toLowerCase().replace(' ', '-') || 'not-set'} ${updatingStatus ? 'updating' : ''}`}
              onClick={handleStatusUpdate}
              disabled={updatingStatus}
            >
              {updatingStatus ? 'Updating...' : 'Update Status'}
            </button>
          </div>
        </div>

        <div className="assigned-pos card">
          <h3>Assigned Purchase Orders</h3>
          {pos.length === 0 ? (
            <p>No POs found in the system.</p>
          ) : (() => {
            const assignedPOs = pos.filter(po => po.assignedDriver === loggedInDriver.name || po.assignedTruck === loggedInDriver.vehicle);
            // Sort POs: incomplete ones first, then completed ones
            const sortedPOs = assignedPOs.sort((a, b) => {
              const aDone = a.deliveryStatus === 'done';
              const bDone = b.deliveryStatus === 'done';
              if (aDone && !bDone) return 1; // a is done, b is not - b comes first
              if (!aDone && bDone) return -1; // a is not done, b is done - a comes first
              return 0; // both same status, maintain current order
            });
            return sortedPOs.length === 0 ? (
              <p>No POs assigned to you yet. Check back later or contact your supervisor.</p>
            ) : (
              <div className="pos-grid">
                {sortedPOs.map(po => (
                  <div key={po.id} className="po-card driver-po-card" onClick={() => setSelectedPO(po)}>
                    <div className="po-header">
                      <span className="po-number">PO {po.customId}</span>
                      <span className={`po-status ${po.deliveryStatus || 'pending'}`}>{po.deliveryStatus || 'pending'}</span>
                    </div>
                    <div className="po-summary">
                      <p><strong>{po.companyName}</strong></p>
                      <p>{po.customerName}</p>
                      <p>{po.location}</p>
                      <p>{po.deliveryDate}</p>
                      <p><strong>Load: {po.load ? po.load.toLocaleString() : '0'} cm³</strong></p>
                    </div>
                    <div className="po-actions">
                      {po.deliveryStatus !== 'done' && (
                        <button
                          className="btn btn-small btn-primary"
                          onClick={(e) => {
                            e.stopPropagation();
                            const nextStatus = po.deliveryStatus === 'pending' ? 'departure' : po.deliveryStatus === 'departure' ? 'ongoing' : 'done';
                            if (nextStatus === 'done') {
                              if (loggedInDriver.status !== 'In-transit') {
                                alert('You can only mark POs as done when your status is In-transit.');
                                return;
                              }
                              if (window.confirm('Warning: Marking this PO as done cannot be undone and will move it to History. Continue?')) {
                                updateDeliveryStatus(po.id, nextStatus);
                              }
                            } else {
                              updateDeliveryStatus(po.id, nextStatus);
                            }
                          }}
                        >
                          {po.deliveryStatus === 'pending' ? 'Depart' : po.deliveryStatus === 'departure' ? 'Ongoing' : 'Mark as Done'}
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            );
          })()}
        </div>
      </div>

      {selectedPO && (
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
                  <p><strong>Status:</strong> {selectedPO.deliveryStatus || 'pending'}</p>
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
                    const product = products[item.product];
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

            {selectedPO.deliveryPhoto && (
              <div className="delivery-photo-section">
                <h3>Delivery Photo</h3>
                <img src={selectedPO.deliveryPhoto} alt="Delivery" style={{ maxWidth: '400px', maxHeight: '400px' }} />
              </div>
            )}

            <div className="modal-actions">
              <button onClick={() => setSelectedPO(null)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

};

export default DriverDashboard;
