document.addEventListener("DOMContentLoaded", () => {
    const startButton = document.getElementById("start-button");
    const startScreen = document.getElementById("start-screen");
    const explanationDiv = document.getElementById("explanation");
    
    // Using the default MindAR test image marker data (compiled .mind file)
    // You would replace this with your own compiled target using the MindAR compiler tool.
    const TARGET_IMAGE_URL = "card.mind";

    startButton.addEventListener("click", async () => {
        // Change button text to indicate loading
        startButton.innerText = "Loading Camera...";
        startButton.disabled = true;
        
        // 1. Initialize MindAR and Three.js
        // We pass the container element and the compiled image target file
        const mindarThree = new window.MINDAR.IMAGE.MindARThree({
            container: document.querySelector("#container"),
            imageTargetSrc: TARGET_IMAGE_URL
        });

        // Destructure necessary Three.js components managed by MindAR
        const {renderer, scene, camera} = mindarThree;

        // 2. Add Lighting to the scene so our 3D objects are visible and shaded properly
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
        scene.add(ambientLight);
        
        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
        directionalLight.position.set(0, 1, 1);
        scene.add(directionalLight);

        // 3. Create the Factory Model Group
        // Instead of loading a potentially heavy external glTF file, we programmatically 
        // construct a clean, optimized factory using Three.js primitives for guaranteed mobile performance.
        const factoryGroup = new THREE.Group();
        
        // 3a. Main factory building (Box)
        const buildingGeometry = new THREE.BoxGeometry(1, 0.5, 0.8);
        const buildingMaterial = new THREE.MeshStandardMaterial({color: 0x4a69bd, roughness: 0.7});
        const building = new THREE.Mesh(buildingGeometry, buildingMaterial);
        building.position.y = 0.25; // Shift up so the base rests exactly on the image target
        factoryGroup.add(building);

        // 3b. Factory Roof (Cone)
        const roofGeometry = new THREE.ConeGeometry(0.7, 0.3, 4);
        const roofMaterial = new THREE.MeshStandardMaterial({color: 0xe55039, roughness: 0.9});
        const roof = new THREE.Mesh(roofGeometry, roofMaterial);
        roof.rotation.y = Math.PI / 4; // Rotate so corners align with the box below
        roof.position.y = 0.65;
        factoryGroup.add(roof);

        // 3c. Smokestacks (Cylinders)
        const stackGeo = new THREE.CylinderGeometry(0.08, 0.08, 0.6);
        const stackMat = new THREE.MeshStandardMaterial({color: 0x7f8fa6});
        
        const stack1 = new THREE.Mesh(stackGeo, stackMat);
        stack1.position.set(-0.3, 0.8, -0.2); // Positioned relative to the factory center
        factoryGroup.add(stack1);
        
        const stack2 = new THREE.Mesh(stackGeo, stackMat);
        stack2.position.set(0.1, 0.8, -0.2);
        factoryGroup.add(stack2);

        // 4. Create Clickable Labels (Labour, Capital, Technology)
        // Array to store meshes we want to be clickable via Raycasting
        const clickableObjects = [];
        
        // Dictionary of explanations to show when a label is tapped
        const explanations = {
            'Labour': 'Labour: The human effort, skills, and workers required to operate the factory.',
            'Capital': 'Capital: The machinery, tools, buildings, and financial investment used in production.',
            'Technology': 'Technology: The advanced systems, software, and automated processes improving efficiency.'
        };

        // Helper function to create a text label as a 3D Plane
        const createLabel = (text, position) => {
            // Create an HTML canvas to dynamically draw the text
            const canvas = document.createElement('canvas');
            canvas.width = 256;
            canvas.height = 128;
            const context = canvas.getContext('2d');
            
            // Draw a rounded rectangle background for the label
            context.fillStyle = 'rgba(255, 255, 255, 0.9)';
            context.beginPath();
            context.roundRect(0, 0, canvas.width, canvas.height, 20);
            context.fill();
            
            // Draw a colored border
            context.strokeStyle = '#4CAF50';
            context.lineWidth = 10;
            context.stroke();
            
            // Draw the label text
            context.font = 'bold 36px Arial';
            context.fillStyle = '#333';
            context.textAlign = 'center';
            context.textBaseline = 'middle';
            context.fillText(text, canvas.width / 2, canvas.height / 2);
            
            // Create a Three.js texture from the 2D canvas
            const texture = new THREE.CanvasTexture(canvas);
            const material = new THREE.MeshBasicMaterial({map: texture, transparent: true});
            const geometry = new THREE.PlaneGeometry(0.6, 0.3); // Plane dimensions in 3D space
            
            const labelMesh = new THREE.Mesh(geometry, material);
            labelMesh.position.copy(position);
            
            // Store the label name inside the mesh's userData so we can identify it later during a click
            labelMesh.userData = { name: text }; 
            
            return labelMesh;
        };

        // Instantiate the labels and position them around the factory model
        const labelLabour = createLabel('Labour', new THREE.Vector3(-0.9, 0.5, 0.5));
        const labelCapital = createLabel('Capital', new THREE.Vector3(0, 1.3, 0));
        const labelTech = createLabel('Technology', new THREE.Vector3(0.9, 0.5, 0.5));

        // Add labels to the factory group
        factoryGroup.add(labelLabour);
        factoryGroup.add(labelCapital);
        factoryGroup.add(labelTech);
        
        // Track these specific meshes for raycasting (touch/click detection)
        clickableObjects.push(labelLabour, labelCapital, labelTech);

        // 5. Anchor the factory to the image target
        // addAnchor(0) links this group to the first (and only) target in our .mind file
        const anchor = mindarThree.addAnchor(0);
        anchor.group.add(factoryGroup);

        // 6. Handle Clicks / Taps (Mobile Friendly Raycasting)
        const raycaster = new THREE.Raycaster();
        const mouse = new THREE.Vector2();
        let explanationTimeout; // Used to automatically hide the explanation

        const onPointerDown = (event) => {
            // Only process clicks if the AR anchor (and therefore the target image) is currently visible
            if (!anchor.group.visible) return;

            // Normalize device coordinates to (-1 to +1) for Three.js Raycaster
            let clientX, clientY;
            if (event.changedTouches) {
                // Handle mobile touch event
                clientX = event.changedTouches[0].clientX;
                clientY = event.changedTouches[0].clientY;
            } else {
                // Handle desktop mouse event
                clientX = event.clientX;
                clientY = event.clientY;
            }

            mouse.x = (clientX / window.innerWidth) * 2 - 1;
            mouse.y = -(clientY / window.innerHeight) * 2 + 1;

            // Cast a ray from the camera through the touch/click position
            raycaster.setFromCamera(mouse, camera);
            
            // Check if the ray intersects any of our label meshes
            const intersects = raycaster.intersectObjects(clickableObjects, false);
            
            if (intersects.length > 0) {
                // Get the name we stored in userData earlier
                const labelName = intersects[0].object.userData.name;
                
                // Update and show the UI explanation HTML element
                explanationDiv.innerText = explanations[labelName];
                explanationDiv.style.display = 'block';
                
                // Clear any existing timeout, then hide the text automatically after 4 seconds
                clearTimeout(explanationTimeout);
                explanationTimeout = setTimeout(() => {
                    explanationDiv.style.display = 'none';
                }, 4000);
            }
        };

        // Listen for pointerdown (handles both touch and mouse clicks gracefully across mobile/desktop)
        window.addEventListener('pointerdown', onPointerDown);

        // 7. Start the AR Engine and Render Loop
        try {
            // start() requests camera access and begins tracking
            console.log("Requesting camera start...");
            
            const startPromise = mindarThree.start();
            const timeoutPromise = new Promise((_, reject) => {
                setTimeout(() => reject(new Error("Camera request timed out after 10 seconds.")), 10000);
            });

            await Promise.race([startPromise, timeoutPromise]);
            console.log("Camera started successfully!");
            
            // Camera started successfully, now hide the start screen
            startScreen.style.display = "none";
            
            renderer.setAnimationLoop(() => {
                // Make the text labels always face the camera directly (Billboard effect)
                // This ensures they are readable no matter what angle the user looks from
                labelLabour.quaternion.copy(camera.quaternion);
                labelCapital.quaternion.copy(camera.quaternion);
                labelTech.quaternion.copy(camera.quaternion);

                // Render the scene
                renderer.render(scene, camera);
            });
        } catch (error) {
            console.error("Error starting MindAR:", error);
            alert("Could not start AR. Please ensure you have granted camera permissions and are running this via a secure server (HTTPS or localhost).");
            startButton.innerText = "Start AR Experience";
            startButton.disabled = false;
        }
    });
});
