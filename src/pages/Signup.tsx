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
  authInputMismatch,
  authLabel,
  authLink,
  authSubmit,
  googleButton,
  googleMark,
  passwordCheck,
  passwordCheckValid,
  passwordChecks,
} from "../components/auth/authClasses";

const getPasswordRequirements = (value: string) => ({
  length: value.length >= 8 && value.length <= 32,
  uppercase: /[A-Z]/.test(value),
  lowercase: /[a-z]/.test(value),
  number: /\d/.test(value),
  special: /[!@#$%^&*(),.?":{}|<>]/.test(value),
});

const validatePassword = (password: string) => {
  if (password.length < 8) return "Password must be at least 8 characters long";
  if (password.length > 32) return "Password cannot be longer than 32 characters";
  if (!/[A-Z]/.test(password)) return "Password must contain at least one uppercase letter";
  if (!/[a-z]/.test(password)) return "Password must contain at least one lowercase letter";
  if (!/\d/.test(password)) return "Password must contain at least one number";
  if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) return "Password must contain at least one special character";
  return "";
};

export default function Signup() {
  const [email, setEmail] = useAuthFormField("email");
  const [password, setPassword] = useAuthFormField("password");
  const [confirmPassword, setConfirmPassword] = useAuthFormField("confirmPassword");
  const [name, setName] = useAuthFormField("name");
  const [error, setError] = useState("");
  // Incremented on every failed submit so the alert remounts and replays its shine, even when the message is unchanged.
  const [alertKey, setAlertKey] = useState(0);
  const showError = (message: string) => {
    setError(message);
    setAlertKey((key) => key + 1);
  };
  const passwordRequirements = getPasswordRequirements(password);
  const confirmMismatch = confirmPassword.length > 0 && confirmPassword !== password;
  const navigate = useNavigate();
  const { signup, loginWithGoogle } = useAuth();

  const handlePasswordChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setPassword(event.target.value);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    if (!name.trim() || !email.trim() || !password || !confirmPassword) {
      return showError("All fields are required");
    }
    const passwordError = validatePassword(password);
    if (passwordError) return showError(passwordError);
    if (password !== confirmPassword) return showError("Passwords do not match");
    try {
      await signup(email, password, name);
      navigate("/");
    } catch (err: any) {
      showError(err.response?.data?.message || err.message || "An error occurred");
    }
  };

  const checks = [
    { label: "At least 8 characters", valid: passwordRequirements.length },
    { label: "Contains an uppercase letter", valid: passwordRequirements.uppercase },
    { label: "Contains a number", valid: passwordRequirements.number },
    { label: "Contains a special character", valid: passwordRequirements.special },
  ];

  return (
    <AuthShell
      eyebrow="Start learning"
      title={<>Create your SmartPath<br />account.</>}
      description="Your graphs, conversations, quizzes, and practice exams stay together in one workspace."
    >
      <div className={authHeading}>
        <h2 className={authHeadingTitle}>Create account</h2>
        <p className={authHeadingText}>Already have an account? <Link className={authLink} to="/login">Log in</Link></p>
      </div>
      {error && (
        <div key={alertKey} className={`${authAlert} ${authAlertTriggered}`} role="alert">
          <strong className={authAlertTitle}>Check the following</strong>
          <p className={authAlertText}>{error}</p>
        </div>
      )}
      <button type="button" className={googleButton} onClick={() => void loginWithGoogle()}>
        <span className={googleMark}>G</span>Sign in with Google
      </button>
      <div className={authDivider}><span className={authDividerLabel}>or continue with email</span></div>
      <form className={authForm} onSubmit={handleSubmit}>
        <label className={authLabel} htmlFor="signup-name">
          Full name
          <input
            className={authInput}
            id="signup-name"
            autoComplete="name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Your name"
          />
        </label>
        <label className={authLabel} htmlFor="signup-email">
          Email address
          <input
            className={authInput}
            id="signup-email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="name@example.com"
          />
        </label>
        <label className={authLabel} htmlFor="signup-password">
          Password
          <input
            className={authInput}
            id="signup-password"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={handlePasswordChange}
            placeholder="Enter your password"
          />
        </label>
        <div className={passwordChecks}>
          {checks.map((check) => (
            <span className={check.valid ? passwordCheckValid : passwordCheck} key={check.label}>
              <Icon name={check.valid ? "check" : "x"} size={13} />
              {check.label}
            </span>
          ))}
        </div>
        <label className={authLabel} htmlFor="signup-confirm">
          Confirm password
          <input
            className={confirmMismatch ? authInputMismatch : authInput}
            id="signup-confirm"
            type="password"
            autoComplete="new-password"
            aria-invalid={confirmMismatch}
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            placeholder="Enter it again"
          />
        </label>
        <button className={authSubmit} type="submit">
          Create account <Icon name="arrow" size={16} />
        </button>
      </form>
      <p className={authDisclaimer}>By creating an account, you agree to SmartPath's terms and privacy policy.</p>
    </AuthShell>
  );
}
