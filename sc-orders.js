const getScUser = () => {
    try {
        return JSON.parse(localStorage.getItem("scUser") || "null");
    } catch {
        return null;
    }
};

const getActiveStoreId = () => {
    const scUser = getScUser();
    return String(scUser?.store_id || "").trim() || "";
};

const getCartStorageKey = () => {
    const storeId = getActiveStoreId();
    return `scCart:${storeId || "guest"}`;
};

const loadCart = () => {
    try {
        const raw = localStorage.getItem(getCartStorageKey());
        const parsed = raw ? JSON.parse(raw) : null;
        if (!parsed || typeof parsed !== "object") return { items: {} };
        if (!parsed.items || typeof parsed.items !== "object") return { items: {} };
        return parsed;
    } catch {
        return { items: {} };
    }
};

const saveCart = (cart) => {
    localStorage.setItem(getCartStorageKey(), JSON.stringify(cart || { items: {} }));
};

const formatCurrency = (value) => {
    const num = Number(value);
    if (!Number.isFinite(num)) return "₱0.00";
    return `₱${num.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const formatDate = (dateString) => {
    if (!dateString) return "-";
    try {
        return new Date(dateString).toLocaleDateString('en-CA'); // YYYY-MM-DD format
    } catch (e) {
        return dateString;
    }
};

const defaultR2BaseUrl = "https://pub-431a1eccf270455a99eab6163255ef53.r2.dev";
const localPlaceholderImage = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" width="960" height="640" viewBox="0 0 960 640">
      <defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#0b0d12"/><stop offset="1" stop-color="#171b24"/></linearGradient></defs>
      <rect width="960" height="640" fill="url(#bg)"/>
      <rect x="80" y="88" width="800" height="464" rx="28" fill="#0f1219" stroke="#2a3240" stroke-width="2"/>
      <path d="M210 454l150-170 120 120 200-240 170 290H210z" fill="#202837"/>
      <circle cx="330" cy="248" r="44" fill="#202837"/>
      <text x="480" y="520" text-anchor="middle" fill="#9aa4b2" font-family="Arial, sans-serif" font-size="26">Image unavailable</text>
    </svg>
  `)}`;
const r2BaseUrl = window.scUtils?.r2BaseUrl || defaultR2BaseUrl;
const placeholderImage = window.scUtils?.placeholderImage || localPlaceholderImage;

let currentOrderItems = [];
let currentOrderKey = null;
let currentOrderRecord = null;
let currentOrderDateLabel = "";
let currentOrderStatus = "";
let currentOrderStatusCell = null;
let cancelRequestInFlight = false;

const cancelApproverModal = {
    modal: null,
    form: null,
    username: null,
    password: null,
    message: null,
    closeBtn: null,
    cancelBtn: null,
    submitBtn: null
};

const detailsModal = {
    modal: null,
    closeBtn: null,
    list: null,
    title: null,
    meta: null,
    total: null,
    reorderBtn: null,
    cancelBtn: null,
    stepper: null,
    cancelJourney: null,
    cancelStepper: null
};

const setCancelApproverMessage = (text, variant) => {
    if (!cancelApproverModal.message) return;
    cancelApproverModal.message.textContent = text || "";
    cancelApproverModal.message.classList.remove("error", "success");
    if (variant) cancelApproverModal.message.classList.add(variant);
};

const buildCancelApproverModal = () => {
    if (cancelApproverModal.modal) return;

    const modal = document.createElement("div");
    modal.className = "sc-approve-modal sc-approve-modal-over-order-details";
    modal.setAttribute("aria-hidden", "true");
    modal.innerHTML = `
      <div class="sc-approve-modal-panel" role="dialog" aria-modal="true" aria-labelledby="orderCancelApproverModalTitle">
        <div class="sc-approve-modal-header">
          <h3 id="orderCancelApproverModalTitle">Approver required</h3>
          <button type="button" class="sc-approve-modal-close" aria-label="Close">
            <span aria-hidden="true">&times;</span>
          </button>
        </div>

        <div class="sc-approve-modal-body">
          <p class="subhead">Enter an approver (OIC) username and password to cancel this order.</p>

          <form id="orderCancelApproverForm" class="sc-approve-form" autocomplete="off">
            <div class="sc-field">
              <label for="orderCancelApproverUsername">Username</label>
              <input id="orderCancelApproverUsername" type="text" autocomplete="username" required>
            </div>
            <div class="sc-field">
              <label for="orderCancelApproverPassword">Password</label>
              <input id="orderCancelApproverPassword" type="password" autocomplete="current-password" required>
            </div>
            <p class="form-message" aria-live="polite"></p>
          </form>
        </div>

        <div class="sc-approve-modal-footer">
          <button type="button" class="sc-btn sc-btn-ghost">Cancel</button>
          <button type="submit" form="orderCancelApproverForm" class="sc-btn sc-btn-primary">Approve &amp; Cancel</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);
    cancelApproverModal.modal = modal;
    cancelApproverModal.form = modal.querySelector("form");
    cancelApproverModal.username = modal.querySelector("#orderCancelApproverUsername");
    cancelApproverModal.password = modal.querySelector("#orderCancelApproverPassword");
    cancelApproverModal.message = modal.querySelector(".form-message");
    cancelApproverModal.closeBtn = modal.querySelector(".sc-approve-modal-close");
    cancelApproverModal.cancelBtn = modal.querySelector(".sc-btn.sc-btn-ghost");
    cancelApproverModal.submitBtn = modal.querySelector(".sc-btn.sc-btn-primary");

    const close = () => closeCancelApproverModal();
    cancelApproverModal.closeBtn?.addEventListener("click", close);
    cancelApproverModal.cancelBtn?.addEventListener("click", close);

    modal.addEventListener("click", (event) => {
        if (event.target === modal) close();
    });

    document.addEventListener("keydown", (event) => {
        if (!cancelApproverModal.modal?.classList.contains("is-visible")) return;
        if (event.key === "Escape") close();
    });

    cancelApproverModal.form?.addEventListener("submit", async (e) => {
        e.preventDefault();
        await submitCancelApprovedOrder();
    });
};

