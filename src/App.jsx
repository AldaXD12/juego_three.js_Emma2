// App.jsx reorganizado con modelo .glb, efecto de colisión y música de fondo funcional
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Suspense, useRef, useEffect, useState, useMemo } from 'react'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader'
import { useLoader } from '@react-three/fiber'
import * as THREE from 'three'
import './App.css'

// Componente del auto cargado desde modelo .glb y controlado por teclas
function Auto({ modelRef, keys, isGameOver }) {
  const gltf = useLoader(GLTFLoader, `${import.meta.env.BASE_URL}models/auto.glb`); // <-- Modifica esta línea

  useFrame((_, delta) => {
    if (!modelRef.current || isGameOver) return
    const speed = 5 * delta
    if (keys.current['w'] || keys.current['arrowup']) modelRef.current.position.z -= speed
    if (keys.current['s'] || keys.current['arrowdown']) modelRef.current.position.z += speed

    const nextX = modelRef.current.position.x + (
      (keys.current['d'] || keys.current['arrowright'] ? 1 : 0) -
      (keys.current['a'] || keys.current['arrowleft'] ? 1 : 0)
    ) * speed

    if (nextX >= -5 && nextX <= 5) {
      modelRef.current.position.x = nextX
    }
  })

  return (
    <primitive
      ref={modelRef}
      object={gltf.scene}
      position={[0, 0.1, 0]}
      scale={1.5}
    />
  )
}

// Partículas para efecto de explosión al colisionar
function Explosion({ position }) {
  const particles = useRef()
  const count = 150
  const [velocities] = useState(() => Array.from({ length: count }, () => new THREE.Vector3(
    (Math.random() - 0.5) * 2,
    (Math.random() - 0.5) * 2,
    (Math.random() - 0.5) * 2
  )))

  useFrame(() => {
    if (!particles.current) return
    const posAttr = particles.current.geometry.attributes.position
    for (let i = 0; i < count; i++) {
      posAttr.setX(i, posAttr.getX(i) + velocities[i].x * 0.1)
      posAttr.setY(i, posAttr.getY(i) + velocities[i].y * 0.1)
      posAttr.setZ(i, posAttr.getZ(i) + velocities[i].z * 0.1)
    }
    posAttr.needsUpdate = true
  })

  const positions = new Float32Array(count * 3)
  for (let i = 0; i < count; i++) {
    positions[i * 3 + 0] = position[0]
    positions[i * 3 + 1] = position[1]
    positions[i * 3 + 2] = position[2]
  }

  return (
    <points ref={particles}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={count}
          array={positions}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial color="yellow" size={0.3} />
    </points>
  )
}

// Componente de obstáculo con lógica de colisión y reinicio
function Obstacle({ targetRef, onCollision, onPassed, speed = 1, color = 'red', isGameOver }) {
  const obstacleRef = useRef()

  useFrame((_, delta) => {
    if (!obstacleRef.current || isGameOver) return
    obstacleRef.current.position.z += 4 * delta * speed

    if (obstacleRef.current.position.z > 10) {
      obstacleRef.current.position.z = -50
      obstacleRef.current.position.x = Math.random() * 10 - 5
      onPassed()
    }

    if (targetRef.current) {
      const obstacleBox = new THREE.Box3().setFromObject(obstacleRef.current)
      const playerBox = new THREE.Box3().setFromObject(targetRef.current)

      if (obstacleBox.intersectsBox(playerBox)) {
        onCollision(obstacleRef.current.position.clone())
        obstacleRef.current.position.z = -50
        obstacleRef.current.position.x = Math.random() * 10 - 5
      }
    }
  })

  return (
    <mesh ref={obstacleRef} position={[0, 0.5, -30]} castShadow>
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial color={color} />
    </mesh>
  )
}

// Cámara que sigue al modelo principal
function CameraFollow({ target }) {
  const { camera } = useThree()

  useFrame(() => {
    if (!target.current) return
    const pos = target.current.position
    const followPos = new THREE.Vector3(pos.x, pos.y + 2, pos.z + 6)
    camera.position.lerp(followPos, 0.1)
    camera.lookAt(pos)
  })

  return null
}

// Componente del suelo con líneas blancas como carriles
function Pista() {
  return (
    <>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[100, 100]} />
        <meshStandardMaterial color="#444" />
      </mesh>
      <line>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            array={new Float32Array([-5, 0.01, -50, -5, 0.01, 50])}
            count={2}
            itemSize={3}
          />
        </bufferGeometry>
        <lineBasicMaterial color="white" />
      </line>
      <line>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            array={new Float32Array([5, 0.01, -50, 5, 0.01, 50])}
            count={2}
            itemSize={3}
          />
        </bufferGeometry>
        <lineBasicMaterial color="white" />
      </line>
    </>
  )
}

// Lista de 20 niveles progresivos
const niveles = Array.from({ length: 20 }, (_, i) => ({
  meta: (i + 1) * 5,
  color: `hsl(${i * 18}, 100%, 50%)`,
  filas: 5 + i,
  velocidad: 1 + i * 0.05
}))

