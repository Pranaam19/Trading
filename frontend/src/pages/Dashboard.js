import React, { useState, useEffect, useCallback } from 'react';
import { Container, Row, Col, Card, Table, Badge, Spinner, Alert, Button, Tabs, Tab } from 'react-bootstrap';
import { useAuth } from '../context/AuthContext';
import { useWebSocket } from '../context/WebSocketContext';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import Watchlist from '../components/Watchlist';
import TradingHistory from '../components/TradingHistory';
import PortfolioManagement from '../components/PortfolioManagement';
import RiskAnalysis from '../components/RiskAnalysis';
import TransactionSummary from '../components/TransactionSummary';
import { forcePortfolioUpdate, forceOrdersUpdate } from '../utils/forceUpdate';

const Dashboard = () => {
  const { user } = useAuth();
  const { priceData, isAuthenticated, orders: wsOrders, portfolio: wsPortfolio } = useWebSocket();
  const [portfolio, setPortfolio] = useState([]);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [portfolioValue, setPortfolioValue] = useState(0);
  const [lastRefresh, setLastRefresh] = useState(Date.now());
  const [notification, setNotification] = useState(null);
  
  // Get token from localStorage
  const token = localStorage.getItem('token');

  // Colors for the pie chart
  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8'];

  // Function to fetch portfolio data
  const fetchPortfolio = async () => {
    try {
      console.log('Fetching portfolio data');
      const response = await fetch('/api/trading/portfolio', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        mode: 'cors'
      });
      
      if (!response.ok) {
        throw new Error(`Error: ${response.status}`);
      }
      
      const data = await response.json();
      console.log('Dashboard: Portfolio data fetched from server');
      
      // The backend now returns an object with portfolio, totalValue, and lastUpdated
      if (data.portfolio) {
        console.log('Dashboard: Portfolio data structure updated, using new format');
        console.log(`Total portfolio value from server: ${data.totalValue}`);
        
        // Set the portfolio value directly from the server calculation
        setPortfolioValue(data.totalValue);
        
        // Process the portfolio data
        const processedData = data.portfolio.map(item => {
          if (!item.Asset) {
            console.warn('Portfolio item missing Asset data:', item);
            return item;
          }
          return item;
        });
        
        // Merge with WebSocket portfolio if available
        if (wsPortfolio && wsPortfolio.length > 0) {
          console.log('Merging with WebSocket portfolio:', wsPortfolio.length, 'items');
          
          // Create a map to merge portfolio items by assetId
          const portfolioMap = new Map();
          
          // Add API portfolio items to map
          processedData.forEach(item => {
            portfolioMap.set(item.assetId, item);
          });
          
          // Add WebSocket portfolio items to map (overwriting API items with same assetId)
          wsPortfolio.forEach(wsItem => {
            portfolioMap.set(wsItem.assetId, wsItem);
          });
          
          // Convert map back to array
          const mergedPortfolio = Array.from(portfolioMap.values());
          console.log('Dashboard: Setting merged portfolio:', mergedPortfolio.length, 'items');
          setPortfolio(mergedPortfolio);
          
          // Dispatch an event to notify other components
          window.dispatchEvent(new CustomEvent('portfolio_data_updated', {
            detail: { 
              portfolio: mergedPortfolio, 
              totalValue: data.totalValue,
              timestamp: Date.now() 
            }
          }));
          
          return mergedPortfolio;
        } else {
          console.log('Dashboard: Setting portfolio from API only:', processedData.length, 'items');
          setPortfolio(processedData);
          
          // Dispatch an event to notify other components
          window.dispatchEvent(new CustomEvent('portfolio_data_updated', {
            detail: { 
              portfolio: processedData, 
              totalValue: data.totalValue,
              timestamp: Date.now() 
            }
          }));
          
          return processedData;
        }
      } else {
        // Fallback for old API format
        console.log('Dashboard: Using legacy portfolio format:', data.length, 'items');
        
        // Process the data to ensure all items have the required fields
        const processedData = data.map(item => {
          if (!item.Asset) {
            console.warn('Portfolio item missing Asset data:', item);
            return item;
          }
          return item;
        });
        
        setPortfolio(processedData);
        
        // Calculate portfolio value using the local function
        const totalValue = calculateTotalValue(processedData);
        setPortfolioValue(totalValue);
        
        // Dispatch an event to notify other components
        window.dispatchEvent(new CustomEvent('portfolio_data_updated', {
          detail: { 
            portfolio: processedData, 
            totalValue,
            timestamp: Date.now() 
          }
        }));
        
        return processedData;
      }
    } catch (error) {
      console.error('Error fetching portfolio:', error);
      setError('Failed to load portfolio data');
      return [];
    }
  };

  // Function to fetch orders
  const fetchOrders = async () => {
    try {
      console.log('Fetching orders');
      const response = await fetch('/api/trading/orders', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        mode: 'cors'
      });
      
      if (!response.ok) {
        throw new Error(`Error: ${response.status}`);
      }
      
      const data = await response.json();
      console.log('Dashboard: Orders fetched:', data.length, 'items');
      
      // Merge with WebSocket orders if available
      if (wsOrders && wsOrders.length > 0) {
        console.log('Merging with WebSocket orders:', wsOrders.length, 'items');
        
        // Create a map to merge orders by ID
        const ordersMap = new Map();
        
        // Add API orders to map
        data.forEach(order => {
          ordersMap.set(order.id, order);
        });
        
        // Add WebSocket orders to map (overwriting API orders with same ID)
        wsOrders.forEach(wsOrder => {
          // Only add real orders, not temporary ones
          if (!wsOrder.id.toString().startsWith('temp-')) {
            ordersMap.set(wsOrder.id, wsOrder);
          }
        });
        
        // Convert map back to array and sort by creation date (newest first)
        const mergedOrders = Array.from(ordersMap.values());
        mergedOrders.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        
        console.log('Dashboard: Setting merged orders:', mergedOrders.length, 'items');
        setOrders(mergedOrders);
        
        // Dispatch an event to notify other components
        window.dispatchEvent(new CustomEvent('orders_updated', {
          detail: { orders: mergedOrders, timestamp: Date.now() }
        }));
      } else {
        console.log('Dashboard: Setting orders from API only:', data.length, 'items');
        setOrders(data);
        
        // Dispatch an event to notify other components
        window.dispatchEvent(new CustomEvent('orders_updated', {
          detail: { orders: data, timestamp: Date.now() }
        }));
      }
      
      return data;
    } catch (error) {
      console.error('Error fetching orders:', error);
      setError('Failed to load orders data');
      return [];
    }
  };

  // Fetch data function
  const fetchData = useCallback(async () => {
    if (!token) return;
    
    setLoading(true);
    setError(null);
    
    try {
      console.log('Dashboard: Fetching all data...');
      
      // Fetch data in sequence to ensure we get the latest data
      await fetchPortfolio();
      await fetchOrders();
      await fetchAllOrders(); // Make sure we also fetch all orders for portfolio calculation
      
      setLastRefresh(Date.now());
      
      // Calculate the portfolio value immediately
      const totalValue = calculateTotalValue();
      console.log('Dashboard: Setting portfolio value to:', totalValue);
      setPortfolioValue(totalValue);
      
      // Dispatch an event to notify other components that data has been refreshed
      window.dispatchEvent(new CustomEvent('dashboard_data_refreshed', {
        detail: { timestamp: Date.now(), totalValue }
      }));
      
      console.log('Dashboard: All data fetched and processed successfully');
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      setError('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  }, [token]);

  // Initialize data on component mount
  useEffect(() => {
    if (token) {
      console.log('Dashboard: Initializing data with token');
      fetchPortfolio();
      fetchOrders();
      // Also fetch all orders to help calculate portfolio
      fetchAllOrders();
    }
  }, [token]);

  // Fetch portfolio and orders data
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Set up event listeners for portfolio and order updates
  useEffect(() => {
    // Define the event handlers
    const handlePortfolioUpdate = (event) => {
      console.log('Portfolio update event received', event.detail);
      fetchPortfolio();
      fetchAllOrders(); // Also fetch all orders to ensure we have the latest data
      
      // If the event includes an order, update our orders state
      if (event.detail?.order) {
        setOrders(prevOrders => {
          const updatedOrders = [...prevOrders];
          const orderData = event.detail.order;
          const index = updatedOrders.findIndex(o => 
            o.id === orderData.id || 
            (o.symbol === orderData.symbol && o.price === orderData.price && o.side === orderData.side)
          );
          
          if (index !== -1) {
            updatedOrders[index] = { ...updatedOrders[index], ...orderData };
            console.log(`Updated existing order at index ${index}:`, orderData);
          } else {
            updatedOrders.unshift(orderData);
            console.log(`Added new order to recent orders:`, orderData);
          }
          
          return updatedOrders;
        });
      }
    };
    
    // Handle order status changes
    const handleOrderStatusChanged = (event) => {
      const { order } = event.detail;
      console.log('Dashboard: Order status changed event received', order);
      
      // Update the order in the local state
      setOrders(prevOrders => {
        const updatedOrders = [...prevOrders];
        const index = updatedOrders.findIndex(o => o.id === order.id);
        
        if (index !== -1) {
          updatedOrders[index] = order;
          console.log(`Updated existing order at index ${index}:`, order);
        } else {
          updatedOrders.unshift(order);
          console.log(`Added new order to recent orders:`, order);
          
          // Ensure we don't have too many orders in the list
          if (updatedOrders.length > 50) {
            updatedOrders.pop();
          }
        }
        
        return updatedOrders;
      });
      
      // Show a notification about the order status change
      if (order.status === 'filled') {
        setNotification({
          type: 'success',
          message: `Your ${order.side} order for ${order.quantity} ${order.Asset?.symbol || 'shares'} has been filled!`
        });
      } else if (order.status === 'partially_filled') {
        setNotification({
          type: 'info',
          message: `Your ${order.side} order for ${order.quantity} ${order.Asset?.symbol || 'shares'} has been partially filled.`
        });
      } else if (order.status === 'confirmed') {
        setNotification({
          type: 'info',
          message: `Your ${order.side} order for ${order.quantity} ${order.Asset?.symbol || 'shares'} has been confirmed.`
        });
      }
      
      // Also refresh the orders list to ensure we have the latest data
      fetchOrders();
    };
    
    // Listen for force update events
    const handleForcePortfolioUpdate = (event) => {
      console.log('Force portfolio update event received', event.detail);
      fetchData(); // Fetch all data
      
      // Update the portfolio value directly
      if (event.detail?.totalValue) {
        setPortfolioValue(event.detail.totalValue);
      }
    };
    
    const handleForceOrdersUpdate = (event) => {
      console.log('Force orders update event received', event.detail);
      fetchOrders();
    };
    
    const handleForceUpdateAll = (event) => {
      console.log('Force update all event received', event.detail);
      fetchData();
    };
    
    window.addEventListener('portfolio_update', handlePortfolioUpdate);
    window.addEventListener('order_status_changed', handleOrderStatusChanged);
    window.addEventListener('force_portfolio_update', handleForcePortfolioUpdate);
    window.addEventListener('force_orders_update', handleForceOrdersUpdate);
    window.addEventListener('force_update_all', handleForceUpdateAll);
    
    // Add listener for order book updates
    const handleOrderBookUpdate = (event) => {
      console.log('Order book update event received', event.detail);
      // Refresh orders to make sure we have the latest data
      fetchOrders();
    };
    window.addEventListener('order_book_update', handleOrderBookUpdate);
    
    // Add listener for direct order updates
    const handleOrderUpdate = (event) => {
      console.log('Order update event received', event.detail);
      const { order } = event.detail;
      
      if (order) {
        // Update the order in the local state
        setOrders(prevOrders => {
          const updatedOrders = [...prevOrders];
          const index = updatedOrders.findIndex(o => o.id === order.id);
          
          if (index !== -1) {
            updatedOrders[index] = order;
            console.log(`Updated existing order at index ${index} from order_update:`, order);
          } else {
            updatedOrders.unshift(order);
            console.log(`Added new order to recent orders from order_update:`, order);
          }
          
          return updatedOrders;
        });
        
        // Also refresh the orders list to ensure we have the latest data
        fetchOrders();
      }
    };
    window.addEventListener('order_update', handleOrderUpdate);
    
    return () => {
      window.removeEventListener('portfolio_update', handlePortfolioUpdate);
      window.removeEventListener('order_status_changed', handleOrderStatusChanged);
      window.removeEventListener('order_book_update', handleOrderBookUpdate);
      window.removeEventListener('order_update', handleOrderUpdate);
      window.removeEventListener('force_portfolio_update', handleForcePortfolioUpdate);
      window.removeEventListener('force_orders_update', handleForceOrdersUpdate);
      window.removeEventListener('force_update_all', handleForceUpdateAll);
    };
  }, []);

  // Calculate portfolio value when portfolio, price data, or orders change
  useEffect(() => {
    console.log('Portfolio, price data, or orders changed, recalculating value');
    console.log('Portfolio items:', portfolio.length);
    console.log('Price data items:', Object.keys(priceData).length);
    console.log('Orders items:', orders.length);
    
    // Check if portfolio items have allocation data from the server
    const hasServerAllocation = portfolio.length > 0 && portfolio.some(item => item.allocation !== undefined);
    
    if (!hasServerAllocation) {
      // If we don't have server-calculated allocation, calculate it locally
      const totalValue = calculateTotalValue();
      console.log('Setting portfolio value to (local calculation):', totalValue);
      setPortfolioValue(totalValue);
      
      // Dispatch an event to notify other components that the portfolio value has been updated
      window.dispatchEvent(new CustomEvent('portfolio_value_updated', {
        detail: { value: totalValue, timestamp: Date.now() }
      }));
    } else {
      console.log('Using server-calculated portfolio value and allocation');
    }
    
  }, [portfolio, priceData, orders]);
  
  // Clear notification after 5 seconds
  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => {
        setNotification(null);
      }, 5000);
      
      return () => clearTimeout(timer);
    }
  }, [notification]);

  // Calculate total portfolio value
  const calculateTotalValue = (portfolioData = portfolio) => {
    console.log('Calculating total portfolio value...');
    
    // If no portfolio data, try to calculate from orders
    if (!portfolioData || portfolioData.length === 0) {
      console.log('No portfolio data available, trying to calculate from orders');
      // If we have orders, try to calculate from them
      if (orders && orders.length > 0) {
        return calculateValueFromOrders(orders);
      }
      console.log('No orders available either, returning 0');
      return 0;
    }
    
    let totalValue = 0;
    
    portfolioData.forEach(item => {
      if (!item.Asset) {
        console.warn('Portfolio item missing Asset data:', item);
        return;
      }
      
      // Get current price from either WebSocket price data or the asset's current_price
      const symbol = item.Asset.symbol;
      const currentPrice = priceData[symbol]?.price || item.Asset.current_price || 0;
      
      // Calculate item value based on quantity and current price
      const quantity = parseFloat(item.quantity) || 0;
      const itemValue = quantity * currentPrice;
      
      console.log(`Portfolio item: ${symbol}, Qty: ${quantity}, Price: ${currentPrice}, Value: ${itemValue}`);
      totalValue += itemValue;
    });
    
    console.log('Total portfolio value calculated:', totalValue);
    return totalValue;
  };

  // Calculate value from orders if portfolio is empty
  const calculateValueFromOrders = (ordersData) => {
    if (!ordersData || ordersData.length === 0) return 0;
    
    console.log('Calculating value from orders...');
    
    // Create a map of assets and their quantities
    const assetMap = new Map();
    
    // Process all filled or partially filled orders
    ordersData.forEach(order => {
      if (order.status !== 'filled' && order.status !== 'partially_filled') return;
      
      const assetId = order.assetId;
      const symbol = order.Asset?.symbol;
      if (!symbol) return;
      
      const quantity = parseFloat(order.quantity) || 0;
      const price = parseFloat(order.price) || 0;
      
      if (!assetMap.has(assetId)) {
        assetMap.set(assetId, {
          assetId,
          symbol,
          quantity: order.side === 'buy' ? quantity : -quantity,
          totalCost: order.side === 'buy' ? quantity * price : 0
        });
      } else {
        const asset = assetMap.get(assetId);
        if (order.side === 'buy') {
          asset.quantity += quantity;
          asset.totalCost += quantity * price;
        } else {
          asset.quantity -= quantity;
        }
        assetMap.set(assetId, asset);
      }
    });
    
    // Calculate total value
    let totalValue = 0;
    assetMap.forEach(asset => {
      if (asset.quantity <= 0) return;
      
      const currentPrice = priceData[asset.symbol]?.price || 0;
      if (currentPrice > 0) {
        const itemValue = asset.quantity * currentPrice;
        console.log(`Order-based value: ${asset.symbol}, Qty: ${asset.quantity}, Price: ${currentPrice}, Value: ${itemValue}`);
        totalValue += itemValue;
      }
    });
    
    console.log('Total value from orders:', totalValue);
    return totalValue;
  };

  // Fetch all orders to help calculate portfolio allocation
  const fetchAllOrders = async () => {
    try {
      console.log('Fetching all orders for portfolio calculation');
      const response = await fetch('/api/trading/all-orders', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      });
      
      if (!response.ok) {
        // If the endpoint doesn't exist, just log a warning
        console.warn(`Could not fetch all orders: ${response.status}`);
        return [];
      }
      
      const data = await response.json();
      console.log('Dashboard: All orders fetched:', data.length, 'items');
      
      // Use the orders to update portfolio if needed
      updatePortfolioFromOrders(data);
      
      // Dispatch an event to notify other components
      window.dispatchEvent(new CustomEvent('all_orders_updated', {
        detail: { orders: data, timestamp: Date.now() }
      }));
      
      return data;
    } catch (error) {
      console.warn('Error fetching all orders:', error);
      return [];
    }
  };
  
  // Update portfolio based on orders
  const updatePortfolioFromOrders = (orders) => {
    if (!orders || orders.length === 0) return;
    
    // Create a map of assets and their quantities
    const assetMap = new Map();
    
    orders.forEach(order => {
      if (order.status !== 'filled' && order.status !== 'partially_filled') return;
      
      const assetId = order.assetId;
      const symbol = order.Asset?.symbol;
      const quantity = parseFloat(order.quantity) || 0;
      const price = parseFloat(order.price) || 0;
      
      if (!assetMap.has(assetId)) {
        assetMap.set(assetId, {
          assetId,
          symbol,
          quantity: order.side === 'buy' ? quantity : -quantity,
          totalCost: order.side === 'buy' ? quantity * price : 0
        });
      } else {
        const asset = assetMap.get(assetId);
        if (order.side === 'buy') {
          asset.quantity += quantity;
          asset.totalCost += quantity * price;
        } else {
          asset.quantity -= quantity;
        }
      }
    });
    
    // Convert to portfolio format
    const calculatedPortfolio = Array.from(assetMap.values())
      .filter(item => item.quantity > 0)
      .map(item => ({
        assetId: item.assetId,
        quantity: item.quantity,
        average_price: item.totalCost / item.quantity,
        Asset: {
          symbol: item.symbol,
          current_price: priceData[item.symbol]?.price || 0
        }
      }));
    
    console.log('Calculated portfolio from orders:', calculatedPortfolio);
    
    // If our current portfolio is empty, use the calculated one
    if (portfolio.length === 0 && calculatedPortfolio.length > 0) {
      setPortfolio(calculatedPortfolio);
      const totalValue = calculateTotalValue(calculatedPortfolio);
      setPortfolioValue(totalValue);
    }
  };

  // Format currency
  const formatCurrency = (value) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(value);
  };

  // Format date
  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString();
  };

  // Prepare data for pie chart
  const getPieChartData = () => {
    if (portfolio.length === 0) return [];

    // Check if we have server-calculated values and allocations
    const hasServerCalculations = portfolio.some(item => item.value !== undefined && item.allocation !== undefined);
    
    if (hasServerCalculations) {
      // Use server-provided values
      return portfolio.map(item => ({
        name: item.Asset?.symbol,
        value: item.value,
        allocation: item.allocation
      }));
    } else {
      // Calculate locally
      return portfolio.map(item => {
        const quantity = parseFloat(item.quantity) || 0;
        const price = priceData[item.Asset?.symbol]?.price || item.Asset?.current_price || 0;
        const value = quantity * price;
        
        return {
          name: item.Asset?.symbol,
          value: value,
          allocation: portfolioValue > 0 ? (value / portfolioValue * 100) : 0
        };
      });
    }
  };

  // Manual refresh function
  const handleRefresh = () => {
    console.log('Dashboard: Manual refresh requested');
    setLastRefresh(Date.now());
    fetchData(); // Force an immediate data refresh
    
    // Also use our force update utilities
    forcePortfolioUpdate();
    forceOrdersUpdate();
  };

  if (!token) {
    return (
      <Container>
        <Alert variant="warning">
          Please log in to view your dashboard.
        </Alert>
      </Container>
    );
  }

  if (loading) {
    return (
      <Container className="text-center mt-5">
        <Spinner animation="border" role="status">
          <span className="visually-hidden">Loading...</span>
        </Spinner>
      </Container>
    );
  }

  return (
    <Container className="mt-4">
      {error ? (
        <Alert variant="danger">{error}</Alert>
      ) : (
        <div>
          <div className="dashboard-header mb-4">
            <div className="d-flex justify-content-between align-items-center">
              <h1>Dashboard</h1>
              <Button variant="outline-primary" onClick={handleRefresh}>
                <i className="bi bi-arrow-clockwise"></i> Refresh Data
              </Button>
            </div>
            {notification && (
              <Alert variant={notification.type} className="mt-3">
                {notification.message}
              </Alert>
            )}
          </div>

 

          <Row className="mb-4">
            <Col>
              <Card>
                <Card.Body>
                  <Card.Title>Recent Orders</Card.Title>
                  <Table responsive>
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Asset</th>
                        <th>Type</th>
                        <th>Side</th>
                        <th>Quantity</th>
                        <th>Price</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {orders.length > 0 ? (
                        orders.slice(0, 10).map((order) => (
                          <tr key={order.id}>
                            <td>{formatDate(order.createdAt)}</td>
                            <td>{order.Asset?.symbol}</td>
                            <td>{order.type}</td>
                            <td className={order.side === 'buy' ? 'text-success' : 'text-danger'}>
                              {order.side.toUpperCase()}
                            </td>
                            <td>{order.quantity}</td>
                            <td>{formatCurrency(order.price)}</td>
                            <td>
                              <Badge bg={
                                order.status === 'filled' ? 'success' :
                                order.status === 'partially_filled' ? 'warning' :
                                order.status === 'confirmed' ? 'primary' : 'secondary'
                              }>
                                {order.status}
                              </Badge>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan="7" className="text-center">No orders found</td>
                        </tr>
                      )}
                    </tbody>
                  </Table>
                </Card.Body>
              </Card>
            </Col>
          </Row>

          <Row className="mb-4">
            <Col>
              <PortfolioManagement portfolio={portfolio} priceData={priceData} />
            </Col>
          </Row>

          <Row className="mb-4">
            <Col>
              <RiskAnalysis portfolio={portfolio} priceData={priceData} />
            </Col>
          </Row>
        </div>
      )}
    </Container>
  );
};

export default Dashboard;
