import mongoose from 'mongoose';
import {
  SUPPORT_STATUS,
  SUPPORT_CATEGORIES,
  SUPPORT_PRIORITIES,
} from './supportStateMachine.js';

/**
 * Message subdocument schema in a support ticket thread
 */
const supportMessageSchema = new mongoose.Schema(
  {
    senderType: {
      type: String,
      enum: ['CUSTOMER', 'ADMIN', 'SYSTEM'],
      required: [true, 'Sender type is required'],
    },
    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Sender user ID is required'],
    },
    message: {
      type: String,
      required: [true, 'Message text is required'],
      trim: true,
      maxlength: [3000, 'Message cannot exceed 3000 characters'],
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    _id: true,
    toJSON: {
      virtuals: true,
      transform: (doc, ret) => {
        ret.id = ret._id ? ret._id.toString() : ret.id;
        delete ret.__v;
        return ret;
      },
    },
  }
);

/**
 * Status change audit history subdocument schema
 */
const supportStatusHistorySchema = new mongoose.Schema(
  {
    status: {
      type: String,
      enum: Object.values(SUPPORT_STATUS),
      required: [true, 'Status is required'],
    },
    changedAt: {
      type: Date,
      default: Date.now,
    },
    changedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    note: {
      type: String,
      trim: true,
      default: '',
      maxlength: [500, 'Note cannot exceed 500 characters'],
    },
  },
  { _id: false }
);

/**
 * Support Ticket Root Schema
 */
const supportTicketSchema = new mongoose.Schema(
  {
    ticketNumber: {
      type: String,
      required: [true, 'Ticket number is required'],
      unique: true,
      uppercase: true,
      trim: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Customer user ID is required'],
      index: true,
    },
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
      default: null,
      index: true,
    },
    orderNumber: {
      type: String,
      trim: true,
      default: null,
      index: true,
    },
    returnId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Return',
      default: null,
      index: true,
    },
    returnNumber: {
      type: String,
      trim: true,
      default: null,
      index: true,
    },
    subject: {
      type: String,
      required: [true, 'Ticket subject is required'],
      trim: true,
      minlength: [3, 'Subject must be at least 3 characters'],
      maxlength: [200, 'Subject cannot exceed 200 characters'],
    },
    category: {
      type: String,
      enum: SUPPORT_CATEGORIES,
      required: [true, 'Ticket category is required'],
      index: true,
    },
    priority: {
      type: String,
      enum: SUPPORT_PRIORITIES,
      default: 'NORMAL',
      index: true,
    },
    status: {
      type: String,
      enum: Object.values(SUPPORT_STATUS),
      default: SUPPORT_STATUS.OPEN,
      index: true,
    },
    messages: [supportMessageSchema],
    statusHistory: [supportStatusHistorySchema],
    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },
    resolvedAt: {
      type: Date,
      default: null,
    },
    closedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (doc, ret) => {
        ret.id = ret._id ? ret._id.toString() : ret.id;
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  }
);

// Compound indexes
supportTicketSchema.index({ userId: 1, createdAt: -1 });
supportTicketSchema.index({ status: 1, createdAt: -1 });
supportTicketSchema.index({ category: 1, createdAt: -1 });
supportTicketSchema.index({ priority: 1, createdAt: -1 });
supportTicketSchema.index({ assignedTo: 1, status: 1 });

const SupportTicket = mongoose.model('SupportTicket', supportTicketSchema);

export default SupportTicket;
