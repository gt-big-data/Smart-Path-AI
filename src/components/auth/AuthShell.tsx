import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import Icon from '../common/Icon';
import {
  authBrand,
  authBrandMark,
  authEyebrow,
  authHeader,
  authIntro,
  authIntroText,
  authIntroTitle,
  authMain,
  authPage,
  authPanel,
} from './authClasses';

interface AuthShellProps {
  eyebrow: string;
  title: ReactNode;
  description: string;
  children: ReactNode;
}

/** Shared frame for the login and sign-up pages: brand header, intro copy and the form panel. */
export default function AuthShell({ eyebrow, title, description, children }: AuthShellProps) {
  return (
    <div className={authPage}>
      <header className={authHeader}>
        <Link to="/" className={authBrand}>
          <span className={authBrandMark}>
            <Icon name="graph" size={18} />
          </span>
          <span>SmartPath</span>
        </Link>
      </header>
      <main className={authMain}>
        <section className={authIntro}>
          <span className={authEyebrow}>{eyebrow}</span>
          <h1 className={authIntroTitle}>{title}</h1>
          <p className={authIntroText}>{description}</p>
        </section>
        <section className={authPanel}>{children}</section>
      </main>
    </div>
  );
}
