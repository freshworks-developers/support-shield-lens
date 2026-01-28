# Support Shield Lens

> A **Freshworks Platform v3** app demonstrating **multi-OAuth integration** capabilities, seamlessly connecting BigCommerce and PayPal to provide comprehensive customer insights directly in the Freshdesk ticket sidebar.

![Support Shield Lens](app/styles/images/image.png)

---

## 🚀 Key Features

### Multi-OAuth Integration
This app showcases **advanced multi-OAuth capabilities** of the Freshworks Platform v3, supporting:
- **BigCommerce OAuth 2.0** - Secure authentication with scoped permissions for customer and order data
- **PayPal OAuth 2.0** - Dynamic token management for transaction history retrieval
- **Flexible authentication** - Supports both OAuth flows and API token-based authentication

### Platform v3 Capabilities
Built on **Freshworks Platform v3**, leveraging:
- **Serverless Functions** - Event-driven handlers for ticket lifecycle events (`onTicketCreate`, `onTicketUpdate`)
- **Request Templates** - Declarative API request definitions with dynamic context injection
- **Ticket Sidebar Location** - Native Freshdesk UI integration
- **Event Handlers** - Automated background processing on ticket events
- **Context-aware Data Fetching** - Dynamic API calls based on ticket requester information

---

## 📋 Table of Contents

