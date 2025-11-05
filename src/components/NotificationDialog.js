import React, { useEffect } from 'react';
import Dialog from './Dialog';
import './NotificationDialog.css';

const NotificationDialog = ({
  isOpen,
  onClose,
  type = 'info',
  title,
  message,
  autoClose = false,
  autoCloseDelay = 3000,
  showCloseButton = true,
  actions
}) => {
  useEffect(() => {
    if (autoClose && isOpen) {
      const timer = setTimeout(() => {
        onClose();
      }, autoCloseDelay);

      return () => clearTimeout(timer);
    }
  }, [autoClose, autoCloseDelay, isOpen, onClose]);

  const getIcon = () => {
    switch (type) {
      case 'success':
        return '✓';
      case 'error':
        return '✕';
      case 'warning':
        return '⚠';
      case 'info':
      default:
        return 'ℹ';
    }
  };

  const getVariant = () => {
    switch (type) {
      case 'success':
        return 'success';
      case 'error':
        return 'error';
      case 'warning':
        return 'warning';
      case 'info':
      default:
        return 'default';
    }
  };

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title={null}
      size="small"
      variant={getVariant()}
      showCloseButton={showCloseButton}
      actions={actions}
      showHeader={false}
    >
      <div className="notification-content">
        <div className="notification-icon">
          {getIcon()}
        </div>
        <div className="notification-text">
          {title && <h3 className="notification-title">{title}</h3>}
          <p className="notification-message">{message}</p>
        </div>
      </div>
    </Dialog>
  );
};

export default NotificationDialog;