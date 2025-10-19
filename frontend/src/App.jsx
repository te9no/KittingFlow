import React, { useState } from "react";
import LoginButton from "./components/LoginButton";
import PickingView from "./components/PickingView";
import { verifyAndResume } from "./api";

export default function App() {
  const [userVerified, setUserVerified] = useState(false);
  const [message, setMessage] = useState("");

  async function handleLogin(idToken) {
    try {
      const result = await verifyAndResume(idToken);
      setMessage(result);
      if (result && !result.toLowerCase().includes("error")) {
        setUserVerified(true);
      }
    } catch (err) {
      console.error(err);
      setMessage("Login failed. Please try again.");
    }
  }

  return (
    <div style={{ fontFamily: "sans-serif", textAlign: "center", paddingTop: "2rem" }}>
      <h2>KittingFlow iPad Secure Edition</h2>
      {!userVerified && (
        <>
          <p>Please sign in with your Google account.</p>
          <LoginButton onLogin={handleLogin} />
        </>
      )}
      {message && <p>{message}</p>}
      {userVerified && <PickingView />}
    </div>
  );
}
