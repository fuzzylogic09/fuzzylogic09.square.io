let player;
let grounds = [];
let obstacles = [];
let score = 0;
let gameSpeed = 3;

let accelerationInterval = 20000;
let accelerationPercentage = 0.08;
let lastAccelerationTime = 0;
let maxGameSpeed = 10;

let elementLibrary;
let currentElementId = 'start';
let lastSpawnedRightX = 0;
const SPAWN_BUFFER_DISTANCE = 300; // À quelle distance hors écran on commence à spawner
const MAX_EMPTY_SCREEN_CHECK_WIDTH = 100; // Largeur de la zone de vérification d'écran vide

let canvasWidth; // Sera défini par windowWidth
let canvasHeight; // Sera défini par windowHeight
let groundLevel; // Sera calculé

let skyColor, groundColor, playerColor, platformColor, triangleColor, darkSquareColor, startScreenTextColor;

let gameStarted = false;
let gameOver = false;

let gameOverDiv, finalScoreSpan, restartButtonElem, scoreDiv, startScreenDiv, rotateMessageDiv;


function setup() {
    canvasWidth = windowWidth;
    canvasHeight = windowHeight;
    createCanvas(canvasWidth, canvasHeight);
    rectMode(CENTER);
    textAlign(CENTER, CENTER);
    angleMode(DEGREES);

    // Couleurs
    skyColor = color(135, 206, 235);
    groundColor = color(139, 69, 19);
    playerColor = color(255, 215, 0);
    platformColor = color(120, 120, 120);
    darkSquareColor = color(80, 80, 80);
    triangleColor = color(255, 0, 0);
    startScreenTextColor = color(50, 50, 150);

    // Éléments du DOM
    scoreDiv = select('#score');
    gameOverDiv = select('#gameOverScreen');
    finalScoreSpan = select('#finalScore');
    restartButtonElem = select('#restartButton');
    startScreenDiv = select('#startScreenContainer');
    rotateMessageDiv = select('#rotateDeviceMessage');

    restartButtonElem.mousePressed(handleRestart); // Changé pour une fonction qui gère le redémarrage
    
    checkOrientation(); // Vérifier l'orientation au démarrage
    window.addEventListener('orientationchange', checkOrientation); // Et sur changement

    initializeGameVariables();
    displayStartScreen(); // Afficher l'écran de démarrage et mettre le jeu en pause
}

function initializeGameVariables() {
    groundLevel = canvasHeight - (canvasHeight * 0.12); // Sol à 12% du bas de l'écran
    player = new Player();
    grounds = [];
    obstacles = [];
    score = 0;
    gameSpeed = 3.5; // Légère augmentation
    gameOver = false;

    grounds.push(new GroundSegment(0, groundLevel, width * 2, height - groundLevel));

    currentElementId = 'start';
    lastSpawnedRightX = 50;
    
    loadElementLibrary();

    // Vider les obstacles existants avant de pré-remplir
    obstacles = [];
    while (lastSpawnedRightX < width + SPAWN_BUFFER_DISTANCE + 200) {
        spawnNextElementPattern();
    }
}

function displayStartScreen() {
    gameStarted = false;
    startScreenDiv.style('display', 'block');
    gameOverDiv.style('display', 'none');
    scoreDiv.html('Score: 0'); // Afficher le score initial
    player.resetForStart(); // S'assurer que le joueur est dans une position de départ
    noLoop(); // Mettre le jeu en pause
    redraw(); // Dessiner l'état initial une fois
}

function handleStartInput() {
    if (!gameStarted) {
        if (windowWidth < windowHeight && windowWidth < 768) { // Si en portrait sur un appareil mobile supposé
            checkOrientation(); // Revérifier et potentiellement afficher le message
            if (rotateMessageDiv.style('display') === 'block') {
                return; // Ne pas démarrer si le message de rotation est affiché
            }
        }
        gameStarted = true;
        startScreenDiv.style('display', 'none');
        lastAccelerationTime = millis();
        player.jump(); // Premier saut pour démarrer
        loop();
    } else if (!gameOver) { // Si le jeu est déjà démarré et pas game over
        player.jump();
    }
}

