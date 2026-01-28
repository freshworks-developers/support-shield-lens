function log(...args) {
  console.log(...args);
}
function warn(...args) {
  if (console && typeof console.warn === "function") return console.warn(...args);
  if (console && typeof console.log === "function") return console.log("[WARN]", ...args);
}

function err(...args) {
  console.error(...args);
}

function safeJson(input) {
  try {
    if (input === null || input === undefined) return null;
    if (typeof input === "object") return input;
    return JSON.parse(String(input));
  } catch {
    return null;
  }
}

function normalizeEmail(payload) {
  if (!payload || !payload.email) return "";
  return String(payload.email).trim().toLowerCase();
}

function logErrorDetails(e) {
  try {
    if (!e) return err("Error details: <empty>");

    if (typeof e === "string") return err("Error details:", e);

    if (e.status) err("Error status:", e.status);
    if (e.code) err("Error code:", e.code);
    if (e.message) err("Error message:", e.message);

    const resp = e.response;
    if (resp) {
      if (typeof resp === "string") err("Error response:", resp.slice(0, 800));
      else err("Error response:", resp);
    }

    if (e.stack) err("Error stack:", e.stack);
  } catch (x) {
    err("logErrorDetails failed:", x?.message || x);
  }
}

function extractBigCommerceOrders(json) {
  // BigCommerce orders API may return [] (v2) or { data: [] } (some variants)
  if (Array.isArray(json)) return json;
  if (json && Array.isArray(json.data)) return json.data;
  return [];
}

async function getOrdersByEmail(email) {
  log("[getOrdersByEmail] START email =", email);

  // 1) Find customer by email
  log("[getOrdersByEmail] Calling template: bigCommerceFindCustomerByEmail");
  const cRes = await $request.invokeTemplate("bigCommerceFindCustomerByEmail", {
    context: { email }
  });

  log("[getOrdersByEmail] bigCommerceFindCustomerByEmail result:", {
    status: cRes?.status,
    hasResponse: !!cRes?.response,
    responsePreview: typeof cRes?.response === "string" ? cRes.response.slice(0, 300) : cRes?.response
  });

  const cJson = safeJson(cRes?.response);
  log("[getOrdersByEmail] Parsed customer JSON keys:", Object.keys(cJson || {}));

  const customer = cJson?.data?.[0] || null;
  log("[getOrdersByEmail] Customer picked:", customer ? { id: customer.id, email: customer.email } : null);

  if (!customer?.id) {
    warn("[getOrdersByEmail] No customer found for email:", email);
    return [];
  }

  // 2) Get last 3 orders by customer id
  log("[getOrdersByEmail] Calling template: bigCommerceGetOrdersByCustId with customer_id =", customer.id);
  const oRes = await $request.invokeTemplate("bigCommerceGetOrdersByCustId", {
    context: { customer_id: customer.id }
  });

  log("[getOrdersByEmail] bigCommerceGetOrdersByCustId result:", {
    status: oRes?.status,
    hasResponse: !!oRes?.response,
    responsePreview: typeof oRes?.response === "string" ? oRes.response.slice(0, 300) : oRes?.response
  });

  const oJson = safeJson(oRes?.response);
  log("[getOrdersByEmail] Parsed orders JSON type:", Array.isArray(oJson) ? "array" : typeof oJson);

  const ordersArr = extractBigCommerceOrders(oJson);
  log("[getOrdersByEmail] Orders extracted type:", Array.isArray(ordersArr) ? "array" : typeof ordersArr);
  log("[getOrdersByEmail] Orders extracted count:", Array.isArray(ordersArr) ? ordersArr.length : 0);

  if (!Array.isArray(ordersArr)) {
    warn("[getOrdersByEmail] Orders response not array. Returning []");
    return [];
  }

  const mapped = ordersArr.slice(0, 3).map((o) => ({
    id: o?.id,
    order_number: o?.order_number || o?.id,
    status: o?.status,
    date_created: o?.date_created
  }));

  log("[getOrdersByEmail] MAPPED orders count:", mapped.length);
  log("[getOrdersByEmail] MAPPED orders preview:", mapped.slice(0, 3));

  log("[getOrdersByEmail] END email =", email);
  return mapped;
}

