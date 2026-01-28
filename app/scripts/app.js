async function init() {
  const client = await app.initialized();

  client.events.on("app.activated", async () => {
    await render(client);
  });
}

function el(id) {
  return document.getElementById(id);
}

function setStatus(text) {
  if (el("status")) el("status").textContent = text || "Ready";
}

async function toast(client, type, message) {
  try {
    await client.interface.trigger("showToast", { type, message });
  } catch (e) {
    console.error("Toast failed:", e);
  }
}

function cleanMessage(value) {
  if (!value) return "";
  const msg = String(value).replace(/\s+/g, " ").trim();
  if (!msg) return "";
  return msg.length > 200 ? `${msg.slice(0, 197)}...` : msg;
}

function normalizeErrorsField(errors) {
  if (Array.isArray(errors)) return errors.join(", ");
  return errors;
}

function parseErrorFromObject(payload) {
  if (!payload || typeof payload !== "object") return "";
  const candidate =
    payload.message ||
    payload.error_description ||
    payload.error ||
    normalizeErrorsField(payload.errors);
  return candidate ? cleanMessage(candidate) : "";
}

function parseErrorFromString(payload) {
  try {
    const obj = JSON.parse(payload);
    return parseErrorFromObject(obj);
  } catch {
    return cleanMessage(payload);
  }
}

function parseErrorPayload(payload) {
  if (!payload) return "";
  if (typeof payload === "string") return parseErrorFromString(payload);
  if (typeof payload === "object") return parseErrorFromObject(payload);
  return "";
}

function getErrorResponsePayload(error) {
  if (!error) return "";
  const candidates = [error.response, error.responseText, error.data, error.body];
  for (const candidate of candidates) {
    if (candidate) return candidate;
  }
  return "";
}

function getStatusMessage(error) {
  if (!error || !error.status) return "";
  return `Request failed with status ${error.status}`;
}

function getInvokeErrorMessage(error) {
  if (!error) return "";

  const direct = parseErrorPayload(error);
  if (direct) return direct;

  const response = getErrorResponsePayload(error);
  const fromResponse = parseErrorPayload(response);
  if (fromResponse) return fromResponse;

  return getStatusMessage(error);
}

function normalizeEmail(value) {
  return value ? String(value).trim().toLowerCase() : "";
}

function pickFirstNonEmpty(values) {
  for (const value of values) {
    const normalized = normalizeEmail(value);
    if (normalized) return normalized;
  }
  return "";
}

function getEmailFromListItem(item) {
  if (!item) return "";
  if (typeof item === "string") return normalizeEmail(item);
  return normalizeEmail(item.value || item.email || item.address);
}

function extractEmailFromList(list) {
  if (!Array.isArray(list)) return "";
  for (const item of list) {
    const email = getEmailFromListItem(item);
    if (email) return email;
  }
  return "";
}

function getEmailFromTicket(ticket) {
  const direct = pickFirstNonEmpty([
    ticket?.requester?.email,
    ticket?.requester_email,
    ticket?.email,
    ticket?.requester?.primary_email,
    ticket?.requester?.primaryEmail
  ]);
  if (direct) return direct;

  return (
    extractEmailFromList(ticket?.requester?.emails) ||
    extractEmailFromList(ticket?.requester?.email_addresses) ||
    ""
  );
}

function getEmailFromContact(contact) {
  const direct = pickFirstNonEmpty([
    contact?.email,
    contact?.primary_email,
    contact?.primaryEmail
  ]);
  if (direct) return direct;

  return (
    extractEmailFromList(contact?.emails) ||
    extractEmailFromList(contact?.email_addresses) ||
    ""
  );
}

function getNameFromTicket(ticket) {
  if (!ticket) return "";
  
  // Try to get name from requester object
  if (ticket?.requester) {
    const name = ticket.requester.name || 
                 ticket.requester.display_name ||
                 (ticket.requester.first_name && ticket.requester.last_name 
                  ? `${ticket.requester.first_name} ${ticket.requester.last_name}`.trim()
                  : ticket.requester.first_name || ticket.requester.last_name);
    if (name) return name;
  }
  
  // Try direct ticket fields
  return ticket?.requester_name || 
         ticket?.name || 
         "";
}

function getNameFromContact(contact) {
  if (!contact) return "";
  
  const name = contact.name || 
               contact.display_name ||
               (contact.first_name && contact.last_name 
                ? `${contact.first_name} ${contact.last_name}`.trim()
                : contact.first_name || contact.last_name);
  return name || "";
}

function escapeHtml(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatDate(dateStr) {
  if (!dateStr) return "-";
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return dateStr;
  }
}

