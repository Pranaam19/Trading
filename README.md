# Real-Time Trading Platform

A lightweight real-time trading platform demonstration that showcases WebSocket functionality with React and PostgreSQL.

## Project Structure

```
.
├── frontend/           # React frontend application
├── backend/           # Node.js/Express backend server
└── README.md          # Project documentation
```

## Features

- Real-time price updates via WebSockets
- Basic authentication
- Market and limit orders
- Portfolio overview
- Simple charting

## Technology Stack

### Frontend
- React (Create React App)
- React Context API
- WebSocket API
- React Bootstrap
- Recharts

### Backend
- Node.js with Express
- WebSocket (ws)
- PostgreSQL
- Sequelize ORM

## Getting Started

### Prerequisites
- Node.js (v14 or higher)
- PostgreSQL
- npm or yarn

### Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   # Install backend dependencies
   cd backend
   npm install

   # Install frontend dependencies
   cd ../frontend
   npm install
   ```

3. Set up environment variables:
   - Create `.env` files in both frontend and backend directories
   - Configure database connection and other settings

4. Start the development servers:
   ```bash
   # Start backend server
   cd backend
   npm run dev

   # Start frontend server
   cd frontend
   npm start
   ```

## Development Status

- [ ] Phase 1: Setup & Authentication
- [ ] Phase 2: WebSocket Implementation
- [ ] Phase 3: Trading Features
- [ ] Phase 4: Refinement

## License

MIT 