function getPayPalDateWindow() {
  const now = new Date();
  return {
    end: now.toISOString(),
    start: new Date(now.getTime() - 31 * 24 * 60 * 60 * 1000).toISOString()
  };
}

function getPayPalConfig(ip) {
  const mode = String(ip?.paypal_mode || "sandbox").toLowerCase();
  const paypal_host = mode === "live" ? "api-m.paypal.com" : "api-m.sandbox.paypal.com";

  const clientId = String(ip?.paypal_client_id || "").trim();
  const clientSecret = String(ip?.paypal_client_secret || "").trim();

  if (!clientId || !clientSecret) return null;
  return { paypal_host, clientId, clientSecret };
}

async function getPayPalAccessToken(paypal_host, clientId, clientSecret) {
  log("[getPayPalAccessToken] START host =", paypal_host);
  log("[getPayPalAccessToken] clientId length =", clientId ? clientId.length : 0);
  log("[getPayPalAccessToken] clientSecret length =", clientSecret ? clientSecret.length : 0);

  const basic = Buffer.from(`${clientId}:${clientSecret}`, "utf8").toString("base64");
  log("[getPayPalAccessToken] basic header length =", basic.length);

  log("[getPayPalAccessToken] Calling template: payPalGetAccessToken");
  const tRes = await $request.invokeTemplate("payPalGetAccessToken", {
    context: { paypal_host, paypal_basic: basic },
    body: "grant_type=client_credentials"
  });

  log("[getPayPalAccessToken] payPalGetAccessToken result:", {
    status: tRes?.status,
    hasResponse: !!tRes?.response,
    responsePreview: typeof tRes?.response === "string" ? tRes.response.slice(0, 300) : tRes?.response
  });

  const tJson = safeJson(tRes?.response);
  log("[getPayPalAccessToken] Parsed token JSON keys:", Object.keys(tJson || {}));

  const token = tJson?.access_token || null;
  log("[getPayPalAccessToken] access_token present =", !!token);

  log("[getPayPalAccessToken] END host =", paypal_host);
  return token;
}

function getPayPalTransactionList(pJson) {
  const txs = pJson?.transaction_details;
  return Array.isArray(txs) ? txs : [];
}

function isPayPalEmailMatch(t, email) {
  const payer =
    t?.payer_info?.email_address ||
    t?.payer_info?.payer ||
    t?.payer_info?.account_id ||
    "";

  if (String(payer).toLowerCase().includes(email)) return true;

  // fallback search (loose)
  return JSON.stringify(t || {}).toLowerCase().includes(email);
}

function getLatestPayPalMatch(txs, email) {
  log("[getLatestPayPalMatch] txs count =", Array.isArray(txs) ? txs.length : 0, " email =", email);

  const matches = txs.filter((t) => isPayPalEmailMatch(t, email));
  log("[getLatestPayPalMatch] matches count =", matches.length);

  if (matches.length === 0) return null;

  matches.sort((a, b) => {
    const da = new Date(a?.transaction_info?.transaction_initiation_date || 0).getTime();
    const db = new Date(b?.transaction_info?.transaction_initiation_date || 0).getTime();
    return db - da;
  });

  log("[getLatestPayPalMatch] top match date =", matches?.[0]?.transaction_info?.transaction_initiation_date);
  return matches[0];
}

function formatPayPalTransaction(top) {
  const info = top?.transaction_info || {};
  const formatted = {
    transaction_id: info?.transaction_id,
    status: info?.transaction_status,
    amount: info?.transaction_amount?.value,
    currency: info?.transaction_amount?.currency_code,
    date: info?.transaction_initiation_date
  };
  log("[formatPayPalTransaction] formatted =", formatted);
  return formatted;
}

// async function getLatestPayPalTransactionByEmail(email) {
//   log("[getLatestPayPalTransactionByEmail] START email =", email);

//   log("[getLatestPayPalTransactionByEmail] Loading iparams via $request.iparams.get()");
//   const ip = await $request.iparams.get();