function handleRestart() {
    gameOverDiv.style('display', 'none');
    initializeGameVariables();
    displayStartScreen(); // Retourner à l'écran de démarrage
}


function draw() {
    background(skyColor);

    // Afficher le sol même si le jeu n'a pas commencé
    for (let i = grounds.length - 1; i >= 0; i--) {
        grounds[i].show();
        if (gameStarted && !gameOver) grounds[i].update(); // Mettre à jour seulement si le jeu tourne
        if (grounds[i].isOffscreen()) {
            grounds.splice(i, 1);
        }
    }
    if (gameStarted && !gameOver && grounds.length > 0 && grounds[grounds.length - 1].x + grounds[grounds.length-1].w < width + 200) {
         grounds.push(new GroundSegment(grounds[grounds.length - 1].x + grounds[grounds.length-1].w - gameSpeed, groundLevel, width, height - groundLevel));
    }
    
    // Afficher les obstacles/plateformes même si le jeu n'a pas commencé (pour l'écran de démarrage)
     for (let obs of obstacles) {
        obs.show();
    }

    player.show(); // Toujours afficher le joueur

    if (!gameStarted) {
        // Le texte de l'écran de démarrage est géré par le DIV HTML maintenant
        return; // Ne pas exécuter la logique de jeu
    }
    
    if (gameOver) { // Si game over, on pourrait afficher la scène finale figée ici si on ne redirige pas vers un écran
        return;
    }

    // --- Logique de jeu active ---
    if (millis() - lastAccelerationTime > accelerationInterval) {
        if (gameSpeed < maxGameSpeed) {
            gameSpeed *= (1 + accelerationPercentage);
            gameSpeed = min(gameSpeed, maxGameSpeed);
        }
        lastAccelerationTime = millis();
    }

    // Spawner de nouveaux éléments
    if (lastSpawnedRightX < width + SPAWN_BUFFER_DISTANCE) {
        spawnNextElementPattern();
    }

    // Vérification "Guaranteed Obstacle Generation"
    let visibleObstaclesOnScreen = false;
    for (let obs of obstacles) {
        if (obs.x + obs.w/2 > 0 && obs.x - obs.w/2 < width) {
            visibleObstaclesOnScreen = true;
            break;
        }
    }
    if (!visibleObstaclesOnScreen && obstacles.length > 0) { // S'il y a des obstacles mais aucun n'est visible
         // Et que le dernier obstacle généré est loin derrière
        let mostAdvancedObstacleX = 0;
        if(obstacles.length > 0) mostAdvancedObstacleX = obstacles[obstacles.length-1].x;

        if (lastSpawnedRightX < mostAdvancedObstacleX + width/2 ) { // Si le spawner est trop en retard par rapport aux obstacles déjà existants et hors écran
            // console.log("No visible obstacles, spawner might be too far back. Advancing spawner.");
            lastSpawnedRightX = width + 50; // Forcer le spawner à se rapprocher du bord de l'écran
            currentElementId = 'start'; // Repartir sur un élément simple pour éviter les blocages
        }
    } else if (obstacles.length === 0 && player.x > width / 3) { // S'il n'y a plus du tout d'obstacles et que le joueur avance
        // console.log("No obstacles at all, forcing spawn.");
        lastSpawnedRightX = width + 50;
        currentElementId = 'start';
        spawnNextElementPattern(); // Forcer un spawn immédiat
    }


    player.update();
    let onAnyPlatformThisFrame = false;

    for (let i = obstacles.length - 1; i >= 0; i--) {
        let obs = obstacles[i];
        // obs.show(); // Déplacé plus haut pour affichage même sur écran de démarrage
        obs.update();

        if (obs.type === 'triangle') {
            if (obs.collidesWith(player)) {
                triggerGameOver(); break;
            }
        } else if (obs.type === 'square' && obs.isPlatform) {
            let pTop = obs.y - obs.h / 2;
            let playerBottom = player.y + player.size / 2;
            let playerCorners = player.getCorners();
            let playerMinX = min(playerCorners.map(p => p.x));
            let playerMaxX = max(playerCorners.map(p => p.x));

            if (playerMaxX > obs.x - obs.w / 2 && playerMinX < obs.x + obs.w / 2) {
                if (playerBottom >= pTop && playerBottom <= pTop + 10 && player.vy >= 0) {
                    player.y = pTop - player.size / 2;
                    player.land();
                    onAnyPlatformThisFrame = true;
                }
            }
        } // else if (obs.type === 'square' && !obs.isPlatform && obs.collidesWith(player)) { /* triggerGameOver(); */ }


        if (obs.isOffscreen()) {
            if (!gameOver && !obs.countedForScore && obs.x < player.x) { // Obstacle dépassé par le joueur
                score++;
                obs.countedForScore = true;
            }
            obstacles.splice(i, 1);
        }
    }
    
    if (gameOver) return;

    if (!onAnyPlatformThisFrame && player.y + player.size / 2 < groundLevel && player.grounded) {
        if(player.vy >= 0) {
            player.grounded = false;
        }
    }

    // player.show(); // Déplacé plus haut

    scoreDiv.html('Score: ' + score);
}

