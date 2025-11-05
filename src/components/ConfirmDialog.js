import React from 'react';
import Dialog from './Dialog';
import './ConfirmDialog.css';

const ConfirmDialog = ({
  isOpen,
  onClose,
  onConfirm,
  title = 'Confirm Action',
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  type = 'warning'
}) => {
  const handleConfirm = () => {
    onConfirm();
    onClose();
  };

  const getIcon = () => {
    switch (type) {
      case 'danger':
        return '⚠';
      case 'info':
        return 'ℹ';
      case 'success':
        return '✓';
      case 'warning':
      default:
        return '⚠';
    }
  };

  const getVariant = () => {
    switch (type) {
      case 'danger':
        return 'error';
      case 'info':
        return 'default';
      case 'success':
        return 'success';
      case 'warning':
      default:
        return 'warning';
    }
  };

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title={null}
      size="small"
      variant={getVariant()}
      showHeader={false}
    >
      <div className="confirm-content">
        <div className="confirm-icon">
          {getIcon()}
        </div>
        <div className="confirm-text">
          <h3 className="confirm-title">{title}</h3>
          <p className="confirm-message">{message}</p>
        </div>
      </div>
      <div className="confirm-actions">
        <button
          className="btn btn-secondary"
          onClick={onClose}
        >
          {cancelText}
        </button>
        <button
          className={`btn ${type === 'danger' ? 'btn-danger' : 'btn-primary'}`}
          onClick={handleConfirm}
        >
          {confirmText}
        </button>
      </div>
    </Dialog>
  );
};

export default ConfirmDialog;