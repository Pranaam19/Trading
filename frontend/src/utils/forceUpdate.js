// Utility functions to force UI updates

// Fetch data directly from API
const fetchDataFromAPI = async (endpoint, token) => {
  try {
    const response = await fetch(`/api/trading/${endpoint}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache'
      }
    });
    
    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error(`Error fetching ${endpoint}:`, error);
    return null;
  }
};

/**
 * Force a direct update of the order book in the DOM
 * @param {Object} orderData - The order data that was just placed
 */
export const forceOrderBookUpdate = async (orderData) => {
  console.log('Force updating order book with:', orderData);
  
  const token = localStorage.getItem('token');
  if (!token) return;
  
  try {
    // Make a direct API call to get the latest order book
    const symbol = orderData?.symbol || 'BTC'; // Default to BTC if no symbol provided
    const data = await fetchDataFromAPI(`order-book/${symbol}`, token);
    
    if (data) {
      console.log('Received fresh order book data:', data);
      
      // Directly update the DOM elements for the order book
      const orderBookElement = document.querySelector('.order-book-container');
      if (orderBookElement) {
        // Force a re-render by toggling a class
        orderBookElement.classList.add('refreshing');
        setTimeout(() => orderBookElement.classList.remove('refreshing'), 100);
      }
      
      // Dispatch a custom event to notify components
      window.dispatchEvent(new CustomEvent('force_order_book_update', {
        detail: { data, timestamp: Date.now() }
      }));
      
      // Also dispatch a WebSocket-like event for components that listen to that
      window.dispatchEvent(new CustomEvent('order_book_update', {
        detail: { symbol, data, timestamp: Date.now() }
      }));
    }
  } catch (error) {
    console.error('Error fetching order book:', error);
  }
};

/**
 * Force a direct update of the portfolio in the DOM
 */
export const forcePortfolioUpdate = async () => {
  console.log('Force updating portfolio');
  
  const token = localStorage.getItem('token');
  if (!token) return;
  
  try {
    // Make a direct API call to get the latest portfolio
    const data = await fetchDataFromAPI('portfolio', token);
    
    if (data) {
      console.log('Received fresh portfolio data:', data);
      
      // Calculate total value
      let totalValue = 0;
      data.forEach(item => {
        if (item.Asset) {
          const quantity = parseFloat(item.quantity) || 0;
          const price = parseFloat(item.Asset.current_price) || 0;
          totalValue += quantity * price;
        }
      });
      
      // Update the total value in the DOM directly
      const totalValueElement = document.querySelector('.portfolio-value');
      if (totalValueElement) {
        totalValueElement.textContent = new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: 'USD'
        }).format(totalValue);
        
        // Force a re-render by toggling a class
        totalValueElement.classList.add('updated');
        setTimeout(() => totalValueElement.classList.remove('updated'), 500);
      }
      
      // Dispatch a custom event to notify components
      window.dispatchEvent(new CustomEvent('force_portfolio_update', {
        detail: { data, totalValue, timestamp: Date.now() }
      }));
      
      // Also dispatch a WebSocket-like event for components that listen to that
      window.dispatchEvent(new CustomEvent('portfolio_update', {
        detail: { portfolio: data, timestamp: Date.now() }
      }));
      
      // Also add a visual indicator
      const portfolioElement = document.querySelector('.portfolio-value');
      if (portfolioElement) {
        portfolioElement.classList.add('updating');
        setTimeout(() => {
          portfolioElement.classList.remove('updating');
        }, 1000);
      }
    }
  } catch (error) {
    console.error('Error fetching portfolio:', error);
  }
};

/**
 * Force a direct update of the recent orders in the DOM
 */
export const forceOrdersUpdate = async () => {
  console.log('Forcing orders update');
  
  // Get token and fetch fresh orders data
  const token = localStorage.getItem('token');
  if (!token) return;
  
  try {
    const ordersData = await fetchDataFromAPI('orders', token);
    if (ordersData) {
      console.log('Received fresh orders data:', ordersData);
      
      // Dispatch events
      window.dispatchEvent(new CustomEvent('orders_updated', {
        detail: { orders: ordersData, timestamp: Date.now() }
      }));
      
      window.dispatchEvent(new CustomEvent('force_orders_update', { 
        detail: { data: ordersData, timestamp: Date.now() } 
      }));
      
      // Also add a visual indicator
      const ordersElement = document.querySelector('.recent-orders-container');
      if (ordersElement) {
        ordersElement.classList.add('updating');
        setTimeout(() => {
          ordersElement.classList.remove('updating');
        }, 1000);
      }
    }
  } catch (error) {
    console.error('Error fetching orders:', error);
  }
};

/**
 * Force a direct update of the transaction history in the DOM
 */
export const forceTransactionHistoryUpdate = async () => {
  console.log('Forcing transaction history update');
  
  // Get token and fetch fresh trades data
  const token = localStorage.getItem('token');
  if (!token) return;
  
  try {
    const tradesData = await fetchDataFromAPI('trades?summary=true', token);
    if (tradesData) {
      console.log('Received fresh trades data:', tradesData);
      
      // Dispatch events
      window.dispatchEvent(new CustomEvent('trades_updated', {
        detail: { 
          trades: tradesData.trades, 
          summary: tradesData.summary, 
          timestamp: Date.now() 
        }
      }));
      
      window.dispatchEvent(new CustomEvent('force_transaction_history_update', { 
        detail: { data: tradesData, timestamp: Date.now() } 
      }));
      
      // Also add a visual indicator
      const historyElement = document.querySelector('.transaction-history-container');
      if (historyElement) {
        historyElement.classList.add('updating');
        setTimeout(() => {
          historyElement.classList.remove('updating');
        }, 1000);
      }
    }
  } catch (error) {
    console.error('Error fetching trades:', error);
  }
};

/**
 * Force update all components after an order is placed
 * @param {Object} orderData - The order data that was just placed
 */
export const forceUpdateAll = async (orderData) => {
  console.log('Force updating all components after order placement:', orderData);
  
  // Add a visual indicator that updates are happening
  const indicator = document.createElement('div');
  indicator.className = 'update-indicator';
  indicator.textContent = 'Updating data...';
  document.body.appendChild(indicator);
  
  // Add a small delay to ensure the server has processed the order
  setTimeout(async () => {
    try {
      // Execute all updates in parallel
      await Promise.all([
        forceOrderBookUpdate(orderData),
        forcePortfolioUpdate(),
        forceOrdersUpdate(),
        forceTransactionHistoryUpdate()
      ]);
      
      // Also dispatch a global update event
      window.dispatchEvent(new CustomEvent('force_update_all', {
        detail: { orderData, timestamp: Date.now() }
      }));
      
      // Update indicator
      indicator.textContent = 'Update complete';
      setTimeout(() => {
        if (document.body.contains(indicator)) {
          document.body.removeChild(indicator);
        }
      }, 1000);
    } catch (error) {
      console.error('Error during force update all:', error);
      indicator.textContent = 'Update failed';
      indicator.style.backgroundColor = '#dc3545';
      setTimeout(() => {
        if (document.body.contains(indicator)) {
          document.body.removeChild(indicator);
        }
      }, 2000);
    }
  }, 500);
};

// Add CSS for the update indicator
const style = document.createElement('style');
style.textContent = `
  .update-indicator {
    position: fixed;
    top: 20px;
    right: 20px;
    background-color: #007bff;
    color: white;
    padding: 10px 15px;
    border-radius: 4px;
    z-index: 9999;
    box-shadow: 0 2px 5px rgba(0,0,0,0.2);
    animation: fadeIn 0.3s ease-in-out;
  }
  
  .updated {
    animation: highlight 0.5s ease-in-out;
  }
  
  .refreshing {
    opacity: 0.7;
    transition: opacity 0.1s;
  }
  
  .updating {
    position: relative;
  }
  
  .updating::after {
    content: 'Updating...';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-color: rgba(0, 123, 255, 0.1);
    display: flex;
    align-items: center;
    justify-content: center;
    color: #007bff;
    font-weight: bold;
    animation: pulse 1s infinite;
  }
  
  @keyframes pulse {
    0% { background-color: rgba(0, 123, 255, 0.1); }
    50% { background-color: rgba(0, 123, 255, 0.2); }
    100% { background-color: rgba(0, 123, 255, 0.1); }
  }
  
  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(-10px); }
    to { opacity: 1; transform: translateY(0); }
  }
  
  @keyframes highlight {
    0% { background-color: transparent; }
    50% { background-color: rgba(0, 123, 255, 0.2); }
    100% { background-color: transparent; }
  }
`;
document.head.appendChild(style);
