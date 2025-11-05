import React, { createContext, useContext, useMemo, useState } from 'react';
import { doc, updateDoc, addDoc, collection } from 'firebase/firestore';
import { db } from '../firebase';

const VehicleContext = createContext();

export const useVehicles = () => useContext(VehicleContext);

const initialVehicles = [
  {
    id: 'isuzu-flexy-small',
    name: 'Isuzu Flexi Small',
    capacity: 9929700,
    dimensions: { length: 4000, width: 1800, height: 2000 }, // mm
    currentLoad: 0,
    ready: true,
    driver: 'Fernando Besa',
    plateNumber: 'NDM9924',
    status: 'Available',
    assignedPOs: []
  },
  {
    id: 'isuzu-flexy-big',
    name: 'Isuzu Flexi Big',
    capacity: 10230600,
    dimensions: { length: 4500, width: 2000, height: 2200 }, // mm
    currentLoad: 0,
    ready: true,
    driver: 'Joseph Allan Saldivar',
    plateNumber: 'NIS9978',
    status: 'Available',
    assignedPOs: []
  },
  {
    id: 'isuzu-truck',
    name: '6 Wheeler Truck',
    capacity: 21470000,
    dimensions: { length: 6000, width: 2400, height: 2800 }, // mm
    currentLoad: 0,
    ready: true,
    driver: 'Randy Maduro',
    plateNumber: 'NAM4827',
    status: 'Available',
    assignedPOs: []
  },
  {
    id: 'h100',
    name: 'Hyundai H100',
    capacity: 7149791.25,
    dimensions: { length: 3500, width: 1600, height: 1800 }, // mm
    currentLoad: 0,
    ready: true,
    driver: 'Adrian Silao',
    plateNumber: 'DAJ9076',
    status: 'Available',
    assignedPOs: []
  }
];

// Helper function to find cluster for a location
const findCluster = (location) => {
  const clusters = {
    'Cluster 1': {
      name: 'North Luzon',
      locations: ['Pampanga', 'Entech Pampanga', 'Bulacan']
    },
    'Cluster 2': {
      name: 'Metro Manila North/East',
      locations: ['Quezon City', 'Bridgetown Quezon City', 'Binondo', 'Mega Town']
    },
    'Cluster 3': {
      name: 'Metro Manila South/Center',
      locations: ['Makati', 'RCBC', 'BGC Taguig', 'Panorama BGC Taguig', 'Bench Taguig', 'Uptown', 'Menarco', 'Milestone', 'MOA', 'Alabang']
    },
    'Cluster 4': {
      name: 'CALABARZON (South Luzon)',
      locations: ['Alabang', 'Calamba', 'Lipa']
    }
  };

  for (const [clusterName, cluster] of Object.entries(clusters)) {
    if (cluster.locations.includes(location)) {
      return clusterName;
    }
  }
  return null;
};

// Helper function to calculate load from PO products
const calculateLoad = (po) => {
  const products = {
    'Interfolded': {
      packaging: { size: 70780.5 },
      dimensions: { length: 535, width: 315, height: 420 }, // mm per case (53.5 x 31.5 x 42 cm)
      pieceSize: 2000 // cm³ per piece (Interfolded Paper Towel piece/roll volume)
    },
    'Jumbo Roll': {
      packaging: [
        { size: 39016.5, dimensions: { length: 370, width: 285, height: 370 } }, // 12 rolls case (37 × 28.5 × 37 cm)
        { size: 90956.25, dimensions: { length: 495, width: 375, height: 490 } }  // 16 rolls case (49.5 × 37.5 × 49 cm)
      ],
      dimensions: { length: 400, width: 300, height: 200 }, // mm per roll (estimated)
      pieceSize: 3648.4 // cm³ per roll (Jumbo Roll Tissue piece/roll volume)
    },
    'Bathroom': {
      packaging: { size: 45630, dimensions: { length: 585, width: 390, height: 200 } }, // mm per case (58.5 x 39 x 20 cm)
      dimensions: { length: 250, width: 180, height: 120 }, // mm per bundle (estimated)
      pieceSize: 926.7 // cm³ per roll (Bathroom Tissue piece/roll volume)
    },
    'Hand Roll': {
      packaging: { size: 46200, dimensions: { length: 550, width: 400, height: 210 } }, // mm per case (55 x 40 x 21 cm)
      dimensions: { length: 200, width: 150, height: 100 }, // mm per bundle (estimated)
      pieceSize: 6813.6 // cm³ per roll (Hand Roll Tissue piece/roll volume)
    }
  };

  return po.products.reduce((total, item) => {
    const product = products[item.product];
    if (!product) return total;

    let itemSize = 0;
    if (item.pricingType === 'perPackage') {
      if (Array.isArray(product.packaging)) {
        const selectedPackaging = product.packaging.find(p => p.quantity === item.packageQuantity) || product.packaging[0];
        itemSize = selectedPackaging.size;
      } else {
        itemSize = product.packaging.size;
      }
    } else if (item.pricingType === 'perPiece') {
      itemSize = product.pieceSize || 0;
    }
    return total + (item.quantity * itemSize);
  }, 0);
};

