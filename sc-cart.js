(() => {
  const formatCurrency = (value) => {
    const number = Number(value);
    if (!Number.isFinite(number)) return "PHP 0.00";
    return `PHP ${number.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const getScUser = () => {
    try {
      return JSON.parse(sessionStorage.getItem("scUser") || "null");
    } catch {
      return null;
    }
  };

  const scUser = getScUser();
  if (!scUser) {
    window.location.href = "sc-login.html";
    return;
  }

  const getActiveStoreId = () => {
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

  const els = {
    tbody: document.getElementById("cartTableBody"),
    selectAll: document.getElementById("selectAllCart"),
    removeSelectedBtn: document.getElementById("removeSelectedBtn"),
    clearCartBtn: document.getElementById("clearCartBtn"),
    placeOrderBtn: document.getElementById("placeOrderBtn"),
    selectedCount: document.getElementById("selectedCount"),
    selectedTotal: document.getElementById("selectedTotal")
  };

  const clearModal = {
    modal: null,
    confirmBtn: null,
    cancelBtn: null,
    closeBtn: null
  };

  const reviewModal = {
    modal: null,
    confirmBtn: null,
    cancelBtn: null,
    closeBtn: null,
    list: null,
    total: null
  };

  const buildClearModal = () => {
    if (clearModal.modal) return;

    const modal = document.createElement("div");
    modal.className = "sc-clear-modal";
    modal.setAttribute("aria-hidden", "true");
    modal.innerHTML = `
      <div class="sc-clear-panel" role="dialog" aria-modal="true" aria-label="Confirm clear cart">
        <div class="sc-clear-header">
          <h3>Clear cart?</h3>
          <button type="button" class="sc-clear-close" aria-label="Close confirmation">
            <span aria-hidden="true">&times;</span>
          </button>
        </div>
        <p class="sc-clear-body">This will remove all items from your cart. This action cannot be undone.</p>
        <div class="sc-clear-actions">
          <button type="button" class="sc-clear-cancel">Cancel</button>
          <button type="button" class="sc-clear-confirm">Clear Cart</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);
    clearModal.modal = modal;
    clearModal.confirmBtn = modal.querySelector(".sc-clear-confirm");
    clearModal.cancelBtn = modal.querySelector(".sc-clear-cancel");
    clearModal.closeBtn = modal.querySelector(".sc-clear-close");

    const close = () => closeClearModal();
    clearModal.cancelBtn?.addEventListener("click", close);
    clearModal.closeBtn?.addEventListener("click", close);
    modal.addEventListener("click", (event) => {
      if (event.target === modal) closeClearModal();
    });

    clearModal.confirmBtn?.addEventListener("click", () => {
      clearCart();
      closeClearModal();
    });

    document.addEventListener("keydown", (event) => {
      if (!clearModal.modal?.classList.contains("is-visible")) return;
      if (event.key === "Escape") closeClearModal();
    });
  };

  const openClearModal = () => {
    buildClearModal();
    if (!clearModal.modal) return;
    clearModal.modal.classList.add("is-visible");
    clearModal.modal.setAttribute("aria-hidden", "false");
    document.body.classList.add("has-clear-modal");
  };

  const closeClearModal = () => {
    if (!clearModal.modal) return;
    clearModal.modal.classList.remove("is-visible");
    clearModal.modal.setAttribute("aria-hidden", "true");
    document.body.classList.remove("has-clear-modal");
  };

  const approverEls = {
    modal: document.getElementById("approverModal"),
    form: document.getElementById("approverForm"),
    username: document.getElementById("approverUsername"),
    password: document.getElementById("approverPassword"),
    message: document.getElementById("approverMessage"),
    closeBtn: document.getElementById("approverCloseBtn"),
    cancelBtn: document.getElementById("approverCancelBtn"),
    submitBtn: document.getElementById("approverSubmitBtn")
  };

  const setApproverMessage = (text, variant) => {
    if (!approverEls.message) return;
    approverEls.message.textContent = text || "";
    approverEls.message.classList.remove("error", "success");
    if (variant) approverEls.message.classList.add(variant);
  };

  const openApproverModal = () => {
    if (!approverEls.modal) return;
    approverEls.modal.classList.add("is-visible");
    approverEls.modal.setAttribute("aria-hidden", "false");
    if (approverEls.username) approverEls.username.value = "";
    if (approverEls.password) approverEls.password.value = "";
    setApproverMessage("", "");
    setTimeout(() => approverEls.username?.focus(), 50);
  };

  const closeApproverModal = () => {
    if (!approverEls.modal) return;
    approverEls.modal.classList.remove("is-visible");
    approverEls.modal.setAttribute("aria-hidden", "true");
    setApproverMessage("", "");
  };

  const getSelectedCodes = () => {
    const checked = Array.from(document.querySelectorAll('input.cart-select[type="checkbox"]:checked'));
    return checked.map((input) => String(input.dataset.code || "").trim()).filter(Boolean);
  };

  const recomputeSummary = () => {
    const cart = loadCart();
    const selected = new Set(getSelectedCodes());
    const items = Object.values(cart.items || {});

    let count = 0;
    let total = 0;
    items.forEach((item) => {
      const code = String(item.item_code || "").trim();
      if (!code || !selected.has(code)) return;
      count += 1;
      const price = Number(item.price) || 0;
      const qty = Math.max(1, Number(item.qty) || 1);
      total += price * qty;
    });

    if (els.selectedCount) els.selectedCount.textContent = String(count);
    if (els.selectedTotal) els.selectedTotal.textContent = formatCurrency(total);
  };

  const render = () => {
    if (!els.tbody) return;

    const cart = loadCart();
    const items = Object.values(cart.items || {});
    items.sort((a, b) => String(a.item_code || "").localeCompare(String(b.item_code || "")));

    els.tbody.innerHTML = "";

    if (!items.length) {
      const row = els.tbody.insertRow();
      const cell = row.insertCell();
      cell.colSpan = 7;
      cell.textContent = "Your cart is empty.";
      cell.style.textAlign = "center";
      cell.style.padding = "2rem";
      recomputeSummary();
      return;
    }

    items.forEach((item) => {
      const code = String(item.item_code || "").trim();
      const row = els.tbody.insertRow();

      const selectCell = row.insertCell();
      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.className = "cart-select";
      checkbox.dataset.code = code;
      checkbox.addEventListener("change", () => {
        recomputeSummary();
      });
      selectCell.appendChild(checkbox);

      row.insertCell().textContent = code;
      row.insertCell().textContent = String(item.item_name || "-");
      row.insertCell().textContent = String(item.brand || "-");

      const qtyCell = row.insertCell();
      const qtyInput = document.createElement("input");
      qtyInput.type = "number";
      qtyInput.min = "1";
      qtyInput.step = "1";
      qtyInput.value = String(Math.max(1, Number(item.qty) || 1));
      qtyInput.className = "cart-qty";
      qtyInput.addEventListener("input", () => {
        const cartNow = loadCart();
        const nextQty = Math.max(1, Number(qtyInput.value) || 1);
        if (cartNow.items[code]) {
          cartNow.items[code].qty = nextQty;
          saveCart(cartNow);
          render();
        }
      });
      qtyCell.appendChild(qtyInput);

      const price = Number(item.price);
      row.insertCell().textContent = Number.isFinite(price) ? formatCurrency(price) : "PHP 0.00";

      const qty = Math.max(1, Number(item.qty) || 1);
      const subtotal = (Number.isFinite(price) ? price : 0) * qty;
      row.insertCell().textContent = formatCurrency(subtotal);
    });

    if (els.selectAll) {
      els.selectAll.checked = false;
    }
    recomputeSummary();
  };

  const removeSelected = () => {
    const selected = getSelectedCodes();
    if (!selected.length) return;
    const cart = loadCart();
    selected.forEach((code) => {
      delete cart.items[code];
    });
    saveCart(cart);
    render();
    if (window.scHeader?.updateCartBadge) {
      window.scHeader.updateCartBadge();
    }
  };

  const clearCart = () => {
    saveCart({ items: {} });
    render();
    if (window.scHeader?.updateCartBadge) {
      window.scHeader.updateCartBadge();
    }
  };

  let pendingOrder = null;
  let pendingReview = null;

  const buildSelectedItems = () => {
    const selectedCodes = getSelectedCodes();
    if (!selectedCodes.length) return null;

    const cart = loadCart();
    const selectedItems = selectedCodes
      .map((code) => cart.items[code])
      .filter(Boolean)
      .map((item) => ({
        item_code: String(item.item_code || "").trim(),
        item_name: String(item.item_name || "").trim(),
        qty: Math.max(1, Number(item.qty) || 1),
        unit_price: Number(item.price) || 0
      }))
      .filter((item) => item.item_code);

    if (!selectedItems.length) return null;
    return { selectedCodes, selectedItems, cart };
  };

  const buildReviewRow = (item) => {
    const code = String(item.item_code || "").trim();
    const safeCode = encodeURIComponent(code);
    const imgSrc = safeCode ? `${r2BaseUrl}/${safeCode}/IMG_0001.png` : placeholderImage;
    const imgSrcAlt = safeCode ? `${r2BaseUrl}/product-images/${safeCode}/IMG_0001.png` : placeholderImage;
    const imgSrcLocal = safeCode ? `product-images/${safeCode}/IMG_0001.png` : placeholderImage;
    const imgOnError = safeCode
      ? `if(!this.dataset.fallback){this.dataset.fallback='1';this.src='${imgSrcAlt}';}else if(this.dataset.fallback==='1'){this.dataset.fallback='2';this.src='${imgSrcLocal}';}else{this.src='${placeholderImage}';}`
      : `this.src='${placeholderImage}';`;
    const qty = Math.max(1, Number(item.qty) || 1);
    const price = Number(item.unit_price || 0);
    const subtotal = price * qty;

    return `
        <div class="sc-review-row">
        <div class="sc-review-image">
          <img src="${imgSrc}" alt="${code} image" loading="lazy" onerror="${imgOnError}">
        </div>
        <div class="sc-review-info">
          <p class="sc-review-code">${code}</p>
          <p class="sc-review-name">${String(item.item_name || "-")}</p>
          <p class="sc-review-meta">Qty: ${qty} • Unit: ${formatCurrency(price)}</p>
        </div>
        <div class="sc-review-subtotal">${formatCurrency(subtotal)}</div>
      </div>
    `;
  };

  const buildReviewModal = () => {
    if (reviewModal.modal) return;

    const modal = document.createElement("div");
    modal.className = "sc-order-review-modal";
    modal.setAttribute("aria-hidden", "true");
    modal.innerHTML = `
      <div class="sc-order-review-panel" role="dialog" aria-modal="true" aria-label="Order summary">
        <div class="sc-order-review-header">
          <h3>Order summary</h3>
          <button type="button" class="sc-order-review-close" aria-label="Close summary">
            <span aria-hidden="true">&times;</span>
          </button>
        </div>
        <div class="sc-order-review-list"></div>
        <div class="sc-order-review-total">
          <span>Total</span>
          <strong class="sc-order-review-total-value">PHP 0.00</strong>
        </div>
        <div class="sc-order-review-actions">
          <button type="button" class="sc-order-review-cancel">Cancel</button>
          <button type="button" class="sc-order-review-confirm">Proceed to Approver</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);
    reviewModal.modal = modal;
    reviewModal.confirmBtn = modal.querySelector(".sc-order-review-confirm");
    reviewModal.cancelBtn = modal.querySelector(".sc-order-review-cancel");
    reviewModal.closeBtn = modal.querySelector(".sc-order-review-close");
    reviewModal.list = modal.querySelector(".sc-order-review-list");
    reviewModal.total = modal.querySelector(".sc-order-review-total-value");

    const close = () => closeReviewModal();
    reviewModal.cancelBtn?.addEventListener("click", close);
    reviewModal.closeBtn?.addEventListener("click", close);
    modal.addEventListener("click", (event) => {
      if (event.target === modal) closeReviewModal();
    });

    reviewModal.confirmBtn?.addEventListener("click", () => {
      if (!pendingReview) return;
      const payload = pendingReview;
      closeReviewModal();
      proceedPlaceOrder(payload);
    });

    document.addEventListener("keydown", (event) => {
      if (!reviewModal.modal?.classList.contains("is-visible")) return;
      if (event.key === "Escape") closeReviewModal();
    });
  };

  const openReviewModal = (payload) => {
    buildReviewModal();
    if (!reviewModal.modal || !reviewModal.list) return;

    pendingReview = payload;
    const items = payload.selectedItems || [];
    reviewModal.list.innerHTML = items.map(buildReviewRow).join("");
    const total = items.reduce((sum, item) => {
      const qty = Math.max(1, Number(item.qty) || 1);
      const price = Number(item.unit_price || 0);
      return sum + qty * price;
    }, 0);
    if (reviewModal.total) reviewModal.total.textContent = formatCurrency(total);

    reviewModal.modal.classList.add("is-visible");
    reviewModal.modal.setAttribute("aria-hidden", "false");
    document.body.classList.add("has-order-review-modal");
  };

  const closeReviewModal = () => {
    if (!reviewModal.modal) return;
    reviewModal.modal.classList.remove("is-visible");
    reviewModal.modal.setAttribute("aria-hidden", "true");
    document.body.classList.remove("has-order-review-modal");
    pendingReview = null;
  };

  const proceedPlaceOrder = async (payload) => {
    const storeId = getActiveStoreId();
    if (!storeId) {
      alert("Your account is not linked to a store in Supabase. Please register your store to place orders.");
      window.location.href = "sc-register.html";
      return;
    }

    if (typeof supabaseClient === "undefined") {
      alert("Ordering service unavailable (Supabase client missing).");
      return;
    }

    pendingOrder = { storeId, ...payload };
    openApproverModal();
  };

  const placeOrder = async () => {
    const payload = buildSelectedItems();
    if (!payload) return;
    openReviewModal(payload);
  };

  const submitApprovedOrder = async () => {
    if (!pendingOrder) return;
    if (typeof supabaseClient === "undefined") {
      setApproverMessage("Ordering service unavailable (Supabase client missing).", "error");
      return;
    }

    const username = String(approverEls.username?.value || "").trim().toLowerCase();
    const password = String(approverEls.password?.value || "");

    if (!username || !password) {
      setApproverMessage("Please enter approver username and password.", "error");
      return;
    }

    approverEls.submitBtn && (approverEls.submitBtn.disabled = true);
    setApproverMessage("Verifying approver...", "");

    try {
      const itemsPayload = Array.isArray(pendingOrder?.selectedItems) ? pendingOrder.selectedItems : [];
      if (!itemsPayload.length) {
        setApproverMessage("No items selected for this order.", "error");
        return;
      }

      const rpcClient = typeof supabaseClient?.schema === "function" ? supabaseClient.schema("public") : supabaseClient;
      console.log("Placing order with store_id:", pendingOrder.storeId);
      console.log("Order items:", itemsPayload);
      const { data, error } = await rpcClient.rpc("place_sc_order_gemini", {
        p_store_id: pendingOrder.storeId,
        p_items: itemsPayload,
        p_approver_username: username,
        p_approver_password: password
      });

      console.log("RPC result:", { data, error });

      if (error) {
        const dbErrorMessage = error.message || "Invalid approver credentials.";
        const dbErrorDetails = error.details ? ` Details: ${error.details}` : "";
        setApproverMessage(`${dbErrorMessage}${dbErrorDetails}`, "error");
        return;
      }

      const orderId = Array.isArray(data) ? data[0]?.order_id : data?.order_id;
      if (!orderId) {
        setApproverMessage("Order approved but no order ID returned.", "error");
        return;
      }

      pendingOrder.selectedCodes.forEach((code) => {
        delete pendingOrder.cart.items[code];
      });
      saveCart(pendingOrder.cart);
      pendingOrder = null;

      setApproverMessage("Approved! Placing order...", "success");
      closeApproverModal();
      window.location.href = "sc-orders.html";
    } catch (err) {
      console.error(err);
      setApproverMessage(err?.message || "Something went wrong while placing the order.", "error");
    } finally {
      approverEls.submitBtn && (approverEls.submitBtn.disabled = false);
    }
  };

  approverEls.form?.addEventListener("submit", async (e) => {
    e.preventDefault();
    await submitApprovedOrder();
  });

  approverEls.closeBtn?.addEventListener("click", closeApproverModal);
  approverEls.cancelBtn?.addEventListener("click", () => {
    pendingOrder = null;
    closeApproverModal();
  });

  approverEls.modal?.addEventListener("click", (e) => {
    if (e.target === approverEls.modal) {
      pendingOrder = null;
      closeApproverModal();
    }
  });

  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    if (!approverEls.modal?.classList.contains("is-visible")) return;
    pendingOrder = null;
    closeApproverModal();
  });

  els.selectAll?.addEventListener("change", () => {
    const checked = Boolean(els.selectAll?.checked);
    Array.from(document.querySelectorAll('input.cart-select[type="checkbox"]')).forEach((input) => {
      input.checked = checked;
    });
    recomputeSummary();
  });

  els.removeSelectedBtn?.addEventListener("click", removeSelected);
  els.clearCartBtn?.addEventListener("click", openClearModal);
  els.placeOrderBtn?.addEventListener("click", placeOrder);

  render();
})();
