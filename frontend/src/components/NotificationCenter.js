import React, { useState, useEffect } from 'react';
import { Offcanvas, Badge, ListGroup, Button, Form, InputGroup, Tabs, Tab } from 'react-bootstrap';
import { Bell, BellFill, Trash, Check, X, Gear } from 'react-bootstrap-icons';

const NotificationCenter = () => {
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

  // Mock notification data
  useEffect(() => {
    const mockNotifications = [
      {
        id: 1,
        type: 'order',
        title: 'Order Executed',
        message: 'Your BTC buy order has been executed at $48,250.00',
        timestamp: new Date(Date.now() - 1000 * 60 * 5),
        read: false
      },
      {
        id: 2,
        type: 'price',
        title: 'Price Alert',
        message: 'BTC has reached your target price of $48,000.00',
        timestamp: new Date(Date.now() - 1000 * 60 * 30),
        read: false
      },
      {
        id: 3,
        type: 'system',
        title: 'System Update',
        message: 'The trading platform will undergo maintenance on Saturday at 2:00 AM UTC',
        timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2),
        read: true
      },
      {
        id: 4,
        type: 'news',
        title: 'Market News',
        message: 'SEC approves new cryptocurrency regulations affecting market liquidity',
        timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24),
        read: true
      }
    ];

    setNotifications(mockNotifications);
    setUnreadCount(mockNotifications.filter(n => !n.read).length);
  }, []);

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
