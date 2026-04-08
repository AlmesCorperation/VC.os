import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { usePIT } from '../hooks/useAudio';
import { vfs } from '../services/vfs';
import { kernel } from '../services/kernel';

const hashString = (str: string) => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return hash;
};

const seededRandom = (seed: number) => {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
};

const Tower = ({ position, rotation, height, color, seed }: { position: [number, number, number], rotation: [number, number, number], height: number, color: THREE.Color, seed: number }) => {
  const groupRef = useRef<THREE.Group>(null);
  
  useFrame((state) => {
    if (groupRef.current) {
      const t = state.clock.elapsedTime;
      // Independent floating motion
      groupRef.current.position.y = position[1] + Math.sin(t * 0.5 + seed) * 0.5;
      
      // Subtle rotation
      groupRef.current.rotation.x = rotation[0] + Math.sin(t * 0.2 + seed) * 0.05;
      groupRef.current.rotation.z = rotation[2] + Math.cos(t * 0.3 + seed) * 0.05;
    }
  });

  return (
    <group ref={groupRef} position={position} rotation={rotation}>
      {/* Glass Block */}
      <mesh>
        <boxGeometry args={[1.0, height, 1.0]} />
        <meshPhysicalMaterial 
          color={color}
          transparent
          opacity={0.3}
          roughness={0.1}
          metalness={0.1}
          transmission={0.6}
          thickness={1.5}
          clearcoat={1.0}
          emissive={color}
          emissiveIntensity={0.2}
        />
      </mesh>
      {/* Glowing Wireframe Edges */}
      <mesh>
        <boxGeometry args={[1.05, height + 0.05, 1.05]} />
        <meshBasicMaterial 
          color={color} 
          wireframe={true}
          transparent
          opacity={0.15}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
    </group>
  );
};

const Towers = () => {
  const groupRef = useRef<THREE.Group>(null);
  
  const towers = useMemo(() => {
    const dataItems: { id: string, size: number }[] = [];
    
    const files = vfs.ls();
    files.forEach(fileName => {
      const file = vfs.getFile(fileName);
      dataItems.push({ id: `vfs_${fileName}`, size: file.content?.length || 0 });
    });

    const lsKeys = ['vcos_username', 'vcos_save_state', 'vcos_games_state'];
    lsKeys.forEach(key => {
      const val = localStorage.getItem(key);
      if (val) {
        dataItems.push({ id: `ls_${key}`, size: val.length });
      }
    });

    if (dataItems.length === 0) {
      dataItems.push({ id: 'empty_system', size: 1024 });
    }

    return dataItems.map((item, i) => {
      const hash = hashString(item.id);
      const height = Math.max(3, Math.log10(item.size + 10) * 6);
      
      const x = (seededRandom(hash) - 0.5) * 30;
      const z = (seededRandom(hash + 1) - 0.5) * 30 - 15;
      const y = (seededRandom(hash + 2) - 0.5) * 10;
      
      const rotY = seededRandom(hash + 3) * Math.PI;
      const rotX = seededRandom(hash + 4) * Math.PI * 0.05;
      const rotZ = seededRandom(hash + 5) * Math.PI * 0.05;
      
      // PS2 Colors: Cyan, Deep Blue, Purple
      const colorPalette = [
        new THREE.Color(0.0, 0.5, 1.0), // Cyan
        new THREE.Color(0.1, 0.1, 0.8), // Deep Blue
        new THREE.Color(0.5, 0.0, 0.8), // Purple
      ];
      const colorIndex = Math.floor(seededRandom(hash + 6) * colorPalette.length);
      const color = colorPalette[colorIndex];

      return {
        id: item.id,
        position: [x, y, z] as [number, number, number],
        rotation: [rotX, rotY, rotZ] as [number, number, number],
        height,
        color,
        seed: seededRandom(hash + 9) * 100
      };
    });
  }, []);

  useFrame((state) => {
    if (groupRef.current) {
      // Slow drift
      groupRef.current.rotation.y = Math.sin(state.clock.elapsedTime * 0.05) * 0.1;
      // Zoom into the void
      const zoom = Math.min(20, state.clock.elapsedTime * 2);
      groupRef.current.position.z = -10 + zoom;
    }
  });

  return (
    <group ref={groupRef}>
      {towers.map((tower) => (
        <Tower 
          key={tower.id}
          position={tower.position}
          rotation={tower.rotation}
          height={tower.height}
          color={tower.color}
          seed={tower.seed}
        />
      ))}
    </group>
  );
};

