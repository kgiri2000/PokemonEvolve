// Global variables to hold our game objects and encounter state.
let player;
let cursors;
let obstacles;
let enemyGroup;
let currentScene;
let inEncounter = false;  // Indicates if an encounter popup is active.
let encounterPopup;       // Reference to the current popup container.

async function startGame() {
  // Fetch the player's Pokémon data from the API (using "dragonite" as an example).
  let pokemonName = "dragonite";
  const response = await axios.get(`https://pokeapi.co/api/v2/pokemon/${pokemonName}`);
  const playerSpriteURL = response.data.sprites.front_default;
  console.log("Player sprite URL:", playerSpriteURL);

  // Extract player's base stats and set initial level & EXP.
  const playerStats = {
    name: response.data.name,
    hp: response.data.stats.find(s => s.stat.name === "hp").base_stat,
    attack: response.data.stats.find(s => s.stat.name === "attack").base_stat,
    defense: response.data.stats.find(s => s.stat.name === "defense").base_stat,
    specialAttack: response.data.stats.find(s => s.stat.name === "special-attack").base_stat,
    specialDefense: response.data.stats.find(s => s.stat.name === "special-defense").base_stat,
    speed: response.data.stats.find(s => s.stat.name === "speed").base_stat,
    level: 5,
    exp: 0
  };

  // Phaser game configuration.
  const config = {
    type: Phaser.AUTO,
    width: 1200,
    height: 700,
    physics: {
      default: "arcade",
      arcade: { debug: false }
    },
    scene: {
      preload: function() {
        // Preload assets:
        // - Background image
        // - Player sprite from the API
        // - Obstacle image (e.g., a tree)
        this.load.image("background", "/assets/rpgbg.jpg");
        this.load.image("player", playerSpriteURL);
        this.load.image("obstacle", "/assets/tree.png");
      },
      create: function() {
        currentScene = this;
        // Add the background image centered in the game window.
        this.add.image(this.game.config.width / 2, this.game.config.height / 2, "background");

        // Create groups for obstacles and enemy Pokémon.
        obstacles = this.physics.add.staticGroup();
        enemyGroup = this.physics.add.group();

        // Spawn the first set of obstacles and enemies.
        spawnObstacles(this);
        spawnEnemies(this);

        // Create the player sprite and enable physics.
        player = this.physics.add.sprite(50, 50, "player").setScale(1);
        cursors = this.input.keyboard.createCursorKeys();

        // Set up collisions.
        this.physics.add.collider(player, obstacles);
        this.physics.add.collider(player, enemyGroup);

        // Display player Pokémon information at the top-left of the screen.
        this.add.text(10, 10, 
          `Name: ${playerStats.name}\nLevel: ${playerStats.level}\nHP: ${playerStats.hp}\nEXP: ${playerStats.exp}`, 
          { fontSize: "16px", fill: "#fff" }
        );
      },
      update: function() {
        // If an encounter popup is active, freeze the player.
        if (inEncounter) {
          player.setVelocity(0, 0);
          if (player.body) {
            player.body.moves = false;
          }
        } else {
          // Re-enable movement.
          if (player.body) {
            player.body.moves = true;
          }
          player.setVelocity(0);
          if (cursors.left.isDown) {
            player.setVelocityX(-150);
          } else if (cursors.right.isDown) {
            player.setVelocityX(150);
          }
          if (cursors.up.isDown) {
            player.setVelocityY(-150);
          } else if (cursors.down.isDown) {
            player.setVelocityY(150);
          }
        }

        // Change screens when the player reaches the left edge.
        if (player.x < 0) {
          nextScreen(this);
        }

        // Check for enemy encounters:
        // If any enemy is within 100 pixels and no encounter is active, show the in-game popup.
        enemyGroup.getChildren().forEach((enemy) => {
          if (Phaser.Math.Distance.Between(player.x, player.y, enemy.x, enemy.y) < 100 && !inEncounter) {
            inEncounter = true;
            player.setVelocity(0, 0);
            if (player.body) {
              player.body.moves = false;
            }
            showEncounterPopup(this, enemy);
          }
        });
      }
    }
  };

  new Phaser.Game(config);
}

/**
 * Spawns obstacles at valid random positions.
 */
function spawnObstacles(scene) {
  obstacles.clear(true, true);
  const excludePositions = [];
  if (player) {
    excludePositions.push({ x: player.x, y: player.y });
  }
  const numObstacles = Phaser.Math.Between(2, 4);
  for (let i = 0; i < numObstacles; i++) {
    const pos = getValidRandomPosition(scene, excludePositions, 300);
    excludePositions.push({ x: pos.x, y: pos.y });
    let obs = obstacles.create(pos.x, pos.y, "obstacle");
    // Scale obstacle (adjust scale values as needed).
    obs.setScale(Phaser.Math.FloatBetween(0.02, 0.05));
    obs.refreshBody();
  }
}

/**
 * Spawns enemy Pokémon by fetching data from the API,
 * dynamically loading their images, and adding info text above them.
 */