const openCancelApproverModal = () => {
    buildCancelApproverModal();
    if (!cancelApproverModal.modal) return;

    if (!canCancelOrder(currentOrderStatus)) {
        syncCancelButtonState(currentOrderStatus);
        return;
    }

    if (typeof supabaseClient === "undefined") {
        alert("Connect Supabase to cancel orders.");
        return;
    }

    cancelApproverModal.modal.classList.add("is-visible");
    cancelApproverModal.modal.setAttribute("aria-hidden", "false");

    if (cancelApproverModal.username) cancelApproverModal.username.value = "";
    if (cancelApproverModal.password) cancelApproverModal.password.value = "";
    setCancelApproverMessage("", "");

    setTimeout(() => cancelApproverModal.username?.focus(), 50);
};

const closeCancelApproverModal = () => {
    if (!cancelApproverModal.modal) return;
    cancelApproverModal.modal.classList.remove("is-visible");
    cancelApproverModal.modal.setAttribute("aria-hidden", "true");
    setCancelApproverMessage("", "");
    if (cancelApproverModal.submitBtn) cancelApproverModal.submitBtn.disabled = false;
};

const buildDetailsModal = () => {
    if (detailsModal.modal) return;

    const modal = document.createElement("div");
    modal.className = "sc-order-details-modal";
    modal.setAttribute("aria-hidden", "true");
    modal.innerHTML = `
      <div class="sc-order-details-panel" role="dialog" aria-modal="true" aria-label="Order details">
        <div class="sc-order-details-header">
          <div>
            <h3 class="sc-order-details-title">Order details</h3>
            <p class="sc-order-details-meta"></p>
          </div>
          <button type="button" class="sc-order-details-close" aria-label="Close details">
            <span aria-hidden="true">&times;</span>
          </button>
        </div>
        <div class="sc-order-stepper" id="scOrderStepper"></div>
        <div class="sc-cancel-journey" id="scCancelJourney" hidden>
          <p class="sc-cancel-journey-title">Cancelled Journey</p>
          <div class="sc-order-stepper sc-order-stepper-cancel" id="scCancelStepper"></div>
        </div>
        <div class="sc-order-details-list"></div>
        <div class="sc-order-details-total">
          <span>Total</span>
          <strong class="sc-order-details-total-value">PHP 0.00</strong>
        </div>
        <div class="sc-order-details-actions">
          <button type="button" class="sc-order-details-cancel">Cancel Order</button>
          <button type="button" class="sc-order-details-reorder">Reorder Items</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);
    detailsModal.modal = modal;
    detailsModal.closeBtn = modal.querySelector(".sc-order-details-close");
    detailsModal.list = modal.querySelector(".sc-order-details-list");
    detailsModal.title = modal.querySelector(".sc-order-details-title");
    detailsModal.meta = modal.querySelector(".sc-order-details-meta");
    detailsModal.total = modal.querySelector(".sc-order-details-total-value");
    detailsModal.reorderBtn = modal.querySelector(".sc-order-details-reorder");
    detailsModal.cancelBtn = modal.querySelector(".sc-order-details-cancel");
    detailsModal.stepper = modal.querySelector("#scOrderStepper");
    detailsModal.cancelJourney = modal.querySelector("#scCancelJourney");
    detailsModal.cancelStepper = modal.querySelector("#scCancelStepper");

    const close = () => closeDetailsModal();
    detailsModal.closeBtn?.addEventListener("click", close);
    modal.addEventListener("click", (event) => {
        if (event.target === modal) closeDetailsModal();
    });

    document.addEventListener("keydown", (event) => {
        if (!detailsModal.modal?.classList.contains("is-visible")) return;
        if (cancelApproverModal.modal?.classList.contains("is-visible")) return;
        if (event.key === "Escape") closeDetailsModal();
    });

    detailsModal.reorderBtn?.addEventListener("click", () => {
        reorderItems();
    });

    detailsModal.cancelBtn?.addEventListener("click", () => {
        openCancelApproverModal();
    });
};

const reorderItems = () => {
    if (!currentOrderItems || currentOrderItems.length === 0) {
        alert("No items to reorder.");
        return;
    }

    const cart = loadCart();

    currentOrderItems.forEach(item => {
        const itemCode = String(item.item_code || "").trim();
        if (!itemCode || itemCode === "-") return;

        const qtyToAdd = Math.max(1, Number(item.qty) || 1);

        cart.items[itemCode] = {
            item_code: itemCode,
            item_name: String(item.item_name || "").trim(),
            brand: String(item.brand || "").trim(),
            price: Number(item.unit_price || item.price || 0),
            qty: qtyToAdd,
            added_at: new Date().toISOString(),
        };
    });

    saveCart(cart);
    if (window.scHeader?.updateCartBadge) {
      window.scHeader.updateCartBadge();
    }
    alert("Items from this order have been added to your cart.");
    closeDetailsModal();
    window.location.href = "sc-cart.html";
};

const renderOrderStepper = (container, status) => {
    if (!container) return;
    
    const s = String(status || "").toLowerCase();
    if (s.includes("cancel") || s.includes("void")) {
        const isPendingCancel = s.includes("pending") && s.includes("cancel");
        const bannerText = isPendingCancel ? "Cancellation Pending" : "Order Cancelled";
        container.innerHTML = `<div class="sc-cancelled-banner">${bannerText}</div>`;
        return;
    }

    const steps = ["Pending", "Processing", "Shipped", "Delivered"];
    let currentIndex = 0;
    
    if (s.includes("deliver") || s.includes("complet") || s.includes("done")) currentIndex = 3;
    else if (s.includes("ship") || s.includes("transit") || s.includes("way")) currentIndex = 2;
    else if (s.includes("process") || s.includes("approv") || s.includes("invoice") || s.includes("pack")) currentIndex = 1;

    container.innerHTML = steps.map((label, index) => {
        let className = "sc-step";
        let content = index + 1;
        
        if (index < currentIndex) {
            className += " is-completed";
            content = `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
        } else if (index === currentIndex) {
            className += " is-active";
        }

        return `
            <div class="${className}">
                <div class="sc-step-circle">${content}</div>
                <span class="sc-step-label">${label}</span>
            </div>
        `;
    }).join("");
};

