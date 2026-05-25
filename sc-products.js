(() => {
  const defaultR2BaseUrl = "https://pub-431a1eccf270455a99eab6163255ef53.r2.dev";
  const r2BaseUrl = window.scUtils?.r2BaseUrl || defaultR2BaseUrl;
  const placeholderImage = window.scUtils?.placeholderImage || `${r2BaseUrl}/empty-product.svg`;
  const r2ImageFiles = ["IMG_0001.png", "IMG_0002.png", "IMG_0003.png", "IMG_0004.png"];
  const cartToast = document.getElementById("cartToast");
  let cartToastTimer = null;

  const getScUser = () => {
    try {
      return JSON.parse(localStorage.getItem("scUser") || "null");
    } catch {
      return null;
    }
  };

  const scUser = getScUser();
  if (!scUser) {
    window.location.href = "index.html";
    return;
  }

  if (scUser?.isGuest) {
    const notice = document.getElementById("guestNotice");
    if (notice) notice.style.display = "block";
  }

  const fallbackProducts = [
    {
      id: 1,
      product_code: "BP0003",
      product_name: "Vintage Headlight Set",
      description: "Polished chrome rim keeps a classic glow while modern glass protects the bulb.",
      category: "Lighting",
      brand: "Golden Era",
      price: 4650,
      stock: 12,
      uom: "pair"
    },
    {
      id: 2,
      product_code: "BP0015",
      product_name: "Brake Caliper Assembly",
      description: "Restored assembly with OEM-style seals and powder-coated finish.",
      category: "Brake and clutch",
      brand: "GEM Performance",
      price: 14200,
      stock: 6,
      uom: "set"
    },
    {
      id: 3,
      product_code: "BP0047",
      product_name: "Chromed Grille Kit",
      description: "Fits iconic models with a mirrored finish that resists weathering.",
      category: "Body and interior",
      brand: "EraCraft",
      price: 9600,
      stock: 9,
      uom: "kit"
    }
  ];

  const productListEl = document.getElementById("product-list");
  const loaderEl = document.getElementById("productListLoader");
  const productsBadgeEl = document.getElementById("productsBadge");
  const paginationEl = document.getElementById("productPagination");
  const paginationInfoEl = document.getElementById("paginationInfo");
  const pageSizeSelect = document.getElementById("pageSizeSelect");
  const prevPageBtn = document.getElementById("prevPageBtn");
  const nextPageBtn = document.getElementById("nextPageBtn");
  const viewCatalogBtn = document.getElementById("viewCatalogBtn");
  const catalogModal = document.getElementById("scCatalogModal");
  const catalogBody = document.getElementById("catalogBody");
  const catalogCloseBtn = document.getElementById("catalogCloseBtn");
  const catalogDownloadBtn = document.getElementById("catalogDownloadBtn");
  const catalogPrintBtn = document.getElementById("catalogPrintBtn");
  const catalogLoader = document.getElementById("catalogLoader");
  const catalogLoaderText = document.getElementById("catalogLoaderText");
  const catalogLoaderBar = document.getElementById("catalogLoaderBar");
  const catalogCancelBtn = document.getElementById("catalogCancelBtn");
  const catalogFooterActions = document.getElementById("catalogFooterActions");
  let isPdfCancelled = false;

  const setBadge = (loadedCount, totalCount = null) => {
    if (!productsBadgeEl) return;
    const base = "Loaded Items";
    if (typeof loadedCount !== "number") {
      productsBadgeEl.textContent = base;
      return;
    }
    if (typeof totalCount === "number" && totalCount >= 0 && totalCount !== loadedCount) {
      productsBadgeEl.textContent = `${base} | ${loadedCount}/${totalCount}`;
      return;
    }
    productsBadgeEl.textContent = `${base} | ${loadedCount}`;
  };

  const hideLoader = () => {
    if (!loaderEl) return;
    loaderEl.classList.add("is-hidden");
  };

  const showLoader = (text) => {
    if (!loaderEl) return;
    const label = loaderEl.querySelector("span:last-child");
    if (label) label.textContent = text;
    loaderEl.classList.remove("is-hidden");
  };

  const showCatalogLoader = (text, percent = 0) => {
    if (!catalogLoader) return;
    if (catalogFooterActions) catalogFooterActions.style.display = 'none';
    if (catalogLoaderText) catalogLoaderText.textContent = text;
    if (catalogLoaderBar) {
      catalogLoaderBar.style.width = `${Math.min(100, Math.max(0, percent))}%`;
    }
    catalogLoader.classList.remove("is-hidden");
  };

  const hideCatalogLoader = () => {
    if (!catalogLoader) return;
    if (catalogFooterActions) catalogFooterActions.style.display = 'flex';
    catalogLoader.classList.add("is-hidden");
  };

  const formatCurrency = (value) => {
    const number = Number(value);
    if (!Number.isFinite(number)) return "PHP 0.00";
    return `PHP ${number.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const getActiveStoreId = () => {
    try {
      const user = JSON.parse(localStorage.getItem("scUser") || "null");
      return String(user?.store_id || "").trim() || "guest";
    } catch {
      return "guest";
    }
  };

  const getCartStorageKey = () => `scCart:${getActiveStoreId()}`;

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

  const addToCart = (product, qty = 1) => {
    const itemCode = String(product?.product_code || product?.ItemCode || product?.id || "").trim();
    if (!itemCode) return;

    const cart = loadCart();
    const current = cart.items[itemCode] || {};
    const nextQty = Math.max(1, Number(current.qty || 0) + Number(qty || 0));

    cart.items[itemCode] = {
      item_code: itemCode,
      item_name: String(product?.product_name || product?.FullDescription || "").trim(),
      brand: String(product?.brand || product?.Brand || "").trim(),
      price: product?.price == null ? null : Number(product.price),
      qty: nextQty,
      added_at: current.added_at || new Date().toISOString()
    };

    saveCart(cart);
    if (window.scHeader?.updateCartBadge) {
      window.scHeader.updateCartBadge();
    }
  };

  const showCartToast = (product, qty = 1) => {
    if (!cartToast) return;
    const name = String(product?.product_name || product?.FullDescription || product?.product_code || "").trim();
    const count = Number(qty) > 1 ? ` x${qty}` : "";
    const label = name ? `${name}${count} added to cart.` : `Added to cart${count}.`;
    cartToast.textContent = label;
    cartToast.classList.add("is-visible");
    if (cartToastTimer) {
      clearTimeout(cartToastTimer);
    }
    cartToastTimer = setTimeout(() => {
      cartToast.classList.remove("is-visible");
    }, 1800);
  };

  const popCartButton = (button) => {
    if (!button) return;
    button.classList.remove("is-popping");
    // Force reflow so animation restarts on repeated clicks.
    void button.offsetWidth;
    button.classList.add("is-popping");
    window.setTimeout(() => button.classList.remove("is-popping"), 400);
  };

  const setConfirmQtyValue = (value) => {
    const raw = Number(value);
    let qty = Number.isFinite(raw) ? raw : 1;
    qty = Math.max(1, Math.floor(qty));
    if (confirmMaxQty != null && Number.isFinite(confirmMaxQty)) {
      qty = Math.min(qty, confirmMaxQty);
    }
    if (confirmQtyInput) confirmQtyInput.value = String(qty);
    return qty;
  };

  const openConfirmModal = (product, imageSrc) => {
    if (scUser?.isGuest) {
      if (confirm("You are browsing as a Guest. To add items to your cart, please register or log in.\n\nGo to registration now?")) {
        window.location.href = "sc-register.html";
      }
      return;
    }

    if (!confirmModal || !product) {
      addToCart(product, 1);
      showCartToast(product, 1);
      return;
    }

    confirmProduct = product;
    confirmImageSrc = imageSrc || "";
    confirmMaxQty = Number.isFinite(Number(product?.stock)) ? Math.max(1, Number(product.stock)) : null;

    if (confirmImage) {
      const fileNameFromSrc = (() => {
        if (!confirmImageSrc) return "";
        try {
          const url = new URL(confirmImageSrc, window.location.href);
          const last = url.pathname.split("/").pop();
          return String(last || "").trim();
        } catch {
          return "";
        }
      })();

      const fileName = fileNameFromSrc || r2ImageFiles[0] || "IMG_0001.png";
      const candidates = [confirmImageSrc, ...buildProductImageCandidates(product.product_code, fileName)];
      const uniqueCandidates = Array.from(new Set(candidates.filter(Boolean)));

      confirmImage.alt = `${product.product_name || "Product"} image`;
      setImgSrcWithFallback(confirmImage, uniqueCandidates);
    }

    if (confirmCode) confirmCode.textContent = product.product_code || product.id || "";
    if (confirmName) confirmName.textContent = product.product_name || product.FullDescription || "Product";
    if (confirmBrand) {
      const brandText = String(product.brand || product.Brand || "").trim();
      confirmBrand.textContent = brandText ? `Brand: ${brandText}` : "";
    }
    if (confirmPrice) confirmPrice.textContent = formatCurrency(product.price);
    if (confirmDesc) confirmDesc.textContent = product.description || "";
    if (confirmStock) {
      confirmStock.textContent = confirmMaxQty ? `Available: ${formatNumber(confirmMaxQty)}` : "";
    }

    if (confirmQtyInput) {
      if (confirmMaxQty != null && Number.isFinite(confirmMaxQty)) {
        confirmQtyInput.max = String(confirmMaxQty);
      } else {
        confirmQtyInput.removeAttribute("max");
      }
    }

    setConfirmQtyValue(1);

    confirmModal.classList.add("is-visible");
    confirmModal.setAttribute("aria-hidden", "false");
    document.body.classList.add("has-confirm-modal");
  };

  const closeConfirmModal = () => {
    if (!confirmModal) return;
    confirmModal.classList.remove("is-visible");
    confirmModal.setAttribute("aria-hidden", "true");
    document.body.classList.remove("has-confirm-modal");
    confirmProduct = null;
    confirmImageSrc = "";
    confirmMaxQty = null;
  };

  const flyToCart = (sourceEl) => {
    if (!sourceEl || !cartNavLink) return;

    const start = sourceEl.getBoundingClientRect();
    const end = cartNavLink.getBoundingClientRect();
    const clone = sourceEl.cloneNode(true);

    clone.style.position = "fixed";
    clone.style.left = `${start.left}px`;
    clone.style.top = `${start.top}px`;
    clone.style.width = `${start.width}px`;
    clone.style.height = `${start.height}px`;
    clone.style.objectFit = "contain";
    clone.style.borderRadius = "12px";
    clone.style.pointerEvents = "none";
    clone.style.transition = "transform 0.6s ease, opacity 0.6s ease";
    clone.style.zIndex = "9999";

    document.body.appendChild(clone);

    const dx = end.left + end.width / 2 - (start.left + start.width / 2);
    const dy = end.top + end.height / 2 - (start.top + start.height / 2);

    requestAnimationFrame(() => {
      clone.style.transform = `translate(${dx}px, ${dy}px) scale(0.2)`;
      clone.style.opacity = "0.2";
    });

    clone.addEventListener(
      "transitionend",
      () => {
        clone.remove();
      },
      { once: true }
    );

    cartNavLink.classList.remove("is-cart-bounce");
    void cartNavLink.offsetWidth;
    cartNavLink.classList.add("is-cart-bounce");
  };

  const pickFirst = (row, keys) => {
    for (const key of keys) {
      if (row && Object.prototype.hasOwnProperty.call(row, key) && row[key] != null && row[key] !== "") {
        return row[key];
      }
    }
    return null;
  };

  const normalizeRow = (row) => {
    const productCode =
      pickFirst(row, [
        "product_code",
        "ProductCode",
        "productcode",
        "item_code",
        "ItemCode",
        "itemcode",
        "sku",
        "SKU",
        "code",
        "Code"
      ]) || "";

    const productName =
      pickFirst(row, [
        "product_name",
        "ProductName",
        "productname",
        "FullDescription",
        "full_description",
        "fullDescription",
        "item_name",
        "ItemName",
        "itemname",
        "name",
        "Name"
      ]) || "";

    const remarks = pickFirst(row, ["Remarks", "remarks"]) || "";

    const description =
      pickFirst(row, [
        "description",
        "Description",
        "product_description",
        "ProductDescription",
        "item_description",
        "ItemDescription"
      ]) ||
      "";

    const category = pickFirst(row, ["category", "Category", "category_name", "CategoryName", "cat", "Cat"]) || "";
    const brand = pickFirst(row, ["brand", "Brand", "brand_name", "BrandName", "manufacturer", "Manufacturer"]) || "";
    const condition = pickFirst(row, ["condition", "Condition", "item_condition", "ItemCondition", "itemCondition"]) || remarks || "";
    const status = pickFirst(row, ["status", "Status", "item_status", "ItemStatus", "itemStatus"]) || "";
    const uom = pickFirst(row, ["uom", "UOM", "unit", "Unit", "unit_of_measure", "UnitOfMeasure"]) || "";
    const costRaw = pickFirst(row, ["cost", "Cost"]);
    const srpRaw = pickFirst(row, ["srp", "SRP", "selling_price", "SellingPrice", "price", "Price", "unit_price", "UnitPrice"]);
    const stockRaw = pickFirst(row, ["stock", "Stock", "qty", "Qty", "quantity", "Quantity", "on_hand", "OnHand", "available_qty", "AvailableQty"]);

    const normalized = {
      ...row,
      id: row?.id ?? productCode ?? row?.product_id ?? row?.ProductId,
      product_code: String(productCode || row?.id || "").trim(),
      product_name: String(productName || "").trim(),
      description: String(description || "").trim(),
      category: String(category || "").trim(),
      brand: String(brand || "").trim(),
      condition: String(condition || "").trim(),
      remarks: String(remarks || "").trim(),
      status: String(status || "").trim(),
      uom: String(uom || "").trim(),
      cost: costRaw == null ? null : Number(costRaw),
      price: srpRaw == null ? null : Number(srpRaw),
      stock: stockRaw == null ? null : Number(stockRaw)
    };

    return normalized;
  };

  const buildFolderGallery = (productCode) => {
    if (!productCode) return [placeholderImage];
    const safeCode = encodeURIComponent(String(productCode).trim());
    if (!safeCode) return [placeholderImage];
    return r2ImageFiles.map((file) => `${r2BaseUrl}/${safeCode}/${file}`);
  };

  const buildProductImageCandidates = (productCode, fileName) => {
    const safeCode = encodeURIComponent(String(productCode || "").trim());
    const safeFile = String(fileName || "").trim();
    if (!safeCode || !safeFile) return [placeholderImage];

    const normalizedFile = safeFile.replace(/^\/+/, "");
    const extMatch = normalizedFile.match(/\.([^.]+)$/);
    const baseName = extMatch ? normalizedFile.slice(0, -extMatch[0].length) : normalizedFile;
    const originalExt = extMatch ? extMatch[1].toLowerCase() : "png";

    // Prioritize extensions to reduce 404s and use efficient formats first
    const preferredExtensionsOrder = ["webp", "png", "jpg", "jpeg"];
    const uniqueExtensions = new Set();

    // Add the original extension first, if it's not already in the preferred list
    if (originalExt && !preferredExtensionsOrder.includes(originalExt)) {
      uniqueExtensions.add(originalExt);
    }
    // Add preferred extensions in their priority order
    for (const ext of preferredExtensionsOrder) {
      uniqueExtensions.add(ext);
    }
    const extensions = Array.from(uniqueExtensions);

    const candidates = [];
    for (const ext of extensions) {
      const file = `${baseName}.${ext}`;
      candidates.push(`${r2BaseUrl}/${safeCode}/${file}`);
      candidates.push(`${r2BaseUrl}/product-images/${safeCode}/${file}`);
      candidates.push(`product-images/${safeCode}/${file}`);
    }
    candidates.push(placeholderImage);

    return candidates.filter(Boolean);
  };

  const buildThumbnailImageCandidates = (productCode) => {
    const safeCode = String(productCode || "").trim();
    if (!safeCode) return [placeholderImage];

    const candidates = [];
    for (const fileName of r2ImageFiles) {
      candidates.push(...buildProductImageCandidates(safeCode, fileName));
    }

    const unique = Array.from(new Set(candidates));
    if (!unique.length) return [placeholderImage];
    return unique;
  };

  const setImgSrcWithFallback = (imgEl, candidates) => {
    if (!imgEl) return;
    const urls = (Array.isArray(candidates) ? candidates : []).filter(Boolean);
    const list = urls.length ? urls : [placeholderImage];
    let index = 0;
    let timer = null;
    const timeoutMs = 2500;

    const clearTimer = () => {
      if (timer == null) return;
      window.clearTimeout(timer);
      timer = null;
    };

    const setSrc = (nextIndex) => {
      index = nextIndex;
      clearTimer();
      imgEl.src = list[index];

      if (timeoutMs > 0 && index < list.length - 1) {
        timer = window.setTimeout(() => {
          // If the image still hasn't loaded, step to the next candidate.
          if (imgEl.complete && imgEl.naturalWidth > 0) return;
          console.warn(`Image load timeout for: ${list[index]}. Trying next...`);
          if (index >= list.length - 1) return;
          setSrc(index + 1);
        }, timeoutMs);
      }
    };

    imgEl.onload = () => clearTimer();
    imgEl.onload = () => {
      clearTimer();
      if (index > 0) {
        console.log(`Successfully loaded fallback image #${index}: ${list[index]}`);
      }
    };
    imgEl.onerror = () => {
      console.warn(`Failed to load image candidate #${index}: ${list[index]}`);
      if (index >= list.length - 1) return;
      setSrc(index + 1);
    };

    setSrc(0);
  };

  const getGalleryImages = (product) => {
    return buildFolderGallery(product.product_code);
  };

  const modal = document.getElementById("scProductModal");
  const modalTitle = document.getElementById("modalProductTitle");
  const modalMainImage = document.getElementById("modalMainImage");
  const modalThumbs = document.getElementById("modalThumbs");
  const modalImageContainer = document.getElementById("modalImageContainer");
  const modalPrevBtn = document.getElementById("modalPrevBtn");
  const modalNextBtn = document.getElementById("modalNextBtn");
  const closeButton = document.getElementById("modalCloseBtn");
  const modalDetailsSubtitle = document.getElementById("modalItemDetailsSubtitle");
  const modalDetailsGrid = document.getElementById("modalItemDetails");
  const modalAddToCartBtn = document.getElementById("modalAddToCartBtn");
  const confirmModal = document.getElementById("scConfirmModal");
  const confirmImage = document.getElementById("confirmImage");
  const confirmCode = document.getElementById("confirmCode");
  const confirmName = document.getElementById("confirmName");
  const confirmBrand = document.getElementById("confirmBrand");
  const confirmPrice = document.getElementById("confirmPrice");
  const confirmDesc = document.getElementById("confirmDesc");
  const confirmStock = document.getElementById("confirmStock");
  const confirmQtyInput = document.getElementById("confirmQty");
  const confirmMinusBtn = document.getElementById("qtyMinus");
  const confirmPlusBtn = document.getElementById("qtyPlus");
  const confirmAddBtn = document.getElementById("confirmAddBtn");
  const confirmCancelBtn = document.getElementById("confirmCancelBtn");
  const confirmCloseBtn = document.getElementById("confirmCloseBtn");
  const cartNavLink = document.querySelector('.sc-products-nav a[href="sc-cart.html"]');

  let activeGallery = [];
  let activeIndex = 0;
  let activeItemCode = "";
  let activeProduct = null;
  let confirmProduct = null;
  let confirmImageSrc = "";
  let confirmMaxQty = null;
  let currentZoom = 1;
  const maxZoom = 3;
  let panX = 0;
  let panY = 0;
  let isPanning = false;
  let panStartX = 0;
  let panStartY = 0;
  const detailsCache = new Map();
  const optLabelCache = new Map();

  if (modalMainImage) {
    // Image fallback is handled by `setImgSrcWithFallback` in `displayModalImage`.
  }

  const setModalDetailsSubtitle = (text) => {
    if (!modalDetailsSubtitle) return;
    modalDetailsSubtitle.textContent = String(text || "");
  };

  const clearModalDetails = () => {
    if (!modalDetailsGrid) return;
    modalDetailsGrid.innerHTML = "";
  };

  const renderModalDetailsRows = (rows) => {
    if (!modalDetailsGrid) return;
    modalDetailsGrid.innerHTML = "";

    const safeRows = Array.isArray(rows) ? rows : [];
    if (!safeRows.length) return;

    for (const row of safeRows) {
      const item = document.createElement("div");
      item.className = "modal-detail";

      const label = document.createElement("div");
      label.className = "modal-detail-label";
      label.textContent = row.label;

      const value = document.createElement("div");
      value.className = "modal-detail-value";
      value.textContent = row.value;

      item.appendChild(label);
      item.appendChild(value);
      modalDetailsGrid.appendChild(item);
    }
  };

  const formatNumber = (value) => {
    const number = Number(value);
    if (!Number.isFinite(number)) return null;
    return number.toLocaleString("en-PH");
  };

  const resolveOptLabelFromId = async ({ tables, idColumns, labelColumns }, value) => {
    const raw = value == null ? "" : String(value).trim();
    if (!raw) return "";

    const isId = /^\d+$/.test(raw);
    if (!isId) return raw;
    if (!supabaseHeaders) return raw;

    const cacheKey = `${tables[0]}:${raw}`;
    if (optLabelCache.has(cacheKey)) return optLabelCache.get(cacheKey);

    for (const table of tables) {
      for (const idColumn of idColumns) {
        const endpoint = `${baseUrl}/rest/v1/${table}?select=*&${encodeURIComponent(idColumn)}=eq.${encodeURIComponent(raw)}&limit=1`;
        // eslint-disable-next-line no-await-in-loop
        const response = await fetch(endpoint, { headers: supabaseHeaders });
        if (!response.ok) continue;
        // eslint-disable-next-line no-await-in-loop
        const data = await response.json();
        if (!Array.isArray(data) || !data.length) continue;
        const row = data[0];
        const label = pickFirst(row, labelColumns) ?? raw;
        const normalized = String(label || raw).trim() || raw;
        optLabelCache.set(cacheKey, normalized);
        return normalized;
      }
    }

    optLabelCache.set(cacheKey, raw);
    return raw;
  };

  const buildCategoryConditionStatusSubtitle = async (details) => {
    const categoryValue = pickFirst(details, ["CategoryID", "CategoryId", "category_id", "Category", "category"]);
    const conditionValue = pickFirst(details, ["ConditionID", "ConditionId", "condition_id", "Condition", "condition"]);
    const statusValue = pickFirst(details, ["StatusID", "StatusId", "status_id", "Status", "status"]);

    const categoryLabel = await resolveOptLabelFromId(
      {
        tables: ["OPT_Categories", "opt_categories"],
        idColumns: ["CategoryID", "CategoryId", "category_id", "ID", "id"],
        labelColumns: ["Category", "category", "Name", "name", "Label", "label"]
      },
      categoryValue
    );

    const conditionLabel = await resolveOptLabelFromId(
      {
        tables: ["OPT_Condition", "opt_condition"],
        idColumns: ["ConditionID", "ConditionId", "condition_id", "ID", "id"],
        labelColumns: ["Condition", "condition", "Name", "name", "Label", "label"]
      },
      conditionValue
    );

    const statusLabel = await resolveOptLabelFromId(
      {
        tables: ["OPT_Status", "opt_status"],
        idColumns: ["StatusID", "StatusId", "status_id", "ID", "id"],
        labelColumns: ["Status", "status", "Name", "name", "Label", "label"]
      },
      statusValue
    );

    const parts = [];
    if (categoryLabel) parts.push(`Category: ${categoryLabel}`);
    if (conditionLabel) parts.push(`Condition: ${conditionLabel}`);
    if (statusLabel) parts.push(`Status: ${statusLabel}`);
    return parts.join(" • ");
  };

  const buildModalDetailRows = async (details) => {
    const pick = (keys) => pickFirst(details, keys);

    const itemCode = pick(["ItemCode", "item_code", "product_code", "ProductCode"]) || "";
    const fullDescription =
      pick([
        "Description",
        "description",
        "product_description",
        "ProductDescription",
        "ItemDescription",
        "item_description",
        "product_name",
        "ProductName",
        "productname",
        "name",
        "FullDescription",
        "full_description",
        "fullDescription"
      ]) || "";

    const brand = pick(["Brand", "brand", "BrandName", "brand_name"]) || "";
    const remarks = pick(["Remarks", "remarks", "description"]) || "";

    const partNum = pick(["PartNum", "PartNo", "PartNumber", "part_num", "part_no"]) || "";
    const oem = pick(["OEM", "OEMNum", "OEMNo", "oem_num", "oem_no", "oem"]) || "";
    const maker = pick(["Maker", "Make", "maker", "make"]) || "";
    const model = pick(["Model", "model"]) || "";
    const yearModel = pick(["YearModel", "Year", "year_model", "year"]) || "";
    const typePosition = pick(["Type", "TypePosition", "Position", "type_position", "position", "type"]) || "";
    const spec = pick(["Spec", "spec", "Size", "size", "Color", "color"]) || "";

    const modelYear = [String(model || "").trim(), String(yearModel || "").trim()].filter(Boolean).join(" ");

    const categoryValue = pick(["CategoryID", "CategoryId", "category_id", "Category", "category"]);
    const conditionValue = pick(["ConditionID", "ConditionId", "condition_id", "Condition", "condition"]);
    const statusValue = pick(["StatusID", "StatusId", "status_id", "Status", "status"]);

    const categoryLabel = await resolveOptLabelFromId(
      {
        tables: ["OPT_Categories", "opt_categories"],
        idColumns: ["CategoryID", "CategoryId", "category_id", "ID", "id"],
        labelColumns: ["Category", "category", "Name", "name", "Label", "label"]
      },
      categoryValue
    );

    const conditionLabel = await resolveOptLabelFromId(
      {
        tables: ["OPT_Condition", "opt_condition"],
        idColumns: ["ConditionID", "ConditionId", "condition_id", "ID", "id"],
        labelColumns: ["Condition", "condition", "Name", "name", "Label", "label"]
      },
      conditionValue
    );

    const statusLabel = await resolveOptLabelFromId(
      {
        tables: ["OPT_Status", "opt_status"],
        idColumns: ["StatusID", "StatusId", "status_id", "ID", "id"],
        labelColumns: ["Status", "status", "Name", "name", "Label", "label"]
      },
      statusValue
    );

    const remarksText = String(remarks || "").trim();
    const conditionText = String(conditionLabel || "").trim();
    const remarksCondition =
      remarksText && conditionText ? `${remarksText} | ${conditionText}` : remarksText || conditionText || "";

    const rows = [
      { label: "Item Code", value: itemCode },
      { label: "Category", value: categoryLabel },
      { label: "Item Name", value: fullDescription },
      { label: "Brand", value: brand },
      { label: "Part #", value: partNum },
      { label: "OEM", value: oem },
      { label: "Make", value: maker },
      { label: "Model & Year", value: modelYear },
      { label: "Type / Position", value: typePosition },
      { label: "Size / Color", value: spec },
      { label: "Status", value: statusLabel },
      { label: "Condition", value: remarksCondition }
    ]
      .map((row) => ({ ...row, value: String(row.value || "").trim() }))
      .filter((row) => row.value !== "");

    return rows.length ? rows : [{ label: "Info", value: "No item details available." }];
  };

  const displayModalImage = () => {
    if (!modalMainImage) return;
    resetZoom();
    modalMainImage.alt = `Product view ${activeIndex + 1}`;

    if (activeItemCode && activeGallery.length === r2ImageFiles.length) {
      const fileName = r2ImageFiles[activeIndex] || r2ImageFiles[0] || "IMG_0001.png";
      setImgSrcWithFallback(modalMainImage, buildProductImageCandidates(activeItemCode, fileName));
    } else {
      const src = activeGallery[activeIndex] || placeholderImage;
      setImgSrcWithFallback(modalMainImage, [src, placeholderImage]);
    }

    if (modalThumbs) {
      Array.from(modalThumbs.children).forEach((thumb, index) => {
        thumb.classList.toggle("is-active", index === activeIndex);
      });
    }
  };

  const renderModalThumbs = () => {
    if (!modalThumbs) return;
    modalThumbs.innerHTML = "";
    const thumbCount = Math.min(activeGallery.length, r2ImageFiles.length);
    for (let index = 0; index < thumbCount; index += 1) {
      const thumb = document.createElement("button");
      thumb.type = "button";
      thumb.className = "modal-thumb";
      thumb.dataset.index = String(index);

      const img = document.createElement("img");
      img.alt = `Gallery thumb ${index + 1}`;
      img.loading = "lazy";
      const fileName = r2ImageFiles[index] || r2ImageFiles[0] || "IMG_0001.png";
      setImgSrcWithFallback(img, buildProductImageCandidates(activeItemCode, fileName));

      thumb.appendChild(img);
      thumb.addEventListener("click", () => {
        activeIndex = index;
        displayModalImage();
      });
      modalThumbs.appendChild(thumb);
    }
  };

  const openGallery = (product, galleryImages) => {
    if (!modal) return;
    activeGallery = galleryImages.length ? galleryImages : [placeholderImage];
    activeIndex = 0;
    activeItemCode = String(product?.product_code || product?.id || "").trim();
    activeProduct = product || null;
    if (modalTitle) {
      const code = String(product.product_code || "").trim();
      modalTitle.textContent = code ? `Product gallery - ${code}` : "Product gallery";
    }

    clearModalDetails();
    if (activeItemCode) {
      setModalDetailsSubtitle(`Loading details for ${activeItemCode}...`);
    } else {
      setModalDetailsSubtitle("Item code unavailable.");
    }

    renderModalThumbs();
    displayModalImage();
    modal.classList.add("is-visible");
    modal.setAttribute("aria-hidden", "false");
    document.body.classList.add("has-modal");

    (async () => {
      const requestedItemCode = activeItemCode;
      if (!requestedItemCode || !modalDetailsGrid) return;
      if (detailsCache.has(requestedItemCode)) {
        const cached = detailsCache.get(requestedItemCode);
        setModalDetailsSubtitle("");
        // eslint-disable-next-line no-await-in-loop
        const rows = await buildModalDetailRows(cached);
        renderModalDetailsRows(rows);
        return;
      }

      if (!supabaseHeaders) {
        setModalDetailsSubtitle("Supabase config missing (details unavailable).");
        const rows = await buildModalDetailRows(product);
        renderModalDetailsRows(rows);
        return;
      }

      const fetchBy = async (table, column) => {
        const endpoint = `${baseUrl}/rest/v1/${table}?select=*&${encodeURIComponent(column)}=eq.${encodeURIComponent(requestedItemCode)}&limit=1`;
        const response = await fetch(endpoint, { headers: supabaseHeaders });
        if (!response.ok) return null;
        const data = await response.json();
        if (!Array.isArray(data) || !data.length) return null;
        return data[0];
      };

      let details =
        (await fetchBy("product_vw", "ItemCode")) ||
        (await fetchBy("product_vw", "item_code"));

      if (!details) {
        details =
          (await fetchBy("products", "product_code")) ||
          (await fetchBy("products", "ItemCode")) ||
          (await fetchBy("products", "item_code"));
      }

      if (activeItemCode !== requestedItemCode) return;

      if (!details) {
        setModalDetailsSubtitle(`No row found in product_vw or products for ${requestedItemCode}.`);
        const rows = await buildModalDetailRows(product);
        renderModalDetailsRows(rows);
        return;
      }

      detailsCache.set(requestedItemCode, details);
      setModalDetailsSubtitle("");
      const rows = await buildModalDetailRows(details);
      renderModalDetailsRows(rows);
    })();
  };

  modalAddToCartBtn?.addEventListener("click", () => {
    if (!activeProduct) return;
    const product = activeProduct;
    const src = modalMainImage?.currentSrc || modalMainImage?.src || activeGallery[activeIndex] || placeholderImage;
    closeGallery();
    openConfirmModal(product, src);
  });

  const closeGallery = () => {
    if (!modal) return;
    modal.classList.remove("is-visible");
    modal.setAttribute("aria-hidden", "true");
    document.body.classList.remove("has-modal");
    activeGallery = [];
    activeItemCode = "";
    activeProduct = null;
    clearModalDetails();
    setModalDetailsSubtitle("Select a product to view details.");
    resetZoom();
  };

  const updateImageTransform = () => {
    if (!modalMainImage) return;
    modalMainImage.style.transform = `scale(${currentZoom}) translate(${panX}px, ${panY}px)`;
  };

  const resetZoom = () => {
    currentZoom = 1;
    panX = 0;
    panY = 0;
    if (modalImageContainer) {
      modalImageContainer.classList.remove("zoomed");
    }
    updateImageTransform();
  };

  const zoomIn = () => {
    if (currentZoom >= 3) return;
    currentZoom = Math.min(currentZoom + 0.5, 3);
    if (modalImageContainer) {
      modalImageContainer.classList.add("zoomed");
    }
    updateImageTransform();
  };

  const zoomOut = () => {
    if (currentZoom <= 1) return;
    currentZoom = Math.max(currentZoom - 0.5, 1);
    if (currentZoom === 1) {
      panX = 0;
      panY = 0;
      if (modalImageContainer) {
        modalImageContainer.classList.remove("zoomed");
      }
    }
    updateImageTransform();
  };

  const zoomToggle = () => {
    if (currentZoom >= maxZoom) {
      resetZoom();
      return;
    }

    currentZoom = maxZoom;
    panX = 0;
    panY = 0;
    if (modalImageContainer) {
      modalImageContainer.classList.add("zoomed");
    }
    updateImageTransform();
  };

  const handleImageMouseDown = (event) => {
    if (currentZoom <= 1) return;
    isPanning = true;
    if (modalImageContainer) {
      modalImageContainer.classList.add("panning");
    }
    panStartX = event.clientX - panX;
    panStartY = event.clientY - panY;
  };

  const handleImageMouseMove = (event) => {
    if (!isPanning || !modalImageContainer) return;
    panX = event.clientX - panStartX;
    panY = event.clientY - panStartY;
    updateImageTransform();
  };

  const handleImageMouseUp = () => {
    isPanning = false;
    if (modalImageContainer) {
      modalImageContainer.classList.remove("panning");
    }
  };

  const handleImageWheel = (event) => {
    if (!modal?.classList.contains("is-visible")) return;
    event.preventDefault();
    if (event.deltaY < 0) {
      zoomIn();
    } else {
      zoomOut();
    }
  };

  if (modalImageContainer) {
    modalImageContainer.addEventListener("mousedown", handleImageMouseDown);
    document.addEventListener("mousemove", handleImageMouseMove);
    document.addEventListener("mouseup", handleImageMouseUp);
    modalImageContainer.addEventListener("wheel", handleImageWheel, { passive: false });
    modalImageContainer.addEventListener("dblclick", (event) => {
      event.preventDefault();
      zoomToggle();
    });
  }

  confirmMinusBtn?.addEventListener("click", () => {
    const current = Number(confirmQtyInput?.value || 1);
    setConfirmQtyValue(current - 1);
  });

  confirmPlusBtn?.addEventListener("click", () => {
    const current = Number(confirmQtyInput?.value || 1);
    setConfirmQtyValue(current + 1);
  });

  confirmQtyInput?.addEventListener("input", () => {
    setConfirmQtyValue(confirmQtyInput.value);
  });

  confirmAddBtn?.addEventListener("click", () => {
    if (!confirmProduct) return;
    const qty = setConfirmQtyValue(confirmQtyInput?.value || 1);
    addToCart(confirmProduct, qty);
    flyToCart(confirmImage);
    closeConfirmModal();
    showCartToast(confirmProduct, qty);
  });

  confirmCancelBtn?.addEventListener("click", closeConfirmModal);
  confirmCloseBtn?.addEventListener("click", closeConfirmModal);

  confirmModal?.addEventListener("click", (event) => {
    if (event.target === confirmModal) closeConfirmModal();
  });

  modalPrevBtn?.addEventListener("click", () => {
    if (!activeGallery.length) return;
    activeIndex = (activeIndex - 1 + activeGallery.length) % activeGallery.length;
    displayModalImage();
  });

  modalNextBtn?.addEventListener("click", () => {
    if (!activeGallery.length) return;
    activeIndex = (activeIndex + 1) % activeGallery.length;
    displayModalImage();
  });

  closeButton?.addEventListener("click", closeGallery);
  modal?.addEventListener("click", (event) => {
    if (event.target === modal) closeGallery();
  });

  document.addEventListener("keydown", (event) => {
    if (confirmModal?.classList.contains("is-visible")) {
      if (event.key === "Escape") closeConfirmModal();
      return;
    }
    if (!modal?.classList.contains("is-visible")) return;
    if (event.key === "Escape") closeGallery();
    if (event.key === "ArrowRight") modalNextBtn?.click();
    if (event.key === "ArrowLeft") modalPrevBtn?.click();
  });

  // Add swipe gestures for the modal gallery on mobile
  (() => {
    const swipeTarget = modalMainImage?.parentElement;
    if (!swipeTarget) return;

    let touchStartX = 0;
    let touchEndX = 0;
    const swipeThreshold = 50; // Min distance for a swipe

    const handleSwipe = () => {
      const deltaX = touchEndX - touchStartX;
      if (Math.abs(deltaX) > swipeThreshold) {
        if (deltaX < 0) {
          // Swiped left (next image)
          modalNextBtn?.click();
        } else {
          // Swiped right (previous image)
          modalPrevBtn?.click();
        }
      }
    };

    swipeTarget.addEventListener("touchstart", (e) => {
      touchStartX = e.changedTouches[0].screenX;
    }, { passive: true });

    swipeTarget.addEventListener("touchend", (e) => {
      touchEndX = e.changedTouches[0].screenX;
      handleSwipe();
    }, { passive: true });
  })();

  const openCatalogModal = () => {
    if (!catalogModal || !catalogBody) return;

    // Group products by category (matching PDF logic)
    const productsByCategory = allProducts.reduce((acc, p) => {
      const category = p.category || "Uncategorized";
      if (!acc[category]) acc[category] = [];
      acc[category].push(p);
      return acc;
    }, {});

    const sortedCategories = Object.keys(productsByCategory).sort();
    let html = "";

    sortedCategories.forEach((category) => {
      const products = productsByCategory[category];
      products.sort((a, b) => String(a.product_name || "").localeCompare(String(b.product_name || "")));
      html += `<h4 class="catalog-category-title">${category}</h4>`;
      html += `<div class="table-container catalog-table-container"><table>`;
      html += `<thead><tr>
        <th style="width: 60px;">Image</th>
        <th>Code</th>
        <th>Product Name</th>
        <th>Brand</th>
        <th>UOM</th>
        <th style="text-align: right;">Price</th>
      </tr></thead><tbody>`;

      products.forEach((p) => {
        const candidates = buildProductImageCandidates(p.product_code, r2ImageFiles[0] || "IMG_0001.png");
        const imgUrl = candidates[0] || placeholderImage;
        const imgFallback1 = candidates[1] || placeholderImage;
        const imgFallback2 = candidates[2] || placeholderImage;
        const imgFinal = candidates[candidates.length - 1] || placeholderImage;
        const imgOnError =
          candidates.length > 1
            ? `if(!this.dataset.fallback){this.dataset.fallback='1';this.src='${imgFallback1}';}else if(this.dataset.fallback==='1'){this.dataset.fallback='2';this.src='${imgFallback2}';}else{this.src='${imgFinal}';}` : `this.src='${imgFinal}';`;
        html += `<tr>
          <td style="padding: 0.75rem;"><img src="${imgUrl}" alt="" style="width: 48px; height: 48px; object-fit: contain; border-radius: 6px; background: #fff; border: 1px solid #334155;" onerror="${imgOnError}"></td>
          <td class="font-mono" style="font-family: var(--font-mono); font-size: 0.9rem; letter-spacing: 0.05em; color: var(--text-light);">${p.product_code || "-"}</td>
          <td style="font-weight: 600;">${p.product_name || "Untitled"}</td>
          <td>${p.brand || "-"}</td>
          <td>${p.uom || "unit"}</td>
          <td style="text-align: right; font-weight: 700; color: var(--primary);">${formatCurrency(p.price)}</td>
        </tr>`;
      });

      html += `</tbody></table></div>`;
    });

    catalogBody.innerHTML = html;
    catalogModal.classList.add("is-visible");
    catalogModal.setAttribute("aria-hidden", "false");
    document.body.classList.add("has-modal");
  };

  const closeCatalogModal = () => {
    if (!catalogModal) return;
    catalogModal.classList.remove("is-visible");
    catalogModal.setAttribute("aria-hidden", "true");
    document.body.classList.remove("has-modal");
  };

  if (catalogCloseBtn) catalogCloseBtn.addEventListener("click", closeCatalogModal);

  const printCatalog = () => {
    // If the modal isn't populated yet, we can't print
    if (!catalogBody) return;

    showCatalogLoader("Preparing for printing...", 0);

    // Use a timeout to allow the UI to update before the synchronous work starts
    setTimeout(() => {
      showCatalogLoader("Building print view...", 50);

      const logoUrl = `${r2BaseUrl}/logo/GoldenEraMotors.png`;
      const coverPartsUrls = Array.from({ length: 6 }, (_, i) => `${r2BaseUrl}/car-parts/IMG_000${i + 1}.png`);
      const now = new Date().toLocaleDateString();

      const printFrame = document.createElement('iframe');
      printFrame.style.position = 'absolute';
      printFrame.style.width = '0';
      printFrame.style.height = '0';
      printFrame.style.border = '0';
      printFrame.setAttribute('aria-hidden', 'true');
      document.body.appendChild(printFrame);

      const frameDoc = printFrame.contentWindow.document;
      
      const stylesheets = Array.from(document.querySelectorAll('link[rel="stylesheet"]'))
          .map(link => link.outerHTML)
          .join('');

      const content = catalogBody.innerHTML;
      const baseHref = new URL(".", window.location.href).toString();

      // Generate Table of Contents based on the rendered HTML structure
      const categoryElements = catalogBody.querySelectorAll('.catalog-category-title');
      let tocHtml = '';
      if (categoryElements.length > 0) {
        tocHtml += '<div class="print-toc"><h1>Table of Contents</h1><ul class="toc-list">';
        categoryElements.forEach((el) => {
          const title = el.textContent;
          tocHtml += `<li><span class="toc-title">${title}</span></li>`;
        });
        tocHtml += '</ul></div>';
      }

      const coverHtml = `
        <div class="print-cover">
          <div class="print-cover-content">
            <img src="${logoUrl}" class="print-logo" alt="Golden Era Auto Parts" onerror="this.onerror=null;this.src='logo/GoldenEraMotors.png';">
            <div class="print-title-group">
              <p class="print-subtitle">PREMIUM CLASSIC AUTO PARTS | ${now}</p>
              <div class="print-separator"></div>
            </div>
            <div class="print-grid">
              ${coverPartsUrls.map((url, i) => {
                const file = `IMG_000${i + 1}.png`;
                const localSrc = `car-parts/${file}`;
                return `<div class="print-grid-item"><img src="${url}" alt="Part" onerror="this.onerror=null;this.src='${localSrc}';"></div>`;
              }).join('')}
            </div>
            <div class="print-footer">
              <h3>Golden Era Auto Parts</h3>
              <p>Premium Classic Auto Parts</p>
            </div>
          </div>
        </div>
      `;

      const printContent = `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <base href="${baseHref}">
            <title>Product Catalog - Print</title>
            ${stylesheets}

            <style>
                body { 
                    background: #fff !important; 
                    color: #000 !important; 
                    font-family: "Barlow", sans-serif; 
                    margin: 0; 
                    padding: 0; 
                }

                .table-container { 
                    page-break-inside: avoid; 
                    overflow: visible !important; 
                    margin: 0 2rem; 
                }

                table { 
                    width: 100%; 
                    border-collapse: collapse; 
                    font-size: 9pt; 
                }

                th, td { 
                    border: 1px solid #ccc; 
                    padding: 6px; 
                    text-align: left; 
                }

                th { 
                    background-color: #f0f0f0 !important; 
                    color: #000 !important; 
                    position: static !important; 
                }

                /* ✅ FIX: Limit small images ONLY inside tables */
                .table-container img { 
                    max-width: 48px; 
                    max-height: 48px; 
                    object-fit: contain; 
                    border-radius: 4px; 
                    border: 1px solid #eee; 
                    background: #fff; 
                }

                .catalog-category-title { 
                    margin: 1.5rem 2rem 0.5rem; 
                    color: #000 !important; 
                    font-family: "Barlow", sans-serif; 
                    font-size: 14pt; 
                    border-left: 3px solid #666 !important; 
                    padding-left: 0.5rem; 
                    page-break-before: auto; 
                    page-break-after: avoid; 
                }

                .font-mono { 
                    font-family: "Courier New", Courier, monospace; 
                    color: #333 !important; 
                }

                td[style*="color: var(--primary)"] { color: #000 !important; }
                td[style*="color: var(--text-light)"] { color: #555 !important; }

                /* ========================= */
                /* 🔥 COVER PAGE STYLES */
                /* ========================= */

                .print-cover {
                    min-height: 95vh;
                    width: 100%;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    text-align: center;
                    page-break-after: always;
                    break-after: page;
                }

                .print-cover-content { 
                    width: 100%; 
                    max-width: 8.5in; 
                    padding: 0 1in; 
                    box-sizing: border-box; 
                }

                /* ✅ BIGGER LOGO */
                .print-logo { 
                    width: 5in; 
                    max-width: 100%;
                    height: auto; 
                    margin-bottom: 2.5rem; 
                    object-fit: contain; 
                }

                .print-title-group { 
                    margin-bottom: 3.5rem; 
                }

                .print-title-group h1 { 
                    font-size: 36pt;   /* slightly bigger */
                    font-weight: 700; 
                    margin: 0 0 10px 0; 
                    color: #D4AF37 !important; 
                    line-height: 1.1; 
                }

                .print-subtitle { 
                    font-size: 12pt; 
                    letter-spacing: 3px; 
                    color: #666 !important; 
                    text-transform: uppercase; 
                    margin: 0; 
                }

                .print-separator { 
                    width: 120px; 
                    height: 3px; 
                    background: #D4AF37 !important; 
                    margin: 25px auto 0; 
                }

                /* ✅ BIGGER IMAGE GRID */
                .print-grid { 
                    display: grid; 
                    grid-template-columns: 1fr 1fr; 
                    gap: 1in; 
                    width: 100%;
                    justify-content: center; 
                    margin-bottom: 4rem; 
                }

                .print-grid-item { 
                    border: none; 
                    display: flex; 
                    align-items: center; 
                    justify-content: center; 
                }

                .print-grid-item img { 
                    width: 100%; 
                    max-width: 3in; 
                    height: auto; 
                    object-fit: contain; 
                }

                /* ✅ FOOTER */
                .print-footer h3 { 
                    font-size: 16pt; 
                    color: #222 !important; 
                    margin: 0 0 5px 0; 
                }

                .print-footer p { 
                    font-size: 11pt; 
                    color: #888 !important; 
                    margin: 0; 
                }

                /* ========================= */
                /* 📑 TABLE OF CONTENTS */
                /* ========================= */

                .print-toc { 
                    page-break-after: always; 
                    break-after: page; 
                    padding: 2rem 4rem; 
                }

                .print-toc h1 { 
                    color: #D4AF37 !important; 
                    font-size: 24pt; 
                    margin-bottom: 2rem; 
                    border-bottom: 2px solid #eee; 
                    padding-bottom: 1rem; 
                }

                .toc-list { 
                    list-style: none; 
                    padding: 0; 
                    margin: 0; 
                }

                .toc-list li { 
                    margin-bottom: 0.8rem; 
                    border-bottom: 1px dotted #ccc; 
                    display: flex; 
                    justify-content: space-between; 
                    align-items: baseline; 
                }

                .toc-title { 
                    font-size: 12pt; 
                    font-weight: 600; 
                    background: #fff; 
                    padding-right: 5px; 
                }
              </style>
        </head>

        <body>
            ${coverHtml}
            ${tocHtml}
            ${content}
        </body>
        </html>
      `;

      frameDoc.open();
      frameDoc.write(printContent);
      frameDoc.close();

      printFrame.contentWindow.onload = () => {
          try {
              showCatalogLoader("Opening print dialog...", 100);
              printFrame.contentWindow.focus();
              printFrame.contentWindow.print();
              setTimeout(hideCatalogLoader, 500);
          } catch (e) {
              console.error("Print failed:", e);
              alert("Could not open print dialog.");
              hideCatalogLoader();
          }
      };
      
      printFrame.contentWindow.onafterprint = () => {
          hideCatalogLoader();
          if (printFrame.parentNode) {
              printFrame.parentNode.removeChild(printFrame);
          }
      };
    }, 50);
  };

  if (catalogDownloadBtn) catalogDownloadBtn.addEventListener("click", () => generateCatalogPDF());

  if (catalogPrintBtn) catalogPrintBtn.addEventListener("click", printCatalog);

  if (catalogCancelBtn) {
    catalogCancelBtn.addEventListener("click", () => {
      isPdfCancelled = true;
      hideCatalogLoader();
    });
  }

  const generateCatalogPDF = async () => {
    if (!window.jspdf) {
      alert("PDF generation library is not loaded.");
      return;
    }

    isPdfCancelled = false;
    showCatalogLoader("Initializing PDF generator...", 5);

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

    const catalogTitle = `GEM_Catalog_${new Date().toISOString().split('T')[0]}`;
    doc.setProperties({ title: catalogTitle });

    const imageCache = new Map();

    const loadImage = (url) => {
      if (isPdfCancelled) return Promise.resolve(null);
      if (!url) return Promise.resolve(null);
      if (imageCache.has(url)) return Promise.resolve(imageCache.get(url));

      try {
        return new Promise((resolve) => {
          let done = false;
          const timeoutId = window.setTimeout(() => {
            if (done) return;
            done = true;
            resolve(null);
          }, 8000);

          const finish = (value) => {
            if (done) return;
            done = true;
            window.clearTimeout(timeoutId);
            resolve(value);
          };

          const img = new Image();
          img.crossOrigin = "Anonymous";
          img.onload = () => {
            try {
              if (isPdfCancelled) return finish(null);

              // Optimize: Resize large images. Increased limit to 1000px for better cover page quality.
              const maxDim = 1000;
              let width = img.width;
              let height = img.height;
              if (width > maxDim || height > maxDim) {
                const ratio = Math.min(maxDim / width, maxDim / height);
                width = Math.floor(width * ratio);
                height = Math.floor(height * ratio);
              }

              const canvas = document.createElement("canvas");
              canvas.width = width;
              canvas.height = height;
              const ctx = canvas.getContext("2d");
              if (!ctx) return finish(null);
              ctx.drawImage(img, 0, 0, width, height);

              let dataUrl = null;
              try {
                dataUrl = canvas.toDataURL("image/png");
              } catch {
                // Most common cause: the image server doesn't allow CORS, making the canvas tainted.
                return finish(null);
              }

              imageCache.set(url, dataUrl);
              finish(dataUrl);
            } catch {
              finish(null);
            }
          };
          img.onerror = () => finish(null);
          img.src = url;
        });
      } catch {
        return Promise.resolve(null);
      }
    };

    showCatalogLoader("Loading catalog assets...", 10);

    const loadFirstAvailableImage = async (urls) => {
      for (const url of urls) {
        if (isPdfCancelled) return null;
        // eslint-disable-next-line no-await-in-loop
        const loaded = await loadImage(url);
        if (loaded) return loaded;
      }
      return null;
    };

    // Load Cover Assets
    if (isPdfCancelled) return;
    const logoCandidates = [`${r2BaseUrl}/logo/GoldenEraMotors.png`, "logo/GoldenEraMotors.png"];
    const coverPartsCandidates = Array.from({ length: 6 }, (_, i) => {
      const file = `IMG_000${i + 1}.png`;
      return [`${r2BaseUrl}/car-parts/${file}`, `car-parts/${file}`];
    });
    const [logoData, ...partsData] = await Promise.all([
      loadFirstAvailableImage(logoCandidates),
      ...coverPartsCandidates.map((urls) => loadFirstAvailableImage(urls))
    ]);

    if (isPdfCancelled) return;

    const pageWidth = doc.internal.pageSize.getWidth();
    const now = new Date().toLocaleDateString();

    showCatalogLoader("Creating cover page...", 20);

    // -- Cover Page --
    // 1. Logo
    if (logoData) {
      doc.addImage(logoData, "PNG", (pageWidth - 100) / 2, 20, 100, 30, undefined, "FAST");
    }

    // 2. Title
    doc.setFont("helvetica", "bold");
    doc.setFontSize(24);
    doc.setTextColor(212, 175, 55); // #D4AF37
    doc.text("GOLDEN ERA AUTO PARTS", pageWidth / 2, 65, { align: "center" });

    doc.setFont("helvetica", "normal");
    doc.setFontSize(12);
    doc.setTextColor(80, 80, 80);
    doc.text(`PREMIUM CLASSIC AUTO PARTS | ${now}`, pageWidth / 2, 75, { align: "center" });

    // 3. Separator
    doc.setDrawColor(212, 175, 55);
    doc.setLineWidth(0.5);
    doc.line(40, 82, pageWidth - 40, 82);

    // 4. Showcase Grid
    // Updated to 2 columns with larger images to match Print Preview
    const gridY = 105;
    const gridGap = 12;
    const imgSize = 75; // ~3 inches
    const gridWidth = imgSize * 2 + gridGap;
    const gridStartX = (pageWidth - gridWidth) / 2;

    partsData.forEach((img, i) => {
      if (!img) return;
      const row = Math.floor(i / 2);
      const col = i % 2;
      const x = gridStartX + col * (imgSize + gridGap);
      const y = gridY + row * (imgSize + gridGap);
      doc.addImage(img, "PNG", x, y, imgSize, imgSize, undefined, "FAST");
    });

    // 5. Footer
    doc.setFontSize(11);
    doc.setTextColor(40, 40, 40);
    doc.text("Golden Era Auto Parts", pageWidth / 2, 240, { align: "center" });
    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    doc.text("Premium Classic Auto Parts", pageWidth / 2, 246, { align: "center" });

    const productsByCategory = allProducts.reduce((acc, p) => {
      const category = p.category || "Uncategorized";
      if (!acc[category]) acc[category] = [];
      acc[category].push(p);
      return acc;
    }, {});

    const sortedCategories = Object.keys(productsByCategory).sort();
    const tocEntries = [];
    let lastFinalY = 20; // Start Y for content pages

    doc.addPage(); // Start content on page 2

    const columns = ["Image", "Code", "Product Name", "Brand", "UOM", "Price"];
    const columnStyles = {
      0: { cellWidth: 20 },
      1: { cellWidth: 25 },
      2: { halign: "left" },
      5: { halign: "right" }
    };

    let categoryIndex = 0;
    const totalCategories = sortedCategories.length;
    // Map the remaining 80% (from 20% to 100%) to category processing
    const progressStart = 20;
    const progressRange = 75; // Leave 5% for final touches

    for (const category of sortedCategories) {
      if (isPdfCancelled) break;
      categoryIndex++;
      const currentPercent = progressStart + Math.round((categoryIndex / totalCategories) * progressRange);
      showCatalogLoader(`Processing category ${categoryIndex}/${totalCategories}: ${category}...`, currentPercent);
      const productsInCat = productsByCategory[category];
      productsInCat.sort((a, b) => String(a.product_name || "").localeCompare(String(b.product_name || "")));

      tocEntries.push({
        title: category,
        page: doc.internal.getNumberOfPages()
      });

      // Prepare rows with images for this category
      // eslint-disable-next-line no-await-in-loop
      const rowsWithImages = await Promise.all(
        productsInCat.map(async (p) => {
          if (isPdfCancelled) return null;
          const candidates = buildProductImageCandidates(p.product_code, r2ImageFiles[0] || "IMG_0001.png");
          let imgData = null;
          for (const url of candidates) {
            if (isPdfCancelled) break;
            // eslint-disable-next-line no-await-in-loop
            imgData = await loadImage(url);
            if (imgData) break;
          }
          return {
            imgData,
            row: [
              "", // Placeholder for Image
              p.product_code || "-",
              p.product_name || "Untitled",
              p.brand || "-",
              p.uom || "unit",
              formatCurrency(p.price).replace("PHP", "").trim()
            ]
          };
        })
      );

      if (isPdfCancelled) break;

      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(40, 40, 40);

      if (lastFinalY + 20 > doc.internal.pageSize.getHeight()) {
        doc.addPage();
        lastFinalY = 20;
      }
      doc.text(category, 14, lastFinalY);

      if (doc.autoTable) {
        doc.autoTable({
          head: [columns],
          body: rowsWithImages.filter(r => r).map((r) => r.row),
          startY: lastFinalY + 4,
          theme: "grid",
          showHead: "everyPage",
          headStyles: { fillColor: [21, 24, 28], textColor: [212, 175, 55], halign: "center" },
          styles: { fontSize: 8, cellPadding: 2, valign: "middle", halign: "center", minCellHeight: 18 },
          columnStyles,
          alternateRowStyles: { fillColor: [245, 245, 245] },
          didDrawCell: (data) => {
            if (data.section === "body" && data.column.index === 0) {
              const rowIndex = data.row.index;
              const imgData = rowsWithImages[rowIndex]?.imgData;
              if (imgData) {
                const dim = 16;
                const x = data.cell.x + (data.cell.width - dim) / 2;
                const y = data.cell.y + (data.cell.height - dim) / 2;
                doc.addImage(imgData, "PNG", x, y, dim, dim);
              }
            }
          }
        });
        lastFinalY = doc.autoTable.previous.finalY + 10;
      }
    }

    if (isPdfCancelled) return;

    // Insert and build the Table of Contents page
    if (tocEntries.length > 0) {
      showCatalogLoader("Generating Table of Contents...", 96);
      doc.insertPage(2);
      tocEntries.forEach(entry => { entry.page += 1; });
      doc.setPage(2);

      doc.setFont("helvetica", "bold");
      doc.setFontSize(20);
      doc.setTextColor(40, 40, 40);
      doc.text("Table of Contents", pageWidth / 2, 30, { align: "center" });

      const tocBody = tocEntries.map(entry => [entry.title, String(entry.page)]);
      doc.autoTable({
        head: [["Category", "Page"]],
        body: tocBody,
        startY: 40,
        theme: 'striped',
        headStyles: { fillColor: [21, 24, 28], textColor: [212, 175, 55] },
        styles: { fontSize: 10, cellPadding: 3 },
        columnStyles: { 1: { halign: 'right', cellWidth: 20 } }
      });
    }

    showCatalogLoader("Finalizing document...", 99);
    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      const pageHeight = doc.internal.pageSize.getHeight();
      doc.setFontSize(8);
      doc.setTextColor(150);
      doc.text(`Page ${i} of ${pageCount}`, doc.internal.pageSize.getWidth() / 2, pageHeight - 10, { align: "center" });
    }

    doc.save(`GEM_Catalog_${new Date().toISOString().split("T")[0]}.pdf`);
    hideCatalogLoader();
  };

  const createCard = (product) => {
    const galleryImages = getGalleryImages(product);
    const safeCode = encodeURIComponent(String(product.product_code || "").trim());
    const coverCandidates = safeCode
      ? buildThumbnailImageCandidates(product.product_code)
      : [placeholderImage];
    const coverImage = coverCandidates[0] || placeholderImage;

    const card = document.createElement("article");
    card.className = "product-card";
    card.setAttribute("role", "listitem");
    card.innerHTML = `
      <div class="product-photo">
        <img src="${coverImage}" alt="${product.product_name || "Product"}" loading="lazy">
        <div class="product-badges">
          <span class="product-stock">${product.stock ?? "-"} pcs</span>
          <span class="product-brand-badge">${product.brand || "Golden Era"}</span>
        </div>
        <button class="product-gallery-btn" type="button">View gallery</button>
      </div>
      <div class="product-meta">
        <p class="product-code">${product.product_code || product.id || ""}</p>
        <h3>${product.product_name || "Untitled part"}</h3>
        <p class="product-category">${product.category || "General"}</p>
        <p class="product-price">
          ${product.cost != null ? `<span class="product-price-old">${formatCurrency(product.cost)}</span>` : ""}
          <span class="product-price-new">${formatCurrency(product.price)}</span>
        </p>
        ${product.condition ? `<p class="product-condition">Condition: ${product.condition}</p>` : ""}
        ${product.remarks ? `<p class="product-remarks">Item is ${product.remarks}</p>` : ""}
        <div class="product-specs">
          <span>Sold per ${product.uom || "unit"}</span>
          <button class="product-cart-btn" type="button" aria-label="Add to cart">
            <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
              <path d="M7 18c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2Zm10 0c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2ZM6.2 6h15.3c.6 0 1 .6.8 1.2l-1.6 5.7c-.3 1-1.2 1.7-2.3 1.7H9.2c-1 0-1.9-.6-2.2-1.6L5.1 3H2.5a1 1 0 1 1 0-2h3.4c.5 0 .9.3 1 .8L7.6 6Zm2.1 8h10.1c.2 0 .4-.1.4-.3l1.2-4.3H7.3l1 3.4c0 .1 0 .2 0 .3Z"></path>
            </svg>
          </button>
        </div>
      </div>
    `;

    const imageEl = card.querySelector("img");
    if (imageEl) {
      setImgSrcWithFallback(imageEl, coverCandidates);
      imageEl.addEventListener("click", () => {
        openGallery(product, galleryImages);
      });
    }

    const button = card.querySelector(".product-gallery-btn");
    if (button) {
      button.addEventListener("click", () => {
        openGallery(product, galleryImages);
      });
    }

    const cartBtn = card.querySelector(".product-cart-btn");
    if (cartBtn) {
      cartBtn.addEventListener("click", (event) => {
        event.stopPropagation();
        const resolvedSrc = imageEl?.currentSrc || imageEl?.src || coverImage;
        openConfirmModal(product, resolvedSrc);
      });
    }

    return card;
  };

  const renderProducts = (rows) => {
    if (!productListEl) return;
    productListEl.innerHTML = "";

    const products = (Array.isArray(rows) ? rows : []).map(normalizeRow);
    products.sort((a, b) => String(a.product_name || "").localeCompare(String(b.product_name || "")));

    if (!products.length) {
      productListEl.innerHTML = `<p class="empty-state">No products found.</p>`;
      return;
    }

    for (const product of products) {
      productListEl.appendChild(createCard(product));
    }
  };

  const filters = {
    category: document.getElementById("inv-category"),
    condition: document.getElementById("inv-condition"),
    status: document.getElementById("inv-status"),
    brand: document.getElementById("inv-brand"),
    desc: document.getElementById("inv-desc"),
    itemCode: document.getElementById("inv-item-code"),
    word1: document.getElementById("inv-word1"),
    word2: document.getElementById("inv-word2"),
    word3: document.getElementById("inv-word3"),
    liveDesc: document.getElementById("inv-search-desc"),
    clearBtn: document.getElementById("clearFiltersBtn")
  };

  const normalizeText = (value) => String(value || "").trim().toLowerCase();

  const CATEGORY_SYNONYMS = new Map([
    ["drivetrain", "powertrain"],
    ["powertrain", "powertrain"],
    ["braking", "brake"],
    ["brake", "brake"],
    ["clucth", "clutch"],
    ["clutch", "clutch"],
    ["ignation", "ignition"],
    ["ignition", "ignition"],
    ["servicing", "service"],
    ["service", "service"],
    ["electrical", "electrical"],
    ["electronic", "electrical"],
    ["engine", "engine"],
    ["body", "body"],
    ["interior", "interior"],
    ["transmission", "transmission"],
    ["suspension", "suspension"],
    ["steering", "steering"],
    ["maintenance", "maintenance"],
    ["ignition", "ignition"],
    ["drivetrain", "powertrain"]
  ]);

  const normalizeCategoryTerms = (value) =>
    String(value || "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .split(/\s+/)
      .filter(Boolean)
      .map((token) => {
        const simplified = token.endsWith("ing") ? token.slice(0, -3) : token;
        return CATEGORY_SYNONYMS.get(simplified) || simplified;
      });

  const isCategoryMatch = (category, filter) => {
    if (!category || !filter) return false;
    if (category === filter) return true;
    if (category.includes(filter) || filter.includes(category)) return true;

    const categoryTerms = normalizeCategoryTerms(category);
    const filterTerms = normalizeCategoryTerms(filter);
    if (!categoryTerms.length || !filterTerms.length) return false;

    const categoryHasAllFilterTokens = filterTerms.every((term) =>
      categoryTerms.some((catTerm) => catTerm === term || catTerm.startsWith(term) || term.startsWith(catTerm))
    );
    if (categoryHasAllFilterTokens) return true;

    const filterHasAllCategoryTokens = categoryTerms.every((term) =>
      filterTerms.some((filterTerm) => filterTerm === term || filterTerm.startsWith(term) || term.startsWith(filterTerm))
    );
    return filterHasAllCategoryTokens;
  };

  const urlCategoryFilters = [];
  let currentPage = 1;
  let pageSize = 50;
  let filteredProducts = [];

  const getPageCount = () => Math.max(1, Math.ceil(filteredProducts.length / pageSize));

  const getPageProducts = () => {
    const start = (currentPage - 1) * pageSize;
    return filteredProducts.slice(start, start + pageSize);
  };

  const renderPagination = () => {
    if (!paginationEl || !paginationInfoEl) return;

    const pageCount = getPageCount();
    if (filteredProducts.length <= pageSize) {
      paginationEl.hidden = true;
      return;
    }

    paginationEl.hidden = false;
    paginationInfoEl.textContent = `Page ${currentPage} of ${pageCount}`;
    prevPageBtn.disabled = currentPage <= 1;
    nextPageBtn.disabled = currentPage >= pageCount;
  };

  const goToPage = (page) => {
    const pageCount = getPageCount();
    const nextPage = Math.min(Math.max(1, page), pageCount);
    if (currentPage === nextPage) return;
    currentPage = nextPage;
    renderProducts(getPageProducts());
    renderPagination();
  };

  const setSelectOptions = (selectEl, values) => {
    if (!selectEl) return;
    const current = selectEl.value;
    selectEl.innerHTML = `<option value="">All</option>`;
    const unique = Array.from(new Set(values.filter(Boolean)));
    unique.sort((a, b) => a.localeCompare(b));
    for (const value of unique) {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = value;
      selectEl.appendChild(option);
    }
    // Restore if still exists.
    const canRestore = unique.includes(current);
    selectEl.value = canRestore ? current : "";
  };

  const restoreCategoryFilterFromUrl = () => {
    if (!filters.category) return;
    const params = new URLSearchParams(window.location.search);
    const categoryParam = String(params.get("category") || "").trim();
    if (!categoryParam) return;

    const categories = categoryParam
      .split(";")
      .map((value) => normalizeText(value))
      .filter(Boolean);

    if (!categories.length) return;

    urlCategoryFilters.length = 0;
    urlCategoryFilters.push(...categories);

    const matchingOption = Array.from(filters.category.options).find((option) =>
      categories.some((filterValue) => isCategoryMatch(normalizeText(option.value), filterValue))
    );

    if (matchingOption) {
      filters.category.value = matchingOption.value;
    } else {
      filters.category.value = "";
    }
  };

  let allProducts = [];

  const applyFilters = () => {
    const total = allProducts.length;
    if (!total) {
      renderProducts([]);
      setBadge(0, 0);
      return;
    }

    const categoryValue = normalizeText(filters.category?.value);
    const conditionValue = normalizeText(filters.condition?.value);
    const statusValue = normalizeText(filters.status?.value);
    const brandValue = normalizeText(filters.brand?.value);

    const descValue = normalizeText(filters.desc?.value);
    const itemCodeValue = normalizeText(filters.itemCode?.value);
    const word1Value = normalizeText(filters.word1?.value);
    const word2Value = normalizeText(filters.word2?.value);
    const word3Value = normalizeText(filters.word3?.value);
    const liveDescValue = normalizeText(filters.liveDesc?.value);

    const filtered = allProducts.filter((product) => {
      const normalizedCategory = normalizeText(product.category);
      if (urlCategoryFilters.length) {
        const matches = urlCategoryFilters.some((filterValue) =>
          isCategoryMatch(normalizedCategory, filterValue)
        );
        if (!matches) return false;
      } else if (categoryValue && normalizedCategory !== categoryValue) {
        return false;
      }
      if (conditionValue && normalizeText(product.condition) !== conditionValue) return false;
      if (statusValue && normalizeText(product.status) !== statusValue) return false;
      if (brandValue && normalizeText(product.brand) !== brandValue) return false;

      if (itemCodeValue && !normalizeText(product.product_code).includes(itemCodeValue)) return false;

      const description = normalizeText(product.description);
      const name = normalizeText(product.product_name);
      const combined = `${name} ${description} ${normalizeText(product.brand)} ${normalizeText(product.category)} ${normalizeText(product.product_code)}`;

      if (descValue && !description.includes(descValue) && !name.includes(descValue)) return false;
      if (liveDescValue && !description.includes(liveDescValue) && !name.includes(liveDescValue)) return false;

      if (word1Value && !combined.includes(word1Value)) return false;
      if (word2Value && !combined.includes(word2Value)) return false;
      if (word3Value && !combined.includes(word3Value)) return false;

      return true;
    });

    filteredProducts = filtered;
    currentPage = 1;
    setBadge(filteredProducts.length, total);
    renderProducts(getPageProducts());
    renderPagination();
  };

  const wireFilterEvents = () => {
    if (filters.category) {
      filters.category.addEventListener("change", () => {
        urlCategoryFilters.length = 0;
        applyFilters();
      });
    }
    if (filters.condition) filters.condition.addEventListener("change", applyFilters);
    if (filters.status) filters.status.addEventListener("change", applyFilters);
    if (filters.brand) filters.brand.addEventListener("change", applyFilters);

    if (filters.desc) filters.desc.addEventListener("input", applyFilters);
    if (filters.itemCode) filters.itemCode.addEventListener("input", applyFilters);
    if (filters.word1) filters.word1.addEventListener("input", applyFilters);
    if (filters.word2) filters.word2.addEventListener("input", applyFilters);
    if (filters.word3) filters.word3.addEventListener("input", applyFilters);
    if (filters.liveDesc) filters.liveDesc.addEventListener("input", applyFilters);

    if (filters.clearBtn) {
      filters.clearBtn.addEventListener("click", () => {
        if (filters.category) filters.category.value = "";
        if (filters.condition) filters.condition.value = "";
        urlCategoryFilters.length = 0;
        if (filters.status) filters.status.value = "";
        if (filters.brand) filters.brand.value = "";
        if (filters.desc) filters.desc.value = "";
        if (filters.itemCode) filters.itemCode.value = "";
        if (filters.word1) filters.word1.value = "";
        if (filters.word2) filters.word2.value = "";
        if (filters.word3) filters.word3.value = "";
        if (filters.liveDesc) filters.liveDesc.value = "";
        applyFilters();
      });
    }
  };

  const wirePaginationEvents = () => {
    if (pageSizeSelect) {
      pageSizeSelect.addEventListener("change", () => {
        const nextSize = Number(pageSizeSelect.value);
        pageSize = Number.isFinite(nextSize) && nextSize > 0 ? nextSize : 50;
        currentPage = 1;
        renderProducts(getPageProducts());
        renderPagination();
      });
    }

    if (prevPageBtn) {
      prevPageBtn.addEventListener("click", () => goToPage(currentPage - 1));
    }
    if (nextPageBtn) {
      nextPageBtn.addEventListener("click", () => goToPage(currentPage + 1));
    }
  };

  const config = window.scProductSupabaseConfig || {};
  const baseUrl = String(config.url || "").replace(/\/$/, "");
  const anonKey = String(config.anonKey || "");
  const supabaseHeaders =
    baseUrl && anonKey
      ? {
          apikey: anonKey,
          Authorization: `Bearer ${anonKey}`
        }
      : null;

  const fetchFromView = async (viewName) => {
    if (!supabaseHeaders) return null;
    const endpoint = `${baseUrl}/rest/v1/${viewName}?select=*`;
    const response = await fetch(endpoint, { headers: supabaseHeaders });
    if (!response.ok) return null;
    const data = await response.json();
    return Array.isArray(data) ? data : null;
  };

  const fetchProducts = async () => {
    showLoader("Loading product catalog...");
    setBadge(null);
    wireFilterEvents();
    wirePaginationEvents();

    if (!supabaseHeaders) {
      allProducts = fallbackProducts.map(normalizeRow);
      setSelectOptions(filters.category, allProducts.map((p) => p.category).filter(Boolean));
      setSelectOptions(filters.brand, allProducts.map((p) => p.brand).filter(Boolean));
      setSelectOptions(filters.condition, allProducts.map((p) => p.condition).filter(Boolean));
      setSelectOptions(filters.status, allProducts.map((p) => p.status).filter(Boolean));
      applyFilters();
      hideLoader();
      return;
    }

    try {
      const data = await fetchFromView("product_vw");
      if (data?.length) {
        allProducts = data.map(normalizeRow);
        setSelectOptions(filters.category, allProducts.map((p) => p.category).filter(Boolean));
        setSelectOptions(filters.brand, allProducts.map((p) => p.brand).filter(Boolean));
        setSelectOptions(filters.condition, allProducts.map((p) => p.condition).filter(Boolean));
        setSelectOptions(filters.status, allProducts.map((p) => p.status).filter(Boolean));
        restoreCategoryFilterFromUrl();
        applyFilters();
      } else {
        allProducts = fallbackProducts.map(normalizeRow);
        setSelectOptions(filters.category, allProducts.map((p) => p.category).filter(Boolean));
        setSelectOptions(filters.brand, allProducts.map((p) => p.brand).filter(Boolean));
        setSelectOptions(filters.condition, allProducts.map((p) => p.condition).filter(Boolean));
        setSelectOptions(filters.status, allProducts.map((p) => p.status).filter(Boolean));
        restoreCategoryFilterFromUrl();
        applyFilters();
      }
    } catch (err) {
      console.error("Supabase fetch failed from product_vw", err);
      allProducts = fallbackProducts.map(normalizeRow);
      setSelectOptions(filters.category, allProducts.map((p) => p.category).filter(Boolean));
      setSelectOptions(filters.brand, allProducts.map((p) => p.brand).filter(Boolean));
      setSelectOptions(filters.condition, allProducts.map((p) => p.condition).filter(Boolean));
      setSelectOptions(filters.status, allProducts.map((p) => p.status).filter(Boolean));
      restoreCategoryFilterFromUrl();
      applyFilters();
    } finally {
      hideLoader();
    }
  };

  if (viewCatalogBtn) {
    viewCatalogBtn.addEventListener("click", openCatalogModal);
  }

  fetchProducts();
})();