// Helper function to check if PO dimensions fit in vehicle
const checkDimensionsFit = (po, vehicle) => {
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
  return maxLength <= vehicle.dimensions.length &&
         maxWidth <= vehicle.dimensions.width &&
         maxHeight <= vehicle.dimensions.height;
};

export const VehicleProvider = ({ children }) => {
  const [vehicles, setVehicles] = useState(initialVehicles);

  const updateVehicle = (id, updates) => {
    setVehicles(prev => prev.map(v => (v.id === id ? { ...v, ...updates } : v)));
  };

  const setVehicleReadyByName = (name, ready) => {
    setVehicles(prev => prev.map(v => (v.name === name ? { ...v, ready } : v)));
  };

  const assignLoad = (id, load, poId = null) => {
    setVehicles(prev =>
      prev.map(v =>
        v.id === id
          ? { ...v, currentLoad: v.currentLoad + load, assignedPOs: poId ? [...v.assignedPOs, poId] : v.assignedPOs }
          : v
      )
    );
  };

  // Optimized vehicle scoring function for better load distribution
  const scoreVehiclesForPO = (po, vehicles, allPOs, isRebalancing = false) => {
    const load = calculateLoad(po);
    const clusterName = findCluster(po.location);

    // If location is not in any defined cluster, no vehicles are eligible
    if (!clusterName) {
      return [];
    }

    // Filter by availability, capacity for the PO's date, cluster lock per date, and driver status
    const eligibleVehicles = vehicles.filter(v => {
      // Check driver availability
      if (v.status !== 'Available') return false;

      // Rule 5: Dimension Compliance - check if PO dimensions fit in vehicle
      if (!checkDimensionsFit(po, v)) {
        return false;
      }

      // Get all POs currently assigned to this vehicle
      const assignedPOs = v.assignedPOs.map(poId => allPOs.find(p => p.id === poId)).filter(Boolean);

      if (assignedPOs.length === 0) {
        // Empty vehicle - can assign any PO as long as capacity allows
        return load <= v.capacity;
      }

      // Rule 5: No Cross-Date Mixing - vehicle cannot have POs from multiple delivery dates
      const vehicleDeliveryDate = assignedPOs[0].deliveryDate;
      const hasMultipleDates = assignedPOs.some(assignedPO => assignedPO.deliveryDate !== vehicleDeliveryDate);

      if (hasMultipleDates) {
        // This shouldn't happen with proper implementation, but safety check
        return false;
      }

      // Rule 4: Strict Delivery Date Consistency - if delivery dates don't match, cannot assign
      // EVEN IF SAME CLUSTER - delivery dates must be identical
      if (po.deliveryDate !== vehicleDeliveryDate) {
        return false;
      }

      // Rule 2: Cluster Matching - all POs in vehicle must be from same cluster
      const vehicleCluster = findCluster(assignedPOs[0].location);
      const clusterMismatch = assignedPOs.some(assignedPO => findCluster(assignedPO.location) !== vehicleCluster);

      if (clusterMismatch) {
        // This shouldn't happen with proper implementation, but safety check
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

    if (eligibleVehicles.length === 0) return [];

    // Enhanced ranking algorithm for optimal load distribution
    const scored = eligibleVehicles.map(v => {
      // Get all POs currently assigned to this vehicle
      const assignedPOs = v.assignedPOs.map(poId => allPOs.find(p => p.id === poId)).filter(Boolean);
      const currentLoad = assignedPOs.reduce((total, assignedPO) => total + calculateLoad(assignedPO), 0);
      const remainingCapacity = v.capacity - currentLoad;
      const utilizationAfter = (currentLoad + load) / v.capacity;

      // Calculate cluster efficiency (prefer vehicles already assigned to same cluster)
      // Reduce the weight during rebalancing to encourage better distribution
      const clusterMatches = assignedPOs.reduce((acc, assignedPO) => {
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

      // For rebalancing, reduce cluster preference to encourage distribution across vehicles
      const clusterWeight = isRebalancing ? 1 : 3; // Reduced from 3 to 1 during rebalancing

      // Total score combines multiple factors with weighted priorities
      const totalScore = (clusterMatches * clusterWeight) + loadEfficiency + sizeEfficiency;

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
  };

  // Strict load management function implementing the specified rules with optimal scoring
  const assignPOToVehicle = (po, allPOs, isRebalancing = false) => {
    const scoredVehicles = scoreVehiclesForPO(po, vehicles, allPOs, isRebalancing);

    if (scoredVehicles.length === 0) return null;

    const chosen = scoredVehicles[0].vehicle;
    const load = calculateLoad(po);

    console.log(`Auto-assigning PO ${po.customId} to ${chosen.name}:`, {
      load,
      cluster: findCluster(po.location),
      score: scoredVehicles[0].totalScore,
      utilizationAfter: (scoredVehicles[0].utilizationAfter * 100).toFixed(1) + '%',
      clusterMatches: scoredVehicles[0].clusterMatches
    });

    // Track assignment centrally. We don't flip global ready here; availability is per-date now.
    // Ensure we don't exceed 100% capacity
    assignLoad(chosen.id, load, po.id);

    return chosen.name;
  };

  // Comprehensive rebalance function implementing all 10 rebalancing rules
  const rebalanceLoads = async (allPOs) => {
    console.log('Starting comprehensive rebalance with all 10 rules...');
    
    // Rule 9: Full Recalculation - Clear all current assignments (ignore previous assignments)
    const resetVehicles = vehicles.map(v => ({
      ...v,
      currentLoad: 0,
      assignedPOs: [],
      // Track which clusters are assigned to this vehicle per delivery date
      dateClusterMap: {}
    }));
    
    // Create a working copy of vehicles for assignment tracking
    let workingVehicles = [...resetVehicles];
    
    // Filter out completed, in-transit, and delivered POs - only rebalance pending, assigned, on-hold, and unassignable POs
    const activePOs = allPOs.filter(po => po.status !== 'completed' && po.status !== 'in-transit' && po.status !== 'delivered');
    
    // Rule 1: Delivery Date Priority - Group by delivery date, process earliest first
    const posByDate = {};
    activePOs.forEach(po => {
      if (!posByDate[po.deliveryDate]) {
        posByDate[po.deliveryDate] = [];
      }
      posByDate[po.deliveryDate].push(po);
    });
    
    // Sort delivery dates (earliest first - priority to urgent deliveries)
    const sortedDates = Object.keys(posByDate).sort((a, b) => new Date(a) - new Date(b));
    
    const assignmentResults = [];
    const onHoldPOs = [];
    const errorPOs = [];
    
    // Process each delivery date group
    for (const deliveryDate of sortedDates) {
      const datePOs = posByDate[deliveryDate];
      
      // Group by cluster for this delivery date
      const posByCluster = {};
      datePOs.forEach(po => {
        const cluster = findCluster(po.location);
        if (cluster) {
          if (!posByCluster[cluster]) {
            posByCluster[cluster] = [];
          }
          posByCluster[cluster].push(po);
        } else {
          // Location not in any cluster - mark as error
          errorPOs.push({ po, reason: 'Location not assigned to any cluster' });
        }
      });
      
      // Process each cluster for this delivery date
      for (const clusterName of Object.keys(posByCluster)) {
        const clusterPOs = posByCluster[clusterName];
        
        // Sort by load (largest first for better bin packing)
        clusterPOs.sort((a, b) => calculateLoad(b) - calculateLoad(a));
        
        // Try to assign each PO to vehicles following all rules
        for (const po of clusterPOs) {
          const poLoad = calculateLoad(po);
          let assigned = false;
          
          // Rule 7: Check if this cluster is already assigned to a vehicle with a DIFFERENT date
          // If so, this PO must go on hold
          const clusterVehiclesWithDifferentDates = workingVehicles.filter(v => {
            if (!v.dateClusterMap || Object.keys(v.dateClusterMap).length === 0) return false;
            
            // Check if vehicle has this cluster assigned to a different date
            for (const [vehicleDate, vehicleCluster] of Object.entries(v.dateClusterMap)) {
              if (vehicleCluster === clusterName && vehicleDate !== deliveryDate) {
                return true;
              }
            }
            return false;
          });
          
          if (clusterVehiclesWithDifferentDates.length > 0) {
            // Rule 7: On-Hold condition - cluster assigned to vehicle with different date
            onHoldPOs.push({
              po,
              reason: `Cluster ${clusterName} already assigned to vehicle(s) with different delivery date`
            });
            continue;
          }
          
          // Find eligible vehicles for this PO
          // Rules 2, 3, 4, 5: Cluster-based, no cross-date, capacity, dimensions
          const eligibleVehicles = workingVehicles.filter(v => {
            // Check if driver is available
            if (v.status !== 'Available') return false;
            
            // Rule 5: Dimension Compliance
            if (!checkDimensionsFit(po, v)) return false;
            
            // Check if vehicle has any assignments
            if (!v.dateClusterMap || Object.keys(v.dateClusterMap).length === 0) {
              // Empty vehicle - Rule 4: Check capacity
              return poLoad <= v.capacity;
            }
            
            // Rule 3: No Cross-Date Mixing - vehicle must not have different delivery dates
            const vehicleDates = Object.keys(v.dateClusterMap);
            if (!vehicleDates.includes(deliveryDate)) {
              // Vehicle is serving a different date - cannot use
              return false;
            }
            
            // Rule 2: Cluster-Based Assignment - must match existing cluster for this date
            const vehicleClusterForDate = v.dateClusterMap[deliveryDate];
            if (vehicleClusterForDate && vehicleClusterForDate !== clusterName) {
              // Vehicle already serving different cluster on this date
              return false;
            }
            
            // Rule 4: Capacity Restriction - check remaining capacity
            const currentLoad = v.currentLoad || 0;
            return (currentLoad + poLoad) <= v.capacity;
          });
          
          if (eligibleVehicles.length === 0) {
            // Rule 6 & 8: No vehicle available for this PO
            errorPOs.push({
              po,
              reason: 'No vehicle available - dimension, capacity, or cluster constraints'
            });
            continue;
          }
          
          // Select the best vehicle using scoring logic
          // Prefer vehicles already serving this cluster/date, then by utilization
          const scoredVehicles = eligibleVehicles.map(v => {
            const currentLoad = v.currentLoad || 0;
            const utilizationAfter = (currentLoad + poLoad) / v.capacity;
            
            // Prefer vehicles already serving this cluster/date combination
            const alreadyServingCluster = v.dateClusterMap?.[deliveryDate] === clusterName ? 10 : 0;
            
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
          
          // Sort by score (highest first)
          scoredVehicles.sort((a, b) => b.score - a.score);
          
          // Assign to best vehicle
          const bestVehicle = scoredVehicles[0].vehicle;
          const vehicleIndex = workingVehicles.findIndex(wv => wv.id === bestVehicle.id);
          
          // Update working vehicle state
          workingVehicles[vehicleIndex] = {
            ...workingVehicles[vehicleIndex],
            currentLoad: (workingVehicles[vehicleIndex].currentLoad || 0) + poLoad,
            assignedPOs: [...(workingVehicles[vehicleIndex].assignedPOs || []), po.id],
            dateClusterMap: {
              ...workingVehicles[vehicleIndex].dateClusterMap,
              [deliveryDate]: clusterName
            }
          };
          
          assignmentResults.push({
            po,
            vehicle: bestVehicle.name,
            utilization: scoredVehicles[0].utilizationAfter
          });
          
          assigned = true;
        }
      }
    }
    
    // Rule 10: Final Validation - verify all assignments meet the rules
    const validationErrors = [];
    for (const assignment of assignmentResults) {
      const vehicle = workingVehicles.find(v => v.name === assignment.vehicle);
      if (!vehicle) continue;
      
      // Collect all POs assigned to this vehicle
      const vehiclePOs = assignmentResults
        .filter(a => a.vehicle === assignment.vehicle)
        .map(a => a.po);
      
      // Validate: All POs must have same delivery date
      const uniqueDates = [...new Set(vehiclePOs.map(po => po.deliveryDate))];
      if (uniqueDates.length > 1) {
        validationErrors.push(`Vehicle ${vehicle.name} has mixed delivery dates: ${uniqueDates.join(', ')}`);
      }
      
      // Validate: All POs must be from same cluster
      const uniqueClusters = [...new Set(vehiclePOs.map(po => findCluster(po.location)).filter(Boolean))];
      if (uniqueClusters.length > 1) {
        validationErrors.push(`Vehicle ${vehicle.name} has mixed clusters: ${uniqueClusters.join(', ')}`);
      }
      
      // Validate: Total load doesn't exceed capacity
      const totalLoad = vehiclePOs.reduce((sum, po) => sum + calculateLoad(po), 0);
      if (totalLoad > vehicle.capacity) {
        validationErrors.push(`Vehicle ${vehicle.name} exceeds capacity: ${totalLoad} > ${vehicle.capacity}`);
      }
    }
    
    if (validationErrors.length > 0) {
      console.error('Validation errors:', validationErrors);
      return `Rebalancing failed validation: ${validationErrors.join('; ')}`;
    }
    
    // Apply the assignments to Firestore and update vehicle context
    try {
      // First, clear all assignments in Firestore
      for (const po of activePOs) {
        await updateDoc(doc(db, 'pos', po.id), {
          assignedTruck: null,
          status: 'pending',
          load: calculateLoad(po)
        });
      }
      
      // Update vehicle states
      for (const vehicle of workingVehicles) {
        updateVehicle(vehicle.id, {
          currentLoad: vehicle.currentLoad || 0,
          assignedPOs: vehicle.assignedPOs || []
        });
      }
      
      // Apply successful assignments
      for (const assignment of assignmentResults) {
        await updateDoc(doc(db, 'pos', assignment.po.id), {
          assignedTruck: assignment.vehicle,
          load: calculateLoad(assignment.po),
          status: 'assigned'
        });
        
        await addDoc(collection(db, 'history'), {
          timestamp: new Date(),
          action: 'Rebalanced PO Assignment',
          details: `PO ${assignment.po.customId} assigned to ${assignment.vehicle} (${(assignment.utilization * 100).toFixed(1)}% utilization)`
        });
      }
      
      // Place on-hold POs (Rule 7 violations - same cluster, different date)
      for (const onHold of onHoldPOs) {
        await updateDoc(doc(db, 'pos', onHold.po.id), {
          assignedTruck: null,
          status: 'on-hold',
          load: calculateLoad(onHold.po)
        });

        await addDoc(collection(db, 'history'), {
          timestamp: new Date(),
          action: 'PO Placed On Hold During Rebalance',
          details: `PO ${onHold.po.customId} placed on hold - ${onHold.reason}`
        });
      }

      // Place unassignable POs (no vehicle available due to constraints)
      for (const error of errorPOs) {
        await updateDoc(doc(db, 'pos', error.po.id), {
          assignedTruck: null,
          status: 'unassignable',
          load: calculateLoad(error.po)
        });

        await addDoc(collection(db, 'history'), {
          timestamp: new Date(),
          action: 'PO Marked Unassignable During Rebalance',
          details: `PO ${error.po.customId} marked unassignable - ${error.reason}`
        });
      }
      
      // Generate result message
      const totalErrors = errorPOs.length + onHoldPOs.length;
      if (totalErrors > 0) {
        return `Rebalancing Error: ${totalErrors} PO(s) cannot be assigned to any available vehicle due to dimension or capacity constraints. Please review manually.\n\nSuccessfully assigned: ${assignmentResults.length} PO(s)\nOn hold: ${onHoldPOs.length} PO(s)\nErrors: ${errorPOs.length} PO(s)`;
      }
      
      return `Load rebalancing completed successfully!\n\nAssigned: ${assignmentResults.length} PO(s) across ${new Set(assignmentResults.map(a => a.vehicle)).size} vehicle(s)`;
      
    } catch (error) {
      console.error('Error during rebalancing:', error);
      return `Rebalancing failed: ${error.message}`;
    }
  };

  const value = useMemo(
    () => ({
      vehicles,
      setVehicles,
      updateVehicle,
      assignLoad,
      setVehicleReadyByName,
      assignPOToVehicle,
      rebalanceLoads
    }),
    [vehicles]
  );

  return <VehicleContext.Provider value={value}>{children}</VehicleContext.Provider>;
};

export default VehicleContext;