- [Overview](#overview)
- [Multi-OAuth Architecture](#multi-oauth-architecture)
- [Platform v3 Features](#platform-v3-features)
- [Project Structure](#project-structure)
- [Prerequisites](#prerequisites)
- [Setup Guide](#setup-guide)
  - [1. BigCommerce Configuration](#1-bigcommerce-configuration)
  - [2. PayPal Configuration](#2-paypal-configuration)
  - [3. Freshdesk App Configuration](#3-freshdesk-app-configuration)
- [Testing](#testing)
- [Troubleshooting](#troubleshooting)
- [Resources](#resources)

---

## Overview

This **Freshworks Platform v3** app demonstrates **multi-OAuth integration** by seamlessly connecting **BigCommerce** and **PayPal Sandbox** to provide support agents with:

- **BigCommerce customer information** by requester email
- **Last 3 orders** from BigCommerce
- **Latest PayPal transaction** (within last 31 days)

The app displays this information in the Freshdesk ticket sidebar, helping support agents quickly understand customer purchase history and payment status.

### Why This App Matters

This sample app serves as a **reference implementation** for:
- **Multi-OAuth workflows** - Managing multiple OAuth integrations simultaneously
- **Platform v3 best practices** - Leveraging serverless functions, request templates, and event handlers
- **Real-world integration patterns** - Combining e-commerce and payment platform data

---

## Multi-OAuth Architecture

This app demonstrates **sophisticated multi-OAuth integration** capabilities:

### BigCommerce OAuth 2.0
- **OAuth Flow**: Configured via `oauth_config.json` with proper scopes
- **Scoped Permissions**: `store_v2_customers_read_only`, `store_v2_orders_read_only`, `store_v2_information_read_only`
- **Token Management**: Platform handles OAuth token refresh and storage automatically
- **Fallback Support**: Also supports API token-based authentication for flexibility

### PayPal OAuth 2.0
- **Dynamic Token Generation**: Server-side OAuth token generation using client credentials
- **Environment-aware**: Supports both Sandbox and Live modes
- **Secure Credential Handling**: Client secrets stored securely as installation parameters
- **Token Refresh**: Automatic token management for API calls

### Multi-OAuth Benefits
- **Unified Experience**: Single app interface managing multiple OAuth providers
- **Secure by Default**: Platform handles token encryption, storage, and refresh
- **Scalable Pattern**: Easy to extend with additional OAuth providers
- **Flexible Authentication**: Supports both OAuth and API token modes per provider

---

## Platform v3 Features

This app leverages **key Freshworks Platform v3 capabilities**:

### Serverless Functions
- **`getSupportShieldLens`** (20s timeout) - Main function orchestrating data aggregation
- **`onTicketCreateHandler`** (10s timeout) - Automated processing on ticket creation
- **`onTicketUpdateHandler`** (10s timeout) - Automated processing on ticket updates
- **Event-driven Architecture**: Functions triggered automatically by platform events

### Request Templates (`requests.json`)
- **Declarative API Definitions**: Pre-configured API request schemas
- **Dynamic Context Injection**: Uses `<%= context.* %>` and `<%= iparam.* %>` for runtime values
- **Type-safe Requests**: Schema validation ensures correct API calls
- **Reusable Components**: Request templates can be shared across functions

### Event Handlers
- **`onTicketCreate`** - Triggers when new tickets are created
- **`onTicketUpdate`** - Triggers when tickets are updated
- **Background Processing**: Handlers run asynchronously without blocking UI
- **Context Access**: Full access to ticket data and requester information

### Ticket Sidebar Location
- **Native Integration**: Seamlessly embedded in Freshdesk ticket sidebar
- **Real-time Updates**: UI updates automatically based on ticket context
- **Responsive Design**: Optimized for sidebar viewport constraints

### Platform v3 Advantages
- **No Infrastructure Management**: Serverless functions eliminate server maintenance
- **Automatic Scaling**: Platform handles traffic spikes automatically
- **Built-in Security**: OAuth token management, secure parameter storage
- **Developer Experience**: Declarative configuration reduces boilerplate code

---

## Project Structure

```text
.
├── README.md                 # Documentation for the app
├── app                       # Frontend assets and components
│   ├── index.html           # Landing page for the app
│   ├── scripts              # Frontend JavaScript business logic
    │   │   └── app.js
│   └── styles               # Styles and assets
    │       ├── images
    │       │   └── icon.svg
    │       └── style.css
├── config                    # Configuration files
│   └── iparams.json         # Installation parameters
├── Server                    # Server-side code
│   └── server.js            # Server logic and API handlers
└── manifest.json            # App metadata and configuration
```

---

## Prerequisites

Before setting up this app, ensure you have:

- ✅ **Freshdesk account** (where the app runs in ticket sidebar)
- ✅ **Freshworks FDK** installed and configured
- ✅ **BigCommerce trial store** (or existing store)
- ✅ **PayPal Developer account** (Sandbox)

---

## Setup Guide

### 1. BigCommerce Configuration

#### 1.1 Find Your Store Hash

**How to find your store hash:**

The store hash is typically found in:

- Your store URL subdomain: `store-{hash}.mybigcommerce.com`
- API credentials screen in BigCommerce admin

**Example:**

- Store URL: `store-4uon0kvdsy.mybigcommerce.com/`
- Store hash: `uon0kvdsy` ✅

#### 1.2 Create API Credentials

1. Navigate to **Settings → API Accounts → Create API Account**
2. Select **Store-level API accounts** (not Storefront API Playground or Account-level API accounts)
   - This option allows you to create specific permissions for apps and integrations
   - Store-level accounts are required for accessing store data like customers and orders
3. You'll receive:
   - **Client ID**
   - **Access Token**
   - **Client Secret** (if applicable)

#### 1.3 Configure API Permissions

⚠️ **Critical:** Your BigCommerce API token must have the following read permissions:

- ✅ **Customers** (read-only)
- ✅ **Orders** (read-only)
- ✅ **Store information** (read-only, if needed)

Without these permissions, you'll receive a 403 error. Edit your API account and enable the required read-only scopes.

---

### 2. PayPal Configuration

#### 2.1 Create PayPal Sandbox App

1. Go to **PayPal Developer Dashboard**
2. Navigate to **Apps & Credentials**
3. Create a new app (select **Sandbox**)
4. Copy the **Client ID** and **Secret**

---

### 3. Freshdesk App Configuration

#### 3.1 Multi-OAuth Setup

This app supports **two authentication methods** for maximum flexibility:

**Option A: OAuth 2.0 Flow (Recommended)**
- Configure OAuth credentials in `oauth_config.json`
- Platform handles token generation, refresh, and storage automatically
- More secure and follows OAuth best practices
- Supports token refresh without manual intervention

**Option B: API Token Mode**
- Direct API token authentication via installation parameters
- Simpler setup for development and testing
- Requires manual token management

#### 3.2 Installation Parameters (iparams.json)

Configure your app with the following parameters in `iparams.json`:

**BigCommerce Configuration:**
- `bigcommerce_store_hash`: Your BigCommerce store hash
- `bigcommerce_client_id`: Your BigCommerce API client ID (for OAuth or API token mode)
- `bigcommerce_ClientScret_hash`: Your BigCommerce client secret (for OAuth flow)
- `bigcommerce_access_token`: Your BigCommerce API access token (for API token mode)

**PayPal Configuration:**
- `paypal_client_id`: Your PayPal sandbox/live client ID
- `paypal_client_secret`: Your PayPal sandbox/live client secret
- `paypal_mode`: Set to `"sandbox"` or `"live"`

#### 3.3 OAuth Configuration (oauth_config.json)

For BigCommerce OAuth flow, ensure `oauth_config.json` includes:
- OAuth endpoints (authorize_url, token_url)
- Required scopes for customer and order access
- Client credentials mapping

⚠️ **Important:**
- For **OAuth mode**: Complete the OAuth connection flow in the app installation
- For **API token mode**: Use `<%= iparam.bigcommerce_access_token %>` in request templates
- PayPal always uses OAuth 2.0 client credentials flow (handled server-side)

---

## Testing

Since testers typically won't have existing customer data, you need to create test data first:

### Quick Test Setup

1. **Create a BigCommerce customer** with an email address (e.g., `test@example.com`)
2. **Add a product** to your BigCommerce store
3. **Enable PayPal Sandbox** in BigCommerce payment settings:
   - Go to **Store Setup → Payments**
   - Add **PayPal** or **PayPal Checkout** as a payment method
   - Switch to **Sandbox/Test mode**
   - Connect to your PayPal sandbox business account (from PayPal Developer Dashboard)
4. **Place a test order**:
   - Open your storefront
   - Add product to cart
   - Checkout using PayPal Sandbox
   - Use a PayPal sandbox buyer account with the **same email** as the BigCommerce customer

This creates matching customer and order data in both BigCommerce and PayPal.

### Run the App

1. Start the app: `fdk run`
2. Open a Freshdesk ticket where the requester email matches your test customer email
3. The app will display BigCommerce customer info, last 3 orders, and PayPal transaction history

---

## Troubleshooting

### A) 404 Not Found (openresty) on BigCommerce Call

**Symptoms:**

- 404 error when calling BigCommerce API

**Possible causes:**

- Wrong store hash in API URL path
- Incorrect BigCommerce endpoint path

**Solution:**

- ✅ Confirm `bigcommerce_store_hash` is correct
- ✅ Verify API endpoint URLs use the correct store hash format

---

### B) 403 You Don't Have Required Scope

**Symptoms:**

- 403 error: "You don't have a required scope to access the endpoint"

**Cause:**

- BigCommerce credential doesn't have permission for that resource

**Solution:**

- ✅ In BigCommerce API account permissions, enable:
  - Customers: read-only
  - Orders: read-only
- ✅ If using OAuth app scopes, request the correct read scopes

---

### C) OAuth Token Issues

**Symptoms:**

- Error: "Cannot read properties of undefined (reading 'access_token')"
- OAuth connection fails during installation
- Token refresh errors

**Causes:**

- Template uses `<%= access_token %>` but OAuth wasn't performed
- OAuth flow not completed during app installation
- Invalid OAuth credentials in `oauth_config.json`
- Token refresh failed due to expired refresh token

**Solutions:**

**For BigCommerce OAuth:**

- ✅ Complete the OAuth connection flow in app installation settings
- ✅ Verify `oauth_config.json` has correct client_id and client_secret
- ✅ Ensure OAuth scopes match required permissions
- ✅ Check that BigCommerce app has correct redirect URLs configured

**For BigCommerce API Token Mode:**

- ✅ Use `<%= iparam.bigcommerce_access_token %>` in request templates
- ✅ Do **not** reference OAuth tokens if using API token mode
- ✅ Ensure access token has required scopes

**For PayPal OAuth:**

- ✅ Verify PayPal client_id and client_secret are correct
- ✅ Check PayPal mode (sandbox vs live) matches credentials
- ✅ Ensure server-side OAuth token generation logic is working

---

### D) PayPal Date Range Error

**Symptoms:**

- PayPal error: "Range must be <= 31 days"

**Solution:**

- ✅ Ensure date range queries are limited to 31 days maximum
- ✅ PayPal Transaction Search requires start_date and end_date within 31 days

---

## Resources

### Freshworks Platform
- 📚 [Freshworks Platform v3 Documentation](https://developers.freshworks.com/docs/apps/v3/)
- 🔐 [OAuth Integration Guide](https://developers.freshworks.com/docs/apps/v3/oauth/)
- ⚡ [Serverless Functions](https://developers.freshworks.com/docs/apps/v3/serverless-functions/)
- 📋 [Request Templates](https://developers.freshworks.com/docs/apps/v3/request-method/)
- 🎯 [Event Handlers](https://developers.freshworks.com/docs/apps/v3/events/)
- 📚 [Freshworks Sample Apps](https://community.developers.freshworks.com/t/freshworks-sample-apps/3604)
- 🔗 [Freshworks GitHub Repository](https://github.com/freshworks)

### Integration APIs
- 📖 [BigCommerce API Documentation](https://developer.bigcommerce.com/api-docs)
- 🔐 [BigCommerce OAuth Guide](https://developer.bigcommerce.com/api-docs/getting-started/authentication/rest-api-authentication)
- 💳 [PayPal Developer Documentation](https://developer.paypal.com/docs/)
- 🔑 [PayPal OAuth 2.0](https://developer.paypal.com/docs/api-basics/get-started/)

---

## Platform v3 & Multi-OAuth Showcase

This app serves as a **comprehensive example** of Freshworks Platform v3 capabilities and multi-OAuth integration patterns:

### What Makes This App Special

✅ **Multi-OAuth Integration** - Demonstrates managing multiple OAuth providers (BigCommerce + PayPal) in a single app  
✅ **Platform v3 Architecture** - Leverages serverless functions, request templates, and event handlers  
✅ **Real-world Use Case** - Combines e-commerce and payment data for customer support context  
✅ **Production-ready Patterns** - Follows best practices for security, error handling, and scalability  

### Learning Opportunities

- **OAuth 2.0 Implementation** - Learn how to configure and manage OAuth flows in Freshworks apps
- **Serverless Functions** - Understand event-driven serverless architecture
- **Request Templates** - Master declarative API request definitions
- **Event Handlers** - Implement automated background processing
- **Multi-provider Integration** - Combine data from multiple external APIs

### Next Steps

- Explore [more sample apps](https://community.developers.freshworks.com/t/freshworks-sample-apps/3604) on the Freshworks GitHub repository
- Read [Freshworks Platform v3 Documentation](https://developers.freshworks.com/docs/) for advanced features
- Check out [OAuth Integration Guide](https://developers.freshworks.com/docs/apps/v3/oauth/) for authentication patterns
