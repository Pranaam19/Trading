const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const cors = require('cors');
const dotenv = require('dotenv');
const sequelize = require('./config/database');
const { broadcastPriceUpdates } = require('./services/priceFeed');
const jwt = require('jsonwebtoken');
const orderMatchingService = require('./services/orderMatching');
const priceFeedService = require('./services/priceFeed'); // Added priceFeedService
const { User } = require('./models');

// Load environment variables
dotenv.config();

// Import routes
const authRoutes = require('./routes/auth');
const tradingRoutes = require('./routes/trading');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Make WebSocket server available globally
global.wss = wss;

// Store authenticated clients
const clients = new Map();

// Middleware
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept']
}));
app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/trading', tradingRoutes);

// WebSocket connection handling
wss.on('connection', (ws) => {
    console.log('New client connected');
    let userId = null;
    let authenticated = false;
    
    // Set up a ping interval to keep the connection alive
    const pingInterval = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
            ws.ping();
        }
    }, 30000);
    
    // Send initial data
    ws.send(JSON.stringify({
        type: 'welcome',
        message: 'Connected to trading platform'
    }));

    // Handle messages from client
    ws.on('message', async (message) => {
        try {
            const data = JSON.parse(message);
            console.log('Received message type:', data.type);
            console.log('Message data:', message.toString());
            
            // Handle different message types
            switch (data.type) {
                case 'authenticate':
                    try {
                        // Verify JWT token
                        const decoded = jwt.verify(data.token, process.env.JWT_SECRET);
                        userId = decoded.id;
                        authenticated = true;
                        console.log('Client authenticated: User ID', userId);
                        
                        // Send authentication success message
                        ws.send(JSON.stringify({
                            type: 'authentication_success',
                            userId: userId
                        }));
                        
                        // Send initial data after authentication
                        await sendInitialData(ws, userId);
                    } catch (error) {
                        console.error('Authentication error:', error.message);
                        ws.send(JSON.stringify({
                            type: 'authentication_error',
                            message: 'Invalid token'
                        }));
                    }
                    break;
                    
                case 'place_order':
                    // Handle order placement
                    if (!authenticated) {
                        console.error('Unauthenticated order placement attempt');
                        ws.send(JSON.stringify({
                            type: 'error',
                            message: 'Authentication required'
                        }));
                        break;
                    }
                    
                    try {
                        const { symbol, quantity, price, type, side } = data;
                        console.log(`Processing order: ${side} ${quantity} ${symbol} at ${price || 'market price'}`);
                        
                        // Find asset by symbol
                        const asset = await sequelize.models.Asset.findOne({
                            where: { symbol }
                        });
                        
                        if (!asset) {
                            console.error(`Asset not found: ${symbol}`);
                            ws.send(JSON.stringify({
                                type: 'error',
                                message: 'Asset not found'
                            }));
                            break;
                        }
                        
                        // Create order object
                        const orderData = {
                            userId,
                            assetId: asset.id,
                            quantity: parseFloat(quantity),
                            price: type === 'limit' ? parseFloat(price) : null,
                            type,
                            side,
                            status: 'confirmed'
                        };
                        
                        console.log('Order data:', JSON.stringify(orderData));
                        
                        // Process the order
                        const order = await orderMatchingService.processOrder(orderData);
                        console.log('Order processed:', JSON.stringify(order));
                        
                        // Notify the client who placed the order
                        ws.send(JSON.stringify({
                            type: 'order_placed',
                            order
                        }));
                        
                        // Broadcast order update to all authenticated clients
                        for (const [clientId, clientWs] of clients.entries()) {
                            if (clientWs.readyState === WebSocket.OPEN) {
                                clientWs.send(JSON.stringify({
                                    type: 'order_update',
                                    order
                                }));
                            }
                        }
                        
                        // Update order book and broadcast it
                        const orderBook = await priceFeedService.getOrderBook(asset.symbol);
                        wss.clients.forEach(client => {
                            if (client.readyState === WebSocket.OPEN) {
                                client.send(JSON.stringify({
                                    type: 'order_book_update',
                                    symbol: asset.symbol,
                                    data: orderBook,
                                    timestamp: new Date().toISOString()
                                }));
                            }
                        });
                        
                        // Broadcast portfolio update to the user who placed the order
                        if (order.status === 'filled' || order.status === 'partially_filled') {
                            // Get updated portfolio for the user
                            const updatedPortfolio = await sequelize.models.Portfolio.findAll({
                                where: { userId: userId },
                                include: [{ model: sequelize.models.Asset }]
                            });
                            
                            // Send portfolio update to the client
                            ws.send(JSON.stringify({
                                type: 'portfolio_update',
                                portfolio: updatedPortfolio
                            }));
                        }
                    } catch (error) {
                        console.error('Order placement error:', error);
                        ws.send(JSON.stringify({
                            type: 'error',
                            message: error.message
                        }));
                    }
                    break;
                    
                case 'get_portfolio':
                    // Get user's portfolio
                    if (!authenticated) {
                        console.error('Unauthenticated portfolio request attempt');
                        ws.send(JSON.stringify({
                            type: 'error',
                            message: 'Authentication required'
                        }));
                        break;
                    }
                    
                    try {
                        // Get the user's portfolio with asset information
                        const portfolio = await sequelize.models.Portfolio.findAll({
                            where: { userId },
                            include: [{ model: sequelize.models.Asset }]
                        });
                        
                        console.log(`Sending portfolio update for user ${userId}: ${portfolio.length} items`);
                        
                        // Send portfolio data
                        ws.send(JSON.stringify({
                            type: 'portfolio_update',
                            portfolio,
                            symbol: data.symbol // Pass along the symbol if it was provided
                        }));
                    } catch (error) {
                        console.error('Error fetching portfolio:', error);
                        ws.send(JSON.stringify({
                            type: 'error',
                            message: 'Failed to fetch portfolio data'
                        }));
                    }
                    break;
                    
                case 'get_order_book':
                    // Get order book for a specific asset
                    if (!data.symbol) {
                        ws.send(JSON.stringify({
                            type: 'error',
                            message: 'Symbol is required'
                        }));
                        break;
                    }
                    
                    try {
                        const assetSymbol = data.symbol;
                        const asset = await sequelize.models.Asset.findOne({
                            where: { symbol: assetSymbol }
                        });
                        
                        if (!asset) {
                            ws.send(JSON.stringify({
                                type: 'error',
                                message: `Asset ${assetSymbol} not found`
                            }));
                            break;
                        }
                        
                        // Get all pending buy and sell orders for this asset
                        const buyOrders = await sequelize.models.Order.findAll({
                            where: {
                                assetId: asset.id,
                                side: 'buy',
                                status: 'confirmed'
                            },
                            order: [['price', 'DESC']]
                        });
                        
                        const sellOrders = await sequelize.models.Order.findAll({
                            where: {
                                assetId: asset.id,
                                side: 'sell',
                                status: 'confirmed'
                            },
                            order: [['price', 'ASC']]
                        });
                        
                        // Process orders into bids and asks
                        const bids = buyOrders.map(order => ({
                            price: parseFloat(order.price),
                            quantity: parseFloat(order.quantity)
                        }));
                        
                        const asks = sellOrders.map(order => ({
                            price: parseFloat(order.price),
                            quantity: parseFloat(order.quantity)
                        }));
                        
                        console.log(`Sending order book for ${assetSymbol}: ${bids.length} bids, ${asks.length} asks`);
                        
                        // Send order book data
                        ws.send(JSON.stringify({
                            type: 'order_book_update',
                            symbol: assetSymbol,
                            data: { bids, asks },
                            timestamp: new Date().toISOString()
                        }));
                    } catch (error) {
                        console.error('Error fetching order book:', error);
                        ws.send(JSON.stringify({
                            type: 'error',
                            message: 'Failed to fetch order book data'
                        }));
                    }
                    break;
                
                default:
                    console.log(`Unknown message type: ${data.type}`);
            }
        } catch (error) {
            console.error('Error processing message:', error);
        }
    });

    // Handle client disconnection
    ws.on('close', () => {
        console.log('Client disconnected');
        clearInterval(pingInterval);
        if (userId) {
            clients.delete(userId);
        }
    });
});

