import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { collection, addDoc, onSnapshot, doc, deleteDoc, query, orderBy, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useVehicles } from '../contexts/VehicleContext';
import './POMonitoring.css';

const products = {
  'Interfolded': {
    size: 0, // Individual piece dimension = 0
    packaging: { type: 'case', quantity: 30, name: 'Case (30 pcs)', size: 70780.5 },
    pricing: {
      perPiece: { price: 26, unit: 'piece' },
      perPackage: { price: 780, unit: 'case' }
    }
  },
  'Jumbo Roll': {
    size: 0, // Individual roll dimension = 0
    packaging: [
      { type: 'case', quantity: 12, name: 'Case (12 rolls)', size: 66816 },
      { type: 'case', quantity: 16, name: 'Case (16 rolls)', size: 66816 }
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
    size: 0, // Individual roll dimension = 0
    packaging: { type: 'bundle', quantity: 48, name: 'Bundle (48 rolls)', size: 45630 },
    pricing: {
      perPiece: { price: 8.15, unit: 'roll' },
      perPackage: { price: 408, unit: 'bundle' }
    }
  },
  'Hand Roll': {
    size: 0, // Individual roll dimension = 0
    packaging: { type: 'bundle', quantity: 6, name: 'Bundle (6 rolls)', size: 46200 },
    pricing: {
      perPiece: { price: 134, unit: 'roll' },
      perPackage: { price: 804, unit: 'bundle' }
    }
  }
};

const customers = {
  'Sisko': ['Pampanga', 'Bulacan', 'BGC Taguig', 'Quezon City', 'Makati', 'Alabang', 'Calamba', 'Lipa'],
  'Sudexo': ['Bulacan', 'BGC Taguig', 'Quezon City', 'Makati', 'Alabang', 'Calamba', 'Lipa'],
  'John\'s Lang': ['BGC Taguig', 'Quezon City', 'Makati', 'Alabang', 'Calamba', 'Lipa'],
  'WeWork': ['Uptown', 'RCBC', 'Menarco', 'Milestone'],
  'China Bank': ['Makati', 'Binondo', 'Mega Town'],
  'Tata Consultant Service Philippine Inc.': ['Bench Taguig', 'Entech Pampanga', 'Panorama BGC Taguig'],
  'VXI Global Philippines': ['Entech Pampanga', 'Bridgetown Quezon City', 'Makati', 'MOA', 'Panorama BGC Taguig']
};

const clusters = {
  'Cluster 1': {
    locations: ['Pampanga', 'Bulacan']
  },
  'Cluster 2': {
    locations: ['Quezon City', 'Bridgetown Quezon City', 'Binondo', 'Mega Town']
  },
  'Cluster 3': {
    locations: ['Makati', 'BGC Taguig', 'Panorama BGC Taguig', 'Bench Taguig', 'Uptown', 'Menarco', 'Milestone', 'MOA', 'Alabang']
  },
  'Cluster 4': {
    locations: ['Alabang', 'Calamba', 'Lipa']
  }
};

const allLocations = Object.values(clusters).flatMap(cluster => cluster.locations);

// Get all unique locations from customers
const allCustomerLocations = [...new Set(Object.values(customers).flatMap(locations => locations))];

// Verify all customer locations are in clusters
const missingLocations = allCustomerLocations.filter(loc => !allLocations.includes(loc));
if (missingLocations.length > 0) {
  console.warn('Warning: The following customer locations are not assigned to any cluster:', missingLocations);
}



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
    status: 'pending'
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
    status: 'pending'
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
        // Filter out completed POs from the main display
        setPos(posData.filter(po => po.status !== 'completed'));

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

  // Monitor driver status changes and automatically reassign loads
  useEffect(() => {
    const q = query(collection(db, 'drivers'), orderBy('createdAt'));
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const driversData = [];
      querySnapshot.forEach((doc) => {
        driversData.push({ id: doc.id, ...doc.data() });
      });

      // Update vehicle statuses based on driver status
      setVehicles(prevVehicles => {
        return prevVehicles.map(vehicle => {
          const driverData = driversData.find(d => d.name === vehicle.driver);
          const newStatus = driverData?.status || 'Not Set';
          const wasAvailable = vehicle.status === 'Available';
          const isNowUnavailable = newStatus !== 'Available';

          // If driver status changed from available to unavailable, trigger reassignment
          if (wasAvailable && isNowUnavailable && vehicle.assignedPOs?.length > 0) {
            // Automatically reassign loads from this vehicle
            setTimeout(() => {
              handleDriverStatusChange(vehicle, pos);
            }, 100); // Small delay to ensure state is updated
          }

          return {
            ...vehicle,
            status: newStatus
          };
        });
      });
    });

    return unsubscribe;
  }, [setVehicles, pos]);

  // Function to handle automatic reassignment when driver becomes unavailable
  const handleDriverStatusChange = async (vehicle, currentPos) => {
    const assignedPOs = currentPos.filter(po => po.assignedTruck === vehicle.name);

    for (const po of assignedPOs) {
      // Try to reassign this PO to another available vehicle
      const reassignedVehicle = assignVehicleAutomatically({
        ...po,
        assignedTruck: null // Clear current assignment
      });

      if (reassignedVehicle) {
        // Update the PO with new assignment
        await updateDoc(doc(db, 'pos', po.id), {
          assignedTruck: reassignedVehicle,
          load: calculateLoad(po)
        });

        // Log the automatic reassignment
        await addDoc(collection(db, 'history'), {
          timestamp: new Date(),
          action: 'Auto-Reassigned PO (Driver Unavailable)',
          details: `PO ${po.customId} auto-reassigned from ${vehicle.name} to ${reassignedVehicle} due to driver status change`
        });

        console.log(`Auto-reassigned PO ${po.customId} from ${vehicle.name} to ${reassignedVehicle}`);
      } else {
        // If no vehicle available, unassign the PO
        await updateDoc(doc(db, 'pos', po.id), {
          assignedTruck: null,
          load: calculateLoad(po)
        });

        await addDoc(collection(db, 'history'), {
          timestamp: new Date(),
          action: 'Unassigned PO (No Available Vehicles)',
          details: `PO ${po.customId} unassigned from ${vehicle.name} - no available vehicles found`
        });

        console.log(`Unassigned PO ${po.customId} from ${vehicle.name} - no available vehicles`);
      }
    }

    // Update vehicle load after reassignment
    updateVehicle(vehicle.id, {
      currentLoad: 0,
      assignedPOs: []
    });
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    if (name === 'companyName') {
      // When company changes, reset location if it's not in the new company's locations
      const newForm = { ...form, [name]: value };
      if (value && customers[value] && !customers[value].includes(form.location)) {
        newForm.location = '';
      }
      setForm(newForm);
    } else {
      setForm({ ...form, [name]: value });
    }
  };

  const calculateLoad = useCallback((po) => {
    return po.products.reduce((total, item) => {
      const product = products[item.product];
      if (!product) return total;

      let itemSize = 0;

      // Use package dimensions for load calculation
      if (item.pricingType === 'perPackage') {
        const packaging = product.packaging;
        if (Array.isArray(packaging)) {
          // For Jumbo Roll with multiple packaging options, use the selected one
          const selectedPackaging = packaging.find(p => p.quantity === item.packageQuantity) || packaging[0];
          itemSize = selectedPackaging.size;
        } else {
          itemSize = packaging.size;
        }
      } else if (item.pricingType === 'perPiece') {
        // Individual pieces have 0 dimension
        itemSize = product.size; // This is 0
      }

      return total + (item.quantity * itemSize);
    }, 0);
  }, []);

  const calculateTotalPrice = useCallback((productsList) => {
    return productsList.reduce((total, item) => {
      const product = products[item.product];
      if (!product) return total;

      let price = 0;
      if (item.pricingType === 'perPiece') {
        price = product.pricing.perPiece.price;
      } else if (item.pricingType === 'perPackage') {
        if (Array.isArray(product.pricing.perPackage)) {
          // For Jumbo Roll with multiple packaging options
          const selectedPackage = product.pricing.perPackage.find(p => p.quantity === item.packageQuantity);
          price = selectedPackage ? selectedPackage.price : product.pricing.perPackage[0].price;
        } else {
          price = product.pricing.perPackage.price;
        }
      }

      return total + (item.quantity * price);
    }, 0);
  }, []);

  const findCluster = (location) => {
    for (const [clusterName, cluster] of Object.entries(clusters)) {
      if (cluster.locations.includes(location)) {
        return clusterName;
      }
    }
    return null;
  };

  // Debug logging for cluster assignment
  console.log('Available clusters:', clusters);
  console.log('Available locations:', allLocations);
 
  // Memoized load calculations for better performance
  const vehicleLoadCache = useMemo(() => {
    const cache = {};
    vehicles.forEach(vehicle => {
      cache[vehicle.id] = {};
      const assigned = vehicle.assignedPOs || [];
      assigned.forEach(poId => {
        const assignedPO = pos.find(p => p.id === poId);
        if (assignedPO) {
          const dateStr = assignedPO.deliveryDate;
          if (!cache[vehicle.id][dateStr]) {
            cache[vehicle.id][dateStr] = { load: 0, cluster: null };
          }
          cache[vehicle.id][dateStr].load += calculateLoad(assignedPO);
          const c = findCluster(assignedPO.location);
          if (cache[vehicle.id][dateStr].cluster && cache[vehicle.id][dateStr].cluster !== c) {
            // Mixed clusters shouldn't happen; treat as locked and disallow further mixing.
            cache[vehicle.id][dateStr].cluster = cache[vehicle.id][dateStr].cluster;
          } else {
            cache[vehicle.id][dateStr].cluster = c;
          }
        }
      });
    });
    return cache;
  }, [vehicles, pos, calculateLoad]);

  // Compute accumulated load for a vehicle on a specific delivery date from already assigned POs
  const getUsedLoadForVehicleOnDate = useCallback((vehicle, dateStr) => {
    return vehicleLoadCache[vehicle.id]?.[dateStr]?.load || 0;
  }, [vehicleLoadCache]);

  // Determine the cluster a vehicle is already servicing on a given date (if any)
  const getClusterForVehicleOnDate = useCallback((vehicle, dateStr) => {
    return vehicleLoadCache[vehicle.id]?.[dateStr]?.cluster || null;
  }, [vehicleLoadCache]);

  // Optimized vehicle scoring function
  const scoreVehiclesForPO = useCallback((po, vehicles, pos) => {
    const load = calculateLoad(po);
    const clusterName = findCluster(po.location);

    // If location is not in any defined cluster, no vehicles are eligible
    if (!clusterName) {
      return [];
    }

    // Filter by availability, capacity for the PO's date, cluster lock per date, and driver status
    const eligibleVehicles = vehicles.filter(v => {
      const usedForDate = getUsedLoadForVehicleOnDate(v, po.deliveryDate);
      const clusterForDate = getClusterForVehicleOnDate(v, po.deliveryDate);
      const hasCapacity = (v.capacity - usedForDate) >= load;
      const clusterOk = !clusterForDate || clusterForDate === clusterName;
      // Check driver status - vehicle is only available if driver status is 'Available'
      const driverAvailable = v.status === 'Available';
      return v.ready && hasCapacity && clusterOk && driverAvailable;
    });

    if (eligibleVehicles.length === 0) return [];

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
      if (utilizationAfter <= 0.5) {
        // Under-utilized: bonus for filling up
        loadEfficiency = 2.5;
      } else if (utilizationAfter <= 0.75) {
        // Good range: high priority
        loadEfficiency = 4;
      } else if (utilizationAfter <= 0.9) {
        // Optimal range: highest priority
        loadEfficiency = 3;
      } else if (utilizationAfter <= 0.95) {
        // Near capacity: still good but less optimal
        loadEfficiency = 1;
      } else {
        // Over-utilized: penalty
        loadEfficiency = -2;
      }

      // Calculate vehicle size efficiency (prefer appropriately sized vehicles)
      let sizeEfficiency = 0;
      const loadRatio = load / v.capacity;
      if (loadRatio <= 0.2 && v.capacity > 10000000) {
        // Very small load in large vehicle: penalty
        sizeEfficiency = -1;
      } else if (loadRatio <= 0.4 && v.capacity > 5000000) {
        // Small load in large vehicle: slight penalty
        sizeEfficiency = -0.5;
      } else if (loadRatio > 0.9 && v.capacity < 5000000) {
        // Large load in small vehicle: penalty
        sizeEfficiency = -1.5;
      } else if (loadRatio > 0.8 && v.capacity < 10000000) {
        // Large load in medium vehicle: slight penalty
        sizeEfficiency = -0.5;
      }

      // Total score combines multiple factors with weighted priorities
      const totalScore = (clusterMatches * 3) + loadEfficiency + sizeEfficiency;

      return {
        vehicle: v,
        totalScore,
        utilizationAfter,
        remainingCapacity,
        clusterMatches,
        loadEfficiency,
        sizeEfficiency
      };
    });

    // Sort by total score (descending), then by utilization after (ascending for better distribution)
    scored.sort((a, b) => {
      if (Math.abs(b.totalScore - a.totalScore) > 0.1) {
        return b.totalScore - a.totalScore;
      }
      // If scores are very close, prefer the one with better utilization (closer to optimal range)
      const aUtilDiff = Math.abs(a.utilizationAfter - 0.8); // Optimal around 80%
      const bUtilDiff = Math.abs(b.utilizationAfter - 0.8);
      return aUtilDiff - bUtilDiff;
    });

    return scored;
  }, []);

  const assignVehicleAutomatically = useCallback((po) => {
    const scoredVehicles = scoreVehiclesForPO(po, vehicles, pos);

    if (scoredVehicles.length === 0) return null;

    const chosen = scoredVehicles[0].vehicle;
    const chosenData = scoredVehicles[0];
    const load = calculateLoad(po);
    const clusterName = findCluster(po.location);

    console.log(`Auto-assigning PO ${po.customId} to ${chosen.name}:`, {
      load,
      cluster: clusterName,
      score: chosenData.totalScore,
      utilizationAfter: (chosenData.utilizationAfter * 100).toFixed(1) + '%',
      clusterMatches: chosenData.clusterMatches
    });

    // Track assignment centrally. We don't flip global ready here; availability is per-date now.
    // Ensure we don't exceed 100% capacity
    const usedForDate = getUsedLoadForVehicleOnDate(chosen, po.deliveryDate);
    const newLoad = Math.min(usedForDate + load, chosen.capacity);

    updateVehicle(chosen.id, {
      currentLoad: newLoad,
      assignedPOs: [...(chosen.assignedPOs || []), po.id]
    });

    return chosen.name;
  }, [scoreVehiclesForPO, vehicles, pos, calculateLoad, getUsedLoadForVehicleOnDate]);

  const removeProduct = (index) => {
    const updatedProducts = form.products.filter((_, i) => i !== index);
    const subtotal = calculateTotalPrice(updatedProducts);
    setForm({ ...form, products: updatedProducts, totalPrice: subtotal });
  };

  const handleQuantityChange = (index, value) => {
    const updatedProducts = form.products.map((item, i) => i === index ? { ...item, quantity: parseInt(value) || 0 } : item);
    const subtotal = calculateTotalPrice(updatedProducts);
    setForm({ ...form, products: updatedProducts, totalPrice: subtotal });
  };

  const handleEditInputChange = (e) => {
    const { name, value } = e.target;
    if (name === 'companyName') {
      // When company changes, reset location if it's not in the new company's locations
      const newEditForm = { ...editForm, [name]: value };
      if (value && customers[value] && !customers[value].includes(editForm.location)) {
        newEditForm.location = '';
      }
      setEditForm(newEditForm);
    } else {
      setEditForm({ ...editForm, [name]: value });
    }
  };

  const handleEditQuantityChange = (index, value) => {
    const updatedProducts = editForm.products.map((item, i) => i === index ? { ...item, quantity: parseInt(value) || 0 } : item);
    const subtotal = calculateTotalPrice(updatedProducts);
    setEditForm({ ...editForm, products: updatedProducts, totalPrice: subtotal });
  };

  const handleEditProductChange = (index, value) => {
    const updatedProducts = editForm.products.map((item, i) => i === index ? { ...item, product: value, pricingType: 'perPiece', packageQuantity: null } : item);
    const subtotal = calculateTotalPrice(updatedProducts);
    setEditForm({ ...editForm, products: updatedProducts, totalPrice: subtotal });
  };

  const addEditProduct = () => {
    const updatedProducts = [...editForm.products, { product: 'Interfolded', quantity: 0, pricingType: 'perPiece', packageQuantity: null }];
    const subtotal = calculateTotalPrice(updatedProducts);
    setEditForm({ ...editForm, products: updatedProducts, totalPrice: subtotal });
  };

  const removeEditProduct = (index) => {
    const updatedProducts = editForm.products.filter((_, i) => i !== index);
    const subtotal = calculateTotalPrice(updatedProducts);
    setEditForm({ ...editForm, products: updatedProducts, totalPrice: subtotal });
  };

  const handleSaveUpdate = async () => {
    if (!editForm.poNumber || !editForm.companyName || !editForm.customerName || !editForm.poDate || !editForm.location || !editForm.deliveryDate || !editForm.address || editForm.products.length === 0 || editForm.products.some(p => !p.product || p.quantity <= 0 || !p.pricingType)) {
      alert('Please fill all required fields with valid data.');
      return;
    }

    try {
      const updatedPO = {
        customId: editForm.poNumber,
        ...editForm,
        load: calculateLoad(editForm),
        updatedAt: new Date(),
        status: editForm.status || 'pending'
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
    if (!form.poNumber || !form.companyName || !form.customerName || !form.poDate || !form.location || !form.deliveryDate || !form.address || form.products.length === 0 || form.products.some(p => !p.product || p.quantity <= 0 || !p.pricingType)) {
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

      // Check if location is in a defined cluster
      const poCluster = findCluster(newPO.location);
      if (!poCluster) {
        alert('This location is not assigned to any cluster. Please select a valid location or contact an administrator.');
        return;
      }

      const docRef = await addDoc(collection(db, 'pos'), newPO);
      const poId = docRef.id;

      // Automate assignment
      const assignedVehicle = assignVehicleAutomatically({ ...newPO, id: poId });
      if (assignedVehicle) {
        // Keep Firestore field naming as 'assignedTruck' for backward compatibility
        // Also persist computed load so vehicle loads can be reconstructed after refresh
        await updateDoc(docRef, { assignedTruck: assignedVehicle, load: newPO.load, status: 'assigned' });
        newPO.assignedTruck = assignedVehicle;
        newPO.status = 'assigned';

        // assignedPOs and currentLoad already updated via VehicleContext.assignLoad

        // Log assignment
        await addDoc(collection(db, 'history'), {
          timestamp: new Date(),
          action: 'Auto-Assigned PO to Vehicle',
          details: `PO ${newPO.customId} auto-assigned to ${assignedVehicle}`
        });
      } else {
        // Set status to on-hold when no vehicle is available
        await updateDoc(docRef, { status: 'on-hold', load: newPO.load });
        newPO.status = 'on-hold';

        // Check if the issue is driver status or cluster availability
        const clusterName = findCluster(newPO.location);
        const allVehiclesForDate = vehicles.filter(v => {
          const usedForDate = getUsedLoadForVehicleOnDate(v, newPO.deliveryDate);
          const clusterForDate = getClusterForVehicleOnDate(v, newPO.deliveryDate);
          const hasCapacity = (v.capacity - usedForDate) >= newPO.load;
          const clusterOk = !clusterForDate || clusterForDate === clusterName;
          return v.ready && hasCapacity && clusterOk;
        });

        const unavailableDrivers = allVehiclesForDate.filter(v => v.status !== 'Available');
        const availableVehicles = allVehiclesForDate.filter(v => v.status === 'Available');

        if (unavailableDrivers.length > 0 && availableVehicles.length === 0) {
          alert(`No suitable vehicles available in cluster ${clusterName}. All vehicles have drivers with status: ${unavailableDrivers.map(v => `${v.name} (${v.status})`).join(', ')}. Please check driver statuses or wait for drivers to become available. PO has been placed on hold.`);
        } else if (availableVehicles.length === 0) {
          alert(`No suitable vehicles available in cluster ${clusterName} for this PO on the selected delivery date. Vehicles may be full or restricted to another cluster. PO has been placed on hold.`);
        } else {
          alert('No suitable vehicle available for this PO. PO has been placed on hold.');
        }

        // Log on-hold status
        await addDoc(collection(db, 'history'), {
          timestamp: new Date(),
          action: 'PO Placed On Hold',
          details: `PO ${newPO.customId} placed on hold - no available vehicles in cluster ${clusterName}`
        });
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
        status: 'pending'
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
      status: selectedPO.status || 'pending'
    });
    setIsEditing(true);
  };

  const handleDelete = async () => {
    if (window.confirm('Are you sure you want to delete this PO?')) {
      // If PO was assigned to a vehicle, update the vehicle's load
      if (selectedPO.assignedTruck) {
        const vehicle = vehicles.find(v => v.name === selectedPO.assignedTruck);
        if (vehicle) {
          const loadToRemove = calculateLoad(selectedPO);
          updateVehicle(vehicle.id, {
            currentLoad: Math.max(0, vehicle.currentLoad - loadToRemove),
            assignedPOs: (vehicle.assignedPOs || []).filter(poId => poId !== selectedPO.id)
          });
        }
      }

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

  // Load rebalancing function to optimize existing assignments
  const rebalanceLoads = useCallback(async () => {
    if (window.confirm('This will attempt to rebalance vehicle loads for better distribution. Continue?')) {
      const allPOs = [...pos];
      const vehicleAssignments = {};

      // Initialize vehicle assignments
      vehicles.forEach(vehicle => {
        vehicleAssignments[vehicle.name] = {
          vehicle,
          assignedPOs: [],
          totalLoad: 0
        };
      });

      // Clear all current assignments first
      for (const po of allPOs) {
        if (po.assignedTruck) {
          const vehicle = vehicles.find(v => v.name === po.assignedTruck);
          if (vehicle) {
            updateVehicle(vehicle.id, {
              currentLoad: 0,
              assignedPOs: []
            });
          }
        }
      }

      // Sort POs by delivery date and load (largest first for better packing)
      allPOs.sort((a, b) => {
        if (a.deliveryDate !== b.deliveryDate) {
          return new Date(a.deliveryDate) - new Date(b.deliveryDate);
        }
        return calculateLoad(b) - calculateLoad(a);
      });

      // Reassign all POs using optimized algorithm
      for (const po of allPOs) {
        const assignedVehicle = assignVehicleAutomatically({ ...po, assignedTruck: null });
        if (assignedVehicle) {
          vehicleAssignments[assignedVehicle].assignedPOs.push(po);
          vehicleAssignments[assignedVehicle].totalLoad += calculateLoad(po);

          await updateDoc(doc(db, 'pos', po.id), {
            assignedTruck: assignedVehicle,
            load: calculateLoad(po),
            status: 'assigned'
          });

          await addDoc(collection(db, 'history'), {
            timestamp: new Date(),
            action: 'Rebalanced PO Assignment',
            details: `PO ${po.customId} re-assigned to ${assignedVehicle}`
          });
        } else {
          // If no vehicle available, set to on-hold
          await updateDoc(doc(db, 'pos', po.id), {
            assignedTruck: null,
            status: 'on-hold',
            load: calculateLoad(po)
          });
        }
      }

      alert('Load rebalancing completed. Check the history for details.');
    }
  }, [pos, vehicles, calculateLoad, assignVehicleAutomatically, updateVehicle]);

  const handleAssign = useCallback(async (vehicleId) => {
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

      // Additional check: ensure the PO's location is in a valid cluster
      if (!clusterName) {
        alert('This PO has an invalid location that is not assigned to any cluster. Please update the PO location first.');
        return;
      }

      if (vehicle.capacity - usedForDate >= load) {
        // Check driver status first
        if (vehicle.status !== 'Available') {
          alert(`Cannot assign to ${vehicle.name}: Driver status is "${vehicle.status}". Vehicle is not available for delivery.`);
          return;
        }

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
        // Ensure we don't exceed 100% capacity
        const usedForDate = getUsedLoadForVehicleOnDate(vehicle, selectedPO.deliveryDate);
        const newLoad = Math.min(usedForDate + load, vehicle.capacity);

        updateVehicle(vehicleId, {
          currentLoad: newLoad,
          assignedPOs: [...(vehicle.assignedPOs || []), selectedPO.id]
        });
        // Update PO assignedTruck (field kept for compatibility), status, and persist computed load
        await updateDoc(doc(db, 'pos', selectedPO.id), { assignedTruck: vehicle.name, status: 'assigned', load: calculateLoad(selectedPO) });
        setSelectedPO({ ...selectedPO, assignedTruck: vehicle.name, status: 'assigned' });
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
  }, [selectedPO, vehicles, calculateLoad, getUsedLoadForVehicleOnDate, getClusterForVehicleOnDate, updateVehicle]);

  return (
    <div className="po-monitoring">
      <h1>PO Monitoring</h1>
      <div className="header-actions">
        <button className="add-po-btn" onClick={() => setShowForm(true)}>+ Add PO</button>
        <button className="rebalance-btn" onClick={rebalanceLoads}>Rebalance Loads</button>
      </div>
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
                    <select name="companyName" value={form.companyName} onChange={handleInputChange} required>
                      <option value="">Select Company</option>
                      {Object.keys(customers).map(company => (
                        <option key={company} value={company}>{company}</option>
                      ))}
                    </select>
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
                      {form.companyName && customers[form.companyName] ? (
                        customers[form.companyName].map(loc => (
                          <option key={loc} value={loc}>{loc}</option>
                        ))
                      ) : (
                        allLocations.map(loc => (
                          <option key={loc} value={loc}>{loc}</option>
                        ))
                      )}
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
                </div>
              </div>

              <div className="kiosk-section">
                <h3>Select Products</h3>
                <div className="product-selection">
                 {Object.entries(products).map(([productName, productInfo]) => (
                   <div key={productName} className="product-card">
                     <div className="product-info">
                       <h4>{productName}</h4>
                       <p className="product-size">
                         {Array.isArray(productInfo.packaging)
                           ? `Case sizes: ${productInfo.packaging.map(p => `${p.name} (${p.size.toLocaleString()} cm²)`).join(', ')}`
                           : `${productInfo.packaging.name} (${productInfo.packaging.size.toLocaleString()} cm²)`
                         }
                       </p>
                       <div className="pricing-buttons">
                         <button
                           type="button"
                           className={`pricing-btn ${form.products.some(p => p.product === productName && p.pricingType === 'perPiece') ? 'selected' : ''}`}
                           onClick={() => {
                             const existingIndex = form.products.findIndex(p => p.product === productName && p.pricingType === 'perPiece');
                             if (existingIndex >= 0) {
                               const currentQty = form.products[existingIndex].quantity;
                               if (currentQty > 1) {
                                 handleQuantityChange(existingIndex, (currentQty - 1).toString());
                               } else {
                                 removeProduct(existingIndex);
                               }
                             } else {
                               const updatedProducts = [...form.products, {
                                 product: productName,
                                 quantity: 1,
                                 pricingType: 'perPiece',
                                 packageQuantity: null
                               }];
                               const subtotal = calculateTotalPrice(updatedProducts);
                               setForm({ ...form, products: updatedProducts, totalPrice: subtotal });
                             }
                           }}
                         >
                           Per {productInfo.pricing.perPiece.unit}: ₱{productInfo.pricing.perPiece.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                         </button>
                         {Array.isArray(productInfo.pricing.perPackage) ? (
                           productInfo.pricing.perPackage.map(pkg => (
                             <button
                               key={pkg.quantity}
                               type="button"
                               className={`pricing-btn ${form.products.some(p => p.product === productName && p.pricingType === 'perPackage' && p.packageQuantity === pkg.quantity) ? 'selected' : ''}`}
                               onClick={() => {
                                 const existingIndex = form.products.findIndex(p => p.product === productName && p.pricingType === 'perPackage' && p.packageQuantity === pkg.quantity);
                                 if (existingIndex >= 0) {
                                   const currentQty = form.products[existingIndex].quantity;
                                   if (currentQty > 1) {
                                     handleQuantityChange(existingIndex, (currentQty - 1).toString());
                                   } else {
                                     removeProduct(existingIndex);
                                   }
                                 } else {
                                   const updatedProducts = [...form.products, {
                                     product: productName,
                                     quantity: 1,
                                     pricingType: 'perPackage',
                                     packageQuantity: pkg.quantity
                                   }];
                                   const subtotal = calculateTotalPrice(updatedProducts);
                                   setForm({ ...form, products: updatedProducts, totalPrice: subtotal });
                                 }
                               }}
                             >
                               {pkg.quantity} {productInfo.pricing.perPiece.unit}s: ₱{pkg.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                             </button>
                           ))
                         ) : (
                           <button
                             type="button"
                             className={`pricing-btn ${form.products.some(p => p.product === productName && p.pricingType === 'perPackage') ? 'selected' : ''}`}
                             onClick={() => {
                               const existingIndex = form.products.findIndex(p => p.product === productName && p.pricingType === 'perPackage');
                               if (existingIndex >= 0) {
                                 const currentQty = form.products[existingIndex].quantity;
                                 if (currentQty > 1) {
                                   handleQuantityChange(existingIndex, (currentQty - 1).toString());
                               } else {
                                 removeProduct(existingIndex);
                               }
                             } else {
                               const updatedProducts = [...form.products, {
                                 product: productName,
                                 quantity: 1,
                                 pricingType: 'perPackage',
                                 packageQuantity: productInfo.packaging.quantity
                               }];
                               const subtotal = calculateTotalPrice(updatedProducts);
                               setForm({ ...form, products: updatedProducts, totalPrice: subtotal });
                             }
                           }}
                         >
                           Per {productInfo.packaging.name}: ₱{productInfo.pricing.perPackage.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                         </button>
                         )}
                       </div>
                     </div>
                     <div className="quantity-display">
                       {(() => {
                         const pieceEntry = form.products.find(p => p.product === productName && p.pricingType === 'perPiece');
                         const packageEntries = form.products.filter(p => p.product === productName && p.pricingType === 'perPackage');

                         return (
                           <>
                             {pieceEntry && (
                               <div className="quantity-item">
                                 <span>Per {productInfo.pricing.perPiece.unit}:</span>
                                 <div className="quantity-controls">
                                   <button
                                     type="button"
                                     className="qty-btn minus"
                                     onClick={() => {
                                       const currentQty = pieceEntry.quantity;
                                       if (currentQty > 1) {
                                         handleQuantityChange(form.products.indexOf(pieceEntry), (currentQty - 1).toString());
                                       } else {
                                         removeProduct(form.products.indexOf(pieceEntry));
                                       }
                                     }}
                                   >
                                     -
                                   </button>
                                   <span className="quantity-value">{pieceEntry.quantity}</span>
                                   <button
                                     type="button"
                                     className="qty-btn plus"
                                     onClick={() => handleQuantityChange(form.products.indexOf(pieceEntry), (pieceEntry.quantity + 1).toString())}
                                   >
                                     +
                                   </button>
                                 </div>
                               </div>
                             )}
                             {packageEntries.map(entry => (
                               <div key={entry.packageQuantity} className="quantity-item">
                                 <span>
                                   {Array.isArray(productInfo.packaging)
                                     ? `${entry.packageQuantity} ${productInfo.pricing.perPiece.unit}s`
                                     : productInfo.packaging.name}:
                                 </span>
                                 <div className="quantity-controls">
                                   <button
                                     type="button"
                                     className="qty-btn minus"
                                     onClick={() => {
                                       const currentQty = entry.quantity;
                                       if (currentQty > 1) {
                                         handleQuantityChange(form.products.indexOf(entry), (currentQty - 1).toString());
                                       } else {
                                         removeProduct(form.products.indexOf(entry));
                                       }
                                     }}
                                   >
                                     -
                                   </button>
                                   <span className="quantity-value">{entry.quantity}</span>
                                   <button
                                     type="button"
                                     className="qty-btn plus"
                                     onClick={() => handleQuantityChange(form.products.indexOf(entry), (entry.quantity + 1).toString())}
                                   >
                                     +
                                   </button>
                                 </div>
                               </div>
                             ))}
                           </>
                         );
                       })()}
                     </div>
                   </div>
                 ))}
               </div>
              </div>

              <div className="kiosk-summary">
                <div className="order-summary">
                  <h3>Order Summary</h3>
                  <div className="summary-items">
                    {form.products.map((item, index) => {
                      const product = products[item.product];
                      let price = 0;
                      let description = '';

                      if (product) {
                        if (item.pricingType === 'perPiece') {
                          price = product.pricing.perPiece.price;
                          description = `${item.product} (${product.pricing.perPiece.unit}) x ${item.quantity}`;
                        } else if (item.pricingType === 'perPackage') {
                          if (Array.isArray(product.pricing.perPackage)) {
                            const selectedPackage = product.pricing.perPackage.find(p => p.quantity === item.packageQuantity);
                            price = selectedPackage ? selectedPackage.price : product.pricing.perPackage[0].price;
                            description = `${item.product} (${item.packageQuantity} ${product.pricing.perPiece.unit}s) x ${item.quantity}`;
                          } else {
                            price = product.pricing.perPackage.price;
                            description = `${item.product} (${product.packaging.name}) x ${item.quantity}`;
                          }
                        }
                      }

                      return (
                        <div key={index} className="summary-item">
                          <span>{description}</span>
                          <span>₱{(item.quantity * price).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                        </div>
                      );
                    })}
                  </div>
                 <div className="summary-total">
                   <div className="total-row">
                     <span>Subtotal:</span>
                     <span>₱{form.totalPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                   </div>
                   <div className="total-row">
                     <span>Sales Tax (12%):</span>
                     <span>₱{(form.totalPrice * 0.12).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                   </div>
                   <div className="total-row final-total">
                     <span>Total:</span>
                     <span>₱{(form.totalPrice * 1.12).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
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
          const status = po.status || 'pending';
          const assigned = status === 'assigned';
          const onHold = status === 'on-hold';
          const load = calculateLoad(po);
          const vehicle = assigned ? vehicles.find(v => v.name === po.assignedTruck) : null;
          // Calculate utilization the same way as Vehicle Monitoring (max load across all dates)
          const dateGroups = {};
          pos
            .filter(p => p.assignedTruck === vehicle?.name)
            .forEach(p => {
              if (!dateGroups[p.deliveryDate]) dateGroups[p.deliveryDate] = 0;
              dateGroups[p.deliveryDate] += calculateLoad(p) || 0;
            });
          const maxLoadForVehicle = Math.max(...Object.values(dateGroups), 0);
          const utilization = vehicle ? (maxLoadForVehicle / vehicle.capacity) * 100 : 0;

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
                <div className={`badge ${assigned ? 'success' : onHold ? 'warning' : 'info'}`}>
                  <span className="dot"></span>
                  {assigned ? 'Assigned' : onHold ? 'On Hold' : 'Pending'}
                </div>
              </div>
              <div className="card-meta">Delivery: {po.deliveryDate}</div>
              <div className="card-meta">Load: {load.toLocaleString()} cm²</div>
              {assigned && vehicle && (
                <div className="load-indicator">
                  <span className="vehicle-assigned">{po.assignedTruck}</span>
                  <div className="mini-load-bar">
                    <div
                      className="mini-load-fill"
                      style={{
                        width: `${Math.min(utilization, 100)}%`,
                        backgroundColor: utilization > 90 ? '#ff6b6b' :
                                       utilization > 75 ? '#ffa726' : '#4caf50'
                      }}
                    ></div>
                  </div>
                  <span className="utilization-text">{utilization.toFixed(1)}%</span>
                </div>
              )}
              {po.assignedTruck && (
                <div className="card-vehicle">
                  <span className="vehicle-info">🚛 {po.assignedTruck}</span>
                </div>
              )}
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
                      <select name="companyName" value={editForm.companyName} onChange={handleEditInputChange} required>
                        <option value="">Select Company</option>
                        {Object.keys(customers).map(company => (
                          <option key={company} value={company}>{company}</option>
                        ))}
                      </select>
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
                        {editForm.companyName && customers[editForm.companyName] ? (
                          customers[editForm.companyName].map(loc => (
                            <option key={loc} value={loc}>{loc}</option>
                          ))
                        ) : (
                          allLocations.map(loc => (
                            <option key={loc} value={loc}>{loc}</option>
                          ))
                        )}
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
                  </div>
                </div>

                <div className="kiosk-section">
                  <h3>Edit Products</h3>
                  <div className="products-section">
                    <h4>Products</h4>
                    {editForm.products.map((item, index) => (
                      <div key={index} className="product-item">
                        <select value={item.product} onChange={(e) => handleEditProductChange(index, e.target.value)}>
                          <option value="Interfolded">Interfolded</option>
                          <option value="Jumbo Roll">Jumbo Roll</option>
                          <option value="Bathroom">Bathroom</option>
                          <option value="Hand Roll">Hand Roll</option>
                        </select>
                        <div className="pricing-selection">
                          <label>
                            <input
                              type="radio"
                              name={`edit-pricing-${index}`}
                              value="perPiece"
                              checked={item.pricingType === 'perPiece'}
                              onChange={() => {
                                const updatedProducts = editForm.products.map((p, i) =>
                                  i === index ? { ...p, pricingType: 'perPiece', packageQuantity: null } : p
                                );
                                const subtotal = calculateTotalPrice(updatedProducts);
                                setEditForm({ ...editForm, products: updatedProducts, totalPrice: subtotal });
                              }}
                            />
                            Per {products[item.product]?.pricing.perPiece.unit}
                          </label>
                          <label>
                            <input
                              type="radio"
                              name={`edit-pricing-${index}`}
                              value="perPackage"
                              checked={item.pricingType === 'perPackage'}
                              onChange={() => {
                                const product = products[item.product];
                                const defaultPackageQuantity = Array.isArray(product.packaging)
                                  ? product.packaging[0].quantity
                                  : product.packaging.quantity;
                                const updatedProducts = editForm.products.map((p, i) =>
                                  i === index ? { ...p, pricingType: 'perPackage', packageQuantity: defaultPackageQuantity } : p
                                );
                                const subtotal = calculateTotalPrice(updatedProducts);
                                setEditForm({ ...editForm, products: updatedProducts, totalPrice: subtotal });
                              }}
                            />
                            {Array.isArray(products[item.product]?.packaging) ? (
                              <select
                                value={item.packageQuantity || ''}
                                onChange={(e) => {
                                  const quantity = parseInt(e.target.value);
                                  const updatedProducts = editForm.products.map((p, i) =>
                                    i === index ? { ...p, packageQuantity: quantity } : p
                                  );
                                  const subtotal = calculateTotalPrice(updatedProducts);
                                  setEditForm({ ...editForm, products: updatedProducts, totalPrice: subtotal });
                                }}
                              >
                                {products[item.product].packaging.map(pkg => (
                                  <option key={pkg.quantity} value={pkg.quantity}>{pkg.name}</option>
                                ))}
                              </select>
                            ) : (
                              `Per ${products[item.product]?.packaging.name}`
                            )}
                          </label>
                        </div>
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
                      {editForm.products.map((item, index) => {
                        const product = products[item.product];
                        let price = 0;
                        let description = '';

                        if (product) {
                          if (item.pricingType === 'perPiece') {
                            price = product.pricing.perPiece.price;
                            description = `${item.product} (${product.pricing.perPiece.unit}) x ${item.quantity}`;
                          } else if (item.pricingType === 'perPackage') {
                            if (Array.isArray(product.pricing.perPackage)) {
                              const selectedPackage = product.pricing.perPackage.find(p => p.quantity === item.packageQuantity);
                              price = selectedPackage ? selectedPackage.price : product.pricing.perPackage[0].price;
                              description = `${item.product} (${item.packageQuantity} ${product.pricing.perPiece.unit}s) x ${item.quantity}`;
                            } else {
                              price = product.pricing.perPackage.price;
                              description = `${item.product} (${product.packaging.name}) x ${item.quantity}`;
                            }
                          }
                        }

                        return (
                          <div key={index} className="summary-item">
                            <span>{description}</span>
                            <span>₱{(item.quantity * price).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                          </div>
                        );
                      })}
                    </div>
                    <div className="summary-total">
                      <div className="total-row">
                        <span>Subtotal:</span>
                        <span>₱{editForm.totalPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                      </div>
                      <div className="total-row">
                        <span>Sales Tax (12%):</span>
                        <span>₱{(editForm.totalPrice * 0.12).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                      </div>
                      <div className="total-row final-total">
                        <span>Total:</span>
                        <span>₱{(editForm.totalPrice * 1.12).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
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
                  {selectedPO.products.map((item, index) => {
                    const product = products[item.product];
                    let unitPrice = 0;
                    let unit = 'PCS';

                    if (product) {
                      if (item.pricingType === 'perPiece') {
                        unitPrice = product.pricing.perPiece.price;
                        unit = product.pricing.perPiece.unit.toUpperCase();
                      } else if (item.pricingType === 'perPackage') {
                        if (Array.isArray(product.pricing.perPackage)) {
                          const selectedPackage = product.pricing.perPackage.find(p => p.quantity === item.packageQuantity);
                          unitPrice = selectedPackage ? selectedPackage.price : product.pricing.perPackage[0].price;
                        } else {
                          unitPrice = product.pricing.perPackage.price;
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
                        <td>₱{unitPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                        <td>₱{(item.quantity * unitPrice).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
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
              {isEditing ? (
                <div className="edit-actions">
                  <button onClick={handleSaveUpdate} className="save-btn">Save Changes</button>
                  <button onClick={() => setIsEditing(false)} className="cancel-edit-btn">Cancel Edit</button>
                </div>
              ) : (
                <>
                  <p><strong>Status:</strong> {selectedPO.status === 'assigned' ? 'Assigned' : selectedPO.status === 'on-hold' ? 'On Hold' : 'Pending'}</p>
                  <p><strong>Assigned Vehicle:</strong> {selectedPO.assignedTruck || 'None'}</p>
                  {(selectedPO.status === 'pending' || selectedPO.status === 'on-hold') && (
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
                          // Check driver status - vehicle is only available if driver status is 'Available'
                          const driverAvailable = vehicle.status === 'Available';
                          return vehicle.ready && hasCapacity && clusterOk && driverAvailable;
                        });

                        // If location is not in any defined cluster, show error
                        if (!clusterName) {
                          return (
                            <p className="error-message">
                              This location is not assigned to any cluster. Please check the location or contact an administrator.
                            </p>
                          );
                        }

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
                                <span className={`driver-status ${vehicle.status?.toLowerCase().replace(' ', '-')}`}>
                                  Driver: {vehicle.status || 'Unknown'}
                                </span>
                              </div>
                              <div className="load-bar">
                                <div
                                  className="load-fill"
                                  style={{
                                    width: `${Math.min(utilizationAfter * 100, 100)}%`,
                                    backgroundColor: utilizationAfter > 0.9 ? '#ff6b6b' :
                                                   utilizationAfter > 0.75 ? '#ffa726' : '#4caf50'
                                  }}
                                ></div>
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