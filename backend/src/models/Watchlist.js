const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Watchlist = sequelize.define('Watchlist', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    userId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'Users',
            key: 'id'
        }
    },
    assetId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'Assets',
            key: 'id'
        }
    }
}, {
    indexes: [
        {
            unique: true,
            fields: ['userId', 'assetId']
        }
    ]
});

module.exports = Watchlist;
