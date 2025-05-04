import React, { useState, useEffect } from 'react';
import { Container, Row, Col, Card, Form, Button, Table, Alert, ListGroup, Spinner } from 'react-bootstrap';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { useWebSocket } from '../context/WebSocketContext';
import { useAuth } from '../context/AuthContext';
import MarketAnalysis from '../components/MarketAnalysis';
import TradeConfirmationModal from '../components/TradeConfirmationModal';
import OrderNotification from '../components/OrderNotification';
import { forceUpdateAll, forceOrderBookUpdate } from '../utils/forceUpdate';

const Trading = () => {
  const { orderBookData, priceData, placeOrder, rawWs } = useWebSocket();
  const { user } = useAuth();
  const [selectedAsset, setSelectedAsset] = useState('BTC');
  const [chartData, setChartData] = useState([]);
  const [orderData, setOrderData] = useState({
    symbol: 'BTC',
    quantity: '',
    price: '',
    type: 'limit',
    side: 'buy'
  });
  const [orderStatus, setOrderStatus] = useState(null);
  const [error, setError] = useState(null);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [showNotification, setShowNotification] = useState(false);
  const [notificationData, setNotificationData] = useState(null);
  const [notificationSuccess, setNotificationSuccess] = useState(true);
  
  // Get token from localStorage
  const token = localStorage.getItem('token');
  
  // Determine authentication status directly
  const userIsAuthenticated = !!user && !!token;

  // Get current price for selected asset
  const currentPrice = priceData[selectedAsset]?.price || 0;
  
  // Get order book for selected asset
  const orderBook = orderBookData[selectedAsset] || { bids: [], asks: [] };

  // Add logging to track order book updates
  useEffect(() => {
    if (orderBookData[selectedAsset]) {
      console.log('Order book updated for', selectedAsset, ':', {
        bids: orderBookData[selectedAsset].bids?.length || 0,
        asks: orderBookData[selectedAsset].asks?.length || 0
      });
      
      // Dispatch an event to notify other components about the order book update
      window.dispatchEvent(new CustomEvent('order_book_update', {
        detail: { 
          symbol: selectedAsset,
          timestamp: Date.now(),
          bids: orderBookData[selectedAsset].bids?.length || 0,
          asks: orderBookData[selectedAsset].asks?.length || 0,
          source: 'websocket_update'
        }
      }));
    }
  }, [orderBookData, selectedAsset]);

  // Listen for portfolio updates to reflect changes in real-time
  useEffect(() => {
    const handlePortfolioUpdate = (event) => {
      console.log('Portfolio update detected in Trading component', event.detail);
      
      // Request an order book update if we have a symbol
      if (event.detail?.symbol) {
        console.log('Requesting order book update for', event.detail.symbol);
        if (rawWs && rawWs.readyState === WebSocket.OPEN) {
          rawWs.send(JSON.stringify({
            type: 'get_order_book',
            symbol: event.detail.symbol
          }));
        }
      }
    };
    
    // Handle order book updates
    const handleOrderBookUpdate = (event) => {
      console.log('Order book update event received in Trading component', event.detail);
      
      // If the selected asset matches the updated symbol, refresh the UI
      if (event.detail?.symbol === selectedAsset) {
        // The orderBookData should already be updated via WebSocketContext
        // But we can force a re-render by updating a state variable
        setOrderStatus(prev => {
          if (prev && prev.includes('Order book updated')) {
            return prev;
          }
          return prev ? `${prev} - Order book updated` : 'Order book updated';
        });
      }
    };
    
    window.addEventListener('portfolio_update', handlePortfolioUpdate);
    window.addEventListener('order_book_update', handleOrderBookUpdate);
    
    return () => {
      window.removeEventListener('portfolio_update', handlePortfolioUpdate);
      window.removeEventListener('order_book_update', handleOrderBookUpdate);
    };
  }, [selectedAsset, rawWs]);
  
  // Generate chart data from price history
  useEffect(() => {
    // For demo purposes, generate some random price data
    const generateChartData = () => {
      const data = [];
      let price = currentPrice || 30000;
      
      for (let i = 30; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        
        // Add some random fluctuation
        price = price * (1 + (Math.random() * 0.06 - 0.03));
        
        data.push({
          date: date.toLocaleDateString(),
          price: parseFloat(price.toFixed(2))
        });
      }
      
      return data;
    };
    
    setChartData(generateChartData());
  }, [currentPrice, selectedAsset]);
  
  // Handle form changes
  const handleChange = (e) => {
    const { name, value } = e.target;
    
    // If changing the asset, update the symbol as well
    if (name === 'symbol') {
      setSelectedAsset(value);
    }
    
    setOrderData({
      ...orderData,
      [name]: value
    });
  };
  
  // Handle form submission
  const handleSubmit = (e) => {
    e.preventDefault();
    
    // Validate input
    if (!orderData.quantity || (orderData.type === 'limit' && !orderData.price)) {
      setError('Please fill in all required fields');
      return;
    }
    
    // Show confirmation modal instead of placing order immediately
    setShowConfirmation(true);
  };
  
  // Function to execute order after confirmation
  const executeOrder = async () => {
    console.log('Executing order:', orderData);
    setOrderStatus('Processing order...');
    
    // Check if user is authenticated
    if (!userIsAuthenticated || !user) {
      setError('You must be logged in to place orders');
      setOrderStatus('Order failed: Not authenticated');
      return;
    }
    
    // Get the asset ID for the selected symbol
    const assetId = getAssetIdBySymbol(orderData.symbol);
    
    if (!assetId) {
      setError('Invalid asset selected');
      setOrderStatus('Order failed');
      return;
    }
    
    // Create the order object with user ID
    const order = {
      assetId,
      userId: user.id, // Explicitly include user ID
      quantity: parseFloat(orderData.quantity),
      price: orderData.type === 'limit' ? parseFloat(orderData.price) : currentPrice,
      type: orderData.type,
      side: orderData.side,
      symbol: orderData.symbol // Add symbol for easier reference
    };
    
    console.log(`Placing order for user ${user.id}:`, order);
    
    try {
      // Place the order via WebSocket
      placeOrder(order);
      
      // Also place the order via REST API for redundancy
      try {
        const response = await fetch('/api/trading/orders', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            assetId: order.assetId,
            quantity: order.quantity,
            price: order.price,
            type: order.type,
            side: order.side
          })
        });
        
        if (response.ok) {
          const orderResult = await response.json();
          console.log('Order placed via REST API:', orderResult);
        } else {
          console.warn('REST API order placement failed, but WebSocket order was sent');
        }
      } catch (restError) {
        console.warn('Error placing order via REST API (WebSocket order was still sent):', restError);
      }
      
      // Update status and show notification
      setOrderStatus(`${orderData.side === 'buy' ? 'Buy' : 'Sell'} order placed successfully`);
      setNotificationData(order);
      setNotificationSuccess(true);
      setShowNotification(true);
      
      // Reset form
      setOrderData({
        ...orderData,
        quantity: '',
        price: ''
      });
      
      // Hide confirmation modal
      setShowConfirmation(false);
      
      // Force an update of all components
      console.log('Forcing update of all components after order placement');
      forceUpdateAll(order);
      
      // Also request order book update via WebSocket for redundancy
      if (rawWs && rawWs.readyState === WebSocket.OPEN) {
        console.log('Requesting order book update after order placement');
        rawWs.send(JSON.stringify({
          type: 'get_order_book',
          symbol: orderData.symbol
        }));
        
        // Also request portfolio update
        rawWs.send(JSON.stringify({
          type: 'get_portfolio'
        }));
      }
      
      // Add a visual cue that the order book is updating
      const orderBookElement = document.querySelector('.order-book-container');
      if (orderBookElement) {
        orderBookElement.classList.add('updating');
        setTimeout(() => {
          orderBookElement.classList.remove('updating');
        }, 2000);
      }
      
      // Force multiple updates at different intervals to ensure all data is refreshed
      const updateIntervals = [500, 1000, 2000, 5000];
      updateIntervals.forEach(delay => {
        setTimeout(() => {
          console.log(`Scheduled update ${delay}ms after order placement`);
          forceUpdateAll(order);
          
          // Also dispatch a custom event for other components to respond to
          window.dispatchEvent(new CustomEvent('force_update_all', {
            detail: {
              source: 'trading_page',
              timestamp: Date.now(),
              userId: user.id,
              order: order
            }
          }));
        }, delay);
      });
      
    } catch (error) {
      console.error('Error executing order:', error);
      setError(`Order failed: ${error.message || 'Unknown error'}`);
      setOrderStatus('Order failed');
      
      // Show error notification
      setNotificationData({
        ...order,
        errorMessage: error.message || 'Unknown error'
      });
      setNotificationSuccess(false);
      setShowNotification(true);
    }
  };
  
  // Helper function to get asset ID by symbol
  const getAssetIdBySymbol = (symbol) => {
    // In a real app, this would come from the API
    // For demo purposes, use hardcoded values
    const assetMap = {
      'BTC': 1,
      'ETH': 2,
      'SOL': 3
    };
    
    return assetMap[symbol];
  };
  
  // Format price with 2 decimal places
  const formatPrice = (price) => {
    return parseFloat(price).toFixed(2);
  };

  return (
    <Container>
      <Row className="mb-4">
        <Col>
          <h1>Trading</h1>
          {error && (
            <Alert variant="danger" onClose={() => setError(null)} dismissible>
              {error}
            </Alert>
          )}
          {orderStatus && (
            <Alert variant="info" onClose={() => setOrderStatus(null)} dismissible>
              {orderStatus}
            </Alert>
          )}
        </Col>
      </Row>
      
      <Row className="mb-4">
        <Col lg={8}>
          <Card className="mb-4">
            <Card.Body>
              <Card.Title>Price Chart - {selectedAsset}</Card.Title>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis domain={['auto', 'auto']} />
                  <Tooltip formatter={(value) => [`$${formatPrice(value)}`, 'Price']} />
                  <Legend />
                  <Line 
                    type="monotone" 
                    dataKey="price" 
                    stroke="#8884d8" 
                    activeDot={{ r: 8 }} 
                    name="Price" 
                  />
                </LineChart>
              </ResponsiveContainer>
            </Card.Body>
          </Card>
          
          <Card className="order-book-container">
            <Card.Body>
              <Card.Title>Order Book</Card.Title>
              <Row>
                <Col md={12}>
                  <h5 className="text-success">Order Book (Buy Orders)</h5>
                  <Table striped bordered hover size="sm">
                    <thead>
                      <tr>
                        <th>Price</th>
                        <th>Quantity</th>
                        <th>Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {orderBook.bids && orderBook.bids.length > 0 ? (
                        orderBook.bids.map((bid, index) => (
                          <tr key={`bid-${index}`}>
                            <td className="text-success">${formatPrice(bid.price)}</td>
                            <td>{bid.quantity}</td>
                            <td>${formatPrice(bid.price * bid.quantity)}</td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan="3" className="text-center">No buy orders</td>
                        </tr>
                      )}
                    </tbody>
                  </Table>
                </Col>
              </Row>
              <div className="text-center mt-2">
                <small className="text-muted">
                  Last updated: {orderBook.timestamp ? new Date(orderBook.timestamp).toLocaleString() : 'Never'}
                </small>
              </div>
            </Card.Body>
          </Card>
        </Col>
        
        <Col lg={4}>
          <Card className="mb-4">
            <Card.Body>
              <Card.Title>Place Order</Card.Title>
              <Form onSubmit={handleSubmit}>
                <Form.Group className="mb-3">
                  <Form.Label>Asset</Form.Label>
                  <Form.Select 
                    name="symbol" 
                    value={orderData.symbol}
                    onChange={handleChange}
                  >
                    <option value="BTC">Bitcoin (BTC)</option>
                    <option value="ETH">Ethereum (ETH)</option>
                    <option value="SOL">Solana (SOL)</option>
                  </Form.Select>
                </Form.Group>
                
                <Form.Group className="mb-3">
                  <Form.Label>Order Type</Form.Label>
                  <Form.Select 
                    name="type" 
                    value={orderData.type}
                    onChange={handleChange}
                  >
                    <option value="limit">Limit</option>
                    <option value="market">Market</option>
                  </Form.Select>
                </Form.Group>
                
                <Form.Group className="mb-3">
                  <Form.Label>Side</Form.Label>
                  <div>
                    <Form.Check
                      inline
                      type="radio"
                      label="Buy"
                      name="side"
                      value="buy"
                      checked={orderData.side === 'buy'}
                      onChange={handleChange}
                      className="text-success"
                    />
                    <Form.Check
                      inline
                      type="radio"
                      label="Sell"
                      name="side"
                      value="sell"
                      checked={orderData.side === 'sell'}
                      onChange={handleChange}
                      className="text-danger"
                    />
                  </div>
                </Form.Group>
                
                <Form.Group className="mb-3">
                  <Form.Label>Quantity</Form.Label>
                  <Form.Control 
                    type="number" 
                    name="quantity" 
                    value={orderData.quantity}
                    onChange={handleChange}
                    min="0.00000001"
                    step="0.00000001"
                    placeholder="Enter quantity"
                  />
                </Form.Group>
                
                {orderData.type === 'limit' && (
                  <Form.Group className="mb-3">
                    <Form.Label>Price</Form.Label>
                    <Form.Control 
                      type="number" 
                      name="price" 
                      value={orderData.price}
                      onChange={handleChange}
                      min="0.01"
                      step="0.01"
                      placeholder="Enter price"
                    />
                  </Form.Group>
                )}
                
                <Button 
                  variant={orderData.side === 'buy' ? 'success' : 'danger'} 
                  type="submit"
                  className="w-100"
                  disabled={!userIsAuthenticated}
                >
                  {orderData.side === 'buy' ? 'Buy' : 'Sell'} {orderData.symbol}
                </Button>
                
                {priceData[selectedAsset] && (
                  <div className="mt-3 text-center">
                    <strong>Current Price:</strong> ${formatPrice(currentPrice)}
                  </div>
                )}
              </Form>
            </Card.Body>
          </Card>
        </Col>
      </Row>
      <Row className="mt-4">
        <Col>
          <MarketAnalysis selectedAsset={selectedAsset} />
        </Col>
      </Row>
      <TradeConfirmationModal 
        show={showConfirmation} 
        onHide={() => setShowConfirmation(false)} 
        orderData={orderData} 
        onConfirm={executeOrder}
      />
      
      <OrderNotification
        show={showNotification}
        onClose={() => setShowNotification(false)}
        orderData={notificationData}
        success={notificationSuccess}
      />
    </Container>
  );
};

export default Trading;