function keyPressed() {
    if (key === ' ' || keyCode === UP_ARROW) {
        handleStartInput();
    }
    // La touche 'r' pour redémarrer est gérée par le bouton HTML maintenant
    return false;
}

function mousePressed() { // Gère les clics et les "taps"
    handleStartInput();
    return false; // Empêche le comportement par défaut (zoom, etc.)
}

function triggerGameOver() {
    if (gameOver) return;
    gameOver = true;
    finalScoreSpan.html(score);
    gameOverDiv.style('display', 'block');
    // noLoop(); // La boucle draw s'arrête avec `if(gameOver) return;`
}

function windowResized() {
    canvasWidth = windowWidth;
    canvasHeight = windowHeight;
    resizeCanvas(canvasWidth, canvasHeight);
    groundLevel = canvasHeight - (canvasHeight * 0.12);
    player.y = groundLevel - player.size / 2; // Repositionner le joueur si nécessaire
    player.x = width / 4; // S'assurer que x est toujours relatif à la nouvelle largeur
    
    // Pour l'écran de démarrage, il est bon de redessiner si la fenêtre est redimensionnée
    if (!gameStarted) {
       redraw();
    }
    checkOrientation();
}

function checkOrientation() {
    // Vérifier si l'écran est en mode portrait ET si c'est un "petit" écran (mobile probable)
    if (window.matchMedia("(orientation: portrait)").matches && windowWidth < 768) { // 768px est un breakpoint commun pour tablettes/mobiles
        rotateMessageDiv.style('display', 'block');
        if(gameStarted) noLoop(); // Mettre en pause si le jeu tournait
    } else {
        rotateMessageDiv.style('display', 'none');
        if(gameStarted && !isLooping() && !gameOver) loop(); // Reprendre si le jeu était en pause à cause de l'orientation
    }
}


// --- Classes (Player, Obstacle, GroundSegment) ---
// (Identiques à la version précédente, mais Player.resetForStart() est ajouté)

class Player {
    constructor() {
        this.size = 30;
        this.baseX = width / 4; // Garder une position de base X relative
        this.x = this.baseX;
        this.y = groundLevel - this.size / 2;
        this.vy = 0;
        this.gravity = 0.75; // Légère augmentation
        this.jumpForce = -16; // Un peu plus fort
        this.doubleJumpForce = -11;
        this.grounded = true;
        this.angle = 0;
        this.rotationSpeed = 0;
        this.targetRotationSpeed = 9;
        this.maxJumps = 2;
        this.jumpsMade = 0;
    }

