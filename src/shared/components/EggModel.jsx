import { Canvas, useFrame } from '@react-three/fiber';
import { useGLTF, Center } from '@react-three/drei';
import { useRef } from 'react';
import * as THREE from 'three';

function RotatingEgg() {
  const meshRef = useRef();
  const { scene } = useGLTF('/Egg.glb');

  // Traverse the scene to clean up helper nodes and style the egg mesh
  scene.traverse((child) => {
    // Hide the default exported background panel and lights
    if (
      child.name === 'Rectangle' || 
      child.name.includes('Light') || 
      child.isLight || 
      child.isCamera
    ) {
      child.visible = false;
    }

    // Override the material of the egg mesh for a premium eggshell look
    if (child.isMesh && child.name === 'Egg') {
      child.material = new THREE.MeshStandardMaterial({
        color: new THREE.Color('#F0E6D2'), // Warm natural eggshell color
        roughness: 0.45,                   // Soft matte shell finish
        metalness: 0.05,                   // Subtle organic response to light
      });
    }
  });

  // Rotate the model around Y axis
  useFrame((state, delta) => {
    if (meshRef.current) {
      meshRef.current.rotation.y += delta * 0.8;
    }
  });

  return (
    <primitive 
      ref={meshRef} 
      object={scene} 
      scale={1.8} 
      position={[0, 0, 0]} 
    />
  );
}

export default function EggModel() {
  return (
    <div className="w-full h-full pointer-events-none">
      <Canvas
        camera={{ position: [0, 0, 4.5], fov: 45 }}
        gl={{ alpha: true, antialias: true }}
        style={{ background: 'transparent' }}
      >
        <ambientLight intensity={1.8} />
        <directionalLight position={[5, 5, 5]} intensity={2.0} />
        <pointLight position={[-5, 5, -5]} intensity={1.0} />
        <Center>
          <RotatingEgg />
        </Center>
      </Canvas>
    </div>
  );
}

// Preload the GLB model to avoid loading delay
useGLTF.preload('/Egg.glb');
