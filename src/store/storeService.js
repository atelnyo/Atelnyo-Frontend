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
  // Buyer-scoped detail: strangers get a 404, guests must claim first.
  getOrder: (orderId) => api.get(`marketplace/orders/${encodeURIComponent(orderId)}/`),
  // Opens (or reuses) the buyer↔seller message thread for this order.
  // sellerId disambiguates a cart that holds items from several shops.
  contactSeller: (orderId, body, sellerId) => api.post(
    `marketplace/orders/${encodeURIComponent(orderId)}/contact-seller/`,
    sellerId != null ? { body, seller_id: sellerId } : { body },
  ),
};

export default storeService;
