import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import './History.css';

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

const History = () => {
  const [history, setHistory] = useState([]);
  const [completedPOs, setCompletedPOs] = useState([]);
  const [selectedPO, setSelectedPO] = useState(null);
  const [companyFilter, setCompanyFilter] = useState('All');

  useEffect(() => {
    const q = query(collection(db, 'history'), orderBy('timestamp', 'desc'));
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const historyData = [];
      querySnapshot.forEach((doc) => {
        historyData.push(doc.data());
      });
      setHistory(historyData);
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    const q = query(collection(db, 'completed-pos'), orderBy('deliveryDate', 'desc'));
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const completedData = [];
      querySnapshot.forEach((doc) => {
        completedData.push({ id: doc.id, ...doc.data() });
      });
      setCompletedPOs(completedData);
    });
    return unsubscribe;
  }, []);

  // Get unique company names for filter dropdown
  const uniqueCompanies = ['All', ...new Set(completedPOs.map(po => po.companyName).filter(Boolean))];

  // Filter completed POs based on selected company
  const filteredPOs = companyFilter === 'All'
    ? completedPOs
    : completedPOs.filter(po => po.companyName === companyFilter);

  return (
    <div className="history">
      <h1>Completed Purchase Orders</h1>

      {completedPOs.length === 0 ? (
        <p>No completed POs yet.</p>
      ) : (
        <>
          <div className="filter-section">
            <label htmlFor="company-filter">Filter by Company:</label>
            <select
              id="company-filter"
              value={companyFilter}
              onChange={(e) => setCompanyFilter(e.target.value)}
              className="company-filter-dropdown"
            >
              {uniqueCompanies.map(company => (
                <option key={company} value={company}>{company}</option>
              ))}
            </select>
          </div>

          <div className="completed-pos-grid">
            {filteredPOs.map(po => (
              <div key={po.id} className="po-card completed-po-card" onClick={() => setSelectedPO(po)}>
                <div className="po-header">
                  <span className="po-number">PO {po.customId}</span>
                  <span className="po-status completed">Completed</span>
                </div>
                <div className="po-summary">
                  <p><strong>{po.companyName}</strong></p>
                  <p>{po.customerName}</p>
                  <p>{po.location}</p>
                  <p>{po.deliveryDate}</p>
                  <p><strong>Completed: {po.completedAt.toDate().toLocaleDateString()}</strong></p>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {selectedPO && (
        <div className="modal">
          <div className="modal-content po-detail-modal">
            <div className="modal-header">
              <h2>Completed Purchase Order {selectedPO.customId}</h2>
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
                  <p><strong>Completed:</strong> {selectedPO.completedAt.toDate().toLocaleString()}</p>
                  <p><strong>Completed by:</strong> {selectedPO.completedBy}</p>
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

      <h2 style={{ marginTop: '40px' }}>Activity History</h2>
      <table className="history-table table-elevated">
        <thead>
          <tr>
            <th>Timestamp</th>
            <th>Action</th>
            <th>Details</th>
          </tr>
        </thead>
        <tbody>
          {history.map((entry, index) => (
            <tr key={index}>
              <td>{entry.timestamp.toDate().toLocaleString()}</td>
              <td>{entry.action}</td>
              <td style={{ whiteSpace: 'pre-line' }}>{entry.details.replace(/, /g, '\n')}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default History;