const renderCancelledJourney = (container, status) => {
    if (!container) return;

    const s = String(status || "").toLowerCase().trim();
    if (!s.includes("cancel") && !s.includes("void")) {
        container.innerHTML = "";
        return;
    }

    const steps = ["Pending", "Processing", "Cancelled"];
    const isPendingCancel = s.includes("pending") && s.includes("cancel");
    const isFullyCancelled = (s.includes("cancel") || s.includes("void")) && !isPendingCancel;

    let reachedProcessing = false;
    if (
        s.includes("process") ||
        s.includes("approv") ||
        s.includes("invoice") ||
        s.includes("pack") ||
        isPendingCancel ||
        isFullyCancelled
    ) {
        reachedProcessing = true;
    }

    container.innerHTML = steps
        .map((label, index) => {
            let className = "sc-step";
            let content = index + 1;

            if (label === "Pending") {
                className += " is-completed";
                content = `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
            } else if (label === "Processing") {
                if (isPendingCancel) {
                    className += " is-active";
                } else if (reachedProcessing) {
                    className += " is-completed";
                    content = `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
                }
            } else if (label === "Cancelled") {
                if (!isPendingCancel) {
                    className += " is-active is-cancelled";
                    content = "!";
                }
            }

            return `
                <div class="${className}">
                    <div class="sc-step-circle">${content}</div>
                    <span class="sc-step-label">${label}</span>
                </div>
            `;
        })
        .join("");
};

