import { Router, type Response } from 'express';
import { randomBytes } from 'node:crypto';
import os from 'node:os';
import { z } from 'zod';
import { asyncHandler, HttpError, ok } from '../utils/http';

export const bridgeRouter = Router();

interface BridgeSession {
  token: string;
  code: string;
  userId: string;
  userName: string;
  userEmail: string;
  expiresAt: number;
  desktopClients: Set<Response>;
  mobileClients: Set<Response>;
  pairedDeviceName?: string;
  lastActive: Date;
}

// In-memory registries for real-time mobile bridge
const sessionsByToken = new Map<string, BridgeSession>();
const sessionsByCode = new Map<string, string>(); // 6-digit code -> token
const userActiveTokens = new Map<string, string>(); // userId -> token

function getLocalIpAddress(): string {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name] || []) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return 'localhost';
}

function broadcastToClients(clients: Set<Response>, eventName: string, data: any) {
  const payload = `event: ${eventName}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const res of clients) {
    try {
      res.write(payload);
    } catch {
      clients.delete(res);
    }
  }
}

// ---------------------------------------------------------------------------
// 1. GET /token - Desktop initiates or fetches its pairing token and 6-digit code
// ---------------------------------------------------------------------------
bridgeRouter.get('/token', asyncHandler(async (req, res) => {
  if (!req.user) throw new HttpError(401, 'Authentication required to generate bridge token.');

  const existingToken = userActiveTokens.get(req.user.id);
  let session = existingToken ? sessionsByToken.get(existingToken) : null;

  // Re-use or generate session (valid for 24 hours)
  if (!session || session.expiresAt < Date.now()) {
    if (session) {
      sessionsByCode.delete(session.code);
      sessionsByToken.delete(session.token);
    }

    const token = randomBytes(24).toString('base64url');
    // Generate unique 6-digit PIN code for easy manual entry on phone
    let code = Math.floor(100000 + Math.random() * 900000).toString();
    while (sessionsByCode.has(code)) {
      code = Math.floor(100000 + Math.random() * 900000).toString();
    }

    session = {
      token,
      code,
      userId: req.user.id,
      userName: req.user.name,
      userEmail: req.user.email,
      expiresAt: Date.now() + 24 * 60 * 60 * 1000,
      desktopClients: new Set(),
      mobileClients: new Set(),
      lastActive: new Date(),
    };

    sessionsByToken.set(token, session);
    sessionsByCode.set(code, token);
    userActiveTokens.set(req.user.id, token);
  }

  const isMobileConnected = session.mobileClients.size > 0;

  ok(res, {
    token: session.token,
    code: session.code,
    localIp: getLocalIpAddress(),
    isMobileConnected,
    pairedDeviceName: session.pairedDeviceName || null,
    expiresAt: new Date(session.expiresAt).toISOString(),
  });
}));

// ---------------------------------------------------------------------------
// 2. GET /events - Real-Time Server-Sent Events (SSE) Stream
// ---------------------------------------------------------------------------
bridgeRouter.get('/events', (req, res) => {
  const token = (req.query.token as string) || (req.user ? userActiveTokens.get(req.user.id) : null);
  const clientType = ((req.query.clientType as string) || 'DESKTOP').toUpperCase();
  const deviceName = (req.query.deviceName as string) || (clientType === 'MOBILE' ? 'Smartphone' : 'Desktop');

  if (!token || !sessionsByToken.has(token)) {
    res.status(404).json({ success: false, message: 'Invalid or expired bridge token.' });
    return;
  }

  const session = sessionsByToken.get(token)!;

  // Establish SSE stream headers
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no',
    'Access-Control-Allow-Origin': req.headers.origin || '*',
    'Access-Control-Allow-Credentials': 'true',
  });

  // Flush headers immediately
  res.write(': connected\n\n');

  if (clientType === 'MOBILE') {
    session.mobileClients.add(res);
    session.pairedDeviceName = deviceName;
    session.lastActive = new Date();

    // Notify desktop client(s) that phone connected
    broadcastToClients(session.desktopClients, 'PHONE_CONNECTED', {
      deviceName,
      connectedAt: new Date().toISOString(),
    });

    // Send confirmation to mobile
    res.write(`event: READY\ndata: ${JSON.stringify({ userName: session.userName, deviceName })}\n\n`);
  } else {
    session.desktopClients.add(res);
    // Send current status to desktop
    res.write(`event: STATUS\ndata: ${JSON.stringify({
      isMobileConnected: session.mobileClients.size > 0,
      deviceName: session.pairedDeviceName || null,
    })}\n\n`);
  }

  // Periodic heartbeat to prevent mobile browser / proxies from terminating connection
  const heartbeat = setInterval(() => {
    try {
      res.write(': ping\n\n');
    } catch {
      clearInterval(heartbeat);
    }
  }, 15000);

  // Clean up when connection closes
  req.on('close', () => {
    clearInterval(heartbeat);
    if (clientType === 'MOBILE') {
      session.mobileClients.delete(res);
      if (session.mobileClients.size === 0) {
        broadcastToClients(session.desktopClients, 'PHONE_DISCONNECTED', {
          disconnectedAt: new Date().toISOString(),
        });
      }
    } else {
      session.desktopClients.delete(res);
    }
  });
});

// ---------------------------------------------------------------------------
// 3. POST /pair - Mobile phone pairs via QR code token or 6-digit PIN
// ---------------------------------------------------------------------------
const pairSchema = z.object({
  token: z.string().optional(),
  code: z.string().optional(),
  deviceName: z.string().max(80).optional(),
});

bridgeRouter.post('/pair', asyncHandler(async (req, res) => {
  const { token, code, deviceName } = pairSchema.parse(req.body);

  let activeToken = token;
  if (!activeToken && code) {
    activeToken = sessionsByCode.get(code.trim().replace(/\s+/g, ''));
  }

  if (!activeToken || !sessionsByToken.has(activeToken)) {
    throw new HttpError(404, 'Invalid or expired pairing code. Please scan the QR code again.');
  }

  const session = sessionsByToken.get(activeToken)!;
  if (deviceName) {
    session.pairedDeviceName = deviceName;
  }
  session.lastActive = new Date();

  ok(res, {
    token: session.token,
    user: {
      id: session.userId,
      name: session.userName,
      email: session.userEmail,
    },
    deviceName: session.pairedDeviceName || 'Mobile Phone',
  }, 'Phone successfully connected to Melosis CRM.');
}));

// ---------------------------------------------------------------------------
// 4. POST /call - Desktop triggers Click-to-Call relay to paired phone
// ---------------------------------------------------------------------------
const callSchema = z.object({
  token: z.string(),
  leadId: z.string().optional(),
  leadName: z.string().min(1),
  phoneNumber: z.string().min(3),
});

bridgeRouter.post('/call', asyncHandler(async (req, res) => {
  const { token, leadId, leadName, phoneNumber } = callSchema.parse(req.body);
  const session = sessionsByToken.get(token);

  if (!session) {
    throw new HttpError(404, 'Active phone bridge session not found.');
  }

  if (session.mobileClients.size === 0) {
    throw new HttpError(400, 'Your mobile phone is not currently connected. Please scan the QR code to pair your phone.');
  }

  const callId = randomBytes(8).toString('hex');
  const payload = {
    callId,
    leadId: leadId || null,
    leadName,
    phoneNumber,
    timestamp: new Date().toISOString(),
  };

  // Relay incoming call notification to mobile client(s)
  broadcastToClients(session.mobileClients, 'INCOMING_CALL', payload);

  // Notify desktop that dispatch was successful
  broadcastToClients(session.desktopClients, 'CALL_DISPATCHED', payload);

  ok(res, { callId, dispatched: true }, `Call dispatched to paired mobile phone for ${leadName}.`);
}));

// ---------------------------------------------------------------------------
// 5. POST /call-status - Mobile reports call accepted or declined
// ---------------------------------------------------------------------------
const statusSchema = z.object({
  token: z.string(),
  callId: z.string(),
  status: z.enum(['ACCEPTED', 'DECLINED', 'DISMISSED']),
  phoneNumber: z.string().optional(),
});

bridgeRouter.post('/call-status', asyncHandler(async (req, res) => {
  const { token, callId, status, phoneNumber } = statusSchema.parse(req.body);
  const session = sessionsByToken.get(token);

  if (!session) {
    throw new HttpError(404, 'Active phone bridge session not found.');
  }

  // Relay call outcome event to desktop client(s)
  broadcastToClients(session.desktopClients, 'CALL_STATUS', {
    callId,
    status,
    phoneNumber,
    timestamp: new Date().toISOString(),
  });

  ok(res, { recorded: true });
}));

// ---------------------------------------------------------------------------
// 6. POST /unpair - Disconnect current mobile phone
// ---------------------------------------------------------------------------
bridgeRouter.post('/unpair', asyncHandler(async (req, res) => {
  const token = req.body?.token || (req.user ? userActiveTokens.get(req.user.id) : null);
  if (token && sessionsByToken.has(token)) {
    const session = sessionsByToken.get(token)!;
    // Notify clients that session is severed
    broadcastToClients(session.mobileClients, 'DISCONNECTED', {});
    broadcastToClients(session.desktopClients, 'PHONE_DISCONNECTED', {});

    // Explicitly end all active HTTP response streams
    for (const client of session.mobileClients) {
      try {
        client.end();
      } catch {}
    }
    session.mobileClients.clear();
    session.pairedDeviceName = undefined;

    // Completely revoke the session so disconnected phone cannot auto-reconnect
    sessionsByCode.delete(session.code);
    sessionsByToken.delete(token);
    userActiveTokens.delete(session.userId);
  }
  ok(res, { disconnected: true });
}));
