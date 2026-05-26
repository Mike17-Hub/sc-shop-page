#!/usr/bin/env node
/* eslint-disable no-console */

const fs = require("fs");
const path = require("path");

const EOL = "\r\n";

const PAGE_WIDTH = 612; // US Letter (8.5in * 72)
const PAGE_HEIGHT = 792; // US Letter (11in * 72)
const MARGIN = { left: 54, right: 54, top: 64, bottom: 64 };

const STYLES = {
  title: { font: "F2", size: 18, leading: 24, maxChars: 48 },
  subtitle: { font: "F1", size: 11, leading: 15, maxChars: 90 },
  h2: { font: "F2", size: 13, leading: 18, maxChars: 70 },
  body: { font: "F1", size: 11, leading: 15, maxChars: 92 },
  bullet: { font: "F1", size: 11, leading: 15, maxChars: 86, indent: 14 },
  small: { font: "F1", size: 9, leading: 12, maxChars: 110 }
};

const escapePdfString = (value) => {
  return String(value || "")
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)")
    .replace(/\r?\n/g, " ");
};

const wrapText = (text, maxChars) => {
  const raw = String(text || "").trim();
  if (!raw) return [];
  const words = raw.split(/\s+/).filter(Boolean);
  const lines = [];
  let line = "";

  for (const word of words) {
    if (!line) {
      line = word;
      continue;
    }
    if ((line + " " + word).length <= maxChars) {
      line += " " + word;
      continue;
    }
    lines.push(line);
    line = word;
  }
  if (line) lines.push(line);
  return lines;
};

const buildGuideBlocks = (generatedDate) => {
  return [
    { style: "title", text: "Sister Company Portal - Quick Guide" },
    { style: "subtitle", text: "Guest browsing and registration (ordering)" },
    { style: "small", text: `Generated: ${generatedDate}` },
    { style: "spacer", lines: 1 },

    { style: "h2", text: "1) Browse as Guest" },
    {
      style: "body",
      text: 'From the SC Login page, click "Continue as Guest". You will be redirected to the Products page to browse the catalog.'
    },
    { style: "body", text: "As Guest, you can:" },
    { style: "bullet", text: "Browse products and use search / category filters." },
    { style: "bullet", text: "Open a product gallery to view images." },
    { style: "bullet", text: "View the catalog list (if available in your build)." },
    { style: "body", text: "As Guest, you cannot:" },
    { style: "bullet", text: "Place orders (adding to cart will prompt you to register or log in)." },
    { style: "bullet", text: "Use Cart/Orders features (navigation links are hidden in guest mode)." },
    { style: "spacer", lines: 1 },

    { style: "h2", text: "2) Register when you want to order" },
    {
      style: "body",
      text:
        'You can register from the login page by clicking "Not registered? Create an account", or when prompted after trying to add to cart as a Guest.'
    },
    { style: "body", text: "Registration steps:" },
    {
      style: "bullet",
      text:
        "Store Info: enter Store Name, Store Address, Contact Number, Assigned Personnel, Credit Amount, Terms, Email, and Password."
    },
    {
      style: "bullet",
      text:
        "Approvers: add one or more approver (OIC) accounts. You will need an approver username and password when placing (or cancelling) orders."
    },
    { style: "bullet", text: "Review: confirm details, then submit to complete registration." },
    {
      style: "body",
      text:
        "After successful registration, you will be redirected to the Dashboard and your account will be used for ordering."
    },
    { style: "spacer", lines: 1 },

    { style: "h2", text: "3) Place an order (registered users)" },
    { style: "body", text: "Once registered and logged in:" },
    { style: "bullet", text: "Go to Products, then click the cart button on an item to add it to your cart." },
    { style: "bullet", text: "Open Cart, select items, and adjust quantities if needed." },
    { style: "bullet", text: 'Click "Place order". An Approver (OIC) will be required to approve and place the order.' },
    { style: "bullet", text: "After ordering, use Orders to track status and details." },
    { style: "spacer", lines: 1 },

    { style: "h2", text: "4) Log out / switch accounts" },
    { style: "body", text: 'Use the "Logout" link in the header to end the current session.' },
    {
      style: "body",
      text:
        "If you were browsing as Guest and want to order, register first, then log in using your registered email and password."
    },
    { style: "spacer", lines: 1 },

    { style: "h2", text: "Need help?" },
    {
      style: "body",
      text: "If you are missing approver credentials or encounter access issues, contact your Golden Era Motors representative for provisioning."
    }
  ];
};

const layoutPages = (blocks) => {
  const pages = [];
  let pageLines = [];
  let y = PAGE_HEIGHT - MARGIN.top;

  const startNewPage = () => {
    if (pageLines.length) pages.push(pageLines);
    pageLines = [];
    y = PAGE_HEIGHT - MARGIN.top;
  };

  const ensureSpace = (needed) => {
    if (y - needed < MARGIN.bottom) startNewPage();
  };

  for (const block of blocks) {
    if (block.style === "spacer") {
      const lines = Number(block.lines) || 1;
      const step = STYLES.body.leading;
      ensureSpace(lines * step);
      y -= lines * step;
      continue;
    }

    const style = STYLES[block.style] || STYLES.body;
    const indent = style.indent || 0;
    const prefix = block.style === "bullet" ? "- " : "";
    const maxChars = style.maxChars || 90;
    const wrapped = wrapText(prefix + (block.text || ""), maxChars);
    if (!wrapped.length) continue;

    for (const lineText of wrapped) {
      ensureSpace(style.leading);
      pageLines.push({
        text: lineText,
        x: MARGIN.left + indent,
        y,
        font: style.font,
        size: style.size
      });
      y -= style.leading;
    }
  }

  if (pageLines.length) pages.push(pageLines);
  if (!pages.length) pages.push([]);
  return pages;
};