    resetForStart() { // Appelé pour l'écran de démarrage
        this.x = this.baseX;
        this.y = groundLevel - this.size / 2;
        this.vy = 0;
        this.angle = 0;
        this.rotationSpeed = 0;
        this.grounded = true;
        this.jumpsMade = 0;
    }

    jump() {
        if (this.jumpsMade < this.maxJumps) {
            if (this.jumpsMade === 0) {
                this.vy = this.jumpForce;
            } else {
                this.vy = this.doubleJumpForce;
                this.angle = 0;
            }
            this.grounded = false;
            this.jumpsMade++;
            this.rotationSpeed = this.targetRotationSpeed;
        }
    }

    land() {
        this.vy = 0;
        this.grounded = true;
        this.jumpsMade = 0;
        this.rotationSpeed = 0;
        this.angle = 0;
    }

    update() {
        this.x = this.baseX; // S'assurer que le joueur reste centré horizontalement (le monde bouge)

        if (!this.grounded) {
            this.vy += this.gravity;
            this.angle += this.rotationSpeed;
        }
        this.y += this.vy;

        if (this.y + this.size / 2 >= groundLevel) {
            this.y = groundLevel - this.size / 2;
            this.land();
        }
        if (this.y - this.size/2 < 0) {
            this.y = this.size/2;
            this.vy = 0;
        }
    }

    show() {
        push();
        translate(this.x, this.y);
        rotate(this.angle);
        fill(playerColor);
        rect(0, 0, this.size, this.size);
        pop();
    }

    getCorners() {
        let corners = [];
        const halfSize = this.size / 2;
        let points = [
            { x: -halfSize, y: -halfSize }, { x: halfSize, y: -halfSize },
            { x: halfSize, y: halfSize }, { x: -halfSize, y: halfSize }
        ];
        for (let p of points) {
            let rotatedX = p.x * cos(this.angle) - p.y * sin(this.angle);
            let rotatedY = p.x * sin(this.angle) + p.y * cos(this.angle);
            corners.push(createVector(this.x + rotatedX, this.y + rotatedY));
        }
        return corners;
    }
}

class Obstacle {
    constructor(x, y, w, h, type, col, isPlatform = false) {
        this.x = x; this.y = y; this.w = w; this.h = h;
        this.type = type; this.color = col; this.isPlatform = isPlatform;
        this.countedForScore = false;
    }
    update() { this.x -= gameSpeed; }
    show() {
        push(); translate(this.x, this.y); fill(this.color);
        if (this.type === 'square') rect(0, 0, this.w, this.h);
        else if (this.type === 'triangle') triangle(0, -this.h / 2, -this.w / 2, this.h / 2, this.w / 2, this.h / 2);
        pop();
    }
    isOffscreen() { return this.x + this.w / 2 < 0; }
    collidesWith(player) {
        const playerCorners = player.getCorners();
        if (this.type === 'triangle') {
            const triPoints = [
                createVector(this.x, this.y - this.h / 2), createVector(this.x - this.w / 2, this.y + this.h / 2),
                createVector(this.x + this.w / 2, this.y + this.h / 2)
            ];
            for (let corner of playerCorners) if (this.pointInTriangle(corner, triPoints[0], triPoints[1], triPoints[2])) return true;
            
            let playerAABB = { minX:Infinity, maxX:-Infinity, minY:Infinity, maxY:-Infinity };
            playerCorners.forEach(p => {
                playerAABB.minX = min(playerAABB.minX, p.x); playerAABB.maxX = max(playerAABB.maxX, p.x);
                playerAABB.minY = min(playerAABB.minY, p.y); playerAABB.maxY = max(playerAABB.maxY, p.y);
            });
            if (playerAABB.maxX > this.x - this.w/2 && playerAABB.minX < this.x + this.w/2 &&
                playerAABB.maxY > this.y - this.h/2 && playerAABB.minY < this.y + this.h/2) {
                if(this.pointInTriangle(createVector(player.x, player.y), triPoints[0], triPoints[1], triPoints[2])) return true;
            }

        } else if (this.type === 'square' && !this.isPlatform) {
            let playerAABB = { minX:Infinity, maxX:-Infinity, minY:Infinity, maxY:-Infinity };
            playerCorners.forEach(p => {
                playerAABB.minX = min(playerAABB.minX, p.x); playerAABB.maxX = max(playerAABB.maxX, p.x);
                playerAABB.minY = min(playerAABB.minY, p.y); playerAABB.maxY = max(playerAABB.maxY, p.y);
            });
            return (playerAABB.maxX > this.x - this.w / 2 && playerAABB.minX < this.x + this.w / 2 &&
                    playerAABB.maxY > this.y - this.h / 2 && playerAABB.minY < this.y + this.h / 2);
        }
        return false;
    }
    pointInTriangle(pt, v1, v2, v3) {
        function sign(p1,p2,p3){return(p1.x-p3.x)*(p2.y-p3.y)-(p2.x-p3.x)*(p1.y-p3.y);}
        let d1=sign(pt,v1,v2); let d2=sign(pt,v2,v3); let d3=sign(pt,v3,v1);
        return !(((d1<0)||(d2<0)||(d3<0)) && ((d1>0)||(d2>0)||(d3>0)));
    }
}

