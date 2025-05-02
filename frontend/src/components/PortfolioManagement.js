import React, { useState, useEffect } from 'react';
import { Card, Row, Col, Form, Button, Table, ProgressBar, Tabs, Tab, Alert, Badge } from 'react-bootstrap';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';

const PortfolioManagement = ({ portfolio, priceData }) => {
  const [activeTab, setActiveTab] = useState('allocation');
  const [riskProfile, setRiskProfile] = useState('moderate');
  const [portfolioStats, setPortfolioStats] = useState({
    totalValue: 0,
    dailyChange: 0,
    dailyChangePercent: 0,
    monthlyChange: 0,
    monthlyChangePercent: 0
  });
  
  // Calculate portfolio statistics on component mount and when portfolio/priceData changes
  useEffect(() => {
    const totalValue = calculatePortfolioValue();
    
    // Generate consistent daily and monthly changes based on portfolio assets
    // This ensures the same values are shown on each render for demo purposes
    let dailyChangePercent = 0;
    let monthlyChangePercent = 0;
    
    // Use asset symbols to generate consistent changes
    portfolio.forEach(item => {
      const symbol = item.Asset?.symbol || '';
      // Use the sum of character codes to generate a consistent random number
      const seed = symbol.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0);
      
      // Generate values between -3% and +5% for daily, -5% and +15% for monthly
      dailyChangePercent += (((seed % 80) / 10) - 3) * (item.allocation || 10) / 100;
      monthlyChangePercent += (((seed % 200) / 10) - 5) * (item.allocation || 10) / 100;
    });
    
    // If no portfolio items, use some default values
    if (portfolio.length === 0) {
      dailyChangePercent = 2.34;
      monthlyChangePercent = 7.82;
    }
    
    const dailyChange = totalValue * (dailyChangePercent / 100);
    const monthlyChange = totalValue * (monthlyChangePercent / 100);
    
    setPortfolioStats({
      totalValue,
      dailyChange,
      dailyChangePercent,
      monthlyChange,
      monthlyChangePercent
    });
  }, [portfolio, priceData]);
  
  // Format currency
  const formatCurrency = (value) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(value);
  };
  
  // Calculate total portfolio value
  const calculatePortfolioValue = () => {
    if (!portfolio || portfolio.length === 0) return 0;
    
    return portfolio.reduce((total, item) => {
      const currentPrice = priceData[item.Asset?.symbol]?.price || item.Asset?.current_price || 0;
      return total + (item.quantity * currentPrice);
    }, 0);
  };
  
  // Get current allocation data
  const getCurrentAllocation = () => {
    if (!portfolio || portfolio.length === 0) return [];
    
    // Check if portfolio items already have value and allocation from the server
    const hasServerCalculations = portfolio.some(item => item.value !== undefined && item.allocation !== undefined);
    
    if (hasServerCalculations) {
      // Use server-provided values
      return portfolio.map(item => ({
        name: item.Asset?.symbol,
        value: item.value,
        allocation: item.allocation,
        quantity: parseFloat(item.quantity),
        avgPrice: parseFloat(item.average_price),
        currentPrice: priceData[item.Asset?.symbol]?.price || item.Asset?.current_price || 0
      }));
    } else {
      // Calculate locally
      const totalValue = calculatePortfolioValue();
      
      return portfolio.map(item => {
        const currentPrice = priceData[item.Asset?.symbol]?.price || item.Asset?.current_price || 0;
        const quantity = parseFloat(item.quantity) || 0;
        const value = quantity * currentPrice;
        const allocation = totalValue > 0 ? (value / totalValue * 100) : 0;
        
        return {
          name: item.Asset?.symbol,
          value: value,
          allocation: allocation,
          quantity: quantity,
          avgPrice: parseFloat(item.average_price) || 0,
          currentPrice: currentPrice
        };
      });
    }
  };
  
  // Get recommended allocation based on risk profile
  const getRecommendedAllocation = () => {
    const totalValue = calculatePortfolioValue();
    
    // Get the actual asset symbols from the portfolio
    const assetSymbols = portfolio.map(item => item.Asset?.symbol).filter(Boolean);
    
    // If no assets in portfolio, use default symbols
    const symbols = assetSymbols.length > 0 ? assetSymbols : ['BTC', 'ETH', 'SOL', 'USDT'];
    
    // Define allocation percentages based on risk profile
    let allocations = {};
    
    // Create dynamic allocations based on actual portfolio assets
    if (symbols.length > 0) {
      switch(riskProfile) {
        case 'conservative':
          // Conservative: More stablecoins, less volatile assets
          symbols.forEach((symbol, index) => {
            // Stablecoins get higher allocation in conservative profile
            if (symbol === 'USDT' || symbol === 'USDC' || symbol === 'DAI') {
              allocations[symbol] = 40;
            } else if (symbol === 'BTC') {
              allocations[symbol] = 30;
            } else if (symbol === 'ETH') {
              allocations[symbol] = 20;
            } else {
              // Other assets get smaller allocations
              allocations[symbol] = 10 / (symbols.length - 3 > 0 ? symbols.length - 3 : 1);
            }
          });
          break;
        case 'moderate':
          // Moderate: Balanced allocation
          symbols.forEach((symbol, index) => {
            if (symbol === 'BTC') {
              allocations[symbol] = 40;
            } else if (symbol === 'ETH') {
              allocations[symbol] = 30;
            } else if (symbol === 'USDT' || symbol === 'USDC' || symbol === 'DAI') {
              allocations[symbol] = 10;
            } else {
              // Other assets get moderate allocations
              allocations[symbol] = 20 / (symbols.length - 3 > 0 ? symbols.length - 3 : 1);
            }
          });
          break;
        case 'aggressive':
          // Aggressive: Focus on growth assets, minimal stablecoins
          symbols.forEach((symbol, index) => {
            if (symbol === 'BTC') {
              allocations[symbol] = 50;
            } else if (symbol === 'ETH') {
              allocations[symbol] = 30;
            } else if (symbol === 'USDT' || symbol === 'USDC' || symbol === 'DAI') {
              allocations[symbol] = 0;
            } else {
              // Other assets get higher allocations
              allocations[symbol] = 20 / (symbols.length - 3 > 0 ? symbols.length - 3 : 1);
            }
          });
          break;
        default:
          // Default to moderate
          symbols.forEach((symbol, index) => {
            if (symbol === 'BTC') {
              allocations[symbol] = 40;
            } else if (symbol === 'ETH') {
              allocations[symbol] = 30;
            } else if (symbol === 'USDT' || symbol === 'USDC' || symbol === 'DAI') {
              allocations[symbol] = 10;
            } else {
              allocations[symbol] = 20 / (symbols.length - 3 > 0 ? symbols.length - 3 : 1);
            }
          });
      }
    } else {
      // Fallback allocations if no symbols available
      switch(riskProfile) {
        case 'conservative':
          allocations = {
            'BTC': 30,
            'ETH': 20,
            'SOL': 10,
            'USDT': 40
          };
          break;
        case 'moderate':
          allocations = {
            'BTC': 40,
            'ETH': 30,
            'SOL': 20,
            'USDT': 10
          };
          break;
        case 'aggressive':
          allocations = {
            'BTC': 50,
            'ETH': 30,
            'SOL': 20,
            'USDT': 0
          };
          break;
        default:
          allocations = {
            'BTC': 40,
            'ETH': 30,
            'SOL': 20,
            'USDT': 10
          };
      }
    }
    
    // Convert percentages to values
    return Object.entries(allocations).map(([symbol, percentage]) => ({
      name: symbol,
      value: (totalValue * percentage) / 100
    }));
  };
  
  // Get rebalancing recommendations
  const getRebalancingRecommendations = () => {
    const currentAllocation = {};
    const totalValue = calculatePortfolioValue();
    
    // Calculate current allocation percentages
    portfolio.forEach(item => {
      if (!item.Asset?.symbol) return;
      
      // Use server-provided allocation if available
      if (item.allocation !== undefined) {
        currentAllocation[item.Asset.symbol] = item.allocation;
      } else {
        const currentPrice = priceData[item.Asset.symbol]?.price || item.Asset.current_price || 0;
        const value = item.quantity * currentPrice;
        currentAllocation[item.Asset.symbol] = (value / totalValue) * 100;
      }
    });
    
    // Get recommended allocations from the function that handles dynamic assets
    const recommendedAllocations = getRecommendedAllocation();
    
    // Convert the recommended allocations array to an object for easier comparison
    const targetAllocation = {};
    recommendedAllocations.forEach(item => {
      if (item.name && item.value) {
        targetAllocation[item.name] = (item.value / totalValue) * 100;
      }
    });
    
    // If we have no recommended allocations, use static ones based on risk profile
    if (Object.keys(targetAllocation).length === 0) {
      switch(riskProfile) {
        case 'conservative':
          Object.assign(targetAllocation, {
            'BTC': 30,
            'ETH': 20,
            'SOL': 10,
            'USDT': 40
          });
          break;
        case 'moderate':
          Object.assign(targetAllocation, {
            'BTC': 40,
            'ETH': 30,
            'SOL': 20,
            'USDT': 10
          });
          break;
        case 'aggressive':
          Object.assign(targetAllocation, {
            'BTC': 50,
            'ETH': 30,
            'SOL': 20,
            'USDT': 0
          });
          break;
        default:
          Object.assign(targetAllocation, {
            'BTC': 40,
            'ETH': 30,
            'SOL': 20,
            'USDT': 10
          });
      }
    }
    
    // Calculate differences and generate recommendations
    const recommendations = [];
    
    Object.entries(targetAllocation).forEach(([symbol, targetPercentage]) => {
      const currentPercentage = currentAllocation[symbol] || 0;
      const difference = targetPercentage - currentPercentage;
      
      if (Math.abs(difference) >= 5) {
        const action = difference > 0 ? 'Buy' : 'Sell';
        const amountPercentage = Math.abs(difference);
        const amountValue = (totalValue * amountPercentage) / 100;
        
        recommendations.push({
          symbol,
          action,
          amountPercentage,
          amountValue
        });
      }
    });
    
    return recommendations;
  };
  
  // Colors for the pie chart
  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8'];
  
  // Render portfolio summary
  const renderPortfolioSummary = () => (
    <Row className="mb-4">
      <Col md={12}>
        <Card className="bg-light">
          <Card.Body>
            <Row>
              <Col md={4} className="text-center">
                <h6>Total Value</h6>
                <h4>{formatCurrency(portfolioStats.totalValue)}</h4>
              </Col>
              <Col md={4} className="text-center">
                <h6>24h Change</h6>
                <h4 className={portfolioStats.dailyChange >= 0 ? 'text-success' : 'text-danger'}>
                  {formatCurrency(portfolioStats.dailyChange)} 
                  ({portfolioStats.dailyChangePercent >= 0 ? '+' : ''}{portfolioStats.dailyChangePercent.toFixed(2)}%)
                </h4>
              </Col>
              <Col md={4} className="text-center">
                <h6>30d Change</h6>
                <h4 className={portfolioStats.monthlyChange >= 0 ? 'text-success' : 'text-danger'}>
                  {formatCurrency(portfolioStats.monthlyChange)}
                  ({portfolioStats.monthlyChangePercent >= 0 ? '+' : ''}{portfolioStats.monthlyChangePercent.toFixed(2)}%)
                </h4>
              </Col>
            </Row>
          </Card.Body>
        </Card>
      </Col>
    </Row>
  );
  
  // Render allocation comparison
  const renderAllocationComparison = () => (
    <>
      {renderPortfolioSummary()}
      <Row>
        <Col md={6}>
          <h5 className="text-center mb-3">Current Allocation</h5>
          {portfolio.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={getCurrentAllocation()}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                  nameKey="name"
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(1)}%`}
                >
                  {getCurrentAllocation().map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip 
                  formatter={(value, name, props) => [
                    formatCurrency(value),
                    `${name} (${props.payload.allocation?.toFixed(2)}%)`
                  ]} 
                />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="text-center mt-5">
              <p>No assets in portfolio</p>
            </div>
          )}
        </Col>
        <Col md={6}>
          <h5 className="text-center mb-3">Recommended Allocation</h5>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie
                data={getRecommendedAllocation()}
                cx="50%"
                cy="50%"
                labelLine={false}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
                nameKey="name"
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
              >
                {getRecommendedAllocation().map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(value) => formatCurrency(value)} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </Col>
      </Row>
    </>
  );
  
  // Render rebalancing recommendations
  const renderRebalancingRecommendations = () => {
    const recommendations = getRebalancingRecommendations();
    
    return (
      <div>
        <h5 className="mb-3">Rebalancing Recommendations</h5>
        {recommendations.length > 0 ? (
          <Table striped bordered hover>
            <thead>
              <tr>
                <th>Asset</th>
                <th>Action</th>
                <th>Amount</th>
                <th>Value</th>
              </tr>
            </thead>
            <tbody>
              {recommendations.map((rec, index) => (
                <tr key={index}>
                  <td>{rec.symbol}</td>
                  <td className={rec.action === 'Buy' ? 'text-success' : 'text-danger'}>
                    {rec.action}
                  </td>
                  <td>{rec.amountPercentage.toFixed(2)}%</td>
                  <td>{formatCurrency(rec.amountValue)}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        ) : (
          <Alert variant="success">
            Your portfolio is well-balanced according to your risk profile. No rebalancing needed at this time.
          </Alert>
        )}
      </div>
    );
  };
  
  // Render performance chart
  const renderPerformanceChart = () => {
    // Generate some dummy performance data
    const performanceData = [];
    const today = new Date();
    const portfolioValue = portfolioStats.totalValue;
    
    // Use a deterministic approach for demo data
    // This creates a more realistic chart with trends rather than random noise
    let trend = 0;
    let volatility = 0.02;
    let lastValue = portfolioValue * 0.85; // Start at 85% of current value
    
    for (let i = 30; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      
      // Create a trend based on day of month
      if (i % 7 === 0) {
        // Change trend direction every week
        trend = (Math.sin(i) * 0.03);
      }
      
      // Add some volatility based on the asset symbols
      const assetVolatility = portfolio.reduce((sum, item) => {
        // BTC is more volatile than stablecoins
        if (item.Asset?.symbol === 'BTC') return sum + 0.01;
        if (item.Asset?.symbol === 'ETH') return sum + 0.008;
        if (item.Asset?.symbol === 'USDT') return sum + 0.001;
        return sum + 0.005;
      }, 0.01);
      
      // Calculate the day's value with trend and volatility
      const dayChange = trend + ((Math.sin(i * 0.9) + Math.cos(i * 1.1)) * assetVolatility);
      lastValue = lastValue * (1 + dayChange);
      
      // Ensure we end at the current portfolio value
      if (i === 0) {
        lastValue = portfolioValue;
      }
      
      performanceData.push({
        date: date.toLocaleDateString(),
        value: lastValue
      });
    }
    
    return (
      <Row className="mt-4">
        <Col md={12}>
          <h5 className="mb-3">Portfolio Performance (30 Days)</h5>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={performanceData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" tickFormatter={(value) => {
                const date = new Date(value);
                return date.getDate();
              }} />
              <YAxis tickFormatter={(value) => formatCurrency(value)} />
              <Tooltip formatter={(value) => formatCurrency(value)} />
              <Bar dataKey="value" fill="#8884d8" />
            </BarChart>
          </ResponsiveContainer>
        </Col>
      </Row>
    );
  };
  
  // Render holdings table
  const renderHoldingsTable = () => {
    const currentAllocations = getCurrentAllocation();
    
    return (
      <Row className="mt-4">
        <Col md={12}>
          <h5 className="mb-3">Portfolio Holdings</h5>
          <Table striped bordered hover responsive>
            <thead>
              <tr>
                <th>Asset</th>
                <th>Quantity</th>
                <th>Avg. Price</th>
                <th>Current Price</th>
                <th>Value</th>
                <th>Allocation</th>
                <th>Profit/Loss</th>
              </tr>
            </thead>
            <tbody>
              {currentAllocations.map((item, index) => {
                const profitLoss = item.quantity * (item.currentPrice - item.avgPrice);
                const profitLossPercent = item.avgPrice > 0 ? (profitLoss / (item.quantity * item.avgPrice)) * 100 : 0;
                
                return (
                  <tr key={index}>
                    <td>
                      <strong>{item.name}</strong>
                    </td>
                    <td>{item.quantity.toFixed(4)}</td>
                    <td>{formatCurrency(item.avgPrice)}</td>
                    <td>{formatCurrency(item.currentPrice)}</td>
                    <td>{formatCurrency(item.value)}</td>
                    <td>{item.allocation.toFixed(2)}%</td>
                    <td className={profitLoss >= 0 ? 'text-success' : 'text-danger'}>
                      {formatCurrency(profitLoss)}
                      <br />
                      <small>({profitLossPercent >= 0 ? '+' : ''}{profitLossPercent.toFixed(2)}%)</small>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        </Col>
      </Row>
    );
  };
  
  return (
    <Card>
      <Card.Body>
        <Card.Title>Portfolio Management</Card.Title>
        
        <Form.Group className="mb-4">
          <Form.Label>Risk Profile</Form.Label>
          <Form.Select 
            value={riskProfile} 
            onChange={(e) => setRiskProfile(e.target.value)}
          >
            <option value="conservative">Conservative</option>
            <option value="moderate">Moderate</option>
            <option value="aggressive">Aggressive</option>
          </Form.Select>
        </Form.Group>
        
        <Tabs
          activeKey={activeTab}
          onSelect={(k) => setActiveTab(k)}
          className="mb-4"
        >
          <Tab eventKey="allocation" title="Asset Allocation">
            {renderAllocationComparison()}
          </Tab>
          <Tab eventKey="performance" title="Performance">
            {renderPerformanceChart()}
            {renderHoldingsTable()}
          </Tab>
          <Tab eventKey="rebalancing" title="Rebalancing">
            {renderRebalancingRecommendations()}
          </Tab>
        </Tabs>
        
        <div className="d-grid gap-2 mt-4">
          <Button 
            variant="primary" 
            onClick={() => {
              // Simulate applying recommendations
              alert('Portfolio rebalancing recommendations applied! In a real application, this would execute the recommended trades.');
              // Change risk profile to show the effect
              setRiskProfile(prev => {
                if (prev === 'conservative') return 'moderate';
                if (prev === 'moderate') return 'aggressive';
                return 'conservative';
              });
            }}
          >
            Apply Recommended Changes
          </Button>
        </div>
      </Card.Body>
    </Card>
  );
};

export default PortfolioManagement;
