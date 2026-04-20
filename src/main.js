import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

// #region Setup
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
controls.minDistance = 0.5;
controls.maxDistance = 15;
controls.maxPolarAngle = Math.PI / 2;

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
let clickableObjects = [];

// Camera animation state
let isCameraAnimating = false;
let cameraAnimationStartTime = 0;
let cameraStartPosition = new THREE.Vector3();
let cameraTargetPosition = new THREE.Vector3();
let cameraStartLookAt = new THREE.Vector3();
let cameraTargetLookAt = new THREE.Vector3();
let cameraAnimationDuration = 1.5;
let stairs_first = false; // has the first stairs sequence been played?

// #region WASD Movement
const keyState = {
    w: false, a: false, s: false, d: false
};

let movementEnabled = false; // Only enable when inside saloon
const moveSpeed = 3.0; // Units per second

window.addEventListener('keydown', (e) => {
    const key = e.key.toLowerCase();
    if (key === 'w' || key === 'a' || key === 's' || key === 'd') {
        keyState[key] = true;
        e.preventDefault();
    }
});

window.addEventListener('keyup', (e) => {
    const key = e.key.toLowerCase();
    if (key === 'w' || key === 'a' || key === 's' || key === 'd') {
        keyState[key] = false;
        e.preventDefault();
    }
});

function updateMovement(deltaTime) {
    if (!movementEnabled || isCameraAnimating) return;
    
    const speed = moveSpeed * deltaTime;
    const forward = new THREE.Vector3();
    const right = new THREE.Vector3();
    
    camera.getWorldDirection(forward);
    forward.y = 0;
    forward.normalize();
    
    right.crossVectors(new THREE.Vector3(0, 1, 0), forward);
    right.normalize();
    
    let move = new THREE.Vector3(0, 0, 0);
    
    if (keyState.w) move.add(forward);
    if (keyState.s) move.sub(forward);
    if (keyState.a) move.add(right);
    if (keyState.d) move.sub(right);
    
    if (move.length() > 0) move.normalize();
    
    // Apply movement
    camera.position.x += move.x * speed;
    camera.position.z += move.z * speed;
    
    // Move target with camera to maintain look direction
    controls.target.x += move.x * speed;
    controls.target.z += move.z * speed;
}
// #endregion

// Loader
const loader = new GLTFLoader();

loader.load('/models/Western_Saloon_2.0.glb', (gltf) => {
    const model = gltf.scene;
    scene.add(model);

    model.traverse((child) => {
        // take note of all objects in the scene. Useful for implementing user interaction
        clickableObjects.push(child); 
    });

    // Animations
    mixer = new THREE.AnimationMixer(model);

    gltf.animations.forEach((clip) => {
        console.log("Animation found:", clip.name);
    
        const action = mixer.clipAction(clip);
        action.setLoop(THREE.LoopOnce);
        action.clampWhenFinished = true;
    
        actions[clip.name] = action;
    });
});
// #endregion

// #region Debug/Grid helper
const gridHelper = new THREE.GridHelper(20, 20, 0x888888, 0x444444);
gridHelper.position.y = -0.01;
scene.add(gridHelper);

// Axis helper (X red, Z blue, Y green)
const axesHelper = new THREE.AxesHelper(10);
scene.add(axesHelper);

// Labels using CanvasTexture
function makeAxisLabel(text, color) {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = color;
    ctx.font = 'Bold 40px Arial';
    ctx.fillText(text, 10, 50);
    
    const texture = new THREE.CanvasTexture(canvas);
    const material = new THREE.SpriteMaterial({ map: texture });
    const sprite = new THREE.Sprite(material);
    sprite.scale.set(0.5, 0.5, 0.5);
    return sprite;
}

// Position labels
const xLabel = makeAxisLabel('+X', '#ff3333');
xLabel.position.set(10, 0, 0);
scene.add(xLabel);

const xNegLabel = makeAxisLabel('-X', '#ff3333');
xNegLabel.position.set(-10, 0, 0);
scene.add(xNegLabel);

const zLabel = makeAxisLabel('+Z', '#33ff33');
zLabel.position.set(0, 0, 10);
scene.add(zLabel);

const zNegLabel = makeAxisLabel('-Z', '#33ff33');
zNegLabel.position.set(0, 0, -10);
scene.add(zNegLabel);

const yLabel = makeAxisLabel('+Y', '#3333ff');
yLabel.position.set(0, 5, 0);
scene.add(yLabel);

// Debug info display (camera position and look-at)
const debugDiv = document.createElement('div');
debugDiv.style.position = 'fixed';
debugDiv.style.top = '10px';
debugDiv.style.right = '10px';
debugDiv.style.backgroundColor = 'rgba(0,0,0,0.7)';
debugDiv.style.color = '#0f0';
debugDiv.style.fontFamily = 'monospace';
debugDiv.style.fontSize = '12px';
debugDiv.style.padding = '8px';
debugDiv.style.borderRadius = '5px';
debugDiv.style.zIndex = '1000';
debugDiv.style.pointerEvents = 'none';
document.body.appendChild(debugDiv);

// Update debug info in animate loop
function updateDebugInfo() {
    const pos = camera.position;
    const target = controls.target;
    debugDiv.innerHTML = `
        Camera Pos: x=${pos.x.toFixed(2)}, y=${pos.y.toFixed(2)}, z=${pos.z.toFixed(2)}<br>
        Look At: x=${target.x.toFixed(2)}, y=${target.y.toFixed(2)}, z=${target.z.toFixed(2)}<br>
        Movement: ${movementEnabled ? 'ON' : 'OFF'} | WASD to move
    `;
}
// #endregion

// Room bounds collision (activate when inside saloon)
let isInsideSaloon = false;