class GroundSegment { /* ... Identique ... */ 
    constructor(x, y, w, h) { this.x = x; this.y = y; this.w = w; this.h = h;}
    update() { this.x -= gameSpeed; }
    show() { push(); fill(groundColor); noStroke(); rectMode(CORNER); rect(this.x, this.y, this.w, this.h); rectMode(CENTER); pop(); }
    isOffscreen() { return this.x + this.w < 0;}
}

// --- Gestion de la Librairie d'Éléments ---
// (loadElementLibrary, getColorByName, spawnNextElementPattern sont identiques à la version précédente)
function loadElementLibrary() {
    elementLibrary = {
        'start': {
            description: "Plateforme de départ simple",
            spawnables: [ { type: 'square', yLevel: 'ground', w: 200, h: 20, isPlatform: true, colorName: 'platformColor', xOffset: 0 } ],
            next: [
                { id: 'gapAndTriangle', probability: 0.4, minSpacing: 120, maxSpacing: 180 },
                { id: 'singlePlatformUp', probability: 0.6, minSpacing: 80, maxSpacing: 120 }
            ]
        },
        'gapAndTriangle': {
            description: "Un trou suivi d'un triangle",
            spawnables: [ { type: 'triangle', yLevel: 'ground', size: 30, colorName: 'triangleColor', xOffset: 0 } ],
            next: [
                { id: 'threeStepUp', probability: 0.5, minSpacing: 150, maxSpacing: 200 },
                { id: 'doublePlatform', probability: 0.5, minSpacing: 100, maxSpacing: 150 }
            ]
        },
        'singlePlatformUp': {
            description: "Une plateforme surélevée",
            spawnables: [ { type: 'square', yLevel: 'groundUp', yOffset: -70, w: 100, h: 20, isPlatform: true, colorName: 'platformColor', xOffset: 0 } ],
            next: [
                { id: 'gapAndTriangle', probability: 0.6, minSpacing: 100, maxSpacing: 150 },
                { id: 'start', probability: 0.4, minSpacing: 80, maxSpacing: 120 }
            ]
        },
        'threeStepUp': {
            description: "Trois petites plateformes montantes",
            spawnables: [
                { type: 'square', yLevel: 'groundUp', yOffset: -35, w: 70, h: 15, isPlatform: true, colorName: 'platformColor', xOffset: 0 },
                { type: 'square', yLevel: 'groundUp', yOffset: -80, w: 70, h: 15, isPlatform: true, colorName: 'platformColor', xOffset: 110 },
                { type: 'square', yLevel: 'groundUp', yOffset: -125, w: 70, h: 15, isPlatform: true, colorName: 'platformColor', xOffset: 220 }
            ],
            next: [ { id: 'highGapTriangle', probability: 1.0, minSpacing: 120, maxSpacing: 180 } ]
        },
        'doublePlatform': {
            description: "Deux plateformes à différentes hauteurs",
            spawnables: [
                { type: 'square', yLevel: 'ground', w: 120, h: 20, isPlatform: true, colorName: 'platformColor', xOffset: 0 },
                { type: 'square', yLevel: 'groundUp', yOffset: -90, w: 80, h: 20, isPlatform: true, colorName: 'platformColor', xOffset: 200 }
            ],
            next: [ {id: 'start', probability: 0.6, minSpacing:100, maxSpacing:150}, {id: 'gapAndTriangle', probability: 0.4, minSpacing:80, maxSpacing:120} ]
        },
        'highGapTriangle': {
            description: "Un triangle après un saut potentiellement haut",
            spawnables: [ { type: 'triangle', yLevel: 'groundUp', yOffset: -50, size: 35, colorName: 'triangleColor', xOffset: 0 } ],
            next: [ {id: 'start', probability: 1.0, minSpacing: 100, maxSpacing:150} ]
        }
    };
}
function getColorByName(name) { /* ... Identique ... */ 
    switch(name){case 'platformColor':return platformColor; case 'triangleColor':return triangleColor; case 'darkSquareColor':return darkSquareColor; default:return color(200);}
}
function spawnNextElementPattern() { /* ... Identique, mais s'assurer que les yOffset négatifs montent bien ... */
    if (!elementLibrary || !elementLibrary[currentElementId]) {
        console.error("Element ID not found:", currentElementId, "Defaulting to 'start'.");
        currentElementId = 'start';
        if (!elementLibrary[currentElementId]) { console.error("'start' pattern missing!"); return; }
    }

    let patternData = elementLibrary[currentElementId];
    let patternBaseX = lastSpawnedRightX;
    let currentPatternMaxX = patternBaseX;

    for (let spawnable of patternData.spawnables) {
        let entityX = patternBaseX + (spawnable.xOffset || 0);
        let entityY;
        let entityW = spawnable.w || spawnable.size;
        let entityH = spawnable.h || spawnable.size;

        // yLevel: 'ground' -> sur le sol
        // yLevel: 'groundUp' -> yOffset est la distance VERS LE HAUT depuis le sol. Un yOffset positif monte.
        if (spawnable.yLevel === 'ground') {
            entityY = groundLevel - entityH / 2 - (spawnable.yOffset || 0); // yOffset ici serait pour ajustement fin au sol
        } else if (spawnable.yLevel === 'groundUp') {
             // yOffset positif = plus haut. Donc on soustrait du groundLevel.
            entityY = groundLevel - entityH / 2 - (spawnable.yOffset || 0) ;
        } else {
            entityY = height / 2; // Fallback
        }
        
        let newObs = new Obstacle(entityX + entityW/2, entityY, entityW, entityH, spawnable.type, getColorByName(spawnable.colorName), spawnable.isPlatform || false);
        obstacles.push(newObs);
        currentPatternMaxX = max(currentPatternMaxX, entityX + entityW);
    }

    let cumulativeProbability = 0;
    let randomChoice = random(1);
    let nextPatternDetails;

    if (!patternData.next || patternData.next.length === 0) {
        console.warn("Pattern has no next defined:", currentElementId);
        currentElementId = 'start'; 
        nextPatternDetails = {id: 'start', minSpacing: 100, maxSpacing: 150};
    } else {
        for (let next of patternData.next) {
            cumulativeProbability += next.probability;
            if (randomChoice <= cumulativeProbability) { nextPatternDetails = next; break; }
        }
        if(!nextPatternDetails) nextPatternDetails = patternData.next[0]; // Fallback
    }

    let spacing = random(nextPatternDetails.minSpacing, nextPatternDetails.maxSpacing);
    lastSpawnedRightX = currentPatternMaxX + spacing;
    currentElementId = nextPatternDetails.id;
}