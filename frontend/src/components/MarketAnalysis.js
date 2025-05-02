import React, { useState } from 'react';
import { Card, Nav, Table, Badge, ProgressBar } from 'react-bootstrap';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const MarketAnalysis = ({ selectedAsset }) => {
  const [activeTab, setActiveTab] = useState('technical');
  
  // Mock data for technical indicators
  const technicalIndicators = [
    { name: 'RSI (14)', value: 58.3, interpretation: 'Neutral', color: 'warning' },
    { name: 'MACD', value: 'Bullish', interpretation: 'Buy', color: 'success' },
    { name: 'Moving Avg (50)', value: '$47,250', interpretation: 'Above', color: 'success' },
    { name: 'Moving Avg (200)', value: '$42,100', interpretation: 'Above', color: 'success' },
    { name: 'Bollinger Bands', value: 'Middle', interpretation: 'Neutral', color: 'warning' },
    { name: 'Stochastic', value: 72.5, interpretation: 'Overbought', color: 'danger' },
  ];
  
  // Mock data for market sentiment
  const sentimentData = [
    { name: 'Social Media', positive: 65, negative: 35 },
    { name: 'News Articles', positive: 58, negative: 42 },
    { name: 'Trading Volume', positive: 70, negative: 30 },
    { name: 'Institutional', positive: 62, negative: 38 },
    { name: 'Retail', positive: 55, negative: 45 },
  ];
  
  // Mock data for volume analysis
  const volumeData = [
    { name: '9:00', volume: 1200 },
    { name: '10:00', volume: 1800 },
    { name: '11:00', volume: 1400 },
    { name: '12:00', volume: 2200 },
    { name: '13:00', volume: 1600 },
    { name: '14:00', volume: 2800 },
    { name: '15:00', volume: 3200 },
    { name: '16:00', volume: 2400 },
  ];
  
  // Mock price predictions
  const predictions = [
    { timeframe: '24 Hours', low: 46800, high: 48500, prediction: 47900, confidence: 'Medium' },
    { timeframe: '7 Days', low: 45200, high: 51000, prediction: 49500, confidence: 'Low' },
    { timeframe: '30 Days', low: 42000, high: 55000, prediction: 52000, confidence: 'Very Low' },
  ];
  
  const renderTechnicalAnalysis = () => (
    <Table striped hover>
      <thead>
        <tr>
          <th>Indicator</th>
          <th>Value</th>
          <th>Signal</th>
        </tr>
      </thead>
      <tbody>
        {technicalIndicators.map((indicator, index) => (
          <tr key={index}>
            <td>{indicator.name}</td>
            <td>{indicator.value}</td>
            <td>
              <Badge bg={indicator.color}>{indicator.interpretation}</Badge>
            </td>
          </tr>
        ))}
      </tbody>
    </Table>
  );
  
  const renderSentimentAnalysis = () => (
    <div>
      <h6 className="mb-3">Market Sentiment for {selectedAsset}</h6>
      {sentimentData.map((item, index) => (
        <div key={index} className="mb-3">
          <div className="d-flex justify-content-between mb-1">
            <span>{item.name}</span>
            <span>
              <span className="text-success">{item.positive}%</span> / 
              <span className="text-danger">{item.negative}%</span>
            </span>
          </div>
          <ProgressBar>
            <ProgressBar variant="success" now={item.positive} key={1} />
            <ProgressBar variant="danger" now={item.negative} key={2} />
          </ProgressBar>
        </div>
      ))}
    </div>
  );
  
  const renderVolumeAnalysis = () => (
    <div>
      <h6 className="mb-3">Trading Volume (24h)</h6>
      <ResponsiveContainer width="100%" height={250}>
        <BarChart data={volumeData}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="name" />
          <YAxis />
          <Tooltip />
          <Legend />
          <Bar dataKey="volume" fill="#8884d8" name="Volume" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
  
  const renderPricePredictions = () => (
    <div>
      <h6 className="mb-3">Price Predictions for {selectedAsset}</h6>
      <Table striped hover>
        <thead>
          <tr>
            <th>Timeframe</th>
            <th>Range</th>
            <th>Prediction</th>
            <th>Confidence</th>
          </tr>
        </thead>
        <tbody>
          {predictions.map((pred, index) => (
            <tr key={index}>
              <td>{pred.timeframe}</td>
              <td>${pred.low.toLocaleString()} - ${pred.high.toLocaleString()}</td>
              <td className="text-primary">${pred.prediction.toLocaleString()}</td>
              <td>
                <Badge bg={
                  pred.confidence === 'High' ? 'success' :
                  pred.confidence === 'Medium' ? 'warning' :
                  pred.confidence === 'Low' ? 'danger' : 'secondary'
                }>
                  {pred.confidence}
                </Badge>
              </td>
            </tr>
          ))}
        </tbody>
      </Table>
      <small className="text-muted d-block mt-2">
        Note: These predictions are based on historical data and market sentiment analysis. 
        They should not be considered as financial advice.
      </small>
    </div>
  );
  
  return (
    <Card>
      <Card.Body>
        <Card.Title>Market Analysis - {selectedAsset}</Card.Title>
        <Nav variant="tabs" className="mb-3" activeKey={activeTab} onSelect={(k) => setActiveTab(k)}>
          <Nav.Item>
            <Nav.Link eventKey="technical">Technical</Nav.Link>
          </Nav.Item>
          <Nav.Item>
            <Nav.Link eventKey="sentiment">Sentiment</Nav.Link>
          </Nav.Item>
          <Nav.Item>
            <Nav.Link eventKey="volume">Volume</Nav.Link>
          </Nav.Item>
          <Nav.Item>
            <Nav.Link eventKey="predictions">Predictions</Nav.Link>
          </Nav.Item>
        </Nav>
        
        {activeTab === 'technical' && renderTechnicalAnalysis()}
        {activeTab === 'sentiment' && renderSentimentAnalysis()}
        {activeTab === 'volume' && renderVolumeAnalysis()}
        {activeTab === 'predictions' && renderPricePredictions()}
      </Card.Body>
    </Card>
  );
};

export default MarketAnalysis;
