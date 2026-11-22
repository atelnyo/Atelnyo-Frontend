/**
 * Shared payment-status + fulfillment labels for the buyer's Store orders.
 *
 * The Store order list and the order detail page must speak the same
 * language: one source of truth for the badge copy/colour and the
 * Printify fulfillment status labels.
 */
export const STORE_ORDER_STATUS = {
  pending: { color: '#fbbf24', ht: 'An atant peman', en: 'Awaiting payment' },
  paid: { color: '#34d399', ht: 'Peye', en: 'Paid' },
  fulfilled: { color: '#34d399', ht: 'Peye · Ranpli', en: 'Paid · Fulfilled' },
  completed: { color: '#34d399', ht: 'Peye · Konplete', en: 'Paid · Completed' },
  cancelled: { color: '#94a3b8', ht: 'Anile', en: 'Cancelled' },
  refunded: { color: '#94a3b8', ht: 'Rembouse', en: 'Refunded' },
};

export const FULFILLMENT_LABEL = {
  pending: { ht: 'Ap tann', en: 'Pending' },
  'on-hold': { ht: 'An atant', en: 'On hold' },
  'in-production': { ht: 'An pwodiksyon', en: 'In production' },
  'partially-fulfilled': { ht: 'Kèk atik voye', en: 'Partially shipped' },
  fulfilled: { ht: 'Voye', en: 'Shipped' },
  canceled: { ht: 'Anile', en: 'Cancelled' },
};

/** Badge shape for an Order.status value. */
export function storeOrderStatus(status, isHt) {
  const entry = STORE_ORDER_STATUS[status] || {
    color: '#94a3b8', ht: status, en: status,
  };
  return { ...entry, label: entry[isHt ? 'ht' : 'en'] || status };
}

/** Human label for a printify_fulfillment[].status value. */
export function fulfillmentLabel(status, isHt) {
  const entry = FULFILLMENT_LABEL[status];
  return (entry && entry[isHt ? 'ht' : 'en']) || status || (isHt ? 'Ap tann mizajou' : 'Awaiting update');
}
