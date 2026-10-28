/**
 * storeService — thin Store-scoped wrapper over the existing marketplace API.
 * All prices, stock and totals come from the backend; this module never
 * computes authoritative values.
 */
import api from '../services/api';

function guestHeaders(guestToken) {
  return guestToken ? { headers: { 'X-Guest-Order-Token': guestToken } } : undefined;
}

export const storeService = {
  listProducts: (params) => api.get('marketplace/products/', { params }),
  listCategories: () => api.get('categories/', { params: { scope: 'product' } }),
  getProduct: (slugOrId) => api.get(`marketplace/products/${encodeURIComponent(slugOrId)}/`),
  // Guests pass { email, name }; signed-in buyers pass nothing.
  createOrder: (items, guest, shippingAddress, shippingMethod) =>
    api.post('marketplace/orders/', {
      items,
      hold_payment: true,
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
  claimOrder: (orderId, guestToken, password) =>
    api.post('marketplace/orders/claim/', { order_id: orderId, guest_token: guestToken, password }),
  listFavorites: (params) => api.get('marketplace/favorites/', { params }),
  addFavorite: (productId) => api.post('marketplace/favorites/', { product: productId }),
  removeFavorite: (favoriteId) => api.delete(`marketplace/favorites/${favoriteId}/`),
  createReview: (payload) => api.post('marketplace/reviews/', payload),
};

export default storeService;
