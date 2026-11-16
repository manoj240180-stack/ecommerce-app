const $ = (s) => document.querySelector(s);
const STATUSES = ["placed", "processing", "shipped", "delivered", "cancelled"];
const money = (n) => "₹" + Number(n).toLocaleString("en-IN", { maximumFractionDigits: 2 });

let token = localStorage.getItem("shop_token");
let user = null;
try { user = JSON.parse(localStorage.getItem("shop_user")); } catch (e) {}
let cart = {};
try { cart = JSON.parse(localStorage.getItem("shop_cart")) || {}; } catch (e) {}
let afterLogin = "#/";

/* ---------- Small helpers ---------- */
// h("div", {class: "x", onclick: fn}, child, child) builds an element safely (text is never parsed as HTML)
function h(tag, props, ...kids) {
  const e = document.createElement(tag);
  let value;
  for (const [k, v] of Object.entries(props || {})) {
    if (k === "class") e.className = v;
    else if (k === "value") value = v;
    else if (k.startsWith("on")) e.addEventListener(k.slice(2), v);
    else if (v !== false && v !== null && v !== undefined) e.setAttribute(k, v);
  }
  kids.flat(Infinity).forEach((c) => {
    if (c === null || c === undefined || c === false) return;
    e.append(c instanceof Node ? c : document.createTextNode(String(c)));
  });
  if (value !== undefined) e.value = value;
  return e;
}

let toastTimer;
function toast(msg, bad) {
  const t = $("#toast");
  t.textContent = msg;
  t.className = "toast show" + (bad ? " bad" : "");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (t.className = "toast"), 2600);
}

function saveCart() { localStorage.setItem("shop_cart", JSON.stringify(cart)); }

async function api(path, method = "GET", body) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers.Authorization = "Bearer " + token;
  const res = await fetch("/api" + path, { method, headers, body: body ? JSON.stringify(body) : undefined });
  let data = {};
  try { data = await res.json(); } catch (e) {}
  if (res.status === 401 && token) {
    logout();
    afterLogin = location.hash && location.hash !== "#/login" ? location.hash : "#/";
    location.hash = "#/login";
  }
  if (!res.ok) throw new Error(data.error || "Something went wrong.");
  return data;
}

function logout() {
  token = null;
  user = null;
  localStorage.removeItem("shop_token");
  localStorage.removeItem("shop_user");
  renderNav();
}

/* ---------- Navigation ---------- */
function renderNav() {
  const count = Object.values(cart).reduce((s, i) => s + i.qty, 0);
  const cur = location.hash || "#/";
  const link = (href, label) => h("a", { href, class: cur === href ? "active" : "" }, label);
  $("#nav").replaceChildren(
    link("#/", "Shop"),
    token ? link("#/orders", "My orders") : null,
    user && user.role === "admin" ? link("#/admin", "Admin") : null,
    link("#/cart", "Cart (" + count + ")"),
    token
      ? h("button", { class: "ghost small", onclick: () => { logout(); location.hash = "#/"; route(); } }, "Log out (" + (user ? user.name : "") + ")")
      : link("#/login", "Log in")
  );
}