//   log("[getLatestPayPalTransactionByEmail] iparams loaded (safe preview):", {
//     paypal_mode: ip?.paypal_mode,
//     paypal_client_id_len: ip?.paypal_client_id ? String(ip.paypal_client_id).length : 0,
//     paypal_client_secret_present: !!ip?.paypal_client_secret
//   });

//   const cfg = getPayPalConfig(ip);
//   log("[getLatestPayPalTransactionByEmail] PayPal config:", cfg ? { paypal_host: cfg.paypal_host, clientIdLen: cfg.clientId.length } : null);

//   if (!cfg) {
//     warn("[getLatestPayPalTransactionByEmail] Missing PayPal config in iparams. Returning null");
//     return null;
//   }

//   const token = await getPayPalAccessToken(cfg.paypal_host, cfg.clientId, cfg.clientSecret);
//   log("[getLatestPayPalTransactionByEmail] Access token present =", !!token);

//   if (!token) {
//     warn("[getLatestPayPalTransactionByEmail] Failed to get PayPal access token. Returning null");
//     return null;
//   }

//   const window = getPayPalDateWindow();
//   log("[getLatestPayPalTransactionByEmail] Window:", window);

//   log("[getLatestPayPalTransactionByEmail] Calling template: payPalListTransactions");
//   const pRes = await $request.invokeTemplate("payPalListTransactions", {
//     context: {
//       paypal_host: cfg.paypal_host,
//       paypal_access_token: token,
//       start_date: window.start,
//       end_date: window.end
//     }
//   });

//   log("[getLatestPayPalTransactionByEmail] payPalListTransactions result:", {
//     status: pRes?.status,
//     hasResponse: !!pRes?.response,
//     responsePreview: typeof pRes?.response === "string" ? pRes.response.slice(0, 300) : pRes?.response
//   });

//   const pJson = safeJson(pRes?.response);
//   log("[getLatestPayPalTransactionByEmail] Parsed PayPal JSON keys:", Object.keys(pJson || {}));

//   const txs = getPayPalTransactionList(pJson);
//   log("[getLatestPayPalTransactionByEmail] Transactions count:", txs.length);

//   const top = getLatestPayPalMatch(txs, email);
//   log("[getLatestPayPalTransactionByEmail] top match present =", !!top);

//   if (!top) {
//     warn("[getLatestPayPalTransactionByEmail] No PayPal match for email. Returning null");
//     return null;
//   }

//   const formatted = formatPayPalTransaction(top);
//   log("[getLatestPayPalTransactionByEmail] END email =", email);
//   return formatted;
// }

