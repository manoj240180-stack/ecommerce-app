# ShopEasy – Full-Stack E-Commerce Web Application

An online store where customers browse products, add them to a cart, check out and track their orders, and an admin manages products and orders.

## Tech stack
- **Frontend:** HTML, CSS, vanilla JavaScript (responsive, light and dark mode)
- **Backend:** Node.js, Express REST API
- **Database:** MongoDB Atlas with Mongoose
- **Auth:** JWT tokens, bcrypt password hashing, role-based access (User and Admin)
- **Hosting:** Render

## Features
**Customers**
- Register and log in
- Browse the product catalog, search by name and filter by category
- Add to cart, change quantities and check out with a delivery address
- View order history and cancel an order while it is still "placed"

**Admin**
- Add, edit and delete products (name, price, stock, category, icon or image)
- View all orders and update their status: placed, processing, shipped, delivered, cancelled

**Backend rules**
- Prices are always read from the database at checkout, never trusted from the browser
- Stock is reduced atomically when an order is placed, and restored if the order is cancelled
- Admin routes return 403 for normal users, and protected routes return 401 without a valid token
- Input validation, rate limiting on login routes, and safe rendering of user text

## API
| Method | Route | Access | Description |
|---|---|---|---|
| POST | `/api/auth/register` | Public | Create an account |
| POST | `/api/auth/login` | Public | Log in and get a token |
| GET | `/api/auth/me` | User | Current user |
| GET | `/api/products?q=&category=` | Public | List and search products |
| GET | `/api/products/categories` | Public | List categories |
| GET | `/api/products/:id` | Public | One product |
| POST | `/api/products` | Admin | Create a product |
| PUT | `/api/products/:id` | Admin | Update a product |
| DELETE | `/api/products/:id` | Admin | Delete a product |
| POST | `/api/orders` | User | Place an order |
| GET | `/api/orders/mine` | User | My orders |
| PUT | `/api/orders/:id/cancel` | User | Cancel my order |
| GET | `/api/orders` | Admin | All orders |
| PUT | `/api/orders/:id/status` | Admin | Change an order's status |

Protected routes need the header `Authorization: Bearer <token>`.

## Run locally
1. Install Node.js 18 or newer.
2. Run `npm install`.
3. Copy `.env.example` to `.env` and set:
   - `MONGODB_URI` (use the database name `shop`)
   - `JWT_SECRET` (any long random text)
   - `ADMIN_EMAIL` (the email that will become the admin account)
4. Run `npm run seed` once to add sample products.
5. Run `npm start` and open http://localhost:3000.
6. Register with the `ADMIN_EMAIL` address to get the admin account. Any other email gets a normal user account.

## Deploy on Render
1. Push the project to GitHub.
2. Create a Web Service. Build command `npm install`, start command `npm start`.
3. Add the environment variables `MONGODB_URI`, `JWT_SECRET` and `ADMIN_EMAIL`.
4. In MongoDB Atlas, allow network access from `0.0.0.0/0`.
5. Run the seed once from your computer with the same `MONGODB_URI`, or add products from the Admin page.

## Live demo
Add your Render link here after deploying.
