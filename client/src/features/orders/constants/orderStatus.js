import {
  Clock,
  CheckCircle,
  Package,
  Truck,
  CheckCircle2,
  XCircle,
} from 'lucide-react';

export const ORDER_STATUS_CONFIG = {
  PLACED: {
    label: 'Order Placed',
    badgeText: 'Placed',
    description: 'Your order has been received and items are reserved.',
    colorClass: 'bg-blue-50 text-blue-700 border-blue-200',
    dotColorClass: 'bg-blue-500',
    stepIndex: 0,
    icon: Clock,
  },
  CONFIRMED: {
    label: 'Order Confirmed',
    badgeText: 'Confirmed',
    description: 'Order verified and queued for luxury packaging.',
    colorClass: 'bg-amber-50 text-amber-700 border-amber-200',
    dotColorClass: 'bg-amber-500',
    stepIndex: 1,
    icon: CheckCircle,
  },
  PROCESSING: {
    label: 'Packaging & Processing',
    badgeText: 'Processing',
    description: 'Your items are being inspected and packed with care.',
    colorClass: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    dotColorClass: 'bg-indigo-500',
    stepIndex: 2,
    icon: Package,
  },
  SHIPPED: {
    label: 'Dispatched & In Transit',
    badgeText: 'Shipped',
    description: 'Your shipment is on its way with insured express delivery.',
    colorClass: 'bg-purple-50 text-purple-700 border-purple-200',
    dotColorClass: 'bg-purple-500',
    stepIndex: 3,
    icon: Truck,
  },
  DELIVERED: {
    label: 'Delivered',
    badgeText: 'Delivered',
    description: 'Your package has been safely delivered to your doorstep.',
    colorClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    dotColorClass: 'bg-emerald-500',
    stepIndex: 4,
    icon: CheckCircle2,
  },
  CANCELLED: {
    label: 'Cancelled',
    badgeText: 'Cancelled',
    description: 'This order was cancelled and inventory was returned.',
    colorClass: 'bg-red-50 text-red-700 border-red-200',
    dotColorClass: 'bg-red-500',
    stepIndex: -1,
    icon: XCircle,
  },
};

export const TIMELINE_STEPS = [
  'PLACED',
  'CONFIRMED',
  'PROCESSING',
  'SHIPPED',
  'DELIVERED',
];

export const getStatusConfig = (status) => {
  const normalized = (status || '').toUpperCase();
  return (
    ORDER_STATUS_CONFIG[normalized] || {
      label: normalized || 'Unknown',
      badgeText: normalized || 'Unknown',
      description: 'Order status update pending.',
      colorClass: 'bg-gray-50 text-gray-700 border-gray-200',
      dotColorClass: 'bg-gray-400',
      stepIndex: 0,
      icon: Clock,
    }
  );
};
