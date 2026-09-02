/**
 * Standard API Success Response
 * @param {import('express').Response} res
 * @param {number} statusCode
 * @param {string} message
 * @param {any} data
 * @param {object} [meta]
 */
export const sendSuccess = (res, statusCode = 200, message = 'Success', data = {}, meta = undefined) => {
  const response = {
    success: true,
    message,
    data,
  };

  if (meta) {
    response.meta = meta;
  }

  return res.status(statusCode).json(response);
};

/**
 * Standard API Error Response
 * @param {import('express').Response} res
 * @param {number} statusCode
 * @param {string} message
 * @param {string} [errorCode]
 * @param {any} [details]
 */
export const sendError = (res, statusCode = 500, message = 'Internal Server Error', errorCode = 'SERVER_ERROR', details = undefined) => {
  const response = {
    success: false,
    message,
    error: {
      code: errorCode,
    },
  };

  if (details && process.env.NODE_ENV !== 'production') {
    response.error.details = details;
  }

  return res.status(statusCode).json(response);
};