const canCancelOrder = (status) => {
    const s = String(status || "").toLowerCase();
    if (!s.trim()) return false;

    if (s.includes("cancel") || s.includes("void")) return false;
    if (s.includes("ship") || s.includes("transit") || s.includes("way")) return false;
    if (s.includes("deliver") || s.includes("complet") || s.includes("done")) return false;

    return true;
};

const resolveOrderIdColumn = (orderRecord) => {
    if (orderRecord && orderRecord.id != null) return "id";
    if (orderRecord && orderRecord.order_id != null) return "order_id";
    return "id";
};

const resolveOrderStatusColumn = (orderRecord) => {
    if (orderRecord && orderRecord.status != null) return "status";
    if (orderRecord && orderRecord.order_status != null) return "order_status";
    return "status";
};

const syncCancelButtonState = (status) => {
    if (!detailsModal.cancelBtn) return;

    const hasKey = String(currentOrderKey || "").trim().length > 0;
    const allowed = hasKey && canCancelOrder(status) && !cancelRequestInFlight;

    detailsModal.cancelBtn.disabled = !allowed;

    if (!hasKey) {
        detailsModal.cancelBtn.title = "This order cannot be cancelled (missing order id).";
    } else if (cancelRequestInFlight) {
        detailsModal.cancelBtn.title = "Cancelling order...";
    } else if (!canCancelOrder(status)) {
        detailsModal.cancelBtn.title = "Cancellation is disabled once shipped, delivered, or cancelled.";
    } else {
        detailsModal.cancelBtn.title = "Cancel this order";
    }
};

