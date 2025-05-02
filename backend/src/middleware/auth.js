const jwt = require('jsonwebtoken');
const { User } = require('../models');

const auth = async (req, res, next) => {
    try {
        const token = req.header('Authorization')?.replace('Bearer ', '');
        
        if (!token) {
            throw new Error('No authentication token provided');
        }

        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            const user = await User.findByPk(decoded.id);

            if (!user) {
                throw new Error('User not found');
            }

            // Add user and token to request
            req.user = user;
            req.token = token;
            req.userId = user.id; // Add userId for easier access
            next();
        } catch (jwtError) {
            console.error('JWT verification error:', jwtError.message);
            res.status(401).json({ error: 'Invalid or expired token' });
        }
    } catch (error) {
        console.error('Authentication error:', error.message);
        res.status(401).json({ error: error.message || 'Please authenticate.' });
    }
};

module.exports = auth; 