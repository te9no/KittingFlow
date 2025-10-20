import React, { useEffect } from "react";

export default function LoginButton({ onLogin }) {
  useEffect(() => {
    if (!window.google) return;
    window.google.accounts.id.initialize({
      client_id: "YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com", // Google Cloud Consoleで発行
      callback: (res) => onLogin(res.credential)
    });
    window.google.accounts.id.renderButton(
      document.getElementById("signinDiv"),
      { theme: "outline", size: "large" }
    );
  }, [onLogin]);

  return <div id="signinDiv" style={{ marginTop: "1rem" }}></div>;
}
