import React, { useState, useEffect } from 'react';
import { Toast, ToastContainer } from 'react-bootstrap';

const OrderNotification = ({ show, onClose, orderData, success }) => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setVisible(show);
  }, [show]);

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(value);
  };

  if (!orderData) return null;

  return (
    <ToastContainer position="top-end" className="p-3" style={{ zIndex: 1070 }}>
      <Toast 
        show={visible} 
        onClose={() => {
          setVisible(false);
          if (onClose) onClose();
        }}
        delay={5000}
        autohide
        bg={success ? 'success' : 'danger'}
        className="text-white"
      >
        <Toast.Header closeButton={true}>
          <strong className="me-auto">
            {success ? 'Order Placed Successfully' : 'Order Failed'}
          </strong>
          <small>just now</small>
        </Toast.Header>
        <Toast.Body>
          {success ? (
            <>
              <p className="mb-1">
                <strong>{orderData.side.toUpperCase()} {orderData.quantity} {orderData.symbol}</strong>
              </p>
              <p className="mb-1">
                {orderData.type === 'limit' ? 
                  `Limit price: ${formatCurrency(orderData.price)}` : 
                  'Market order'}
              </p>
              <p className="mb-0">
                Your order has been placed and is being processed.
              </p>
            </>
          ) : (
            <p className="mb-0">
              {orderData.errorMessage || 'There was an error processing your order. Please try again.'}
            </p>
          )}
        </Toast.Body>
      </Toast>
    </ToastContainer>
  );
};

export default OrderNotification;
