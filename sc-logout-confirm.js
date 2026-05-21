(() => {
  const logoutLinks = Array.from(document.querySelectorAll("[data-logout]"));
  if (!logoutLinks.length) return;

  const modal = document.createElement("div");
  modal.className = "sc-logout-modal";
  modal.setAttribute("aria-hidden", "true");
  modal.innerHTML = `
    <div class="sc-logout-panel" role="dialog" aria-modal="true" aria-label="Confirm logout">
      <div class="sc-logout-header">
        <h3>Confirm logout</h3>
        <button type="button" class="sc-logout-close" aria-label="Close confirmation">
          <span aria-hidden="true">&times;</span>
        </button>
      </div>
      <p class="sc-logout-body">Are you sure you want to log out of the Sister Company Portal?</p>
      <div class="sc-logout-actions">
        <button type="button" class="sc-logout-cancel">Cancel</button>
        <button type="button" class="sc-logout-confirm">Logout</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  const closeBtn = modal.querySelector(".sc-logout-close");
  const cancelBtn = modal.querySelector(".sc-logout-cancel");
  const confirmBtn = modal.querySelector(".sc-logout-confirm");
  let pendingHref = null;

  const openModal = (href) => {
    pendingHref = href;
    modal.classList.add("is-visible");
    modal.setAttribute("aria-hidden", "false");
    document.body.classList.add("has-logout-modal");
  };

  const closeModal = () => {
    modal.classList.remove("is-visible");
    modal.setAttribute("aria-hidden", "true");
    document.body.classList.remove("has-logout-modal");
    pendingHref = null;
  };

  logoutLinks.forEach((link) => {
    link.addEventListener("click", (event) => {
      event.preventDefault();
      openModal(link.href);
    });
  });

  closeBtn?.addEventListener("click", closeModal);
  cancelBtn?.addEventListener("click", closeModal);

  confirmBtn?.addEventListener("click", () => {
    if (pendingHref) {
      window.location.href = pendingHref;
    }
  });

  modal.addEventListener("click", (event) => {
    if (event.target === modal) closeModal();
  });

  document.addEventListener("keydown", (event) => {
    if (!modal.classList.contains("is-visible")) return;
    if (event.key === "Escape") closeModal();
  });
})();