const submitCancelApprovedOrder = async () => {
    if (cancelRequestInFlight) return;
    if (typeof supabaseClient === "undefined") {
        setCancelApproverMessage("Cancellation service unavailable (Supabase client missing).", "error");
        return;
    }

    if (!canCancelOrder(currentOrderStatus)) {
        setCancelApproverMessage("Cancellation is disabled once shipped, delivered, or cancelled.", "error");
        syncCancelButtonState(currentOrderStatus);
        return;
    }

    const storeId = getActiveStoreId();
    if (!storeId) {
        setCancelApproverMessage("Your account is not linked to a store.", "error");
        return;
    }

    const orderKeyValue = String(currentOrderKey || "").trim();
    if (!orderKeyValue) {
        setCancelApproverMessage("This order cannot be cancelled (missing order id).", "error");
        syncCancelButtonState(currentOrderStatus);
        return;
    }

    const username = String(cancelApproverModal.username?.value || "").trim().toLowerCase();
    const password = String(cancelApproverModal.password?.value || "");

    if (!username || !password) {
        setCancelApproverMessage("Please enter approver username and password.", "error");
        return;
    }

    const confirmed = confirm("Cancel this order? This cannot be undone.");
    if (!confirmed) return;

    const orderKeySnapshot = currentOrderKey;
    const orderRecordSnapshot = currentOrderRecord;
    const orderDateLabelSnapshot = currentOrderDateLabel;
    const statusCellSnapshot = currentOrderStatusCell;

    cancelRequestInFlight = true;
    if (cancelApproverModal.submitBtn) cancelApproverModal.submitBtn.disabled = true;

    const previousLabel = detailsModal.cancelBtn?.textContent;
    if (detailsModal.cancelBtn) detailsModal.cancelBtn.textContent = "Cancelling...";
    syncCancelButtonState(currentOrderStatus);
    setCancelApproverMessage("Verifying approver...", "");

    try {
        const rpcClient = typeof supabaseClient?.schema === "function" ? supabaseClient.schema("public") : supabaseClient;

        const { data, error } = await rpcClient.rpc("cancel_sc_order_gemini", {
            p_store_id: storeId,
            p_order_id: orderKeyValue,
            p_approver_username: username,
            p_approver_password: password
        });

        if (error) {
            const dbErrorMessage = String(error.message || "Invalid approver credentials.").trim();
            const dbErrorDetails = String(error.details || "").trim();
            setCancelApproverMessage(dbErrorDetails ? `${dbErrorMessage} — ${dbErrorDetails}` : dbErrorMessage, "error");
            return;
        }

        const result = (Array.isArray(data) ? data[0] : data) || {};
        const cancelledOrderId = result?.order_id;
        const approverName = result?.approver_name;

        if (!cancelledOrderId) {
            setCancelApproverMessage("Cancellation approved but no order ID returned.", "error");
            return;
        }

        setCancelApproverMessage("Approved! Processing cancellation request...", "success");
        closeCancelApproverModal();

        const isStillSameOrder =
            String(currentOrderKey || "").trim() === String(orderKeySnapshot || "").trim();

        if (statusCellSnapshot) {
            statusCellSnapshot.textContent = "Pending Cancel";
        }

        // Update local state and record to ensure persistence across modal interactions
        if (isStillSameOrder && detailsModal.modal?.classList.contains("is-visible")) {
            currentOrderStatus = "Pending Cancel";

            if (currentOrderRecord) {
                currentOrderRecord.status = "Pending Cancel";
                if (approverName) {
                    currentOrderRecord.cancelled_by = approverName;
                }
            }

            if (detailsModal.meta) {
                let metaText = `${orderDateLabelSnapshot || "-"} • ${currentOrderStatus}`;
                if (approverName) metaText += ` • Approved by: ${approverName}`;
                detailsModal.meta.textContent = metaText;
            }

            renderOrderStepper(detailsModal.stepper, currentOrderStatus);
            if (detailsModal.cancelJourney) detailsModal.cancelJourney.hidden = false;
            renderCancelledJourney(detailsModal.cancelStepper, currentOrderStatus);
            syncCancelButtonState(currentOrderStatus);
        }

        alert("Order status updated to Pending Cancel.");
    } catch (err) {
        setCancelApproverMessage(`Failed to cancel order: ${String(err?.message || err || "Unknown error")}`, "error");
    } finally {
        cancelRequestInFlight = false;
        if (detailsModal.cancelBtn) detailsModal.cancelBtn.textContent = previousLabel || "Cancel Order";
        syncCancelButtonState(currentOrderStatus);
        if (cancelApproverModal.submitBtn) cancelApproverModal.submitBtn.disabled = false;
    }
};

const cancelCurrentOrder = async () => {
};