async function spawnEnemies(scene) {
  // Clear any existing enemy info texts.
  enemyGroup.getChildren().forEach((enemy) => {
    if (enemy.infoText) {
      enemy.infoText.destroy();
    }
  });
  enemyGroup.clear(true, true);

  const numEnemies = Phaser.Math.Between(3, 4);
  const enemyData = [];
  const excludePositions = [];
  if (player) {
    excludePositions.push({ x: player.x, y: player.y });
  }

  // Fetch enemy data via API.
  for (let i = 0; i < numEnemies; i++) {
    let randomId = Phaser.Math.Between(1, 898);
    try {
      let res = await axios.get(`https://pokeapi.co/api/v2/pokemon/${randomId}`);
      let enemySpriteURL = res.data.sprites.back_default || res.data.sprites.front_default;
      let enemyName = res.data.name;
      let enemyHp = res.data.stats.find(s => s.stat.name === "hp").base_stat;
      enemyData.push({ key: `enemy_${randomId}_${i}`, url: enemySpriteURL, name: enemyName, hp: enemyHp, level: 5 });
    } catch (error) {
      console.error("Error fetching enemy Pokémon:", error);
    }
  }

  // Dynamically load enemy images.
  enemyData.forEach((data) => {
    scene.load.image(data.key, data.url);
  });

  scene.load.once("complete", function() {
    enemyData.forEach((data) => {
      const pos = getValidRandomPosition(scene, excludePositions, 300);
      excludePositions.push({ x: pos.x, y: pos.y });
      let enemy = enemyGroup.create(pos.x, pos.y, data.key).setScale(1);
      enemy.setImmovable(true);
      enemy.refreshBody();
      // Store enemy info on the sprite.
      enemy.pokemonInfo = {
        name: data.name,
        hp: data.hp,
        level: data.level
      };
      // Display enemy info above the enemy sprite.
      enemy.infoText = scene.add.text(enemy.x - 40, enemy.y - 50,
        `Name: ${data.name}\nLv: ${data.level}\nHP: ${data.hp}`,
        { font: "12px Arial", fill: "#fff", backgroundColor: "rgba(0,0,0,0.5)" }
      );
    });
  });
  scene.load.start();
}

/**
 * When the player reaches the left side of the screen,
 * change screens by clearing popups and enemy texts, resetting the player's position,
 * and respawning obstacles and enemies.
 */
function nextScreen(scene) {
  if (encounterPopup) {
    encounterPopup.destroy();
    encounterPopup = null;
    inEncounter = false;
  }
  enemyGroup.getChildren().forEach((enemy) => {
    if (enemy.infoText) {
      enemy.infoText.destroy();
    }
  });
  // Reset player's position to the right side.
  player.x = scene.game.config.width - 50;
  spawnObstacles(scene);
  spawnEnemies(scene);
}

/**
 * Returns a valid random position within the game bounds that is not too close
 * to any position in the excludePositions array.
 */
function getValidRandomPosition(scene, excludePositions, safeRadius = 300) {
  let x, y, valid;
  do {
    valid = true;
    x = Phaser.Math.Between(100, scene.game.config.width - 100);
    y = Phaser.Math.Between(100, scene.game.config.height - 100);
    for (let pos of excludePositions) {
      if (Phaser.Math.Distance.Between(x, y, pos.x, pos.y) < safeRadius) {
        valid = false;
        break;
      }
    }
  } while (!valid);
  return { x, y };
}

/**
 * Displays an in-game encounter popup that shows enemy info and provides "Battle" and "Run" buttons.
 * The popup is rendered in a container with a high depth so it appears above all game objects.
 */
function showEncounterPopup(scene, enemy) {
  encounterPopup = scene.add.container(scene.game.config.width / 2, scene.game.config.height / 2);
  encounterPopup.setDepth(9999);

  // Create a semi-transparent background for the popup.
  let bg = scene.add.rectangle(0, 0, 400, 200, 0x000000, 0.8);
  // Create text displaying enemy information.
  let info = `Wild ${enemy.pokemonInfo.name}\nLevel: ${enemy.pokemonInfo.level}\nHP: ${enemy.pokemonInfo.hp}`;
  let popupText = scene.add.text(-180, -70, info, { font: "20px Arial", fill: "#fff" });
  // Create "Battle" and "Run" buttons.
  let battleBtn = scene.add.text(-100, 20, "Battle", { font: "20px Arial", fill: "#0f0", backgroundColor: "#000" })
                         .setInteractive({ useHandCursor: true });
  let runBtn = scene.add.text(20, 20, "Run", { font: "20px Arial", fill: "#f00", backgroundColor: "#000" })
                      .setInteractive({ useHandCursor: true });

  // Use pointerup events for reliable button clicks.
  battleBtn.on("pointerup", () => {
    encounterPopup.destroy();
    encounterPopup = null;
    inEncounter = false;
    if (player.body) {
      player.body.moves = true;
    }
    scene.add.text(scene.game.config.width / 2 - 100, scene.game.config.height / 2 + 100, 
      "Battle Started!", { font: "24px Arial", fill: "#fff" });
    console.log("Battle started with " + enemy.pokemonInfo.name);
  });
  
  // When "Run" is pressed, reposition the player to the right side (to clear enemy range)
  runBtn.on("pointerup", () => {
    encounterPopup.destroy();
    encounterPopup = null;
    inEncounter = false;
    if (player.body) {
      player.body.moves = true;
    }
    // Reposition the player so the encounter isn't immediately re-triggered.
    player.x = scene.game.config.width - 50;
    console.log("You ran away from " + enemy.pokemonInfo.name);
  });

  encounterPopup.add([bg, popupText, battleBtn, runBtn]);

  // Optionally block input to underlying objects briefly.
  scene.input.enabled = false;
  scene.time.addEvent({
    delay: 100,
    callback: () => { scene.input.enabled = true; },
    callbackScope: scene
  });
}

// --------------------------
// Start the Game
// --------------------------
startGame();
