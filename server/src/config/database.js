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
 * Establishes connection to MongoDB using Mongoose
 * @param {string} uri - MongoDB connection string
 * @returns {Promise<typeof mongoose>}
 */
export const connectDB = async (uri) => {
  if (!uri) {
    throw new Error('MONGODB_URI is required to establish database connection.');
  }

  // Set up connection event listeners once
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

  try {
    const connection = await mongoose.connect(uri);
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
