(() => {
  const nameEl = document.getElementById("scHeaderStoreName");
  if (nameEl) {
    let user = null;
    try {
      user = JSON.parse(localStorage.getItem("scUser") || "null");
    } catch {
      user = null;
    }

    const storeName =
      user?.storeName ||
      user?.store_name ||
      user?.store ||
      user?.name ||
      "";

    nameEl.textContent = String(storeName || "Guest");
  }

  const badgeEl = document.getElementById("cartBadge");
  const ordersBadgeEl = document.getElementById("ordersBadge");

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

  const getCartItemCount = () => {
    try {
      const key = getCartStorageKey();
      const raw = localStorage.getItem(key);
      const parsed = raw ? JSON.parse(raw) : null;
      if (!parsed || typeof parsed.items !== "object") return 0;
      return Object.keys(parsed.items).length;
    } catch {
      return 0;
    }
  };

  const updateCartBadge = () => {
    if (!badgeEl) return;
    const count = getCartItemCount();
    badgeEl.textContent = String(count);
    badgeEl.classList.toggle("is-visible", count > 0);
  };

  const updateOrdersBadge = async () => {
    if (!ordersBadgeEl) return;
    
    const user = getScUser();
    if (!user || !user.store_id) return;
    if (typeof supabaseClient === "undefined") return;

    try {
      const { count, error } = await supabaseClient
        .from("sc_orders")
        .select("*", { count: "exact", head: true })
        .eq("store_id", user.store_id)
        .in("status", ["Pending", "Processing"]);

      if (!error && count !== null) {
        ordersBadgeEl.textContent = String(count);
        ordersBadgeEl.classList.toggle("is-visible", count > 0);
      }
    } catch (err) {
      console.error("Error updating orders badge:", err);
    }
  };

  window.scHeader = { updateCartBadge, updateOrdersBadge };
  updateCartBadge();
  updateOrdersBadge();

  const relocateStoreBadge = () => {
    const storeEl = document.querySelector(".sc-header-store");
    if (!storeEl) return;

    let footer = document.querySelector(".sc-mobile-footer");
    if (!footer) {
      footer = document.createElement("footer");
      footer.className = "sc-mobile-footer";
      document.body.appendChild(footer);
    }
    footer.appendChild(storeEl);
    storeEl.classList.add("sc-footer-store");
  };

  relocateStoreBadge();

  // Guest Restrictions: Hide Dashboard, Cart, Orders
  const scUser = getScUser();
  if (scUser?.isGuest) {
    const restrictedLinks = document.querySelectorAll('nav.sc-products-nav a[href="sc-dashboard.html"], nav.sc-products-nav a[href="sc-cart.html"], nav.sc-products-nav a[href="sc-orders.html"]');
    restrictedLinks.forEach(el => el.style.display = 'none');
  }
})();
