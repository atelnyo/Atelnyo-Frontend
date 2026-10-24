/**
 * storeService — thin Store-scoped wrapper over the existing marketplace API.
 * All prices, stock and totals come from the backend; this module never
 * computes authoritative values.
 */
import api from '../services/api';

export const storeService = {
  listProducts: (params) => api.get('marketplace/products/', { params }),
  listCategories: () => api.get('categories/', { params: { scope: 'product' } }),
  getProduct: (slugOrId) => api.get(`marketplace/products/${encodeURIComponent(slugOrId)}/`),
  createOrder: (items) => api.post('marketplace/orders/', { items, hold_payment: true }),
  checkoutOrder: (orderId, provider = 'paypal') =>
    api.post('checkout/order/', { order_id: orderId, provider }),
  listFavorites: (params) => api.get('marketplace/favorites/', { params }),
  addFavorite: (productId) => api.post('marketplace/favorites/', { product: productId }),
  removeFavorite: (favoriteId) => api.delete(`marketplace/favorites/${favoriteId}/`),
};

export default storeService;
