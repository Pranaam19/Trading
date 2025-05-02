const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Order = sequelize.define('Order', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    quantity: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false
    },
    price: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false
    },
    type: {
        type: DataTypes.ENUM('market', 'limit'),
        allowNull: false
    },
    side: {
        type: DataTypes.ENUM('buy', 'sell'),
        allowNull: false
    },
    status: {
        type: DataTypes.ENUM('pending', 'confirmed', 'filled', 'partially_filled', 'cancelled'),
        defaultValue: 'confirmed'
    }
});

module.exports = Order; 