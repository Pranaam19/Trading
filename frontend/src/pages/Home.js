import React from 'react';
import { Card, Container, Button } from 'react-bootstrap';
import { Link } from 'react-router-dom';

const Home = () => {
  return (
    <Container className="mt-5">
      <Card className="text-center">
        <Card.Body>
          <Card.Title className="display-4">Welcome to Trading Platform</Card.Title>
          <Card.Text className="lead">
            A real-time trading platform demonstration with WebSocket functionality
          </Card.Text>
          <Button as={Link} to="/register" variant="primary" size="lg">
            Get Started
          </Button>
        </Card.Body>
      </Card>
    </Container>
  );
};

export default Home; 