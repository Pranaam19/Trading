import React, { useState, useEffect } from 'react';
import { Card, Table, Button, Spinner, Alert, Form } from 'react-bootstrap';
import { useAuth } from '../context/AuthContext';
import { useWebSocket } from '../context/WebSocketContext';

const Watchlist = () => {
  const { user } = useAuth();
  const { priceData } = useWebSocket();
  const [watchlist, setWatchlist] = useState([]);
  const [assets, setAssets] = useState([]);
  const [selectedAsset, setSelectedAsset] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Get token from localStorage
  const token = localStorage.getItem('token');
  const isAuthenticated = !!user && !!token;

  // Fetch watchlist and available assets
  useEffect(() => {
    const fetchData = async () => {
      if (!isAuthenticated) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        // Fetch watchlist
        const watchlistResponse = await fetch('http://localhost:3001/api/trading/watchlist', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        if (!watchlistResponse.ok) {
          throw new Error('Failed to fetch watchlist');
        }

        const watchlistData = await watchlistResponse.json();
        setWatchlist(watchlistData);

        // Fetch available assets
        const assetsResponse = await fetch('http://localhost:3001/api/trading/market');
        if (!assetsResponse.ok) {
          throw new Error('Failed to fetch assets');
        }

        const assetsData = await assetsResponse.json();
        setAssets(assetsData);

        if (assetsData.length > 0 && !selectedAsset) {
          setSelectedAsset(assetsData[0].id.toString());
        }

        setLoading(false);
      } catch (error) {
        console.error('Error fetching data:', error);
        setError(error.message);
        setLoading(false);
      }
    };

    fetchData();
  }, [isAuthenticated, token, selectedAsset]);

  // Add asset to watchlist
  const addToWatchlist = async () => {
    if (!selectedAsset) return;

    try {
      setError(null);
      const response = await fetch('http://localhost:3001/api/trading/watchlist', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ assetId: selectedAsset })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to add to watchlist');
      }

      const newItem = await response.json();
      setWatchlist([...watchlist, newItem]);
    } catch (error) {
      setError(error.message);
    }
  };

  // Remove asset from watchlist
  const removeFromWatchlist = async (assetId) => {
    try {
      setError(null);
      const response = await fetch(`http://localhost:3001/api/trading/watchlist/${assetId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to remove from watchlist');
      }

      setWatchlist(watchlist.filter(item => item.assetId !== assetId));
    } catch (error) {
      setError(error.message);
    }
  };

  // Format currency
  const formatCurrency = (value) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(value);
  };

  // Calculate price change percentage
  const calculatePriceChange = (symbol, currentPrice) => {
    // For simplicity, we'll use a fixed reference price
    // In a real app, you would store historical prices
    const asset = assets.find(a => a.symbol === symbol);
    if (!asset) return 0;
    
    const referencePrice = asset.current_price * 0.98; // Simulate a reference price 2% lower
    return ((currentPrice - referencePrice) / referencePrice) * 100;
  };

  if (loading) {
    return (
      <div className="text-center mt-3">
        <Spinner animation="border" role="status">
          <span className="visually-hidden">Loading...</span>
        </Spinner>
      </div>
    );
  }

  return (
    <Card>
      <Card.Body>
        <Card.Title>Watchlist</Card.Title>
        
        {error && (
          <Alert variant="danger" onClose={() => setError(null)} dismissible>
            {error}
          </Alert>
        )}
        
        {isAuthenticated ? (
          <>
            <div className="d-flex mb-3">
              <Form.Select 
                value={selectedAsset} 
                onChange={(e) => setSelectedAsset(e.target.value)}
                className="me-2"
              >
                {assets.map(asset => (
                  <option key={asset.id} value={asset.id}>
                    {asset.name} ({asset.symbol})
                  </option>
                ))}
              </Form.Select>
              <Button onClick={addToWatchlist} variant="primary">Add</Button>
            </div>
            
            <Table responsive>
              <thead>
                <tr>
                  <th>Asset</th>
                  <th>Price</th>
                  <th>24h Change</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {watchlist.length > 0 ? (
                  watchlist.map((item) => {
                    const currentPrice = priceData[item.Asset?.symbol]?.price || item.Asset?.current_price || 0;
                    const priceChange = calculatePriceChange(item.Asset?.symbol, currentPrice);
                    
                    return (
                      <tr key={item.id}>
                        <td>{item.Asset?.symbol}</td>
                        <td>{formatCurrency(currentPrice)}</td>
                        <td className={priceChange >= 0 ? 'text-success' : 'text-danger'}>
                          {priceChange >= 0 ? '+' : ''}{priceChange.toFixed(2)}%
                        </td>
                        <td>
                          <Button 
                            variant="outline-danger" 
                            size="sm"
                            onClick={() => removeFromWatchlist(item.assetId)}
                          >
                            Remove
                          </Button>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan="4" className="text-center">No assets in watchlist</td>
                  </tr>
                )}
              </tbody>
            </Table>
          </>
        ) : (
          <Alert variant="warning">
            Please log in to manage your watchlist
          </Alert>
        )}
      </Card.Body>
    </Card>
  );
};

export default Watchlist;
