import React from 'react';
import {
  loaderDetail,
  loaderDot,
  loaderDots,
  loaderTitle,
  orbitCore,
  orbitLoader,
  orbitSystem,
  planetClass,
  progressFill,
  progressLabel,
  progressTrack,
} from './graphClasses';

interface GraphLoaderProps {
  title: string;
  detail: string;
  /** 0-100 while a file is processing; omit for an indeterminate loader */
  progress?: number;
  /** Optional actions shown under the progress, such as Cancel */
  children?: React.ReactNode;
}

/** Orbiting loader with a title, detail line and either a progress bar or pulsing dots */
export default function GraphLoader({ title, detail, progress, children }: GraphLoaderProps) {
  return (
    <div className={orbitLoader} role="status">
      <div className={orbitSystem} aria-hidden="true">
        <span className={orbitCore} />
        <span className={planetClass.amber} />
        <span className={planetClass.blue} />
        <span className={planetClass.violet} />
        <span className={planetClass.teal} />
      </div>
      <h2 className={loaderTitle}>{title}</h2>
      <p className={loaderDetail}>{detail}</p>
      {progress === undefined ? (
        <div className={loaderDots} aria-hidden="true">
          <span className={loaderDot} />
          <span className={loaderDot} style={{ animationDelay: '0.16s' }} />
          <span className={loaderDot} style={{ animationDelay: '0.32s' }} />
        </div>
      ) : (
        <>
          <div className={progressTrack} aria-hidden="true">
            <span className={progressFill} style={{ width: `${progress}%`, display: 'block' }} />
          </div>
          <strong className={progressLabel}>{progress}% completed</strong>
        </>
      )}
      {children}
    </div>
  );
}
