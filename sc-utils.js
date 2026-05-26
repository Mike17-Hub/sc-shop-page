(() => {
  const defaultR2BaseUrl = "https://pub-431a1eccf270455a99eab6163255ef53.r2.dev";
  const storedR2BaseUrl = (() => {
    try {
      return String(localStorage.getItem("scR2BaseUrl") || "").trim();
    } catch {
      return "";
    }
  })();

  const normalizeR2BaseUrl = (value, fallback = defaultR2BaseUrl) => {
    const raw = String(value || "").trim();
    if (!raw) return fallback;

    const trimmed = raw.replace(/\/+$/, "");
    const asUrl = (input) => {
      try {
        return new URL(input);
      } catch {
        return null;
      }
    };

    const absolute = asUrl(trimmed);
    if (absolute && (absolute.protocol === "http:" || absolute.protocol === "https:")) {
      return absolute.origin;
    }

    const withScheme = asUrl(`https://${trimmed.replace(/^https?:\/\//, "")}`);
    if (withScheme && (withScheme.protocol === "http:" || withScheme.protocol === "https:")) {
      return withScheme.origin;
    }

    return fallback;
  };

  const r2BaseUrl = normalizeR2BaseUrl(storedR2BaseUrl, defaultR2BaseUrl);

  const placeholderSvg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="960" height="640" viewBox="0 0 960 640">
      <defs>
        <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#0b0d12"/>
          <stop offset="1" stop-color="#171b24"/>
        </linearGradient>
      </defs>
      <rect width="960" height="640" fill="url(#bg)"/>
      <rect x="80" y="88" width="800" height="464" rx="28" fill="#0f1219" stroke="#2a3240" stroke-width="2"/>
      <path d="M210 454l150-170 120 120 200-240 170 290H210z" fill="#202837"/>
      <circle cx="330" cy="248" r="44" fill="#202837"/>
      <text x="480" y="520" text-anchor="middle" fill="#9aa4b2" font-family="Arial, sans-serif" font-size="26">Image unavailable</text>
    </svg>
  `.trim();
  const placeholderImage = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(placeholderSvg)}`;

  window.scUtils = {
    r2BaseUrl,
    placeholderImage,

    formatCurrency: (value, currency = "PHP") => {
      const number = Number(value);
      if (!Number.isFinite(number)) return `${currency} 0.00`;
      return `${currency} ${number.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    },

    getScUser: () => {
      try {
        return JSON.parse(sessionStorage.getItem("scUser") || "null");
      } catch {
        return null;
      }
    },

    setR2BaseUrl: (nextUrl) => {
      const normalized = normalizeR2BaseUrl(nextUrl, "");
      try {
        if (!normalized) {
          localStorage.removeItem("scR2BaseUrl");
        } else {
          localStorage.setItem("scR2BaseUrl", normalized);
        }
      } catch {
        // Ignore storage errors (private mode, disabled storage).
      }
      window.location.reload();
    }
  };
})();
