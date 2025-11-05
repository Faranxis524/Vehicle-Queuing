import React, { useEffect } from 'react';
import './Dialog.css';

const Dialog = ({
  isOpen,
  onClose,
  title,
  children,
  actions,
  size = 'medium',
  variant = 'default',
  showCloseButton = true,
  showHeader = true
}) => {
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div className="dialog-overlay" onClick={handleBackdropClick}>
      <div className={`dialog ${size} ${variant} ${showHeader ? 'has-header' : ''}`} role="dialog" aria-modal="true" aria-labelledby="dialog-title">
        {showHeader && (
          <div className="dialog-header">
            {title && (
              <h2 id="dialog-title" className="dialog-title">{title}</h2>
            )}
            {showCloseButton && (
              <button
                className="dialog-close"
                onClick={onClose}
                aria-label="Close dialog"
              >
                ×
              </button>
            )}
          </div>
        )}
        <div className="dialog-content">
          {children}
        </div>
        {actions && (
          <div className="dialog-actions">
            {actions}
          </div>
        )}
      </div>
    </div>
  );
};

export default Dialog;