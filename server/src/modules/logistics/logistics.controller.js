import logisticsService from './logistics.service.js';
import { sendSuccess } from '../../utils/response.js';

/**
 * Admin: Retrieve simulated rate quotes for 500 g and 1 kg tiers
 */
export const getRateQuotes = async (req, res, next) => {
  try {
    const { orderNumber } = req.params;
    const quotesData = await logisticsService.getRateQuotes(orderNumber);
    return sendSuccess(res, 200, 'Mock rate quotes retrieved successfully', quotesData);
  } catch (error) {
    next(error);
  }
};

/**
 * Admin: Manifest mock shipment and generate MOCK- AWB
 */
export const manifestShipment = async (req, res, next) => {
  try {
    const { orderNumber } = req.params;
    const shipment = await logisticsService.manifestShipment(orderNumber, req.body, req.user?.id);
    return sendSuccess(res, 201, 'Mock shipment manifested successfully', { shipment });
  } catch (error) {
    next(error);
  }
};

/**
 * Admin: Advance mock shipment to next sequential milestone
 */
export const advanceMilestone = async (req, res, next) => {
  try {
    const { orderNumber } = req.params;
    const shipment = await logisticsService.advanceMilestone(orderNumber, req.body, req.user?.id);
    return sendSuccess(res, 200, 'Shipment milestone advanced successfully', { shipment });
  } catch (error) {
    next(error);
  }
};

/**
 * Admin: Simulate delivery exception (delivery attempt failed or RTO)
 */
export const simulateException = async (req, res, next) => {
  try {
    const { orderNumber } = req.params;
    const shipment = await logisticsService.simulateException(orderNumber, req.body, req.user?.id);
    return sendSuccess(res, 200, 'Logistics exception simulated successfully', { shipment });
  } catch (error) {
    next(error);
  }
};

/**
 * Customer / Admin: Retrieve read-only tracking checkpoints for an order
 */
export const getOrderTracking = async (req, res, next) => {
  try {
    const { orderNumber } = req.params;
    const trackingData = await logisticsService.getTracking(orderNumber, req.user);
    return sendSuccess(res, 200, 'Tracking details retrieved successfully', trackingData);
  } catch (error) {
    next(error);
  }
};

/**
 * Customer / Admin: Retrieve simulated communication log (SMS & Email previews)
 */
export const getOrderNotifications = async (req, res, next) => {
  try {
    const { orderNumber } = req.params;
    const notificationData = await logisticsService.getNotifications(orderNumber, req.user);
    return sendSuccess(res, 200, 'Simulated notifications retrieved successfully', notificationData);
  } catch (error) {
    next(error);
  }
};
