import React, { useEffect, useMemo, useState } from "react";
import { db, getProgress, setProgress, getPartsForProduct } from "../db";
import { buttonStyles, hoverStyles, createHoverHandlers } from "../styles/buttons";

const STATE_READY = "準備中";
const modalOverlayStyle = {
  position: "fixed",
  inset: 0,
  background: "rgba(15,23,42,0.55)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 1000,
  padding: "16px"
};

const modalStyle = {
  background: "#fff",
  borderRadius: 16,
  padding: 24,
  width: "min(420px, 100%)",
  boxShadow: "0 20px 45px rgba(15, 23, 42, 0.25)",
  textAlign: "center",
  fontFamily: "Inter, system-ui, sans-serif"
};

const sorters = {
  productId: (a, b) => a.productId.localeCompare(b.productId, "ja"),
  productName: (a, b) => (a.productName || "").localeCompare(b.productName || "", "ja"),
  state: (a, b) => (a.state || "").localeCompare(b.state || "", "ja"),
  progress: (a, b) => {
    const progressA = a.total ? (a.currentIndex + 1) / a.total : 0;
    const progressB = b.total ? (b.currentIndex + 1) / b.total : 0;
    return progressA - progressB;
  }
};

function sortIndicator(active, direction) {
  if (!active) return "";
  return direction === "asc" ? " ▲" : " ▼";
}

export default function ProgressTable() {
  const [rows, setRows] = useState([]);
  const [qrTarget, setQrTarget] = useState(null);
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [qrLoading, setQrLoading] = useState(false);
  const [qrError, setQrError] = useState("");
  const [sortKey, setSortKey] = useState("productId");
  const [sortDir, setSortDir] = useState("asc");

  useEffect(() => {
    load();
  }, []);

  async function load() {
    const products = await db.products.toArray();
    const list = [];
    for (const product of products) {
      const progress = await getProgress(product.id);
      const parts = await getPartsForProduct(product.id);
      list.push({
        productId: product.id,
        productName: product.name,
        total: parts.length,
        currentIndex: Number(progress.currentIndex ?? 0),
        state: progress.state || STATE_READY
      });
    }
    setRows(list);
  }

  function toggleSort(key) {
    if (sortKey === key) {
      setSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  const sortedRows = useMemo(() => {
    const sorter = sorters[sortKey] || sorters.productId;
    const list = [...rows].sort(sorter);
    return sortDir === "asc" ? list : list.reverse();
  }, [rows, sortKey, sortDir]);

  const operationsCellStyle = useMemo(
    () => ({
      padding: 8,
      display: "grid",
      gridTemplateColumns: "auto auto auto auto",
      alignItems: "center",
      justifyContent: "end",
      gap: 12
    }),
    []
  );

  const stepLabelStyle = useMemo(
    () => ({
      display: "flex",
      alignItems: "center",
      gap: 6,
      fontSize: "0.95rem",
      color: "#1f2937"
    }),
    []
  );

  const resetHoverHandlers = useMemo(
    () => createHoverHandlers(() => ({ ...buttonStyles.secondary }), hoverStyles.secondary, true),
    []
  );
  const deleteHoverHandlers = useMemo(
    () => createHoverHandlers(buttonStyles.danger, hoverStyles.danger, true),
    []
  );
  const qrHoverHandlers = useMemo(
    () => createHoverHandlers(buttonStyles.primary, hoverStyles.primary, true),
    []
  );
  const modalCloseHover = useMemo(
    () => createHoverHandlers(() => buttonStyles.secondary, hoverStyles.secondary, true),
    []
  );

  const resetButtonStyle = useMemo(
    () => ({ ...buttonStyles.secondary, minWidth: 90, justifySelf: "end" }),
    []
  );
  const qrButtonStyle = useMemo(
    () => ({ ...buttonStyles.primary(true), minWidth: 120, justifySelf: "end" }),
    []
  );
  const deleteButtonStyle = useMemo(
    () => ({ ...buttonStyles.danger(true), minWidth: 90, justifySelf: "end" }),
    []
  );

  async function reset(productId) {
    await setProgress(productId, { state: STATE_READY, currentIndex: 0 });
    await load();
  }

  async function updateIndex(productId, index, total) {
    const safeIndex = Math.min(Math.max(index, 0), Math.max(total - 1, 0));
    await setProgress(productId, { currentIndex: safeIndex });
    await load();
  }

  async function remove(productId) {
    await db.transaction("rw", db.products, db.progress, async () => {
      await db.products.delete(productId);
      await db.progress.delete(productId);
    });
    await load();
  }

  async function openQrModal(row) {
    setQrTarget(row);
    setQrDataUrl("");
    setQrError("");
    setQrLoading(true);
    try {
      const payload = JSON.stringify({ productId: row.productId, productName: row.productName });
      const response = await fetch(
        `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(payload)}`
      );
      if (!response.ok) throw new Error("QRコードの生成に失敗しました");
      const blob = await response.blob();
      const dataUrl = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
      setQrDataUrl(dataUrl);
    } catch (error) {
      setQrError(error.message || "QRコードの取得に失敗しました");
    } finally {
      setQrLoading(false);
    }
  }

  function closeQrModal() {
    setQrTarget(null);
    setQrDataUrl("");
    setQrError("");
  }

  function printQrLabel() {
  if (!qrTarget || !qrDataUrl) return;
  const printWindow = window.open(\"\", \"_blank\", \"width=400,height=600\");
  if (!printWindow) return;
  const labelCss = 
      @page {
        size: 40mm 30mm;
        margin: 2mm;
      }
      body {
        margin: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        font-family: 'Inter', system-ui, sans-serif;
        color: #111827;
      }
      .label {
        text-align: center;
      }
      .label img {
        width: 180px;
        height: 180px;
        object-fit: contain;
      }
      .label h2 {
        font-size: 14px;
        margin: 6px 0 0;
      }
      .label p {
        font-size: 12px;
        margin: 4px 0 0;
      }
    ;
  const printScript = 
      window.onload = function () {
        const img = document.getElementById('qr-image');
        function finish() {
          setTimeout(function () {
            window.focus();
            window.print();
          }, 150);
        }
        if (img) {
          if (img.complete) {
            finish();
          } else {
            img.onload = finish;
            img.onerror = finish;
          }
        } else {
          finish();
        }
        window.onafterprint = function () {
          window.close();
        };
      };
    ;
  printWindow.document.write(
      <html>
        <head>
          <title> - QR</title>
          <style></style>
        </head>
        <body>
          <div class=\"label\">
            <img id=\"qr-image\" src=\"\" alt=\"QR code\" />
            <h2></h2>
            <p></p>
          </div>
          <script><\\/script>
        </body>
      </html>
    );
  printWindow.document.close();
}


