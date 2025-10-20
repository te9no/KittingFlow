import React, { useEffect } from "react";

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || "";

export default function LoginButton({ onLogin }) {
  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) {
      console.warn("VITE_GOOGLE_CLIENT_ID is not set; Google Sign-In cannot initialise.");
      return;
    }
    if (!window.google) {
      console.warn("Google Identity Services script not yet available.");
      return;
    }

    window.google.accounts.id.initialize({
      client_id: GOOGLE_CLIENT_ID,
      callback: response => onLogin(response.credential)
    });

    window.google.accounts.id.renderButton(document.getElementById("signinDiv"), {
      theme: "outline",
      size: "large"
    });
  }, [onLogin, GOOGLE_CLIENT_ID]);

  return <div id="signinDiv" style={{ marginTop: "1rem" }} />;
}
