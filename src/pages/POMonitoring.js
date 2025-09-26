import React, { useState, useEffect } from 'react';
import { collection, addDoc, onSnapshot, doc, deleteDoc, query, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import './POMonitoring.css';

const POMonitoring = () => {
  const [pos, setPos] = useState([]);
  const [form, setForm] = useState({
    companyName: '',
    customerName: '',
    poDate: '',
    location: '',
    deliveryDate: '',
    quantity: '',
    particulars: '',
    unitPrice: '',
    totalPrice: ''
  });
  const [showForm, setShowForm] = useState(false);
  const [selectedPO, setSelectedPO] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [poCounter, setPoCounter] = useState(1);

  useEffect(() => {
    const q = query(collection(db, 'pos'), orderBy('createdAt'));
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const posData = [];
      querySnapshot.forEach((doc) => {
        posData.push({ id: doc.id, customId: doc.data().customId, ...doc.data() });
      });
      setPos(posData);
      if (posData.length > 0) {
        const maxId = Math.max(...posData.map(po => parseInt(po.customId.replace('PO', ''))));
        setPoCounter(maxId + 1);
      }
    });
    return unsubscribe;
  }, []);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setForm({ ...form, [name]: value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const newPO = {
      customId: `PO${poCounter}`,
      ...form,
      createdAt: new Date()
    };
    await addDoc(collection(db, 'pos'), newPO);
    setPoCounter(poCounter + 1);
    setForm({
      companyName: '',
      customerName: '',
      poDate: '',
      location: '',
      deliveryDate: '',
      quantity: '',
      particulars: '',
      unitPrice: '',
      totalPrice: ''
    });
    setShowForm(false);
    // Log to history
    await addDoc(collection(db, 'history'), {
      timestamp: new Date(),
      action: 'Added PO',
      details: `PO ${newPO.customId}: Company: ${newPO.companyName}, Customer: ${newPO.customerName}, Date: ${newPO.poDate}, Location: ${newPO.location}, Delivery: ${newPO.deliveryDate}, Quantity: ${newPO.quantity}, Particulars: ${newPO.particulars}, Unit Price: ${newPO.unitPrice}, Total: ${newPO.totalPrice}`
    });
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
      await addDoc(collection(db, 'history'), {
        timestamp: new Date(),
        action: 'Deleted PO',
        details: `PO ${selectedPO.customId}: Company: ${selectedPO.companyName}, Customer: ${selectedPO.customerName}`
      });
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
              <label>PO Number: {`PO${poCounter}`} (Automatic)</label>
              <input name="companyName" placeholder="Company Name" value={form.companyName} onChange={handleInputChange} required />
              <input name="customerName" placeholder="Name of Customer" value={form.customerName} onChange={handleInputChange} required />
              <input name="poDate" type="date" placeholder="PO Date" value={form.poDate} onChange={handleInputChange} required />
              <input name="location" placeholder="Location" value={form.location} onChange={handleInputChange} required />
              <input name="deliveryDate" type="date" placeholder="Delivery Date" value={form.deliveryDate} onChange={handleInputChange} required />
              <input name="quantity" placeholder="Quantity" value={form.quantity} onChange={handleInputChange} required />
              <input name="particulars" placeholder="Particulars" value={form.particulars} onChange={handleInputChange} required />
              <input name="unitPrice" type="number" placeholder="Unit Price" value={form.unitPrice} onChange={handleInputChange} required />
              <input name="totalPrice" type="number" placeholder="Total Price" value={form.totalPrice} onChange={handleInputChange} required />
              <div className="form-buttons">
                <button type="submit">Submit</button>
                <button type="button" onClick={() => setShowForm(false)}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
      <div className="po-cards">
        {pos.map(po => (
          <div key={po.id} className="po-card" onClick={() => handleCardClick(po)}>
            {po.customId}
          </div>
        ))}
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
            <p>Quantity: {selectedPO.quantity}</p>
            <p>Particulars: {selectedPO.particulars}</p>
            <p>Unit Price: {selectedPO.unitPrice}</p>
            <p>Total Price: {selectedPO.totalPrice}</p>
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