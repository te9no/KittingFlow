import React, { useState } from "react";
import LoginButton from "./components/LoginButton";
import PickingView from "./components/PickingView";
import { verifyAndResume } from "./api";

export default function App() {
  const [user, setUser] = useState(null);
  const [msg, setMsg] = useState("");

  async function handleLogin(token) {
    const result = await verifyAndResume(token);
    setMsg(result);
    if (result.includes("✅")) setUser(true);
  }

  return (
    <div style={{ fontFamily: "sans-serif", textAlign: "center", paddingTop: "2rem" }}>
      <h2>🧩 KittingFlow iPad版（GitHub Full Auto Deploy）</h2>
      {!user && (
        <>
          <p>Googleアカウントでログインしてください。</p>
          <LoginButton onLogin={handleLogin} />
        </>
      )}
      {msg && <p>{msg}</p>}
      {user && <PickingView />}
    </div>
  );
}