const openDetailsModal = ({ orderId, date, status, items, total, orderKey, orderRecord, statusCell }) => {
    buildDetailsModal();
    if (!detailsModal.modal || !detailsModal.list) return;

    if (detailsModal.cancelBtn) detailsModal.cancelBtn.textContent = "Cancel Order";
    detailsModal.title.textContent = `Order #${orderId}`;
    
    const cancelledBy = orderRecord?.cancelled_by || "";
    const statusText = String(status || "").toLowerCase();
    const isCancelledState = statusText.includes("cancel") || statusText.includes("void");
    let metaText = `${date} • ${status}`;
    if (isCancelledState && cancelledBy) metaText += ` • Approved by: ${cancelledBy}`;
    detailsModal.meta.textContent = metaText;

    currentOrderItems = items;
    currentOrderKey = orderKey ?? null;
    currentOrderRecord = orderRecord ?? null;
    currentOrderDateLabel = date || "";
    currentOrderStatus = status || "";
    currentOrderStatusCell = statusCell || null;
    renderOrderStepper(detailsModal.stepper, status);
    syncCancelButtonState(status);

    if (detailsModal.cancelJourney) detailsModal.cancelJourney.hidden = !isCancelledState;
    renderCancelledJourney(detailsModal.cancelStepper, status);

    detailsModal.list.innerHTML = items.map((item) => {
        const code = String(item.item_code || "").trim();
        const safeCode = encodeURIComponent(code);
        const imgSrc = safeCode ? `${r2BaseUrl}/${safeCode}/IMG_0001.png` : placeholderImage;
        const imgSrcAlt = safeCode ? `${r2BaseUrl}/product-images/${safeCode}/IMG_0001.png` : placeholderImage;
        const imgSrcLocal = safeCode ? `product-images/${safeCode}/IMG_0001.png` : placeholderImage;
        const imgOnError = safeCode
            ? `if(!this.dataset.fallback){this.dataset.fallback='1';this.src='${imgSrcAlt}';}else if(this.dataset.fallback==='1'){this.dataset.fallback='2';this.src='${imgSrcLocal}';}else{this.src='${placeholderImage}';}`
            : `this.src='${placeholderImage}';`;
        const qty = Math.max(1, Number(item.qty) || 1);
        const price = Number(item.unit_price || item.price || 0);
        const subtotal = price * qty;
        return `
            <div class="sc-order-details-row">
            <div class="sc-order-details-image">
              <img src="${imgSrc}" alt="${code} image" loading="lazy" onerror="${imgOnError}">
            </div>
            <div class="sc-order-details-info">
              <p class="sc-order-details-code">${code}</p>
              <p class="sc-order-details-name">${String(item.item_name || "-")}</p>
              <p class="sc-order-details-meta">Qty: ${qty} • Unit: ${formatCurrency(price)}</p>
            </div>
            <div class="sc-order-details-subtotal">${formatCurrency(subtotal)}</div>
          </div>
        `;
    }).join("");

    detailsModal.total.textContent = formatCurrency(total);

    detailsModal.modal.classList.add("is-visible");
    detailsModal.modal.setAttribute("aria-hidden", "false");
    document.body.classList.add("has-order-details-modal");
};

const closeDetailsModal = () => {
    if (!detailsModal.modal) return;
    detailsModal.modal.classList.remove("is-visible");
    detailsModal.modal.setAttribute("aria-hidden", "true");
    document.body.classList.remove("has-order-details-modal");
    currentOrderItems = [];
    currentOrderKey = null;
    currentOrderRecord = null;
    currentOrderDateLabel = "";
    currentOrderStatus = "";
    currentOrderStatusCell = null;
};

const fetchOrderItems = async (orderId) => {
    if (typeof supabaseClient === "undefined") return null;
    const tables = ["sc_order_items", "sc_order_items_vw", "sc_order_items_view", "order_items"];
    const columns = ["order_id", "OrderID", "orderId"];

    for (const table of tables) {
        for (const column of columns) {
            const { data, error } = await supabaseClient
                .from(table)
                .select("*")
                .eq(column, orderId);
            if (error) continue;
            if (Array.isArray(data) && data.length) return data;
        }
    }
    return [];
};