// Componente principal que administra el juego
function App() {
  const modelRef = useRef()
  const keys = useRef({})
  const [explosions, setExplosions] = useState([])
  const [lives, setLives] = useState(5)
  const [message, setMessage] = useState('')
  const [time, setTime] = useState(0)
  const [isGameOver, setIsGameOver] = useState(false)
  const [obstaculosPasados, setObstaculosPasados] = useState(0)
  const [nivelIndex, setNivelIndex] = useState(0)
  const [paused, setPaused] = useState(false)
  const [started, setStarted] = useState(false)
  const audioRef = useRef(null)
  const musicRef = useRef(null)

  const [buttonStates, setButtonStates] = useState({
    up: false,
    down: false,
    left: false,
    right: false,
  });
  
  const nivelActual = niveles[nivelIndex] || niveles[niveles.length - 1]

  // Reproduce o pausa la música según el estado del juego
  useEffect(() => {
    if (started && !isGameOver) {
      musicRef.current?.play()
    } else {
      musicRef.current?.pause()
      musicRef.current.currentTime = 0
    }
  }, [started, isGameOver])

  useEffect(() => {
    const down = (e) => (keys.current[e.key.toLowerCase()] = true)
    const up = (e) => (keys.current[e.key.toLowerCase()] = false)
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
    }
  }, [])

  useEffect(() => {
    const interval = setInterval(() => {
      if (!isGameOver && started && !paused) setTime((t) => t + 1)
    }, 1000)
    return () => clearInterval(interval)
  }, [isGameOver, started, paused])

  useEffect(() => {
    if (lives <= 0) {
      setIsGameOver(true)
      setMessage('💀 GAME OVER')
    }
  }, [lives])

  useEffect(() => {
    if (obstaculosPasados >= nivelActual.meta && nivelIndex < niveles.length - 1) {
      setNivelIndex((n) => n + 1)
      setMessage(`✅ Nivel ${nivelIndex + 2}`)
      setTimeout(() => setMessage(''), 1500)
    } else if (nivelIndex === niveles.length - 1 && obstaculosPasados >= nivelActual.meta) {
      setMessage('🎉 GANADOR HDSPT')
      setIsGameOver(true)
    }
  }, [obstaculosPasados])

  const handleCollision = (position) => {
    if (isGameOver || paused) return
    setExplosions((prev) => [...prev, { id: Date.now(), position }])
    setMessage('💥 ¡Colisión!')
    setLives((l) => Math.max(0, l - 1))
    if (modelRef.current) modelRef.current.position.set(0, 0.1, 0)
    if (audioRef.current) audioRef.current.play()
    setTimeout(() => {
      setExplosions((prev) => prev.slice(1))
      if (lives > 1) setMessage('')
    }, 1000)
  }

  const handlePassed = () => {
    if (!isGameOver && !paused) setObstaculosPasados((s) => s + 1)
  }

  const resetGame = () => {
    setLives(5)
    setTime(0)
    setMessage('')
    setObstaculosPasados(0)
    setNivelIndex(0)
    setIsGameOver(false)
    setPaused(false)
    setStarted(false)
    if (modelRef.current) modelRef.current.position.set(0, 0.1, 0)
  }

  return (
    <>
      <audio ref={audioRef} src={`${import.meta.env.BASE_URL}audio/choque.mp3`} preload="auto" />
      <audio ref={musicRef} src={`${import.meta.env.BASE_URL}audio/music1.mp3`} preload="auto" loop />
      <Canvas shadows camera={{ position: [0, 3, 8], fov: 60 }}>
        <ambientLight intensity={0.5} />
        <directionalLight position={[5, 10, 5]} intensity={1} castShadow />
        <Suspense fallback={null}>
          <Pista />
          {started && (
            <>
              <Auto modelRef={modelRef} keys={keys} isGameOver={isGameOver} />
              {!isGameOver && Array.from({ length: nivelActual.filas }).map((_, i) => (
                <Obstacle
                  key={i}
                  targetRef={modelRef}
                  onCollision={handleCollision}
                  onPassed={handlePassed}
                  speed={nivelActual.velocidad}
                  color={nivelActual.color}
                  isGameOver={isGameOver}
                />
              ))}
              <CameraFollow target={modelRef} />
              {explosions.map((e) => (
                <Explosion key={e.id} position={[e.position.x, e.position.y, e.position.z]} />
              ))}
            </>
          )}
        </Suspense>
      </Canvas>
      <div className="touch-controls">
        <button
          className="touch-button up-button"
          onClick={() => handleButtonClick('up', true)}
        >
          Arriba
        </button>
        <button
          className="touch-button left-button"
          onClick={() => handleButtonClick('left', true)}
        >
          Izquierda
        </button>
        <button
          className="touch-button right-button"
          onClick={() => handleButtonClick('right', true)}
        >
          Derecha
        </button>
        <button
          className="touch-button down-button"
          onClick={() => handleButtonClick('down', true)}
        >
          Abajo
        </button>
      </div>

      <div className="hud">
        {!started && <button onClick={() => setStarted(true)}>▶️ Iniciar Juego</button>}
        {started && !isGameOver && (
          <button onClick={() => setPaused((p) => !p)}>{paused ? '▶️ Reanudar' : '⏸️ Pausar'}</button>
        )}
        {isGameOver && <button className="reset-button" onClick={resetGame}>🔁 Reiniciar Juego</button>}
        {message && <div className="message">{message}</div>}
      </div>
    </>
  )
}

export default App;
