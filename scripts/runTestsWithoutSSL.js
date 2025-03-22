#!/usr/bin/env node

/**
 * This script runs tests with SSL verification disabled.
 * IMPORTANT: This is for development/testing only and should not be used in production.
 */

// Disable SSL certificate validation
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

// Run the tests
require('../out/test/runTest'); 