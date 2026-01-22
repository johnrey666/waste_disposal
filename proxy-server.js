// proxy-server.js
const express = require('express');
const cors = require('cors');
const axios = require('axios');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors({
    origin: ['http://127.0.0.1:5500', 'http://localhost:5500', 'http://localhost:8080'],
    methods: ['POST', 'GET', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

// Your SendGrid API Key
const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY || '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';

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        service: 'SendGrid Proxy',
        timestamp: new Date().toISOString()
    });
});

// Test email endpoint
app.post('/api/test-email', async (req, res) => {
    try {
        const { toEmail } = req.body;
        
        const emailData = {
            personalizations: [{
                to: [{ email: toEmail, name: 'Test User' }]
            }],
            from: {
                email: 'noreply@fgoperations.com',
                name: 'FG Operations'
            },
            subject: 'Test Email from SendGrid Proxy',
            content: [
                {
                    type: 'text/plain',
                    value: 'This is a test email from your SendGrid proxy server.'
                }
            ]
        };
        
        const response = await axios.post(
            'https://api.sendgrid.com/v3/mail/send',
            emailData,
            {
                headers: {
                    'Authorization': `Bearer ${SENDGRID_API_KEY}`,
                    'Content-Type': 'application/json'
                }
            }
        );
        
        res.json({ 
            success: true, 
            message: 'Test email sent successfully',
            sendGridResponse: response.data 
        });
    } catch (error) {
        console.error('Test email error:', error.response?.data || error.message);
        res.status(500).json({
            success: false,
            error: error.response?.data || error.message
        });
    }
});

// Main email sending endpoint
app.post('/api/send-email', async (req, res) => {
    try {
        console.log('Received email request:', {
            to: req.body.personalizations?.[0]?.to?.[0]?.email,
            subject: req.body.subject,
            timestamp: new Date().toISOString()
        });
        
        const response = await axios.post(
            'https://api.sendgrid.com/v3/mail/send',
            req.body,
            {
                headers: {
                    'Authorization': `Bearer ${SENDGRID_API_KEY}`,
                    'Content-Type': 'application/json'
                }
            }
        );
        
        console.log('SendGrid response:', response.status);
        
        res.json({ 
            success: true, 
            sendGridResponse: response.data,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('SendGrid proxy error:', {
            status: error.response?.status,
            data: error.response?.data,
            message: error.message
        });
        
        res.status(error.response?.status || 500).json({
            success: false,
            error: error.response?.data || error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// Handle preflight requests
app.options('*', (req, res) => {
    res.header('Access-Control-Allow-Origin', req.headers.origin);
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.sendStatus(200);
});

app.listen(PORT, () => {
    console.log(`🔧 SendGrid Proxy Server running on http://localhost:${PORT}`);
    console.log(`📧 Health check: http://localhost:${PORT}/health`);
    console.log(`📧 Test endpoint: POST http://localhost:${PORT}/api/test-email`);
    console.log(`📧 Main endpoint: POST http://localhost:${PORT}/api/send-email`);
});