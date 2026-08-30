/**
 * Generate a VAPID key pair for Web Push (P3-F). Run once per environment
 * and paste the output into server/.env — see .env.example. Re-running
 * generates a NEW pair; every existing browser push subscription becomes
 * invalid the moment you swap keys (the browser signs against the old
 * public key), so don't rotate casually in production.
 *
 * Usage:  node src/scripts/generate-vapid-keys.js
 *    or:  npm run generate:vapid
 */
import webpush from 'web-push';

const keys = webpush.generateVAPIDKeys();

console.log('\nAdd these to server/.env:\n');
console.log(`VAPID_PUBLIC_KEY=${keys.publicKey}`);
console.log(`VAPID_PRIVATE_KEY=${keys.privateKey}`);
console.log('VAPID_SUBJECT=mailto:admin@example.com  # a contact the push services may reach on abuse\n');
