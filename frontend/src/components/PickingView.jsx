import React, { useEffect, useState } from "react";
import { getParts, getProgress, updateProgress } from "../api";

export default function PickingView() {
  const [parts, setParts] = useState([]);
  const [progress, setProgress] = useState({});
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [updating, setUpdating] = useState(false);

  async function loadData() {
    try {
      const [partsResponse, progressResponse] = await Promise.all([getParts(), getProgress()]);
      setParts(Array.isArray(partsResponse) ? partsResponse : []);
      setProgress(progressResponse || {});
    } catch (err) {
      console.error(err);
      setMessage("Failed to load picking data.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
    const intervalId = setInterval(loadData, 5000);
    return () => clearInterval(intervalId);
  }, []);

  if (loading) {
    return <p>Loading...</p>;
  }

  if (!parts.length) {
    return <p>No parts available.</p>;
  }

  const currentIndex = parts.findIndex(part => part["部品ID"] === progress["現在の部品ID"]);
  const currentPart = currentIndex >= 0 ? parts[currentIndex] : parts[0];
  const nextPart = currentIndex >= 0 ? parts[currentIndex + 1] : parts[1];

  async function handleNext() {
    if (!nextPart) {
      setMessage("All parts are complete.");
      return;
    }

    setUpdating(true);
    try {
      const result = await updateProgress(nextPart["部品ID"]);
      setMessage(result);
      await loadData();
    } catch (err) {
      console.error(err);
      setMessage("Failed to update progress.");
    } finally {
      setUpdating(false);
    }
  }

  return (
    <div style={{ marginTop: "1.5rem" }}>
      <h3>Picking Progress</h3>
      <p>
        <b>製品ID:</b> {progress["製品ID"] || "-"}
      </p>
      <p>
        <b>状態:</b> {progress["状態"] || "-"}
      </p>
      <p>
        <b>部品:</b> {currentPart && currentPart["部品名"] ? currentPart["部品名"] : "-"} /{" "}
        <b>必要数:</b> {currentPart && currentPart["必要数"] ? currentPart["必要数"] : "-"}
      </p>

      {currentPart && currentPart["画像URL"] && (
        <img
          src={currentPart["画像URL"]}
          width="220"
          height="220"
          alt={currentPart["部品名"] || "part"}
          style={{ borderRadius: 8, border: "1px solid #ccc" }}
        />
      )}

      <p style={{ marginTop: 10 }}>在庫: {currentPart && currentPart["在庫"] ? currentPart["在庫"] : "-"}</p>

      <div style={{ marginTop: "1rem" }}>
        <button
          onClick={handleNext}
          disabled={updating}
          style={{
            fontSize: "1.2rem",
            padding: "0.6rem 2rem",
            borderRadius: 10,
            backgroundColor: "#008cff",
            color: "white",
            border: "none",
            opacity: updating ? 0.7 : 1
          }}
        >
          {updating ? "Updating..." : nextPart ? "Next Part ▶" : "Complete"}
        </button>
      </div>

      {message && <p style={{ marginTop: "1rem", color: "#333" }}>{message}</p>}
    </div>
  );
}