function route() {
  renderNav();
  const view = $("#view");
  const r = (location.hash || "#/").replace(/^#/, "");
  window.scrollTo(0, 0);
  if (r === "/cart") return cartView(view);
  if (r === "/orders") return ordersView(view);
  if (r === "/admin") return adminView(view);
  if (r === "/login") return loginView(view);
  return shopView(view);
}

/* ---------- Shop ---------- */
let shopSearch = "";
let shopCat = "";

function addToCart(p) {
  const cur = cart[p._id] ? cart[p._id].qty : 0;
  if (cur + 1 > p.stock) { toast("Only " + p.stock + " in stock.", true); return; }
  cart[p._id] = { id: p._id, name: p.name, price: p.price, emoji: p.emoji, qty: cur + 1, stock: p.stock };
  saveCart();
  renderNav();
  toast("Added to cart");
}

function productCard(p) {
  const out = p.stock < 1;
  return h("article", { class: "product" },
    p.imageUrl ? h("img", { src: p.imageUrl, alt: p.name, loading: "lazy" }) : h("div", { class: "emoji", "aria-hidden": "true" }, p.emoji || "🛍️"),
    h("span", { class: "cat" }, p.category),
    h("h3", {}, p.name),
    p.description ? h("p", { class: "desc" }, p.description) : null,
    h("div", { class: "buy" },
      h("strong", {}, money(p.price)),
      h("button", { disabled: out, onclick: () => addToCart(p) }, out ? "Out of stock" : "Add to cart")),
    out ? null : h("small", { class: "muted" }, p.stock <= 5 ? "Only " + p.stock + " left" : "In stock")
  );
}

async function shopView(view) {
  const search = h("input", { type: "search", placeholder: "Search products", value: shopSearch, "aria-label": "Search products" });
  const catSel = h("select", { "aria-label": "Category" }, h("option", { value: "" }, "All categories"));
  const grid = h("div", { class: "products" });
  view.replaceChildren(h("h1", {}, "Shop"), h("div", { class: "toolbar" }, search, catSel), grid);
  try {
    const cats = await api("/products/categories");
    cats.forEach((c) => catSel.append(h("option", { value: c }, c)));
    catSel.value = shopCat;
  } catch (e) {}

  async function load() {
    const q = new URLSearchParams();
    if (shopSearch) q.set("q", shopSearch);
    if (shopCat) q.set("category", shopCat);
    try {
      const list = await api("/products" + (q.toString() ? "?" + q : ""));
      grid.replaceChildren(...(list.length ? list.map(productCard) : [h("p", { class: "muted" }, "No products found.")]));
    } catch (err) {
      grid.replaceChildren(h("p", { class: "msg" }, err.message));
    }
  }
  let t;
  search.addEventListener("input", () => {
    clearTimeout(t);
    t = setTimeout(() => { shopSearch = search.value.trim(); load(); }, 300);
  });
  catSel.addEventListener("change", () => { shopCat = catSel.value; load(); });
  load();
}

/* ---------- Cart and checkout ---------- */
function changeQty(id, d) {
  const i = cart[id];
  if (!i) return;
  const n = i.qty + d;
  if (n < 1) delete cart[id];
  else if (n > i.stock) { toast("Only " + i.stock + " in stock.", true); return; }
  else i.qty = n;
  saveCart();
  route();
}

function cartView(view) {
  const items = Object.values(cart);
  view.replaceChildren(h("h1", {}, "Your cart"));
  if (!items.length) {
    view.append(h("p", { class: "muted" }, "Your cart is empty."), h("a", { href: "#/", class: "btn" }, "Browse products"));
    return;
  }
  const total = items.reduce((s, i) => s + i.price * i.qty, 0);
  items.forEach((i) => view.append(h("div", { class: "cart-row" },
    h("span", { class: "c-emoji" }, i.emoji || "🛍️"),
    h("div", { class: "c-name" }, h("strong", {}, i.name), h("small", { class: "muted" }, money(i.price) + " each")),
    h("div", { class: "qty" },
      h("button", { class: "ghost small", "aria-label": "Decrease quantity", onclick: () => changeQty(i.id, -1) }, "−"),
      h("span", {}, i.qty),
      h("button", { class: "ghost small", "aria-label": "Increase quantity", onclick: () => changeQty(i.id, 1) }, "+")),
    h("strong", { class: "line" }, money(i.price * i.qty)),
    h("button", { class: "ghost small del", onclick: () => { delete cart[i.id]; saveCart(); route(); } }, "Remove")
  )));

  const msg = h("p", { class: "msg", role: "alert" });
  const summary = h("div", { class: "card summary" },
    h("div", { class: "total-line" }, h("span", {}, "Total"), h("strong", {}, money(total))));

  if (!token) {
    summary.append(h("p", { class: "muted" }, "Please log in to place your order."),
      h("button", { onclick: () => { afterLogin = "#/cart"; location.hash = "#/login"; } }, "Log in to checkout"));
  } else {
    const addr = h("textarea", { placeholder: "House no, street, city, PIN code", value: localStorage.getItem("shop_addr") || "", "aria-label": "Delivery address" });
    const btn = h("button", {}, "Place order");
    btn.addEventListener("click", async () => {
      msg.textContent = "";
      btn.disabled = true;
      try {
        await api("/orders", "POST", { items: items.map((i) => ({ productId: i.id, qty: i.qty })), address: addr.value });
        localStorage.setItem("shop_addr", addr.value);
        cart = {};
        saveCart();
        toast("Order placed. Thank you!");
        location.hash = "#/orders";
      } catch (err) {
        msg.textContent = err.message;
        btn.disabled = false;
      }
    });
    summary.append(h("label", {}, "Delivery address", addr), btn);
  }
  summary.append(msg);
  view.append(summary);
}

/* ---------- Orders ---------- */
function orderCard(o, admin) {
  const card = h("div", { class: "card order" },
    h("div", { class: "o-head" },
      h("strong", {}, "Order #" + o._id.slice(-6).toUpperCase()),
      h("span", { class: "badge " + o.status }, o.status),
      h("small", { class: "muted" }, new Date(o.createdAt).toLocaleString())));
  if (admin && o.user) card.append(h("small", { class: "muted" }, "Customer: " + o.user.name + " (" + o.user.email + ")"));
  o.items.forEach((i) => card.append(h("div", { class: "o-line" }, h("span", {}, i.qty + " × " + i.name), h("span", {}, money(i.price * i.qty)))));
  card.append(h("div", { class: "o-line total" }, h("span", {}, "Total"), h("strong", {}, money(o.total))));
  card.append(h("small", { class: "muted" }, "Deliver to: " + o.address));

  if (admin) {
    const sel = h("select", { "aria-label": "Order status", value: o.status }, ...STATUSES.map((s) => h("option", { value: s }, s)));
    sel.addEventListener("change", async () => {
      try { await api("/orders/" + o._id + "/status", "PUT", { status: sel.value }); toast("Status updated"); }
      catch (err) { toast(err.message, true); }
      route();
    });
    card.append(h("div", { class: "row" }, sel));
  } else if (o.status === "placed") {
    card.append(h("div", { class: "row" }, h("button", {
      class: "ghost small del",
      onclick: async () => {
        if (!confirm("Cancel this order?")) return;
        try { await api("/orders/" + o._id + "/cancel", "PUT"); toast("Order cancelled"); route(); }
        catch (err) { toast(err.message, true); }
      },
    }, "Cancel order")));
  }
  return card;
}

async function ordersView(view) {
  if (!token) { afterLogin = "#/orders"; location.hash = "#/login"; return; }
  view.replaceChildren(h("h1", {}, "My orders"), h("p", { class: "muted" }, "Loading..."));
  try {
    const orders = await api("/orders/mine");
    view.replaceChildren(h("h1", {}, "My orders"),
      ...(orders.length ? orders.map((o) => orderCard(o, false)) : [h("p", { class: "muted" }, "You have no orders yet.")]));
  } catch (err) {
    view.replaceChildren(h("h1", {}, "My orders"), h("p", { class: "msg" }, err.message));
  }
}

/* ---------- Admin ---------- */
let adminTab = "products";
let editing = null;

async function adminView(view) {
  if (!user || user.role !== "admin") {
    view.replaceChildren(h("h1", {}, "Admin"), h("p", { class: "msg" }, "Admin access only. Log in with the admin account."));
    return;
  }
  const tabBtn = (key, label) => h("button", { class: "tab" + (adminTab === key ? " active" : ""), onclick: () => { adminTab = key; editing = null; route(); } }, label);
  const body = h("div");
  view.replaceChildren(h("h1", {}, "Admin"), h("div", { class: "tabs" }, tabBtn("products", "Products"), tabBtn("orders", "Orders")), body);
  try {
    if (adminTab === "orders") await adminOrders(body);
    else await adminProducts(body);
  } catch (err) {
    body.replaceChildren(h("p", { class: "msg" }, err.message));
  }
}

async function adminOrders(body) {
  const orders = await api("/orders");
  body.replaceChildren(...(orders.length ? orders.map((o) => orderCard(o, true)) : [h("p", { class: "muted" }, "No orders yet.")]));
}

async function adminProducts(body) {
  const keys = ["name", "price", "stock", "category", "emoji", "imageUrl", "description"];
  const f = {};
  const field = (key, label, attrs) => { f[key] = h("input", attrs || {}); return h("label", {}, label, f[key]); };
  f.description = h("textarea", { maxlength: "1000" });
  const msg = h("p", { class: "msg full", role: "alert" });
  const saveBtn = h("button", {}, editing ? "Save changes" : "Add product");

  const form = h("div", { class: "card" },
    h("h2", {}, editing ? "Edit product" : "Add a product"),
    h("div", { class: "form grid" },
      field("name", "Name", { maxlength: "120" }),
      field("price", "Price (₹)", { type: "number", min: "0", step: "0.01" }),
      field("stock", "Stock", { type: "number", min: "0", step: "1" }),
      field("category", "Category", { maxlength: "50", placeholder: "General" }),
      field("emoji", "Emoji icon", { maxlength: "8", placeholder: "🛍️" }),
      field("imageUrl", "Image link (optional)", { placeholder: "https://..." }),
      h("label", { class: "full" }, "Description", f.description),
      h("div", { class: "row full" }, saveBtn,
        editing ? h("button", { class: "ghost", onclick: () => { editing = null; route(); } }, "Cancel") : null),
      msg));
  if (editing) keys.forEach((k) => (f[k].value = editing[k] ?? ""));

  saveBtn.addEventListener("click", async () => {
    msg.textContent = "";
    saveBtn.disabled = true;
    const data = {};
    keys.forEach((k) => (data[k] = f[k].value));
    try {
      if (editing) await api("/products/" + editing._id, "PUT", data);
      else await api("/products", "POST", data);
      toast(editing ? "Product updated" : "Product added");
      editing = null;
      route();
    } catch (err) {
      msg.textContent = err.message;
      saveBtn.disabled = false;
    }
  });

  const list = await api("/products");
  const rows = list.map((p) => h("div", { class: "cart-row" },
    h("span", { class: "c-emoji" }, p.emoji || "🛍️"),
    h("div", { class: "c-name" }, h("strong", {}, p.name), h("small", { class: "muted" }, p.category + " · " + money(p.price) + " · stock " + p.stock)),
    h("button", { class: "ghost small", onclick: () => { editing = p; route(); } }, "Edit"),
    h("button", {
      class: "ghost small del",
      onclick: async () => {
        if (!confirm('Delete "' + p.name + '"?')) return;
        try { await api("/products/" + p._id, "DELETE"); toast("Product deleted"); route(); }
        catch (err) { toast(err.message, true); }
      },
    }, "Delete")));
  body.replaceChildren(form, h("h2", {}, "All products (" + list.length + ")"), ...(rows.length ? rows : [h("p", { class: "muted" }, "No products yet.")]));
}

/* ---------- Login / register ---------- */
let authMode = "login";

function loginView(view) {
  const name = h("input", { autocomplete: "name" });
  const email = h("input", { type: "email", autocomplete: "email" });
  const pw = h("input", { type: "password" });
  const nameRow = h("label", {}, "Name", name);
  const msg = h("p", { class: "msg", role: "alert" });
  const btn = h("button", { type: "button" });
  const tabLogin = h("button", { class: "tab", type: "button" }, "Log in");
  const tabReg = h("button", { class: "tab", type: "button" }, "Register");

  function setMode(m) {
    authMode = m;
    tabLogin.classList.toggle("active", m === "login");
    tabReg.classList.toggle("active", m === "register");
    nameRow.hidden = m === "login";
    btn.textContent = m === "login" ? "Log in" : "Create account";
    pw.autocomplete = m === "login" ? "current-password" : "new-password";
    msg.textContent = "";
  }
  async function submit() {
    msg.textContent = "";
    btn.disabled = true;
    try {
      const body = { email: email.value, password: pw.value };
      if (authMode === "register") body.name = name.value;
      const d = await api(authMode === "login" ? "/auth/login" : "/auth/register", "POST", body);
      token = d.token;
      user = d.user;
      localStorage.setItem("shop_token", token);
      localStorage.setItem("shop_user", JSON.stringify(user));
      const to = afterLogin;
      afterLogin = "#/";
      location.hash = to;
      route();
    } catch (err) {
      msg.textContent = err.message;
    }
    btn.disabled = false;
  }
  tabLogin.addEventListener("click", () => setMode("login"));
  tabReg.addEventListener("click", () => setMode("register"));
  btn.addEventListener("click", submit);
  const box = h("div", { class: "card narrow" },
    h("div", { class: "tabs" }, tabLogin, tabReg),
    h("div", { class: "form" }, nameRow, h("label", {}, "Email", email), h("label", {}, "Password", pw), btn, msg));
  box.addEventListener("keydown", (e) => { if (e.key === "Enter") submit(); });
  view.replaceChildren(box);
  setMode(authMode);
}

/* ---------- Start ---------- */
window.addEventListener("hashchange", route);
if (token) {
  // refresh the saved user (so a role change shows up)
  api("/auth/me").then((d) => { user = d.user; localStorage.setItem("shop_user", JSON.stringify(user)); renderNav(); }).catch(() => {});
}
route();
