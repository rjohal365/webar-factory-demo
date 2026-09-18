document.addEventListener("DOMContentLoaded", () => {
    const startButton = document.getElementById("start-button");
    const startScreen = document.getElementById("start-screen");
    const explanationDiv = document.getElementById("explanation");
    
    // Using the default MindAR test image marker data (compiled .mind file)
    // You would replace this with your own compiled target using the MindAR compiler tool.
    const TARGET_IMAGE_URL = "card.mind";

    startButton.addEventListener("click", async () => {
        try {
            // Change button text to indicate loading
            startButton.innerText = "Loading Camera...";
            startButton.disabled = true;
            
            // Debug check
            if (!window.MINDAR) {
                throw new Error("MindAR library failed to load! Check your internet or browser compatibility.");
            }
            
            // 1. Initialize MindAR and Three.js
            const mindarThree = new window.MINDAR.IMAGE.MindARThree({
                container: document.querySelector("#container"),
                imageTargetSrc: TARGET_IMAGE_URL
            });

            const {renderer, scene, camera} = mindarThree;

            // 2. Add Lighting
            const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
            scene.add(ambientLight);
            
            const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
            directionalLight.position.set(0, 1, 1);
            scene.add(directionalLight);

            // 3. Create the Factory Model Group
            const factoryGroup = new THREE.Group();
            
            // 3a. Main factory building (Box)
            const buildingGeometry = new THREE.BoxGeometry(1, 0.5, 0.8);
            const buildingMaterial = new THREE.MeshStandardMaterial({color: 0x4a69bd, roughness: 0.7});
            const building = new THREE.Mesh(buildingGeometry, buildingMaterial);
            building.position.y = 0.25;
            factoryGroup.add(building);

            // 3b. Factory Roof (Cone)
            const roofGeometry = new THREE.ConeGeometry(0.7, 0.3, 4);
            const roofMaterial = new THREE.MeshStandardMaterial({color: 0xe55039, roughness: 0.9});
            const roof = new THREE.Mesh(roofGeometry, roofMaterial);
            roof.rotation.y = Math.PI / 4;
            roof.position.y = 0.65;
            factoryGroup.add(roof);

            // 3c. Smokestacks (Cylinders)
            const stackGeo = new THREE.CylinderGeometry(0.08, 0.08, 0.6);
            const stackMat = new THREE.MeshStandardMaterial({color: 0x7f8fa6});
            
            const stack1 = new THREE.Mesh(stackGeo, stackMat);
            stack1.position.set(-0.3, 0.8, -0.2);
            factoryGroup.add(stack1);
            
            const stack2 = new THREE.Mesh(stackGeo, stackMat);
            stack2.position.set(0.1, 0.8, -0.2);
            factoryGroup.add(stack2);

            // 4. Create Clickable Labels
            const clickableObjects = [];
            const explanations = {
                'Labour': 'Labour: The human effort, skills, and workers required to operate the factory.',
                'Capital': 'Capital: The machinery, tools, buildings, and financial investment used in production.',
                'Technology': 'Technology: The advanced systems, software, and automated processes improving efficiency.'
            };

            const createLabel = (text, position) => {
                const canvas = document.createElement('canvas');
                canvas.width = 256;
                canvas.height = 128;
                const context = canvas.getContext('2d');
                
                context.fillStyle = 'rgba(255, 255, 255, 0.9)';
                context.beginPath();
                context.roundRect(0, 0, canvas.width, canvas.height, 20);
                context.fill();
                
                context.strokeStyle = '#4CAF50';
                context.lineWidth = 10;
                context.stroke();
                
                context.font = 'bold 36px Arial';
                context.fillStyle = '#333';
                context.textAlign = 'center';
                context.textBaseline = 'middle';
                context.fillText(text, canvas.width / 2, canvas.height / 2);
                
                const texture = new THREE.CanvasTexture(canvas);
                const material = new THREE.MeshBasicMaterial({map: texture, transparent: true});
                const geometry = new THREE.PlaneGeometry(0.6, 0.3);
                
                const labelMesh = new THREE.Mesh(geometry, material);
                labelMesh.position.copy(position);
                labelMesh.userData = { name: text }; 
                
                return labelMesh;
            };

            const labelLabour = createLabel('Labour', new THREE.Vector3(-0.9, 0.5, 0.5));
            const labelCapital = createLabel('Capital', new THREE.Vector3(0, 1.3, 0));
            const labelTech = createLabel('Technology', new THREE.Vector3(0.9, 0.5, 0.5));

            factoryGroup.add(labelLabour);
            factoryGroup.add(labelCapital);
            factoryGroup.add(labelTech);
            clickableObjects.push(labelLabour, labelCapital, labelTech);

            // 5. Anchor the factory to the image target
            const anchor = mindarThree.addAnchor(0);
            anchor.group.add(factoryGroup);

            // 6. Handle Clicks / Taps
            const raycaster = new THREE.Raycaster();
            const mouse = new THREE.Vector2();
            let explanationTimeout;

            const onPointerDown = (event) => {
                if (!anchor.group.visible) return;

                let clientX, clientY;
                if (event.changedTouches) {
                    clientX = event.changedTouches[0].clientX;
                    clientY = event.changedTouches[0].clientY;
                } else {
                    clientX = event.clientX;
                    clientY = event.clientY;
                }

                mouse.x = (clientX / window.innerWidth) * 2 - 1;
                mouse.y = -(clientY / window.innerHeight) * 2 + 1;

                raycaster.setFromCamera(mouse, camera);
                const intersects = raycaster.intersectObjects(clickableObjects, false);
                
                if (intersects.length > 0) {
                    const labelName = intersects[0].object.userData.name;
                    explanationDiv.innerText = explanations[labelName];
                    explanationDiv.style.display = 'block';
                    
                    clearTimeout(explanationTimeout);
                    explanationTimeout = setTimeout(() => {
                        explanationDiv.style.display = 'none';
                    }, 4000);
                }
            };

            window.addEventListener('pointerdown', onPointerDown);

            // 7. Start the AR Engine
            console.log("Requesting camera start...");
            const startPromise = mindarThree.start();
            const timeoutPromise = new Promise((_, reject) => {
                setTimeout(() => reject(new Error("Camera request timed out after 10 seconds.")), 10000);
            });

            await Promise.race([startPromise, timeoutPromise]);
            console.log("Camera started successfully!");
            
            startScreen.style.display = "none";
            
            renderer.setAnimationLoop(() => {
                labelLabour.quaternion.copy(camera.quaternion);
                labelCapital.quaternion.copy(camera.quaternion);
                labelTech.quaternion.copy(camera.quaternion);
                renderer.render(scene, camera);
            });

        } catch (error) {
            console.error("Full Error:", error);
            // Show the exact error to the user in an alert so we don't need vconsole
            alert("Crash Report: " + error.message);
            startButton.innerText = "Start AR Experience";
            startButton.disabled = false;
        }
    });
});
