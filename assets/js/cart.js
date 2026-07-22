/*
 * Hueman shared shopping cart.
 * Cart data is persisted in localStorage so it carries over between
 * index.html and product.html.
 *
 * Payment: checkout is handled by a Stripe Checkout Session created on the
 * fly by the Netlify function in netlify/functions/create-checkout-session.js.
 * That function receives the exact cart items/quantities and builds the
 * session server-side, so the customer only picks quantity once (in this
 * cart) and Stripe already shows the right total.
 *
 * SETUP REQUIRED:
 *  1. Set CHECKOUT_ENDPOINT below to your deployed Netlify function URL.
 *  2. Deploy netlify/functions/create-checkout-session.js to Netlify and set
 *     the STRIPESECRETKEY environment variable in the Netlify dashboard.
 * This works even though the site itself is hosted on GitHub Pages, since
 * CHECKOUT_ENDPOINT is a full URL pointing at the Netlify function.
 */
(function () {
  "use strict";

  const CART_KEY = "huemanCart";
  const LANG_KEY = "huemanLang";

  const CHECKOUT_ENDPOINT = "https://hue-man.netlify.app/.netlify/functions/create-checkout-session";

  const CATALOG = {
    "urban-legend": { name: { el: "Urban Legend", en: "Urban Legend" }, price: 19.99, image: "assets/icons/a1.png" },
    "classic-banter": { name: { el: "Classic Banter", en: "Classic Banter" }, price: 19.99, image: "assets/icons/b1.png" },
    "easy-mode": { name: { el: "Easy Mode", en: "Easy Mode" }, price: 19.99, image: "assets/icons/c1.png" },
    "one-more-tee": { name: { el: "One More Tee", en: "One More Tee" }, price: 19.99, image: "assets/icons/d1.png" },
    "signature-fit": { name: { el: "Signature Fit", en: "Signature Fit" }, price: 19.99, image: "assets/icons/e1.png" }
  };

  const TEXT = {
    el: {
      cartAria: "Καλάθι αγορών",
      cartTitle: "Το καλάθι σου",
      cartClose: "Κλείσιμο",
      cartEmpty: "Το καλάθι είναι άδειο.",
      sizeLabel: "Μέγεθος",
      remove: "Αφαίρεση",
      totalLabel: "Σύνολο:",
      noteLabel: "Σύνοψη παραγγελίας:",
      stripeWarning: "Η πληρωμή δεν είναι διαθέσιμη αυτή τη στιγμή. Δοκίμασε ξανά σε λίγο.",
      payBtn: "Πληρωμή με Visa",
      added: "Προστέθηκε στο καλάθι"
    },
    en: {
      cartAria: "Shopping cart",
      cartTitle: "Your cart",
      cartClose: "Close",
      cartEmpty: "Your cart is empty.",
      sizeLabel: "Size",
      remove: "Remove",
      totalLabel: "Total:",
      noteLabel: "Order summary:",
      stripeWarning: "Payment isn't available right now. Please try again shortly.",
      payBtn: "Pay with Visa",
      added: "Added to cart"
    }
  };

  function getLang() {
    const saved = localStorage.getItem(LANG_KEY);
    return saved === "en" ? "en" : "el";
  }

  function t() {
    return TEXT[getLang()];
  }

  function textFor(value) {
    if (value && typeof value === "object") {
      return value[getLang()] || value.el || "";
    }
    return value || "";
  }

  function formatPrice(value) {
    const locale = getLang() === "en" ? "en-IE" : "el-GR";
    return value.toLocaleString(locale, { style: "currency", currency: "EUR" });
  }

  function readCart() {
    try {
      const raw = localStorage.getItem(CART_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  function writeCart(items) {
    localStorage.setItem(CART_KEY, JSON.stringify(items));
    updateBadge();
    renderCart();
  }

  function cartCount() {
    return readCart().reduce((sum, item) => sum + item.qty, 0);
  }

  function cartTotal() {
    return readCart().reduce((sum, item) => {
      const product = CATALOG[item.productKey];
      return sum + (product ? product.price * item.qty : 0);
    }, 0);
  }

  function addToCart(productKey, size, qty) {
    if (!CATALOG[productKey]) return;
    const quantity = Math.max(1, Math.min(10, Number(qty) || 1));
    const items = readCart();
    const existing = items.find((item) => item.productKey === productKey && item.size === size);
    if (existing) {
      existing.qty = Math.max(1, Math.min(10, existing.qty + quantity));
    } else {
      items.push({ id: `${productKey}-${size}-${Date.now()}`, productKey, size, qty: quantity });
    }
    writeCart(items);
    openCart();
  }

  function removeFromCart(id) {
    writeCart(readCart().filter((item) => item.id !== id));
  }

  function updateQty(id, qty) {
    const items = readCart();
    const item = items.find((entry) => entry.id === id);
    if (!item) return;
    item.qty = Math.max(1, Math.min(10, qty));
    writeCart(items);
  }

  let els = {};

  function ensureDrawer() {
    if (document.getElementById("cartDrawer")) return;

    document.body.insertAdjacentHTML(
      "beforeend",
      `
      <div class="cart-overlay" id="cartOverlay"></div>
      <aside class="cart-drawer" id="cartDrawer" role="dialog" aria-modal="true">
        <div class="cart-drawer-head">
          <h3 id="cartDrawerTitle"></h3>
          <button type="button" class="cart-close" id="cartCloseBtn">&times;</button>
        </div>
        <div id="cartEmptyState" class="cart-empty"></div>
        <div class="cart-items" id="cartItemsList"></div>
        <div class="cart-summary">
          <span id="cartTotalLabel"></span>
          <strong id="cartTotalValue">0,00 €</strong>
        </div>
        <p class="cart-note"><strong id="cartNoteLabel"></strong> <span id="cartNotePreview">-</span></p>
        <div class="cart-warning" id="cartStripeWarning" hidden></div>
        <div class="cart-actions">
          <button type="button" class="btn btn-main" id="cartPayBtn"></button>
        </div>
      </aside>
      `
    );

    els = {
      overlay: document.getElementById("cartOverlay"),
      drawer: document.getElementById("cartDrawer"),
      closeBtn: document.getElementById("cartCloseBtn"),
      title: document.getElementById("cartDrawerTitle"),
      emptyState: document.getElementById("cartEmptyState"),
      itemsList: document.getElementById("cartItemsList"),
      totalLabel: document.getElementById("cartTotalLabel"),
      totalValue: document.getElementById("cartTotalValue"),
      noteLabel: document.getElementById("cartNoteLabel"),
      notePreview: document.getElementById("cartNotePreview"),
      stripeWarning: document.getElementById("cartStripeWarning"),
      payBtn: document.getElementById("cartPayBtn")
    };

    els.closeBtn.addEventListener("click", closeCart);
    els.overlay.addEventListener("click", closeCart);
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") closeCart();
    });

    els.payBtn.addEventListener("click", handlePay);
  }

  function buildOrderNote() {
    const texts = t();
    const lang = getLang();
    const items = readCart();

    const itemsText = items
      .map((item) => {
        const product = CATALOG[item.productKey];
        const name = product ? textFor(product.name) : item.productKey;
        return `${item.qty}x ${name} (${texts.sizeLabel} ${item.size})`;
      })
      .join(", ");

    const total = formatPrice(cartTotal());
    const productsLabel = lang === "en" ? "Items" : "Προϊόντα";
    const payableLabel = lang === "en" ? "Payable total" : "Συνολικό πληρωτέο";

    return `Hueman | ${productsLabel}: ${itemsText || "-"} | ${payableLabel}: ${total}`;
  }

  function applyDrawerLanguage() {
    if (!els.drawer) return;
    const texts = t();

    els.title.textContent = texts.cartTitle;
    els.closeBtn.setAttribute("aria-label", texts.cartClose);
    els.emptyState.textContent = texts.cartEmpty;
    els.totalLabel.textContent = texts.totalLabel;
    els.noteLabel.textContent = texts.noteLabel;
    els.stripeWarning.textContent = texts.stripeWarning;
    els.payBtn.textContent = texts.payBtn;

    document.querySelectorAll("[data-cart-toggle]").forEach((btn) => {
      btn.setAttribute("aria-label", texts.cartAria);
    });

    renderCart();
  }

  function renderCart() {
    if (!els.drawer) return;
    const items = readCart();
    const texts = t();

    els.emptyState.hidden = items.length > 0;
    els.itemsList.hidden = items.length === 0;
    document.querySelector(".cart-summary").style.display = items.length === 0 ? "none" : "flex";
    els.payBtn.parentElement.style.display = items.length === 0 ? "none" : "block";
    document.querySelector(".cart-note").style.display = items.length === 0 ? "none" : "block";

    els.itemsList.innerHTML = items
      .map((item) => {
        const product = CATALOG[item.productKey];
        if (!product) return "";
        const name = textFor(product.name);
        const linePrice = formatPrice(product.price * item.qty);
        return `
          <div class="cart-item" data-id="${item.id}">
            <img src="${product.image}" alt="${name}" />
            <div>
              <div class="cart-item-name">${name}</div>
              <div class="cart-item-meta">${texts.sizeLabel}: ${item.size}</div>
              <div class="cart-item-qty">
                <button type="button" class="cart-qty-btn" data-action="dec" data-id="${item.id}">-</button>
                <span>${item.qty}</span>
                <button type="button" class="cart-qty-btn" data-action="inc" data-id="${item.id}">+</button>
              </div>
              <button type="button" class="cart-item-remove" data-action="remove" data-id="${item.id}">${texts.remove}</button>
            </div>
            <div class="cart-item-price">${linePrice}</div>
          </div>
        `;
      })
      .join("");

    els.itemsList.querySelectorAll("[data-action]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.dataset.id;
        const action = btn.dataset.action;
        if (action === "remove") {
          removeFromCart(id);
          return;
        }
        const current = readCart().find((entry) => entry.id === id);
        if (!current) return;
        updateQty(id, action === "inc" ? current.qty + 1 : current.qty - 1);
      });
    });

    els.totalValue.textContent = formatPrice(cartTotal());
    els.notePreview.textContent = items.length ? buildOrderNote() : "-";
  }

  function updateBadge() {
    const count = cartCount();
    document.querySelectorAll("[data-cart-badge]").forEach((badge) => {
      badge.textContent = String(count);
      badge.hidden = count === 0;
    });
  }

  function openCart() {
    ensureDrawer();
    applyDrawerLanguage();
    els.overlay.classList.add("is-open");
    els.drawer.classList.add("is-open");
    document.body.style.overflow = "hidden";
  }

  function closeCart() {
    if (!els.drawer) return;
    els.overlay.classList.remove("is-open");
    els.drawer.classList.remove("is-open");
    document.body.style.overflow = "";
  }

  async function handlePay() {
    const items = readCart();
    if (!items.length) return;

    els.stripeWarning.hidden = true;

    const note = buildOrderNote();

    els.payBtn.disabled = true;
    try {
      const response = await fetch(CHECKOUT_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items, note })
      });
      const data = await response.json();
      if (!response.ok || !data.url) {
        throw new Error(data.error || "Checkout session failed");
      }
      window.location.href = data.url;
    } catch (err) {
      els.stripeWarning.hidden = false;
      els.payBtn.disabled = false;
    }
  }

  function init() {
    document.querySelectorAll("[data-cart-toggle]").forEach((btn) => {
      btn.addEventListener("click", openCart);
    });
    updateBadge();
  }

  window.HuemanCart = {
    addToCart,
    openCart,
    closeCart,
    refreshLanguage: applyDrawerLanguage,
    getCount: cartCount,
    getTotal: cartTotal
  };

  init();
})();
