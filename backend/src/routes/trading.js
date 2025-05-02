const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { Order, Asset, Portfolio, Watchlist } = require('../models');
const orderMatchingService = require('../services/orderMatching');
const sequelize = require('../models/index').sequelize;
const { Op } = require('sequelize');

// Get user's portfolio
// Get user's portfolio with calculated total value and allocation
router.get('/portfolio', auth, async (req, res) => {
    try {
        // Get the user's portfolio with asset details
        const portfolio = await Portfolio.findAll({
            where: { userId: req.user.id },
            include: [Asset]
        });
        
        // Get all confirmed, filled, and partially filled orders to calculate the most accurate portfolio
        const orders = await Order.findAll({
            where: { 
                userId: req.user.id,
                status: {
                    [Op.in]: ['confirmed', 'filled', 'partially_filled']
                }
            },
            include: [Asset],
            order: [['createdAt', 'DESC']]
        });
        
        console.log(`Found ${orders.length} orders for portfolio calculation`);
        
        // Create a map to track the latest position for each asset
        const assetPositions = new Map();
        
        // Process orders to get the most up-to-date positions
        orders.forEach(order => {
            const assetId = order.assetId;
            const symbol = order.Asset?.symbol;
            const quantity = parseFloat(order.quantity) || 0;
            const price = parseFloat(order.price) || 0;
            
            if (!assetPositions.has(assetId)) {
                assetPositions.set(assetId, {
                    assetId,
                    symbol,
                    Asset: order.Asset,
                    quantity: order.side === 'buy' ? quantity : -quantity,
                    totalCost: order.side === 'buy' ? quantity * price : 0
                });
            } else {
                const position = assetPositions.get(assetId);
                if (order.side === 'buy') {
                    position.quantity += quantity;
                    position.totalCost += quantity * price;
                } else {
                    position.quantity -= quantity;
                }
                assetPositions.set(assetId, position);
            }
        });
        
        // Calculate total portfolio value and allocation percentages
        let totalValue = 0;
        
        // Convert positions to portfolio items and calculate values
        const calculatedPortfolio = Array.from(assetPositions.values())
            .filter(position => position.quantity > 0)
            .map(position => {
                const currentPrice = parseFloat(position.Asset.current_price) || 0;
                const value = position.quantity * currentPrice;
                totalValue += value;
                
                return {
                    ...position,
                    average_price: position.totalCost / position.quantity,
                    value
                };
            });
        
        // Add allocation percentages
        const portfolioWithAllocation = calculatedPortfolio.map(item => ({
            ...item,
            allocation: totalValue > 0 ? (item.value / totalValue * 100) : 0
        }));
        
        // Return the enhanced portfolio data
        res.json({
            portfolio: portfolioWithAllocation,
            totalValue,
            lastUpdated: new Date().toISOString()
        });
    } catch (error) {
        console.error('Error fetching portfolio:', error);
        res.status(500).json({ error: error.message });
    }
});

