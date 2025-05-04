import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from './AuthContext';

const WebSocketContext = createContext();

export const WebSocketProvider = ({ children }) => {
  const [ws, setWs] = useState(null);
  const [connected, setConnected] = useState(false);
  const [priceData, setPriceData] = useState({});
  const [orderBookData, setOrderBookData] = useState({});
  const [error, setError] = useState(null);
  const [orders, setOrders] = useState([]);
  const [portfolio, setPortfolio] = useState([]);
  const { user } = useAuth();
  
  // Determine authentication status from user object and token
  const token = localStorage.getItem('token');
  const isAuthenticated = !!(user && token);

  // Function to fetch data directly from API
  const fetchDataFromAPI = async () => {
    if (!token) return;
    
    try {
      console.log('Forcing data refresh from API...');
      
      // Fetch portfolio data
      const portfolioResponse = await fetch('/api/trading/portfolio', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (portfolioResponse.ok) {
        const portfolioData = await portfolioResponse.json();
        console.log('Fetched portfolio data:', portfolioData);
        setPortfolio(portfolioData);
        
        // Dispatch portfolio update event
        window.dispatchEvent(new CustomEvent('portfolio_update', {
          detail: { portfolio: portfolioData, timestamp: Date.now() }
        }));
      }
      
      // Fetch orders data
      const ordersResponse = await fetch('/api/trading/orders', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (ordersResponse.ok) {
        const ordersData = await ordersResponse.json();
        console.log('Fetched orders data:', ordersData);
        setOrders(ordersData);
        
        // Dispatch orders update event
        window.dispatchEvent(new CustomEvent('orders_updated', {
          detail: { orders: ordersData, timestamp: Date.now() }
        }));
      }
      
      // Fetch all orders for portfolio calculation
      const allOrdersResponse = await fetch('/api/trading/all-orders', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (allOrdersResponse.ok) {
        const allOrdersData = await allOrdersResponse.json();
        console.log('Fetched all orders data:', allOrdersData);
        
        // Dispatch all orders update event
        window.dispatchEvent(new CustomEvent('all_orders_updated', {
          detail: { orders: allOrdersData, timestamp: Date.now() }
        }));
      }
    } catch (error) {
      console.error('Error fetching data from API:', error);
    }
  };
  
  // Connect to WebSocket
  const connectWebSocket = () => {
    try {
      console.log('Connecting to WebSocket...');
      const socket = new WebSocket('ws://localhost:3001');
      setWs(socket);
      
      socket.onopen = () => {
        console.log('WebSocket Connected');
        setConnected(true);
        setError(null);
        
        // Authenticate if we have a token
        if (token) {
          console.log('Authenticating WebSocket connection...');
          socket.send(JSON.stringify({
            type: 'authenticate',
            token
          }));
        }
      };

      socket.onmessage = (event) => {
        const data = JSON.parse(event.data);
        console.log('WebSocket message received:', data.type);
        
        switch (data.type) {
          case 'price_updates':
            // Handle batch price updates for multiple assets
            console.log('Received price updates for multiple assets:', data.data.length);
            const newPriceData = { ...priceData };
            
            data.data.forEach(update => {
              newPriceData[update.symbol] = {
                price: update.price,
                change: update.change,
                timestamp: update.timestamp
              };
            });
            
            setPriceData(newPriceData);
            break;

          case 'price_update':
            // Update price data for a single asset
            console.log('Received price update for:', data.symbol);
            setPriceData(prevData => ({
              ...prevData,
              [data.symbol]: {
                price: data.price,
                change: data.change,
                timestamp: data.timestamp
              }
            }));
            break;

          case 'order_book_update':
            // Handle order book updates
            console.log(`Received order book update for ${data.symbol}`);
            setOrderBookData(prevData => ({
              ...prevData,
              [data.symbol]: {
                bids: data.data.bids,
                asks: data.data.asks,
                timestamp: data.timestamp
              }
            }));
            
            // Dispatch a custom event for components to react
            window.dispatchEvent(new CustomEvent('order_book_update', {
              detail: { 
                symbol: data.symbol,
                data: data.data,
                timestamp: data.timestamp,
                source: 'websocket'
              }
            }));
            break;

          case 'portfolio_update':
            // Handle portfolio updates
            console.log('Received portfolio update');
            setPortfolio(data.portfolio || []);
            
            // Dispatch a custom event for components to react
            window.dispatchEvent(new CustomEvent('portfolio_update', {
              detail: data
            }));
            
            // Force a data refresh to ensure consistency
            fetchDataFromAPI();
            break;

          case 'order_status_update':
          case 'order_update':
          case 'order_placed':
            // Handle order status updates
            console.log(`Received order update:`, data);
            const orderData = data.order || {};
            
            // Update orders list
            setOrders(prevOrders => {
              // If we have the order object, use it directly
              if (orderData && orderData.id) {
                const existingOrderIndex = prevOrders.findIndex(o => 
                  o.id === orderData.id || 
                  (data.tempId && o.id === data.tempId)
                );
                
                if (existingOrderIndex >= 0) {
                  // Update existing order
                  const updatedOrders = [...prevOrders];
                  updatedOrders[existingOrderIndex] = orderData;
                  console.log(`Updated order at index ${existingOrderIndex}:`, orderData);
                  return updatedOrders;
                } else {
                  // Add new order
                  console.log('Added new order:', orderData);
                  return [orderData, ...prevOrders];
                }
              } else if (data.orderId) {
                // Just update the status if we only have orderId
                return prevOrders.map(order => {
                  if (order.id === data.orderId) {
                    return { ...order, status: data.status };
                  }
                  return order;
                });
              }
              return prevOrders;
            });
            
            // Dispatch a custom event for components to react
            window.dispatchEvent(new CustomEvent('order_update', {
              detail: {
                order: orderData,
                status: orderData.status || data.status,
                timestamp: Date.now(),
                source: 'websocket'
              }
            }));
            
            // Also dispatch an order status changed event for Dashboard to update recent orders
            window.dispatchEvent(new CustomEvent('order_status_changed', {
              detail: {
                order: orderData,
                status: orderData.status || data.status,
                timestamp: Date.now()
              }
            }));
            
            // For any order update (filled, partially filled, or confirmed), trigger updates
            console.log('Order updated, refreshing data');
            
            // Request an immediate order book update
            if (orderData.Asset?.symbol) {
              console.log(`Requesting order book update for ${orderData.Asset.symbol} after order update`);
              socket.send(JSON.stringify({
                type: 'get_order_book',
                symbol: orderData.Asset.symbol
              }));
            } else if (data.symbol) {
              console.log(`Requesting order book update for ${data.symbol} after order update`);
              socket.send(JSON.stringify({
                type: 'get_order_book',
                symbol: data.symbol
              }));
            }
            
            // Force a data refresh to ensure consistency
            setTimeout(() => {
              fetchDataFromAPI();
              
              // Dispatch a force update event
              window.dispatchEvent(new CustomEvent('force_update_all', {
                detail: { 
                  source: 'order_update',
                  timestamp: Date.now()
                }
              }));
            }, 500); // Short delay to allow backend to update
            break;

          case 'trade_notification':
            // Handle trade notifications
            console.log('Received trade notification:', data.order);
            
            // Dispatch a custom event for components to react
            window.dispatchEvent(new CustomEvent('trade_update', {
              detail: data
            }));
            
            // Force a data refresh to ensure consistency
            setTimeout(() => {
              fetchDataFromAPI();
              
              // Dispatch a force update event
              window.dispatchEvent(new CustomEvent('force_update_all', {
                detail: { 
                  source: 'trade_notification',
                  timestamp: Date.now()
                }
              }));
            }, 500);
            break;

          case 'authentication_success':
            console.log('Authentication successful');
            // Force a data refresh after successful authentication
            setTimeout(() => fetchDataFromAPI(), 500);
            break;

          case 'authentication_error':
            console.error('Authentication error:', data.message);
            setError('Authentication failed: ' + data.message);
            break;

          case 'error':
            console.error('WebSocket error:', data.message);
            setError(data.message);
            break;

          default:
            console.log('Unhandled message type:', data.type);
        }
      };

      socket.onerror = (error) => {
        console.error('WebSocket Error:', error);
        setError('Failed to connect to WebSocket server');
        setConnected(false);
      };

      socket.onclose = () => {
        console.log('WebSocket Disconnected');
        setWs(null);
        setConnected(false);
      };
    } catch (error) {
      console.error('WebSocket Initialization Error:', error);
      setError('Failed to initialize WebSocket connection');
      setConnected(false);
    }
  };

  useEffect(() => {
    // Connect to WebSocket when the component mounts
    connectWebSocket();
    
    // Set up a periodic data refresh
    const refreshInterval = setInterval(() => {
      if (isAuthenticated && token) {
        console.log('Periodic data refresh...');
        fetchDataFromAPI();
      }
    }, 10000); // Refresh every 10 seconds
    
    // Clean up on unmount
    return () => {
      if (ws) {
        ws.close();
      }
      clearInterval(refreshInterval);
    };
  }, [isAuthenticated, token]);

  // Re-authenticate when authentication status changes
  useEffect(() => {
    if (ws && ws.readyState === WebSocket.OPEN && isAuthenticated) {
      console.log('Re-authenticating WebSocket connection');
      ws.send(JSON.stringify({
        type: 'authenticate',
        token
      }));
    }
  }, [isAuthenticated, token, ws]);

  // Reconnect when authentication state changes
  useEffect(() => {
    if (isAuthenticated && !ws) {
      console.log('Authentication state changed, reconnecting WebSocket');
      connectWebSocket();
    }
    
    // Force a data refresh when authentication state changes
    if (isAuthenticated && token) {
      console.log('Authentication state changed, forcing data refresh');
      fetchDataFromAPI();
    }
  }, [isAuthenticated, token]);

  // Listen for auth_changed event
  useEffect(() => {
    const handleAuthChanged = () => {
      console.log('Auth changed event detected, reconnecting WebSocket...');
      if (ws) {
        ws.close();
        setWs(null);
      }
    };
    
    window.addEventListener('auth_changed', handleAuthChanged);
    
    return () => {
      window.removeEventListener('auth_changed', handleAuthChanged);
    };
  }, [ws]);

  // Function to place an order
  const placeOrder = (orderData) => {
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      console.error('WebSocket is not connected');
      return false;
    }
    
    if (!isAuthenticated) {
      console.error('User is not authenticated');
      return false;
    }
    
    // Generate a temporary ID for the order
    const tempOrderId = `temp-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    
    // Add the order to local state immediately
    const tempOrder = {
      id: tempOrderId,
      ...orderData,
      status: 'pending',
      createdAt: new Date().toISOString(),
      userId: user.id
    };
    
    // Add to orders state
    setOrders(prevOrders => [tempOrder, ...prevOrders]);
    
    // Send the order to the server with user ID
    ws.send(JSON.stringify({
      type: 'place_order',
      ...orderData,
      userId: user.id,
      tempId: tempOrderId
    }));
    
    console.log('Order placed:', tempOrder);
    
    // Request an immediate order book update for the asset after a short delay
    setTimeout(() => {
      if (ws && ws.readyState === WebSocket.OPEN) {
        console.log(`Requesting order book update for ${orderData.symbol} after placing order`);
        ws.send(JSON.stringify({
          type: 'get_order_book',
          symbol: orderData.symbol
        }));
      }
    }, 500); // Short delay to allow backend to process the order
    
    // Force an immediate data refresh via REST API
    fetchDataFromAPI();
    
    // Schedule multiple refreshes to ensure data consistency
    const refreshIntervals = [500, 1000, 2000, 5000];
    
    refreshIntervals.forEach(delay => {
      setTimeout(() => {
        console.log(`Scheduled refresh at ${delay}ms after order placement`);
        
        // Request portfolio data from the server
        if (ws && ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({
            type: 'get_portfolio'
          }));
          
          // Request order book update
          if (orderData.symbol) {
            ws.send(JSON.stringify({
              type: 'get_order_book',
              symbol: orderData.symbol
            }));
          }
        }
        
        // Force another data refresh via REST API
        fetchDataFromAPI();
        
        // Dispatch update events
        window.dispatchEvent(new CustomEvent('force_update_all', {
          detail: {
            source: 'order_placement',
            timestamp: Date.now(),
            delay
          }
        }));
      }, delay);
    });
    
    // Return the temporary ID
    return tempOrderId;
  };

  return (
    <WebSocketContext.Provider value={{
      connected,
      priceData,
      orderBookData,
      orders,
      portfolio,
      placeOrder,
      error,
      isAuthenticated,
      rawWs: ws // Expose the raw WebSocket instance
    }}>
      {children}
    </WebSocketContext.Provider>
  );
};

export const useWebSocket = () => useContext(WebSocketContext);