const roomBounds = {
    minX: -1.6, maxX: 2,
    minY: 0, maxY: 3,
    minZ: -1.6, maxZ: 1.6
};

function applyRoomBounds() {
    if (!isInsideSaloon) return;
    
    const pos = camera.position;
    const target = controls.target;
    
    // Clamp camera position
    pos.x = Math.max(roomBounds.minX, Math.min(roomBounds.maxX, pos.x));
    pos.z = Math.max(roomBounds.minZ, Math.min(roomBounds.maxZ, pos.z));
    pos.y = Math.max(roomBounds.minY, Math.min(roomBounds.maxY, pos.y));
    
    // Keep target relative offset
    const offset = new THREE.Vector3().subVectors(target, pos);
    target.copy(pos).add(offset);
}

// Reusable camera movement function
function moveCameraTo(targetPos, targetLookAt, duration = 1.5) {
    // Don't start new animation if one is running
    if (isCameraAnimating) {
        console.log("Camera already animating, ignoring request");
        return;
    }
    
    // Store starting state
    cameraStartPosition.copy(camera.position);
    
    // Store current controls target as start look-at
    cameraStartLookAt.copy(controls.target);

    // Set target state
    cameraTargetPosition.copy(targetPos);
    cameraTargetLookAt.copy(targetLookAt);
    cameraAnimationDuration = duration;
    
    // Start animation
    isCameraAnimating = true;
    cameraAnimationStartTime = performance.now();
    controls.enabled = false;
    
    console.log(`Camera moving to: ${targetPos.toArray()} looking at: ${targetLookAt.toArray()}`);
}

// Update camera animation (called every frame)
function updateCameraAnimation() {
    if (!isCameraAnimating) return;
    
    const elapsed = (performance.now() - cameraAnimationStartTime) / 1000;
    const progress = Math.min(elapsed / cameraAnimationDuration, 1);
    
    // Smooth easing (ease-in-out cubic)
    const eased = progress < 0.5 
        ? 4 * progress * progress * progress 
        : 1 - Math.pow(-2 * progress + 2, 3) / 2;
    
    // Interpolate position
    camera.position.lerpVectors(
        cameraStartPosition,
        cameraTargetPosition,
        eased
    );
    
    // Interpolate look-at direction
    const currentLookAt = new THREE.Vector3();
    currentLookAt.lerpVectors(
        cameraStartLookAt,
        cameraTargetLookAt,
        eased
    );
    
    camera.lookAt(currentLookAt);
    controls.target.copy(currentLookAt);
    
    // Animation complete
    if (progress >= 1) {
        isCameraAnimating = false;
        controls.enabled = true;
        console.log("Camera animation complete");
    }
}

// Click interaction
window.addEventListener('click', (event) => {
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects(clickableObjects, true);
    
    
    if (intersects.length > 0 && !isCameraAnimating) {
        const clickedObject = intersects[0].object;
        console.log("##objects##", clickedObject);
        // Door clicked -> enter saloon
        if (clickedObject.name.toLowerCase() === ("door_left") || clickedObject.name.toLowerCase() === ("door_right")) {
            console.log("Door clicked!");
            
            // Play door animations
            actions["door_left_swing"]?.reset().play();
            actions["door_right_swing"]?.reset().play();
            
            if (!isInsideSaloon) {
                // Enter saloon
                moveCameraTo(
                    new THREE.Vector3(-0.5, 0.5, -0.5),
                    new THREE.Vector3(0, 0.5, 0),
                    1.5
                );
                isInsideSaloon = true;
                movementEnabled = true; // WASD enabled
                stairs_first = false;
                
                // Adjust orbit distance for interior
                setTimeout(() => {
                    controls.maxDistance = 3;
                    controls.minDistance = 0.5;
                }, 1500);
            } else {
                // Exit saloon
                moveCameraTo(
                    new THREE.Vector3(-5.5, 0.5, -5),
                    new THREE.Vector3(0, 0.5, 0),
                    1.5
                );
                isInsideSaloon = false;
                movementEnabled = false; // WASD disabled
                
                // Reset orbit distance for exterior
                setTimeout(() => {
                    controls.maxDistance = 15;
                    controls.minDistance = 0.5;
                }, 1500);
            }
        }
        
        // Stairs clicked - two-part sequence
        else if (clickedObject.name.toLowerCase().includes("stair")) {
            console.log("Stairs clicked!");
            if (stairs_first) {
                // Part 2| Move up stairs after first animation completes
                moveCameraTo(
                    new THREE.Vector3(1.999, 2.2, 1.599),  // Top of stairs position
                    new THREE.Vector3(-0, 2.2, -0),  // Look towards room
                    1.2                             // 1.2 seconds
                );
                stairs_first = false;
            } else {
                // Part 1| Move to base of stairs and look up
                moveCameraTo(
                    new THREE.Vector3(2, 0.5, -1),    // Base of stairs position 
                    new THREE.Vector3(2, 0.5, 2),       // Look up at stairs
                    1.0                                // 1 second
                );
                stairs_first = true;
            }
        }
    }
});

// Animation loop
const clock = new THREE.Clock();

function animate() {
    requestAnimationFrame(animate);

    const delta = Math.min(clock.getDelta(), 0.033); // Cap delta for smooth movement
    if (mixer) mixer.update(delta);

    updateCameraAnimation();

    // Update movement when inside and not animating
    if (!isCameraAnimating) {
        updateMovement(delta);
        controls.update();
    }

    // collision handling within room
    if (!isCameraAnimating) {
        applyRoomBounds();
    }
    
    updateDebugInfo();
    renderer.render(scene, camera);
}

animate();

// Window resize handler
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});