// Place new order
router.post('/orders', auth, async (req, res) => {
    try {
        const { assetId, quantity, price, type, side } = req.body;
        console.log(`Received order request: ${side} ${quantity} of asset ${assetId} at ${price || 'market price'}, type: ${type}`);

        // Validate input
        if (!assetId || !quantity || (type === 'limit' && !price)) {
            console.error('Missing required fields:', { assetId, quantity, price, type });
            return res.status(400).json({ error: 'Missing required fields' });
        }

        // For sell orders, check if user has enough assets
        if (side === 'sell') {
            const portfolio = await Portfolio.findOne({
                where: {
                    userId: req.user.id,
                    assetId
                }
            });

            console.log(`Portfolio check for sell order: User ${req.user.id}, Asset ${assetId}, Available: ${portfolio?.quantity || 0}, Requested: ${quantity}`);

            if (!portfolio || parseFloat(portfolio.quantity) < parseFloat(quantity)) {
                console.error(`Insufficient assets: Available ${portfolio?.quantity || 0}, Requested ${quantity}`);
                return res.status(400).json({ error: 'Insufficient assets' });
            }
        }

        // Get asset details for logging
        const asset = await Asset.findByPk(assetId);
        if (!asset) {
            console.error(`Asset not found: ${assetId}`);
            return res.status(404).json({ error: 'Asset not found' });
        }
        console.log(`Processing order for asset: ${asset.symbol} (${asset.name})`);

        // Create order object
        const orderData = {
            userId: req.user.id,
            assetId,
            quantity: parseFloat(quantity),
            price: type === 'limit' ? parseFloat(price) : null,
            type,
            side,
            status: 'confirmed'
        };

        console.log('Order data prepared:', orderData);

        // Process the order through the matching service
        const order = await orderMatchingService.processOrder(orderData);
        console.log(`Order processed successfully: ID ${order.id}, Status: ${order.status}`);

        // Notify all clients about the new order via WebSocket
        if (global.wss) {
            global.wss.clients.forEach(client => {
                if (client.readyState === 1) { // WebSocket.OPEN
                    client.send(JSON.stringify({
                        type: 'order_placed',
                        order: order,
                        timestamp: new Date().toISOString()
                    }));
                }
            });
        }

        res.status(201).json(order);
    } catch (error) {
        console.error('Order placement error:', error);
        res.status(400).json({ error: error.message });
    }
});

// Get user's orders
router.get('/orders', auth, async (req, res) => {
    try {
        console.log(`Fetching orders for user ${req.user.id}`);
        
        // Get query parameters for filtering
        const status = req.query.status || 'all';
        const limit = parseInt(req.query.limit) || 50;
        
        // Build the where clause based on filters
        const whereClause = { userId: req.user.id };
        
        // Filter by status if specified
        if (status !== 'all') {
            whereClause.status = status;
        }
        
        const orders = await Order.findAll({
            where: whereClause,
            include: [Asset],
            order: [['createdAt', 'DESC']],
            limit
        });
        
        console.log(`Found ${orders.length} orders for user ${req.user.id} with status ${status}`);
        
        // Log the first few orders for debugging
        if (orders.length > 0) {
            console.log(`Sample order data: ${JSON.stringify(orders[0])}`);
        }
        
        res.json(orders);
    } catch (error) {
        console.error(`Error fetching orders for user ${req.user.id}:`, error);
        res.status(500).json({ error: error.message });
    }
});

