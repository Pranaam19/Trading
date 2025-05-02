const { Asset, Order } = require('../models');
const WebSocket = require('ws');

// Simulate price changes
const simulatePriceChange = async () => {
    try {
        const assets = await Asset.findAll();
        const updatedAssets = [];
        
        for (const asset of assets) {
            // Generate random price change between -2% and +2%
            const change = (Math.random() * 4 - 2) / 100;
            const newPrice = asset.current_price * (1 + change);
            
            await asset.update({ current_price: newPrice });
            updatedAssets.push({
                id: asset.id,
                symbol: asset.symbol,
                price: asset.current_price
            });
        }
        
        return updatedAssets;
    } catch (error) {
        console.error('Error simulating price changes:', error);
        return [];
    }
};

// Get order book for an asset
const getOrderBook = async (assetId) => {
    try {
        // Get buy orders (bids)
        const bids = await Order.findAll({
            where: {
                assetId,
                side: 'buy',
                status: 'confirmed',
                type: 'limit'
            },
            attributes: ['price', 'quantity'],
            order: [['price', 'DESC']],
            limit: 10
        });

        // Get sell orders (asks)
        const asks = await Order.findAll({
            where: {
                assetId,
                side: 'sell',
                status: 'confirmed',
                type: 'limit'
            },
            attributes: ['price', 'quantity'],
            order: [['price', 'ASC']],
            limit: 10
        });

        return { bids, asks };
    } catch (error) {
        console.error('Error getting order book:', error);
        return { bids: [], asks: [] };
    }
};

// Broadcast price updates to all connected clients
const broadcastPriceUpdates = (wss) => {
    setInterval(async () => {
        try {
            const updatedAssets = await simulatePriceChange();
            
            if (updatedAssets.length === 0) {
                console.log('No assets updated');
                return;
            }
            
            console.log(`Broadcasting price updates for ${updatedAssets.length} assets`);
            
            // Send batch price updates
            const priceUpdates = updatedAssets.map(asset => ({
                type: 'price_update',
                symbol: asset.symbol,
                price: asset.price,
                timestamp: new Date().toISOString()
            }));

            // Broadcast price updates to all clients
            wss.clients.forEach(client => {
                if (client.readyState === WebSocket.OPEN) {
                    // Send batch update
                    client.send(JSON.stringify({
                        type: 'price_updates',
                        data: priceUpdates,
                        timestamp: new Date().toISOString()
                    }));
                    
                    // Also send individual updates for backward compatibility
                    priceUpdates.forEach(update => {
                        client.send(JSON.stringify(update));
                    });
                }
            });

            // For each asset, get and broadcast order book
            for (const asset of updatedAssets) {
                const orderBook = await getOrderBook(asset.id);
                
                wss.clients.forEach(client => {
                    if (client.readyState === WebSocket.OPEN) {
                        client.send(JSON.stringify({
                            type: 'order_book_update',
                            symbol: asset.symbol,
                            assetId: asset.id,
                            data: orderBook,
                            timestamp: new Date().toISOString()
                        }));
                    }
                });
            }
        } catch (error) {
            console.error('Error broadcasting updates:', error);
        }
    }, 5000); // Update every 5 seconds
};

module.exports = {
    broadcastPriceUpdates,
    getOrderBook
};