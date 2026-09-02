import React, { useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Float, OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { usePrefersReducedMotion } from '../../../hooks/usePrefersReducedMotion';

/**
 * Procedural Luxury Haute-Horlogerie / Celestial Armillary Model
 */
function LuxuryArmillary({ reducedMotion }) {
  const outerRingRef = useRef();
  const middleRingRef = useRef();
  const innerRingRef = useRef();
  const coreGemRef = useRef();

  // Procedural Luxury Materials
  const goldMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: new THREE.Color('#D4AF37'), // 18K Warm Gold
        metalness: 0.9,
        roughness: 0.18,
      }),
    []
  );

  const platinumMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: new THREE.Color('#E5E4E2'), // Polished Platinum
        metalness: 0.95,
        roughness: 0.12,
      }),
    []
  );

  const emeraldGemMaterial = useMemo(
    () =>
      new THREE.MeshPhysicalMaterial({
        color: new THREE.Color('#0F52BA'), // Royal Sapphire / Azure Blue
        metalness: 0.1,
        roughness: 0.05,
        transmission: 0.85,
        ior: 1.77,
        thickness: 1.2,
        reflectivity: 0.9,
      }),
    []
  );

  useFrame((state, delta) => {
    if (reducedMotion) return;

    if (outerRingRef.current) {
      outerRingRef.current.rotation.x += delta * 0.25;
      outerRingRef.current.rotation.y += delta * 0.35;
    }
    if (middleRingRef.current) {
      middleRingRef.current.rotation.y -= delta * 0.45;
      middleRingRef.current.rotation.z += delta * 0.2;
    }
    if (innerRingRef.current) {
      innerRingRef.current.rotation.x += delta * 0.3;
      innerRingRef.current.rotation.z -= delta * 0.4;
    }
    if (coreGemRef.current) {
      coreGemRef.current.rotation.y += delta * 0.6;
      coreGemRef.current.rotation.x += delta * 0.3;
    }
  });

  return (
    <group position={[0, 0, 0]} scale={[1.1, 1.1, 1.1]}>
      {/* Outer 18K Gold Armillary Ring */}
      <mesh ref={outerRingRef} material={goldMaterial}>
        <torusGeometry args={[2.2, 0.07, 24, 64]} />
      </mesh>

      {/* Middle Platinum Ring */}
      <mesh ref={middleRingRef} material={platinumMaterial}>
        <torusGeometry args={[1.75, 0.06, 24, 64]} />
      </mesh>

      {/* Inner Champagne Gold Ring */}
      <mesh ref={innerRingRef} material={goldMaterial}>
        <torusGeometry args={[1.3, 0.05, 24, 64]} />
      </mesh>

      {/* Faceted Sapphire Core Jewel */}
      <mesh ref={coreGemRef} material={emeraldGemMaterial}>
        <octahedronGeometry args={[0.7, 2]} />
      </mesh>

      {/* Celestial Diamond Spheres on Orbit */}
      <mesh position={[2.2, 0, 0]} material={platinumMaterial}>
        <sphereGeometry args={[0.12, 16, 16]} />
      </mesh>
      <mesh position={[-2.2, 0, 0]} material={goldMaterial}>
        <sphereGeometry args={[0.12, 16, 16]} />
      </mesh>
      <mesh position={[0, 1.75, 0]} material={platinumMaterial}>
        <sphereGeometry args={[0.1, 16, 16]} />
      </mesh>
    </group>
  );
}

/**
 * Interactive 3D Canvas
 */
export default function LuxuryHeroCanvas() {
  const reducedMotion = usePrefersReducedMotion();

  return (
    <div className="w-full h-full relative touch-pan-y" aria-label="3D Interactive Luxury Sculpture">
      <Canvas
        camera={{ position: [0, 0, 5.5], fov: 45 }}
        dpr={[1, 1.5]}
        gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
        className="w-full h-full"
      >
        {/* Studio Lighting Setup */}
        <ambientLight intensity={0.8} />
        <directionalLight position={[6, 6, 4]} intensity={2.2} color="#FFF8E7" />
        <pointLight position={[-5, -3, 3]} intensity={1.5} color="#9A6A45" />
        <pointLight position={[0, 4, -3]} intensity={1.8} color="#D4AF37" />

        {/* Floating motion wrapper */}
        {reducedMotion ? (
          <LuxuryArmillary reducedMotion={true} />
        ) : (
          <Float speed={1.5} rotationIntensity={0.6} floatIntensity={0.8}>
            <LuxuryArmillary reducedMotion={false} />
          </Float>
        )}

        {/* Interactive Orbit Controls with constrained damping and touch isolation */}
        <OrbitControls
          enableZoom={false}
          enablePan={false}
          autoRotate={false}
          maxPolarAngle={Math.PI / 1.5}
          minPolarAngle={Math.PI / 3}
          rotateSpeed={0.5}
          touches={{ ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN }}
        />
      </Canvas>
    </div>
  );
}
