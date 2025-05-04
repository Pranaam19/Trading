import React, { useState, useEffect, useCallback } from 'react';
import { Offcanvas, Badge, ListGroup, Button, Form, InputGroup, Tabs, Tab } from 'react-bootstrap';
import { Bell, BellFill, Trash, Check, X, Gear } from 'react-bootstrap-icons';
import { useWebSocket } from '../context/WebSocketContext';
import { useAuth } from '../context/AuthContext';

const NotificationCenter = () => {
  const { priceData, rawWs } = useWebSocket();
  const { user } = useAuth();
  const [show, setShow] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [priceAlerts, setPriceAlerts] = useState([
    { id: 1, asset: 'BTC', condition: 'above', price: 50000, active: true },
    { id: 2, asset: 'ETH', condition: 'below', price: 3000, active: true }
  ]);
  const [newAlert, setNewAlert] = useState({
    asset: 'BTC',
    condition: 'above',
    price: ''
  });

  // Function to add a new notification
  const addNotification = useCallback((notification) => {
    const newId = notifications.length > 0 
      ? Math.max(...notifications.map(n => n.id)) + 1 
      : 1;
    
    const newNotification = {
      id: newId,
      timestamp: new Date(),
      read: false,
      ...notification
    };
    
    setNotifications(prev => [newNotification, ...prev]);
    setUnreadCount(prev => prev + 1);
    
    // Show a browser notification if supported
    if (Notification.permission === 'granted') {
      new Notification(newNotification.title, {
        body: newNotification.message,
        icon: '/favicon.ico'
      });
    }
    
    return newNotification;
  }, [notifications]);
  
  // Initialize with a welcome notification
  useEffect(() => {
    if (notifications.length === 0) {
      addNotification({
        type: 'system',
        title: 'Welcome to Trading Platform',
        message: 'You will receive real-time notifications about your orders and price alerts here.',
        timestamp: new Date(),
        read: false
      });
    }
    
    // Request notification permission
    if (Notification.permission !== 'granted' && Notification.permission !== 'denied') {
      Notification.requestPermission();
    }
  }, [addNotification, notifications.length]);

  // Handle close
  const handleClose = () => setShow(false);
  
  // Handle show
  const handleShow = () => {
    setShow(true);
  };

  // Mark notification as read
  const markAsRead = (id) => {
    setNotifications(notifications.map(notification => 
      notification.id === id ? { ...notification, read: true } : notification
    ));
    setUnreadCount(prev => Math.max(0, prev - 1));
  };

  // Mark all as read
  const markAllAsRead = () => {
    setNotifications(notifications.map(notification => ({ ...notification, read: true })));
    setUnreadCount(0);
  };

  // Delete notification
  const deleteNotification = (id) => {
    setNotifications(notifications.filter(notification => notification.id !== id));
    setUnreadCount(prev => {
      const notification = notifications.find(n => n.id === id);
      return notification && !notification.read ? prev - 1 : prev;
    });
  };

  // Format timestamp
  const formatTimestamp = (timestamp) => {
    const now = new Date();
    const diff = now - timestamp;
    
    // Less than a minute
    if (diff < 60000) {
      return 'Just now';
    }
    
    // Less than an hour
    if (diff < 3600000) {
      const minutes = Math.floor(diff / 60000);
      return `${minutes} minute${minutes !== 1 ? 's' : ''} ago`;
    }
    
    // Less than a day
    if (diff < 86400000) {
      const hours = Math.floor(diff / 3600000);
      return `${hours} hour${hours !== 1 ? 's' : ''} ago`;
    }
    
    // More than a day
    const days = Math.floor(diff / 86400000);
    return `${days} day${days !== 1 ? 's' : ''} ago`;
  };
  
  // Listen for WebSocket events and other application events
  useEffect(() => {
    // Handle order updates
    const handleOrderUpdate = (event) => {
      const { order, status } = event.detail;
      if (!order) return;
      
      let title = '';
      let message = '';
      
      if (status === 'filled') {
        title = 'Order Filled';
        message = `Your ${order.side} order for ${order.quantity} ${order.Asset?.symbol || 'shares'} has been filled at ${formatCurrency(order.price)}.`;
      } else if (status === 'partially_filled') {
        title = 'Order Partially Filled';
        message = `Your ${order.side} order for ${order.quantity} ${order.Asset?.symbol || 'shares'} has been partially filled at ${formatCurrency(order.price)}.`;
      } else if (status === 'confirmed') {
        title = 'Order Confirmed';
        message = `Your ${order.side} order for ${order.quantity} ${order.Asset?.symbol || 'shares'} at ${formatCurrency(order.price)} has been confirmed.`;
      }
      
      if (title && message) {
        addNotification({
          type: 'order',
          title,
          message,
          orderId: order.id
        });
      }
    };
    
    // Handle trade notifications
    const handleTradeNotification = (event) => {
      const { message, order } = event.detail;
      
      if (message && order) {
        addNotification({
          type: 'trade',
          title: 'Trade Completed',
          message,
          orderId: order.id
        });
      }
    };
    
    // Handle price alerts
    const checkPriceAlerts = () => {
      priceAlerts.forEach(alert => {
        if (!alert.active) return;
        
        const currentPrice = priceData[alert.asset]?.price;
        if (!currentPrice) return;
        
        let triggered = false;
        
        if (alert.condition === 'above' && currentPrice >= alert.price) {
          triggered = true;
        } else if (alert.condition === 'below' && currentPrice <= alert.price) {
          triggered = true;
        }
        
        if (triggered) {
          addNotification({
            type: 'price',
            title: 'Price Alert',
            message: `${alert.asset} has ${alert.condition === 'above' ? 'risen above' : 'fallen below'} ${formatCurrency(alert.price)}. Current price: ${formatCurrency(currentPrice)}.`
          });
          
          // Deactivate the alert after triggering
          togglePriceAlert(alert.id);
        }
      });
    };
    
    // Format currency
    function formatCurrency(value) {
      if (!value) return '$0.00';
      return '$' + parseFloat(value).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    }
    
    // Add event listeners
    window.addEventListener('order_update', handleOrderUpdate);
    window.addEventListener('order_status_changed', handleOrderUpdate);
    window.addEventListener('trade_completed', handleTradeNotification);
    
    // Check price alerts when price data changes
    if (Object.keys(priceData).length > 0) {
      checkPriceAlerts();
    }
    
    // Cleanup
    return () => {
      window.removeEventListener('order_update', handleOrderUpdate);
      window.removeEventListener('order_status_changed', handleOrderUpdate);
      window.removeEventListener('trade_completed', handleTradeNotification);
    };
  }, [addNotification, priceAlerts, priceData]);

  // Get icon for notification type
  const getNotificationIcon = (type) => {
    switch (type) {
      case 'order':
        return <Badge bg="success" className="p-2">Order</Badge>;
      case 'price':
        return <Badge bg="primary" className="p-2">Price</Badge>;
      case 'system':
        return <Badge bg="warning" className="p-2">System</Badge>;
      case 'news':
        return <Badge bg="info" className="p-2">News</Badge>;
      default:
        return <Badge bg="secondary" className="p-2">Notification</Badge>;
    }
  };

  // Toggle price alert
  const togglePriceAlert = (id) => {
    setPriceAlerts(priceAlerts.map(alert => 
      alert.id === id ? { ...alert, active: !alert.active } : alert
    ));
  };

  // Delete price alert
  const deletePriceAlert = (id) => {
    setPriceAlerts(priceAlerts.filter(alert => alert.id !== id));
  };

  // Add new price alert
  const addPriceAlert = () => {
    if (!newAlert.price) return;
    
    const price = parseFloat(newAlert.price);
    if (isNaN(price)) return;
    
    const newId = priceAlerts.length > 0 ? Math.max(...priceAlerts.map(a => a.id)) + 1 : 1;
    
    setPriceAlerts([
      ...priceAlerts,
      {
        id: newId,
        asset: newAlert.asset,
        condition: newAlert.condition,
        price: price,
        active: true
      }
    ]);
    
    setNewAlert({
      asset: 'BTC',
      condition: 'above',
      price: ''
    });
  };

  return (
    <>
      <Button 
        variant="outline-secondary" 
        className="position-relative" 
        onClick={handleShow}
      >
        {unreadCount > 0 ? <BellFill /> : <Bell />}
        {unreadCount > 0 && (
          <Badge 
            bg="danger" 
            pill 
            className="position-absolute top-0 start-100 translate-middle"
          >
            {unreadCount}
          </Badge>
        )}
      </Button>

      <Offcanvas show={show} onHide={handleClose} placement="end">
        <Offcanvas.Header closeButton>
          <Offcanvas.Title>Notifications</Offcanvas.Title>
          {notifications.length > 0 && (
            <Button 
              variant="link" 
              size="sm" 
              onClick={markAllAsRead}
              disabled={unreadCount === 0}
            >
              Mark all as read
            </Button>
          )}
        </Offcanvas.Header>
        <Offcanvas.Body>
          <Tabs defaultActiveKey="notifications" id="notification-tabs" className="mb-3">
            <Tab eventKey="notifications" title="Notifications">
              {notifications.length === 0 ? (
                <div className="text-center text-muted p-4">
                  <p>No notifications</p>
                </div>
              ) : (
                <ListGroup variant="flush">
                  {notifications.map(notification => (
                    <ListGroup.Item 
                      key={notification.id} 
                      className={`d-flex justify-content-between align-items-start ${!notification.read ? 'bg-light' : ''}`}
                    >
                      <div className="me-2">
                        {getNotificationIcon(notification.type)}
                      </div>
                      <div className="ms-2 me-auto" style={{ width: '80%' }}>
                        <div className="fw-bold">{notification.title}</div>
                        <div>{notification.message}</div>
                        <small className="text-muted">{formatTimestamp(notification.timestamp)}</small>
                      </div>
                      <div className="d-flex flex-column">
                        {!notification.read && (
                          <Button 
                            variant="outline-primary" 
                            size="sm" 
                            className="mb-1"
                            onClick={() => markAsRead(notification.id)}
                          >
                            <Check size={14} />
                          </Button>
                        )}
                        <Button 
                          variant="outline-danger" 
                          size="sm"
                          onClick={() => deleteNotification(notification.id)}
                        >
                          <Trash size={14} />
                        </Button>
                      </div>
                    </ListGroup.Item>
                  ))}
                </ListGroup>
              )}
            </Tab>
            <Tab eventKey="alerts" title="Price Alerts">
              <div className="mb-3">
                <h6>Create New Alert</h6>
                <InputGroup className="mb-2">
                  <Form.Select 
                    value={newAlert.asset}
                    onChange={(e) => setNewAlert({...newAlert, asset: e.target.value})}
                  >
                    <option value="BTC">BTC</option>
                    <option value="ETH">ETH</option>
                    <option value="SOL">SOL</option>
                    <option value="USDT">USDT</option>
                  </Form.Select>
                  <Form.Select 
                    value={newAlert.condition}
                    onChange={(e) => setNewAlert({...newAlert, condition: e.target.value})}
                  >
                    <option value="above">Above</option>
                    <option value="below">Below</option>
                  </Form.Select>
                  <Form.Control 
                    type="number" 
                    placeholder="Price" 
                    value={newAlert.price}
                    onChange={(e) => setNewAlert({...newAlert, price: e.target.value})}
                  />
                  <Button variant="primary" onClick={addPriceAlert}>Add</Button>
                </InputGroup>
              </div>
              
              {priceAlerts.length === 0 ? (
                <div className="text-center text-muted p-4">
                  <p>No price alerts set</p>
                </div>
              ) : (
                <ListGroup>
                  {priceAlerts.map(alert => (
                    <ListGroup.Item 
                      key={alert.id} 
                      className="d-flex justify-content-between align-items-center"
                    >
                      <div>
                        <Badge bg={alert.active ? 'success' : 'secondary'} className="me-2">
                          {alert.active ? 'Active' : 'Inactive'}
                        </Badge>
                        {alert.asset} {alert.condition === 'above' ? '>' : '<'} ${alert.price.toLocaleString()}
                      </div>
                      <div>
                        <Button 
                          variant={alert.active ? 'outline-secondary' : 'outline-success'} 
                          size="sm" 
                          className="me-1"
                          onClick={() => togglePriceAlert(alert.id)}
                        >
                          {alert.active ? <X size={14} /> : <Check size={14} />}
                        </Button>
                        <Button 
                          variant="outline-danger" 
                          size="sm"
                          onClick={() => deletePriceAlert(alert.id)}
                        >
                          <Trash size={14} />
                        </Button>
                      </div>
                    </ListGroup.Item>
                  ))}
                </ListGroup>
              )}
            </Tab>
            <Tab eventKey="settings" title="Settings">
              <Form>
                <Form.Group className="mb-3">
                  <Form.Check 
                    type="switch"
                    id="order-notifications"
                    label="Order Notifications"
                    defaultChecked
                  />
                </Form.Group>
                <Form.Group className="mb-3">
                  <Form.Check 
                    type="switch"
                    id="price-notifications"
                    label="Price Alerts"
                    defaultChecked
                  />
                </Form.Group>
                <Form.Group className="mb-3">
                  <Form.Check 
                    type="switch"
                    id="system-notifications"
                    label="System Notifications"
                    defaultChecked
                  />
                </Form.Group>
                <Form.Group className="mb-3">
                  <Form.Check 
                    type="switch"
                    id="news-notifications"
                    label="Market News"
                    defaultChecked
                  />
                </Form.Group>
                <Form.Group className="mb-3">
                  <Form.Check 
                    type="switch"
                    id="sound-notifications"
                    label="Sound Notifications"
                    defaultChecked
                  />
                </Form.Group>
                <Form.Group className="mb-3">
                  <Form.Check 
                    type="switch"
                    id="desktop-notifications"
                    label="Desktop Notifications"
                    defaultChecked
                  />
                </Form.Group>
                <Button variant="primary">Save Settings</Button>
              </Form>
            </Tab>
          </Tabs>
        </Offcanvas.Body>
      </Offcanvas>
    </>
  );
};

export default NotificationCenter;
