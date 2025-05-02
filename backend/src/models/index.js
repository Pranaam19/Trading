const User = require('./User');
const Asset = require('./Asset');
const Order = require('./Order');
const Portfolio = require('./Portfolio');
const Watchlist = require('./Watchlist');

// Define associations
User.hasMany(Order, { foreignKey: 'userId' });
Order.belongsTo(User, { foreignKey: 'userId' });

User.hasMany(Portfolio, { foreignKey: 'userId' });
Portfolio.belongsTo(User, { foreignKey: 'userId' });

User.hasMany(Watchlist, { foreignKey: 'userId' });
Watchlist.belongsTo(User, { foreignKey: 'userId' });

Asset.hasMany(Order, { foreignKey: 'assetId' });
Order.belongsTo(Asset, { foreignKey: 'assetId' });

Asset.hasMany(Portfolio, { foreignKey: 'assetId' });
Portfolio.belongsTo(Asset, { foreignKey: 'assetId' });

Asset.hasMany(Watchlist, { foreignKey: 'assetId' });
Watchlist.belongsTo(Asset, { foreignKey: 'assetId' });

module.exports = {
    User,
    Asset,
    Order,
    Portfolio,
    Watchlist,
    sequelize: require('../config/database')
};