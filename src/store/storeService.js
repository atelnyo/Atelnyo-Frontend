/**
 * storeService — thin Store-scoped wrapper over the existing marketplace API.
 * All prices, stock and totals come from the backend; this module never
 * computes authoritative values.
 */
import api from '../services/api';

function guestHeaders(guestToken) {
  return guestToken ? { headers: { 'X-Guest-Order-Token': guestToken } } : undefined;
}

const ORDER_LANGS = ['ht', 'en', 'fr', 'es'];

/**
 * Active interface language, sent with the order so guest emails (receipt,
 * shipping, delivery, claim link) render in the language the shopper used.
 */
function currentLanguage() {
  try {
    const stored = String(localStorage.getItem('atelnyo_lang') || '')
      .slice(0, 2)
      .toLowerCase();
    if (ORDER_LANGS.includes(stored)) return stored;
  } catch {
    // Private-mode storage can throw; the app default still applies.
  }
  return 'en';
}

export const storeService = {
  listProducts: (params) => api.get('marketplace/products/', { params }),
  listCategories: (signal) => api.get('categories/', {
    params: { scope: 'product' },
    ...(signal ? { signal } : {}),
  }),
  getProduct: (slugOrId) => api.get(`marketplace/products/${encodeURIComponent(slugOrId)}/`),
  // Up to 8 live products related by category (seller fallback).
  listRelated: (id) => api.get(`marketplace/products/${encodeURIComponent(id)}/related/`),
  // One seller's live catalog (the catalog API filters on seller username).
  listSellerProducts: (username, params) => api.get('marketplace/products/', {
    params: { seller: username, ...(params || {}) },
  }),
  // Shop identity for the seller storefront. Best-effort: a seller without
  // a public creator profile 404s and the page falls back to @username.
  getSellerProfile: (username) => api.get(
    `creator-profiles/${encodeURIComponent(username)}/`,
  ),
  // Guests pass { email, name }; signed-in buyers pass nothing.
  createOrder: (items, guest, shippingAddress, shippingMethod) =>
    api.post('marketplace/orders/', {
      items,
      hold_payment: true,
      language: currentLanguage(),
      ...(guest ? { guest_email: guest.email, guest_name: guest.name } : {}),
      ...(shippingAddress ? { shipping_address: shippingAddress } : {}),
      ...(shippingMethod ? { shipping_method: shippingMethod } : {}),
    }),
  quoteShipping: (items, address) => api.post('marketplace/printify/shipping-quote/', { items, address }),
  // guestToken is the one-time token returned when a guest creates the order.
  checkoutOrder: (orderId, provider = 'paypal', guestToken, pendingShippingConfirmation = false) =>
    api.post('checkout/order/', {
      order_id: orderId,
      provider,
      ...(pendingShippingConfirmation ? { pending_shipping_confirmation: true } : {}),
    }, guestHeaders(guestToken)),
  // No password when the shopper is already signed in: the claim then links
  // the order to the signed-in account instead of creating a new one.
  claimOrder: (orderId, guestToken, password) =>
    api.post('marketplace/orders/claim/', {
      order_id: orderId,
      guest_token: guestToken,
      ...(password ? { password } : {}),
    }),
  listFavorites: (params) => api.get('marketplace/favorites/', { params }),
  addFavorite: (productId) => api.post('marketplace/favorites/', { product: productId }),
  removeFavorite: (favoriteId) => api.delete(`marketplace/favorites/${favoriteId}/`),
  createReview: (payload) => api.post('marketplace/reviews/', payload),
  listOrders: () => api.get('marketplace/orders/'),
  // Buyer-scoped detail: strangers get a 404. A guest passes the checkout
  // token, so the page works before an account exists.
  getOrder: (orderId, guestToken) => api.get(
    `marketplace/orders/${encodeURIComponent(orderId)}/`,
    guestHeaders(guestToken),
  ),
  // Guest orders placed with the signed-in account's email but never linked.
  listUnclaimedOrders: () => api.get('marketplace/orders/unclaimed/'),
  // Public recovery for a guest who lost the link: order id + the email
  // used at checkout. The answer never reveals whether the pair matched.
  requestClaimLink: (orderId, email) => api.post(
    'marketplace/orders/request-claim-link/',
    { order_id: orderId, email },
  ),
  // Emails a fresh signed claim link to the account's own address only.
  sendClaimLink: (orderId) => api.post(
    'marketplace/orders/send-claim-link/',
    orderId != null ? { order_id: orderId } : {},
  ),
  // Opens (or reuses) the buyer↔seller message thread for this order.
  // sellerId disambiguates a cart that holds items from several shops. A
  // guest sends their token: with no account there is no thread, so the
  // backend emails the seller with the guest's address as Reply-To.
  contactSeller: (orderId, body, sellerId, guestToken) => api.post(
    `marketplace/orders/${encodeURIComponent(orderId)}/contact-seller/`,
    sellerId != null ? { body, seller_id: sellerId } : { body },
    guestHeaders(guestToken),
  ),
  // Correct the delivery address while the supplier does not have the order.
  // A guest passes their token for the same reason they can read the order.
  updateShippingAddress: (orderId, shippingAddress, guestToken) => api.post(
    `marketplace/orders/${encodeURIComponent(orderId)}/shipping-address/`,
    { shipping_address: shippingAddress },
    guestHeaders(guestToken),
  ),
  // Release an unpaid order: the units reserved at checkout return to stock
  // immediately instead of waiting for the 24h abandoned-order sweep. A guest
  // passes their token, so cancelling never requires creating an account.
  cancelOrder: (orderId, guestToken) => api.post(
    `marketplace/orders/${encodeURIComponent(orderId)}/cancel/`,
    {},
    guestHeaders(guestToken),
  ),
};

export default storeService;
