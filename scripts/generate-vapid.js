#!/usr/bin/env node
// Run once before deploying: node scripts/generate-vapid.js
// Copy the output into your .env and Railway environment variables.
const webpush = require('web-push');
const keys    = webpush.generateVAPIDKeys();

console.log('Add these to .env and Railway environment variables:\n');
console.log('VAPID_PUBLIC_KEY=' + keys.publicKey);
console.log('VAPID_PRIVATE_KEY=' + keys.privateKey);
console.log('VAPID_EMAIL=mailto:your@email.com');
