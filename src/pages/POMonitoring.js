import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { collection, addDoc, onSnapshot, doc, deleteDoc, query, orderBy, updateDoc, getDocs, where } from 'firebase/firestore';
import { db } from '../firebase';
import { useVehicles } from '../contexts/VehicleContext';
import NotificationDialog from '../components/NotificationDialog';
import ConfirmDialog from '../components/ConfirmDialog';
import POFormModal from '../components/POFormModal';
import './POMonitoring.css';
import './VehicleMonitoring.css';

const products = {
  'Interfolded': {
    size: 2000, // cm³ per piece (Interfolded Paper Towel piece/roll volume)
    packaging: { type: 'case', quantity: 30, name: 'Case (30 pcs)', size: 70780.5 },
    pricing: {
      perPiece: { price: 26, unit: 'piece' },
      perPackage: { price: 780, unit: 'case' }
    }
  },
  'Jumbo Roll': {
    size: 3648.4, // cm³ per roll (Jumbo Roll Tissue piece/roll volume)
    packaging: [
      { type: 'case', quantity: 12, name: 'Case (12 rolls)', size: 39016.5 },
      { type: 'case', quantity: 16, name: 'Case (16 rolls)', size: 90956.25 }
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
    size: 926.7, // cm³ per roll (Bathroom Tissue piece/roll volume)
    packaging: { type: 'case', quantity: 48, name: 'Case (48 rolls)', size: 45630 },
    pricing: {
      perPiece: { price: 8.15, unit: 'roll' },
      perPackage: { price: 408, unit: 'case' }
    }
  },
  'Hand Roll': {
    size: 6813.6, // cm³ per roll (Hand Roll Tissue piece/roll volume)
    packaging: { type: 'case', quantity: 6, name: 'Case (6 rolls)', size: 46200 },
    pricing: {
      perPiece: { price: 134, unit: 'roll' },
      perPackage: { price: 804, unit: 'case' }
    }
  }
};

const clusters = {
  'Cluster 1': { name: 'Cluster 1 - North Luzon' },
  'Cluster 2': { name: 'Cluster 2 - MNL North/East' },
  'Cluster 3': { name: 'Cluster 3 - MNL South/Center' },
  'Cluster 4': { name: 'Cluster 4 - South Luzon' }
};

const allLocations = [];

const POMonitoring = () => {
  const { vehicles, updateVehicle, setVehicles, assignPOToVehicle, rebalanceLoads } = useVehicles();
  const [pos, setPos] = useState([]);
  const initialForm = {
    poNumber: '',
    companyName: '',
    poDate: '',
    cluster: '',
    deliveryDate: '',
    products: [],
    totalPrice: 0,
    assignedTruck: '',
    address: '',
    contact: '',
    phone: '',
    currency: 'PHP',
    termsOfPayment: '',
    includeTax: true,
    includeEwt: false,
    status: 'pending'
  };

  const [form, setForm] = useState(initialForm);
  const [customPrices, setCustomPrices] = useState({});
  const [deliveryMinDate, setDeliveryMinDate] = useState(new Date().toISOString().split('T')[0]);
  const [phoneError, setPhoneError] = useState('');
  const [deliveryDateError, setDeliveryDateError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [selectedPO, setSelectedPO] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [notification, setNotification] = useState(null);
  const [confirmDialog, setConfirmDialog] = useState(null);
  const [editForm, setEditForm] = useState({
    poNumber: '',
    companyName: '',
    poDate: '',
    cluster: '',
    deliveryDate: '',
    products: [],
    totalPrice: 0,
    address: '',
    contact: '',
    phone: '',
    currency: 'PHP',
    termsOfPayment: '',
    includeTax: true,
    includeEwt: false,
    status: 'pending'
  });

  // Edit modal state (use same UX as Add PO)
  const [editCustomPrices, setEditCustomPrices] = useState({});
  const [editDeliveryMinDate, setEditDeliveryMinDate] = useState(new Date().toISOString().split('T')[0]);
  const [editPhoneError, setEditPhoneError] = useState('');
  const [editDeliveryDateError, setEditDeliveryDateError] = useState('');
  const [editLoading, setEditLoading] = useState(false);

  // Helpers to reset / open / close the Add PO form so inputs don't persist after cancel
  const resetForm = useCallback(() => {
    setForm(initialForm);
    setCustomPrices({});
    setPhoneError('');
    setDeliveryDateError('');
  }, [setForm, setCustomPrices]);

  const openNewForm = useCallback(() => {
    resetForm();
    setShowForm(true);
  }, [resetForm]);

  const closeForm = useCallback(() => {
    resetForm();
    setShowForm(false);
  }, [resetForm]);

  // Forecasting section state
  const [forecastingDate, setForecastingDate] = useState('');
  const [forecastingVehicles, setForecastingVehicles] = useState([]);

  // Function to simulate vehicle loading for On-Hold POs on selected date
  const simulateForecasting = useCallback((selectedDate) => {
    if (!selectedDate) {
      // Show all vehicles with zero load when no date selected
      const emptyVehicles = vehicles.map(vehicle => ({
        ...vehicle,
        simulatedLoad: 0,
        simulatedUtilization: 0,
        simulatedPOs: []
      }));
      setForecastingVehicles(emptyVehicles);
      return;
    }

    // Get all On-Hold POs with the selected delivery date
    const onHoldPOsForDate = pos.filter(po =>
      po.status === 'on-hold' && po.deliveryDate === selectedDate
    );

    // Create a copy of vehicles for simulation (all vehicles are available for forecasting)
    const simulationVehicles = vehicles.map(vehicle => ({
      ...vehicle,
      status: 'Available', // Assume all vehicles are available for forecasting
      currentLoad: 0,
      assignedPOs: [],
      simulatedLoad: 0,
      simulatedUtilization: 0,
      simulatedPOs: []
    }));

    if (onHoldPOsForDate.length === 0) {
      // No POs for this date, show all vehicles with zero load
      setForecastingVehicles(simulationVehicles);
      return;
    }

    // Sort POs by load size (largest first for better packing)
    const sortedPOs = [...onHoldPOsForDate].sort((a, b) => {
      const loadA = a.products.reduce((total, item) => {
        const product = products[item.product];
        if (!product) return total;
        let itemSize = 0;
        if (item.pricingType === 'perPackage') {
          const packaging = product.packaging;
          if (Array.isArray(packaging)) {
            const selectedPackaging = packaging.find(p => p.quantity === item.packageQuantity) || packaging[0];
            itemSize = selectedPackaging.size;
          } else {
            itemSize = packaging.size;
          }
        } else if (item.pricingType === 'perPiece') {
          itemSize = product.size;
        }
        return total + (item.quantity * itemSize);
      }, 0);

      const loadB = b.products.reduce((total, item) => {
        const product = products[item.product];
        if (!product) return total;
        let itemSize = 0;
        if (item.pricingType === 'perPackage') {
          const packaging = product.packaging;
          if (Array.isArray(packaging)) {
            const selectedPackaging = packaging.find(p => p.quantity === item.packageQuantity) || packaging[0];
            itemSize = selectedPackaging.size;
          } else {
            itemSize = packaging.size;
          }
        } else if (item.pricingType === 'perPiece') {
          itemSize = product.size;
        }
        return total + (item.quantity * itemSize);
      }, 0);

      return loadB - loadA;
    });

    // Simulate assignment using load balancing logic with clustering rules
    for (const po of sortedPOs) {
      const load = po.products.reduce((total, item) => {
        const product = products[item.product];
        if (!product) return total;
        let itemSize = 0;
        if (item.pricingType === 'perPackage') {
          const packaging = product.packaging;
          if (Array.isArray(packaging)) {
            const selectedPackaging = packaging.find(p => p.quantity === item.packageQuantity) || packaging[0];
            itemSize = selectedPackaging.size;
          } else {
            itemSize = packaging.size;
          }
        } else if (item.pricingType === 'perPiece') {
          itemSize = product.size;
        }
        return total + (item.quantity * itemSize);
      }, 0);

      // Get cluster for this PO
      const poCluster = po.cluster;

      // If PO has no cluster assigned, skip this PO (would go on hold in real assignment)
      if (!poCluster) {
        console.log(`PO ${po.customId} skipped in forecasting - no cluster assigned`);
        continue;
      }

          // Check clustering rule: vehicles can only serve one cluster per delivery date
          // Find available vehicles that either have no cluster assigned for this date, or match the PO's cluster
          const availableVehicles = simulationVehicles
            .filter(vehicle => {
              // Must have capacity
              if (vehicle.capacity < vehicle.simulatedLoad + load) return false;

              // Check cluster constraint: vehicle can only serve one cluster per date
              const vehicleClustersForDate = new Set();
              vehicle.simulatedPOs.forEach(assignedPO => {
                if (assignedPO.deliveryDate === selectedDate) {
                  const assignedCluster = assignedPO.cluster;
                  if (assignedCluster) vehicleClustersForDate.add(assignedCluster);
                }
              });

              // If vehicle has no POs for this date, it's available for any cluster
              if (vehicleClustersForDate.size === 0) return true;

              // If vehicle already has this cluster for this date, it's available
              if (vehicleClustersForDate.has(poCluster)) return true;

              // If vehicle has a different cluster for this date, it's not available
              return false;
            })
        .sort((a, b) => {
          // First sort by capacity (smallest first)
          if (a.capacity !== b.capacity) {
            return a.capacity - b.capacity;
          }
          // Then by lowest utilization
          return a.simulatedUtilization - b.simulatedUtilization;
        });

      if (availableVehicles.length > 0) {
        const selectedVehicle = availableVehicles[0]; // Choose the one with lowest utilization

        // Add PO to vehicle's simulated load
        selectedVehicle.simulatedLoad += load;
        selectedVehicle.simulatedPOs.push({
          ...po,
          simulatedLoad: load,
          simulatedCluster: poCluster
        });

        console.log(`Forecast: Assigned PO ${po.customId} to ${selectedVehicle.name} in cluster ${poCluster}`);
      } else {
        console.log(`Forecast: No available vehicle for PO ${po.customId} in cluster ${poCluster} - would go on hold`);
      }
    }

    // Calculate utilization for each vehicle
    simulationVehicles.forEach(vehicle => {
      vehicle.simulatedUtilization = (vehicle.simulatedLoad / vehicle.capacity) * 100;
    });

    setForecastingVehicles(simulationVehicles);
  }, [pos, vehicles]);

  // Handle forecasting date change
  const handleForecastingDateChange = useCallback((e) => {
    const selectedDate = e.target.value;
    setForecastingDate(selectedDate);
    simulateForecasting(selectedDate);
  }, [simulateForecasting]);

  // Auto-update forecasting when POs or vehicles change
  useEffect(() => {
    if (forecastingDate) {
      simulateForecasting(forecastingDate);
    }
  }, [pos, vehicles, forecastingDate, simulateForecasting]);

  useEffect(() => {
    const q = query(collection(db, 'pos'), orderBy('createdAt'));
    const unsubscribe = onSnapshot(
      q,
      (querySnapshot) => {
        const posData = [];
        querySnapshot.forEach((doc) => {
          posData.push({ id: doc.id, customId: doc.data().customId, ...doc.data() });
        });
        // Filter out completed POs from the main display (keep delivered for admin confirmation)
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
        setNotification({
          type: 'error',
          title: 'Loading Error',
          message: 'Failed to load POs. Please refresh the page.'
        });
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
      const reassignmentResult = assignVehicleAutomatically({
        ...po,
        assignedTruck: null // Clear current assignment
      });

      if (reassignmentResult === 'on-hold') {
        // PO goes on hold due to date-based balancing rules
        await updateDoc(doc(db, 'pos', po.id), {
          assignedTruck: null,
          status: 'on-hold',
          load: calculateLoad(po)
        });

        // Log the on-hold status
        await addDoc(collection(db, 'history'), {
          timestamp: new Date(),
          action: 'PO Placed On Hold (Driver Unavailable - Date Balancing)',
          details: `PO ${po.customId} placed on hold from ${vehicle.name} due to date-based balancing rules`
        });

        console.log(`PO ${po.customId} placed on hold from ${vehicle.name} due to date-based balancing rules`);
      } else if (reassignmentResult) {
        // Successfully reassigned to another vehicle
        await updateDoc(doc(db, 'pos', po.id), {
          assignedTruck: reassignmentResult,
          load: calculateLoad(po)
        });

        // Log the automatic reassignment
        await addDoc(collection(db, 'history'), {
          timestamp: new Date(),
          action: 'Auto-Reassigned PO (Driver Unavailable)',
          details: `PO ${po.customId} auto-reassigned from ${vehicle.name} to ${reassignmentResult} due to driver status change`
        });

        console.log(`Auto-reassigned PO ${po.customId} from ${vehicle.name} to ${reassignmentResult}`);
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

  const validatePhilippinePhoneNumber = (phoneNumber) => {
    if (!phoneNumber.trim()) return { isValid: true, error: '' }; // Optional field

    // Allow mobile and landline formats; keep only digits for length checks.
    const digitsOnly = phoneNumber.replace(/\D/g, '');

    // Typical PH mobile numbers are 10-12 digits depending on prefix;
    // landlines can be shorter (e.g., 7-9 digits) and may include area codes.
    if (digitsOnly.length >= 7 && digitsOnly.length <= 12) {
      return { isValid: true, error: '' };
    }

    return {
      isValid: false,
      error: 'Please enter a valid contact number (mobile or landline).'
    };
  };

  const validateDeliveryDate = (deliveryDate, orderDate) => {
    if (!deliveryDate) return { isValid: true, error: '' }; // Will be caught by required field validation

    const today = new Date().toISOString().split('T')[0]; // Get today's date as YYYY-MM-DD string

    // Check if delivery date is before today
    if (deliveryDate < today) {
      return {
        isValid: false,
        error: 'Delivery date cannot be in the past'
      };
    }

    // Check if delivery date is before order date
    if (orderDate && deliveryDate < orderDate) {
      return {
        isValid: false,
        error: 'Delivery date cannot be before the order date'
      };
    }

    return { isValid: true, error: '' };
  };

  // Update delivery min date when order date changes
  useEffect(() => {
    if (form.poDate) {
      const orderDate = new Date(form.poDate);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      // Allow same day delivery if order is placed today
      const minDate = orderDate >= today ? form.poDate : today.toISOString().split('T')[0];
      setDeliveryMinDate(minDate);
    } else {
      setDeliveryMinDate(new Date().toISOString().split('T')[0]);
    }
  }, [form.poDate]);

  // Update edit delivery min date when order date changes
  useEffect(() => {
    if (editForm.poDate) {
      const orderDate = new Date(editForm.poDate);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const minDate = orderDate >= today ? editForm.poDate : today.toISOString().split('T')[0];
      setEditDeliveryMinDate(minDate);
    } else {
      setEditDeliveryMinDate(new Date().toISOString().split('T')[0]);
    }
  }, [editForm.poDate]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    if (name === 'phone') {
      // Validate phone number
      const validation = validatePhilippinePhoneNumber(value);
      setPhoneError(validation.error);
      setForm({ ...form, [name]: value });
    } else if (name === 'deliveryDate') {
      // Validate delivery date
      const validation = validateDeliveryDate(value, form.poDate);
      setDeliveryDateError(validation.error);
      setForm({ ...form, [name]: value });
    } else if (name === 'poDate') {
      // When order date changes, re-validate delivery date
      setForm({ ...form, [name]: value });
      if (form.deliveryDate) {
        const validation = validateDeliveryDate(form.deliveryDate, value);
        setDeliveryDateError(validation.error);
      }
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
        // Use individual piece volume
        itemSize = product.size;
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
        // Use custom price if available, otherwise use default
        price = item.customPrice ?? product.pricing.perPiece.price;
      } else if (item.pricingType === 'perPackage') {
        if (Array.isArray(product.pricing.perPackage)) {
          // For Jumbo Roll with multiple packaging options
          const selectedPackage = product.pricing.perPackage.find(p => p.quantity === item.packageQuantity);
          price = item.customPrice ?? (selectedPackage ? selectedPackage.price : product.pricing.perPackage[0].price);
        } else {
          price = item.customPrice ?? product.pricing.perPackage.price;
        }
      }

      return total + (item.quantity * price);
    }, 0);
  }, []);

  // Keep Add-PO subtotal in sync when user changes a custom price after a line item is already added.
  // (Previously, we only stored the custom price in `customPrices` but didn't update the corresponding
  // `form.products[*].customPrice`, so subtotal would only change once when the item was first added.)
  const applyCustomPriceToExistingLineItem = useCallback(
    (productName, pricingType, packageQuantity, nextCustomPrice) => {
      setForm((prevForm) => {
        const updatedProducts = (prevForm.products || []).map((item) => {
          if (item.product !== productName) return item;
          if (item.pricingType !== pricingType) return item;

          if (pricingType === 'perPackage') {
            const itemPkgQty = item.packageQuantity ?? null;
            const targetPkgQty = packageQuantity ?? null;
            if (itemPkgQty !== targetPkgQty) return item;
          }

          return {
            ...item,
            // Undefined means “use default price”
            customPrice: nextCustomPrice
          };
        });

        const subtotal = calculateTotalPrice(updatedProducts);
        return {
          ...prevForm,
          products: updatedProducts,
          totalPrice: subtotal
        };
      });
    },
    [calculateTotalPrice]
  );

  // Helper for inputs: return `undefined` when empty so we fall back to default pricing,
  // and a number when provided (including 0).
  const parseCustomPriceInput = useCallback((raw) => {
    const trimmed = String(raw ?? '').trim();
    if (trimmed === '') return undefined;
    const n = Number(trimmed);
    return Number.isFinite(n) ? n : undefined;
  }, []);

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
          const c = assignedPO.cluster;
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
    const clusterName = po.cluster;

    // If PO has no cluster assigned, no vehicles are eligible
    if (!clusterName) {
      return [];
    }

    // Filter by availability, capacity for the PO's date, and driver status
    // Since clusters are now just groupings, we only check capacity and dates
    const eligibleVehicles = vehicles.filter(v => {
      const usedForDate = getUsedLoadForVehicleOnDate(v, po.deliveryDate);
      const hasCapacity = (v.capacity - usedForDate) >= load;
      // Check driver status - vehicle is only available if driver status is 'Available'
      const driverAvailable = v.status === 'Available';
      return v.ready && hasCapacity && driverAvailable;
    });

    if (eligibleVehicles.length === 0) return [];

    // Enhanced ranking algorithm for optimal load distribution
    const scored = eligibleVehicles.map(v => {
      const usedForDate = getUsedLoadForVehicleOnDate(v, po.deliveryDate);
      const remainingCapacity = v.capacity - usedForDate;
      const utilizationAfter = (usedForDate + load) / v.capacity;

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

      // Total score combines load and size efficiency (no cluster restrictions)
      const totalScore = loadEfficiency + sizeEfficiency;

      return {
        vehicle: v,
        totalScore,
        utilizationAfter,
        remainingCapacity,
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
    const clusterName = po.cluster;

    // If PO has no cluster assigned, cannot assign
    if (!clusterName) {
      console.log(`PO ${po.customId} cannot be assigned - no cluster assigned`);
      return null;
    }

    // Note: Date restrictions are now handled by the rebalance logic when needed.
    // Individual assignments can go to any valid date as long as clustering rules are followed.

    const load = calculateLoad(po);

    // Find eligible vehicles following the same rules as rebalance loads
    const eligibleVehicles = vehicles.filter(v => {
      // Check driver availability
      if (v.status !== 'Available') return false;

      // Rule 5: Dimension Compliance - check if PO dimensions fit in vehicle
      const products = {
        'Interfolded': {
          packaging: { size: 70780.5 },
          dimensions: { length: 535, width: 315, height: 420 } // mm per case (53.5 x 31.5 x 42 cm)
        },
        'Jumbo Roll': {
          packaging: [
            { size: 39016.5, dimensions: { length: 370, width: 285, height: 370 } }, // 12 rolls case (37 × 28.5 × 37 cm)
            { size: 90956.25, dimensions: { length: 495, width: 375, height: 490 } }  // 16 rolls case (49.5 × 37.5 × 49 cm)
          ],
          dimensions: { length: 400, width: 300, height: 200 } // mm per roll (estimated)
        },
        'Bathroom': {
          packaging: { size: 45630, dimensions: { length: 585, width: 390, height: 200 } }, // mm per case (58.5 x 39 x 20 cm)
          dimensions: { length: 250, width: 180, height: 120 } // mm per bundle (estimated)
        },
        'Hand Roll': {
          packaging: { size: 46200, dimensions: { length: 550, width: 400, height: 210 } }, // mm per case (55 x 40 x 21 cm)
          dimensions: { length: 200, width: 150, height: 100 } // mm per bundle (estimated)
        }
      };

      // Calculate maximum dimensions needed for this PO
      let maxLength = 0, maxWidth = 0, maxHeight = 0;

      for (const item of po.products) {
        const product = products[item.product];
        if (!product) continue;

        let dimensions = null;
        if (item.pricingType === 'perPackage') {
          if (Array.isArray(product.packaging)) {
            const selectedPackaging = product.packaging.find(p => p.quantity === item.packageQuantity) || product.packaging[0];
            dimensions = selectedPackaging.dimensions;
          } else {
            dimensions = product.packaging.dimensions;
          }
        } else if (item.pricingType === 'perPiece') {
          dimensions = product.dimensions;
        }

        if (dimensions) {
          maxLength = Math.max(maxLength, dimensions.length);
          maxWidth = Math.max(maxWidth, dimensions.width);
          maxHeight = Math.max(maxHeight, dimensions.height);
        }
      }

      // Check if PO fits in vehicle dimensions
      if (maxLength > v.dimensions.length ||
          maxWidth > v.dimensions.width ||
          maxHeight > v.dimensions.height) {
        return false;
      }

      // Get all POs currently assigned to this vehicle
      const assignedPOs = v.assignedPOs.map(poId => pos.find(p => p.id === poId)).filter(Boolean);

      if (assignedPOs.length === 0) {
        // Empty vehicle - can assign any PO as long as capacity allows
        return load <= v.capacity;
      }

      // Rule 4: Strict Delivery Date Consistency - if delivery dates don't match, cannot assign
      // EVEN IF SAME CLUSTER - delivery dates must be identical
      const vehicleDeliveryDate = assignedPOs[0].deliveryDate;
      if (po.deliveryDate !== vehicleDeliveryDate) {
        return false;
      }

      // Rule 2: Cluster Matching - all POs in vehicle must be from same cluster
      const vehicleCluster = assignedPOs[0].cluster;
      const clusterMismatch = assignedPOs.some(assignedPO => assignedPO.cluster !== vehicleCluster);

      if (clusterMismatch) {
        return false;
      }

      // Rule 2: New PO must match the vehicle's cluster
      if (clusterName !== vehicleCluster) {
        return false;
      }

      // Rule 3: Capacity Restriction - check if adding this PO would exceed capacity
      const currentLoad = assignedPOs.reduce((total, assignedPO) => total + calculateLoad(assignedPO), 0);
      return (currentLoad + load) <= v.capacity;
    });

    if (eligibleVehicles.length === 0) return null;

    // Select the best vehicle using the same scoring logic as rebalance loads, but prioritize smaller vehicles first
    const scoredVehicles = eligibleVehicles
      .sort((a, b) => a.capacity - b.capacity) // Sort by capacity ascending (smallest first)
      .map(v => {
        // Get all POs currently assigned to this vehicle
        const assignedPOs = v.assignedPOs.map(poId => pos.find(p => p.id === poId)).filter(Boolean);
        const currentLoad = assignedPOs.reduce((total, assignedPO) => total + calculateLoad(assignedPO), 0);
        const remainingCapacity = v.capacity - currentLoad;
        const utilizationAfter = (currentLoad + load) / v.capacity;

        // Since clusters are now simple groupings without geographic restrictions,
        // we don't need to check for already serving cluster combinations
        const alreadyServingCluster = 0;

        // Prefer good utilization (70-90%)
        let utilizationScore = 0;
        if (utilizationAfter >= 0.7 && utilizationAfter <= 0.9) {
          utilizationScore = 5;
        } else if (utilizationAfter >= 0.5 && utilizationAfter < 0.7) {
          utilizationScore = 3;
        } else if (utilizationAfter > 0.9 && utilizationAfter <= 0.95) {
          utilizationScore = 2;
        } else if (utilizationAfter < 0.5) {
          utilizationScore = 1;
        }

        return {
          vehicle: v,
          score: alreadyServingCluster + utilizationScore,
          utilizationAfter
        };
      });

    // Sort by score (highest first), but maintain capacity order for equal scores
    scoredVehicles.sort((a, b) => {
      if (b.score !== a.score) {
        return b.score - a.score;
      }
      // If scores are equal, prefer smaller vehicles
      return a.vehicle.capacity - b.vehicle.capacity;
    });

    const chosen = scoredVehicles[0].vehicle;

    console.log(`Auto-assigning PO ${po.customId} to ${chosen.name}:`, {
      load,
      cluster: clusterName,
      score: scoredVehicles[0].score,
      utilizationAfter: (scoredVehicles[0].utilizationAfter * 100).toFixed(1) + '%'
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
  }, [vehicles, pos, calculateLoad, getUsedLoadForVehicleOnDate, updateVehicle]);

  const handleEditInputChange = (e) => {
    const { name, value } = e.target;

    if (name === 'phone') {
      const validation = validatePhilippinePhoneNumber(value);
      setEditPhoneError(validation.error);
      setEditForm((prev) => ({ ...prev, phone: value }));
      return;
    }

    if (name === 'deliveryDate') {
      const validation = validateDeliveryDate(value, editForm.poDate);
      setEditDeliveryDateError(validation.error);
      setEditForm((prev) => ({ ...prev, deliveryDate: value }));
      return;
    }

    if (name === 'poDate') {
      setEditForm((prev) => ({ ...prev, poDate: value }));
      if (editForm.deliveryDate) {
        const validation = validateDeliveryDate(editForm.deliveryDate, value);
        setEditDeliveryDateError(validation.error);
      }
      return;
    }

    setEditForm((prev) => ({ ...prev, [name]: value }));
  };

  // Keep Edit-PO subtotal in sync when user changes a custom price after a line item is already present.
  const applyCustomPriceToExistingEditLineItem = useCallback(
    (productName, pricingType, packageQuantity, nextCustomPrice) => {
      setEditForm((prevForm) => {
        const updatedProducts = (prevForm.products || []).map((item) => {
          if (item.product !== productName) return item;
          if (item.pricingType !== pricingType) return item;

          if (pricingType === 'perPackage') {
            const itemPkgQty = item.packageQuantity ?? null;
            const targetPkgQty = packageQuantity ?? null;
            if (itemPkgQty !== targetPkgQty) return item;
          }

          return {
            ...item,
            customPrice: nextCustomPrice
          };
        });

        const subtotal = calculateTotalPrice(updatedProducts);
        return {
          ...prevForm,
          products: updatedProducts,
          totalPrice: subtotal
        };
      });
    },
    [calculateTotalPrice]
  );

  const getDefaultPriceForLineItem = useCallback((item) => {
    const product = products[item.product];
    if (!product) return 0;

    if (item.pricingType === 'perPiece') {
      return product.pricing.perPiece.price;
    }

    if (item.pricingType === 'perPackage') {
      if (Array.isArray(product.pricing.perPackage)) {
        const selectedPackage = product.pricing.perPackage.find(p => p.quantity === item.packageQuantity);
        return selectedPackage ? selectedPackage.price : product.pricing.perPackage[0].price;
      }
      return product.pricing.perPackage.price;
    }

    return 0;
  }, []);

  const buildCustomPriceMapFromLineItems = useCallback((lineItems) => {
    const map = {};
    (lineItems || []).forEach((item) => {
      const productName = item.product;
      if (!productName || !item.pricingType) return;

      const defaultPrice = getDefaultPriceForLineItem(item);
      const customPrice = typeof item.customPrice === 'number' ? item.customPrice : undefined;
      if (customPrice === undefined) return;

      // Only treat it as a “custom” price if it differs from default.
      if (customPrice === defaultPrice) return;

      if (item.pricingType === 'perPiece') {
        map[`${productName}_perPiece`] = customPrice;
        return;
      }

      if (item.pricingType === 'perPackage') {
        const product = products[productName];
        if (Array.isArray(product?.pricing?.perPackage)) {
          map[`${productName}_perPackage_${item.packageQuantity}`] = customPrice;
        } else {
          map[`${productName}_perPackage`] = customPrice;
        }
      }
    });

    return map;
  }, [getDefaultPriceForLineItem]);

  const handleSaveUpdate = async () => {
    if (editPhoneError || editDeliveryDateError) {
      setNotification({
        type: 'error',
        title: 'Invalid Information',
        message: editPhoneError || editDeliveryDateError,
        showCloseButton: true
      });
      return;
    }

    if (!editForm.poNumber || !editForm.companyName || !editForm.poDate || !editForm.address || !editForm.contact || !editForm.phone || !editForm.cluster || editForm.products.length === 0 || editForm.products.some(p => !p.product || p.quantity <= 0 || !p.pricingType)) {
      setNotification({
        type: 'error',
        title: 'Missing Information',
        message: 'Please fill all required fields with valid data.',
        showCloseButton: true
      });
      return;
    }

    // Check for duplicate PO number (excluding current PO)
    if (editForm.poNumber.trim()) {
      const poQuery = query(collection(db, 'pos'), where('customId', '==', editForm.poNumber.trim()));
      const poSnapshot = await getDocs(poQuery);
      const existingPOs = poSnapshot.docs.filter(doc => doc.id !== selectedPO.id);
      if (existingPOs.length > 0) {
        setNotification({
          type: 'error',
          title: 'Duplicate PO Number',
          message: `PO number "${editForm.poNumber}" already exists. Please enter a unique PO number.`,
          showCloseButton: true
        });
        return;
      }
    }

    setEditLoading(true);
    try {
      if (!selectedPO || !selectedPO.id) {
        setNotification({
          type: 'error',
          title: 'Update failed',
          message: 'No purchase order selected for update.'
        });
        return;
      }

      // Explicit mapping of editable fields to avoid accidental keys
      const updatedPO = {
        customId: editForm.poNumber,
        companyName: editForm.companyName,
        poDate: editForm.poDate,
        cluster: editForm.cluster || '',
        location: editForm.location || '',
        deliveryDate: editForm.deliveryDate || '',
        products: editForm.products || [],
        totalPrice: editForm.totalPrice || 0,
        address: editForm.address || '',
        contact: editForm.contact || '',
        phone: editForm.phone || '',
        currency: editForm.currency || 'PHP',
        termsOfPayment: editForm.termsOfPayment || '',
        includeTax: !!editForm.includeTax,
        includeEwt: !!editForm.includeEwt,
        status: editForm.status || 'pending',
        load: calculateLoad(editForm),
        updatedAt: new Date()
      };

      console.log('Updating PO:', selectedPO.id, updatedPO);

      await updateDoc(doc(db, 'pos', selectedPO.id), updatedPO);

      // Log the update
      await addDoc(collection(db, 'history'), {
        timestamp: new Date(),
        action: 'Updated PO',
        details: `PO ${selectedPO.customId} was updated`
      });

      // After PO update, enforce system-wide date rules using rebalance
      try {
        const posQuery = query(collection(db, 'pos'), orderBy('createdAt'));
        const querySnapshot = await getDocs(posQuery);
        const allPOs = [];
        querySnapshot.forEach((doc) => {
          allPOs.push({ id: doc.id, customId: doc.data().customId, ...doc.data() });
        });

        const rebalanceResult = await rebalanceLoads(allPOs);
        console.log('Auto-rebalance after PO update:', rebalanceResult);
      } catch (rebalanceError) {
        console.error('Auto-rebalance failed after PO update:', rebalanceError);
        // Don't fail the PO update if rebalancing fails
      }

      setIsEditing(false);
      setShowModal(false);
      setNotification({
        type: 'success',
        title: 'PO Updated',
        message: 'PO updated successfully! Load rebalancing has been performed.',
        autoClose: true,
        autoCloseDelay: 3000,
        showCloseButton: false
      });
    } catch (error) {
      console.error('Error updating PO:', error);
      setNotification({
        type: 'error',
        title: 'Update Failed',
        message: `Failed to update PO. ${error?.message || ''}`
      });
    } finally {
      setEditLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    // When called from POFormModal we won't receive a native submit event.
    if (e?.preventDefault) e.preventDefault();

    // Check for duplicate PO number
    if (form.poNumber.trim()) {
      const poQuery = query(collection(db, 'pos'), where('customId', '==', form.poNumber.trim()));
      const poSnapshot = await getDocs(poQuery);
      if (!poSnapshot.empty) {
        setNotification({
          type: 'error',
          title: 'Duplicate PO Number',
          message: `PO number "${form.poNumber}" already exists. Please enter a unique PO number.`,
          showCloseButton: true
        });
        return;
      }
    }

    // Validate phone number if provided
    if (form.phone.trim()) {
      const phoneValidation = validatePhilippinePhoneNumber(form.phone);
      if (!phoneValidation.isValid) {
        setNotification({
          type: 'error',
          title: 'Invalid Phone Number',
          message: phoneValidation.error,
          showCloseButton: true
        });
        return;
      }
    }

    // Validate delivery date
    const deliveryValidation = validateDeliveryDate(form.deliveryDate, form.poDate);
    if (!deliveryValidation.isValid) {
      setNotification({
        type: 'error',
        title: 'Invalid Delivery Date',
        message: deliveryValidation.error,
        showCloseButton: true
      });
      return;
    }

    if (!form.poNumber || !form.companyName || !form.poDate || !form.address || !form.contact || !form.phone || form.products.length === 0 || form.products.some(p => !p.product || p.quantity <= 0 || !p.pricingType)) {
      setNotification({
        type: 'error',
        title: 'Missing Information',
        message: 'Please fill all required fields with valid data.',
        showCloseButton: true
      });
      return;
    }

    // Check for optimization opportunities
    const optimizationSuggestions = [];
    form.products.forEach((item, index) => {
      if (item.pricingType === 'perPiece') {
        const product = products[item.product];
        if (product && item.quantity > 0) {
          let canOptimize = false;
          let suggestion = '';

          // Check for single case products
          if (!Array.isArray(product.packaging) && product.packaging.quantity) {
            const caseSize = product.packaging.quantity;
            const fullCases = Math.floor(item.quantity / caseSize);
            const remainingPieces = item.quantity % caseSize;

            if (fullCases > 0) {
              canOptimize = true;
              suggestion = `${fullCases} case${fullCases > 1 ? 's' : ''} (${fullCases * caseSize} pieces)${remainingPieces > 0 ? ` + ${remainingPieces} individual piece${remainingPieces > 1 ? 's' : ''}` : ''}`;
            }
          }
          // Check for multiple case products
          else if (Array.isArray(product.packaging)) {
            const sortedCases = product.packaging.sort((a, b) => b.quantity - a.quantity);
            let remainingQuantity = item.quantity;
            let totalCases = 0;

            for (const caseOption of sortedCases) {
              if (remainingQuantity >= caseOption.quantity) {
                const cases = Math.floor(remainingQuantity / caseOption.quantity);
                if (cases > 0) {
                  totalCases += cases;
                  remainingQuantity -= cases * caseOption.quantity;
                }
              }
            }

            if (totalCases > 0) {
              canOptimize = true;
              suggestion = `${totalCases} case${totalCases > 1 ? 's' : ''} (${item.quantity - remainingQuantity} pieces)${remainingQuantity > 0 ? ` + ${remainingQuantity} individual piece${remainingQuantity > 1 ? 's' : ''}` : ''}`;
            }
          }

          if (canOptimize) {
            optimizationSuggestions.push({
              product: item.product,
              current: `${item.quantity} individual ${product.pricing.perPiece.unit}s`,
              suggested: suggestion,
              index: index
            });
          }
        }
      }
    });

    // Show optimization confirmation if there are suggestions
    if (optimizationSuggestions.length > 0) {
      const suggestionsText = optimizationSuggestions.map(s =>
        `${s.product}: ${s.current} → ${s.suggested}`
      ).join('\n');

      const confirmOptimization = window.confirm(
        `We found optimization opportunities for better pricing:\n\n${suggestionsText}\n\nWould you like to apply these optimizations?`
      );

      if (confirmOptimization) {
        // Apply optimizations
        let optimizedProducts = [...form.products];

        optimizationSuggestions.forEach(suggestion => {
          const item = form.products[suggestion.index];
          const product = products[item.product];
          const index = suggestion.index;

          // Remove the original item
          optimizedProducts.splice(index, 1);

          // Add optimized entries
          if (!Array.isArray(product.packaging) && product.packaging.quantity) {
            const caseSize = product.packaging.quantity;
            const fullCases = Math.floor(item.quantity / caseSize);
            const remainingPieces = item.quantity % caseSize;

            if (fullCases > 0) {
              optimizedProducts.push({
                product: item.product,
                quantity: fullCases,
                pricingType: 'perPackage',
                packageQuantity: caseSize
              });
            }

            if (remainingPieces > 0) {
              optimizedProducts.push({
                product: item.product,
                quantity: remainingPieces,
                pricingType: 'perPiece',
                packageQuantity: null
              });
            }
          } else if (Array.isArray(product.packaging)) {
            const sortedCases = product.packaging.sort((a, b) => b.quantity - a.quantity);
            let remainingQuantity = item.quantity;

            for (const caseOption of sortedCases) {
              if (remainingQuantity >= caseOption.quantity) {
                const cases = Math.floor(remainingQuantity / caseOption.quantity);
                if (cases > 0) {
                  optimizedProducts.push({
                    product: item.product,
                    quantity: cases,
                    pricingType: 'perPackage',
                    packageQuantity: caseOption.quantity
                  });
                  remainingQuantity -= cases * caseOption.quantity;
                }
              }
            }

            if (remainingQuantity > 0) {
              optimizedProducts.push({
                product: item.product,
                quantity: remainingQuantity,
                pricingType: 'perPiece',
                packageQuantity: null
              });
            }
          }
        });

        // Update form with optimized products immediately so user sees the changes
        const subtotal = calculateTotalPrice(optimizedProducts);
        setForm({ ...form, products: optimizedProducts, totalPrice: subtotal });

        // Continue with PO creation using the optimized products
        const newPO = {
          customId: form.poNumber,
          ...form,
          products: optimizedProducts,
          totalPrice: subtotal,
          createdAt: new Date()
        };

        // Continue with the rest of the submission logic...
        setLoading(true);
        try {
          // Persist computed load so vehicle load can be reconstructed reliably after refresh
          newPO.load = calculateLoad(newPO);

          // Hard guard: if the order exceeds the capacity of every vehicle, stop and show an error
          const maxCapacity = Math.max(...vehicles.map(v => v.capacity));
          if (newPO.load > maxCapacity) {
            setNotification({
              type: 'error',
              title: 'Order Too Large',
              message: 'This order exceeds the maximum load capacity of any available vehicle. Please split the order into multiple POs.'
            });
            return;
          }
   


          const docRef = await addDoc(collection(db, 'pos'), newPO);
          const poId = docRef.id;

      // Determine status based on delivery date logic
      // The system now follows the earliest delivery date rule among all POs (including the new PO),
      // not the current real-time date. If the new PO's delivery date is the earliest date overall,
      // it will be eligible for automatic assignment. Otherwise it remains pending.
      let initialStatus = 'pending';
      let shouldAssign = false;

      if (!newPO.deliveryDate) {
        // No delivery date → on-hold
        initialStatus = 'on-hold';
        shouldAssign = false;
      } else {
        // Collect existing delivery dates (exclude completed POs)
        const existingDeliveryDates = new Set();
        pos.forEach(po => {
          if (po.deliveryDate && po.status !== 'completed') {
            existingDeliveryDates.add(po.deliveryDate);
          }
        });

        // Include the new PO's delivery date when determining the earliest date
        existingDeliveryDates.add(newPO.deliveryDate);

        // Find earliest date among existing dates + new PO
        const sortedDates = Array.from(existingDeliveryDates).sort();
        const earliestDate = sortedDates.length > 0 ? sortedDates[0] : null;

        // If this PO's delivery date is the earliest overall → try to assign
        if (newPO.deliveryDate && newPO.deliveryDate === earliestDate) {
          shouldAssign = true;
          initialStatus = 'pending'; // Will be set to 'assigned' if assignment succeeds
        } else {
          // Has delivery date but not the earliest among overall POs → pending, don't assign
          shouldAssign = false;
          initialStatus = 'pending';
        }
      }

      // Set initial status
      newPO.status = initialStatus;

      // Set initial status in Firestore
      await updateDoc(docRef, { status: initialStatus, load: newPO.load });

      // Automate assignment based on the logic above
      if (shouldAssign) {
        const assignmentResult = assignVehicleAutomatically({ ...newPO, id: poId });
        if (assignmentResult === 'on-hold') {
          // PO goes on hold due to date-based balancing rules
          await updateDoc(docRef, { status: 'on-hold' });
          newPO.status = 'on-hold';

          // Log on-hold status
          await addDoc(collection(db, 'history'), {
            timestamp: new Date(),
            action: 'PO Placed On Hold (Date Balancing)',
            details: `PO ${newPO.customId} placed on hold due to date-based balancing rules`
          });
        } else if (assignmentResult) {
          // Successfully assigned to a vehicle
          // Keep Firestore field naming as 'assignedTruck' for backward compatibility
          // Also persist computed load so vehicle loads can be reconstructed after refresh
          await updateDoc(docRef, { assignedTruck: assignmentResult, status: 'assigned' });
          newPO.assignedTruck = assignmentResult;
          newPO.status = 'assigned';

          // assignedPOs and currentLoad already updated via VehicleContext.assignLoad

          // Log assignment
          await addDoc(collection(db, 'history'), {
            timestamp: new Date(),
            action: 'Auto-Assigned PO to Vehicle',
            details: `PO ${newPO.customId} auto-assigned to ${assignmentResult}`
          });

          // After successful assignment, enforce system-wide date rules using rebalance
          try {
            const posQuery = query(collection(db, 'pos'), orderBy('createdAt'));
            const querySnapshot = await getDocs(posQuery);
            const allPOs = [];
            querySnapshot.forEach((doc) => {
              allPOs.push({ id: doc.id, customId: doc.data().customId, ...doc.data() });
            });

            const rebalanceResult = await rebalanceLoads(allPOs);
            console.log('Auto-rebalance after PO assignment:', rebalanceResult);
          } catch (rebalanceError) {
            console.error('Auto-rebalance failed after PO assignment:', rebalanceError);
            // Don't fail the PO creation if rebalancing fails
          }
        } else {
          // Set status to on-hold when no vehicle is available
          await updateDoc(docRef, { status: 'on-hold' });
          newPO.status = 'on-hold';

          // Check if the issue is driver status or capacity availability
          const clusterName = newPO.cluster;
          const allVehiclesForDate = vehicles.filter(v => {
            const usedForDate = getUsedLoadForVehicleOnDate(v, newPO.deliveryDate);
            const hasCapacity = (v.capacity - usedForDate) >= newPO.load;
            return v.ready && hasCapacity;
          });

          const unavailableDrivers = allVehiclesForDate.filter(v => v.status !== 'Available');
          const availableVehicles = allVehiclesForDate.filter(v => v.status === 'Available');

          if (unavailableDrivers.length > 0 && availableVehicles.length === 0) {
            setNotification({
              type: 'warning',
              title: 'PO Placed On Hold',
              message: `No suitable vehicles available. All vehicles have drivers with unavailable status: ${unavailableDrivers.map(v => `${v.name} (${v.status})`).join(', ')}. Please update driver statuses to "Available" or wait for drivers to become available. The PO has been placed on hold for now.`
            });
          } else if (availableVehicles.length === 0) {
            setNotification({
              type: 'warning',
              title: 'PO Placed On Hold',
              message: `No suitable vehicles available for this delivery date. Vehicles may be at capacity. The PO has been placed on hold and will be available for assignment when suitable vehicles become available.`
            });
          } else {
            setNotification({
              type: 'warning',
              title: 'PO Placed On Hold',
              message: 'No suitable vehicle is available for this PO at this time. The PO has been placed on hold and will be automatically assigned when a suitable vehicle becomes available.'
            });
          }

          // Log on-hold status
          await addDoc(collection(db, 'history'), {
            timestamp: new Date(),
            action: 'PO Placed On Hold',
            details: `PO ${newPO.customId} placed on hold - no available vehicles`
          });
        }
      } else {
        // Don't attempt assignment for POs with delivery dates that are not the earliest
        // Status is already set to 'pending' or 'on-hold' based on delivery date presence
        newPO.status = initialStatus;
      }

          setForm({
            poNumber: '',
            companyName: '',
            poDate: '',
            cluster: '',
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
            details: `PO ${newPO.customId}: Company: ${newPO.companyName}, Date: ${newPO.poDate}, Delivery: ${newPO.deliveryDate}, Products: ${productsStr}, Total: ${newPO.totalPrice}`
          });
        } catch (error) {
          console.error('Error adding PO:', error);
          setNotification({
            type: 'error',
            title: 'Failed to Add PO',
            message: 'Failed to add PO. Please check your connection and try again.',
            showCloseButton: true
          });
        } finally {
          setLoading(false);
        }
        return; // Exit early since we've handled the optimized submission
      }
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
        setNotification({
          type: 'error',
          title: 'Order Too Large',
          message: 'This order exceeds the maximum load capacity of any available vehicle. Please split the order into multiple POs.',
          showCloseButton: true
        });
        return;
      }

      const docRef = await addDoc(collection(db, 'pos'), newPO);
      const poId = docRef.id;

      // Determine earliest date among existing POs including this new PO, and only attempt assignment
      // if this PO's delivery date is the earliest overall. This makes the system follow the
      // earliest-date rule (not real-time) described in the requirements.
      let assignmentResult = null;
      if (!newPO.deliveryDate) {
        // No delivery date → on-hold
        await updateDoc(docRef, { status: 'on-hold', load: newPO.load });
        newPO.status = 'on-hold';
      } else {
        const existingDeliveryDates = new Set();
        pos.forEach(po => {
          if (po.deliveryDate && po.status !== 'completed') {
            existingDeliveryDates.add(po.deliveryDate);
          }
        });
        existingDeliveryDates.add(newPO.deliveryDate);
        const sortedDates = Array.from(existingDeliveryDates).sort();
        const earliestDate = sortedDates.length > 0 ? sortedDates[0] : null;

        if (newPO.deliveryDate === earliestDate) {
          // Eligible for assignment
          assignmentResult = assignVehicleAutomatically({ ...newPO, id: poId });
        } else {
          // Not the earliest date → remain pending
          assignmentResult = null;
        }
      }
      if (assignmentResult === 'on-hold') {
        // PO goes on hold due to date-based balancing rules
        await updateDoc(docRef, { status: 'on-hold', load: newPO.load });
        newPO.status = 'on-hold';

        // Log on-hold status
        await addDoc(collection(db, 'history'), {
          timestamp: new Date(),
          action: 'PO Placed On Hold (Date Balancing)',
          details: `PO ${newPO.customId} placed on hold due to date-based balancing rules`
        });
      } else if (assignmentResult) {
        // Successfully assigned to a vehicle
        // Keep Firestore field naming as 'assignedTruck' for backward compatibility
        // Also persist computed load so vehicle loads can be reconstructed after refresh
        await updateDoc(docRef, { assignedTruck: assignmentResult, load: newPO.load, status: 'assigned' });
        newPO.assignedTruck = assignmentResult;
        newPO.status = 'assigned';

        // assignedPOs and currentLoad already updated via VehicleContext.assignLoad

        // Log assignment
        await addDoc(collection(db, 'history'), {
          timestamp: new Date(),
          action: 'Auto-Assigned PO to Vehicle',
          details: `PO ${newPO.customId} auto-assigned to ${assignmentResult}`
        });
      } else {
        // Set status to on-hold when no vehicle is available
        await updateDoc(docRef, { status: 'on-hold', load: newPO.load });
        newPO.status = 'on-hold';

        // Check if the issue is driver status or capacity availability
        const clusterName = newPO.cluster;
        const allVehiclesForDate = vehicles.filter(v => {
          const usedForDate = getUsedLoadForVehicleOnDate(v, newPO.deliveryDate);
          const hasCapacity = (v.capacity - usedForDate) >= newPO.load;
          return v.ready && hasCapacity;
        });

        const unavailableDrivers = allVehiclesForDate.filter(v => v.status !== 'Available');
        const availableVehicles = allVehiclesForDate.filter(v => v.status === 'Available');

        if (unavailableDrivers.length > 0 && availableVehicles.length === 0) {
          setNotification({
            type: 'warning',
            title: 'PO Placed On Hold',
            message: `No suitable vehicles available in cluster ${clusterName}. All vehicles have drivers with status: ${unavailableDrivers.map(v => `${v.name} (${v.status})`).join(', ')}. Please check driver statuses or wait for drivers to become available. PO has been placed on hold.`,
            showCloseButton: true
          });
        } else if (availableVehicles.length === 0) {
          setNotification({
            type: 'warning',
            title: 'PO Placed On Hold',
            message: `No suitable vehicles available in cluster ${clusterName} for this PO on the selected delivery date. Vehicles may be full or restricted to another cluster. PO has been placed on hold.`,
            showCloseButton: true
          });
        } else {
          setNotification({
            type: 'warning',
            title: 'PO Placed On Hold',
            message: 'No suitable vehicle available for this PO. PO has been placed on hold.',
            showCloseButton: true
          });
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
        poDate: '',
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
        details: `PO ${newPO.customId}: Company: ${newPO.companyName}, Date: ${newPO.poDate}, Location: ${newPO.location}, Delivery: ${newPO.deliveryDate}, Products: ${productsStr}, Total: ${newPO.totalPrice}`
      });

      // Show notification for new PO creation
      setNotification({
        type: 'success',
        title: 'Purchase Order Created',
        message: `PO ${newPO.customId} has been successfully created and ${newPO.status === 'assigned' ? `automatically assigned to ${newPO.assignedTruck}` : newPO.status === 'on-hold' ? 'placed on hold due to scheduling rules' : 'placed on hold pending vehicle assignment'}. You can monitor its progress in the PO list.`,
        autoClose: true,
        autoCloseDelay: 5000,
        showCloseButton: false
      });
    } catch (error) {
      console.error('Error adding PO:', error);
      setNotification({
        type: 'error',
        title: 'Failed to Add PO',
        message: 'Failed to add PO. Please check your connection and try again.',
        showCloseButton: true
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCardClick = (po) => {
    setSelectedPO(po);
    setIsEditing(false);
    setShowModal(true);
  };

  const handleUpdate = async () => {
    const normalizedProducts = (selectedPO.products || []).map((item) => {
      const product = products[item.product];
      if (item.pricingType === 'perPackage') {
        const fallbackQty = Array.isArray(product?.packaging)
          ? product.packaging[0].quantity
          : product?.packaging?.quantity;
        return {
          ...item,
          packageQuantity: item.packageQuantity ?? fallbackQty ?? null
        };
      }
      if (item.pricingType === 'perPiece') {
        return {
          ...item,
          packageQuantity: null
        };
      }
      return item;
    });

    const subtotal = calculateTotalPrice(normalizedProducts);

    // Initialize edit form with current PO data
    setEditForm({
      poNumber: selectedPO.customId,
      companyName: selectedPO.companyName,
      poDate: selectedPO.poDate,
      cluster: selectedPO.cluster || '',
      location: selectedPO.location,
      deliveryDate: selectedPO.deliveryDate,
      products: normalizedProducts,
      totalPrice: subtotal,
      address: selectedPO.address || '',
      contact: selectedPO.contact || '',
      phone: selectedPO.phone || '',
      currency: selectedPO.currency || 'PHP',
      termsOfPayment: selectedPO.termsOfPayment || '',
      includeTax: selectedPO.includeTax ?? true,
      includeEwt: selectedPO.includeEwt ?? false,
      status: selectedPO.status || 'pending'
    });

    // Prefill custom price inputs only if they differ from defaults
    setEditCustomPrices(buildCustomPriceMapFromLineItems(normalizedProducts));
    setEditPhoneError('');
    setEditDeliveryDateError('');
    setIsEditing(true);
  };

  const handleDelete = async () => {
    setConfirmDialog({
      title: 'Delete Purchase Order',
      message: `Are you sure you want to delete PO ${selectedPO.customId}? This action cannot be undone.`,
      type: 'danger',
      onConfirm: async () => {
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

        // After deletion, enforce system-wide date rules using rebalance
        try {
          const posQuery = query(collection(db, 'pos'), orderBy('createdAt'));
          const querySnapshot = await getDocs(posQuery);
          const allPOs = [];
          querySnapshot.forEach((doc) => {
            allPOs.push({ id: doc.id, customId: doc.data().customId, ...doc.data() });
          });

          const rebalanceResult = await rebalanceLoads(allPOs);
          console.log('Auto-rebalance after PO deletion:', rebalanceResult);
        } catch (rebalanceError) {
          console.error('Auto-rebalance failed after PO deletion:', rebalanceError);
          // Don't fail the deletion if rebalancing fails
        }

        setShowModal(false);
        // Log to history
        const productsStr = selectedPO.products.map(item => `${item.product}: ${item.quantity}`).join(', ');
        await addDoc(collection(db, 'history'), {
          timestamp: new Date(),
          action: 'Deleted PO',
          details: `PO ${selectedPO.customId}: Company: ${selectedPO.companyName}, Products: ${productsStr}`
        });
      }
    });
  };

  // Enhanced load rebalancing function with full recalculation and dimension compliance
  const handleRebalanceLoads = useCallback(async () => {
    setConfirmDialog({
      title: 'Rebalance Vehicle Loads',
      message: 'This will attempt to rebalance vehicle loads for better distribution using enhanced load management rules including dimension compliance. This action cannot be undone.',
      type: 'warning',
      onConfirm: async () => {
        try {
          const result = await rebalanceLoads(pos);
          setNotification({
            type: 'success',
            title: 'Rebalancing Complete',
            message: result,
            autoClose: true,
            autoCloseDelay: 5000,
            showCloseButton: false
          });
        } catch (error) {
          console.error('Rebalance error:', error);
          setNotification({
            type: 'error',
            title: 'Rebalancing Failed',
            message: 'An error occurred during rebalancing. Please check the console for details.',
            showCloseButton: true
          });
        }
      }
    });
  }, [pos, rebalanceLoads]);

  const handleAssign = useCallback(async (vehicleId) => {
    // Get all existing delivery dates from assigned POs
    const existingDeliveryDates = new Set();
    vehicles.forEach(vehicle => {
      if (vehicle.assignedPOs && vehicle.assignedPOs.length > 0) {
        vehicle.assignedPOs.forEach(poId => {
          const assignedPO = pos.find(p => p.id === poId);
          if (assignedPO && assignedPO.deliveryDate) {
            existingDeliveryDates.add(assignedPO.deliveryDate);
          }
        });
      }
    });

    // Convert to array and sort to find earliest date
    const sortedExistingDates = Array.from(existingDeliveryDates).sort();
    const earliestExistingDate = sortedExistingDates.length > 0 ? sortedExistingDates[0] : null;
    // New rule: Only allow assignment if the selected PO's delivery date is the earliest existing date
    // among assigned POs. If there are no existing delivery dates, allow assignment of any date.
    const isAllowedDate = sortedExistingDates.length === 0 || (earliestExistingDate && selectedPO.deliveryDate === earliestExistingDate);

    if (!isAllowedDate) {
      setNotification({
        type: 'error',
        title: 'Date Restriction',
        message: `Cannot assign this PO because its delivery date (${selectedPO.deliveryDate}) is not the earliest scheduled date (${earliestExistingDate}). Assignments are restricted to the earliest delivery date to ensure efficient scheduling.`,
        showCloseButton: true
      });
      return;
    }

    const load = calculateLoad(selectedPO);
    const vehicle = vehicles.find(v => v.id === vehicleId);
    if (vehicle) {
      const usedForDate = getUsedLoadForVehicleOnDate(vehicle, selectedPO.deliveryDate);
      const clusterName = selectedPO.cluster;
      const lockedCluster = getClusterForVehicleOnDate(vehicle, selectedPO.deliveryDate);

      if (lockedCluster && lockedCluster !== clusterName) {
        setNotification({
          type: 'error',
          title: 'Cluster Conflict',
          message: `Cannot assign this PO to the selected vehicle. The vehicle is already assigned to deliver in ${lockedCluster} on ${selectedPO.deliveryDate}. Each vehicle can only serve one cluster per delivery day to ensure efficient routing.`,
          showCloseButton: true
        });
        return;
      }

      // Additional check: ensure the PO has a valid cluster
      if (!clusterName) {
        setNotification({
          type: 'error',
          title: 'Invalid Cluster',
          message: 'This PO does not have a valid cluster assigned. Please update the PO cluster before assigning it to a vehicle.',
          showCloseButton: true
        });
        return;
      }

      if (vehicle.capacity - usedForDate >= load) {
        // Check driver status first
        if (vehicle.status !== 'Available') {
          setNotification({
            type: 'error',
            title: 'Vehicle Unavailable',
            message: `Cannot assign this PO to ${vehicle.name} because the driver status is "${vehicle.status}". Only vehicles with "Available" drivers can be assigned for deliveries.`,
            showCloseButton: true
          });
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
        setNotification({
          type: 'error',
          title: 'Insufficient Capacity',
          message: 'The selected vehicle does not have enough remaining capacity for this PO on the specified delivery date. Consider choosing a different vehicle or reducing the order size.',
          showCloseButton: true
        });
      }
    }
  }, [selectedPO, vehicles, pos, calculateLoad, getUsedLoadForVehicleOnDate, getClusterForVehicleOnDate, updateVehicle]);

  return (
    <div className="po-monitoring">
      <h1>PO Monitoring</h1>
      <div className="header-actions">
        <button className="add-po-btn" onClick={openNewForm}>+ Add PO</button>
        <button className="rebalance-btn" onClick={handleRebalanceLoads}>Rebalance Loads</button>
      </div>
      {showForm && (
        <POFormModal
          isOpen={showForm}
          title="New Purchase Order"
          submitLabel="Create Purchase Order"
          loadingLabel="Creating Order..."
          loading={loading}
          onClose={closeForm}
          onSubmit={handleSubmit}
          productsCatalog={products}
          clustersCatalog={clusters}
          form={form}
          setForm={setForm}
          customPrices={customPrices}
          setCustomPrices={setCustomPrices}
          handleInputChange={handleInputChange}
          deliveryMinDate={deliveryMinDate}
          deliveryDateError={deliveryDateError}
          calculateTotalPrice={calculateTotalPrice}
          parseCustomPriceInput={parseCustomPriceInput}
          applyCustomPriceToExistingLineItem={applyCustomPriceToExistingLineItem}
        />
      )}
      <div className="po-cards grid">
        {[...pos].sort((a, b) => {
          const dateA = new Date(a.deliveryDate || '9999-12-31');
          const dateB = new Date(b.deliveryDate || '9999-12-31');
          return dateA - dateB;
        }).map(po => {
          const productCount = (po.products || []).reduce((sum, p) => sum + (p.quantity || 0), 0);
          const status = po.status || 'pending';
          const assigned = status === 'assigned';
          const onHold = status === 'on-hold';
          const unassignable = status === 'unassignable';
          const inTransit = status === 'in-transit';
          const delivered = status === 'delivered';
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
              className={`card ${inTransit ? 'in-transit' : ''}`}
              onClick={() => handleCardClick(po)}
              title={inTransit ? `PO ${po.customId} • In-Transit - View Only` : `PO ${po.customId} • ${po.companyName}`}
            >
              <div className="card-header">
                <div>
                  <div className="card-title">PO {po.customId}</div>
                  <div className="card-subtitle">{po.companyName}</div>
                </div>
                <div className={`badge ${assigned ? 'success' : onHold ? 'warning' : unassignable ? 'error' : inTransit ? 'transit' : delivered ? 'delivered' : 'info'}`}>
                  <span className="dot"></span>
                  {assigned ? 'Assigned' : onHold ? 'On Hold' : unassignable ? 'Unassignable' : inTransit ? 'In-Transit' : delivered ? 'Delivered' : 'Pending'}
                </div>
              </div>
              <div className="card-meta">Delivery: {po.deliveryDate}</div>
              <div className="card-meta">Load: {load.toLocaleString()} cm³</div>
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

      {/* Forecasting Section */}
      <div className="forecasting-section">
        <h2>Forecasting</h2>
        <div className="forecasting-controls">
          <div className="input-group">
            <label>Select Delivery Date for Forecasting:</label>
            <select
              value={forecastingDate || ''}
              onChange={(e) => {
                const selectedDate = e.target.value;
                setForecastingDate(selectedDate);
                simulateForecasting(selectedDate);
              }}
              className="forecasting-date-dropdown"
            >
              <option value="">Select a delivery date...</option>
              {[...new Set(
                pos
                  .filter(po => po.status === 'on-hold')
                  .map(po => po.deliveryDate)
                  .filter(date => date) // Remove any null/undefined dates
              )]
                .sort() // Sort dates chronologically
                .map(date => (
                  <option key={date} value={date}>
                    {new Date(date).toLocaleDateString('en-US', {
                      weekday: 'long',
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric'
                    })}
                  </option>
                ))
              }
            </select>
          </div>
        </div>

        {forecastingDate && (
          <div className="forecasting-results">
            <h3>Vehicle Loading Forecast for {forecastingDate}</h3>
            <div className="forecasting-vehicles grid">
              {[...forecastingVehicles].sort((a, b) => a.capacity - b.capacity).map(vehicle => (
                <div key={vehicle.id} className="card forecasting-vehicle-card">
                  <div className="card-header">
                    <div>
                      <div className="card-title">{vehicle.name}</div>
                      <div className="card-subtitle">Plate: {vehicle.plateNumber}</div>
                    </div>
                    <div className="badge forecast">
                      <span className="dot"></span>
                      Forecast
                    </div>
                  </div>
                  <div className="card-meta">Driver: {vehicle.driver}</div>
                  <div className="progress" aria-label="Forecasted load utilization">
                    <span style={{
                      width: `${Math.min(vehicle.simulatedUtilization, 100)}%`,
                      backgroundColor: vehicle.simulatedUtilization > 90 ? '#ff6b6b' :
                                     vehicle.simulatedUtilization > 75 ? '#ffa726' :
                                     vehicle.simulatedUtilization > 0 ? '#4caf50' : '#e0e0e0'
                    }} />
                  </div>
                  <div className="card-footer">
                    <span className="card-meta">
                      {vehicle.simulatedUtilization.toFixed(1)}% utilized •
                      {vehicle.simulatedLoad.toLocaleString()} cm³ •
                      {vehicle.simulatedPOs.length} POs
                    </span>
                  </div>
                  <div className="forecasting-pos">
                    <h4>Assigned POs:</h4>
                    {vehicle.simulatedPOs.length > 0 ? (
                      vehicle.simulatedPOs.map(po => (
                        <div key={po.id} className="forecasting-po-item">
                          <span className="po-id">PO {po.customId}</span>
                          <span className="po-company">{po.companyName}</span>
                          <span className="po-load">{po.simulatedLoad.toLocaleString()} cm³</span>
                        </div>
                      ))
                    ) : (
                      <div className="no-assigned-pos">
                        <p>No POs assigned to this vehicle</p>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {showModal && selectedPO && (
        <div className="modal">
          {isEditing ? (
            <div className="modal-content kiosk-modal">
              <POFormModal
                isOpen={isEditing}
                variant="inline"
                title={`Edit Purchase Order ${selectedPO.customId}`}
                submitLabel="Update Purchase Order"
                loadingLabel="Saving..."
                loading={editLoading}
                onClose={() => setIsEditing(false)}
                onSubmit={handleSaveUpdate}
                productsCatalog={products}
                clustersCatalog={clusters}
                form={editForm}
                setForm={setEditForm}
                customPrices={editCustomPrices}
                setCustomPrices={setEditCustomPrices}
                handleInputChange={handleEditInputChange}
                deliveryMinDate={editDeliveryMinDate}
                deliveryDateError={editDeliveryDateError}
                calculateTotalPrice={calculateTotalPrice}
                parseCustomPriceInput={parseCustomPriceInput}
                applyCustomPriceToExistingLineItem={applyCustomPriceToExistingEditLineItem}
              />
            </div>
          ) : (
            <div className="modal-content po-detail-modal">
              <div className="modal-header">
                <h2>{`Purchase Order ${selectedPO.customId}`}</h2>
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
                    <p><strong>{selectedPO.companyName}</strong></p>
                    <p>{selectedPO.address || 'Address not provided'}</p>
                  </div>
                </div>

                <div className="info-box po-details">
                  <h3>Purchase Order Details</h3>
                  <div className="po-details-content">
                    <p><strong>Requisitioner:</strong> {selectedPO.companyName}</p>
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
                <p><strong>Status:</strong> {selectedPO.status === 'assigned' ? 'Assigned' : selectedPO.status === 'on-hold' ? 'On Hold' : selectedPO.status === 'unassignable' ? 'Unassignable' : selectedPO.status === 'in-transit' ? 'In-Transit' : selectedPO.status === 'delivered' ? 'Delivered (Awaiting Confirmation)' : 'Pending'}</p>
                <p><strong>Assigned Vehicle:</strong> {selectedPO.assignedTruck || 'None'}</p>

                <div className="action-buttons">
                  {selectedPO.status === 'delivered' && (
                    <button
                      onClick={() => {
                        setConfirmDialog({
                          title: 'Confirm Delivery Completion',
                          message: 'This will move the PO to History and mark it as completed. This action cannot be undone.',
                          type: 'warning',
                          onConfirm: async () => {
                            // Move to history collection
                            await addDoc(collection(db, 'history'), {
                              ...selectedPO,
                              timestamp: new Date(),
                              action: 'PO Completed and Confirmed',
                              details: `PO ${selectedPO.customId} delivery confirmed by admin and moved to history`
                            });

                            // Add to completed-pos collection
                            await addDoc(collection(db, 'completed-pos'), {
                              ...selectedPO,
                              completedAt: new Date(),
                              completedBy: 'Admin' // You can modify this to get the actual admin name
                            });

                            // Update PO status to completed
                            await updateDoc(doc(db, 'pos', selectedPO.id), { status: 'completed' });

                            setShowModal(false);
                            setNotification({
                              type: 'success',
                              title: 'Delivery Confirmed',
                              message: 'PO delivery confirmed and moved to History!',
                              autoClose: true,
                              autoCloseDelay: 3000,
                              showCloseButton: false
                            });
                          }
                        });
                      }}
                      className="confirm-btn"
                    >
                      Confirm Delivery
                    </button>
                  )}
                  {selectedPO.status !== 'delivered' && selectedPO.status !== 'in-transit' && (
                    <>
                      <button onClick={handleUpdate}>Update</button>
                      <button onClick={handleDelete} className="delete-btn">Delete</button>
                    </>
                  )}
                  <button onClick={() => setShowModal(false)}>Close</button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {notification && (
        <NotificationDialog
          isOpen={!!notification}
          onClose={() => setNotification(null)}
          type={notification.type}
          title={notification.title}
          message={notification.message}
          autoClose={notification.autoClose}
          autoCloseDelay={notification.autoCloseDelay}
          showCloseButton={notification.showCloseButton}
        />
      )}

      {confirmDialog && (
        <ConfirmDialog
          isOpen={!!confirmDialog}
          onClose={() => setConfirmDialog(null)}
          onConfirm={confirmDialog.onConfirm}
          title={confirmDialog.title}
          message={confirmDialog.message}
          type={confirmDialog.type}
        />
      )}
    </div>
  );
};

export default POMonitoring;
