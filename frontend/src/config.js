// Configuration for the frontend application

// API URL
export const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

// WebSocket URL
export const WS_URL = process.env.REACT_APP_WS_URL || 'ws://localhost:5000';

// Other configuration settings
export const DEFAULT_CURRENCY = 'USD';
export const DEFAULT_ASSET = 'BTC';
export const REFRESH_INTERVAL = 5000; // 5 seconds
export const ORDER_HISTORY_LIMIT = 50;
export const PRICE_DECIMAL_PLACES = 2;
export const QUANTITY_DECIMAL_PLACES = 4;