// Get all user's orders (including filled and partially filled)
router.get('/all-orders', auth, async (req, res) => {
    try {
        const orders = await Order.findAll({
            where: { 
                userId: req.user.id,
                status: {
                    [Op.in]: ['filled', 'partially_filled']
                }
            },
            include: [Asset],
            order: [['createdAt', 'DESC']]
        });
        
        console.log(`Fetched ${orders.length} filled/partially filled orders for user ${req.user.id}`);
        res.json(orders);
    } catch (error) {
        console.error('Error fetching all orders:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get user's trade history (completed trades)
router.get('/trades', auth, async (req, res) => {
    try {
        // Get filter from query params
        const filter = req.query.filter || 'all';
        const summary = req.query.summary === 'true';
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const offset = (page - 1) * limit;
        
        console.log(`Fetching trades for user ${req.user.id}, filter: ${filter}, summary: ${summary}, page: ${page}`);
        
        // Build where clause based on filter
        const whereClause = { userId: req.user.id };
        
        if (filter !== 'all') {
            whereClause.side = filter;
        }
        
        // Only include filled or partially filled orders
        whereClause.status = {
            [Op.in]: ['filled', 'partially_filled']
        };
        
        // Count total trades for pagination
        const totalTrades = await Order.count({
            where: whereClause
        });
        
        // Fetch orders with pagination
        const trades = await Order.findAll({
            where: whereClause,
            include: [Asset],
            order: [['createdAt', 'DESC']],
            limit,
            offset
        });
        
        console.log(`Found ${trades.length} trades for user ${req.user.id} (total: ${totalTrades})`);
        
        // If summary is requested, calculate totals
        if (summary) {
            let totalBuyValue = 0;
            let totalSellValue = 0;
            let totalBuyQuantity = 0;
            let totalSellQuantity = 0;
            let assetSummary = {};
            
            // For summary, we need all trades, not just the paginated ones
            const allTrades = await Order.findAll({
                where: whereClause,
                include: [Asset]
            });
            
            allTrades.forEach(trade => {
                const value = trade.price * trade.quantity;
                
                if (trade.side === 'buy') {
                    totalBuyValue += value;
                    totalBuyQuantity += parseFloat(trade.quantity);
                } else {
                    totalSellValue += value;
                    totalSellQuantity += parseFloat(trade.quantity);
                }
                
                // Add to asset summary
                const symbol = trade.Asset.symbol;
                if (!assetSummary[symbol]) {
                    assetSummary[symbol] = {
                        buyValue: 0,
                        sellValue: 0,
                        buyQuantity: 0,
                        sellQuantity: 0,
                        netQuantity: 0,
                        netValue: 0
                    };
                }
                
                if (trade.side === 'buy') {
                    assetSummary[symbol].buyValue += value;
                    assetSummary[symbol].buyQuantity += parseFloat(trade.quantity);
                } else {
                    assetSummary[symbol].sellValue += value;
                    assetSummary[symbol].sellQuantity += parseFloat(trade.quantity);
                }
                
                assetSummary[symbol].netQuantity = assetSummary[symbol].buyQuantity - assetSummary[symbol].sellQuantity;
                assetSummary[symbol].netValue = assetSummary[symbol].buyValue - assetSummary[symbol].sellValue;
            });
            
            const netValue = totalBuyValue - totalSellValue;
            const netQuantity = totalBuyQuantity - totalSellQuantity;
            
            res.json({
                trades,
                pagination: {
                    page,
                    limit,
                    totalPages: Math.ceil(totalTrades / limit),
                    totalItems: totalTrades
                },
                summary: {
                    totalBuyValue,
                    totalSellValue,
                    netValue,
                    totalBuyQuantity,
                    totalSellQuantity,
                    netQuantity,
                    count: allTrades.length,
                    assetSummary
                }
            });
        } else {
            res.json({
                trades,
                pagination: {
                    page,
                    limit,
                    totalPages: Math.ceil(totalTrades / limit),
                    totalItems: totalTrades
                }
            });
        }
    } catch (error) {
        console.error('Error fetching trades:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get order status timeline
router.get('/order-timeline/:orderId', auth, async (req, res) => {
    try {
        const { orderId } = req.params;
        console.log(`Fetching order timeline for order ${orderId}`);
        
        // Verify the order belongs to the user
        const order = await Order.findOne({
            where: {
                id: orderId,
                userId: req.user.id
            },
            include: [Asset]
        });
        
        if (!order) {
            return res.status(404).json({ error: 'Order not found' });
        }
        
        // Create a timeline of events for this order
        const timeline = [
            {
                status: 'created',
                timestamp: order.createdAt,
                message: `${order.side === 'buy' ? 'Buy' : 'Sell'} order created for ${order.quantity} ${order.Asset.symbol} at ${order.price}`
            }
        ];
        
        // Add status change events based on order status
        if (order.status === 'filled') {
            timeline.push({
                status: 'filled',
                timestamp: order.updatedAt,
                message: `Order fully filled at ${order.price}`
            });
        } else if (order.status === 'partially_filled') {
            timeline.push({
                status: 'partially_filled',
                timestamp: order.updatedAt,
                message: `Order partially filled at ${order.price}`
            });
        } else if (order.status === 'cancelled') {
            timeline.push({
                status: 'cancelled',
                timestamp: order.updatedAt,
                message: 'Order was cancelled'
            });
        }
        
        res.json({
            order,
            timeline
        });
    } catch (error) {
        console.error(`Error fetching order timeline:`, error);
        res.status(500).json({ error: error.message });
    }
});

// Get order book for a specific symbol
router.get('/order-book/:symbol', auth, async (req, res) => {
    try {
        const { symbol } = req.params;
        
        // Find the asset by symbol
        const asset = await Asset.findOne({ where: { symbol } });
        
        if (!asset) {
            return res.status(404).json({ error: `Asset ${symbol} not found` });
        }
        
        // Get all pending buy and sell orders for this asset
        const buyOrders = await Order.findAll({
            where: {
                assetId: asset.id,
                side: 'buy',
                status: 'confirmed'
            },
            order: [['price', 'DESC']]
        });
        
        const sellOrders = await Order.findAll({
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
        
        console.log(`Sending order book for ${symbol}: ${bids.length} bids, ${asks.length} asks`);
        
        res.json({
            symbol,
            bids,
            asks,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('Error fetching order book:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get market data
router.get('/market', async (req, res) => {
    try {
        const assets = await Asset.findAll();
        res.json(assets);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get order book for an asset
router.get('/orderbook/:assetId', async (req, res) => {
    try {
        const { assetId } = req.params;
        console.log(`Fetching order book for asset ID ${assetId}`);
        
        // Get buy orders (bids)
        const bids = await Order.findAll({
            where: {
                assetId,
                side: 'buy',
                status: 'confirmed',
                type: 'limit'
            },
            attributes: ['price', [sequelize.fn('sum', sequelize.col('quantity')), 'quantity']],
            group: ['price'],
            order: [['price', 'DESC']]
        });

        // Get sell orders (asks)
        const asks = await Order.findAll({
            where: {
                assetId,
                side: 'sell',
                status: 'confirmed',
                type: 'limit'
            },
            attributes: ['price', [sequelize.fn('sum', sequelize.col('quantity')), 'quantity']],
            group: ['price'],
            order: [['price', 'ASC']]
        });

        console.log(`Order book for asset ${assetId}: ${bids.length} bids, ${asks.length} asks`);
        res.json({ bids, asks });
    } catch (error) {
        console.error(`Error fetching order book for asset ${assetId}:`, error);
        res.status(500).json({ error: error.message });
    }
});

// Get user's watchlist
router.get('/watchlist', auth, async (req, res) => {
    try {
        const watchlist = await Watchlist.findAll({
            where: { userId: req.user.id },
            include: [Asset]
        });
        res.json(watchlist);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Add asset to watchlist
router.post('/watchlist', auth, async (req, res) => {
    try {
        const { assetId } = req.body;

        if (!assetId) {
            return res.status(400).json({ error: 'Asset ID is required' });
        }

        // Check if asset exists
        const asset = await Asset.findByPk(assetId);
        if (!asset) {
            return res.status(404).json({ error: 'Asset not found' });
        }

        // Check if already in watchlist
        const existing = await Watchlist.findOne({
            where: {
                userId: req.user.id,
                assetId
            }
        });

        if (existing) {
            return res.status(400).json({ error: 'Asset already in watchlist' });
        }

        // Add to watchlist
        const watchlistItem = await Watchlist.create({
            userId: req.user.id,
            assetId
        });

        res.status(201).json({
            ...watchlistItem.toJSON(),
            Asset: asset
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Remove asset from watchlist
router.delete('/watchlist/:assetId', auth, async (req, res) => {
    try {
        const { assetId } = req.params;

        // Find and delete the watchlist item
        const deleted = await Watchlist.destroy({
            where: {
                userId: req.user.id,
                assetId
            }
        });

        if (deleted === 0) {
            return res.status(404).json({ error: 'Asset not found in watchlist' });
        }

        res.status(200).json({ message: 'Asset removed from watchlist' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});



module.exports = router;