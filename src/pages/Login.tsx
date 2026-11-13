import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useAuthFormField } from "../lib/authFormDraft";
import Icon from "../components/common/Icon";
import AuthShell from "../components/auth/AuthShell";
import {
  authAlert,
  authAlertTriggered,
  authAlertText,
  authAlertTitle,
  authDisclaimer,
  authDivider,
  authDividerLabel,
  authForm,
  authHeading,
  authHeadingText,
  authHeadingTitle,
  authInput,
  authLabel,
  authLink,
  authSubmit,
  googleButton,
  googleMark,
} from "../components/auth/authClasses";

export default function Login() {
  const [email, setEmail] = useAuthFormField("email");
  const [password, setPassword] = useAuthFormField("password");
  const [loginError, setLoginError] = useState(() =>
    new URLSearchParams(window.location.search).get("error") === "google_login_failed"
      ? "Google sign-in was cancelled or could not be completed. Please try again."
      : "",
  );
  // Incremented on every failed submit so the alert remounts and replays its shine, even when the message is unchanged.
  const [alertKey, setAlertKey] = useState(0);
  const navigate = useNavigate();
  const { login, loginWithGoogle } = useAuth();

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoginError("");
    try {
      await login(email, password);
      navigate("/");
    } catch (error: any) {
      setLoginError(error.response?.data?.message || error.message || "An error occurred");
      setAlertKey((key) => key + 1);
    }
  };

  return (
    <AuthShell
      eyebrow="Welcome back"
      title={<>Sign in to your<br />workspace.</>}
      description="Your graphs, conversations, quizzes, and practice exams stay together in one workspace."
    >
      <div className={authHeading}>
        <h2 className={authHeadingTitle}>Log in</h2>
        <p className={authHeadingText}>New to SmartPath? <Link className={authLink} to="/signup">Create one</Link></p>
      </div>
      {loginError && (
        <div key={alertKey} className={`${authAlert} ${authAlertTriggered}`} role="alert">
          <strong className={authAlertTitle}>Unable to log in</strong>
          <p className={authAlertText}>{loginError}</p>
        </div>
      )}
      <button type="button" className={googleButton} onClick={() => void loginWithGoogle()}>
        <span className={googleMark}>G</span>Sign in with Google
      </button>
      <div className={authDivider}><span className={authDividerLabel}>or continue with email</span></div>
      <form className={authForm} onSubmit={handleSubmit}>
        <label className={authLabel} htmlFor="login-email">
          Email address
          <input
            className={authInput}
            id="login-email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="name@example.com"
          />
        </label>
        <label className={authLabel} htmlFor="login-password">
          Password
          <input
            className={authInput}
            id="login-password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Enter your password"
          />
        </label>
        <button className={authSubmit} type="submit">
          Log in <Icon name="arrow" size={16} />
        </button>
      </form>
      <p className={authDisclaimer}>Your account details are securely handled by SmartPath.</p>
    </AuthShell>
  );
}
