import { HandLandmarker, FilesetResolver } from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/vision_bundle.mjs";

let canvas, ctx, video, handLandmarker;
let currentColor = '#00ffff';
let strokes = [];
let currentStroke = [];
let lastGestureTime = 0;

window.startAirDrawing = async function() {
    document.getElementById('landing').classList.add('hidden');
    document.getElementById('app').classList.remove('hidden');
    
    canvas = document.getElementById('canvas');
    ctx = canvas.getContext('2d');
    video = document.getElementById('video');

    function resize() {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    }
    resize();
    window.addEventListener('resize', resize);

    try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
            video: { width: 1280, height: 720 } 
        });
        video.srcObject = stream;
    } catch (e) {
        alert("Camera permission is required");
        return;
    }

    const fileset = await FilesetResolver.forVisionTasks("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm");
    handLandmarker = await HandLandmarker.createFromOptions(fileset, {
        baseOptions: { 
            modelAssetPath: "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task" 
        },
        numHands: 2,
        runningMode: "VIDEO",
        minHandDetectionConfidence: 0.7,
        minHandPresenceConfidence: 0.7
    });

    console.log("✅ Hand Tracking Improved");
    gameLoop();
};

function gameLoop() {
    requestAnimationFrame(gameLoop);
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    strokes.forEach(s => drawStroke(s));

    if (!handLandmarker) return;

    const results = handLandmarker.detectForVideo(video, performance.now());

    if (results && results.landmarks && results.landmarks.length > 0) {
        results.landmarks.forEach((landmarks, i) => {
            const hand = results.handednesses[i][0].categoryName;
            processHand(landmarks, hand);
        });
    }
}

function drawStroke(s) {
    ctx.strokeStyle = s.color;
    ctx.lineWidth = s.width || 14;
    ctx.lineCap = "round";
    ctx.shadowBlur = 22;
    ctx.shadowColor = s.color;
    ctx.beginPath();
    s.points.forEach((p,i) => i===0 ? ctx.moveTo(p.x,p.y) : ctx.lineTo(p.x,p.y));
    ctx.stroke();
}

function processHand(landmarks, handType) {
    const gesture = getGesture(landmarks);
    document.getElementById('gesture').textContent = gesture;

    const tip = landmarks[8];
    const x = tip.x * canvas.width;
    const y = tip.y * canvas.height;

    if (gesture === "DRAW") {
        if (currentStroke.length === 0) currentStroke = [{x, y}];
        else currentStroke.push({x, y});

        ctx.strokeStyle = currentColor;
        ctx.lineWidth = 14;
        ctx.beginPath();
        ctx.moveTo(currentStroke[currentStroke.length-2].x, currentStroke[currentStroke.length-2].y);
        ctx.lineTo(x, y);
        ctx.stroke();
    } 
    else if (gesture === "FINISH") {
        if (currentStroke.length > 8) {
            const recognized = recognizeShape(currentStroke);
            strokes.push({
                points: recognized.points,
                color: currentColor,
                width: 14
            });
        }
        currentStroke = [];
    } 
    else if (gesture === "ERASE_ALL") {
        strokes = [];
        currentStroke = [];
    } 
    else if (gesture === "CHANGE_COLOR" && handType === "Left") {
        const colors = ['#00ffff','#ff00ff','#ffff00','#ff6600','#ffffff','#00ff88'];
        currentColor = colors[Math.floor(Math.random() * colors.length)];
    }
}

function getGesture(landmarks) {
    const now = Date.now();
    if (now - lastGestureTime < 300) return "IDLE";

    const fingers = [
        landmarks[8].y < landmarks[5].y,   // index
        landmarks[12].y < landmarks[9].y,  // middle
        landmarks[16].y < landmarks[13].y, // ring
        landmarks[20].y < landmarks[17].y  // pinky
    ];

    const count = fingers.filter(Boolean).length;

    if (count === 5) {
        lastGestureTime = now;
        return "ERASE_ALL";
    }
    if (count === 1) return "DRAW";
    if (count === 4) {
        lastGestureTime = now;
        return "FINISH";
    }
    if (count === 2 && landmarks[8].y < landmarks[5].y) {
        lastGestureTime = now;
        return "CHANGE_COLOR";
    }
    return "IDLE";
}

function recognizeShape(points) {
    if (points.length < 10) return { points };

    // Calculate bounding box
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    points.forEach(p => {
        minX = Math.min(minX, p.x);
        maxX = Math.max(maxX, p.x);
        minY = Math.min(minY, p.y);
        maxY = Math.max(maxY, p.y);
    });

    const width = maxX - minX;
    const height = maxY - minY;
    const aspect = width / height;

    // Straight Line
    if (width > 100 && height < width * 0.25) {
        return { points: [points[0], points[points.length-1]] };
    }

    // Circle Detection
    if (Math.abs(width - height) < width * 0.4 && width > 80) {
        const cx = (minX + maxX) / 2;
        const cy = (minY + maxY) / 2;
        const radius = (width + height) / 4;
        const circlePoints = [];
        for (let i = 0; i <= 36; i++) {
            const a = (i / 36) * Math.PI * 2;
            circlePoints.push({
                x: cx + Math.cos(a) * radius,
                y: cy + Math.sin(a) * radius * 0.95
            });
        }
        return { points: circlePoints };
    }

    // Rectangle
    if (width > 80 && height > 60) {
        return {
            points: [
                {x:minX, y:minY}, {x:maxX, y:minY},
                {x:maxX, y:maxY}, {x:minX, y:maxY},
                {x:minX, y:minY}
            ]
        };
    }

    return { points };
}

window.changeColor = (c) => currentColor = c;
window.saveArtwork = async function() {
    if (!canvas) return;
    
    const imageData = canvas.toDataURL('image/png');
    
    try {
        const response = await fetch('http://localhost:5000/save', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ image: imageData })
        });
        
        const result = await response.json();
        
        if (result.status === "success") {
            alert(`✅ Artwork saved as ${result.filename}`);
        } else {
            alert("Failed to save: " + result.message);
        }
    } catch (e) {
        alert("Backend not running. Start with: python backend/app.py");
    }
};
// Add this at the bottom
window.login = async function() {
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;

    try {
        const res = await fetch('http://localhost:5000/login', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({username, password})
        });
        
        const data = await res.json();
        
        if (data.status === "success") {
            document.getElementById('login-page').classList.add('hidden');
            document.getElementById('landing').classList.remove('hidden');
        } else {
            alert("Login failed: " + data.message);
        }
    } catch(e) {
        alert("Backend not running. Start backend first.");
    }
};