async function getLatestPayPalTransactionByEmail(email, iparamsFromPayload) {
  log("[getLatestPayPalTransactionByEmail] START email =", email);

  // ✅ Prefer iparams passed from invoke payload (FDK/dev) else try $request.iparams.get() (prod)
  let ip = iparamsFromPayload;

  if (!ip) {
    log("[getLatestPayPalTransactionByEmail] iparamsFromPayload missing, trying $request.iparams.get()");
    try {
      if ($request && $request.iparams && typeof $request.iparams.get === "function") {
        ip = await $request.iparams.get();
      } else {
        warn("[getLatestPayPalTransactionByEmail] $request.iparams.get not available in this runtime");
      }
    } catch (e) {
      err("[getLatestPayPalTransactionByEmail] $request.iparams.get failed:", e?.message || e);
      logErrorDetails(e);
    }
  } else {
    log("[getLatestPayPalTransactionByEmail] Using iparamsFromPayload");
  }

  log("[getLatestPayPalTransactionByEmail] iparams loaded (safe preview):", {
    paypal_mode: ip?.paypal_mode,
    paypal_client_id_len: ip?.paypal_client_id ? String(ip.paypal_client_id).length : 0,
    paypal_client_secret_present: !!ip?.paypal_client_secret
  });

  const cfg = getPayPalConfig(ip);
  log(
    "[getLatestPayPalTransactionByEmail] PayPal config:",
    cfg ? { paypal_host: cfg.paypal_host, clientIdLen: cfg.clientId.length } : null
  );

  if (!cfg) {
    warn("[getLatestPayPalTransactionByEmail] Missing PayPal config in iparams. Returning null");
    return null;
  }

  const token = await getPayPalAccessToken(cfg.paypal_host, cfg.clientId, cfg.clientSecret);
  log("[getLatestPayPalTransactionByEmail] Access token present =", !!token);

  if (!token) {
    warn("[getLatestPayPalTransactionByEmail] Failed to get PayPal access token. Returning null");
    return null;
  }

  const window = getPayPalDateWindow();
  log("[getLatestPayPalTransactionByEmail] Window:", window);

  log("[getLatestPayPalTransactionByEmail] Calling template: payPalListTransactions");
  const pRes = await $request.invokeTemplate("payPalListTransactions", {
    context: {
      paypal_host: cfg.paypal_host,
      paypal_access_token: token,
      start_date: window.start,
      end_date: window.end
    }
  });

  log("[getLatestPayPalTransactionByEmail] payPalListTransactions result:", {
    status: pRes?.status,
    hasResponse: !!pRes?.response,
    responsePreview: typeof pRes?.response === "string" ? pRes.response.slice(0, 300) : pRes?.response
  });

  const pJson = safeJson(pRes?.response);
  log("[getLatestPayPalTransactionByEmail] Parsed PayPal JSON keys:", Object.keys(pJson || {}));

  const txs = getPayPalTransactionList(pJson);
  log("[getLatestPayPalTransactionByEmail] Transactions count:", txs.length);

  const top = getLatestPayPalMatch(txs, email);
  log("[getLatestPayPalTransactionByEmail] top match present =", !!top);

  if (!top) {
    warn("[getLatestPayPalTransactionByEmail] No PayPal match for email. Returning null");
    return null;
  }

  const formatted = formatPayPalTransaction(top);
  log("[getLatestPayPalTransactionByEmail] END email =", email);
  return formatted;
}


exports = {
  // These will run only if you have enabled events in manifest and the platform supports them.
  onTicketCreateHandler: function () {
    log("[onTicketCreateHandler] fired");
    return renderData(null, { success: true });
  },

  onTicketUpdateHandler: function () {
    log("[onTicketUpdateHandler] fired");
    return renderData(null, { success: true });
  },

  // Client calls this via: client.request.invoke("getSupportShieldLens", { email })
  getSupportShieldLens: async function (payload) {
    log("[getSupportShieldLens] CALLED payload type =", typeof payload);
    log("[getSupportShieldLens] CALLED payload keys =", payload && typeof payload === "object" ? Object.keys(payload) : null);
    log("[getSupportShieldLens] CALLED payload preview =", payload);

    const email = normalizeEmail(payload);
    log("[getSupportShieldLens] normalized email =", email);

    if (!email) {
      warn("[getSupportShieldLens] Missing requester email");
      return renderData({ status: 400, message: "Missing requester email" });
    }

    try {
      log("[getSupportShieldLens] Fetching BigCommerce orders...");
      const orders = await getOrdersByEmail(email);
      log("[getSupportShieldLens] Orders fetched count =", Array.isArray(orders) ? orders.length : 0);

      log("[getSupportShieldLens] Fetching PayPal transaction...");
      const payment = await getLatestPayPalTransactionByEmail(email);
      log("[getSupportShieldLens] Payment present =", !!payment);

      const result = { email, orders, payment };
      log("[getSupportShieldLens] SUCCESS result preview =", {
        email: result.email,
        ordersCount: Array.isArray(result.orders) ? result.orders.length : 0,
        paymentPresent: !!result.payment
      });

      return renderData(null, result);
    } catch (e) {
      err("[getSupportShieldLens] FAILED:", e?.message || e);
      logErrorDetails(e);

      const status = e?.status || 500;
      const message =
        status === 401 || status === 403
          ? "BigCommerce token missing or unauthorized. Update App Settings."
          : "Lens fetch failed";

      return renderData({
        status,
        message,
        debug: {
          status: e?.status,
          code: e?.code,
          msg: e?.message,
          responsePreview: typeof e?.response === "string" ? e.response.slice(0, 600) : e?.response
        }
      });
    }
  }
};
