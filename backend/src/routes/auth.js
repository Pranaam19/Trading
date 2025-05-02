const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { User } = require('../models');
const { Op } = require('sequelize');
const sequelize = require('../config/database');

// Register new user
router.post('/register', async (req, res) => {
    try {
        const { username, email, password } = req.body;
        
        console.log(`Registration attempt for email: ${email}, username: ${username}`);

        // Check if user already exists
        const existingUser = await User.findOne({
            where: {
                [Op.or]: [{ email }, { username }]
            }
        });

        if (existingUser) {
            console.log(`Registration failed: User with email ${email} or username ${username} already exists`);
            return res.status(400).json({ error: 'User already exists' });
        }

        // Create new user
        const user = await User.create({
            username,
            email,
            password_hash: password // Will be hashed by the model hook
        });
        
        console.log(`User registered successfully: ${username} (${user.id})`);
        
        // Create initial portfolio for the user
        const assets = await sequelize.models.Asset.findAll();
        for (const asset of assets) {
            await sequelize.models.Portfolio.create({
                userId: user.id,
                assetId: asset.id,
                quantity: 0,
                averageBuyPrice: 0
            });
        }
        
        console.log(`Initial empty portfolio created for user: ${username} (${user.id})`);


        // Generate JWT token
        const token = jwt.sign(
            { id: user.id },
            process.env.JWT_SECRET,
            { expiresIn: process.env.JWT_EXPIRES_IN }
        );

        res.status(201).json({
            user: {
                id: user.id,
                username: user.username,
                email: user.email
            },
            token
        });
    } catch (error) {
        console.error('Registration error:', error);
        res.status(400).json({ error: error.message });
    }
});

// Login user
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        
        console.log(`Login attempt for email: ${email}`);

        // Find user by email
        const user = await User.findOne({ where: { email } });
        if (!user) {
            console.log(`Login failed: User with email ${email} not found`);
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        // Check password
        const isMatch = await user.checkPassword(password);
        if (!isMatch) {
            console.log(`Login failed: Invalid password for user ${email}`);
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        
        console.log(`Login successful for user: ${user.username} (${user.id})`);


        // Generate JWT token
        const token = jwt.sign(
            { id: user.id },
            process.env.JWT_SECRET,
            { expiresIn: process.env.JWT_EXPIRES_IN }
        );

        res.json({
            user: {
                id: user.id,
                username: user.username,
                email: user.email
            },
            token
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(400).json({ error: error.message });
    }
});

module.exports = router; 