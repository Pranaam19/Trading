import React, { useState } from 'react';
import { Card, Row, Col, Form, Table, ProgressBar, Alert } from 'react-bootstrap';
import { LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const RiskAnalysis = ({ portfolio, priceData }) => {
  const [investmentAmount, setInvestmentAmount] = useState(10000);
  
  // Format currency
  const formatCurrency = (value) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(value);
  };
  
  // Calculate portfolio volatility (simplified for demo)
  const calculateVolatility = () => {
    // In a real app, this would use historical price data
    // For demo, we'll use hardcoded values based on asset type
    const volatilityMap = {
      'BTC': 0.65, // 65% annual volatility
      'ETH': 0.75,
      'SOL': 0.85,
      'USDT': 0.01
    };
    
    if (!portfolio || portfolio.length === 0) return 0.5; // Default value
    
    // Calculate weighted volatility
    const totalValue = calculatePortfolioValue();
    if (totalValue <= 0) return 0.5; // Default if no value
    
    let weightedVolatility = 0;
    
    portfolio.forEach(item => {
      if (!item.Asset || !item.Asset.symbol || !item.quantity) return;
      
      const currentPrice = priceData[item.Asset.symbol]?.price || item.Asset.current_price || 0;
      const value = parseFloat(item.quantity) * currentPrice;
      if (isNaN(value) || value <= 0) return;
      
      const weight = value / totalValue;
      const volatility = volatilityMap[item.Asset.symbol] || 0.5;
      
      weightedVolatility += weight * volatility;
    });
    
    return isNaN(weightedVolatility) ? 0.5 : weightedVolatility;
  };
  
  // Calculate total portfolio value
  const calculatePortfolioValue = () => {
    if (!portfolio || portfolio.length === 0) return 0;
    
    const value = portfolio.reduce((total, item) => {
      if (!item.Asset || !item.Asset.symbol || !item.quantity) return total;
      
      const currentPrice = priceData[item.Asset.symbol]?.price || item.Asset.current_price || 0;
      const itemValue = parseFloat(item.quantity) * currentPrice;
      
      return total + (isNaN(itemValue) ? 0 : itemValue);
    }, 0);
    
    return isNaN(value) ? 0 : value;
  };
  
  // Calculate Value at Risk (VaR)
  const calculateVaR = (confidenceLevel) => {
    const volatility = calculateVolatility();
    const portfolioValue = calculatePortfolioValue();
    
    // Z-scores for different confidence levels
    const zScores = {
      '95': 1.645,
      '99': 2.326,
      '99.9': 3.090
    };
    
    const zScore = zScores[confidenceLevel] || 1.645;
    const dailyVaR = portfolioValue * volatility * zScore / Math.sqrt(252);
    
    return dailyVaR;
  };
  
  // Generate Monte Carlo simulation data
  const generateMonteCarloData = () => {
    const volatility = calculateVolatility();
    const initialValue = investmentAmount > 0 ? investmentAmount : 10000;
    const days = 252; // Trading days in a year
    const simulations = 5; // Number of simulations to show
    const dailyReturn = 0.0003; // Expected daily return (simplified)
    
    const simulationData = [];
    
    for (let day = 0; day <= days; day++) {
      const dataPoint = { day };
      
      for (let sim = 1; sim <= simulations; sim++) {
        let value = initialValue;
        
        // Calculate cumulative value for this simulation up to this day
        for (let d = 1; d <= day; d++) {
          // Random daily return based on volatility
          const randomReturn = dailyReturn + volatility * (Math.random() - 0.5) / Math.sqrt(252);
          value *= (1 + randomReturn);
        }
        
        // Ensure no NaN values in the chart
        dataPoint[`sim${sim}`] = isNaN(value) ? initialValue : value;
      }
      
      // Only add every 10th day to keep the chart manageable
      if (day % 10 === 0) {
        simulationData.push(dataPoint);
      }
    }
    
    return simulationData;
  };
  
  // Calculate risk metrics for each asset
  const calculateAssetRiskMetrics = () => {
    if (!portfolio || portfolio.length === 0) return [];
    
    // Volatility map (simplified for demo)
    const volatilityMap = {
      'BTC': 0.65,
      'ETH': 0.75,
      'SOL': 0.85,
      'USDT': 0.01
    };
    
    // Correlation with market (simplified for demo)
    const correlationMap = {
      'BTC': 0.8,
      'ETH': 0.7,
      'SOL': 0.6,
      'USDT': 0.1
    };
    
    // Filter out invalid assets
    const validPortfolio = portfolio.filter(item => 
      item && item.Asset && item.Asset.symbol && 
      !isNaN(parseFloat(item.quantity)) && 
      parseFloat(item.quantity) > 0
    );
    
    return validPortfolio.map(item => {
      const currentPrice = priceData[item.Asset?.symbol]?.price || item.Asset?.current_price || 0;
      const value = item.quantity * currentPrice;
      const volatility = volatilityMap[item.Asset?.symbol] || 0.5;
      const correlation = correlationMap[item.Asset?.symbol] || 0.5;
      const beta = volatility * correlation / 0.2; // Simplified beta calculation
      
      return {
        symbol: item.Asset?.symbol,
        value,
        volatility,
        beta,
        riskContribution: value * volatility / calculatePortfolioValue()
      };
    });
  };
  
  // Get risk level description
  const getRiskLevel = () => {
    const volatility = calculateVolatility();
    
    if (volatility < 0.3) return { level: 'Low', color: 'success' };
    if (volatility < 0.6) return { level: 'Medium', color: 'warning' };
    return { level: 'High', color: 'danger' };
  };
  
  const riskLevel = getRiskLevel();
  const monteCarloData = generateMonteCarloData();
  const assetRiskMetrics = calculateAssetRiskMetrics();
  const portfolioValue = calculatePortfolioValue();
  const var95 = calculateVaR('95');
  const var99 = calculateVaR('99');
  const var999 = calculateVaR('99.9');
  const riskColor = riskLevel.color;
  
  return (
    <Card className="mb-4">
      <Card.Body>
        <Card.Title>Risk Analysis</Card.Title>
        <Row className="mb-4">
          <Col md={6}>
            <Card>
              <Card.Body>
                <Card.Title>Portfolio Risk Summary</Card.Title>
                <div className="d-flex justify-content-between mb-3">
                  <div>
                    <h6>Total Value:</h6>
                    <h4>{formatCurrency(portfolioValue)}</h4>
                    {portfolioValue <= 0 && (
                      <Alert variant="warning" className="mt-2 p-2">
                        <small>Add assets to your portfolio to see accurate risk analysis</small>
                      </Alert>
                    )}
                  </div>
                  <div>
                    <h6>Risk Level:</h6>
                    <h4 className={`text-${riskColor}`}>{riskLevel.level}</h4>
                  </div>
                </div>
                <div className="text-center my-4">
                  <h3 className={`text-${riskColor}`}>{riskLevel.level}</h3>
                  <ProgressBar className="mt-2">
                    <ProgressBar variant="success" now={30} key={1} />
                    <ProgressBar variant="warning" now={30} key={2} />
                    <ProgressBar variant="danger" now={40} key={3} />
                  </ProgressBar>
                </div>
                <p className="small text-muted">
                  Portfolio Volatility: {(calculateVolatility() * 100).toFixed(2)}% annually
                </p>
              </Card.Body>
            </Card>
          </Col>
          <Col md={6}>
            <Card>
              <Card.Body>
                <Card.Title>Portfolio Value at Risk (VaR)</Card.Title>
                <Table striped bordered hover>
                  <thead>
                    <tr>
                      <th>Confidence Level</th>
                      <th>Daily VaR</th>
                      <th>% of Portfolio</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>95%</td>
                      <td>{formatCurrency(var95)}</td>
                      <td>{portfolioValue > 0 ? (var95 / portfolioValue * 100).toFixed(2) : '0.00'}%</td>
                    </tr>
                    <tr>
                      <td>99%</td>
                      <td>{formatCurrency(var99)}</td>
                      <td>{portfolioValue > 0 ? (var99 / portfolioValue * 100).toFixed(2) : '0.00'}%</td>
                    </tr>
                    <tr>
                      <td>99.9%</td>
                      <td>{formatCurrency(var999)}</td>
                      <td>{portfolioValue > 0 ? (var999 / portfolioValue * 100).toFixed(2) : '0.00'}%</td>
                    </tr>
                  </tbody>
                </Table>
                <p className="small text-muted mt-2">
                  Example: With 95% confidence, your portfolio will not lose more than {formatCurrency(calculateVaR('95'))} in a single day.
                </p>
              </Card.Body>
            </Card>
          </Col>
        </Row>
        
        <Row className="mb-4">
          <Col>
            <Card>
              <Card.Body>
                <Card.Title>Monte Carlo Simulation</Card.Title>
                <Form.Group className="mb-3">
                  <Form.Label>Investment Amount</Form.Label>
                  <Form.Control 
                    type="number" 
                    value={investmentAmount}
                    onChange={(e) => setInvestmentAmount(Number(e.target.value))}
                    min="1000"
                    step="1000"
                  />
                </Form.Group>
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={monteCarloData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="day" label={{ value: 'Trading Days', position: 'insideBottom', offset: -5 }} />
                    <YAxis label={{ value: 'Portfolio Value ($)', angle: -90, position: 'insideLeft' }} />
                    <Tooltip formatter={(value) => formatCurrency(value)} />
                    <Legend />
                    <Area type="monotone" dataKey="sim1" stroke="#8884d8" fill="#8884d8" fillOpacity={0.1} name="Simulation 1" />
                    <Area type="monotone" dataKey="sim2" stroke="#82ca9d" fill="#82ca9d" fillOpacity={0.1} name="Simulation 2" />
                    <Area type="monotone" dataKey="sim3" stroke="#ffc658" fill="#ffc658" fillOpacity={0.1} name="Simulation 3" />
                    <Area type="monotone" dataKey="sim4" stroke="#ff8042" fill="#ff8042" fillOpacity={0.1} name="Simulation 4" />
                    <Area type="monotone" dataKey="sim5" stroke="#0088fe" fill="#0088fe" fillOpacity={0.1} name="Simulation 5" />
                  </AreaChart>
                </ResponsiveContainer>
                <p className="small text-muted mt-2">
                  This simulation shows potential portfolio value paths over one year based on historical volatility.
                </p>
              </Card.Body>
            </Card>
          </Col>
        </Row>
        
        <Row>
          <Col>
            <Card>
              <Card.Body>
                <Card.Title>Asset Risk Contribution</Card.Title>
                <Table striped bordered hover>
                  <thead>
                    <tr>
                      <th>Asset</th>
                      <th>Value</th>
                      <th>Volatility</th>
                      <th>Beta</th>
                      <th>Risk Contribution</th>
                    </tr>
                  </thead>
                  <tbody>
                    {assetRiskMetrics.map((asset, index) => (
                      <tr key={index}>
                        <td>{asset.symbol}</td>
                        <td>{formatCurrency(asset.value)}</td>
                        <td>{(asset.volatility * 100).toFixed(2)}%</td>
                        <td>{asset.beta.toFixed(2)}</td>
                        <td>
                          <div className="d-flex align-items-center">
                            <div className="me-2" style={{ width: '60px' }}>
                              {(asset.riskContribution * 100).toFixed(2)}%
                            </div>
                            <ProgressBar 
                              now={asset.riskContribution * 100} 
                              variant={asset.riskContribution > 0.5 ? 'danger' : asset.riskContribution > 0.3 ? 'warning' : 'success'}
                              style={{ width: '100%' }} 
                            />
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
                <Alert variant="info" className="mt-3">
                  <strong>Risk Diversification Tip:</strong> Assets with high risk contribution may be overrepresented in your portfolio. Consider rebalancing to reduce concentration risk.
                </Alert>
              </Card.Body>
            </Card>
          </Col>
        </Row>
      </Card.Body>
    </Card>
  );
};

export default RiskAnalysis;