function getStatusClass(status) {
  if (!status) return "";
  const s = String(status).toLowerCase();
  if (s.includes('complete') || s.includes('fulfill')) return "status-completed";
  if (s.includes('cancel')) return "status-cancelled";
  return "status-pending";
}

function renderOrders(orders) {
  const wrap = el("ordersWrap");
  wrap.innerHTML = "";

  if (!orders || orders.length === 0) {
    wrap.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">📦</div>
        <div class="empty-state-text">No recent orders found</div>
      </div>
    `;
    return;
  }

  // Show only the 2 most recent orders to avoid scrollbar
  const recentOrders = orders.slice(0, 2);
  
  recentOrders.forEach((o) => {
    const orderNum = escapeHtml(o.order_number || o.id || "-");
    const date = formatDate(o.date_created);
    const status = escapeHtml(o.status || "-");
    const statusClass = getStatusClass(status);
    
    const html = `
      <div class="order-card">
        <div class="order-header">
          <span class="order-number">Order #${orderNum}</span>
          <span class="order-date">${date}</span>
        </div>
        <div class="order-status ${statusClass}">${status}</div>
      </div>
    `;
    wrap.insertAdjacentHTML("beforeend", html);
  });
}

function renderPayment(payment) {
  const wrap = el("paymentsWrap");
  wrap.innerHTML = "";

  if (!payment) {
    wrap.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">💳</div>
        <div class="empty-state-text">No recent transactions</div>
      </div>
    `;
    return;
  }

  const transactionId = escapeHtml(payment.transaction_id || "-");
  const status = escapeHtml(payment.status || "-");
  const amount = escapeHtml(payment.amount || "-");
  const currency = escapeHtml(payment.currency || "");
  const date = formatDate(payment.date);

  wrap.innerHTML = `
    <div class="payment-card">
      <div class="payment-row">
        <span class="payment-label">Transaction ID</span>
        <span class="payment-value">${transactionId}</span>
      </div>
      <div class="payment-row">
        <span class="payment-label">Status</span>
        <span class="payment-value">${status}</span>
      </div>
      <div class="payment-row">
        <span class="payment-label">Amount</span>
        <span class="payment-value amount-value">${amount} ${currency}</span>
      </div>
      <div class="payment-row">
        <span class="payment-label">Date</span>
        <span class="payment-value">${date}</span>
      </div>
    </div>
  `;
}

async function readTicketEmail(client) {
  try {
    const td = await client.data.get("ticket");
    return getEmailFromTicket(td?.ticket);
  } catch (e) {
    console.error("ticket read failed", e);
    return "";
  }
}

async function readContactEmail(client) {
  try {
    const cd = await client.data.get("contact");
    return getEmailFromContact(cd?.contact);
  } catch (e) {
    console.error("contact read failed", e);
    return "";
  }
}

async function getRequesterEmail(client) {
  const email = await readTicketEmail(client);
  if (email) return email;
  return readContactEmail(client);
}

async function getRequesterName(client) {
  try {
    const td = await client.data.get("ticket");
    const name = getNameFromTicket(td?.ticket);
    if (name) return name;
  } catch (e) {
    console.error("ticket read failed for name", e);
  }
  
  try {
    const cd = await client.data.get("contact");
    return getNameFromContact(cd?.contact);
  } catch (e) {
    console.error("contact read failed for name", e);
    return "";
  }
}

function parseLensResponse(res) {
  // Freshworks invoke response usually has res.response as string JSON
  if (!res) throw new Error("Empty response from server");

  const raw = res.response ?? res;
  if (!raw) throw new Error("Invalid response payload");

  if (typeof raw === "object") return raw;

  try {
    return JSON.parse(raw);
  } catch {
    throw new Error("Invalid JSON response from server");
  }
}

async function render(client) {
  setStatus("Loading...");

  const email = await getRequesterEmail(client);
  if (!email) {
    setStatus("Email not found");
    return;
  }

  try {
    const res = await client.request.invoke("getSupportShieldLens", { email });
    const data = parseLensResponse(res);

    renderOrders(data.orders || []);
    renderPayment(data.payment || null);

    // Get requester name, fallback to email username if name not available
    const name = await getRequesterName(client);
    const displayName = name || email.split('@')[0];
    setStatus(`Loaded for ${displayName}`);
  } catch (e) {
    console.error("Lens fetch failed:", e);

    const errMessage = getInvokeErrorMessage(e);
    const status = e?.status;

    // better UX for auth failures
    if (status === 401 || status === 403 || /oauth|authorize|unauthorized/i.test(errMessage || "")) {
      await toast(
        client,
        "danger",
        "BigCommerce token missing or unauthorized. Update App Settings, then reload the ticket."
      );
    } else {
      await toast(client, "danger", errMessage || "Failed to load lens data.");
    }

    setStatus("Failed to load");
  }
}

init();

