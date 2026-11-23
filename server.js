import express from 'express';
import cors from 'cors';
import 'dotenv/config';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { applicationDefault, cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { escapeHtml, validateContact, validateEmail } from './validation.js';

// D1: Firebase Admin is SERVER-SIDE ONLY. Do not put service-account values
// in VITE_* variables or in any frontend file, and never commit the JSON key.
let adminAuth = null;
let adminDb = null;
try {
  const keyPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
  const inlineKey = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (keyPath || inlineKey || process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    const credentials = keyPath
      ? cert(JSON.parse(readFileSync(resolve(keyPath), 'utf8')))
      : inlineKey
        ? cert(JSON.parse(inlineKey))
        : applicationDefault();
    const adminApp = getApps()[0] || initializeApp({ credential: credentials });
    adminAuth = getAuth(adminApp);
    adminDb = getFirestore(adminApp);
  } else {
    console.warn('D1: Firebase Admin is not configured. Add FIREBASE_SERVICE_ACCOUNT_PATH to .env.');
  }
} catch (error) {
  console.error('D1: Firebase Admin initialization failed:', error.message);
}

async function requireSignedIn(req, res, next) {
  if (!adminAuth || !adminDb) {
    return res.status(503).json({ success: false, message: 'Subscription backend is not configured. Add the Firebase Admin service-account key.' });
  }
  const authHeader = req.headers.authorization || '';
  const match = /^Bearer (\S+)$/.exec(authHeader);
  if (!match) return res.status(401).json({ success: false, message: 'Please log in before upgrading your plan.' });
  try {
    req.signedIn = await adminAuth.verifyIdToken(match[1], true);
    return next();
  } catch (error) {
    console.warn('D1: Token verification rejected:', error.code || error.message);
    return res.status(401).json({ success: false, message: 'Your login session is invalid or expired. Please sign in again.' });
  }
}

const app = express();
const port = Number(process.env.PORT) || 5000;
const resendKey = process.env.RESEND_API_KEY;
const fromEmail = process.env.RESEND_FROM || 'onboarding@resend.dev';
const ownerEmail = validateEmail(process.env.RESEND_OWNER_EMAIL);

app.use(cors({ origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173' }));
app.use(express.json({ limit: '10kb' }));

// Make a real HTTP request to Resend and log the response from the email API.
async function sendEmail(payload, route) {
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${resendKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from: fromEmail, ...payload }),
    signal: AbortSignal.timeout(15000),
  });

  const data = await response.json().catch(() => ({}));
  // This is Resend's HTTP status, not a status fabricated by Express.
  console.log(`Resend Email API Status ${response.status} | ${route}${data.id ? ` | Email ID: ${data.id}` : ''}`);
  if (!response.ok || !data.id) {
    const error = new Error(data.message || 'Resend did not accept the email.');
    error.apiStatus = response.status;
    throw error;
  }
  return data;
}

app.get('/api/health', (req, res) => {
  res.status(200).json({ success: true, message: 'Backend is running.' });
});

// Contact form from the previous website; now uses the same email API.
app.post('/api/contact', async (req, res) => {
  const contact = validateContact(req.body);
  if (!contact) {
    return res.status(400).json({ success: false, message: 'Please enter a valid name, email and message.' });
  }
  if (!resendKey || !ownerEmail) {
    return res.status(503).json({ success: false, message: 'Contact email is not configured on the server.' });
  }

  try {
    await sendEmail({
      to: [ownerEmail],
      reply_to: contact.email,
      subject: `Portfolio contact: ${contact.name.replace(/[\r\n]/g, ' ')}`,
      text: `Name: ${contact.name}\nEmail: ${contact.email}\n\n${contact.message}`,
      html: `<h2>New contact message</h2><p><b>Name:</b> ${escapeHtml(contact.name)}</p><p><b>Email:</b> ${escapeHtml(contact.email)}</p><p>${escapeHtml(contact.message).replace(/\n/g, '<br>')}</p>`,
    }, 'POST /api/contact');
    return res.status(200).json({ success: true, message: 'Message sent successfully.' });
  } catch (error) {
    console.error('Contact email failed:', error.message);
    return res.status(502).json({ success: false, message: 'Could not send the message. Please try again.' });
  }
});

// P5: React calls this endpoint through fetch('/api/subscribe').
app.post('/api/subscribe', async (req, res) => {
  const email = validateEmail(req.body?.email);
  if (!email) {
    return res.status(400).json({ success: false, message: 'Please enter a valid email address.' });
  }
  if (!resendKey) {
    return res.status(503).json({ success: false, message: 'Email API is not configured on the server.' });
  }

  try {
    await sendEmail({
      to: [email],
      subject: 'Welcome to DEV@Deakin updates',
      text: 'Thanks for subscribing to DEV@Deakin updates. I will share new projects and useful developer resources here.',
      html: '<h2>Thanks for subscribing!</h2><p>You will receive DEV@Deakin project updates and useful developer resources in your inbox.</p>',
    }, 'POST /api/subscribe');

    // P3 also informed the site owner. Keep this optional; a failure here
    // must not undo the subscriber's successful welcome email.
    if (ownerEmail && ownerEmail !== email) {
      try {
        await sendEmail({
          to: [ownerEmail],
          subject: 'New DEV@Deakin subscriber',
          text: `A new subscriber joined the mailing list: ${email}`,
        }, 'subscriber notification');
      } catch (error) {
        console.warn('Subscriber notification failed:', error.message);
      }
    }

    return res.status(200).json({
      success: true,
      message: 'Subscribed successfully! Please check your email for a welcome message.',
    });
  } catch (error) {
    console.error('Newsletter email failed:', error.message);
    const message = error.apiStatus === 403
      ? 'Email sending is restricted. Use your Resend account email for testing, or verify a sending domain.'
      : 'Could not send the welcome email. Please try again.';
    return res.status(502).json({ success: false, message });
  }
});

// D1: Only an authenticated user can request their own demo upgrade.
// No real payment takes place. Card number, expiry and CVV must never be sent.
app.post('/api/upgrade', requireSignedIn, async (req, res) => {
  const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
  if (!/^[\p{L}][\p{L} .'-]{1,79}$/u.test(name)) {
    return res.status(400).json({ success: false, message: 'Enter a valid name on the demonstration card.' });
  }
  if (Object.keys(req.body || {}).some((key) => key !== 'name')) {
    return res.status(400).json({ success: false, message: 'Only the demo cardholder name may be sent. Never send actual payment details.' });
  }

  const { uid, email = '', name: authName = '' } = req.signedIn;
  const profileRef = adminDb.collection('users').doc(uid);
  try {
    const alreadyPaid = await adminDb.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(profileRef);
      const current = snapshot.exists ? snapshot.data() : {};
      if (current.uid && current.uid !== uid) throw new Error('Profile owner does not match authenticated user.');
      if (current.plan === 'Paid') return true;
      if (current.plan && current.plan !== 'Free') throw new Error('Unknown plan type in profile.');

      // Merge preserves all P5 fields (name, email, createdAt, etc.).
      const changes = {
        uid,
        email: current.email || email,
        plan: 'Paid',
        updatedAt: FieldValue.serverTimestamp(),
        upgradedAt: FieldValue.serverTimestamp(),
      };
      if (!snapshot.exists) {
        const fullName = authName || name;
        const [firstName = '', ...rest] = fullName.trim().split(/\s+/);
        changes.firstName = firstName;
        changes.lastName = rest.join(' ');
        changes.fullName = fullName;
        changes.createdAt = FieldValue.serverTimestamp();
      }
      transaction.set(profileRef, changes, { merge: true });
      return false;
    });
    return res.status(200).json({
      success: true,
      plan: 'Paid',
      message: alreadyPaid ? 'You already have the Paid plan.' : 'Demo upgrade successful! Your Paid plan is now saved in Firestore.',
    });
  } catch (error) {
    console.error('Subscription upgrade failed:', error.message);
    return res.status(500).json({ success: false, message: 'Unable to update the plan in Firestore. Check the server configuration and try again.' });
  }
});

app.use((error, req, res, next) => {
  if (error instanceof SyntaxError && error.status === 400 && 'body' in error) {
    return res.status(400).json({ success: false, message: 'Invalid JSON in request.' });
  }
  if (error.type === 'entity.too.large') {
    return res.status(413).json({ success: false, message: 'Request is too large.' });
  }
  console.error('Server error:', error.message);
  return res.status(500).json({ success: false, message: 'An unexpected server error occurred.' });
});

app.listen(port, () => {
  console.log(`Express backend running at http://localhost:${port}`);
  console.log(resendKey ? 'Resend Email API key loaded.' : 'Resend is not configured. Add RESEND_API_KEY to .env.');
});
