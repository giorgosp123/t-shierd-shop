/*
 * Hueman shared shopping cart.
 * Cart data + shipping address are persisted in localStorage so they carry
 * over between index.html and product.html.
 *
 * Payment: to accept Visa (and other cards) without running a backend, this
 * connects the cart to a Stripe Payment Link with "adjustable quantity"
 * enabled. Every product is priced the same (19,99 €), so the cart's total
 * item count maps 1:1 to the quantity on that single Stripe link.
 *
 * SETUP REQUIRED: replace STRIPE_PAYMENT_LINK below with your real Stripe
 * Payment Link URL (Stripe Dashboard > Payment links > create one for the
 * 19,99 € t-shirt, enable "Adjustable quantity", and optionally add a custom
 * text field called "Order note" so customers can paste the note that this
 * cart copies to their clipboard).
 */
(function () {
  "use strict";

  const CART_KEY = "huemanCart";
  const ADDRESS_KEY = "huemanAddress";
  const LANG_KEY = "huemanLang";

  const STRIPE_PAYMENT_LINK = "https://buy.stripe.com/your-payment-link";

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
      addressTitle: "Διεύθυνση αποστολής",
      totalLabel: "Σύνολο:",
      noteLabel: "Σημείωση παραγγελίας:",
      noteHint: "* Η σημείωση αντιγράφηκε αυτόματα στο πρόχειρο (clipboard). Επικόλλησέ τη στο πεδίο σημειώσεων της σελίδας πληρωμής, αν υπάρχει.",
      addressWarning: "Συμπλήρωσε όλα τα πεδία διεύθυνσης (οδός, αριθμός, περιοχή, Τ.Κ., πόλη) πριν την πληρωμή.",
      stripeWarning: "Ρύθμισε το Stripe Payment Link στο αρχείο assets/js/cart.js για να λειτουργήσει η πληρωμή.",
      payBtn: "Πληρωμή με Visa",
      added: "Προστέθηκε στο καλάθι",
      placeholders: {
        street: "π.χ. Λεωφόρος Μακαρίου Γ'",
        number: "π.χ. 12",
        area: "π.χ. Στρόβολος",
        postalCode: "π.χ. 2008",
        city: "π.χ. Λευκωσία"
      },
      addressFieldNames: { street: "Οδός", number: "Αριθμός", area: "Περιοχή", postalCode: "Τ.Κ.", city: "Πόλη" }
    },
    en: {
      cartAria: "Shopping cart",
      cartTitle: "Your cart",
      cartClose: "Close",
      cartEmpty: "Your cart is empty.",
      sizeLabel: "Size",
      remove: "Remove",
      addressTitle: "Shipping address",
      totalLabel: "Total:",
      noteLabel: "Order note:",
      noteHint: "* The note was copied automatically to your clipboard. Paste it into the payment page's notes field, if available.",
      addressWarning: "Fill in all address fields (street, number, area, postal code, city) before payment.",
      stripeWarning: "Set your Stripe Payment Link in assets/js/cart.js so payment can work.",
      payBtn: "Pay with Visa",
      added: "Added to cart",
      placeholders: {
        street: "e.g. Makariou Avenue III",
        number: "e.g. 12",
        area: "e.g. Strovolos",
        postalCode: "e.g. 2008",
        city: "e.g. Nicosia"
      },
      addressFieldNames: { street: "Street", number: "Number", area: "Area", postalCode: "Postal code", city: "City" }
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

  function readAddress() {
    try {
      const raw = localStorage.getItem(ADDRESS_KEY);
      const parsed = raw ? JSON.parse(raw) : null;
      return Object.assign({ street: "", number: "", area: "", postalCode: "", city: "" }, parsed || {});
    } catch {
      return { street: "", number: "", area: "", postalCode: "", city: "" };
    }
  }

  function writeAddress(address) {
    localStorage.setItem(ADDRESS_KEY, JSON.stringify(address));
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
        <div class="cart-address" id="cartAddressBlock">
          <p class="cart-address-title" id="cartAddressTitle"></p>
          <div class="cart-address-grid">
            <input id="cartStreet" type="text" />
            <input id="cartNumber" type="text" />
            <input id="cartArea" type="text" />
            <input id="cartPostalCode" type="text" maxlength="5" inputmode="numeric" />
            <input id="cartCity" type="text" class="cart-field-full" />
          </div>
        </div>
        <div class="cart-summary">
          <span id="cartTotalLabel"></span>
          <strong id="cartTotalValue">0,00 €</strong>
        </div>
        <p class="cart-note"><strong id="cartNoteLabel"></strong> <span id="cartNotePreview">-</span></p>
        <p class="cart-hint" id="cartNoteHint"></p>
        <div class="cart-warning" id="cartAddressWarning" hidden></div>
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
      addressBlock: document.getElementById("cartAddressBlock"),
      addressTitle: document.getElementById("cartAddressTitle"),
      street: document.getElementById("cartStreet"),
      number: document.getElementById("cartNumber"),
      area: document.getElementById("cartArea"),
      postalCode: document.getElementById("cartPostalCode"),
      city: document.getElementById("cartCity"),
      totalLabel: document.getElementById("cartTotalLabel"),
      totalValue: document.getElementById("cartTotalValue"),
      noteLabel: document.getElementById("cartNoteLabel"),
      notePreview: document.getElementById("cartNotePreview"),
      noteHint: document.getElementById("cartNoteHint"),
      addressWarning: document.getElementById("cartAddressWarning"),
      stripeWarning: document.getElementById("cartStripeWarning"),
      payBtn: document.getElementById("cartPayBtn")
    };

    els.closeBtn.addEventListener("click", closeCart);
    els.overlay.addEventListener("click", closeCart);
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") closeCart();
    });

    const address = readAddress();
    els.street.value = address.street;
    els.number.value = address.number;
    els.area.value = address.area;
    els.postalCode.value = address.postalCode;
    els.city.value = address.city;

    [els.street, els.number, els.area, els.postalCode, els.city].forEach((input) => {
      input.addEventListener("input", () => {
        writeAddress({
          street: els.street.value.trim(),
          number: els.number.value.trim(),
          area: els.area.value.trim(),
          postalCode: els.postalCode.value.trim(),
          city: els.city.value.trim()
        });
        renderCart();
      });
    });

    els.payBtn.addEventListener("click", handlePay);
  }

  function isAddressComplete(address) {
    return Boolean(address.street && address.number && address.area && address.postalCode && address.city);
  }

  function buildOrderNote() {
    const texts = t();
    const items = readCart();
    const address = readAddress();
    const addressText = `${address.street} ${address.number}, ${address.area}, ${address.postalCode}, ${address.city}`;

    const itemsText = items
      .map((item) => {
        const product = CATALOG[item.productKey];
        const name = product ? textFor(product.name) : item.productKey;
        return `${item.qty}x ${name} (${texts.sizeLabel} ${item.size})`;
      })
      .join(", ");

    const label = getLang() === "en" ? "Address" : "Διεύθυνση";
    const total = formatPrice(cartTotal());

    return `Hueman: ${itemsText || "-"} | ${label}: ${isAddressComplete(address) ? addressText : "-"} | ${texts.totalLabel} ${total}`;
  }

  function applyDrawerLanguage() {
    if (!els.drawer) return;
    const texts = t();

    els.title.textContent = texts.cartTitle;
    els.closeBtn.setAttribute("aria-label", texts.cartClose);
    els.emptyState.textContent = texts.cartEmpty;
    els.addressTitle.textContent = texts.addressTitle;
    els.street.placeholder = texts.placeholders.street;
    els.number.placeholder = texts.placeholders.number;
    els.area.placeholder = texts.placeholders.area;
    els.postalCode.placeholder = texts.placeholders.postalCode;
    els.city.placeholder = texts.placeholders.city;
    els.totalLabel.textContent = texts.totalLabel;
    els.noteLabel.textContent = texts.noteLabel;
    els.noteHint.textContent = texts.noteHint;
    els.addressWarning.textContent = texts.addressWarning;
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
    els.addressBlock.style.display = items.length === 0 ? "none" : "";
    document.querySelector(".cart-summary").style.display = items.length === 0 ? "none" : "flex";
    els.payBtn.parentElement.style.display = items.length === 0 ? "none" : "block";
    document.querySelector(".cart-note").style.display = items.length === 0 ? "none" : "block";
    els.noteHint.style.display = items.length === 0 ? "none" : "block";

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
    const texts = t();
    const items = readCart();
    if (!items.length) return;

    const address = readAddress();
    if (!isAddressComplete(address)) {
      els.addressWarning.hidden = false;
      if (!address.street) els.street.focus();
      else if (!address.number) els.number.focus();
      else if (!address.area) els.area.focus();
      else if (!address.postalCode) els.postalCode.focus();
      else els.city.focus();
      return;
    }
    els.addressWarning.hidden = true;

    const missingLink = STRIPE_PAYMENT_LINK.includes("your-payment-link");
    if (missingLink) {
      els.stripeWarning.hidden = false;
      return;
    }
    els.stripeWarning.hidden = true;

    const note = buildOrderNote();
    try {
      await navigator.clipboard.writeText(note);
    } catch {
      // Clipboard can be blocked in some browsers; no hard failure on payment flow.
    }

    const quantity = cartCount();
    const separator = STRIPE_PAYMENT_LINK.includes("?") ? "&" : "?";
    window.location.href = `${STRIPE_PAYMENT_LINK}${separator}quantity=${quantity}`;
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
