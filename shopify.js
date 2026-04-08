/* ════════════════════════════════════════
   SHOPIFY STOREFRONT API INTEGRATION
   Custom frontend → Shopify checkout
════════════════════════════════════════ */

// ── Your Shopify store domain ──
const SHOPIFY_DOMAIN = "starsinfern0.myshopify.com";

// ── Storefront API access token (Headless channel → Public access token) ──
const SHOPIFY_TOKEN = "c9009dad802764ec3cc39e7774375e89";

const SHOPIFY_API_URL = `https://${SHOPIFY_DOMAIN}/api/2025-01/graphql.json`;

/* ── Variant ID Map ──────────────────────
   Maps frontend product keys → Shopify variant GIDs.
   To add a new product, extract the numeric ID from
   the variant URL in Shopify Admin and add it here.
─────────────────────────────────────────*/
const VARIANT_IDS = {
  "time-expire":    "gid://shopify/ProductVariant/47808435945629",
  "coma":           "gid://shopify/ProductVariant/47808665583773",
  "power-of-the-p": "gid://shopify/ProductVariant/47808555974813",
  "boobi-bucla6":   "gid://shopify/ProductVariant/47808588546205",
  "dumo-effect":    "gid://shopify/ProductVariant/47808632324253",
};

/* ── createCheckout ──────────────────────
   Uses the Shopify Cart API (cartCreate mutation).
   Accepts: [{ key: "product-key", quantity: 1 }]
   Returns: Shopify checkout URL (string)
─────────────────────────────────────────*/
async function createCheckout(cartItems) {
  const lines = cartItems
    .filter(item => VARIANT_IDS[item.key])
    .map(item => ({
      merchandiseId: VARIANT_IDS[item.key],
      quantity:      item.quantity,
    }));

  if (!lines.length) throw new Error("No valid items in cart.");

  const res = await fetch(SHOPIFY_API_URL, {
    method: "POST",
    headers: {
      "Content-Type":                      "application/json",
      "X-Shopify-Storefront-Access-Token": SHOPIFY_TOKEN,
    },
    body: JSON.stringify({
      query: `
        mutation cartCreate($input: CartInput!) {
          cartCreate(input: $input) {
            cart { checkoutUrl }
            userErrors { field message code }
          }
        }
      `,
      variables: { input: { lines } },
    }),
  });

  if (!res.ok) throw new Error(`Shopify API error: ${res.status}`);

  const json = await res.json();

  if (json.errors?.length)
    throw new Error(json.errors[0].message);

  const userErrors = json.data?.cartCreate?.userErrors;
  if (userErrors?.length)
    throw new Error(userErrors[0].message);

  const url = json.data?.cartCreate?.cart?.checkoutUrl;
  if (!url) throw new Error("No checkout URL returned.");

  return url;
}

/* ── redirectToCheckout ──────────────────
   Called by the cart checkout button.
   Builds the cart on Shopify and redirects
   the user to the Shopify-hosted checkout page.
─────────────────────────────────────────*/
async function redirectToCheckout(cartItems) {
  const btn = document.getElementById("cart-checkout-btn");
  if (btn) { btn.textContent = "Loading…"; btn.disabled = true; }

  try {
    const url = await createCheckout(cartItems);
    window.location.href = url;
  } catch (err) {
    console.error("Checkout failed:", err);
    if (btn) { btn.textContent = "Checkout →"; btn.disabled = false; }
    alert("Checkout is currently unavailable. Please try again.");
  }
}