const loadOrders = async () => {
    const user = getScUser();
    if (!user) {
        window.location.href = "index.html";
        return;
    }

    const storeId = String(user.store_id || user.storeId || "").trim();
    console.log("Loading orders for user:", user);
    console.log("Resolved storeId:", storeId, "(user.store_id=", user.store_id, ", user.storeId=", user.storeId, ")");

    const tableBody = document.getElementById("ordersTableBody");
    if (!tableBody) {
        console.error("Orders table body not found.");
        return;
    }

    if (!storeId) {
        console.log("No storeId found for user");
        tableBody.innerHTML =
            '<tr><td colspan="4" style="text-align:center; padding: 2rem;">Your account is not linked to a store in Supabase. <a href="sc-register.html" style="color:#D4AF37; font-weight:700;">Register your store</a> to view and track orders.</td></tr>';
        return;
    }

    const startDateEl = document.getElementById("startDate");
    const endDateEl = document.getElementById("endDate");
    const startVal = startDateEl?.value;
    const endVal = endDateEl?.value;

    if (typeof supabaseClient === "undefined") {
        tableBody.innerHTML =
            '<tr><td colspan="4" style="text-align:center; padding: 2rem;">Connect Supabase to view orders.</td></tr>';
        return;
    }

    // Show a loading state
    tableBody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding: 2rem;">Loading orders...</td></tr>';

    const { data: orders, error } = await supabaseClient
        .from("sc_orders")
        .select("*")
        .eq("store_id", storeId)
        .order("created_at", { ascending: false });

    console.log("Orders query result:", { orders, error });

    if (error) {
        console.error("Error fetching orders:", error);
        const errorMessage = String(error.message || error.error || "Unknown Supabase error").trim();
        const errorDetails = String(error.details || "").trim();
        const displayMessage = errorDetails
            ? `${errorMessage} — ${errorDetails}`
            : errorMessage;

        tableBody.innerHTML = `
            <tr>
              <td colspan="4" style="text-align:center; padding: 2rem; color: #f87171;">
                Error loading orders: ${displayMessage}
              </td>
            </tr>
        `;
        return;
    }

    tableBody.innerHTML = ""; // Clear loading/error state

    console.log("Number of orders found:", orders?.length || 0);

    if (!orders || orders.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding: 2rem;">You have not placed any orders yet.</td></tr>';
        return;
    }

    orders.forEach(order => {
        const orderNumber = order.id || order.order_id || order.orderId || "-";
        const orderDate = order.created_at || order.createdAt || "";
        const orderTotal = order.order_total || order.total || order.orderTotal || 0;
        const orderStatus = order.status || order.order_status || order.orderStatus || "Pending";
        const orderKey = order.id || order.order_id || order.orderId || null;

        const row = tableBody.insertRow();
        row.insertCell().textContent = orderNumber;
        row.insertCell().textContent = formatDate(orderDate);
        row.insertCell().textContent = formatCurrency(orderTotal);
        const statusCell = row.insertCell();
        statusCell.textContent = orderStatus;

        row.classList.add("sc-order-row");
        row.addEventListener("click", async () => {
            const statusNow = String(statusCell?.textContent || orderStatus || "Pending");
            const items = orderKey ? await fetchOrderItems(orderKey) : [];
            const safeItems = Array.isArray(items) ? items : [];
            const total = safeItems.reduce((sum, item) => {
                const qty = Math.max(1, Number(item.qty) || 1);
                const price = Number(item.unit_price || item.price || 0);
                return sum + qty * price;
            }, 0);

            openDetailsModal({
                orderId: orderNumber,
                date: formatDate(orderDate),
                status: statusNow,
                items: safeItems.length ? safeItems : [{
                    item_code: "-",
                    item_name: "No item details found for this order.",
                    qty: 1,
                    unit_price: 0
                }],
                total: Number.isFinite(total) && total > 0 ? total : Number(orderTotal) || 0,
                orderKey,
                orderRecord: order,
                statusCell
            });
        });
    });
};

document.addEventListener("DOMContentLoaded", () => {
    loadOrders();

    const filterBtn = document.getElementById("filterOrdersBtn");
    const resetBtn = document.getElementById("resetOrdersBtn");

    if (filterBtn) filterBtn.addEventListener("click", loadOrders);
    if (resetBtn) resetBtn.addEventListener("click", () => {
        document.getElementById("startDate").value = "";
        document.getElementById("endDate").value = "";
        loadOrders();
    });
});
