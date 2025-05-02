import React, { useState } from 'react';
import { Modal, Button, Table, Spinner, Alert } from 'react-bootstrap';

const TradeConfirmationModal = ({ show, onHide, orderData, onConfirm }) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [orderResult, setOrderResult] = useState(null);
  // Format currency
  const formatCurrency = (value) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(value);
  };

  // Calculate total value
  const calculateTotal = () => {
    if (!orderData.price || !orderData.quantity) return 0;
    return orderData.price * orderData.quantity;
  };

  // Calculate fee (0.1% of total)
  const calculateFee = () => {
    return calculateTotal() * 0.001;
  };

  return (
    <Modal show={show} onHide={onHide} centered>
      <Modal.Header closeButton>
        <Modal.Title>
          Confirm {orderData.side === 'buy' ? 'Purchase' : 'Sale'} of {orderData.symbol}
        </Modal.Title>
      </Modal.Header>
      <Modal.Body>
        {orderResult ? (
          <Alert variant={orderResult.success ? 'success' : 'danger'}>
            {orderResult.message}
          </Alert>
        ) : (
          <>
            <p>Please review your order details before confirming:</p>
        
        <Table bordered>
          <tbody>
            <tr>
              <td className="fw-bold">Asset</td>
              <td>{orderData.symbol}</td>
            </tr>
            <tr>
              <td className="fw-bold">Order Type</td>
              <td className="text-capitalize">{orderData.type}</td>
            </tr>
            <tr>
              <td className="fw-bold">Side</td>
              <td className={orderData.side === 'buy' ? 'text-success text-uppercase fw-bold' : 'text-danger text-uppercase fw-bold'}>
                {orderData.side}
              </td>
            </tr>
            <tr>
              <td className="fw-bold">Quantity</td>
              <td>{orderData.quantity}</td>
            </tr>
            {orderData.type === 'limit' && (
              <tr>
                <td className="fw-bold">Price</td>
                <td>{formatCurrency(orderData.price)}</td>
              </tr>
            )}
            <tr>
              <td className="fw-bold">Total Value</td>
              <td>{formatCurrency(calculateTotal())}</td>
            </tr>
            <tr>
              <td className="fw-bold">Fee (0.1%)</td>
              <td>{formatCurrency(calculateFee())}</td>
            </tr>
            <tr className="table-active">
              <td className="fw-bold">Final Amount</td>
              <td className="fw-bold">
                {formatCurrency(calculateTotal() + (orderData.side === 'buy' ? calculateFee() : -calculateFee()))}
              </td>
            </tr>
          </tbody>
        </Table>
        
        <div className="alert alert-info">
          <small>
            <strong>Note:</strong> Market orders may execute at prices different from the current market price.
            {orderData.type === 'market' && ' Your order will execute at the best available price.'}
          </small>
        </div>
          </>
        )}
      </Modal.Body>
      <Modal.Footer>
        {orderResult ? (
          <>
            <Button variant="secondary" onClick={() => {
              setOrderResult(null);
              onHide();
            }}>
              Close
            </Button>
            <Button 
              variant="primary"
              onClick={() => {
                setOrderResult(null);
                onHide();
              }}
            >
              Done
            </Button>
          </>
        ) : (
          <>
            <Button variant="secondary" onClick={onHide} disabled={isProcessing}>
              Cancel
            </Button>
            <Button 
              variant={orderData.side === 'buy' ? 'success' : 'danger'}
              onClick={() => {
                setIsProcessing(true);
                // Call the onConfirm function and handle the result
                Promise.resolve(onConfirm())
                  .then(result => {
                    setOrderResult({
                      success: true,
                      message: `Your ${orderData.side} order for ${orderData.quantity} ${orderData.symbol} has been placed successfully!`
                    });
                  })
                  .catch(error => {
                    setOrderResult({
                      success: false,
                      message: `Error placing order: ${error.message || 'Unknown error'}`
                    });
                  })
                  .finally(() => {
                    setIsProcessing(false);
                  });
              }}
              disabled={isProcessing}
            >
              {isProcessing ? (
                <>
                  <Spinner as="span" animation="border" size="sm" role="status" aria-hidden="true" />
                  <span className="ms-2">Processing...</span>
                </>
              ) : (
                `Confirm ${orderData.side === 'buy' ? 'Purchase' : 'Sale'}`
              )}
            </Button>
          </>
        )}
      </Modal.Footer>
    </Modal>
  );
};

export default TradeConfirmationModal;
