import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import land from '../data/globe-land.json';
import { globeView, spherePoint, type Coordinates } from './globe-geography';

export interface GlobeController {
  turn: (direction: number) => void;
  recenter: () => void;
  dispose: () => void;
}

export function createGlobe(
  host: HTMLElement,
  coordinates: Coordinates | null,
  placeMarker: (x: number, y: number, visible: boolean) => void,
  onContextLost: () => void,
): GlobeController {
  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearColor(0x000000, 0);
  renderer.domElement.setAttribute('aria-hidden', 'true');
  host.append(renderer.domElement);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 20);
  const view = globeView(coordinates);
  const recenterPosition = new THREE.Vector3(...spherePoint(view, 3.85));
  camera.position.copy(recenterPosition);
  camera.lookAt(0, 0, 0);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableZoom = false;
  controls.enablePan = false;
  controls.enableDamping = false;
  controls.rotateSpeed = 0.55;

  const sphereGeometry = new THREE.SphereGeometry(1, 48, 32);
  const sphereMaterial = new THREE.MeshPhongMaterial({ shininess: 4 });
  scene.add(new THREE.Mesh(sphereGeometry, sphereMaterial));
  scene.add(new THREE.AmbientLight(0xffffff, 1.3));
  const light = new THREE.DirectionalLight(0xffffff, 2);
  light.position.set(-3, 4, 5);
  scene.add(light);

  const dotCanvas = document.createElement('canvas');
  dotCanvas.width = dotCanvas.height = 32;
  const context = dotCanvas.getContext('2d')!;
  context.fillStyle = '#fff';
  context.beginPath();
  context.arc(16, 16, 14, 0, Math.PI * 2);
  context.fill();
  const dotTexture = new THREE.CanvasTexture(dotCanvas);
  const positions = land.flatMap(([latitude, longitude]) => spherePoint({ latitude, longitude }, 1.006));
  const dotGeometry = new THREE.BufferGeometry();
  dotGeometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  const dotMaterial = new THREE.PointsMaterial({
    size: 0.04, map: dotTexture, alphaTest: 0.3, transparent: true, opacity: 0.95,
  });
  scene.add(new THREE.Points(dotGeometry, dotMaterial));

  // Render on resize or interaction; there is no idle animation loop.
  const marker = coordinates ? new THREE.Vector3(...spherePoint(coordinates, 1.025)) : null;
  const render = () => {
    renderer.render(scene, camera);
    if (marker) {
      const point = marker.clone().project(camera);
      placeMarker((point.x + 1) * host.clientWidth / 2, (1 - point.y) * host.clientHeight / 2,
        marker.dot(camera.position) > 1.025 && Math.abs(point.x) <= 1 && Math.abs(point.y) <= 1);
    }
  };
  const resize = () => {
    if (!host.clientWidth || !host.clientHeight) return;
    renderer.setSize(host.clientWidth, host.clientHeight);
    camera.aspect = host.clientWidth / host.clientHeight;
    camera.updateProjectionMatrix();
    render();
  };
  const colors = () => {
    const style = getComputedStyle(host);
    dotMaterial.color.set(style.getPropertyValue('--accent').trim());
    sphereMaterial.color.set(style.getPropertyValue('--card').trim());
    render();
  };
  controls.addEventListener('change', render);
  const observer = new ResizeObserver(resize);
  observer.observe(host);
  const theme = new MutationObserver(colors);
  theme.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  const lost = (event: Event) => {
    event.preventDefault();
    onContextLost();
  };
  renderer.domElement.addEventListener('webglcontextlost', lost);
  colors();
  resize();
  return {
    turn(direction) {
      const spherical = new THREE.Spherical().setFromVector3(camera.position);
      spherical.theta += direction * Math.PI / 9;
      camera.position.setFromSpherical(spherical);
      controls.update();
      render();
    },
    recenter() {
      camera.position.copy(recenterPosition);
      controls.update();
      render();
    },
    dispose() {
      observer.disconnect();
      theme.disconnect();
      controls.dispose();
      renderer.domElement.removeEventListener('webglcontextlost', lost);
      sphereGeometry.dispose();
      sphereMaterial.dispose();
      dotGeometry.dispose();
      dotMaterial.dispose();
      dotTexture.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
      renderer.domElement.remove();
    },
  };
}
