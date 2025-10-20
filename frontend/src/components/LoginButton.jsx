import React, { useEffect } from "react";

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || "REPLACE_WITH_GOOGLE_CLIENT_ID";

export default function LoginButton({ onLogin }) {
  useEffect(() => {
    if (!window.google || !GOOGLE_CLIENT_ID) {
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
  }, [onLogin]);

  return <div id="signinDiv" style={{ marginTop: "1rem" }} />;
}