// Function to send initial data after authentication
async function sendInitialData(ws, userId) {
    // Get user's portfolio
    const portfolio = await sequelize.models.Portfolio.findAll({
        where: { userId: userId },
        include: [{ model: sequelize.models.Asset }]
    });
    
    // Send portfolio data to the client
    ws.send(JSON.stringify({
        type: 'portfolio_data',
        portfolio: portfolio
    }));
    
    // Get user's open orders
    const openOrders = await sequelize.models.Order.findAll({
        where: { userId: userId, status: 'confirmed' },
        include: [{ model: sequelize.models.Asset }]
    });
    
    // Send open orders data to the client
    ws.send(JSON.stringify({
        type: 'open_orders',
        orders: openOrders
    }));
}

// Start price feed simulation
broadcastPriceUpdates(wss);

// Basic routes
app.get('/', (req, res) => {
    res.json({ message: 'Trading Platform API' });
});

// Initialize database and start server
sequelize.sync({ alter: true }).then(async () => {
    // Create some initial assets if they don't exist
    const initialAssets = [

        { symbol: 'BTC', name: 'Bitcoin', current_price: 50000 },
        { symbol: 'ETH', name: 'Ethereum', current_price: 3000 },
        { symbol: 'SOL', name: 'Solana', current_price: 100 }
    ];

    for (const asset of initialAssets) {
        await sequelize.models.Asset.findOrCreate({
            where: { symbol: asset.symbol },
            defaults: asset
        });
    }

    // Create a default admin user if no users exist
    const userCount = await sequelize.models.User.count();
    if (userCount === 0) {
        console.log('Creating default admin user...');
        await sequelize.models.User.create({
            username: 'admin',
            email: 'admin@example.com',
            password_hash: 'password123'
        });
        console.log('Default admin user created');
    }

    const PORT = process.env.PORT || 3001;
    server.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
    });
}).catch(error => {
    console.error('Unable to connect to the database:', error);
});