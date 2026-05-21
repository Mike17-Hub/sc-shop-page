(() => {
  const getStored = (key) => {
    try {
      return JSON.parse(localStorage.getItem(key) || "null");
    } catch {
      return null;
    }
  };

  const currentPage = (() => {
    const path = window.location.pathname || "";
    const file = path.split("/").pop();
    return file || "index.html";
  })();

  const allowGuest = document.body?.dataset?.allowGuest === "true";
  if (allowGuest) return;

  if (currentPage === "index.html") return;

  const scUser = getStored("scUser");
  const scSession = getStored("scSession");
  const isLoggedIn = Boolean(scUser || scSession);

  if (!isLoggedIn) {
    window.location.href = "index.html";
  }
})();
