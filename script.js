// --- 1. SETUP HỆ THỐNG ---
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0a0a12);
const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(15, 15, 20);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
document.getElementById('game-canvas').appendChild(renderer.domElement);

const controls = new THREE.OrbitControls(camera, renderer.domElement);
scene.add(new THREE.AmbientLight(0xffffff, 0.6));
const sun = new THREE.DirectionalLight(0xffffff, 1);
sun.position.set(10, 20, 10);
sun.castShadow = true;
scene.add(sun);

// --- 2. LOGIC GAME & BIẾN ---
let money = 0, dirtyCups = 0, isGameOver = false;
let customers = [], currentMix = [];
const ingredients = ["Cafe", "Sữa", "Đường", "Đá", "Kem", "Matcha"];

// Hàm tạo người (đảm bảo hiện 100%)
function createHuman(colorHex) {
    const group = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({ color: colorHex });
    
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 1.2, 12), mat);
    body.position.y = 0.6;
    body.castShadow = true;
    group.add(body);

    const head = new THREE.Mesh(new THREE.SphereGeometry(0.3, 16, 16), mat);
    head.position.y = 1.5;
    group.add(head);

    return group;
}

// Hàm tạo cốc bẩn
function createDirtyCup() {
    const cup = new THREE.Mesh(
        new THREE.CylinderGeometry(0.15, 0.1, 0.3, 12),
        new THREE.MeshStandardMaterial({ color: 0x5d4037 }) // Màu nâu bẩn
    );
    cup.position.y = 1.0; 
    return cup;
}

// --- 3. MÔI TRƯỜNG ---
const floor = new THREE.Mesh(new THREE.PlaneGeometry(50, 50), new THREE.MeshStandardMaterial({color: 0x1a1a1a}));
floor.rotation.x = -Math.PI/2;
floor.receiveShadow = true;
scene.add(floor);

const bar = new THREE.Mesh(new THREE.BoxGeometry(6, 1.4, 2), new THREE.MeshStandardMaterial({color: 0x3d2b1f}));
bar.position.set(-8, 0.7, 0);
bar.castShadow = true;
scene.add(bar);

const tables = [];
for(let i=0; i<8; i++) {
    const x = 5 + (Math.floor(i/2) * 5);
    const z = (i % 2 === 0) ? -5 : 5;
    const tGroup = new THREE.Group();
    const top = new THREE.Mesh(new THREE.CylinderGeometry(1.3, 1.3, 0.1, 32), new THREE.MeshStandardMaterial({color: 0xffffff}));
    top.position.y = 0.85;
    tGroup.add(top);
    tGroup.position.set(x, 0, z);
    scene.add(tGroup);
    tables.push({ x, z, occupied: false, hasDirtyCup: false, mesh: tGroup, cupMesh: null });
}

// --- 4. VÒNG LẶP CHÍNH ---
function spawnCustomer() {
    if (isGameOver) return;
    const waitingCount = customers.filter(c => c.state === "ORDERING").length;

    if (waitingCount >= 10) {
        isGameOver = true;
        alert("GAME OVER! Quán quá tải (10 khách chờ). Điểm: " + money);
        location.reload();
        return;
    }

    const recipe = [ingredients[Math.floor(Math.random()*6)], ingredients[Math.floor(Math.random()*6)]];
    const color = Math.random() * 0xffffff;
    const model = createHuman(color);
    model.position.set(-20, 0, (Math.random()-0.5)*6);
    scene.add(model);

    customers.push({ model, state: "WALKING", recipe, timer: 35, color: "#"+new THREE.Color(color).getHexString(), tableIndex: -1 });
}

window.addIngred = (n) => { currentMix.push(n); updateUI(); };
window.clearMix = () => { currentMix = []; updateUI(); };
function updateUI() {
    document.getElementById('current-mix').innerText = currentMix.join("+") || "---";
    document.getElementById('money').innerText = money;
    document.getElementById('dirty-cups').innerText = dirtyCups;
}

document.getElementById('serve-btn').onclick = () => {
    const c = customers.find(x => x.state === "ORDERING");
    if(!c) return;
    if([...currentMix].sort().join() === [...c.recipe].sort().join()) {
        const tIdx = tables.findIndex(t => !t.occupied && !t.hasDirtyCup);
        if(tIdx !== -1) {
            c.state = "GOING_TO_SEAT"; c.tableIndex = tIdx; tables[tIdx].occupied = true;
            money += 50; updateUI();
        }
    }
    clearMix();
};

function animate() {
    requestAnimationFrame(animate);
    customers.forEach((c, i) => {
        if(c.state === "WALKING") {
            const targetX = -5 - (customers.filter(p => p.state === "ORDERING").indexOf(c) * 1.5);
            c.model.position.x += (targetX - c.model.position.x) * 0.08;
            if(Math.abs(c.model.position.x - targetX) < 0.1) c.state = "ORDERING";
        }
        if(c.state === "ORDERING") {
            c.timer -= 0.016;
            if(c.timer <= 0) { scene.remove(c.model); customers.splice(i, 1); }
        }
        if(c.state === "GOING_TO_SEAT") {
            const t = tables[c.tableIndex];
            c.model.position.x += (t.x - c.model.position.x) * 0.05;
            c.model.position.z += (t.z - c.model.position.z) * 0.05;
            if(Math.abs(t.x - c.model.position.x) < 0.2) {
                c.state = "EATING";
                setTimeout(() => {
                    c.state = "LEAVING";
                    const tb = tables[c.tableIndex];
                    tb.occupied = false; tb.hasDirtyCup = true;
                    tb.cupMesh = createDirtyCup(); tb.mesh.add(tb.cupMesh);
                    dirtyCups++; updateUI();
                }, 4000);
            }
        }
        if(c.state === "LEAVING") {
            c.model.position.x += 0.15;
            if(c.model.position.x > 25) { scene.remove(c.model); customers.splice(i, 1); }
        }
    });

    const ordering = customers.filter(c => c.state === "ORDERING");
    document.getElementById('order-scroll').innerHTML = ordering.map((c, idx) => `
        <div class="order-item ${idx===0?'active':''}">
            <b style="color:${c.color}">●</b> Khách #${idx+1} (${Math.ceil(c.timer)}s)<br>${c.recipe.join("+")}
        </div>`).join("");
    renderer.render(scene, camera);
}

// CLICK RỬA BÁT
window.addEventListener('mousedown', (e) => {
    const mouse = new THREE.Vector2((e.clientX/window.innerWidth)*2-1, -(e.clientY/window.innerHeight)*2+1);
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects(scene.children, true);
    if(intersects.length > 0) {
        tables.forEach(t => {
            let hit = false;
            intersects[0].object.traverseAncestors(a => { if(a === t.mesh) hit = true; });
            if((intersects[0].object === t.mesh || hit) && t.hasDirtyCup) {
                t.hasDirtyCup = false;
                if(t.cupMesh) { t.mesh.remove(t.cupMesh); t.cupMesh = null; }
                dirtyCups = Math.max(0, dirtyCups - 1); updateUI();
            }
        });
    }
});

setInterval(spawnCustomer, 3000);
animate();