const buildContentStream = (lines) => {
  let content = "";
  content += `BT${EOL}`;

  let currentFont = "";
  let currentSize = -1;

  for (const line of lines) {
    const font = line.font || "F1";
    const size = Number(line.size) || 11;
    if (font !== currentFont || size !== currentSize) {
      content += `/${font} ${size} Tf${EOL}`;
      currentFont = font;
      currentSize = size;
    }
    const x = Number(line.x) || MARGIN.left;
    const y = Number(line.y) || (PAGE_HEIGHT - MARGIN.top);
    content += `1 0 0 1 ${x.toFixed(2)} ${y.toFixed(2)} Tm${EOL}`;
    content += `(${escapePdfString(line.text)}) Tj${EOL}`;
  }

  content += `ET${EOL}`;
  return content;
};

const buildPdf = ({ pages, title = "SC Portal Guide" }) => {
  const objects = [null];
  const addObject = (body) => {
    objects.push(body);
    return objects.length - 1;
  };

  const fontRegularObj = addObject("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
  const fontBoldObj = addObject("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>");

  const pageObjectNums = [];

  // Placeholder for /Pages tree; filled after pages are created.
  const pagesTreeObj = addObject("<< >>");

  for (let i = 0; i < pages.length; i += 1) {
    const pageLines = pages[i] || [];
    const footerText = `Page ${i + 1} of ${pages.length}`;
    const footerY = Math.max(24, MARGIN.bottom - 24);
    const footerLine = {
      text: footerText,
      x: PAGE_WIDTH / 2 - Math.min(80, footerText.length * 2.5),
      y: footerY,
      font: "F1",
      size: 9
    };

    const linesWithFooter = [...pageLines, footerLine];
    const contentStream = buildContentStream(linesWithFooter);
    const contentLength = Buffer.byteLength(contentStream, "utf8");

    const contentsObj = addObject(
      `<< /Length ${contentLength} >>${EOL}stream${EOL}${contentStream}endstream`
    );

    const pageObj = addObject(
      `<< /Type /Page /Parent ${pagesTreeObj} 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] ` +
        `/Resources << /ProcSet [/PDF /Text] /Font << /F1 ${fontRegularObj} 0 R /F2 ${fontBoldObj} 0 R >> >> ` +
        `/Contents ${contentsObj} 0 R >>`
    );
    pageObjectNums.push(pageObj);
  }

  const kids = pageObjectNums.map((n) => `${n} 0 R`).join(" ");
  objects[pagesTreeObj] = `<< /Type /Pages /Kids [ ${kids} ] /Count ${pageObjectNums.length} >>`;

  const infoObj = addObject(
    `<< /Title (${escapePdfString(title)}) /Producer (Codex CLI) >>`
  );

  const catalogObj = addObject(`<< /Type /Catalog /Pages ${pagesTreeObj} 0 R >>`);

  // Serialize
  const parts = [];
  const offsets = new Array(objects.length).fill(0);
  let byteOffset = 0;

  const append = (str) => {
    const buf = Buffer.from(str, "utf8");
    parts.push(buf);
    byteOffset += buf.length;
  };

  append(`%PDF-1.4${EOL}`);
  append(`%SC-Portal-Guide${EOL}`);

  for (let i = 1; i < objects.length; i += 1) {
    offsets[i] = byteOffset;
    append(`${i} 0 obj${EOL}`);
    append(`${objects[i]}${EOL}`);
    append(`endobj${EOL}`);
  }

  const xrefOffset = byteOffset;
  append(`xref${EOL}`);
  append(`0 ${objects.length}${EOL}`);
  append(`0000000000 65535 f ${EOL}`);
  for (let i = 1; i < objects.length; i += 1) {
    const off = String(offsets[i]).padStart(10, "0");
    append(`${off} 00000 n ${EOL}`);
  }

  append(`trailer${EOL}`);
  append(`<< /Size ${objects.length} /Root ${catalogObj} 0 R /Info ${infoObj} 0 R >>${EOL}`);
  append(`startxref${EOL}`);
  append(`${xrefOffset}${EOL}`);
  append(`%%EOF${EOL}`);

  return Buffer.concat(parts);
};

const main = () => {
  const outPath = path.resolve(process.cwd(), "docs", "sc-guest-registration-guide.pdf");
  const generatedDate = new Date().toISOString().slice(0, 10);
  const blocks = buildGuideBlocks(generatedDate);
  const pages = layoutPages(blocks);
  const pdf = buildPdf({
    pages,
    title: "Sister Company Portal - Guest & Registration Guide"
  });

  fs.writeFileSync(outPath, pdf);
  console.log(`Wrote ${outPath} (${pdf.length} bytes)`);
};

main();
