import React, { useState, useEffect } from 'react';
import { collection, addDoc, onSnapshot, doc, deleteDoc, query, orderBy, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useVehicles } from '../contexts/VehicleContext';
import './POMonitoring.css';

const products = {
  'Jumbo Roll Tissue': { size: 66816, price: 5000 },
  'Hand Roll Tissue': { size: 46200, price: 7500 },
  'Interfolded Paper Towel': { size: 70780.5, price: 10000 },
  'Bathroom Tissue': { size: 45630, price: 12500 }
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
  const { vehicles, updateVehicle, setVehicles } = useVehicles();
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
    assignedTruck: '',
    address: '',
    contact: '',
    phone: '',
    currency: 'PHP',
    termsOfPayment: '',
    salesTax: 0
  });
  const [showForm, setShowForm] = useState(false);
  const [selectedPO, setSelectedPO] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    poNumber: '',
    companyName: '',
    customerName: '',
    poDate: '',
    location: '',
    deliveryDate: '',
    products: [],
    totalPrice: 0,
    address: '',
    contact: '',
    phone: '',
    currency: 'PHP',
    termsOfPayment: '',
    salesTax: 0
  });

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

    // Enhanced ranking algorithm for optimal load distribution
    const scored = eligibleVehicles.map(v => {
      const usedForDate = getUsedLoadForVehicleOnDate(v, po.deliveryDate);
      const remainingCapacity = v.capacity - usedForDate;
      const utilizationAfter = (usedForDate + load) / v.capacity;

      // Calculate cluster efficiency (prefer vehicles already assigned to same cluster)
      const clusterMatches = (v.assignedPOs || []).reduce((acc, poId) => {
        const assignedPO = pos.find(p => p.id === poId);
        return acc + (assignedPO && assignedPO.deliveryDate === po.deliveryDate && findCluster(assignedPO.location) === clusterName ? 1 : 0);
      }, 0);

      // Calculate load efficiency (prefer vehicles that will be well-utilized but not over-utilized)
      let loadEfficiency = 0;
      if (utilizationAfter <= 0.6) {
        // Under-utilized: bonus for filling up
        loadEfficiency = 2;
      } else if (utilizationAfter <= 0.85) {
        // Optimal range: highest priority
        loadEfficiency = 3;
      } else if (utilizationAfter <= 0.95) {
        // Near capacity: still good but less optimal
        loadEfficiency = 1;
      } else {
        // Over-utilized: penalty
        loadEfficiency = -1;
      }

      // Calculate vehicle size efficiency (prefer appropriately sized vehicles)
      let sizeEfficiency = 0;
      if (load <= v.capacity * 0.3 && v.capacity > 10000000) {
        // Small load in large vehicle: slight penalty
        sizeEfficiency = -0.5;
      } else if (load > v.capacity * 0.8 && v.capacity < 10000000) {
        // Large load in small vehicle: penalty
        sizeEfficiency = -1;
      }

      // Total score combines multiple factors
      const totalScore = (clusterMatches * 2) + loadEfficiency + sizeEfficiency;

      return {
        v,
        totalScore,
        utilizationAfter,
        remainingCapacity,
        clusterMatches,
        loadEfficiency,
        sizeEfficiency
      };
    });

    // Sort by total score (descending), then by remaining capacity (ascending for best fit)
    scored.sort((a, b) => {
      if (Math.abs(b.totalScore - a.totalScore) > 0.1) {
        return b.totalScore - a.totalScore;
      }
      // If scores are very close, prefer the one with less remaining capacity (better utilization)
      return a.remainingCapacity - b.remainingCapacity;
    });

    const chosen = scored[0].v;
    const chosenData = scored[0];

    console.log(`Auto-assigning PO ${po.customId} to ${chosen.name}:`, {
      load,
      cluster: clusterName,
      score: chosenData.totalScore,
      utilizationAfter: (chosenData.utilizationAfter * 100).toFixed(1) + '%',
      clusterMatches: chosenData.clusterMatches
    });

    // Track assignment centrally. We don't flip global ready here; availability is per-date now.
    updateVehicle(chosen.id, {
      currentLoad: chosen.currentLoad + load,
      assignedPOs: [...(chosen.assignedPOs || []), po.id]
    });

    return chosen.name;
  };

  const removeProduct = (index) => {
    const updatedProducts = form.products.filter((_, i) => i !== index);
    setForm({ ...form, products: updatedProducts, totalPrice: calculateTotalPrice(updatedProducts) });
  };

  const handleQuantityChange = (index, value) => {
    const updatedProducts = form.products.map((item, i) => i === index ? { ...item, quantity: parseInt(value) || 0 } : item);
    setForm({ ...form, products: updatedProducts, totalPrice: calculateTotalPrice(updatedProducts) });
  };

  const handleEditInputChange = (e) => {
    const { name, value } = e.target;
    setEditForm({ ...editForm, [name]: value });
  };

  const handleEditQuantityChange = (index, value) => {
    const updatedProducts = editForm.products.map((item, i) => i === index ? { ...item, quantity: parseInt(value) || 0 } : item);
    setEditForm({ ...editForm, products: updatedProducts, totalPrice: calculateTotalPrice(updatedProducts) });
  };

  const handleEditProductChange = (index, value) => {
    const updatedProducts = editForm.products.map((item, i) => i === index ? { ...item, product: value } : item);
    setEditForm({ ...editForm, products: updatedProducts, totalPrice: calculateTotalPrice(updatedProducts) });
  };

  const addEditProduct = () => {
    const updatedProducts = [...editForm.products, { product: 'Jumbo Roll Tissue', quantity: 0 }];
    setEditForm({ ...editForm, products: updatedProducts, totalPrice: calculateTotalPrice(updatedProducts) });
  };

  const removeEditProduct = (index) => {
    const updatedProducts = editForm.products.filter((_, i) => i !== index);
    setEditForm({ ...editForm, products: updatedProducts, totalPrice: calculateTotalPrice(updatedProducts) });
  };

  const handleSaveUpdate = async () => {
    if (!editForm.poNumber || !editForm.companyName || !editForm.customerName || !editForm.poDate || !editForm.location || !editForm.deliveryDate || !editForm.address || editForm.products.length === 0 || editForm.products.some(p => !p.product || p.quantity <= 0)) {
      alert('Please fill all required fields with valid data.');
      return;
    }

    try {
      const updatedPO = {
        customId: editForm.poNumber,
        ...editForm,
        load: calculateLoad(editForm),
        updatedAt: new Date()
      };

      await updateDoc(doc(db, 'pos', selectedPO.id), updatedPO);

      // Log the update
      await addDoc(collection(db, 'history'), {
        timestamp: new Date(),
        action: 'Updated PO',
        details: `PO ${selectedPO.customId} was updated`
      });

      setIsEditing(false);
      setShowModal(false);
      alert('PO updated successfully!');
    } catch (error) {
      console.error('Error updating PO:', error);
      alert('Failed to update PO. Please try again.');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.poNumber || !form.companyName || !form.customerName || !form.poDate || !form.location || !form.deliveryDate || !form.address || form.products.length === 0 || form.products.some(p => !p.product || p.quantity <= 0)) {
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
        assignedTruck: '',
        address: '',
        contact: '',
        phone: '',
        currency: 'PHP',
        termsOfPayment: '',
        salesTax: 0
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

  const handleUpdate = async () => {
    // Initialize edit form with current PO data
    setEditForm({
      poNumber: selectedPO.customId,
      companyName: selectedPO.companyName,
      customerName: selectedPO.customerName,
      poDate: selectedPO.poDate,
      location: selectedPO.location,
      deliveryDate: selectedPO.deliveryDate,
      products: [...selectedPO.products],
      totalPrice: selectedPO.totalPrice,
      address: selectedPO.address || '',
      contact: selectedPO.contact || '',
      phone: selectedPO.phone || '',
      currency: selectedPO.currency || 'PHP',
      termsOfPayment: selectedPO.termsOfPayment || '',
      salesTax: selectedPO.salesTax || 0
    });
    setIsEditing(true);
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
        // Check if this assignment would over-utilize the vehicle (>95% capacity)
        const utilizationAfter = (usedForDate + load) / vehicle.capacity;
        if (utilizationAfter > 0.95) {
          const proceed = window.confirm(
            `Warning: This assignment will utilize ${(utilizationAfter * 100).toFixed(1)}% of ${vehicle.name}'s capacity. ` +
            `This may not be optimal for deliveries. Continue anyway?`
          );
          if (!proceed) return;
        }

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
          details: `PO ${selectedPO.customId} assigned to ${vehicle.name} (${(utilizationAfter * 100).toFixed(1)}% utilization)`
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
          <div className="modal-content kiosk-modal">
            <div className="kiosk-header">
              <h2>New Purchase Order</h2>
              <button className="close-btn" onClick={() => setShowForm(false)}>×</button>
            </div>

            <div className="kiosk-form">
              <div className="kiosk-section">
                <h3>Order Information</h3>
                <div className="input-grid">
                  <div className="input-group">
                    <label>PO Number</label>
                    <input name="poNumber" placeholder="Enter PO Number" value={form.poNumber} onChange={handleInputChange} required />
                  </div>
                  <div className="input-group">
                    <label>Company Name</label>
                    <input name="companyName" placeholder="Enter Company Name" value={form.companyName} onChange={handleInputChange} required />
                  </div>
                  <div className="input-group">
                    <label>Customer Name</label>
                    <input name="customerName" placeholder="Enter Customer Name" value={form.customerName} onChange={handleInputChange} required />
                  </div>
                  <div className="input-group">
                    <label>Address</label>
                    <input name="address" placeholder="Enter Delivery Address" value={form.address} onChange={handleInputChange} required />
                  </div>
                  <div className="input-group">
                    <label>Contact Person</label>
                    <input name="contact" placeholder="Enter Contact Person" value={form.contact} onChange={handleInputChange} />
                  </div>
                  <div className="input-group">
                    <label>Phone Number</label>
                    <input name="phone" placeholder="Enter Phone Number" value={form.phone} onChange={handleInputChange} />
                  </div>
                  <div className="input-group">
                    <label>Order Date</label>
                    <input name="poDate" type="date" value={form.poDate} onChange={handleInputChange} required />
                  </div>
                  <div className="input-group">
                    <label>Delivery Date</label>
                    <input name="deliveryDate" type="date" value={form.deliveryDate} onChange={handleInputChange} required />
                  </div>
                  <div className="input-group">
                    <label>Location</label>
                    <select name="location" value={form.location} onChange={handleInputChange} required>
                      <option value="">Select Location</option>
                      {allLocations.map(loc => (
                        <option key={loc} value={loc}>{loc}</option>
                      ))}
                    </select>
                  </div>
                  <div className="input-group">
                    <label>Currency</label>
                    <select name="currency" value={form.currency} onChange={handleInputChange}>
                      <option value="PHP">PHP</option>
                      <option value="USD">USD</option>
                      <option value="EUR">EUR</option>
                    </select>
                  </div>
                  <div className="input-group">
                    <label>Terms of Payment</label>
                    <input name="termsOfPayment" placeholder="e.g., Net 30 days" value={form.termsOfPayment} onChange={handleInputChange} />
                  </div>
                  <div className="input-group">
                    <label>Sales Tax (₱)</label>
                    <input name="salesTax" type="number" placeholder="0" value={form.salesTax} onChange={handleInputChange} />
                  </div>
                </div>
              </div>

              <div className="kiosk-section">
                <h3>Select Products</h3>
                <div className="product-selection">
                  {Object.entries(products).map(([productName, productInfo]) => (
                    <div key={productName} className="product-card">
                      <div className="product-info">
                        <h4>{productName}</h4>
                        <p className="product-price">₱{productInfo.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                        <p className="product-size">Size: {productInfo.size.toLocaleString()} cm³</p>
                      </div>
                      <div className="quantity-controls">
                        <button
                          type="button"
                          className="qty-btn minus"
                          onClick={() => {
                            const existingIndex = form.products.findIndex(p => p.product === productName);
                            if (existingIndex >= 0) {
                              const currentQty = form.products[existingIndex].quantity;
                              if (currentQty > 1) {
                                handleQuantityChange(existingIndex, (currentQty - 1).toString());
                              } else {
                                removeProduct(existingIndex);
                              }
                            }
                          }}
                        >
                          -
                        </button>
                        <input
                          type="number"
                          className="quantity-input"
                          min="0"
                          value={form.products.find(p => p.product === productName)?.quantity || 0}
                          onChange={(e) => {
                            const value = parseInt(e.target.value) || 0;
                            const existingIndex = form.products.findIndex(p => p.product === productName);
                            if (existingIndex >= 0) {
                              if (value > 0) {
                                handleQuantityChange(existingIndex, value.toString());
                              } else {
                                removeProduct(existingIndex);
                              }
                            } else if (value > 0) {
                              const updatedProducts = [...form.products, { product: productName, quantity: value }];
                              setForm({ ...form, products: updatedProducts, totalPrice: calculateTotalPrice(updatedProducts) });
                            }
                          }}
                        />
                        <button
                          type="button"
                          className="qty-btn plus"
                          onClick={() => {
                            const existingIndex = form.products.findIndex(p => p.product === productName);
                            if (existingIndex >= 0) {
                              const currentQty = form.products[existingIndex].quantity;
                              handleQuantityChange(existingIndex, (currentQty + 1).toString());
                            } else {
                              const updatedProducts = [...form.products, { product: productName, quantity: 1 }];
                              setForm({ ...form, products: updatedProducts, totalPrice: calculateTotalPrice(updatedProducts) });
                            }
                          }}
                        >
                          +
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="kiosk-summary">
                <div className="order-summary">
                  <h3>Order Summary</h3>
                  <div className="summary-items">
                    {form.products.map((item, index) => (
                      <div key={index} className="summary-item">
                        <span>{item.product} x {item.quantity}</span>
                        <span>₱{((item.quantity || 0) * (products[item.product]?.price || 0)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                      </div>
                    ))}
                  </div>
                 <div className="summary-total">
                   <div className="total-row">
                     <span>Subtotal:</span>
                     <span>₱{form.totalPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                   </div>
                   <div className="total-row">
                     <span>Sales Tax:</span>
                     <span>₱{(parseFloat(form.salesTax || 0)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                   </div>
                   <div className="total-row final-total">
                     <span>Total:</span>
                     <span>₱{(parseFloat(form.totalPrice || 0) + parseFloat(form.salesTax || 0)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                   </div>
                 </div>
                </div>
              </div>

              <div className="kiosk-actions">
                <button type="button" className="cancel-btn" onClick={() => setShowForm(false)}>Cancel</button>
                <button type="submit" className="submit-btn" disabled={loading || form.products.length === 0} onClick={handleSubmit}>
                  {loading ? 'Creating Order...' : 'Create Purchase Order'}
                </button>
              </div>
            </div>
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
                <span className="card-meta">{productCount} items • ₱{(po.totalPrice || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
            </div>
          );
        })}
      </div>
      {showModal && selectedPO && (
        <div className="modal">
          <div className="modal-content po-detail-modal">
            <div className="modal-header">
              <h2>{isEditing ? `Edit Purchase Order ${selectedPO.customId}` : `Purchase Order ${selectedPO.customId}`}</h2>
            </div>

            {isEditing ? (
              <div className="edit-form">
                <div className="kiosk-section">
                  <h3>Edit Order Information</h3>
                  <div className="input-grid">
                    <div className="input-group">
                      <label>PO Number</label>
                      <input name="poNumber" placeholder="Enter PO Number" value={editForm.poNumber} onChange={handleEditInputChange} required />
                    </div>
                    <div className="input-group">
                      <label>Company Name</label>
                      <input name="companyName" placeholder="Enter Company Name" value={editForm.companyName} onChange={handleEditInputChange} required />
                    </div>
                    <div className="input-group">
                      <label>Customer Name</label>
                      <input name="customerName" placeholder="Enter Customer Name" value={editForm.customerName} onChange={handleEditInputChange} required />
                    </div>
                    <div className="input-group">
                      <label>Address</label>
                      <input name="address" placeholder="Enter Delivery Address" value={editForm.address} onChange={handleEditInputChange} required />
                    </div>
                    <div className="input-group">
                      <label>Contact Person</label>
                      <input name="contact" placeholder="Enter Contact Person" value={editForm.contact} onChange={handleEditInputChange} />
                    </div>
                    <div className="input-group">
                      <label>Phone Number</label>
                      <input name="phone" placeholder="Enter Phone Number" value={editForm.phone} onChange={handleEditInputChange} />
                    </div>
                    <div className="input-group">
                      <label>Order Date</label>
                      <input name="poDate" type="date" value={editForm.poDate} onChange={handleEditInputChange} required />
                    </div>
                    <div className="input-group">
                      <label>Delivery Date</label>
                      <input name="deliveryDate" type="date" value={editForm.deliveryDate} onChange={handleEditInputChange} required />
                    </div>
                    <div className="input-group">
                      <label>Location</label>
                      <select name="location" value={editForm.location} onChange={handleEditInputChange} required>
                        <option value="">Select Location</option>
                        {allLocations.map(loc => (
                          <option key={loc} value={loc}>{loc}</option>
                        ))}
                      </select>
                    </div>
                    <div className="input-group">
                      <label>Currency</label>
                      <select name="currency" value={editForm.currency} onChange={handleEditInputChange}>
                        <option value="PHP">PHP</option>
                        <option value="USD">USD</option>
                        <option value="EUR">EUR</option>
                      </select>
                    </div>
                    <div className="input-group">
                      <label>Terms of Payment</label>
                      <input name="termsOfPayment" placeholder="e.g., Net 30 days" value={editForm.termsOfPayment} onChange={handleEditInputChange} />
                    </div>
                    <div className="input-group">
                      <label>Sales Tax (₱)</label>
                      <input name="salesTax" type="number" placeholder="0" value={editForm.salesTax} onChange={handleEditInputChange} />
                    </div>
                  </div>
                </div>

                <div className="kiosk-section">
                  <h3>Edit Products</h3>
                  <div className="products-section">
                    <h4>Products</h4>
                    {editForm.products.map((item, index) => (
                      <div key={index} className="product-item">
                        <select value={item.product} onChange={(e) => handleEditProductChange(index, e.target.value)}>
                          <option value="Jumbo Roll Tissue">Jumbo Roll Tissue</option>
                          <option value="Hand Roll Tissue">Hand Roll Tissue</option>
                          <option value="Interfolded Paper Towel">Interfolded Paper Towel</option>
                          <option value="Bathroom Tissue">Bathroom Tissue</option>
                        </select>
                        <input type="number" placeholder="Quantity" value={item.quantity} onChange={(e) => handleEditQuantityChange(index, e.target.value)} required />
                        <button type="button" onClick={() => removeEditProduct(index)}>Remove</button>
                      </div>
                    ))}
                    <button type="button" onClick={addEditProduct}>Add Product</button>
                  </div>
                </div>

                <div className="kiosk-summary">
                  <div className="order-summary">
                    <h3>Updated Order Summary</h3>
                    <div className="summary-items">
                      {editForm.products.map((item, index) => (
                        <div key={index} className="summary-item">
                          <span>{item.product} x {item.quantity}</span>
                          <span>₱{((item.quantity || 0) * (products[item.product]?.price || 0)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                        </div>
                      ))}
                    </div>
                    <div className="summary-total">
                      <div className="total-row">
                        <span>Subtotal:</span>
                        <span>₱{editForm.totalPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                      </div>
                      <div className="total-row">
                        <span>Sales Tax:</span>
                        <span>₱{(parseFloat(editForm.salesTax || 0)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                      </div>
                      <div className="total-row final-total">
                        <span>Total:</span>
                        <span>₱{(parseFloat(editForm.totalPrice || 0) + parseFloat(editForm.salesTax || 0)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
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
            )}

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
                  {selectedPO.products.map((item, index) => (
                    <tr key={index}>
                      <td>{index + 1}</td>
                      <td>{item.product}</td>
                      <td>-</td>
                      <td>{item.quantity}</td>
                      <td>PCS</td>
                      <td>{selectedPO.deliveryDate}</td>
                      <td>₱{products[item.product]?.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || 0}</td>
                      <td>₱{((item.quantity || 0) * (products[item.product]?.price || 0)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="summary-section">
              <div className="summary-left">
                <p><strong>Currency:</strong> {selectedPO.currency || 'PHP'}</p>
                <p><strong>Terms of payment:</strong> {selectedPO.termsOfPayment || 'Not specified'}</p>
              </div>
              <div className="summary-right">
                <p><strong>Total:</strong> ₱{selectedPO.totalPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                <p><strong>Sales tax:</strong> ₱{(parseFloat(selectedPO.salesTax || 0)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                <p><strong>Total amount:</strong> ₱{(parseFloat(selectedPO.totalPrice || 0) + parseFloat(selectedPO.salesTax || 0)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
              </div>
            </div>

            <div className="modal-actions">
              {isEditing ? (
                <div className="edit-actions">
                  <button onClick={handleSaveUpdate} className="save-btn">Save Changes</button>
                  <button onClick={() => setIsEditing(false)} className="cancel-edit-btn">Cancel Edit</button>
                </div>
              ) : (
                <>
                  <p><strong>Assigned Vehicle:</strong> {selectedPO.assignedTruck || 'None'}</p>
                  {!selectedPO.assignedTruck && (
                    <div className="vehicle-assignment">
                      <h3>Suitable Vehicles (Optimized by Load & Cluster)</h3>
                      {(() => {
                        const load = calculateLoad(selectedPO);
                        const clusterName = findCluster(selectedPO.location);
                        const maxCapacity = Math.max(...vehicles.map(v => v.capacity));

                        // Get eligible vehicles with enhanced scoring
                        const eligibleVehicles = vehicles.filter(vehicle => {
                          const usedForDate = getUsedLoadForVehicleOnDate(vehicle, selectedPO.deliveryDate);
                          const lockedCluster = getClusterForVehicleOnDate(vehicle, selectedPO.deliveryDate);
                          const hasCapacity = (vehicle.capacity - usedForDate) >= load;
                          const clusterOk = !lockedCluster || lockedCluster === clusterName;
                          return vehicle.ready && hasCapacity && clusterOk;
                        });

                        if (eligibleVehicles.length === 0) {
                          return load > maxCapacity ? (
                            <p className="error-message">
                              This order exceeds the maximum load capacity of any vehicle. Please split the order into smaller batches.
                            </p>
                          ) : (
                            <p>No suitable vehicles available for the selected delivery date. Vehicles may be full or locked to a different cluster.</p>
                          );
                        }

                        // Score and sort vehicles for optimal assignment
                        const scoredVehicles = eligibleVehicles.map(vehicle => {
                          const usedForDate = getUsedLoadForVehicleOnDate(vehicle, selectedPO.deliveryDate);
                          const remainingCapacity = vehicle.capacity - usedForDate;
                          const utilizationAfter = (usedForDate + load) / vehicle.capacity;

                          // Calculate cluster efficiency
                          const clusterMatches = (vehicle.assignedPOs || []).reduce((acc, poId) => {
                            const assignedPO = pos.find(p => p.id === poId);
                            return acc + (assignedPO && assignedPO.deliveryDate === selectedPO.deliveryDate && findCluster(assignedPO.location) === clusterName ? 1 : 0);
                          }, 0);

                          // Calculate load efficiency score
                          let loadEfficiency = 0;
                          if (utilizationAfter <= 0.6) loadEfficiency = 2;
                          else if (utilizationAfter <= 0.85) loadEfficiency = 3;
                          else if (utilizationAfter <= 0.95) loadEfficiency = 1;
                          else loadEfficiency = -1;

                          // Size efficiency
                          let sizeEfficiency = 0;
                          if (load <= vehicle.capacity * 0.3 && vehicle.capacity > 10000000) sizeEfficiency = -0.5;
                          else if (load > vehicle.capacity * 0.8 && vehicle.capacity < 10000000) sizeEfficiency = -1;

                          const totalScore = (clusterMatches * 2) + loadEfficiency + sizeEfficiency;

                          return {
                            vehicle,
                            totalScore,
                            utilizationAfter,
                            remainingCapacity,
                            clusterMatches
                          };
                        });

                        // Sort by score (best first)
                        scoredVehicles.sort((a, b) => b.totalScore - a.totalScore);

                        return scoredVehicles.map(({ vehicle, utilizationAfter, remainingCapacity, clusterMatches }) => (
                          <div key={vehicle.id} className="vehicle-option">
                            <div className="vehicle-info">
                              <strong>{vehicle.name}</strong>
                              <div className="vehicle-details">
                                <span>Utilization: {(utilizationAfter * 100).toFixed(1)}%</span>
                                <span>Remaining: {remainingCapacity.toLocaleString()} cm²</span>
                                {clusterMatches > 0 && <span className="cluster-match">✓ Same cluster</span>}
                              </div>
                            </div>
                            <button onClick={() => handleAssign(vehicle.id)}>Assign</button>
                          </div>
                        ));
                      })()}
                    </div>
                  )}
                  <div className="action-buttons">
                    <button onClick={handleUpdate}>Update</button>
                    <button onClick={handleDelete} className="delete-btn">Delete</button>
                    <button onClick={() => setShowModal(false)}>Close</button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default POMonitoring;