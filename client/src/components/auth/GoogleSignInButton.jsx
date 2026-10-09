import React, { useEffect, useRef, useState } from 'react';

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;

// Module-level singleton state to prevent duplicate google.accounts.id.initialize() calls
let isGsiScriptLoaded = false;
let isGsiScriptLoading = false;
let isGsiInitialized = false;
const scriptLoadCallbacks = [];
let currentSuccessHandler = null;
let currentErrorHandler = null;

const loadGsiScript = (callback) => {
  if (window.google?.accounts?.id) {
    isGsiScriptLoaded = true;
    callback();
    return;
  }

  if (isGsiScriptLoading) {
    scriptLoadCallbacks.push(callback);
    return;
  }

  isGsiScriptLoading = true;
  scriptLoadCallbacks.push(callback);

  const script = document.createElement('script');
  script.src = 'https://accounts.google.com/gsi/client';
  script.async = true;
  script.defer = true;
  script.onload = () => {
    isGsiScriptLoaded = true;
    isGsiScriptLoading = false;
    while (scriptLoadCallbacks.length) {
      const cb = scriptLoadCallbacks.shift();
      cb();
    }
  };
  script.onerror = () => {
    isGsiScriptLoading = false;
    console.warn('[GoogleSignIn] Failed to load Google Identity Services SDK.');
  };
  document.head.appendChild(script);
};

/**
 * Official Google Identity Services (GIS) Sign-In Button Component
 * 
 * @param {object} props
 * @param {(credential: string) => void} props.onSuccess
 * @param {(error: Error) => void} [props.onError]
 * @param {'signin_with' | 'signup_with' | 'continue_with' | 'signin'} [props.text='continue_with']
 * @param {string} [props.className='']
 * @param {boolean} [props.disabled=false]
 */
export default function GoogleSignInButton({
  onSuccess,
  onError,
  text = 'continue_with',
  className = '',
  disabled = false,
}) {
  const containerRef = useRef(null);
  const [isReady, setIsReady] = useState(false);
  const [hasClientId, setHasClientId] = useState(!!GOOGLE_CLIENT_ID);

  useEffect(() => {
    currentSuccessHandler = onSuccess;
    currentErrorHandler = onError;
  }, [onSuccess, onError]);

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) {
      setHasClientId(false);
      return;
    }

    setHasClientId(true);

    loadGsiScript(() => {
      if (!window.google?.accounts?.id || !containerRef.current) return;

      try {
        // Initialize Google Identity Services only once globally
        if (!isGsiInitialized) {
          window.google.accounts.id.initialize({
            client_id: GOOGLE_CLIENT_ID,
            callback: (response) => {
              if (response?.credential) {
                currentSuccessHandler?.(response.credential);
              } else {
                currentErrorHandler?.(new Error('No credential returned from Google Sign-In'));
              }
            },
            auto_select: false,
            cancel_on_tap_outside: true,
          });
          isGsiInitialized = true;
        }

        // Clear existing child elements before rendering button
        if (containerRef.current) {
          containerRef.current.innerHTML = '';
          window.google.accounts.id.renderButton(containerRef.current, {
            theme: 'outline',
            size: 'large',
            type: 'standard',
            text,
            shape: 'rectangular',
            logo_alignment: 'left',
            width: containerRef.current.offsetWidth || 340,
          });
        }

        setIsReady(true);
      } catch (err) {
        console.warn('[GoogleSignIn] Initialization warning:', err.message);
        onError?.(err);
      }
    });
  }, [text]);

  if (!hasClientId) {
    return (
      <div
        className={`w-full py-2.5 px-4 rounded-xl border border-[#E7DED5] bg-[#F7F3EE] text-center text-xs text-[#6F6963] select-none ${className}`}
        title="Set VITE_GOOGLE_CLIENT_ID in environment to enable official Google Sign-In"
      >
        <span className="font-medium text-[#2A211B]">Google Sign-In</span>
        <span className="block text-[11px] text-[#9A6A45] mt-0.5">Configuration pending (VITE_GOOGLE_CLIENT_ID)</span>
      </div>
    );
  }

  return (
    <div
      className={`w-full flex justify-center items-center min-h-[44px] ${disabled ? 'opacity-50 pointer-events-none' : ''} ${className}`}
    >
      <div
        ref={containerRef}
        id="google-signin-btn-container"
        className="w-full flex justify-center"
      />
    </div>
  );
}
