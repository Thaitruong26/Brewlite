import type { PaginatedResponse, Product } from "./types";

/** Explicit preview-only fixtures matching the documented menu examples and project seed data. */
export const developmentProducts: Product[] = [
  { id: 1, name: "Cà phê sữa", price: 35000, imageUrl: "/img/ca-phe-sua.jpg", category: "Cà phê", stock: 50, inStock: true },
  { id: 2, name: "Americano", price: 40000, imageUrl: "/img/americano.jpg", category: "Cà phê", stock: 50, inStock: true },
  { id: 3, name: "Cappuccino", price: 45000, imageUrl: "/img/cappuccino.jpg", category: "Cà phê", stock: 40, inStock: true },
  { id: 4, name: "Trà đào", price: 39000, imageUrl: "/img/tra-dao.jpg", category: "Trà", stock: 40, inStock: true },
  { id: 5, name: "Latte", price: 48000, imageUrl: "/img/latte.jpg", category: "Cà phê", stock: 30, inStock: true },
  { id: 6, name: "Bạc xỉu", price: 38000, imageUrl: "/img/bac-xiu.jpg", category: "Cà phê", stock: 40, inStock: true },
  { id: 7, name: "Trà vải", price: 42000, imageUrl: "/img/tra-vai.jpg", category: "Trà", stock: 35, inStock: true },
  { id: 8, name: "Trà sữa trân châu", price: 45000, imageUrl: "/img/tra-sua.jpg", category: "Trà", stock: 35, inStock: true },
  { id: 9, name: "Matcha đá xay", price: 52000, imageUrl: "/img/matcha-da-xay.jpg", category: "Đá xay", stock: 25, inStock: true },
  { id: 10, name: "Cà phê muối", price: 42000, imageUrl: "/img/ca-phe-muoi.jpg", category: "Cà phê", stock: 5, inStock: true },
];

export function getDevelopmentProducts(category?: string): PaginatedResponse<Product> {
  const data = category ? developmentProducts.filter((product) => product.category === category) : developmentProducts;
  return { data, meta: { page: 1, limit: 20, total: data.length, totalPages: data.length ? 1 : 0 } };
}
