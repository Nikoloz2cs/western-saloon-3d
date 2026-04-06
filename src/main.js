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
controls.minDistance = 0.5;
controls.maxDistance = 15;
controls.maxPolarAngle = Math.PI / 2;

// // Grid helper
// const size = 100;
// const divisions = 100;
// const gridHelper = new THREE.GridHelper(size, divisions, "blue", "red");
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

// Loader
const loader = new GLTFLoader();

loader.load('/models/Western_Saloon_1.0.glb', (gltf) => {
    const model = gltf.scene;
    scene.add(model);

    model.traverse((child) => {
        clickableObjects.push(child); // push all objects to make first clicked object logic work

        // // Find doors
        // if (child.name.toLowerCase().includes("door")) {
        //     clickableObjects.push(child);
        //     console.log("Door found:", child.name);
        // }
        
        // // Find stairs
        // if (child.name.toLowerCase().includes("lepcso") ) {
        //     clickableObjects.push(child);
        //     console.log("Stairs found:", child.name);
        // }
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
    // // Calculate current look-at point
    // const cameraDirection = new THREE.Vector3();
    // camera.getWorldDirection(cameraDirection);
    // cameraStartLookAt.copy(camera.position).add(cameraDirection.multiplyScalar(5));
    
    // // Set target state
    // cameraTargetPosition.copy(targetPos);
    // cameraTargetLookAt.copy(targetLookAt);
    // cameraAnimationDuration = duration;
    
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
        // Door clicked - enter saloon
        if (clickedObject.name.toLowerCase() === ("door_left") || clickedObject.name.toLowerCase() === ("door_right")) {
            console.log("Door clicked!");
            
            // Play door animations
            actions["door_left_swing"]?.reset().play();
            actions["door_right_swing"]?.reset().play();
            
            // Move camera inside saloon
            moveCameraTo(
                new THREE.Vector3(-0.5, 0.5, -0.5),  // Target position (inside)
                new THREE.Vector3(0, 0.5, 0),        // Look at (deeper inside)
                1.5                                   // Duration (seconds)
            );
            stairs_first = false; // has the first stairs sequence been played?
        }
        
        // Stairs clicked - two-part sequence
        else if (clickedObject.name.toLowerCase().includes("lepcso")) {
            console.log("Stairs clicked!");
            if (stairs_first) {
                // Part 2: Move up stairs after first animation completes
                moveCameraTo(
                    new THREE.Vector3(2, 2.2, 1.6),  // Top of stairs position
                    new THREE.Vector3(-2, 2.2, -2),  // Look towards room
                    1.2                             // 1.2 seconds
                );
                stairs_first = false;
            } else {
                // Part 1: Move to base of stairs and look up
                moveCameraTo(
                    new THREE.Vector3(2, 0.5, -1),    // Base of stairs position (adjust for your model)
                    new THREE.Vector3(2, 0.5, 3),       // Look up at stairs
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

    const delta = clock.getDelta();
    if (mixer) mixer.update(delta);

    // Update camera animation
    updateCameraAnimation();

    // Only update controls if not animating
    if (!isCameraAnimating) {
        controls.update();
    }

    renderer.render(scene, camera);
}

animate();

// Window resize handler
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});