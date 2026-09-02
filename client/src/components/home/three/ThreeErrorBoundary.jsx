import React from 'react';

/**
 * Three.js / WebGL Error Boundary
 * Prevents WebGL or 3D canvas exceptions from crashing the storefront UI.
 */
export class ThreeErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.warn('Three.js / WebGL 3D rendering gracefully failed, falling back to static visual:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || null;
    }
    return this.props.children;
  }
}

export default ThreeErrorBoundary;
