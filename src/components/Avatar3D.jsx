import { useRef, useEffect, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { useGLTF, OrbitControls, Environment } from '@react-three/drei';
import * as THREE from 'three';

// Viseme to blendshape mapping for Ready Player Me avatars
// These are common blendshape names in RPM models
const VISEME_MAP = {
  0: 'sil', // silence
  1: 'PP',  // PP (p, b, m)
  2: 'FF',  // FF (f, v)
  3: 'TH',  // TH (th)
  4: 'DD',  // DD (d, t, k, g, n)
  5: 'kk',  // kk (k, g)
  6: 'CH',  // CH (ch, j)
  7: 'SS',  // SS (s, z)
  8: 'nn',  // nn (n)
  9: 'RR',  // RR (r)
  10: 'aa',  // aa (a)
  11: 'E',   // E (e)
  12: 'ih',  // ih (i)
  13: 'oh',  // oh (o)
  14: 'ou',  // ou (u)
};

// Fallback mapping if the model uses different names
const FALLBACK_MAP = {
  mouthOpen: 'jawOpen',
  viseme_sil: 'sil',
  viseme_PP: 'PP',
  viseme_FF: 'FF',
  viseme_TH: 'TH',
  viseme_DD: 'DD',
  viseme_kk: 'kk',
  viseme_CH: 'CH',
  viseme_SS: 'SS',
  viseme_nn: 'nn',
  viseme_RR: 'RR',
  viseme_aa: 'aa',
  viseme_E: 'E',
  viseme_ih: 'ih',
  viseme_oh: 'oh',
  viseme_ou: 'ou',
};

function AvatarModel({ viseme, speaking }) {
  const { scene } = useGLTF('/avatar.glb');
  const meshRef = useRef(null);
  const groupRef = useRef(null);
  const positionRef = useRef([0, -1.6, 0]);
  const previousVisemeRef = useRef(null);
  const morphTargetInfluencesRef = useRef({});
  
  // Animation state
  const blinkTimerRef = useRef(null);
  const headRotationRef = useRef({ x: 0, y: 0, z: 0 });
  const bodySwayRef = useRef(0);
  const expressionRef = useRef('neutral');
  const lastVisemeTimeRef = useRef(0);
  const visemeStrengthRef = useRef(0);

  useEffect(() => {
    if (!scene) return;

    // Find the mesh with morph targets (usually the head/face)
    scene.traverse((child) => {
      if (child.isMesh && child.morphTargetInfluences) {
        meshRef.current = child;
        
        // Get available morph target names
        const morphTargetNames = child.morphTargetDictionary || {};
        console.log('Available morph targets:', Object.keys(morphTargetNames));
        
        // Store mapping of viseme names to indices
        Object.keys(morphTargetNames).forEach((name) => {
          const index = morphTargetNames[name];
          morphTargetInfluencesRef.current[name] = index;
        });
      }
    });

    // Find the root group for head/body movement
    if (scene.children && scene.children.length > 0) {
      groupRef.current = scene;
    }

    // Blinking animation
    const scheduleBlink = () => {
      const blinkDelay = 2000 + Math.random() * 3000; // 2-5 seconds
      blinkTimerRef.current = setTimeout(() => {
        if (meshRef.current && meshRef.current.morphTargetInfluences) {
          const morphDict = meshRef.current.morphTargetDictionary || {};
          const blinkNames = ['eyeBlinkLeft', 'eyeBlinkRight', 'blink', 'Eye_Blink'];
          
          blinkNames.forEach((name) => {
            if (morphDict[name] !== undefined) {
              const index = morphDict[name];
              // Quick blink
              meshRef.current.morphTargetInfluences[index] = 1;
              setTimeout(() => {
                if (meshRef.current) {
                  meshRef.current.morphTargetInfluences[index] = 0;
                }
              }, 150);
            }
          });
        }
        scheduleBlink();
      }, blinkDelay);
    };
    
    scheduleBlink();

    return () => {
      if (blinkTimerRef.current) {
        clearTimeout(blinkTimerRef.current);
      }
    };
  }, [scene]);

  useFrame((state, delta) => {
    if (!meshRef.current || !meshRef.current.morphTargetInfluences) return;

    const influences = meshRef.current.morphTargetInfluences;
    const morphDict = meshRef.current.morphTargetDictionary || {};
    const time = state.clock.elapsedTime;
    
    // Smooth viseme transitions
    if (viseme !== null && viseme !== undefined) {
      const visemeName = VISEME_MAP[viseme];
      const targetStrength = viseme === 0 ? 0 : 0.85; // Silence or speaking
      
      // Smooth interpolation
      visemeStrengthRef.current = THREE.MathUtils.lerp(
        visemeStrengthRef.current,
        targetStrength,
        delta * 15 // Smooth transition speed
      );

      // Reset previous viseme smoothly
      if (previousVisemeRef.current !== null && previousVisemeRef.current !== viseme) {
        const prevName = VISEME_MAP[previousVisemeRef.current];
        if (prevName && morphDict[prevName] !== undefined) {
          const currentValue = influences[morphDict[prevName]];
          influences[morphDict[prevName]] = THREE.MathUtils.lerp(currentValue, 0, delta * 15);
        }
      }

      // Apply current viseme
      if (visemeName && morphDict[visemeName] !== undefined) {
        const currentValue = influences[morphDict[visemeName]] || 0;
        influences[morphDict[visemeName]] = THREE.MathUtils.lerp(
          currentValue,
          visemeStrengthRef.current,
          delta * 15
        );
        previousVisemeRef.current = viseme;
        lastVisemeTimeRef.current = time;
      } else {
        // Fallback: use mouth open blendshape
        const fallbackNames = ['mouthOpen', 'jawOpen', 'Mouth_Open', 'jaw_open', 'jaw_Down'];
        for (const name of fallbackNames) {
          if (morphDict[name] !== undefined) {
            const currentValue = influences[morphDict[name]] || 0;
            const targetValue = speaking && viseme !== 0 ? 0.7 : 0;
            influences[morphDict[name]] = THREE.MathUtils.lerp(currentValue, targetValue, delta * 10);
            break;
          }
        }
      }
    } else if (!speaking) {
      // Reset all mouth morphs smoothly when not speaking
      Object.keys(morphDict).forEach((name) => {
        if (name.toLowerCase().includes('mouth') || name.toLowerCase().includes('jaw')) {
          const currentValue = influences[morphDict[name]] || 0;
          influences[morphDict[name]] = THREE.MathUtils.lerp(currentValue, 0, delta * 8);
        }
      });
      previousVisemeRef.current = null;
      visemeStrengthRef.current = 0;
    }

    // Head movement and gestures while speaking
    if (speaking && groupRef.current) {
      // Subtle head nod/rotation based on speech rhythm
      const speechRhythm = Math.sin(time * 2) * 0.05; // Gentle head movement
      headRotationRef.current.y = THREE.MathUtils.lerp(
        headRotationRef.current.y,
        speechRhythm,
        delta * 2
      );
      headRotationRef.current.x = THREE.MathUtils.lerp(
        headRotationRef.current.x,
        Math.sin(time * 1.5) * 0.03,
        delta * 2
      );

      // Body sway (subtle)
      bodySwayRef.current = Math.sin(time * 0.8) * 0.02;
      positionRef.current[1] = -1.6 + bodySwayRef.current;
      
      // Apply rotations to the scene/group
      if (groupRef.current && groupRef.current.rotation) {
        groupRef.current.rotation.y = headRotationRef.current.y;
        groupRef.current.rotation.x = headRotationRef.current.x;
      }
    } else {
      // Return to neutral position
      headRotationRef.current.y = THREE.MathUtils.lerp(headRotationRef.current.y, 0, delta * 3);
      headRotationRef.current.x = THREE.MathUtils.lerp(headRotationRef.current.x, 0, delta * 3);
      bodySwayRef.current = THREE.MathUtils.lerp(bodySwayRef.current, 0, delta * 3);
      positionRef.current[1] = -1.6 + bodySwayRef.current;
      
      if (groupRef.current && groupRef.current.rotation) {
        groupRef.current.rotation.y = headRotationRef.current.y;
        groupRef.current.rotation.x = headRotationRef.current.x;
      }
    }

    // Facial expressions based on speaking state
    if (speaking) {
      // Slight eyebrow raise or expression during speech
      const expressionNames = ['browInnerUp', 'browOuterUpLeft', 'browOuterUpRight', 'browUp'];
      expressionNames.forEach((name) => {
        if (morphDict[name] !== undefined) {
          const currentValue = influences[morphDict[name]] || 0;
          const targetValue = 0.2; // Subtle expression
          influences[morphDict[name]] = THREE.MathUtils.lerp(currentValue, targetValue, delta * 5);
        }
      });
    } else {
      // Reset expressions
      const expressionNames = ['browInnerUp', 'browOuterUpLeft', 'browOuterUpRight', 'browUp'];
      expressionNames.forEach((name) => {
        if (morphDict[name] !== undefined) {
          const currentValue = influences[morphDict[name]] || 0;
          influences[morphDict[name]] = THREE.MathUtils.lerp(currentValue, 0, delta * 5);
        }
      });
    }
  });

  return <primitive object={scene} scale={1} position={positionRef.current} />;
}

// Preload the model
useGLTF.preload('/avatar.glb');

export default function Avatar3D({ viseme, speaking }) {
  return (
    <div className="avatar-3d-container">
      <Canvas
        camera={{ position: [0, 0, 3], fov: 50 }}
        style={{ width: '100%', height: '400px', background: 'transparent' }}
      >
        <ambientLight intensity={0.6} />
        <directionalLight position={[5, 5, 5]} intensity={0.8} />
        <directionalLight position={[-5, 5, -5]} intensity={0.4} />
        <pointLight position={[0, 3, 0]} intensity={0.3} />
        
        <AvatarModel viseme={viseme} speaking={speaking} />
        
        <OrbitControls
          enableZoom={false}
          enablePan={false}
          minPolarAngle={Math.PI / 3}
          maxPolarAngle={Math.PI / 2.2}
          autoRotate={!speaking}
          autoRotateSpeed={0.3}
          enableDamping={true}
          dampingFactor={0.05}
        />
      </Canvas>
      <p className="hint">
        Ready Player Me avatar with ElevenLabs viseme lip-sync
      </p>
    </div>
  );
}

