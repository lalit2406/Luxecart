import mongoose from 'mongoose';

/**
 * Maps Mongoose readyState numerical values to human-readable strings
 */
const CONNECTION_STATES = {
  0: 'disconnected',
  1: 'connected',
  2: 'connecting',
  3: 'disconnecting',
};

/**
 * Returns current database connection status
 * @returns {{ status: string, isConnected: boolean }}
 */
export const getDBStatus = () => {
  const stateCode = mongoose.connection.readyState;
  const status = CONNECTION_STATES[stateCode] || 'unknown';
  return {
    status,
    isConnected: stateCode === 1,
  };
};

/**
 * Returns connection options configured for production resiliency
 * @param {boolean} [isProduction=false]
 * @returns {object}
 */
export const getProductionConnectionOptions = (isProduction = false) => {
  const options = {
    maxPoolSize: 50,
    minPoolSize: 5,
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
  };

  if (isProduction) {
    options.autoIndex = false;
  }

  return options;
};

/**
 * Establishes connection to MongoDB using Mongoose
 * @param {string} uri - MongoDB connection string
 * @param {object} [options={}] - Optional connection override options or environment flags
 * @returns {Promise<typeof mongoose>}
 */
export const connectDB = async (uri, options = {}) => {
  if (!uri) {
    throw new Error('MONGODB_URI is required to establish database connection.');
  }

  // Set up connection event listeners once if not already registered
  if (mongoose.connection.listenerCount('connected') === 0) {
    mongoose.connection.on('connected', () => {
      console.log('[Database] Connected to MongoDB successfully.');
    });

    mongoose.connection.on('error', (err) => {
      // Log sanitized error message without exposing connection URI or credentials
      console.error('[Database] MongoDB connection error:', err.message || 'Unknown database error');
    });

    mongoose.connection.on('disconnected', () => {
      console.log('[Database] MongoDB disconnected.');
    });
  }

  const isProduction = options.isProduction ?? (process.env.NODE_ENV === 'production');
  const connectionOptions = {
    ...getProductionConnectionOptions(isProduction),
    ...options,
  };
  delete connectionOptions.isProduction;

  try {
    const connection = await mongoose.connect(uri, connectionOptions);
    return connection;
  } catch (error) {
    console.error('[Database] Initial connection failure:', error.message || 'Failed to connect');
    throw error;
  }
};

/**
 * Closes the active MongoDB connection cleanly
 * @returns {Promise<void>}
 */
export const disconnectDB = async () => {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
    console.log('[Database] Mongoose connection closed cleanly.');
  }
};
