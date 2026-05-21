const initScAuth = () => {
  const defaultCredentials = {
    email: "test.seller@gem.com",
    password: "GoldenSeller.gem25"
  };

  const getStored = (key) => {
    try {
      return JSON.parse(localStorage.getItem(key) || "null");
    } catch {
      return null;
    }
  };

  const setStored = (key, value) => {
    localStorage.setItem(key, JSON.stringify(value));
  };

  const getScUser = () => getStored("scUser");
  const getScSession = () => getStored("scSession");

  const loginMessage = document.getElementById("loginMessage");
  const showLoginMessage = (text, variant) => {
    if (!loginMessage) return;
    loginMessage.textContent = text;
    loginMessage.classList.remove("error", "success");
    if (variant) {
      loginMessage.classList.add(variant);
    }
  };

  const tryFallbackLogin = (email, password) => {
    const savedUser = JSON.parse(localStorage.getItem("scUser") || "null");
    const matchesSaved =
      savedUser &&
      savedUser.email &&
      savedUser.password &&
      email.toLowerCase() === savedUser.email.toLowerCase() &&
      password === savedUser.password;
    const matchesDefault =
      email.toLowerCase() === defaultCredentials.email &&
      password === defaultCredentials.password;

    if (matchesSaved || matchesDefault) {
      localStorage.setItem(
        "scSession",
        JSON.stringify({ email, loggedAt: new Date().toISOString() })
      );
      const fallbackUser = matchesSaved
        ? savedUser
        : {
            storeName: "Golden Era Motors Sister",
            storeAddress: "TBD",
            contactNumber: "000-000-0000",
            personnel: "Registered Personnel",
            creditAmount: "25000",
            terms: "COD",
            email,
            password
          };
      localStorage.setItem("scUser", JSON.stringify(fallbackUser));
      showLoginMessage("Login successful, redirecting...", "success");
      setTimeout(() => {
            window.location.href = "sc-dashboard.html"; // Assuming dashboard is the next page after login
      }, 250);
      return true;
    }

    return false;
  };

  const togglePasswordBtn = document.getElementById("togglePassword");
  const passwordInput = document.getElementById("loginPassword");
  if (togglePasswordBtn && passwordInput) {
    togglePasswordBtn.addEventListener("click", () => {
      const isCurrentlyVisible = passwordInput.type === "text";
      passwordInput.type = isCurrentlyVisible ? "password" : "text";
      const nowVisible = passwordInput.type === "text";
      togglePasswordBtn.setAttribute("aria-pressed", String(nowVisible));
      togglePasswordBtn.setAttribute(
        "aria-label",
        nowVisible ? "Hide password" : "Show password"
      );
      passwordInput.focus();
    });
  }

  const loginForm = document.getElementById("scLoginForm");
  if (loginForm) {
    loginForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      showLoginMessage("", ""); // clear

      const emailInput = document.getElementById("loginEmail");
      const passwordInputField = document.getElementById("loginPassword");
      if (!emailInput || !passwordInputField) return;

      const email = emailInput.value.trim();
      const password = passwordInputField.value;      if (!email || !password) {
        showLoginMessage("Please enter both email and password.", "error");
        return;
      }

      if (typeof supabaseClient === "undefined") {
        if (tryFallbackLogin(email, password)) return;
        showLoginMessage(
          "Authentication service unavailable. Use the temporary credentials or register.",
          "error"
        );
        return;
      }

      try {
        const { data, error } = await supabaseClient.rpc("authenticate_sc_user", {
          p_email: email,
          p_password: password
        });

        if (error) {
          if (tryFallbackLogin(email, password)) return;
          showLoginMessage(error.message || "Invalid login credentials.", "error");
          return;
        }

        const userRow = Array.isArray(data) ? data[0] : data;
        if (userRow) {
          const storeId = userRow?.store_id || userRow?.storeId;
          if (storeId && typeof supabaseClient !== "undefined") {
            try {
              // Pre-fetch approvers and attach them to the user object
              const { data: approversData } = await supabaseClient.rpc("get_sc_approvers_by_store", {
                p_store_id: storeId
              });
              if (Array.isArray(approversData)) {
                userRow.approvers = approversData;
              }
            } catch (approverError) {
              console.warn("Could not pre-fetch approvers on login", approverError);
            }
          }

          localStorage.setItem("scUser", JSON.stringify(userRow));
          localStorage.setItem(
            "scSession",
            JSON.stringify({ email, loggedAt: new Date().toISOString() })
          );
          showLoginMessage("Login successful! Redirecting...", "success");
          setTimeout(() => {
            window.location.href = "sc-dashboard.html";
          }, 500);
          return;
        }

        if (tryFallbackLogin(email, password)) return;
        showLoginMessage("Invalid login credentials. Please check your email and password.", "error");
      } catch (err) {
        if (tryFallbackLogin(email, password)) return;
        showLoginMessage("Something went wrong while logging in.", "error");
        console.error(err);
      }
    });
  }

  const guestLoginBtn = document.getElementById("guestLoginBtn");
  if (guestLoginBtn) {
    guestLoginBtn.addEventListener("click", () => {
      const guestUser = {
        storeName: "Guest Viewer",
        isGuest: true
      };
      setStored("scUser", guestUser);
      setStored("scSession", { email: "guest@preview", loggedAt: new Date().toISOString() });
      window.location.href = "sc-products.html";
    });
  }

  const registerForm = document.getElementById("scRegisterForm");
  const scUser = getScUser();
  const scSession = getScSession();
  const isLoggedIn = Boolean(scUser || scSession);
  const isGuest = scUser?.isGuest === true;

  // Treat guests as "register view" so they can fill out the form
  const isRegisterView = Boolean(registerForm && (!isLoggedIn || isGuest));
  // Guests are not "view only" (which is for existing stores viewing profile)
  const isViewOnly = Boolean(registerForm && scUser && !isGuest);

  if (isRegisterView) {
    const nav = document.querySelector(".sc-products-nav");
    if (nav) {
      // If Guest, allow Products link. If completely anonymous, hide everything.
      const selector = isGuest 
        ? 'a[href="sc-dashboard.html"], a[href="sc-cart.html"], a[href="sc-orders.html"]' 
        : 'a[href="sc-dashboard.html"], a[href="sc-products.html"], a[href="sc-cart.html"], a[href="sc-orders.html"], a[data-logout]';
      const links = nav.querySelectorAll(selector);
      links.forEach((el) => (el.style.display = "none"));
    }
  }

  if (registerForm && isLoggedIn && !scUser && !isGuest) {
    window.location.href = "index.html";
    return;
  }

  const getStoreProfile = (user) => ({
    storeName: user?.storeName || user?.store_name || user?.store || user?.name || "",
    storeAddress: user?.storeAddress || user?.store_address || user?.address || "",
    contactNumber: user?.contactNumber || user?.contact_number || user?.contact || "",
    personnel: user?.personnel || user?.assigned_personnel || user?.assignedPersonnel || "",
    creditAmount:
      user?.creditAmount ??
      user?.credit_limit ??
      user?.creditLimit ??
      user?.credit ??
      "",
    terms: user?.terms || user?.payment_terms || user?.paymentTerms || "",
    email: user?.email || user?.user_email || ""
  });

  const setFieldValue = (id, value) => {
    const input = document.getElementById(id);
    if (!input) return;
    input.value = value != null ? String(value) : "";
  };

  const setStoreFieldsReadOnly = (isReadOnly) => {
    if (!registerForm) return;
    registerForm.classList.toggle("sc-readonly", isReadOnly);
    const fieldIds = [
      "storeName",
      "storeAddress",
      "contactNumber",
      "personnel",
      "creditAmount",
      "terms",
      "email",
      "password"
    ];
    fieldIds.forEach((id) => {
      const el = document.getElementById(id);
      if (!el) return;
      if (el.tagName === "SELECT") {
        el.disabled = isReadOnly;
      } else {
        el.readOnly = isReadOnly;
      }
    });
  };

  let approvers = [];

  const updateHeaderStoreName = (name) => {
    const headerName = document.getElementById("scHeaderStoreName");
    if (headerName) headerName.textContent = name || "Guest";
  };

  const setupModal = (modalEl) => {
    if (!modalEl) return { open: () => {}, close: () => {} };

    const close = () => {
      modalEl.classList.remove("is-visible");
      document.body.classList.remove("has-modal");
    };

    const open = () => {
      modalEl.classList.add("is-visible");
      document.body.classList.add("has-modal");
    };

    if (modalEl.dataset.scModalSetup === "true") {
      return { open, close };
    }

    modalEl.dataset.scModalSetup = "true";

    const closeEls = Array.from(modalEl.querySelectorAll("[data-modal-close]"));
    const cancelEls = Array.from(modalEl.querySelectorAll("[data-modal-cancel]"));

    closeEls.forEach((btn) => btn.addEventListener("click", close));
    cancelEls.forEach((btn) => btn.addEventListener("click", close));
    modalEl.addEventListener("click", (event) => {
      if (event.target === modalEl) close();
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && modalEl.classList.contains("is-visible")) {
        close();
      }
    });

    return { open, close };
  };

  const applyStoreProfileToForm = (profile) => {
    setFieldValue("storeName", profile.storeName);
    setFieldValue("storeAddress", profile.storeAddress);
    setFieldValue("contactNumber", profile.contactNumber);
    setFieldValue("personnel", profile.personnel);
    setFieldValue("creditAmount", profile.creditAmount);
    setFieldValue("email", profile.email);
    const termsInput = document.getElementById("terms");
    if (termsInput && profile.terms) {
      termsInput.value = profile.terms;
    }
  };

  if (registerForm) {
    let activeUser = scUser || {};
    const storeId = String(activeUser?.store_id || activeUser?.storeId || "").trim();
    const supabaseReady = typeof supabaseClient !== "undefined" && Boolean(storeId);
    approvers = Array.isArray(activeUser.approvers) ? activeUser.approvers : [];

    const normalizeApprover = (entry) => ({
      id: entry?.id || entry?.approver_id || null,
      store_id: entry?.store_id || null,
      full_name: entry?.full_name || entry?.fullName || "",
      designation: entry?.designation || entry?.title || "",
      username: entry?.username || entry?.user || "",
      password_hash: entry?.password_hash || entry?.passwordHash || entry?.password || ""
    });

    const saveUser = (updates) => {
      activeUser = { ...activeUser, ...updates };
      setStored("scUser", activeUser);
      return activeUser;
    };

    const fetchApproversFromSupabase = async () => {
      if (!supabaseReady) return false;
      try {
        const { data, error } = await supabaseClient.rpc("get_sc_approvers_by_store", {
          p_store_id: storeId
        });

        if (error) {
          console.warn("Unable to fetch approvers", error);
          return false;
        }

        if (Array.isArray(data)) {
          approvers = data.map(normalizeApprover);
          approvers.sort((a, b) => (a.full_name || "").localeCompare(b.full_name || ""));
          saveUser({ approvers });
        }

        return true;
      } catch (err) {
        console.warn("Approver fetch failed", err);
        return false;
      }
    };

    const deleteApproverFromSupabase = async (approverId) => {
      if (!supabaseReady || !approverId) return false;
      try {
        const { error } = await supabaseClient.rpc("sc_delete_approver", {
          p_store_id: storeId,
          p_approver_id: approverId
        });
        if (error) {
          console.warn("Unable to delete approver", error);
          return false;
        }
        return true;
      } catch (err) {
        console.warn("Approver delete failed", err);
        return false;
      }
    };

    const isUsernameTaken = async (username, ignoreId = null) => {
      if (!supabaseReady || !username) return false;
      try {
        const { data, error } = await supabaseClient
          .from("sc_approvers")
          .select("id")
          .eq("store_id", storeId)
          .eq("username", username)
          .limit(1);

        if (error) {
          console.warn("Unable to validate approver username", error);
          return false;
        }

        const row = Array.isArray(data) ? data[0] : data;
        if (!row) return false;
        if (ignoreId && String(row.id) === String(ignoreId)) return false;
        return true;
      } catch (err) {
        console.warn("Approver username validation failed", err);
        return false;
      }
    };

    const formatApproverSaveError = (error, usernameValue) => {
      const message = String(error?.message || error || "").toLowerCase();
      if (
        message.includes("duplicate") ||
        message.includes("unique") ||
        message.includes("sc_approvers_unique_store_username")
      ) {
        return `Username already exists: ${usernameValue}`;
      }
      return String(error?.message || "Unable to save approver.");
    };

    const deleteApproverModal = document.getElementById("deleteApproverModal");
    const confirmDeleteBtn = document.getElementById("confirmDeleteApproverBtn");
    const deleteModalApi = setupModal(deleteApproverModal);
    let pendingDeleteIndex = null;

    const executeDeleteApprover = async (index) => {
      const target = approvers[index];
      if (!target) return;

      if (supabaseReady && target.id) {
        const okDelete = await deleteApproverFromSupabase(target.id);
        if (!okDelete) {
          alert("Unable to remove approver right now.");
          return;
        }
      }

      approvers = approvers.filter((_, idx) => idx !== index);
      saveUser({ approvers });
      renderApprovers();
    };

    const handleRemoveApprover = async (index) => {
      const target = approvers[index];
      if (!target) return;

      if (deleteApproverModal) {
        pendingDeleteIndex = index;
        const msg = document.getElementById("deleteApproverMessage");
        if (msg) msg.textContent = `Are you sure you want to remove ${target.full_name || "this approver"}?`;
        deleteModalApi.open();
      } else {
        // Fallback if modal is missing
        if (window.confirm(`Remove approver ${target.full_name || "this approver"}?`)) {
          executeDeleteApprover(index);
        }
      }
    };

    const renderApprovers = () => {
      const listEl = document.getElementById("approversList");
      if (!listEl) return;
      listEl.innerHTML = "";
      if (!approvers.length) {
        const empty = document.createElement("p");
        empty.className = "empty-state";
        empty.textContent = "No approvers saved yet.";
        listEl.appendChild(empty);
        return;
      }

      approvers.forEach((approver, idx) => {
        const card = document.createElement("div");
        card.className = "approver-card";

        const header = document.createElement("div");
        header.className = "approver-card-header";

        const title = document.createElement("div");
        title.className = "approver-card-title";
        title.textContent = `Approver #${idx + 1}`;

        const actions = document.createElement("div");
        actions.className = "approver-card-actions";

        const editBtn = document.createElement("button");
        editBtn.type = "button";
        editBtn.className = "sc-btn sc-btn-ghost";
        editBtn.textContent = "Edit";
        editBtn.addEventListener("click", () => openApproverModal(idx));

        const removeBtn = document.createElement("button");
        removeBtn.type = "button";
        removeBtn.className = "sc-btn sc-btn-ghost sc-btn-danger";
        removeBtn.textContent = "Remove";
        removeBtn.addEventListener("click", () => handleRemoveApprover(idx));

        if (isViewOnly && storeId && approver.store_id && String(approver.store_id) !== storeId) {
          editBtn.disabled = true;
          removeBtn.disabled = true;
          editBtn.title = "This approver belongs to another store.";
          removeBtn.title = "This approver belongs to another store.";
        }

        actions.appendChild(editBtn);
        actions.appendChild(removeBtn);
        header.appendChild(title);
        header.appendChild(actions);

        const body = document.createElement("div");
        body.style.padding = "1rem 1.25rem";
        body.style.display = "flex";
        body.style.alignItems = "center";
        body.style.gap = "1rem";

        // Simple avatar placeholder
        const avatar = document.createElement("div");
        avatar.innerHTML = `<svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="background:rgba(255,255,255,0.08); color:var(--text-light); border-radius:50%; padding:8px;"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>`;

        const infoStack = document.createElement("div");
        infoStack.style.display = "flex";
        infoStack.style.flexDirection = "column";
        infoStack.style.lineHeight = "1.4";

        infoStack.innerHTML = `
          <span style="font-weight: 600; color: var(--text); font-size: 1.05rem;">${approver.full_name || "Unknown Name"}</span>
          <span style="color: var(--text-light); font-size: 0.9rem;">${approver.designation || "No designation"}</span>
          <span style="color: var(--text-light); font-size: 0.8rem; margin-top: 2px; opacity: 0.7;">@${approver.username || "-"}</span>
        `;

        body.appendChild(avatar);
        body.appendChild(infoStack);

        card.appendChild(header);
        card.appendChild(body);
        listEl.appendChild(card);
      });
    };

    const initApprovers = async () => {
      const listEl = document.getElementById("approversList");
      if (listEl) {
        listEl.innerHTML = `
          <div style="display: flex; align-items: center; justify-content: center; padding: 2rem; color: #888;">
            <div style="
              width: 20px; 
              height: 20px; 
              border: 2px solid currentColor; 
              border-right-color: transparent; 
              border-radius: 50%; 
              animation: sc-spin 0.8s linear infinite;
              margin-right: 0.75rem;"></div>
            <span>Loading approvers...</span>
          </div>
          <style>@keyframes sc-spin { to { transform: rotate(360deg); } }</style>`;
      }
      if (isViewOnly) {
        await fetchApproversFromSupabase();
      } else {
        // For registration, just use what's in memory.
        approvers = (activeUser.approvers || []).map(normalizeApprover);
      }
      renderApprovers();
    };

    // MODALS AND FORMS (shared between register and view-only)

    // -- Store Edit Modal (only for view-only)
    // This logic is inside the isViewOnly block

    // -- Approver Modals (shared)
    const approverModal = document.getElementById("approverModal");
    const approverForm = document.getElementById("approverForm");
    const approverModalTitle = document.getElementById("approverModalTitle");
    const addApproverBtn = document.getElementById("addApproverBtn");
    const approverModalApi = setupModal(approverModal);
    let editingIndex = null;

    const storeEditModal = document.getElementById("storeEditModal");
    const storeEditForm = document.getElementById("storeEditForm");
    const storeModalApi = setupModal(storeEditModal);

    const fillStoreEditForm = () => {
      const currentProfile = getStoreProfile(activeUser);
      setFieldValue("editStoreName", currentProfile.storeName);
      setFieldValue("editStoreAddress", currentProfile.storeAddress);
      setFieldValue("editContactNumber", currentProfile.contactNumber);
      setFieldValue("editPersonnel", currentProfile.personnel);
      setFieldValue("editCreditAmount", currentProfile.creditAmount);
      setFieldValue("editEmail", currentProfile.email);
      const termsInput = document.getElementById("editTerms");
      if (termsInput && currentProfile.terms) {
        termsInput.value = currentProfile.terms;
      }
    };

    if (storeEditForm) {
      storeEditForm.addEventListener("submit", (event) => {
        event.preventDefault();
        const storeName = document.getElementById("editStoreName")?.value.trim();
        const storeAddress = document.getElementById("editStoreAddress")?.value.trim();
        const contactNumber = document.getElementById("editContactNumber")?.value.trim();
        const personnel = document.getElementById("editPersonnel")?.value.trim();
        const creditAmount = document.getElementById("editCreditAmount")?.value || "";
        const terms = document.getElementById("editTerms")?.value || "";
        const email = document.getElementById("editEmail")?.value.trim();

        if (!storeName || !storeAddress || !contactNumber || !personnel || !email) {
          alert("Please fill out all required store fields.");
          return;
        }

        const updatedUser = saveUser({
          storeName,
          store_name: storeName,
          store: storeName,
          storeAddress,
          store_address: storeAddress,
          contactNumber,
          contact_number: contactNumber,
          personnel,
          assigned_personnel: personnel,
          creditAmount,
          credit_limit: Number(creditAmount) || 0,
          terms,
          payment_terms: terms,
          email
        });

        applyStoreProfileToForm(getStoreProfile(updatedUser));
        updateHeaderStoreName(storeName);
        storeModalApi.close();
      });
    }

    if (confirmDeleteBtn) {
      confirmDeleteBtn.addEventListener("click", () => {
        if (pendingDeleteIndex !== null) {
          executeDeleteApprover(pendingDeleteIndex);
          deleteModalApi.close();
          pendingDeleteIndex = null;
        }
      });
    }

    const setApproverForm = (data) => {
      setFieldValue("approverFullName", data?.full_name || "");
      setFieldValue("approverDesignation", data?.designation || "");
      setFieldValue("approverUsername", data?.username || "");
      setFieldValue("approverPassword", "");
    };

    const approverUsernameInput = document.getElementById("approverUsername");
    if (approverUsernameInput) {
      approverUsernameInput.addEventListener("input", () => {
        approverUsernameInput.value = approverUsernameInput.value.toLowerCase();
      });
    }

    const openApproverModal = (index = null) => {
      editingIndex = typeof index === "number" ? index : null;
      if (approverModalTitle) {
        approverModalTitle.textContent = editingIndex === null ? "Add Approver" : "Edit Approver";
      }
      setApproverForm(editingIndex === null ? {} : approvers[editingIndex]);
      approverModalApi.open();
      const firstField = document.getElementById("approverFullName");
      if (firstField) firstField.focus();
    };

    if (isViewOnly && addApproverBtn) {
      addApproverBtn.addEventListener("click", () => openApproverModal());
    }

    if (isViewOnly && approverForm) {
      approverForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        const fullName = document.getElementById("approverFullName")?.value.trim();
        const designation = document.getElementById("approverDesignation")?.value.trim();
        const usernameRaw = document.getElementById("approverUsername")?.value.trim();
        const password = document.getElementById("approverPassword")?.value || "";
        const username = (usernameRaw || "").toLowerCase();

        if (!fullName || !designation || !username) {
          alert("Please fill out all required approver fields.");
          return;
        }

        if (!isViewOnly) { // Local validation for registration
          const duplicate = approvers.find((entry, idx) => {
            if (editingIndex !== null && idx === editingIndex) return false;
            return (entry.username || "").toLowerCase() === username;
          });

          if (duplicate) {
            alert(`Duplicate approver username found: ${username}`);
            return;
          }
        }

        let nextApprover = {
          full_name: fullName,
          designation,
          username,
          password_hash: password
        };

        if (editingIndex === null && !password) {
          alert("Please enter a password for the new approver.");
          return;
        }

        // If editing and password field is empty, preserve the existing password
        if (editingIndex !== null && !password && approvers[editingIndex]) {
          nextApprover.password_hash = approvers[editingIndex].password_hash;
        }

        if (isViewOnly && supabaseReady) {
          const ignoreId = editingIndex !== null ? approvers[editingIndex]?.id || null : null;
          if (await isUsernameTaken(username, ignoreId)) {
            alert(`Username already exists: ${username}`);
            return;
          }
          try {
            const approverId = editingIndex !== null ? approvers[editingIndex]?.id || null : null;
            const { data, error } = await supabaseClient.rpc("sc_upsert_approver", {
              p_store_id: storeId,
              p_approver_id: approverId,
              p_full_name: nextApprover.full_name,
              p_designation: nextApprover.designation,
              p_username: nextApprover.username,
              p_password: password || null
            });

            if (error) {
              alert(formatApproverSaveError(error, username));
              return;
            }

            const row = Array.isArray(data) ? data[0] : data;
            if (row) {
              nextApprover = normalizeApprover(row);
            } else if (approverId) {
              nextApprover.id = approverId;
              nextApprover.password_hash = approvers[editingIndex]?.password_hash || "";
            }
          } catch (err) {
            console.error(err);
            alert("Unable to save approver right now.");
            return;
          }
        }

        if (editingIndex !== null) {
          approvers[editingIndex] = nextApprover;
        } else {
          approvers = [...approvers, nextApprover];
        }

        if (isViewOnly) {
          saveUser({ approvers });
        }

        renderApprovers();
        approverModalApi.close();
      });
    }

    if (isViewOnly) {
      // Hide the registration form and show the view-only layout
      const registrationForm = document.getElementById("scRegisterForm");
      const viewOnlyContainer = document.getElementById("scViewOnlyMode");
      const progressIndicator = document.querySelector(".registration-progress");

      if (registrationForm) registrationForm.style.display = "none";
      if (progressIndicator) progressIndicator.style.display = "none";
      if (viewOnlyContainer) viewOnlyContainer.style.display = "block";

      // Update page title
      document.title = "Sister Company Profile - Golden Era Motors";

      // Populate view-only data
      const profile = getStoreProfile(scUser || {});
      document.getElementById("viewStoreName").textContent = profile.storeName || "Not set";
      document.getElementById("viewStoreAddress").textContent = profile.storeAddress || "Not set";
      document.getElementById("viewContactNumber").textContent = profile.contactNumber || "Not set";
      document.getElementById("viewPersonnel").textContent = profile.personnel || "Not set";
      document.getElementById("viewEmail").textContent = profile.email || "Not set";
      document.getElementById("viewCreditAmount").textContent = profile.creditAmount ? `₱${Number(profile.creditAmount).toLocaleString()}` : "Not set";
      document.getElementById("viewTerms").textContent = profile.terms || "Not set";

      // Render approvers in view-only mode
      const renderViewOnlyApprovers = () => {
        const listEl = document.getElementById("viewApproversList");
        if (!listEl) return;
        listEl.innerHTML = "";

        if (!approvers.length) {
          const empty = document.createElement("div");
          empty.className = "empty-state";
          empty.innerHTML = `
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="width: 48px; height: 48px; opacity: 0.5;">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
              <circle cx="12" cy="7" r="4"></circle>
            </svg>
            <p>No approvers have been added yet.</p>
          `;
          listEl.appendChild(empty);
          return;
        }

        approvers.forEach((approver, idx) => {
          const card = document.createElement("div");
          card.className = "approver-profile-card";

          const avatar = document.createElement("div");
          avatar.className = "approver-avatar";
          const initials = (approver.full_name || "U").split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
          avatar.textContent = initials;

          const details = document.createElement("div");
          details.className = "approver-details";

          const name = document.createElement("div");
          name.className = "approver-name";
          name.textContent = approver.full_name || "Unknown Name";

          const designation = document.createElement("div");
          designation.className = "approver-designation";
          designation.textContent = approver.designation || "No designation";

          const username = document.createElement("div");
          username.className = "approver-username";
          username.textContent = `@${approver.username || "-"}`;

          details.appendChild(name);
          details.appendChild(designation);
          details.appendChild(username);

          const actions = document.createElement("div");
          actions.className = "approver-actions";

          const editBtn = document.createElement("button");
          editBtn.type = "button";
          editBtn.className = "sc-btn sc-btn-ghost sc-btn-sm";
          editBtn.textContent = "Edit";
          editBtn.addEventListener("click", () => openApproverModal(idx));

          const removeBtn = document.createElement("button");
          removeBtn.type = "button";
          removeBtn.className = "sc-btn sc-btn-ghost sc-btn-danger sc-btn-sm";
          removeBtn.textContent = "Remove";
          removeBtn.addEventListener("click", () => handleRemoveApprover(idx));

          if (storeId && approver.store_id && String(approver.store_id) !== storeId) {
            editBtn.disabled = true;
            removeBtn.disabled = true;
            editBtn.title = "This approver belongs to another store.";
            removeBtn.title = "This approver belongs to another store.";
          }

          actions.appendChild(editBtn);
          actions.appendChild(removeBtn);

          card.appendChild(avatar);
          card.appendChild(details);
          card.appendChild(actions);
          listEl.appendChild(card);
        });
      };

      // Override the renderApprovers function for view-only mode
      const originalRenderApprovers = renderApprovers;
      renderApprovers = renderViewOnlyApprovers;

      // Initialize approvers
      initApprovers();

      // Store edit functionality
      const storeEditBtn = document.getElementById("storeEditBtn");
      if (storeEditBtn) {
        storeEditBtn.addEventListener("click", () => {
          fillStoreEditForm();
          storeModalApi.open();
          const firstField = document.getElementById("editStoreName");
          if (firstField) firstField.focus();
        });
      }

      // Update view when store info is edited
      const originalStoreEditSubmit = storeEditForm?.onsubmit;
      if (storeEditForm) {
        storeEditForm.addEventListener("submit", (event) => {
          // Call original submit logic
          if (originalStoreEditSubmit) {
            originalStoreEditSubmit.call(storeEditForm, event);
          }

          // Update view-only display
          setTimeout(() => {
            const updatedProfile = getStoreProfile(activeUser);
            document.getElementById("viewStoreName").textContent = updatedProfile.storeName || "Not set";
            document.getElementById("viewStoreAddress").textContent = updatedProfile.storeAddress || "Not set";
            document.getElementById("viewContactNumber").textContent = updatedProfile.contactNumber || "Not set";
            document.getElementById("viewPersonnel").textContent = updatedProfile.personnel || "Not set";
            document.getElementById("viewEmail").textContent = updatedProfile.email || "Not set";
            document.getElementById("viewCreditAmount").textContent = updatedProfile.creditAmount ? `₱${Number(updatedProfile.creditAmount).toLocaleString()}` : "Not set";
            document.getElementById("viewTerms").textContent = updatedProfile.terms || "Not set";
          }, 100);
        });
      }
    }

    if (isRegisterView) {
      initApprovers();
    }

    const backToLoginBtn = document.getElementById("backToLoginBtn");
    if (backToLoginBtn) {
      backToLoginBtn.addEventListener("click", () => {
        let isDirty = false;
        const inputs = registerForm.querySelectorAll("input, select");
        for (const input of inputs) {
          if (input.type !== "hidden" && input.type !== "submit" && input.type !== "button") {
            if (input.value && input.value.trim() !== "") {
              isDirty = true;
              break;
            }
          }
        }
        if (!isDirty && approvers.length > 0) isDirty = true;

        if (isDirty) {
          if (confirm("You have unsaved changes. Are you sure you want to discard them and go back to login?")) {
            window.location.href = "index.html";
          }
        } else {
          window.location.href = "index.html";
        }
      });
    }
  }

  // Enhanced Multi-Step Registration Logic
  if (registerForm && isRegisterView) {
    // Multi-step form handling
    let currentStep = 1;
    const totalSteps = 3;
    let registrationApprovers = [];

    const updateProgress = () => {
      const progressFill = document.getElementById("progressFill");
      const progressBar = document.querySelector(".registration-progress");
      if (progressFill) {
        const percentage = (currentStep / totalSteps) * 100;
        progressFill.style.width = `${percentage}%`;
        progressBar.setAttribute("aria-valuenow", percentage);
      }

      // Update step indicators
      document.querySelectorAll(".step").forEach((step, index) => {
        const stepNumber = index + 1;
        step.classList.toggle("active", stepNumber === currentStep);
      });
    };

    const showStep = (stepNumber) => {
      document.querySelectorAll(".registration-step").forEach((step, index) => {
        step.classList.toggle("active", index + 1 === stepNumber);
      });
      currentStep = stepNumber;
      updateProgress();
    };

    const validateStep1 = () => {
      const fields = [
        { id: "storeName", name: "Store Name" },
        { id: "storeAddress", name: "Store Address" },
        { id: "contactNumber", name: "Contact Number" },
        { id: "personnel", name: "Assigned Personnel" },
        { id: "email", name: "Email" },
        { id: "password", name: "Password" }
      ];

      let isValid = true;

      fields.forEach(field => {
        const input = document.getElementById(field.id);
        const errorEl = document.getElementById(`${field.id}Error`);
        if (!input || !errorEl) return;

        const value = input.value.trim();
        let error = "";

        if (!value) {
          error = `${field.name} is required.`;
          isValid = false;
        } else if (field.id === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
          error = "Please enter a valid email address.";
          isValid = false;
        } else if (field.id === "password" && value.length < 8) {
          error = "Password must be at least 8 characters long.";
          isValid = false;
        } else if (field.id === "contactNumber" && !/^[0-9+\-\s()]+$/.test(value)) {
          error = "Please enter a valid contact number.";
          isValid = false;
        }

        errorEl.textContent = error;
      });

      return isValid;
    };

    const validateStep2 = () => {
      return registrationApprovers.length > 0;
    };

    const validateStep3 = () => {
      const termsAccepted = document.getElementById("termsAccepted");
      const termsError = document.getElementById("termsError");

      if (!termsAccepted.checked) {
        termsError.textContent = "You must accept the terms and conditions.";
        return false;
      }

      termsError.textContent = "";
      return true;
    };

    const collectFormData = () => {
      return {
        storeName: document.getElementById("storeName").value.trim(),
        storeAddress: document.getElementById("storeAddress").value.trim(),
        contactNumber: document.getElementById("contactNumber").value.trim(),
        personnel: document.getElementById("personnel").value.trim(),
        email: document.getElementById("email").value.trim(),
        password: document.getElementById("password").value,
        creditAmount: document.getElementById("creditAmount").value || "0",
        terms: document.getElementById("terms").value,
        approvers: registrationApprovers
      };
    };

    const updateReviewSection = () => {
      const data = collectFormData();

      // Update store review
      const storeReview = document.getElementById("storeReview");
      if (storeReview) {
        storeReview.innerHTML = `
          <div class="review-item">
            <span class="review-label">Store Name</span>
            <span class="review-value">${data.storeName}</span>
          </div>
          <div class="review-item">
            <span class="review-label">Store Address</span>
            <span class="review-value">${data.storeAddress}</span>
          </div>
          <div class="review-item">
            <span class="review-label">Contact Number</span>
            <span class="review-value">${data.contactNumber}</span>
          </div>
          <div class="review-item">
            <span class="review-label">Assigned Personnel</span>
            <span class="review-value">${data.personnel}</span>
          </div>
          <div class="review-item">
            <span class="review-label">Email</span>
            <span class="review-value">${data.email}</span>
          </div>
          <div class="review-item">
            <span class="review-label">Credit Limit</span>
            <span class="review-value">₱${Number(data.creditAmount).toLocaleString()}</span>
          </div>
          <div class="review-item">
            <span class="review-label">Payment Terms</span>
            <span class="review-value">${data.terms}</span>
          </div>
        `;
      }

      // Update approvers review
      const approversReview = document.getElementById("approversReview");
      if (approversReview) {
        approversReview.innerHTML = data.approvers.map(approver => `
          <div class="approver-review-card">
            <h4>${approver.full_name}</h4>
            <p><strong>Designation:</strong> ${approver.designation}</p>
            <p><strong>Username:</strong> ${approver.username}</p>
          </div>
        `).join("");
      }
    };

    // Password strength indicator
    const updatePasswordStrength = (password) => {
      const strengthEl = document.querySelector(".password-strength");
      if (!strengthEl) return;

      let strength = 0;
      if (password.length >= 8) strength += 25;
      if (/[A-Z]/.test(password)) strength += 25;
      if (/[a-z]/.test(password)) strength += 25;
      if (/[0-9]/.test(password)) strength += 25;

      strengthEl.style.setProperty("--strength", `${strength}%`);
    };

    // Event handlers
    // Password toggle
    const togglePassword = document.getElementById("togglePassword");
    const passwordInput = document.getElementById("password");
    if (togglePassword && passwordInput) {
      togglePassword.addEventListener("click", () => {
        const isVisible = passwordInput.type === "text";
        passwordInput.type = isVisible ? "password" : "text";
        togglePassword.setAttribute("aria-pressed", String(!isVisible));
      });

      passwordInput.addEventListener("input", (e) => {
        updatePasswordStrength(e.target.value);
      });
    }

    // Step navigation
    const nextToApprovers = document.getElementById("nextToApprovers");
    const nextToReview = document.getElementById("nextToReview");
    const backToStoreInfo = document.getElementById("backToStoreInfo");
    const backToApprovers = document.getElementById("backToApprovers");

    if (nextToApprovers) {
      nextToApprovers.addEventListener("click", () => {
        if (validateStep1()) {
          showStep(2);
        }
      });
    }

    if (nextToReview) {
      nextToReview.addEventListener("click", () => {
        if (validateStep2()) {
          updateReviewSection();
          showStep(3);
        } else {
          alert("Please add at least one approver.");
        }
      });
    }

    if (backToStoreInfo) {
      backToStoreInfo.addEventListener("click", () => showStep(1));
    }

    if (backToApprovers) {
      backToApprovers.addEventListener("click", () => showStep(2));
    }

    // Back to login
    const backToLoginBtn = document.getElementById("backToLoginBtn");
    if (backToLoginBtn) {
      backToLoginBtn.addEventListener("click", () => {
        if (confirm("Are you sure you want to go back to login? Your progress will be lost.")) {
          window.location.href = "index.html";
        }
      });
    }

    // Initialize approvers for step 2
    const initRegistrationApprovers = () => {
      registrationApprovers = [];
      renderRegistrationApprovers();
    };

    const renderRegistrationApprovers = () => {
      const listEl = document.getElementById("registrationApproversList");
      if (!listEl) return;
      listEl.innerHTML = "";
      if (!registrationApprovers.length) {
        const empty = document.createElement("div");
        empty.className = "empty-state";
        empty.innerHTML = `
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
            <circle cx="12" cy="7" r="4"></circle>
          </svg>
          <p>No approvers added yet. Click "Add Approver" to get started.</p>
        `;
        listEl.appendChild(empty);
        return;
      }

      registrationApprovers.forEach((approver, idx) => {
        const card = document.createElement("div");
        card.className = "approver-card";

        const header = document.createElement("div");
        header.className = "approver-card-header";

        const title = document.createElement("div");
        title.className = "approver-card-title";
        title.textContent = `Approver #${idx + 1}`;

        const actions = document.createElement("div");
        actions.className = "approver-card-actions";

        const editBtn = document.createElement("button");
        editBtn.type = "button";
        editBtn.className = "sc-btn sc-btn-ghost";
        editBtn.textContent = "Edit";
        editBtn.addEventListener("click", () => openRegistrationApproverModal(idx));

        const removeBtn = document.createElement("button");
        removeBtn.type = "button";
        removeBtn.className = "sc-btn sc-btn-ghost sc-btn-danger";
        removeBtn.textContent = "Remove";
        removeBtn.addEventListener("click", () => handleRemoveRegistrationApprover(idx));

        actions.appendChild(editBtn);
        actions.appendChild(removeBtn);
        header.appendChild(title);
        header.appendChild(actions);

        const body = document.createElement("div");
        body.style.padding = "1rem 1.25rem";
        body.style.display = "flex";
        body.style.alignItems = "center";
        body.style.gap = "1rem";

        const avatar = document.createElement("div");
        avatar.innerHTML = `<svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="background:rgba(255,255,255,0.08); color:var(--text-light); border-radius:50%; padding:8px;"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>`;

        const infoStack = document.createElement("div");
        infoStack.style.display = "flex";
        infoStack.style.flexDirection = "column";
        infoStack.style.lineHeight = "1.4";

        infoStack.innerHTML = `
          <span style="font-weight: 600; color: var(--text); font-size: 1.05rem;">${approver.full_name || "Unknown Name"}</span>
          <span style="color: var(--text-light); font-size: 0.9rem;">${approver.designation || "No designation"}</span>
          <span style="color: var(--text-light); font-size: 0.8rem; margin-top: 2px; opacity: 0.7;">@${approver.username || "-"}</span>
        `;

        body.appendChild(avatar);
        body.appendChild(infoStack);

        card.appendChild(header);
        card.appendChild(body);
        listEl.appendChild(card);
      });
    };

    let activeRegistrationApproverSubmit = null;

    const openRegistrationApproverModal = (index = null) => {
      const legacyModal = document.getElementById("registrationApproverModal");
      const modal = legacyModal || document.getElementById("approverModal");
      const form = legacyModal
        ? document.getElementById("registrationApproverForm")
        : document.getElementById("approverForm");
      const title = legacyModal
        ? document.getElementById("registrationApproverModalTitle")
        : document.getElementById("approverModalTitle");

      const fieldIds = legacyModal
        ? {
            fullName: "registrationApproverFullName",
            designation: "registrationApproverDesignation",
            username: "registrationApproverUsername",
            password: "registrationApproverPassword"
          }
        : {
            fullName: "approverFullName",
            designation: "approverDesignation",
            username: "approverUsername",
            password: "approverPassword"
          };

      if (!modal || !form) {
        alert("Approver modal is missing from this page.");
        return;
      }

      const modalApi = setupModal(modal);
      const editingIndex = typeof index === "number" ? index : null;

      if (title) {
        title.textContent = editingIndex === null ? "Add Approver" : "Edit Approver";
      }

      const setFormValue = (id, value) => {
        const input = document.getElementById(id);
        if (input) input.value = value || "";
      };

      if (editingIndex !== null) {
        const approver = registrationApprovers[editingIndex];
        setFormValue(fieldIds.fullName, approver?.full_name || "");
        setFormValue(fieldIds.designation, approver?.designation || "");
        setFormValue(fieldIds.username, approver?.username || "");
        setFormValue(fieldIds.password, "");
      } else {
        setFormValue(fieldIds.fullName, "");
        setFormValue(fieldIds.designation, "");
        setFormValue(fieldIds.username, "");
        setFormValue(fieldIds.password, "");
      }

      if (activeRegistrationApproverSubmit) {
        form.removeEventListener("submit", activeRegistrationApproverSubmit);
        activeRegistrationApproverSubmit = null;
      }

      modalApi.open();
      const firstField = document.getElementById(fieldIds.fullName);
      if (firstField) firstField.focus();

      const handleSubmit = (e) => {
        e.preventDefault();

        const fullName = document.getElementById(fieldIds.fullName)?.value.trim();
        const designation = document.getElementById(fieldIds.designation)?.value.trim();
        const username = document.getElementById(fieldIds.username)?.value.trim().toLowerCase();
        const password = document.getElementById(fieldIds.password)?.value || "";

        if (!fullName || !designation || !username) {
          alert("Please fill out all required approver fields.");
          return;
        }

        if (editingIndex === null && !password) {
          alert("Please enter a password for the new approver.");
          return;
        }

        const duplicate = registrationApprovers.find((entry, idx) => {
          if (editingIndex !== null && idx === editingIndex) return false;
          return (entry.username || "").toLowerCase() === username;
        });

        if (duplicate) {
          alert(`Duplicate approver username found: ${username}`);
          return;
        }

        const existing = editingIndex !== null ? registrationApprovers[editingIndex] : null;
        const passwordHash = editingIndex !== null && !password ? existing?.password_hash || "" : password;

        const approverData = {
          full_name: fullName,
          designation,
          username,
          password_hash: passwordHash
        };

        if (editingIndex !== null) {
          registrationApprovers[editingIndex] = approverData;
        } else {
          registrationApprovers.push(approverData);
        }

        renderRegistrationApprovers();
        modalApi.close();
        form.removeEventListener("submit", handleSubmit);
        activeRegistrationApproverSubmit = null;
      };

      activeRegistrationApproverSubmit = handleSubmit;
      form.addEventListener("submit", handleSubmit);
    };

    const handleRemoveRegistrationApprover = (index) => {
      if (confirm(`Remove approver ${registrationApprovers[index]?.full_name || "this approver"}?`)) {
        registrationApprovers.splice(index, 1);
        renderRegistrationApprovers();
      }
    };

    // Add approver button
    const addRegistrationApproverBtn = document.getElementById("addRegistrationApproverBtn");
    if (addRegistrationApproverBtn) {
      addRegistrationApproverBtn.addEventListener("click", () => openRegistrationApproverModal());
    }

    // Initialize
    showStep(1);
    initRegistrationApprovers();

    // Final registration submission
    registerForm.addEventListener("submit", async (e) => {
      e.preventDefault();

      if (!validateStep3()) {
        return;
      }

      const data = collectFormData();
      const submitBtn = registerForm.querySelector('button[type="submit"]');
      const originalText = submitBtn?.textContent;

      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<div class="btn-spinner"></div> Creating Account...';
      }

      try {
        if (typeof supabaseClient === "undefined") {
          // Fallback to local storage
          localStorage.setItem("scUser", JSON.stringify(data));
          localStorage.setItem("scSession", JSON.stringify({ email: data.email, loggedAt: new Date().toISOString() }));
          alert("Registration saved locally (Supabase unavailable).");
          window.location.href = "sc-dashboard.html";
          return;
        }

        const { data: result, error } = await supabaseClient.rpc("register_sc_user", {
          p_store_name: data.storeName,
          p_store_address: data.storeAddress,
          p_contact_number: data.contactNumber,
          p_personnel: data.personnel,
          p_credit_limit: Number(data.creditAmount) || 0,
          p_terms: data.terms,
          p_email: data.email,
          p_password: data.password
        });

        if (error) {
          throw new Error(error.message || "Unable to register.");
        }

        const userRow = Array.isArray(result) ? result[0] : result;
        if (!userRow) {
          throw new Error("Registration succeeded but no user data returned.");
        }

        const storeId = String(userRow.store_id || userRow.storeId || "").trim();
        if (data.approvers && data.approvers.length && storeId) {
          const approverPromises = data.approvers.map((approver) =>
            supabaseClient.rpc("sc_upsert_approver", {
              p_store_id: storeId,
              p_approver_id: null,
              p_full_name: approver.full_name,
              p_designation: approver.designation,
              p_username: approver.username,
              p_password: approver.password_hash
            })
          );

          const results = await Promise.all(approverPromises);
          const failed = results.find((r) => r.error);
          if (failed) {
            console.warn("Unable to save some approvers", failed.error);
            alert("Registration successful, but some approvers could not be saved.");
          }
        }

        localStorage.setItem("scUser", JSON.stringify(userRow));
        localStorage.setItem("scSession", JSON.stringify({ email: data.email, loggedAt: new Date().toISOString() }));

        if (submitBtn) {
          submitBtn.innerHTML = '✓ Registration Complete!';
          submitBtn.style.background = 'var(--success)';
        }

        setTimeout(() => {
          window.location.href = "sc-dashboard.html";
        }, 1500);

      } catch (err) {
        console.error(err);
        alert(err.message || "Something went wrong while registering.");

        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = originalText || "Complete Registration";
        }
      }
    });
  }
};

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initScAuth);
} else {
  initScAuth();
}
