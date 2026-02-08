#!/usr/bin/env node

/**
 * Test Demo Server
 * Reads API key from .env and serves the demo with auto-filled API key
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

// Simple .env parser (without dotenv dependency)
function parseEnv(envContent) {
    const env = {};
    envContent.split('\n').forEach(line => {
        line = line.trim();
        if (line && !line.startsWith('#')) {
            const match = line.match(/^([^=]+)=(.*)$/);
            if (match) {
                const key = match[1].trim();
                let value = match[2].trim();
                // Remove quotes if present
                if ((value.startsWith('"') && value.endsWith('"')) || 
                    (value.startsWith("'") && value.endsWith("'"))) {
                    value = value.slice(1, -1);
                }
                env[key] = value;
            }
        }
    });
    return env;
}

// Read .env file
const envPath = path.join(__dirname, '.env');
let apiKey = '';

if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    const env = parseEnv(envContent);
    apiKey = env.OpenAI_API_KEY || env.OPENAI_API_KEY || '';
}

const PORT = 3000;
const DEMO_PATH = path.join(__dirname, 'demo', 'index.html');

// Read demo HTML
let demoHTML = '';
if (fs.existsSync(DEMO_PATH)) {
    demoHTML = fs.readFileSync(DEMO_PATH, 'utf8');
    
    // Inject API key into the input field if it exists
    if (apiKey) {
        // Find the API key input and set its value
        demoHTML = demoHTML.replace(
            /<input type="text" id="ai-api-key"[^>]*>/,
            `<input type="text" id="ai-api-key" value="${apiKey}" placeholder="OpenAI API Key (sk-...)"`
        );
        
        // Also auto-check the AI toggle
        demoHTML = demoHTML.replace(
            /<input type="checkbox" id="ai-toggle">/,
            `<input type="checkbox" id="ai-toggle" checked>`
        );
        
        // Show the AI fields by default (handle both display:none and display:none;)
        demoHTML = demoHTML.replace(
            /<div id="ai-fields" style="display:none[^"]*">/,
            `<div id="ai-fields" style="display:block;">`
        );
        
        console.log('✅ API key loaded from .env and auto-filled in demo');
    } else {
        console.log('⚠️  No API key found in .env file');
    }
} else {
    console.error('❌ Demo file not found:', DEMO_PATH);
    process.exit(1);
}

const server = http.createServer((req, res) => {
    // Extract path without query string for route matching
    const urlPath = req.url.split('?')[0];
    
    // Handle root and demo paths
    if (urlPath === '/' || urlPath === '/demo' || urlPath === '/demo/') {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(demoHTML);
        return;
    }
    
    // Serve static files from src directory
    if (urlPath.startsWith('/src/')) {
        const filePath = path.join(__dirname, urlPath);
        if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
            const ext = path.extname(filePath);
            const contentType = {
                '.js': 'application/javascript',
                '.css': 'text/css',
                '.html': 'text/html',
                '.json': 'application/json'
            }[ext] || 'text/plain';
            
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(fs.readFileSync(filePath));
            return;
        }
    }
    
    // Serve static files from demo directory
    if (urlPath.startsWith('/demo/')) {
        const filePath = path.join(__dirname, urlPath);
        if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
            const ext = path.extname(filePath);
            const contentType = {
                '.js': 'application/javascript',
                '.css': 'text/css',
                '.html': 'text/html',
                '.json': 'application/json'
            }[ext] || 'text/plain';
            
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(fs.readFileSync(filePath));
            return;
        }
    }
    
    // 404
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('404 Not Found');
});

server.listen(PORT, () => {
    console.log('\n🚀 Demo server running!');
    console.log(`📍 Open: http://localhost:${PORT}/demo`);
    console.log(`\n📝 API Key: ${apiKey ? '✅ Loaded from .env' : '❌ Not found'}`);
    console.log('\n💡 Tips:');
    console.log('   - The API key field is auto-filled');
    console.log('   - AI mode is enabled by default');
    console.log('   - Click "Run AI Personalization" to test');
    console.log('   - Use UTM links in the debug panel to test different scenarios');
    console.log('\nPress Ctrl+C to stop\n');
});
