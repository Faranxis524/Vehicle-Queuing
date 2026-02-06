import React from 'react';
import CustomDatePicker from './CustomDatePicker';

/**
 * Shared Create/Edit PO kiosk-style form.
 *
 * Parent owns state and passes:
 * - form, setForm
 * - customPrices, setCustomPrices
 * - helper callbacks (calculateTotalPrice, parseCustomPriceInput, applyCustomPriceToExistingLineItem)
 */
  const POFormModal = ({
  isOpen,
  variant = 'modal',
  title,
  submitLabel,
  loadingLabel = 'Saving...',
  loading,
  onClose,
  onSubmit,
  productsCatalog,
  clustersCatalog,
  form,
  setForm,
  customPrices,
  setCustomPrices,
  handleInputChange,
  deliveryMinDate,
  deliveryDateError,
  calculateTotalPrice,
  parseCustomPriceInput,
  applyCustomPriceToExistingLineItem,
}) => {
  if (!isOpen) return null;

  const removeProduct = (index) => {
    const updatedProducts = form.products.filter((_, i) => i !== index);
    const subtotal = calculateTotalPrice(updatedProducts);
    setForm({ ...form, products: updatedProducts, totalPrice: subtotal });
  };

  const handleQuantityChange = (index, value) => {
    const newQuantity = parseInt(value) || 0;
    const updatedProducts = form.products.map((item, i) =>
      i === index ? { ...item, quantity: newQuantity } : item
    );
    const subtotal = calculateTotalPrice(updatedProducts);
    setForm({ ...form, products: updatedProducts, totalPrice: subtotal });
  };

  const areRequiredFieldsFilled = () => {
    return (
      form.poNumber?.trim() !== '' &&
      form.companyName?.trim() !== '' &&
      form.poDate !== '' &&
      form.address?.trim() !== '' &&
      form.contact?.trim() !== '' &&
      form.phone?.trim() !== '' &&
      form.cluster !== '' &&
      (form.products || []).length > 0 &&
      (form.products || []).every(p => p.product && p.quantity > 0 && p.pricingType)
    );
  };

  const content = (
    <>
      <div className="kiosk-header">
        <h2>{title}</h2>
        <button className="close-btn" onClick={onClose}>×</button>
      </div>

      <div className="kiosk-form">
          <div className="kiosk-section">
            <h3>Order Information</h3>
            <div className="input-grid">
              <div className="input-group">
                <label>PO Number <span className="required-asterisk">*</span></label>
                <input
                  name="poNumber"
                  placeholder="Enter PO Number"
                  value={form.poNumber}
                  onChange={handleInputChange}
                  required
                />
              </div>

              <div className="input-group">
                <label>Company Name <span className="required-asterisk">*</span></label>
                <input
                  name="companyName"
                  placeholder="Enter Company Name"
                  value={form.companyName}
                  onChange={handleInputChange}
                  required
                />
              </div>

              <div className="input-group">
                <label>Cluster <span className="required-asterisk">*</span></label>
                <select name="cluster" value={form.cluster} onChange={handleInputChange} required>
                  <option value="">Select Cluster</option>
                  {Object.keys(clustersCatalog).map(clusterName => (
                    <option key={clusterName} value={clusterName}>
                      {clustersCatalog[clusterName].name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="input-group">
                <label>Address <span className="required-asterisk">*</span></label>
                <input
                  name="address"
                  placeholder="Enter Delivery Address"
                  value={form.address}
                  onChange={handleInputChange}
                  required
                />
              </div>

              <div className="input-group">
                <label>Contact Person <span className="required-asterisk">*</span></label>
                <input
                  name="contact"
                  placeholder="Enter Contact Person"
                  value={form.contact}
                  onChange={handleInputChange}
                />
              </div>

              <div className="input-group">
                <label>Contact Number <span className="required-asterisk">*</span></label>
                <input
                  name="phone"
                  placeholder="Enter Contact Number"
                  value={form.phone}
                  onChange={handleInputChange}
                />
              </div>

              <div className="input-group">
                <label>Order Date <span className="required-asterisk">*</span></label>
                <CustomDatePicker
                  value={form.poDate}
                  onChange={(e) => handleInputChange({ target: { name: 'poDate', value: e.target.value } })}
                />
              </div>

              <div className="input-group">
                <label>Delivery Date</label>
                <CustomDatePicker
                  value={form.deliveryDate}
                  onChange={(e) => handleInputChange({ target: { name: 'deliveryDate', value: e.target.value } })}
                  min={deliveryMinDate}
                  className={deliveryDateError ? 'error' : ''}
                />
                {deliveryDateError && <span className="error-message">{deliveryDateError}</span>}
              </div>

              <div className="input-group">
                <label>Terms of Payment</label>
                <input
                  name="termsOfPayment"
                  placeholder="e.g., Net 30 days"
                  value={form.termsOfPayment}
                  onChange={handleInputChange}
                />
              </div>

              <div className="input-group tax-toggles">
                <div className="checkbox-group">
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      name="includeTax"
                      checked={!!form.includeTax}
                      onChange={(e) => setForm({ ...form, includeTax: e.target.checked })}
                    />
                    <span className="checkbox-text">Include Sales Tax (12%)</span>
                  </label>
                </div>

                <div className="checkbox-group">
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      name="includeEwt"
                      checked={!!form.includeEwt}
                      onChange={(e) => setForm({ ...form, includeEwt: e.target.checked })}
                    />
                    <span className="checkbox-text">Include EWT (1%)</span>
                  </label>
                </div>
              </div>
            </div>
          </div>

          <div className="kiosk-section">
            <h3>Select Products</h3>
            <div className="product-selection">
              {Object.entries(productsCatalog).map(([productName, productInfo]) => (
                <div key={productName} className="product-card">
                  <div className="product-info">
                    <h4>{productName}</h4>
                    <p className="product-size">
                      {Array.isArray(productInfo.packaging)
                        ? `Case sizes: ${productInfo.packaging.map(p => `${p.name} (${p.size.toLocaleString()} cm³)`).join(', ')}`
                        : `${productInfo.packaging.name} (${productInfo.packaging.size.toLocaleString()} cm³)`
                      }
                    </p>

                    <div className="pricing-buttons">
                      {/* Per piece row */}
                      <div className="pricing-row">
                        <div className="price-input-group">
                          <label>Custom Price per {productInfo.pricing.perPiece.unit}:</label>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            placeholder={`Default: ₱${productInfo.pricing.perPiece.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                            value={customPrices[`${productName}_perPiece`] ?? ''}
                            onChange={(e) => {
                              const nextCustomPrice = parseCustomPriceInput(e.target.value);
                              setCustomPrices((prev) => ({
                                ...prev,
                                [`${productName}_perPiece`]: nextCustomPrice
                              }));
                              applyCustomPriceToExistingLineItem(productName, 'perPiece', null, nextCustomPrice);
                            }}
                          />
                        </div>

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
                                packageQuantity: null,
                                customPrice: customPrices[`${productName}_perPiece`] ?? productInfo.pricing.perPiece.price
                              }];
                              const subtotal = calculateTotalPrice(updatedProducts);
                              setForm({ ...form, products: updatedProducts, totalPrice: subtotal });
                            }
                          }}
                        >
                          Per {productInfo.pricing.perPiece.unit}: ₱{(customPrices[`${productName}_perPiece`] ?? productInfo.pricing.perPiece.price)
                            .toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </button>

                        {(() => {
                          const pieceEntry = form.products.find(p => p.product === productName && p.pricingType === 'perPiece');
                          return pieceEntry ? (
                            <div className="inline-quantity-controls">
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
                              <input
                                type="number"
                                className="quantity-input"
                                min="1"
                                value={pieceEntry.quantity}
                                onChange={(e) => {
                                  const value = parseInt(e.target.value) || 0;
                                  if (value <= 0) {
                                    removeProduct(form.products.indexOf(pieceEntry));
                                  } else {
                                    handleQuantityChange(form.products.indexOf(pieceEntry), value.toString());
                                  }
                                }}
                              />
                              <button
                                type="button"
                                className="qty-btn plus"
                                onClick={() => handleQuantityChange(form.products.indexOf(pieceEntry), (pieceEntry.quantity + 1).toString())}
                              >
                                +
                              </button>
                            </div>
                          ) : null;
                        })()}
                      </div>

                      {/* Per package rows */}
                      {Array.isArray(productInfo.pricing.perPackage) ? (
                        productInfo.pricing.perPackage.map(pkg => {
                          const packageEntry = form.products.find(p =>
                            p.product === productName &&
                            p.pricingType === 'perPackage' &&
                            p.packageQuantity === pkg.quantity
                          );

                          return (
                            <div key={pkg.quantity} className="pricing-row">
                              <div className="price-input-group">
                                <label>Custom Price per Case ({pkg.quantity} {productInfo.pricing.perPiece.unit}s):</label>
                                <input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  placeholder={`Default: ₱${pkg.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                                  value={customPrices[`${productName}_perPackage_${pkg.quantity}`] ?? ''}
                                  onChange={(e) => {
                                    const nextCustomPrice = parseCustomPriceInput(e.target.value);
                                    setCustomPrices((prev) => ({
                                      ...prev,
                                      [`${productName}_perPackage_${pkg.quantity}`]: nextCustomPrice
                                    }));
                                    applyCustomPriceToExistingLineItem(productName, 'perPackage', pkg.quantity, nextCustomPrice);
                                  }}
                                />
                              </div>

                              <button
                                type="button"
                                className={`pricing-btn ${packageEntry ? 'selected' : ''}`}
                                onClick={() => {
                                  const existingIndex = form.products.findIndex(p =>
                                    p.product === productName &&
                                    p.pricingType === 'perPackage' &&
                                    p.packageQuantity === pkg.quantity
                                  );

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
                                      packageQuantity: pkg.quantity,
                                      customPrice: customPrices[`${productName}_perPackage_${pkg.quantity}`] ?? pkg.price
                                    }];
                                    const subtotal = calculateTotalPrice(updatedProducts);
                                    setForm({ ...form, products: updatedProducts, totalPrice: subtotal });
                                  }
                                }}
                              >
                                Per Case ({pkg.quantity} {productInfo.pricing.perPiece.unit}s): ₱{(customPrices[`${productName}_perPackage_${pkg.quantity}`] ?? pkg.price)
                                  .toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </button>

                              {packageEntry ? (
                                <div className="inline-quantity-controls">
                                  <button
                                    type="button"
                                    className="qty-btn minus"
                                    onClick={() => {
                                      const currentQty = packageEntry.quantity;
                                      if (currentQty > 1) {
                                        handleQuantityChange(form.products.indexOf(packageEntry), (currentQty - 1).toString());
                                      } else {
                                        removeProduct(form.products.indexOf(packageEntry));
                                      }
                                    }}
                                  >
                                    -
                                  </button>
                                  <input
                                    type="number"
                                    className="quantity-input"
                                    min="1"
                                    value={packageEntry.quantity}
                                    onChange={(e) => {
                                      const value = parseInt(e.target.value) || 0;
                                      if (value <= 0) {
                                        removeProduct(form.products.indexOf(packageEntry));
                                      } else {
                                        handleQuantityChange(form.products.indexOf(packageEntry), value.toString());
                                      }
                                    }}
                                  />
                                  <button
                                    type="button"
                                    className="qty-btn plus"
                                    onClick={() => handleQuantityChange(form.products.indexOf(packageEntry), (packageEntry.quantity + 1).toString())}
                                  >
                                    +
                                  </button>
                                </div>
                              ) : null}
                            </div>
                          );
                        })
                      ) : (
                        (() => {
                          const packageEntry = form.products.find(p => p.product === productName && p.pricingType === 'perPackage');
                          return (
                            <div className="pricing-row">
                              <div className="price-input-group">
                                <label>Custom Price per {productInfo.packaging.name}:</label>
                                <input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  placeholder={`Default: ₱${productInfo.pricing.perPackage.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                                  value={customPrices[`${productName}_perPackage`] ?? ''}
                                  onChange={(e) => {
                                    const nextCustomPrice = parseCustomPriceInput(e.target.value);
                                    setCustomPrices((prev) => ({
                                      ...prev,
                                      [`${productName}_perPackage`]: nextCustomPrice
                                    }));
                                    applyCustomPriceToExistingLineItem(productName, 'perPackage', productInfo.packaging.quantity, nextCustomPrice);
                                  }}
                                />
                              </div>

                              <button
                                type="button"
                                className={`pricing-btn ${packageEntry ? 'selected' : ''}`}
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
                                      packageQuantity: productInfo.packaging.quantity,
                                      customPrice: customPrices[`${productName}_perPackage`] ?? productInfo.pricing.perPackage.price
                                    }];
                                    const subtotal = calculateTotalPrice(updatedProducts);
                                    setForm({ ...form, products: updatedProducts, totalPrice: subtotal });
                                  }
                                }}
                              >
                                Per {productInfo.packaging.name}: ₱{(customPrices[`${productName}_perPackage`] ?? productInfo.pricing.perPackage.price)
                                  .toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </button>

                              {packageEntry ? (
                                <div className="inline-quantity-controls">
                                  <button
                                    type="button"
                                    className="qty-btn minus"
                                    onClick={() => {
                                      const currentQty = packageEntry.quantity;
                                      if (currentQty > 1) {
                                        handleQuantityChange(form.products.indexOf(packageEntry), (currentQty - 1).toString());
                                      } else {
                                        removeProduct(form.products.indexOf(packageEntry));
                                      }
                                    }}
                                  >
                                    -
                                  </button>
                                  <input
                                    type="number"
                                    className="quantity-input"
                                    min="1"
                                    value={packageEntry.quantity}
                                    onChange={(e) => {
                                      const value = parseInt(e.target.value) || 0;
                                      if (value <= 0) {
                                        removeProduct(form.products.indexOf(packageEntry));
                                      } else {
                                        handleQuantityChange(form.products.indexOf(packageEntry), value.toString());
                                      }
                                    }}
                                  />
                                  <button
                                    type="button"
                                    className="qty-btn plus"
                                    onClick={() => handleQuantityChange(form.products.indexOf(packageEntry), (packageEntry.quantity + 1).toString())}
                                  >
                                    +
                                  </button>
                                </div>
                              ) : null}
                            </div>
                          );
                        })()
                      )}
                    </div>
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
                  const product = productsCatalog[item.product];
                  let price = 0;
                  let description = '';

                  if (product) {
                    if (item.pricingType === 'perPiece') {
                      price = item.customPrice ?? product.pricing.perPiece.price;
                      description = `${item.product} (${product.pricing.perPiece.unit}) x ${item.quantity}`;
                    } else if (item.pricingType === 'perPackage') {
                      if (Array.isArray(product.pricing.perPackage)) {
                        const selectedPackage = product.pricing.perPackage.find(p => p.quantity === item.packageQuantity);
                        price = item.customPrice ?? (selectedPackage ? selectedPackage.price : product.pricing.perPackage[0].price);
                        description = `${item.product} (${item.packageQuantity} ${product.pricing.perPiece.unit}s) x ${item.quantity}`;
                      } else {
                        price = item.customPrice ?? product.pricing.perPackage.price;
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
                  <span>₱{(form.totalPrice || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
                {form.includeTax && (
                  <div className="total-row">
                    <span>Sales Tax (12%):</span>
                    <span>₱{((form.totalPrice || 0) * 0.12).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>
                )}
                {form.includeEwt && (
                  <div className="total-row">
                    <span>EWT (1%):</span>
                    <span>₱{((form.totalPrice || 0) * 0.01).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>
                )}
                <div className="total-row final-total">
                  <span>Total:</span>
                  <span>
                    ₱{(() => {
                      let total = form.totalPrice || 0;
                      if (form.includeTax) total *= 1.12;
                      if (form.includeEwt) total *= 0.99;
                      return total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                    })()}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="kiosk-actions">
            <button type="button" className="cancel-btn" onClick={onClose}>Cancel</button>
            <button
              type="button"
              className={`submit-btn ${areRequiredFieldsFilled() && form.products.length > 0 ? 'ready' : ''}`}
              disabled={!!loading || form.products.length === 0}
              onClick={onSubmit}
            >
              {loading ? loadingLabel : submitLabel}
            </button>
          </div>
        </div>
    </>
  );

  if (variant === 'inline') {
    // Render without the .modal overlay wrapper (for embedding inside an existing modal)
    return <div className="kiosk-modal">{content}</div>;
  }

  return (
    <div className="modal">
      <div className="modal-content kiosk-modal">
        {content}
      </div>
    </div>
  );
};

export default POFormModal;
