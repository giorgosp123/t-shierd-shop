/*
 * Netlify serverless function: creates a Stripe Checkout Session with the
 * exact line items/quantities sent from the cart, so what the customer
 * selected on the site is exactly what they pay for on Stripe.
 *
 * SETUP REQUIRED:
 *  1. In the Netlify site dashboard: Site configuration > Environment
 *     variables, add STRIPE_SECRET_KEY = sk_live_... (or sk_test_... while
 *     testing). Never put the secret key in any client-side file.
 *  2. Deploy this repo to Netlify (connect the GitHub repo, or `netlify deploy`).
 *     Netlify will detect netlify.toml and install "stripe" from package.json
 *     automatically for this function.
 */

const Stripe = require("stripe");

// Keep this in sync with assets/js/cart.js CATALOG. Prices are in cents.
const CATALOG = {
  "urban-legend": { name: "Urban Legend", priceCents: 1999 },
  "classic-banter": { name: "Classic Banter", priceCents: 1999 },
  "easy-mode": { name: "Easy Mode", priceCents: 1999 },
  "one-more-tee": { name: "One More Tee", priceCents: 1999 },
  "signature-fit": { name: "Signature Fit", priceCents: 1999 }
};

// Allow known storefront origins to call this endpoint from the browser.
const ALLOWED_ORIGINS = new Set([
  "http://localhost:8888",
  "http://localhost:3000"
]);

function isAllowedOrigin(origin) {
  if (!origin) return false;
  if (ALLOWED_ORIGINS.has(origin)) return true;

  // Allow GitHub Pages origins.
  if (/^https:\/\/[a-z0-9-]+\.github\.io$/i.test(origin)) {
    return true;
  }

  // Allow primary Netlify domains.
  if (/^https:\/\/[a-z0-9-]+\.netlify\.app$/i.test(origin)) {
    return true;
  }

  // Allow Netlify deploy previews, e.g. https://deploy-preview-12--hue-man.netlify.app
  return /^https:\/\/[a-z0-9-]+--[a-z0-9-]+\.netlify\.app$/i.test(origin);
}

function getCorsHeaders(event) {
  const requestOrigin = event && event.headers ? (event.headers.origin || "") : "";
  const allowOrigin = isAllowedOrigin(requestOrigin) ? requestOrigin : "*";

  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    Vary: "Origin"
  };
}

function getStripeSecretKey() {
  return (
    process.env.STRIPESECRETKEY ||
    process.env.STRIPE_SECRET_KEY ||
    process.env.STRIPE_SECRRET_KEY ||
    ""
  );
}

exports.handler = async (event) => {
  const corsHeaders = getCorsHeaders(event);
  const stripeSecretKey = getStripeSecretKey();

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: corsHeaders, body: "" };
  }

  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers: corsHeaders, body: JSON.stringify({ error: "Method not allowed" }) };
  }

  if (!stripeSecretKey) {
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: "Stripe secret key env var is not configured" })
    };
  }

  let payload;
  try {
    payload = JSON.parse(event.body || "{}");
  } catch {
    return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: "Invalid JSON body" }) };
  }

  const items = Array.isArray(payload.items) ? payload.items : [];
  if (items.length === 0) {
    return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: "Cart is empty" }) };
  }

  try {
    const stripe = Stripe(stripeSecretKey);

    const line_items = items.map((item) => {
      const product = CATALOG[item.productKey];
      if (!product) {
        throw new Error(`Unknown product: ${item.productKey}`);
      }
      const quantity = Math.max(1, Math.min(10, Number(item.qty) || 1));
      const size = typeof item.size === "string" ? item.size.slice(0, 20) : "";

      return {
        quantity,
        price_data: {
          currency: "eur",
          unit_amount: product.priceCents,
          product_data: {
            name: size ? `${product.name} (${size})` : product.name
          }
        }
      };
    });

    const origin = event.headers.origin || event.headers.referer || process.env.SITE_URL;
    if (!origin) {
      return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ error: "Could not determine site origin" }) };
    }
    const baseUrl = origin.replace(/\/$/, "");

    const note = typeof payload.note === "string" ? payload.note.slice(0, 490) : "";

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      // Collect customer address directly on Stripe Checkout.
      billing_address_collection: "required",
      shipping_address_collection: {
        allowed_countries: ["CY"]
      },
      line_items,
      success_url: `${baseUrl}/?checkout=success`,
      cancel_url: `${baseUrl}/?checkout=cancel`,
      metadata: note ? { order_note: note } : undefined
    });

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({ url: session.url })
    };
  } catch (err) {
    return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ error: err.message || "Checkout session failed" }) };
  }
};
