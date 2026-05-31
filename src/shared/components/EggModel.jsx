import { Canvas, useFrame } from '@react-three/fiber';
import { useGLTF, Center } from '@react-three/drei';
import { useRef } from 'react';

function RotatingEgg() {
  const meshRef = useRef();
  const { scene } = useGLTF('/Egg.glb');

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
