import React, { useRef, useState, useEffect, Suspense, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Center, useGLTF, Float } from '@react-three/drei';
import * as THREE from 'three';
import { RotateCcw, ZoomIn, ZoomOut, Play, Pause, AlertCircle, RefreshCw } from 'lucide-react';
import { usePrefersReducedMotion } from '../../../hooks/usePrefersReducedMotion';
import { isWebGLSupported } from '../../../utils/webgl';

/**
 * GLTF/GLB Loaded Model Renderer
 */
function RemoteModel({ url, autoRotate, reducedMotion }) {
  const modelRef = useRef();
  const { scene } = useGLTF(url);

  // Clone scene so multiple instances don't share identical material mutations
  const clonedScene = useMemo(() => scene.clone(), [scene]);

  useFrame((_, delta) => {
    if (autoRotate && !reducedMotion && modelRef.current) {
      modelRef.current.rotation.y += delta * 0.4;
    }
  });

  return (
    <primitive
      ref={modelRef}
      object={clonedScene}
      dispose={null}
    />
  );
}

/**
 * Procedural Luxury Product Fallback Model (Haute-Horlogerie Chronometer)
 */
function ProceduralLuxuryProduct({ autoRotate, reducedMotion }) {
  const meshRef = useRef();

  const goldMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: new THREE.Color('#D4AF37'),
        metalness: 0.92,
        roughness: 0.15,
      }),
    []
  );

  const sapphireMat = useMemo(
    () =>
      new THREE.MeshPhysicalMaterial({
        color: new THREE.Color('#0F52BA'),
        metalness: 0.1,
        roughness: 0.05,
        transmission: 0.85,
        thickness: 1.2,
      }),
    []
  );

  const leatherBandMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: new THREE.Color('#2A211B'),
        metalness: 0.1,
        roughness: 0.7,
      }),
    []
  );

  useFrame((_, delta) => {
    if (autoRotate && !reducedMotion && meshRef.current) {
      meshRef.current.rotation.y += delta * 0.4;
    }
  });

  return (
    <group ref={meshRef} scale={[1.2, 1.2, 1.2]}>
      {/* Watch Case */}
      <mesh material={goldMat}>
        <cylinderGeometry args={[1.2, 1.2, 0.3, 48]} />
      </mesh>
      {/* Sapphire Crystal Dial Face */}
      <mesh position={[0, 0.16, 0]} material={sapphireMat}>
        <cylinderGeometry args={[1.05, 1.05, 0.05, 48]} />
      </mesh>
      {/* Crown Button */}
      <mesh position={[1.25, 0, 0]} rotation={[0, 0, Math.PI / 2]} material={goldMat}>
        <cylinderGeometry args={[0.15, 0.15, 0.2, 24]} />
      </mesh>
      {/* Top Leather Strap */}
      <mesh position={[0, 1.2, -0.05]} material={leatherBandMat}>
        <boxGeometry args={[0.9, 1.4, 0.12]} />
      </mesh>
      {/* Bottom Leather Strap */}
      <mesh position={[0, -1.2, -0.05]} material={leatherBandMat}>
        <boxGeometry args={[0.9, 1.4, 0.12]} />
      </mesh>
    </group>
  );
}

/**
 * Interactive 3D Product Viewer
 */
