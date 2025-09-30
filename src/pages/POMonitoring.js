import React, { useState, useEffect } from 'react';
import { collection, addDoc, onSnapshot, doc, deleteDoc, query, orderBy, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useVehicles } from '../contexts/VehicleContext';
import './POMonitoring.css';

const products = {
  'Product 1': { size: 66816, price: 5000 },
  'Product 2': { size: 46200, price: 7500 },
  'Product 3': { size: 70780.5, price: 10000 },
  'Product 4': { size: 45630, price: 12500 }
};

const clusters = {
  'Cluster 1': {
    locations: ['Location 1', 'Location 2', 'Location 3']
  },
  'Cluster 2': {
    locations: ['Location 4', 'Location 5', 'Location 6']
  }
};

const allLocations = Object.values(clusters).flatMap(cluster => cluster.locations);



const POMonitoring = () => {
  const { vehicles, updateVehicle, assignLoad, setVehicles } = useVehicles();
  const [pos, setPos] = useState([]);
  const [form, setForm] = useState({
    poNumber: '',
    companyName: '',
    customerName: '',
    poDate: '',
    location: '',
    deliveryDate: '',
    products: [],
    totalPrice: 0,
    assignedTruck: ''
  });
  const [showForm, setShowForm] = useState(false);
  const [selectedPO, setSelectedPO] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const q = query(collection(db, 'pos'), orderBy('createdAt'));
    const unsubscribe = onSnapshot(
      q,
      (querySnapshot) => {
        const posData = [];
        querySnapshot.forEach((doc) => {
          posData.push({ id: doc.id, customId: doc.data().customId, ...doc.data() });
        });
        setPos(posData);

        // Recompute vehicle loads and assigned POs from Firestore POs (persists across refresh)
        // Note: currentLoad is now computed as the MAX load scheduled on any single date,
        // so a vehicle never appears over capacity due to multi-day aggregation.
        setVehicles((prev) => {
          const nameToId = {};
          prev.forEach((v) => {
            nameToId[v.name] = v.id;
          });
          const totals = {};
          prev.forEach((v) => {
            totals[v.id] = { assigned: [], loadByDate: {} };
          });

          posData.forEach((po) => {
            if (!po.assignedTruck) return;
            const vid = nameToId[po.assignedTruck];
            if (!vid) return;
            const poLoad =
              typeof po.load === 'number'
                ? po.load
                : (po.products || []).reduce(
                    (sum, item) =>
                      sum +
                      ((item.quantity || 0) *
                        ((products[item.product]?.size) || 0)),
                    0
                  );
            const d = po.deliveryDate || 'N/A';
            totals[vid].loadByDate[d] = (totals[vid].loadByDate[d] || 0) + poLoad;
            totals[vid].assigned.push(po.id);
          });

          return prev.map((v) => {
            const loads = Object.values(totals[v.id]?.loadByDate || {});
            const maxLoad = loads.length ? Math.max(...loads) : 0;
            return {
              ...v,
              currentLoad: maxLoad,
              assignedPOs: totals[v.id]?.assigned || []
            };
          });
        });
      },
      (error) => {
        console.error('Error fetching POs:', error);
        alert('Failed to load POs. Please refresh the page.');
      }
    );
    return unsubscribe;
  }, [setVehicles]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setForm({ ...form, [name]: value });
  };

  const calculateLoad = (po) => {
    return po.products.reduce((total, item) => total + (item.quantity * (products[item.product]?.size || 0)), 0);
  };

  const calculateTotalPrice = (productsList) => {
    return productsList.reduce((total, item) => total + (item.quantity * (products[item.product]?.price || 0)), 0);
  };

  const findCluster = (location) => {
    for (const [clusterName, cluster] of Object.entries(clusters)) {
      if (cluster.locations.includes(location)) {
        return clusterName;
      }
    }
    return null;
  };
 
  // Compute accumulated load for a vehicle on a specific delivery date from already assigned POs
  const getUsedLoadForVehicleOnDate = (vehicle, dateStr) => {
    const assigned = vehicle.assignedPOs || [];
    return assigned.reduce((sum, poId) => {
      const assignedPO = pos.find(p => p.id === poId);
      if (assignedPO && assignedPO.deliveryDate === dateStr) {
        return sum + calculateLoad(assignedPO);
      }
      return sum;
    }, 0);
  };
 
  // Determine the cluster a vehicle is already servicing on a given date (if any)
  const getClusterForVehicleOnDate = (vehicle, dateStr) => {
    const assigned = vehicle.assignedPOs || [];
    let cluster = null;
    for (const poId of assigned) {
      const assignedPO = pos.find(p => p.id === poId);
      if (assignedPO && assignedPO.deliveryDate === dateStr) {
        const c = findCluster(assignedPO.location);
        if (cluster && cluster !== c) {
          // Mixed clusters shouldn't happen; treat as locked and disallow further mixing.
          return cluster;
        }
        cluster = c;
      }
    }
    return cluster;
  };

  const assignVehicleAutomatically = (po) => {
    const load = calculateLoad(po);
    const clusterName = findCluster(po.location);

    // Filter by availability, capacity for the PO's date, and cluster lock per date
    const eligibleVehicles = vehicles.filter(v => {
      const usedForDate = getUsedLoadForVehicleOnDate(v, po.deliveryDate);
      const clusterForDate = getClusterForVehicleOnDate(v, po.deliveryDate);
      const hasCapacity = (v.capacity - usedForDate) >= load;
      const clusterOk = !clusterForDate || clusterForDate === clusterName;
      return v.ready && hasCapacity && clusterOk;
    });

    if (eligibleVehicles.length === 0) return null;

    // Rank by:
    // 1) number of existing POs in same cluster on the same date (desc)
    // 2) best fit: smallest remaining capacity after assignment for that date (asc)
    const scored = eligibleVehicles.map(v => {
      const clusterMatches = (v.assignedPOs || []).reduce((acc, poId) => {
        const assignedPO = pos.find(p => p.id === poId);
        return acc + (assignedPO && assignedPO.deliveryDate === po.deliveryDate && findCluster(assignedPO.location) === clusterName ? 1 : 0);
      }, 0);
      const usedForDate = getUsedLoadForVehicleOnDate(v, po.deliveryDate);
      const remainingAfter = (v.capacity - usedForDate) - load;
      return { v, clusterMatches, remainingAfter };
    });

    scored.sort((a, b) => {
      if (b.clusterMatches !== a.clusterMatches) return b.clusterMatches - a.clusterMatches;
      return a.remainingAfter - b.remainingAfter;
    });

    const chosen = scored[0].v;

    // Track assignment centrally. We don't flip global ready here; availability is per-date now.
    updateVehicle(chosen.id, {
      currentLoad: chosen.currentLoad + load,
      assignedPOs: [...(chosen.assignedPOs || []), po.id]
    });

    return chosen.name;
  };

  const addProduct = () => {
    const updatedProducts = [...form.products, { product: 'Product 1', quantity: 0 }];
    setForm({ ...form, products: updatedProducts, totalPrice: calculateTotalPrice(updatedProducts) });
  };

  const removeProduct = (index) => {
    const updatedProducts = form.products.filter((_, i) => i !== index);
    setForm({ ...form, products: updatedProducts, totalPrice: calculateTotalPrice(updatedProducts) });
  };

  const handleProductChange = (index, value) => {
    const updatedProducts = form.products.map((item, i) => i === index ? { ...item, product: value } : item);
    setForm({ ...form, products: updatedProducts, totalPrice: calculateTotalPrice(updatedProducts) });
  };

  const handleQuantityChange = (index, value) => {
    const updatedProducts = form.products.map((item, i) => i === index ? { ...item, quantity: parseInt(value) || 0 } : item);
    setForm({ ...form, products: updatedProducts, totalPrice: calculateTotalPrice(updatedProducts) });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.poNumber || !form.companyName || !form.customerName || !form.poDate || !form.location || !form.deliveryDate || form.products.length === 0 || form.products.some(p => !p.product || p.quantity <= 0)) {
      alert('Please fill all required fields with valid data.');
      return;
    }
    setLoading(true);
    try {
      const newPO = {
        customId: form.poNumber,
        ...form,
        createdAt: new Date()
      };
      // Persist computed load so vehicle load can be reconstructed reliably after refresh
      newPO.load = calculateLoad(newPO);

      // Hard guard: if the order exceeds the capacity of every vehicle, stop and show an error
      const maxCapacity = Math.max(...vehicles.map(v => v.capacity));
      if (newPO.load > maxCapacity) {
        alert('This order exceeds the maximum load capacity of any available vehicle. Please split the order into multiple POs.');
        return;
      }

      const docRef = await addDoc(collection(db, 'pos'), newPO);
      const poId = docRef.id;

      // Automate assignment
      const assignedVehicle = assignVehicleAutomatically({ ...newPO, id: poId });
      if (assignedVehicle) {
        // Keep Firestore field naming as 'assignedTruck' for backward compatibility
        // Also persist computed load so vehicle loads can be reconstructed after refresh
        await updateDoc(docRef, { assignedTruck: assignedVehicle, load: newPO.load });
        newPO.assignedTruck = assignedVehicle;

        // assignedPOs and currentLoad already updated via VehicleContext.assignLoad

        // Log assignment
        await addDoc(collection(db, 'history'), {
          timestamp: new Date(),
          action: 'Auto-Assigned PO to Vehicle',
          details: `PO ${newPO.customId} auto-assigned to ${assignedVehicle}`
        });
      } else {
        alert('No suitable vehicle available for this PO on the selected delivery date. Vehicles may be full or restricted to another cluster.');
      }

      setForm({
        poNumber: '',
        companyName: '',
        customerName: '',
        poDate: '',
        location: '',
        deliveryDate: '',
        products: [],
        totalPrice: 0,
        assignedTruck: ''
      });
      setShowForm(false);
      // Log to history
      const productsStr = newPO.products.map(item => `${item.product}: ${item.quantity}`).join(', ');
      await addDoc(collection(db, 'history'), {
        timestamp: new Date(),
        action: 'Added PO',
        details: `PO ${newPO.customId}: Company: ${newPO.companyName}, Customer: ${newPO.customerName}, Date: ${newPO.poDate}, Location: ${newPO.location}, Delivery: ${newPO.deliveryDate}, Products: ${productsStr}, Total: ${newPO.totalPrice}`
      });
    } catch (error) {
      console.error('Error adding PO:', error);
      alert('Failed to add PO. Please check your connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleCardClick = (po) => {
    setSelectedPO(po);
    setShowModal(true);
  };

  const handleUpdate = () => {
    // For simplicity, allow editing in modal, but here just close
    setShowModal(false);
  };

  const handleDelete = async () => {
    if (window.confirm('Are you sure you want to delete this PO?')) {
      await deleteDoc(doc(db, 'pos', selectedPO.id));
      setShowModal(false);
      // Log to history
      const productsStr = selectedPO.products.map(item => `${item.product}: ${item.quantity}`).join(', ');
      await addDoc(collection(db, 'history'), {
        timestamp: new Date(),
        action: 'Deleted PO',
        details: `PO ${selectedPO.customId}: Company: ${selectedPO.companyName}, Customer: ${selectedPO.customerName}, Products: ${productsStr}`
      });
    }
  };

  const handleAssign = async (vehicleId) => {
    const load = calculateLoad(selectedPO);
    const vehicle = vehicles.find(v => v.id === vehicleId);
    if (vehicle) {
      const usedForDate = getUsedLoadForVehicleOnDate(vehicle, selectedPO.deliveryDate);
      const clusterName = findCluster(selectedPO.location);
      const lockedCluster = getClusterForVehicleOnDate(vehicle, selectedPO.deliveryDate);

      if (lockedCluster && lockedCluster !== clusterName) {
        alert(`Selected vehicle is already assigned to ${lockedCluster} on ${selectedPO.deliveryDate}. You cannot mix clusters on the same trip.`);
        return;
      }

      if (vehicle.capacity - usedForDate >= load) {
        // Track assignment; keep global ready unchanged
        updateVehicle(vehicleId, {
          currentLoad: vehicle.currentLoad + load,
          assignedPOs: [...(vehicle.assignedPOs || []), selectedPO.id]
        });
        // Update PO assignedTruck (field kept for compatibility) and persist computed load
        await updateDoc(doc(db, 'pos', selectedPO.id), { assignedTruck: vehicle.name, load: calculateLoad(selectedPO) });
        setSelectedPO({ ...selectedPO, assignedTruck: vehicle.name });
        // Log to history
        await addDoc(collection(db, 'history'), {
          timestamp: new Date(),
          action: 'Assigned PO to Vehicle',
          details: `PO ${selectedPO.customId} assigned to ${vehicle.name}`
        });
      } else {
        alert('Selected vehicle does not have enough capacity for that delivery date.');
      }
    }
  };

  return (
    <div className="po-monitoring">
      <h1>PO Monitoring</h1>
      <button className="add-po-btn" onClick={() => setShowForm(true)}>+</button>
      {showForm && (
        <div className="modal">
          <div className="modal-content form-modal">
            <h2>Add New PO</h2>
            <form onSubmit={handleSubmit} className="po-form">
              <input name="poNumber" placeholder="PO Number" value={form.poNumber} onChange={handleInputChange} required />
              <input name="companyName" placeholder="Company Name" value={form.companyName} onChange={handleInputChange} required />
              <input name="customerName" placeholder="Name of Customer" value={form.customerName} onChange={handleInputChange} required />
              <label>Order Date</label>
              <input name="poDate" type="date" value={form.poDate} onChange={handleInputChange} required />
              <label>Delivery Date</label>
              <input name="deliveryDate" type="date" value={form.deliveryDate} onChange={handleInputChange} required />
              <select name="location" value={form.location} onChange={handleInputChange} required>
                <option value="">Select Location</option>
                {allLocations.map(loc => (
                  <option key={loc} value={loc}>{loc}</option>
                ))}
              </select>
              <div className="products-section">
                <h4>Products</h4>
                {form.products.map((item, index) => (
                  <div key={index} className="product-item">
                    <select value={item.product} onChange={(e) => handleProductChange(index, e.target.value)}>
                      <option value="Product 1">Product 1</option>
                      <option value="Product 2">Product 2</option>
                      <option value="Product 3">Product 3</option>
                      <option value="Product 4">Product 4</option>
                    </select>
                    <input type="number" placeholder="Quantity" value={item.quantity} onChange={(e) => handleQuantityChange(index, e.target.value)} required />
                    <button type="button" onClick={() => removeProduct(index)}>Remove</button>
                  </div>
                ))}
                <button type="button" onClick={addProduct}>Add Product</button>
              </div>
              <label>Total Price: {form.totalPrice.toLocaleString()}</label>
              <div className="form-buttons">
                <button type="submit" disabled={loading}>{loading ? 'Submitting...' : 'Submit'}</button>
                <button type="button" onClick={() => setShowForm(false)}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
      <div className="po-cards grid">
        {pos.map(po => {
          const productCount = (po.products || []).reduce((sum, p) => sum + (p.quantity || 0), 0);
          const assigned = !!po.assignedTruck;
          return (
            <div
              key={po.id}
              className="card"
              onClick={() => handleCardClick(po)}
              title={`PO ${po.customId} • ${po.companyName}`}
            >
              <div className="card-header">
                <div>
                  <div className="card-title">PO {po.customId}</div>
                  <div className="card-subtitle">{po.companyName}</div>
                </div>
                <div className={`badge ${assigned ? 'success' : 'warning'}`}>
                  <span className="dot"></span>
                  {assigned ? 'Assigned' : 'Pending'}
                </div>
              </div>
              <div className="card-meta">Delivery: {po.deliveryDate}</div>
              <div className="card-footer">
                <span className="card-meta">{productCount} items • ₱{(po.totalPrice || 0).toLocaleString()}</span>
              </div>
            </div>
          );
        })}
      </div>
      {showModal && selectedPO && (
        <div className="modal">
          <div className="modal-content">
            <h2>{selectedPO.customId}</h2>
            <p>Company: {selectedPO.companyName}</p>
            <p>Customer: {selectedPO.customerName}</p>
            <p>PO Date: {selectedPO.poDate}</p>
            <p>Location: {selectedPO.location}</p>
            <p>Delivery Date: {selectedPO.deliveryDate}</p>
            <div>
              <h4>Products:</h4>
              {selectedPO.products.map((item, index) => (
                <p key={index}>{item.product}: {item.quantity}</p>
              ))}
            </div>
            <p>Total Price: {selectedPO.totalPrice.toLocaleString()}</p>
            <p>Assigned Vehicle: {selectedPO.assignedTruck || 'None'}</p>
            {!selectedPO.assignedTruck && (
              <div>
                <h3>Suitable Vehicles</h3>
                {(() => {
                  const load = calculateLoad(selectedPO);
                  const clusterName = findCluster(selectedPO.location);
                  const maxCapacity = Math.max(...vehicles.map(v => v.capacity));
                  const suitableVehicles = vehicles.filter(vehicle => {
                    const usedForDate = getUsedLoadForVehicleOnDate(vehicle, selectedPO.deliveryDate);
                    const lockedCluster = getClusterForVehicleOnDate(vehicle, selectedPO.deliveryDate);
                    const hasCapacity = (vehicle.capacity - usedForDate) >= load;
                    const clusterOk = !lockedCluster || lockedCluster === clusterName;
                    return vehicle.ready && hasCapacity && clusterOk;
                  });
                  return suitableVehicles.length > 0 ? (
                    suitableVehicles.map(vehicle => {
                      const usedForDate = getUsedLoadForVehicleOnDate(vehicle, selectedPO.deliveryDate);
                      const remaining = (vehicle.capacity - usedForDate);
                      return (
                        <div key={vehicle.id} style={{ margin: '5px 0' }}>
                          {vehicle.name} (Remaining: {remaining.toLocaleString()} cm² on {selectedPO.deliveryDate})
                          <button onClick={() => handleAssign(vehicle.id)} style={{ marginLeft: '10px' }}>Assign</button>
                        </div>
                      );
                    })
                  ) : (
                    load > maxCapacity ? (
                      <p style={{ color: '#c0392b' }}>
                        This order exceeds the maximum load capacity of any vehicle. Please split the order into smaller batches.
                      </p>
                    ) : (
                      <p>No suitable vehicles available for the selected delivery date. Vehicles may be full or locked to a different cluster.</p>
                    )
                  );
                })()}
              </div>
            )}
            <button onClick={handleUpdate}>Update</button>
            <button onClick={handleDelete}>Delete</button>
            <button onClick={() => setShowModal(false)}>Close</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default POMonitoring;