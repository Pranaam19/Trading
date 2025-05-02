import React, { useState, useEffect } from 'react';
import { Card, Table, Badge, Row, Col, Spinner, Alert } from 'react-bootstrap';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';

const TransactionSummary = ({ token }) => {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [summary, setSummary] = useState({
    totalBuyValue: 0,
    totalSellValue: 0,
    netValue: 0,
    totalTransactions: 0,
    assetBreakdown: {}
  });

  // Colors for the pie chart
  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D'];

  useEffect(() => {
    const fetchTransactions = async () => {
      if (!token) return;
      
      try {
        setLoading(true);
        setError(null);
        
        // Fetch all transactions with summary statistics
        const response = await fetch('/api/trading/trades?limit=10&summary=true', {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });

        if (!response.ok) {
          throw new Error(`Error: ${response.status}`);
        }

        const data = await response.json();
        console.log('Fetched transaction data:', data);
        
        // Set transactions
        const transactionData = data.trades || [];
        setTransactions(transactionData);
        
        // Use API summary if available, otherwise calculate locally
        if (data.summary) {
          console.log('Using API-provided summary statistics:', data.summary);
          setSummary({
            totalBuyValue: data.summary.totalBuyValue || 0,
            totalSellValue: data.summary.totalSellValue || 0,
            netValue: data.summary.netValue || 0,
            totalTransactions: data.summary.tradeCount || 0,
            assetBreakdown: calculateAssetBreakdown(transactionData)
          });
        } else {
          // Fallback to local calculation
          calculateSummary(transactionData);
        }
      } catch (error) {
        console.error('Error fetching transactions:', error);
        setError('Failed to load transaction data');
      } finally {
        setLoading(false);
      }
    };

    fetchTransactions();
    
    // Set up event listener for transaction updates
    const handleTransactionUpdate = () => {
      console.log('Transaction update detected, refreshing summary');
      fetchTransactions();
    };
    
    window.addEventListener('force_transaction_history_update', handleTransactionUpdate);
    window.addEventListener('force_update_all', handleTransactionUpdate);
    
    return () => {
      window.removeEventListener('force_transaction_history_update', handleTransactionUpdate);
      window.removeEventListener('force_update_all', handleTransactionUpdate);
    };
  }, [token]);

  // Calculate summary statistics from transaction data
  const calculateSummary = (transactions) => {
    let totalBuyValue = 0;
    let totalSellValue = 0;
    let assetBreakdown = calculateAssetBreakdown(transactions);
    
    transactions.forEach(transaction => {
      // Skip transactions that aren't filled or partially filled
      if (transaction.status !== 'filled' && transaction.status !== 'partially_filled') {
        return;
      }
      
      const price = parseFloat(transaction.price) || 0;
      const quantity = parseFloat(transaction.quantity) || 0;
      const value = price * quantity;
      
      // Track buy/sell totals
      if (transaction.side === 'buy') {
        totalBuyValue += value;
      } else if (transaction.side === 'sell') {
        totalSellValue += value;
      }
    });
    
    // Calculate net value
    const netValue = totalSellValue - totalBuyValue;
    
    // Set summary
    setSummary({
      totalBuyValue,
      totalSellValue,
      netValue,
      totalTransactions: transactions.length,
      assetBreakdown
    });
  };
  
  // Calculate asset breakdown from transaction data
  const calculateAssetBreakdown = (transactions) => {
    let assetBreakdown = {};
    
    transactions.forEach(transaction => {
      // Skip transactions that aren't filled or partially filled
      if (transaction.status !== 'filled' && transaction.status !== 'partially_filled') {
        return;
      }
      
      const price = parseFloat(transaction.price) || 0;
      const quantity = parseFloat(transaction.quantity) || 0;
      const value = price * quantity;
      
      // Track asset breakdown
      const symbol = transaction.Asset?.symbol || 'Unknown';
      if (!assetBreakdown[symbol]) {
        assetBreakdown[symbol] = {
          buyValue: 0,
          sellValue: 0,
          netValue: 0,
          transactions: 0
        };
      }
      
      assetBreakdown[symbol].transactions += 1;
      
      if (transaction.side === 'buy') {
        assetBreakdown[symbol].buyValue += value;
      } else if (transaction.side === 'sell') {
        assetBreakdown[symbol].sellValue += value;
      }
      
      assetBreakdown[symbol].netValue = assetBreakdown[symbol].sellValue - assetBreakdown[symbol].buyValue;
    });
    
    return assetBreakdown;
  };

  // Format currency
  const formatCurrency = (value) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(value);
  };

  // Prepare data for pie chart
  const getPieChartData = () => {
    return Object.entries(summary.assetBreakdown).map(([symbol, data]) => ({
      name: symbol,
      value: Math.abs(data.netValue)
    }));
  };

  if (loading) {
    return (
      <Card className="mb-4">
        <Card.Body>
          <Card.Title>Transaction Summary</Card.Title>
          <div className="text-center p-4">
            <Spinner animation="border" role="status">
              <span className="visually-hidden">Loading...</span>
            </Spinner>
          </div>
        </Card.Body>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="mb-4">
        <Card.Body>
          <Card.Title>Transaction Summary</Card.Title>
          <Alert variant="danger">{error}</Alert>
        </Card.Body>
      </Card>
    );
  }

  return (
    <Card className="mb-4 transaction-summary-container">
      <Card.Body>
        <Card.Title>Transaction Summary</Card.Title>
        
        <Row className="mb-4">
          <Col md={4} className="mb-3">
            <Card className="h-100">
              <Card.Body>
                <h5>Total Buy Value</h5>
                <h3 className={`${summary.totalBuyValue > 0 ? 'text-danger' : 'text-muted'}`}>
                  {formatCurrency(summary.totalBuyValue)}
                </h3>
              </Card.Body>
            </Card>
          </Col>
          <Col md={4} className="mb-3">
            <Card className="h-100">
              <Card.Body>
                <h5>Total Sell Value</h5>
                <h3 className={`${summary.totalSellValue > 0 ? 'text-success' : 'text-muted'}`}>
                  {formatCurrency(summary.totalSellValue)}
                </h3>
              </Card.Body>
            </Card>
          </Col>
          <Col md={4} className="mb-3">
            <Card className="h-100">
              <Card.Body>
                <h5>Net Value</h5>
                <h3 className={`${summary.netValue > 0 ? 'text-success' : summary.netValue < 0 ? 'text-danger' : 'text-muted'}`}>
                  {formatCurrency(summary.netValue)}
                </h3>
              </Card.Body>
            </Card>
          </Col>
        </Row>
        
        <Row>
          <Col md={6} className="mb-3">
            <h5>Transaction Breakdown by Asset</h5>
            <Table striped bordered hover responsive>
              <thead>
                <tr>
                  <th>Asset</th>
                  <th>Buy Value</th>
                  <th>Sell Value</th>
                  <th>Net Value</th>
                  <th>Transactions</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(summary.assetBreakdown).map(([symbol, data]) => (
                  <tr key={symbol}>
                    <td>{symbol}</td>
                    <td className="text-danger">{formatCurrency(data.buyValue)}</td>
                    <td className="text-success">{formatCurrency(data.sellValue)}</td>
                    <td className={data.netValue > 0 ? 'text-success' : data.netValue < 0 ? 'text-danger' : ''}>
                      {formatCurrency(data.netValue)}
                    </td>
                    <td>{data.transactions}</td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </Col>
          <Col md={6} className="mb-3">
            <h5>Value Distribution</h5>
            <div style={{ height: '300px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={getPieChartData()}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                    label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                  >
                    {getPieChartData().map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => formatCurrency(value)} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </Col>
        </Row>
        
        <div className="mt-3">
          <small className="text-muted">
            Total transactions: {summary.totalTransactions} | 
            Last updated: {new Date().toLocaleString()}
          </small>
        </div>
      </Card.Body>
    </Card>
  );
};

export default TransactionSummary;