export default function Product3DViewer({
  modelUrl = null,
  posterUrl = null,
  productTitle = 'Luxury Product',
  onFallback = null,
}) {
  const reducedMotion = usePrefersReducedMotion();
  const controlsRef = useRef();
  const [autoRotate, setAutoRotate] = useState(!reducedMotion);
  const [hasModelError, setHasModelError] = useState(false);

  useEffect(() => {
    if (reducedMotion) {
      setAutoRotate(false);
    }
  }, [reducedMotion]);

  const handleResetView = () => {
    if (controlsRef.current) {
      controlsRef.current.reset();
    }
  };

  const isRemoteModel = Boolean(modelUrl && /^(https:\/\/|\/|\.\/)/i.test(modelUrl) && !hasModelError);

  if (!isWebGLSupported()) {
    return (
      <div className="relative w-full h-[380px] sm:h-[480px] rounded-2xl overflow-hidden bg-[#F7F3EE] border border-[#E7DED5] flex items-center justify-center p-6 text-center text-xs text-[#705E51]">
        {posterUrl && (
          <img
            src={posterUrl}
            alt={productTitle}
            className="w-full h-full object-cover rounded-xl"
          />
        )}
        <span className="absolute bottom-4 left-4 bg-white/90 px-3 py-1.5 rounded-xl text-[11px] font-semibold border border-[#E7DED5] text-[#171513] shadow-xs">
          3D View Unavailable — Showing Photo
        </span>
      </div>
    );
  }

  return (
    <div
      className="relative w-full h-[380px] sm:h-[480px] rounded-2xl bg-gradient-to-b from-[#F7F3EE] to-[#E7DED5]/70 border border-[#E7DED5] overflow-hidden select-none group touch-pan-y"
      aria-label={`3D interactive view for ${productTitle}`}
    >
      <Canvas
        camera={{ position: [0, 0, 4.2], fov: 45 }}
        dpr={[1, 1.5]}
        gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
        className="w-full h-full cursor-grab active:cursor-grabbing"
      >
        <ambientLight intensity={0.9} />
        <directionalLight position={[5, 6, 5]} intensity={2.0} color="#FFF9EE" />
        <directionalLight position={[-5, -3, -4]} intensity={0.8} color="#9A6A45" />
        <pointLight position={[0, 4, 2]} intensity={1.2} color="#D4AF37" />

        <Suspense fallback={null}>
          <Center>
            {isRemoteModel ? (
              <RemoteModel
                url={modelUrl}
                autoRotate={autoRotate}
                reducedMotion={reducedMotion}
              />
            ) : (
              <ProceduralLuxuryProduct
                autoRotate={autoRotate}
                reducedMotion={reducedMotion}
              />
            )}
          </Center>
        </Suspense>

        <OrbitControls
          ref={controlsRef}
          enablePan={false}
          enableZoom={true}
          enableDamping={true}
          dampingFactor={0.06}
          minDistance={2.0}
          maxDistance={7.0}
          rotateSpeed={0.7}
          zoomSpeed={0.8}
          maxPolarAngle={Math.PI / 1.4}
          minPolarAngle={Math.PI / 4}
          touches={{ ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN }}
        />
      </Canvas>

      {/* Floating Control Overlay */}
      <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between pointer-events-none">
        <div className="flex items-center gap-1.5 bg-white/90 backdrop-blur-md px-3 py-1.5 rounded-xl border border-[#E7DED5] shadow-xs pointer-events-auto text-[11px] font-semibold text-[#171513]">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span>Interactive 3D Inspection</span>
        </div>

        <div className="flex items-center gap-2 bg-white/90 backdrop-blur-md p-1.5 rounded-xl border border-[#E7DED5] shadow-xs pointer-events-auto">
          {/* Auto-rotate Toggle */}
          {!reducedMotion && (
            <button
              onClick={() => setAutoRotate((prev) => !prev)}
              className={`p-1.5 rounded-lg border transition-colors ${
                autoRotate
                  ? 'bg-[#171513] text-white border-[#171513]'
                  : 'bg-white text-[#705E51] border-[#E7DED5] hover:bg-[#F7F3EE]'
              }`}
              title={autoRotate ? 'Pause Rotation' : 'Auto Rotate'}
              aria-label={autoRotate ? 'Pause 3D rotation' : 'Start 3D rotation'}
            >
              {autoRotate ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
            </button>
          )}

          {/* Reset Camera View */}
          <button
            onClick={handleResetView}
            className="p-1.5 rounded-lg border border-[#E7DED5] bg-white text-[#705E51] hover:text-[#171513] hover:bg-[#F7F3EE] transition-colors"
            title="Reset Camera View"
            aria-label="Reset 3D view"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
