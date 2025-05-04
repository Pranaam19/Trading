const { Order, Asset, Portfolio, sequelize } = require('../models');
const { Op } = require('sequelize');

/**
 * Order matching service to handle trade execution
 */
class OrderMatchingService {
    /**
     * Process a new order and attempt to match it with existing orders
     * @param {Object} order - The new order to process
     * @returns {Promise<Object>} - The processed order
     */
    async processOrder(order) {
        console.log('OrderMatchingService: Processing new order', JSON.stringify(order));
        try {
            // Validate the order data
            if (!order.userId) {
                throw new Error('Order must have a userId');
            }
            
            // For market orders, get the current market price
            if (order.type === 'market') {
                const asset = await Asset.findByPk(order.assetId);
                if (!asset) {
                    throw new Error('Asset not found');
                }
                order.price = asset.current_price;
                console.log(`Market order: Using current price ${order.price} for ${asset.symbol}`);
            }
            
            // For sell orders, verify the user has enough assets
            if (order.side === 'sell') {
                const portfolio = await Portfolio.findOne({
                    where: {
                        userId: order.userId,
                        assetId: order.assetId
                    }
                });
                
                console.log(`Pre-order portfolio check: User ${order.userId}, Asset ${order.assetId}, Available: ${portfolio?.quantity || 0}, Requested: ${order.quantity}`);
                
                if (!portfolio || parseFloat(portfolio.quantity) < parseFloat(order.quantity)) {
                    console.error(`Insufficient assets for sell order: Available ${portfolio?.quantity || 0}, Requested ${order.quantity}`);
                    throw new Error('Insufficient assets to place sell order');
                }
            }

            // Create the order using a transaction to ensure it's committed
            const transaction = await sequelize.transaction();
            let savedOrder;
            
            try {
                savedOrder = await Order.create(order, { transaction });
                console.log(`Order created with ID: ${savedOrder.id}`);
                
                // Attempt to match the order
                if (savedOrder.side === 'buy') {
                    await this.matchBuyOrder(savedOrder, transaction);
                } else {
                    await this.matchSellOrder(savedOrder, transaction);
                }
                
                await transaction.commit();
                
                // Reload the order to get the updated status
                await savedOrder.reload();
                console.log(`Order ${savedOrder.id} processed with status: ${savedOrder.status}`);
            } catch (error) {
                // Rollback transaction on error
                await transaction.rollback();
                console.error('Transaction rolled back:', error);
                throw error;
            }
            
            // Get the processed order
            const processedOrder = savedOrder;
            
            // Update portfolio immediately for filled or partially filled orders
            if (processedOrder.status === 'filled' || processedOrder.status === 'partially_filled') {
                await this.updatePortfolioForOrder(processedOrder);
                
                // Emit a global event for order completion
                if (global.wss) {
                    console.log('Broadcasting order update to all clients');
                    global.wss.clients.forEach(client => {
                        if (client.readyState === 1) { // WebSocket.OPEN
                            client.send(JSON.stringify({
                                type: 'order_update',
                                order: processedOrder,
                                status: processedOrder.status,
                                timestamp: new Date().toISOString()
                            }));
                            
                            // Also send a trade notification
                            client.send(JSON.stringify({
                                type: 'trade_completed',
                                order: processedOrder,
                                timestamp: new Date().toISOString(),
                                message: `${processedOrder.side === 'buy' ? 'Buy' : 'Sell'} order for ${processedOrder.quantity} units has been ${processedOrder.status}`
                            }));
                        }
                    });
                }
                
                // Move the order to transaction history by updating its status
                console.log(`Moving order ${processedOrder.id} to transaction history with status ${processedOrder.status}`);
            } else {
                // For confirmed orders, broadcast an order book update
                if (global.wss) {
                    // Get the asset symbol for this order
                    const asset = await Asset.findByPk(processedOrder.assetId);
                    if (asset) {
                        console.log(`Broadcasting order book update for ${asset.symbol} after new ${processedOrder.side} order`);
                        
                        // Get the updated order book
                        const buyOrders = await Order.findAll({
                            where: {
                                assetId: processedOrder.assetId,
                                side: 'buy',
                                status: 'confirmed'
                            },
                            order: [['price', 'DESC']]
                        });
                        
                        const sellOrders = await Order.findAll({
                            where: {
                                assetId: processedOrder.assetId,
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
                        
                        // Broadcast the updated order book
                        global.wss.clients.forEach(client => {
                            if (client.readyState === 1) { // WebSocket.OPEN
                                client.send(JSON.stringify({
                                    type: 'order_book_update',
                                    symbol: asset.symbol,
                                    data: { bids, asks },
                                    timestamp: new Date().toISOString()
                                }));
                                
                                // Also send an order update notification for the new order
                                client.send(JSON.stringify({
                                    type: 'order_update',
                                    order: processedOrder,
                                    status: processedOrder.status,
                                    timestamp: new Date().toISOString()
                                }));
                            }
                        });
                    }
                }
            }
            
            // Broadcast the order update to all clients
            if (global.wss) {
                console.log(`Broadcasting order update for ${processedOrder.id} to all clients`);
                global.wss.clients.forEach(client => {
                    if (client.readyState === 1) { // WebSocket.OPEN
                        // Send an order update notification
                        client.send(JSON.stringify({
                            type: 'order_update',
                            order: processedOrder,
                            status: processedOrder.status,
                            timestamp: new Date().toISOString()
                        }));
                    }
                });
            }
            
            // Return the order with asset information
            return this.getOrderWithAsset(processedOrder.id);
        } catch (error) {
            console.error('Error in processOrder:', error);
            throw error;
        }
    }

    /**
     * Match a buy order with existing sell orders
     * @param {Object} buyOrder - The buy order to match
     */
    async matchBuyOrder(buyOrder, parentTransaction = null) {
        console.log(`Matching buy order ${buyOrder.id} for ${buyOrder.quantity} units at ${buyOrder.price}`);
        
        try {
            // Find matching sell orders (price <= buy order price, for limit orders)
            const matchingOrders = await Order.findAll({
                where: {
                    assetId: buyOrder.assetId,
                    side: 'sell',
                    status: 'confirmed',
                    ...(buyOrder.type === 'limit' ? { price: { [Op.lte]: buyOrder.price } } : {})
                },
                order: [['price', 'ASC']], // Get the lowest priced sell orders first
                lock: true // Lock the rows for update
            });

            console.log(`Found ${matchingOrders.length} matching sell orders`);

            let remainingQuantity = buyOrder.quantity;

            // Use a transaction to ensure atomicity
            const t = parentTransaction || await sequelize.transaction();

            try {
                for (const sellOrder of matchingOrders) {
                    if (remainingQuantity <= 0) break;

                    // Calculate the quantity to trade
                    const tradeQuantity = Math.min(remainingQuantity, sellOrder.quantity);
                    const tradePrice = sellOrder.price; // Use the sell order price

                    console.log(`Executing trade: ${tradeQuantity} units at ${tradePrice}`);

                    // Update the buy order
                    remainingQuantity -= tradeQuantity;

                    // Update the sell order
                    if (tradeQuantity === sellOrder.quantity) {
                        await sellOrder.update({ status: 'filled' }, { transaction: t });
                    } else {
                        await sellOrder.update({
                            quantity: sellOrder.quantity - tradeQuantity,
                            status: 'partially_filled'
                        }, { transaction: t });
                    }

                    // Update portfolios
                    await this.updatePortfolios(
                        buyOrder.userId,
                        sellOrder.userId,
                        sellOrder.assetId,
                        tradeQuantity,
                        tradePrice,
                        t
                    );

                    // Create a new order for the filled portion of the buy order
                    await Order.create({
                        userId: buyOrder.userId,
                        assetId: buyOrder.assetId,
                        quantity: tradeQuantity,
                        price: tradePrice,
                        type: buyOrder.type,
                        side: 'buy',
                        status: 'filled',
                        parentOrderId: buyOrder.id
                    }, { transaction: t });
                }

                // Update the status of the original buy order
                if (remainingQuantity === 0) {
                    // Fully filled
                    await buyOrder.update({ status: 'filled' }, { transaction: t });
                    console.log(`Buy order ${buyOrder.id} fully filled`);
                } else if (remainingQuantity < buyOrder.quantity) {
                    // Partially filled
                    await buyOrder.update({
                        status: 'partially_filled',
                        quantity: remainingQuantity
                    }, { transaction: t });
                    console.log(`Buy order ${buyOrder.id} partially filled, remaining: ${remainingQuantity}`);
                } else {
                    // No matches found, keep the order as confirmed
                    await buyOrder.update({ status: 'confirmed' }, { transaction: t });
                    console.log(`Buy order ${buyOrder.id} remains confirmed, no matches found`);
                }

                // Only commit if we started the transaction here
                if (!parentTransaction) {
                    await t.commit();
                    console.log(`Transaction committed for buy order ${buyOrder.id}`);
                }
            } catch (error) {
                // Only rollback if we started the transaction here
                if (!parentTransaction) {
                    await t.rollback();
                    console.error(`Transaction rolled back for buy order ${buyOrder.id}:`, error);
                }
                throw error;
            }
        } catch (error) {
            console.error('Error in matchBuyOrder:', error);
            throw error;
        }
    }

    /**
     * Match a sell order with existing buy orders
     * @param {Object} sellOrder - The sell order to match
     */
    async matchSellOrder(sellOrder, parentTransaction = null) {
        console.log(`Matching sell order ${sellOrder.id} for ${sellOrder.quantity} units at ${sellOrder.price}`);
        
        try {
            // Double-check that the user has enough assets to sell
            const portfolio = await Portfolio.findOne({
                where: {
                    userId: sellOrder.userId,
                    assetId: sellOrder.assetId
                },
                lock: true // Lock the row for update
            });
            
            console.log(`Sell order portfolio check: User ${sellOrder.userId}, Asset ${sellOrder.assetId}, Available: ${portfolio?.quantity || 0}, Requested: ${sellOrder.quantity}`);
            
            if (!portfolio) {
                console.error(`No portfolio found for sell order: User ${sellOrder.userId}, Asset ${sellOrder.assetId}`);
                await sellOrder.update({ status: 'cancelled' }, { transaction: parentTransaction });
                throw new Error('Portfolio not found for sell order');
            }
            
            const availableQuantity = parseFloat(portfolio.quantity);
            const requestedQuantity = parseFloat(sellOrder.quantity);
            
            if (availableQuantity < requestedQuantity) {
                console.error(`Insufficient assets for sell order: Available ${availableQuantity}, Requested ${requestedQuantity}`);
                await sellOrder.update({ status: 'cancelled' }, { transaction: parentTransaction });
                throw new Error(`Insufficient assets to complete sell order: Available ${availableQuantity}, Requested ${requestedQuantity}`);
            }
            
            // Find matching buy orders (price >= sell order price, for limit orders)
            const matchingOrders = await Order.findAll({
                where: {
                    assetId: sellOrder.assetId,
                    side: 'buy',
                    status: 'confirmed',
                    ...(sellOrder.type === 'limit' ? { price: { [Op.gte]: sellOrder.price } } : {})
                },
                order: [['price', 'DESC']], // Get the highest priced buy orders first
                lock: true // Lock the rows for update
            });

            console.log(`Found ${matchingOrders.length} matching buy orders for sell order ${sellOrder.id}`);

            let remainingQuantity = requestedQuantity;

            // Use a transaction to ensure atomicity
            const t = parentTransaction || await sequelize.transaction();

            try {
                for (const buyOrder of matchingOrders) {
                    if (remainingQuantity <= 0) break;

                    // Calculate the quantity to trade
                    const tradeQuantity = Math.min(remainingQuantity, parseFloat(buyOrder.quantity));
                    const tradePrice = buyOrder.price; // Use the buy order price

                    console.log(`Executing trade: ${tradeQuantity} units at ${tradePrice} between sell order ${sellOrder.id} and buy order ${buyOrder.id}`);

                    // Update the sell order
                    remainingQuantity -= tradeQuantity;

                    // Update the buy order
                    if (tradeQuantity === parseFloat(buyOrder.quantity)) {
                        await buyOrder.update({ status: 'filled' }, { transaction: t });
                        console.log(`Buy order ${buyOrder.id} fully filled`);
                    } else {
                        const newQuantity = parseFloat(buyOrder.quantity) - tradeQuantity;
                        await buyOrder.update({
                            quantity: newQuantity,
                            status: 'partially_filled'
                        }, { transaction: t });
                        console.log(`Buy order ${buyOrder.id} partially filled, remaining quantity: ${newQuantity}`);
                    }

                    // Update portfolios
                    await this.updatePortfolios(
                        buyOrder.userId,
                        sellOrder.userId,
                        buyOrder.assetId,
                        tradeQuantity,
                        tradePrice,
                        t
                    );

                    // Create a new order for the filled portion of the sell order
                    const filledOrder = await Order.create({
                        userId: sellOrder.userId,
                        assetId: sellOrder.assetId,
                        quantity: tradeQuantity,
                        price: tradePrice,
                        type: sellOrder.type,
                        side: 'sell',
                        status: 'filled',
                        parentOrderId: sellOrder.id
                    }, { transaction: t });
                    
                    console.log(`Created filled order record ${filledOrder.id} for sell order ${sellOrder.id}`);
                }

                // Update the status of the original sell order
                if (remainingQuantity === 0) {
                    // Fully filled
                    await sellOrder.update({ status: 'filled' }, { transaction: t });
                    console.log(`Sell order ${sellOrder.id} fully filled`);
                } else if (remainingQuantity < requestedQuantity) {
                    // Partially filled
                    await sellOrder.update({
                        quantity: remainingQuantity,
                        status: 'partially_filled'
                    }, { transaction: t });
                    console.log(`Sell order ${sellOrder.id} partially filled, remaining quantity: ${remainingQuantity}`);
                } else {
                    // No matches found, update the order to confirmed status
                    await sellOrder.update({ status: 'confirmed' }, { transaction: t });
                    console.log(`Sell order ${sellOrder.id} remains confirmed, no matches found`);
                }
                
                // Get the asset to broadcast order book update
                const asset = await Asset.findByPk(sellOrder.assetId, { transaction: t });
                if (asset) {
                    console.log(`Asset for sell order: ${asset.symbol}`);
                }
                
                // Only commit if we started the transaction here
                if (!parentTransaction) {
                    await t.commit();
                    console.log(`Transaction committed for sell order ${sellOrder.id}`);
                }
            } catch (error) {
                // Only rollback if we started the transaction here
                if (!parentTransaction) {
                    await t.rollback();
                    console.error(`Transaction rolled back for sell order ${sellOrder.id}:`, error);
                }
                throw error;
            }
        } catch (error) {
            console.error('Error in matchSellOrder:', error);
            throw error;
        }
    }

    /**
     * Update the portfolios of the buyer and seller
     * @param {number} buyerId - The buyer's user ID
     * @param {number} sellerId - The seller's user ID
     * @param {number} assetId - The asset ID
     * @param {number} quantity - The quantity traded
     * @param {number} price - The trade price
     * @param {Object} transaction - The Sequelize transaction
     */
    async updatePortfolios(buyerId, sellerId, assetId, quantity, price, transaction) {
        console.log(`Updating portfolios: Buyer ${buyerId}, Seller ${sellerId}, Asset ${assetId}, Quantity ${quantity}, Price ${price}`);
        
        try {
            // Update buyer's portfolio
            const buyerPortfolio = await Portfolio.findOne({
                where: { userId: buyerId, assetId },
                transaction
            });

            if (buyerPortfolio) {
                // Update existing portfolio
                const newQuantity = buyerPortfolio.quantity + quantity;
                const newAvgPrice = ((buyerPortfolio.average_price * buyerPortfolio.quantity) + (price * quantity)) / newQuantity;
                
                await buyerPortfolio.update({
                    quantity: newQuantity,
                    average_price: newAvgPrice
                }, { transaction });
                console.log(`Updated buyer's portfolio: New quantity ${newQuantity}, New avg price ${newAvgPrice}`);
            } else {
                // Create new portfolio entry
                await Portfolio.create({
                    userId: buyerId,
                    assetId,
                    quantity,
                    average_price: price
                }, { transaction });
                console.log(`Created new portfolio for buyer with quantity ${quantity} at price ${price}`);
            }

            // Update seller's portfolio
            const sellerPortfolio = await Portfolio.findOne({
                where: { userId: sellerId, assetId },
                transaction
            });

            if (sellerPortfolio) {
                const newQuantity = sellerPortfolio.quantity - quantity;
                
                if (newQuantity <= 0) {
                    // Remove portfolio entry if quantity is 0 or negative
                    await sellerPortfolio.destroy({ transaction });
                    console.log(`Removed seller's portfolio entry as quantity is now ${newQuantity}`);
                } else {
                    // Update portfolio with new quantity
                    await sellerPortfolio.update({
                        quantity: newQuantity
                    }, { transaction });
                    console.log(`Updated seller's portfolio: New quantity ${newQuantity}`);
                }
            } else {
                throw new Error('Seller does not have the asset in portfolio');
            }
        } catch (error) {
            console.error('Error in updatePortfolios:', error);
            throw error;
        }
    }

    /**
     * Get an order with its associated asset
     * @param {number} orderId - The order ID
     * @returns {Promise<Object>} The order with asset information
     */
    async getOrderWithAsset(orderId) {
        try {
            const orderWithAsset = await Order.findByPk(orderId, {
                include: [{ model: Asset }]
            });
            
            if (!orderWithAsset) {
                console.error(`Failed to find order with ID ${orderId}`);
                throw new Error(`Order not found: ${orderId}`);
            }
            
            console.log(`Successfully retrieved order with asset: ${JSON.stringify(orderWithAsset)}`);
            return orderWithAsset;
        } catch (error) {
            console.error(`Error in getOrderWithAsset for order ${orderId}:`, error);
            throw error;
        }
    }

    async updatePortfolioForOrder(order) {
        console.log(`Updating portfolio for order ${order.id}`);
        
        try {
            // Get the asset details for this order
            const asset = await Asset.findByPk(order.assetId);
            if (!asset) {
                throw new Error(`Asset with ID ${order.assetId} not found`);
            }
            
            // Use a transaction for portfolio updates
            const transaction = await sequelize.transaction();
            
            try {
                // Handle differently based on order side
                if (order.side === 'buy') {
                    // Update buyer's portfolio
                    const buyerPortfolio = await Portfolio.findOne({
                        where: { userId: order.userId, assetId: order.assetId },
                        transaction
                    });
    
                    if (buyerPortfolio) {
                        // Update existing portfolio
                        const existingQuantity = parseFloat(buyerPortfolio.quantity) || 0;
                        const orderQuantity = parseFloat(order.quantity) || 0;
                        const newQuantity = existingQuantity + orderQuantity;
                        
                        const existingAvgPrice = parseFloat(buyerPortfolio.average_price) || 0;
                        const orderPrice = parseFloat(order.price) || 0;
                        const newAvgPrice = ((existingAvgPrice * existingQuantity) + (orderPrice * orderQuantity)) / newQuantity;
                        
                        await buyerPortfolio.update({
                            quantity: newQuantity,
                            average_price: newAvgPrice
                        }, { transaction });
                        console.log(`Updated buyer's portfolio: New quantity ${newQuantity}, New avg price ${newAvgPrice}`);
                    } else {
                        // Create new portfolio entry
                        await Portfolio.create({
                            userId: order.userId,
                            assetId: order.assetId,
                            quantity: parseFloat(order.quantity),
                            average_price: parseFloat(order.price)
                        }, { transaction });
                        console.log(`Created new portfolio for buyer with quantity ${order.quantity} at price ${order.price}`);
                    }
                } else if (order.side === 'sell') {
                    // Update seller's portfolio
                    const sellerPortfolio = await Portfolio.findOne({
                        where: { userId: order.userId, assetId: order.assetId },
                        transaction
                    });
    
                    if (sellerPortfolio) {
                        const existingQuantity = parseFloat(sellerPortfolio.quantity) || 0;
                        const orderQuantity = parseFloat(order.quantity) || 0;
                        const newQuantity = existingQuantity - orderQuantity;
                        
                        console.log(`Updating seller portfolio: Current quantity ${existingQuantity}, Order quantity ${orderQuantity}, New quantity ${newQuantity}`);
                        
                        if (newQuantity <= 0) {
                            // Remove portfolio entry if quantity is 0 or negative
                            await sellerPortfolio.destroy({ transaction });
                            console.log(`Removed seller's portfolio entry as quantity is now ${newQuantity}`);
                        } else {
                            // Update portfolio with new quantity
                            await sellerPortfolio.update({
                                quantity: newQuantity
                            }, { transaction });
                            console.log(`Updated seller's portfolio: New quantity ${newQuantity}`);
                        }
                    } else {
                        console.error(`Seller does not have the asset in portfolio: User ${order.userId}, Asset ${order.assetId}`);
                        throw new Error(`Seller does not have the asset in portfolio: User ${order.userId}, Asset ${order.assetId}`);
                    }
                }
                
                // Commit the transaction
                await transaction.commit();
            } catch (error) {
                // Rollback the transaction on error
                await transaction.rollback();
                console.error('Transaction rolled back in updatePortfolioForOrder:', error);
                throw error;
            }
            
            // Broadcast portfolio update to the user
            if (global.wss) {
                // Get the updated portfolio for this user
                const updatedPortfolio = await Portfolio.findAll({
                    where: { userId: order.userId },
                    include: [{ model: Asset }]
                });
                
                // Broadcast to all clients (the client will filter by userId)
                global.wss.clients.forEach(client => {
                    if (client.readyState === 1) { // WebSocket.OPEN
                        client.send(JSON.stringify({
                            type: 'portfolio_update',
                            userId: order.userId,
                            portfolio: updatedPortfolio,
                            symbol: asset.symbol,
                            timestamp: new Date().toISOString()
                        }));
                        
                        // Also send a trade notification
                        client.send(JSON.stringify({
                            type: 'trade_notification',
                            order: {
                                id: order.id,
                                symbol: asset.symbol,
                                side: order.side,
                                quantity: order.quantity,
                                price: order.price,
                                status: order.status,
                                timestamp: new Date().toISOString()
                            }
                        }));
                    }
                });
            }
            
        } catch (error) {
            console.error('Error in updatePortfolioForOrder:', error);
            throw error;
        }
    }
}

module.exports = new OrderMatchingService();
