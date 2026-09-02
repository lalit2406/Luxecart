/**
 * WebGL Capability Detection Utility
 * Safely tests whether the client browser & device can create a WebGL context
 * @returns {boolean}
 */
export const isWebGLSupported = () => {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return false;
  }

  try {
    const canvas = document.createElement('canvas');
    const gl =
      canvas.getContext('webgl2') ||
      canvas.getContext('webgl') ||
      canvas.getContext('experimental-webgl');

    return Boolean(gl && gl instanceof WebGLRenderingContext || (window.WebGL2RenderingContext && gl instanceof WebGL2RenderingContext));
  } catch (e) {
    return false;
  }
};

export default isWebGLSupported;
