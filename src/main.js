import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

// Scene
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xf4e7c5);

// Camera
const camera = new THREE.PerspectiveCamera(
    75,
    window.innerWidth / window.innerHeight,
    0.1,
    1000
);
camera.position.set(-5.5, 0.5, -5);
camera.lookAt(0, 0.5, 0);

// Renderer
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// Orbit Controls 
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.enablePan = false;
controls.minDistance = 2;
controls.maxDistance = 15;
controls.maxPolarAngle = Math.PI / 2;

// // Grid helper
// const size = 10;
// const divisions = 10;
// const gridHelper = new THREE.GridHelper(size, divisions);
// scene.add(gridHelper);

// Lights
const light1 = new THREE.DirectionalLight(0xffffff, 1);
light1.position.set(-3.5, 10, -4);
scene.add(light1);

const light2 = new THREE.DirectionalLight(0xffffff, 1);
light2.position.set(3.5, 10, 4);
scene.add(light2);

const light3 = new THREE.DirectionalLight(0xffffff, 1);
light3.position.set(0, 1, -0.6);
scene.add(light3);


// Raycasting
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

// Animation system
let mixer;
let actions = {};
let doors = [];

let isMoving = false;

let startPosition = new THREE.Vector3();
let endPosition = new THREE.Vector3(-0.5, 0.5, -0.5); // inside the saloon

let moveProgress = 0;
const moveDuration = 1.5; // seconds

// Loader
const loader = new GLTFLoader();

loader.load('/models/Western_Saloon_1.0.glb', (gltf) => {
    const model = gltf.scene;
    scene.add(model);

    model.traverse((child) => {
        if (child.name.toLowerCase().includes("door")) {
            doors.push(child);
            console.log("Door found:", child.name);
        }
    });

    // Animations
    mixer = new THREE.AnimationMixer(model);

    gltf.animations.forEach((clip) => {
        console.log("Animation found:", clip.name);
    
        const action = mixer.clipAction(clip);
        action.setLoop(THREE.LoopOnce);       // play once
        action.clampWhenFinished = true;      // stay at final frame
    
        actions[clip.name] = action;
    });
});

// Click interaction
window.addEventListener('click', (event) => {
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);

    const intersects = raycaster.intersectObjects(doors, true);

    if (intersects.length > 0 && !isMoving) {
        console.log("Door clicked!");
    
        // Play doors
        actions["door_left_swing"]?.reset().play();
        actions["door_right_swing"]?.reset().play();
    
        // Start camera movement
        isMoving = true;
        moveProgress = 0;
        startPosition.copy(camera.position);
    
        controls.enabled = false; // lock camera control
    }
});

// Animation loop
const clock = new THREE.Clock();

function animate() {
    requestAnimationFrame(animate);

    const delta = clock.getDelta();
    if (mixer) mixer.update(delta);

    controls.update();
    if (isMoving) {
        moveProgress += delta / moveDuration;
    
        // Smooth interpolation
        const t = Math.min(moveProgress, 1);
    
        camera.position.lerpVectors(startPosition, endPosition, t);
    
        // Keep looking forward (important)
        camera.lookAt(0, 0.5, 0);
    
        if (t >= 1) {
            isMoving = false;
        
            // sync OrbitControls with new camera position
            controls.target.set(10, 0.5, 10);
            controls.update();
        
            controls.enabled = true;
        }
    }
    renderer.render(scene, camera);
}

animate();