const Particles = () => {
  const count = 200;
  const mesh = useRef<THREE.InstancedMesh>(null);
  
  const particles = useMemo(() => {
    const temp = [];
    for (let i = 0; i < count; i++) {
      const t = Math.random() * 100;
      const factor = 20 + Math.random() * 100;
      const speed = 0.01 + Math.random() / 200;
      const xFactor = -50 + Math.random() * 100;
      const yFactor = -50 + Math.random() * 100;
      const zFactor = -50 + Math.random() * 100;
      temp.push({ t, factor, speed, xFactor, yFactor, zFactor, mx: 0, my: 0 });
    }
    return temp;
  }, [count]);

  const dummy = useMemo(() => new THREE.Object3D(), []);

  useFrame((state) => {
    if (!mesh.current) return;
    particles.forEach((particle, i) => {
      let { t, factor, speed, xFactor, yFactor, zFactor } = particle;
      t = particle.t += speed / 2;
      const a = Math.cos(t) + Math.sin(t * 1) / 10;
      const b = Math.sin(t) + Math.cos(t * 2) / 10;
      const s = Math.cos(t);
      
      dummy.position.set(
        (particle.mx / 10) * a + xFactor + Math.cos((t / 10) * factor) + (Math.sin(t * 1) * factor) / 10,
        (particle.my / 10) * b + yFactor + Math.sin((t / 10) * factor) + (Math.cos(t * 2) * factor) / 10,
        (particle.my / 10) * b + zFactor + Math.cos((t / 10) * factor) + (Math.sin(t * 3) * factor) / 10
      );
      dummy.scale.set(s, s, s);
      dummy.rotation.set(s * 5, s * 5, s * 5);
      dummy.updateMatrix();
      mesh.current!.setMatrixAt(i, dummy.matrix);
    });
    mesh.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, count]}>
      <dodecahedronGeometry args={[0.1, 0]} />
      <meshBasicMaterial color="#aaaaff" transparent opacity={0.6} blending={THREE.AdditiveBlending} />
    </instancedMesh>
  );
};

const Scene = () => {
  return (
    <Canvas camera={{ position: [0, 0, 20], fov: 60 }} gl={{ antialias: true }}>
      <color attach="background" args={['#000000']} />
      {/* Deep Blue Fog - PS2 Style */}
      <fog attach="fog" args={['#000020', 10, 50]} />
      
      <ambientLight intensity={0.3} color="#4444ff" />
      <pointLight position={[10, 10, 10]} intensity={2} color="#8888ff" />
      <pointLight position={[-10, -10, -10]} intensity={1} color="#00ffff" />
      
      <Towers />
      <Particles />
    </Canvas>
  );
};

export const Bootloader: React.FC<{ onComplete: () => void }> = ({ onComplete }) => {
  const [phase, setPhase] = useState(0);
  const { playTone } = usePIT();

  useEffect(() => {
    // Phase 0: Towers Scene (0-6s)
    // Phase 1: White Flash (6-6.2s)
    // Phase 2: "VC.os Computer Entertainment" (6.2-9s)
    // Phase 3: "VC.os" Logo (9-14s)
    // Phase 4: Complete

    kernel.emitEvent('CRITICAL', 'BOOT_SEQ_START');
    kernel.executeTask('BOOTLOADER', 80);

    // PS2 Drone Sound
    playTone(55, 6, 'sine'); // Deep drone
    setTimeout(() => playTone(110, 5, 'triangle'), 500); // Harmonic
    setTimeout(() => playTone(220, 4, 'sine'), 1000); // Higher harmonic

    const t1 = setTimeout(() => {
      setPhase(1);
      playTone(880, 0.5, 'sine'); // Flash sound
    }, 6000);

    const t2 = setTimeout(() => {
      setPhase(2);
    }, 6200);

    const t3 = setTimeout(() => {
      setPhase(3);
      // PS2 Chime
      playTone(440, 2, 'sine');
      setTimeout(() => playTone(880, 2, 'sine'), 200);
      setTimeout(() => playTone(1320, 3, 'sine'), 400);
    }, 9000);

    const t4 = setTimeout(() => {
      setPhase(4);
      kernel.emitEvent('CRITICAL', 'BOOT_SEQ_COMPLETE');
      onComplete();
    }, 14000);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      clearTimeout(t4);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div 
      className="fixed inset-0 bg-black z-50 overflow-hidden flex items-center justify-center select-none cursor-pointer font-serif"
      onClick={onComplete}
    >
      <AnimatePresence>
        {phase === 0 && (
          <motion.div 
            key="scene"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0"
          >
            <Scene />
          </motion.div>
        )}

        {phase === 1 && (
          <motion.div 
            key="flash"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-white"
          />
        )}

        {phase === 2 && (
          <motion.div 
            key="text1"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 flex items-center justify-center bg-black"
          >
            <div className="bg-gradient-to-b from-black via-[#000020] to-black absolute inset-0" />
            <div className="relative z-10 flex flex-col items-center">
              <div className="w-12 h-12 mb-6 border-4 border-blue-500 rotate-45 opacity-80 shadow-[0_0_20px_rgba(0,0,255,0.5)]" />
              <div className="text-white text-4xl tracking-widest font-bold" style={{ textShadow: '0 0 10px rgba(255,255,255,0.5)', fontFamily: 'Times New Roman, serif' }}>
                VC.os
              </div>
              <div className="text-blue-400 text-xl tracking-[0.3em] mt-4 font-bold" style={{ fontFamily: 'Times New Roman, serif' }}>
                Computer Entertainment
              </div>
            </div>
          </motion.div>
        )}

        {phase === 3 && (
          <motion.div 
            key="logo"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.5, ease: "easeOut" }}
            className="absolute inset-0 flex flex-col items-center justify-center bg-black"
          >
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_#202060_0%,_#000000_70%)] opacity-50" />
            <div className="relative z-10 text-white text-8xl font-bold tracking-tighter" style={{ fontFamily: 'Arial, sans-serif', textShadow: '0 0 20px rgba(0,100,255,0.8)' }}>
              VC<span className="text-blue-500">.os</span>
            </div>
            <div className="relative z-10 text-blue-300 mt-8 text-2xl tracking-[0.5em] font-bold opacity-80" style={{ fontFamily: 'Arial, sans-serif' }}>
              VIBE CODE SYSTEM
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
