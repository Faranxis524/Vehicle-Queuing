import React, { createContext, useContext, useMemo, useState } from 'react';

const VehicleContext = createContext();

export const useVehicles = () => useContext(VehicleContext);

const initialVehicles = [
  { id: 'isuzu-flexy-small', name: 'Isuzu Flexy Small', capacity: 9929700, currentLoad: 0, ready: true, driver: 'John Doe', plateNumber: 'ABC-123', status: 'Available', assignedPOs: [] },
  { id: 'isuzu-flexy-big', name: 'Isuzu Flexy Big', capacity: 10230600, currentLoad: 0, ready: true, driver: 'Jane Smith', plateNumber: 'DEF-456', status: 'Available', assignedPOs: [] },
  { id: 'isuzu-truck', name: 'Isuzu Truck', capacity: 21470000, currentLoad: 0, ready: true, driver: 'Bob Johnson', plateNumber: 'GHI-789', status: 'Available', assignedPOs: [] },
  { id: 'h100', name: 'H100', capacity: 7149791.25, currentLoad: 0, ready: true, driver: 'Alice Brown', plateNumber: 'JKL-012', status: 'Available', assignedPOs: [] }
];

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

  const value = useMemo(
    () => ({
      vehicles,
      setVehicles,
      updateVehicle,
      assignLoad,
      setVehicleReadyByName
    }),
    [vehicles]
  );

  return <VehicleContext.Provider value={value}>{children}</VehicleContext.Provider>;
};

export default VehicleContext;