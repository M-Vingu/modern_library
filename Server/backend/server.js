require('dotenv').config();

const express = require('express');
const http = require('http');
const mongoose = require('mongoose');
const cors = require('cors');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const jwt = require('jsonwebtoken');
const pinoHttp = require('pino-http');

const securityHeaders = require('./middleware/securityHeaders');
const sanitizeRequest = require('./middleware/sanitizeMiddleware');
const { createRateLimiter } = require('./middleware/rateLimiter');
const requestContext = require('./middleware/requestContext');
const responseEnvelope = require('./middleware/responseEnvelope');
const { notFoundHandler, errorHandler } = require('./middleware/errorHandler');
const { validateEnv } = require('./config/validateEnv');
const { logger } = require('./utils/logger');
const { startWorkers } = require('./jobs/worker');
const { startAiMaintenanceScheduler } = require('./jobs/aiMaintenanceScheduler');

const User = require('./models/user');
const Wallet = require('./models/wallet');
const { initLiveClassroomSocketServer } = require('./realtime/liveClassroomSocket');

validateEnv();

const app = express();
const server = http.createServer(app);
const SECRET = process.env.JWT_SECRET;
const isProduction = String(process.env.NODE_ENV || '').toLowerCase() === 'production';
const allowedOrigins = (process.env.FRONTEND_URLS || process.env.FRONTEND_URL || 'http://localhost:3000')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

function getJwtSignOptions() {
  const options = {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
    algorithm: 'HS256',
  };
  if (process.env.JWT_ISSUER) options.issuer = process.env.JWT_ISSUER;
  if (process.env.JWT_AUDIENCE) options.audience = process.env.JWT_AUDIENCE;
  return options;
}

if (!SECRET) {
  throw new Error('Missing JWT_SECRET in environment');
}

app.disable('x-powered-by');
app.set('trust proxy', 1);
app.use(requestContext);
app.use(responseEnvelope);
app.use(pinoHttp({
  logger,
  customProps: (req) => ({ requestId: req.requestId }),
  serializers: {
    req(request) {
      return { id: request.requestId, method: request.method, url: request.url };
    },
  },
}));
app.use(securityHeaders);
app.use(cors({
  origin: (origin, callback) => {
    // Allow server-to-server tools without Origin header.
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-Id', 'Idempotency-Key'],
  exposedHeaders: ['X-Request-Id'],
  maxAge: 86400,
  optionsSuccessStatus: 204,
}));
app.use(express.json({ limit: isProduction ? '16kb' : '32kb' }));
app.use(express.urlencoded({ extended: true, limit: isProduction ? '16kb' : '32kb' }));
app.use(sanitizeRequest);
app.use(createRateLimiter({ windowMs: 15 * 60 * 1000, max: 300, keyPrefix: 'global' }));

app.use(passport.initialize());

passport.use(new GoogleStrategy({
  clientID: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  callbackURL: '/auth/google/callback',
}, async (_accessToken, _refreshToken, profile, done) => {
  try {
    const email = profile.emails[0].value;

    let user = await User.findOne({ email });
    if (!user) {
      user = await User.create({
        name: profile.displayName,
        email,
        googleId: profile.id,
      });

      const wallet = await Wallet.create({ userId: user._id });
      user.wallet = wallet._id;
      await user.save();
    }

    return done(null, user);
  } catch (err) {
    return done(err, null);
  }
}));

app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/users', require('./routes/userRoutes'));
app.use('/api/books', require('./routes/bookRoutes'));
app.use('/api/past-papers', require('./routes/pastPaperRoutes'));
app.use('/api/wallet', require('./routes/walletRoutes'));
app.use('/api/courses', require('./routes/courseRoutes'));
app.use('/api/products', require('./routes/productRoutes'));
app.use('/api/marketplace', require('./routes/marketplaceRoutes'));
app.use('/api/live-classrooms', require('./routes/liveClassroomRoutes'));
app.use('/api/kids', require('./routes/kidsRoutes'));
app.use('/api/assessment', require('./routes/assessmentRoutes'));
app.use('/api/rides', require('./routes/rideRoutes'));
app.use('/api/transport', require('./routes/transportRoutes'));
app.use('/api/hostels', require('./routes/hostelRoutes'));
app.use('/api/transactions', require('./routes/transactionRoutes'));
app.use('/api/ai', require('./routes/aiRoutes'));
app.use('/api/partners', require('./routes/partnerRoutes'));
app.use('/api/files', require('./routes/fileRoutes'));
app.use('/api/docs', require('./routes/docsRoutes'));
app.use('/api/system', require('./routes/systemRoutes'));
app.use('/api/compliance', require('./routes/complianceRoutes'));
app.use('/api/business', require('./routes/businessRoutes'));
app.use('/api/queues', require('./routes/queueAdminRoutes'));

app.get('/auth/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

app.get('/auth/google/callback',
  passport.authenticate('google', { session: false }),
  (req, res) => {
    const token = jwt.sign(
      { id: req.user._id, role: req.user.role || 'user' },
      SECRET,
      getJwtSignOptions(),
    );

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    res.redirect(`${frontendUrl}/dashboard?token=${token}`);
  });

app.get('/', (_req, res) => {
  res.send('Modern Library API running...');
});

app.use(notFoundHandler);
app.use(errorHandler);
initLiveClassroomSocketServer(server, { allowedOrigins });

mongoose.connect(process.env.MONGO_URI, {
  serverSelectionTimeoutMS: 10000,
  connectTimeoutMS: 10000,
})
  .then(() => {
    logger.info('MongoDB Connected');
    if (process.env.RUN_JOB_WORKER === 'true') {
      startWorkers();
      logger.info('Background workers started in API process');
    }
    startAiMaintenanceScheduler({ role: 'api' });
    const PORT = process.env.PORT || 5000;
    server.listen(PORT, () => logger.info(`Server running on port ${PORT}`));
  })
  .catch((err) => {
    logger.error({
      name: err.name,
      message: err.message,
      code: err.code,
      reason: err.reason?.message,
    }, 'MongoDB connection failed');
  });
