#!/usr/bin/env node
/**
 * SkyNet API Health Monitor
 * Checks API health every 60 seconds and restarts PM2 process if needed
 */

const http = require('http');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

// Configuration
const CONFIG = {
  apiUrl: process.env.SKYNET_API_URL || 'http://localhost:3005/api/v1/nodes?limit=1',
  pm2AppName: process.env.SKYNET_PM2_APP || 'xdcnetown',
  checkIntervalMs: 60000, // 60 seconds
  healthTimeoutMs: 10000, // 10 seconds timeout for health check
  maxConsecutiveFailures: 3,
  restartCooldownMs: 120000, // 2 minutes between restarts
  logFile: process.env.SKYNET_MONITOR_LOG || '/var/log/skynet-monitor.log'
};

// State
let consecutiveFailures = 0;
let lastRestartTime = 0;
let isRestarting = false;

// Ensure log directory exists
const logDir = path.dirname(CONFIG.logFile);
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

function log(level, message, data = null) {
  const timestamp = new Date().toISOString();
  const logEntry = {
    timestamp,
    level,
    message,
    data
  };
  
  const logLine = JSON.stringify(logEntry);
  console.log(`[${timestamp}] [${level}] ${message}`, data || '');
  
  try {
    fs.appendFileSync(CONFIG.logFile, logLine + '\n');
  } catch (err) {
    console.error('Failed to write to log file:', err.message);
  }
}

function checkApiHealth() {
  return new Promise((resolve, reject) => {
    const url = new URL(CONFIG.apiUrl);
    const options = {
      hostname: url.hostname,
      port: url.port || 3005,
      path: url.pathname + url.search,
      method: 'GET',
      timeout: CONFIG.healthTimeoutMs,
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'SkyNet-Health-Monitor/1.0'
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const statusCode = res.statusCode;
          const response = JSON.parse(data);
          
          resolve({
            statusCode,
            success: response.success === true,
            nodeCount: response.nodes?.length || 0,
            response
          });
        } catch (err) {
          reject(new Error(`Invalid JSON response: ${err.message}`));
        }
      });
    });

    req.on('error', (err) => {
      reject(new Error(`Request failed: ${err.message}`));
    });

    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });

    req.end();
  });
}

function restartApp() {
  return new Promise((resolve, reject) => {
    const now = Date.now();
    
    // Check cooldown
    if (now - lastRestartTime < CONFIG.restartCooldownMs) {
      log('WARN', 'Restart cooldown in effect, skipping restart');
      return resolve(false);
    }
    
    if (isRestarting) {
      log('WARN', 'Restart already in progress');
      return resolve(false);
    }
    
    isRestarting = true;
    lastRestartTime = now;
    
    log('INFO', `Restarting PM2 app: ${CONFIG.pm2AppName}`);
    
    exec(`pm2 restart ${CONFIG.pm2AppName}`, (error, stdout, stderr) => {
      isRestarting = false;
      
      if (error) {
        log('ERROR', 'Failed to restart app', { error: error.message, stderr });
        reject(error);
        return;
      }
      
      log('INFO', 'App restarted successfully', { stdout });
      consecutiveFailures = 0;
      resolve(true);
    });
  });
}

async function performHealthCheck() {
  try {
    log('DEBUG', 'Starting health check');
    
    const health = await checkApiHealth();
    
    // Reset failure counter on successful response
    if (health.success) {
      if (consecutiveFailures > 0) {
        log('INFO', 'API recovered', { 
          previousFailures: consecutiveFailures,
          nodeCount: health.nodeCount 
        });
        consecutiveFailures = 0;
      } else {
        log('DEBUG', 'Health check passed', { nodeCount: health.nodeCount });
      }
      return;
    }
    
    // API returned success: false
    consecutiveFailures++;
    log('WARN', `Health check returned success=false (failure ${consecutiveFailures}/${CONFIG.maxConsecutiveFailures})`, {
      statusCode: health.statusCode,
      response: health.response
    });
    
  } catch (error) {
    consecutiveFailures++;
    log('WARN', `Health check failed (failure ${consecutiveFailures}/${CONFIG.maxConsecutiveFailures})`, {
      error: error.message
    });
  }
  
  // Restart if threshold reached
  if (consecutiveFailures >= CONFIG.maxConsecutiveFailures) {
    log('ERROR', `Max consecutive failures reached (${consecutiveFailures}), initiating restart`);
    
    try {
      const restarted = await restartApp();
      if (restarted) {
        log('INFO', 'Restart completed, resetting failure counter');
      }
    } catch (err) {
      log('ERROR', 'Restart failed', { error: err.message });
    }
  }
}

// Graceful shutdown
let isShuttingDown = false;

function shutdown(signal) {
  if (isShuttingDown) return;
  isShuttingDown = true;
  
  log('INFO', `Received ${signal}, shutting down gracefully`);
  process.exit(0);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// Main loop
async function main() {
  log('INFO', 'SkyNet API Health Monitor started', {
    apiUrl: CONFIG.apiUrl,
    pm2AppName: CONFIG.pm2AppName,
    checkIntervalMs: CONFIG.checkIntervalMs,
    maxConsecutiveFailures: CONFIG.maxConsecutiveFailures
  });
  
  // Initial check
  await performHealthCheck();
  
  // Schedule periodic checks
  setInterval(performHealthCheck, CONFIG.checkIntervalMs);
}

// Handle uncaught errors
process.on('uncaughtException', (err) => {
  log('ERROR', 'Uncaught exception', { error: err.message, stack: err.stack });
});

process.on('unhandledRejection', (reason, promise) => {
  log('ERROR', 'Unhandled rejection', { reason });
});

main().catch(err => {
  log('ERROR', 'Monitor failed to start', { error: err.message });
  process.exit(1);
});
