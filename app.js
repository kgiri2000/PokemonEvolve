"use strict"; // Correct directive

const express = require("express");
const { engine } = require("express-handlebars");
const axios = require("axios"); // For making HTTP requests
const app = express();

// Register Handlebars with helpers
app.engine(
    "handlebars",
    engine({
        defaultLayout: "main",
        helpers: {
            math: function (lvalue, operator, rvalue) {
                lvalue = parseFloat(lvalue);
                rvalue = parseFloat(rvalue);
                if (isNaN(lvalue) || isNaN(rvalue)) return 0; // Prevent NaN errors

                switch (operator) {
                    case "+": return lvalue + rvalue;
                    case "-": return lvalue - rvalue;
                    case "*": return lvalue * rvalue;
                    case "/": return rvalue !== 0 ? lvalue / rvalue : 0;
                    default: return 0;
                }
            },
            eq: function (a, b) {
                return a === b;
            }
        }
    })
);

app.set("view engine", "handlebars");

app.use(express.static(__dirname + "/public"));
app.use(express.urlencoded({ extended: true })); // Middleware to parse form data
app.use(express.json()); // Middleware to parse JSON data

const port = process.env.PORT || 3000;

app.get("/", (req, res) => {
    res.render("home", { isHome: true });
});

app.get("/displayPokemon", (req, res) => res.render("displayPokemon", {isInfo:  true}));

// Handle the POST submission from displayPokemon
app.post("/pokemon", async (req, res) => {
    const pokemonName = req.body.pokemonName.toLowerCase();

    try {
        const response = await axios.get(`https://pokeapi.co/api/v2/pokemon/${pokemonName}`);
        const pokemonData = response.data;
        res.render("displayPokemon", { pokemon: pokemonData });
    } catch (error) {
        res.render("displayPokemon", { error: "Pokémon not found. Please try again." });
    }
});
app.get("/pokemonBattle", async(req, res) =>{
    res.render("pokemonBattle", {isBattle: true})
});
app.post("/battle", async (req, res) => {
    const { pokemon1, pokemon2 } = req.body;

    try {
        const [poke1, poke2] = await Promise.all([
            axios.get(`https://pokeapi.co/api/v2/pokemon/${pokemon1.toLowerCase()}`),
            axios.get(`https://pokeapi.co/api/v2/pokemon/${pokemon2.toLowerCase()}`)
        ]);

        const p1 = extractPokemonData(poke1.data);
        const p2 = extractPokemonData(poke2.data);

        const battleResult = await simulateBattle(p1, p2);
        res.render("pokemonBattle", {
            battle: battleResult,
            battle_log_js: JSON.stringify(battleResult.log_js) // Pass battle log for frontend animations
        });
    } catch (error) {
        res.render("pokemonBattle", { error: "Invalid Pokémon names. Try again!" });
    }
});

function extractPokemonData(data) {
    return {
        name: data.name,
        hp: data.stats.find(s => s.stat.name === "hp").base_stat,
        attack: data.stats.find(s => s.stat.name === "attack").base_stat,
        special_attack: data.stats.find(s => s.stat.name === "special-attack").base_stat,
        defense: data.stats.find(s => s.stat.name === "defense").base_stat,
        special_defense: data.stats.find(s => s.stat.name === "special-defense").base_stat,
        speed: data.stats.find(s => s.stat.name === "speed").base_stat,
        types: data.types.map(t => t.type.name),
        moves: data.moves.length > 0 ? data.moves.map(m => m.move.name) : ["Tackle"], // Default move if none
        sprites: data.sprites.other.showdown.front_default
    };
}

async function simulateBattle(p1, p2) {
    let log = [], log_js = [];
    let turn = p1.speed >= p2.speed ? "p1" : "p2";
    let maxHp1 = p1.hp, maxHp2 = p2.hp;
    let level = 50;

    log.push(`${p1.name} vs ${p2.name} - Battle Start!`);
    // Fetch move details (power) for both Pokémon
    await fetchMoveDetails(p1);
    await fetchMoveDetails(p2);
    let i = 1;
    while (p1.hp > 0 && p2.hp > 0) {
 
        let attacker = turn === "p1" ? p1 : p2;
        let defender = turn === "p1" ? p2 : p1;

        // Select a random move that has a valid power
        let availableMoves = attacker.moves.filter(m => m.power > 0);
        let move = availableMoves.length > 0 ? availableMoves[Math.floor(Math.random() * availableMoves.length)] : { name: "Struggle", power: 40 };
        //Power
        let power = move.power;
        if (move.damage_class === "status") {
            move.damage_class = Math.random() < 0.5 ? "physical" : "special";
        }
        
        let A = move.damage_class === "special" ? attacker.special_attack : attacker.attack;
        let D = move.damage_class === "special" ? defender.special_defense : defender.defense;

        //STAB
        let STAB = 1;
        attacker.types.forEach(type =>{
            if(type === move.move_type){
                STAB = 1.5;
            }

        } )

        //Critical Hit
        let critical = Math.random() < 0.95 ? 1 : 2;
        //Type effectiveness
        let moveType = move.move_type;
        let defenderTypes = defender.types;
        //Work in progess
        let effectiveness = getTypeEffectiveness(moveType, defenderTypes);
       
                
        let d1 = ((2* critical * level)/5) +2 
        let d2 = ((d1 * power * A/D)/50) +2
        let d3 = d2 * STAB * effectiveness.type1 * effectiveness.type2





        let damage = Math.floor(d3);


        defender.hp -= damage;

        log.push(`${attacker.name} used ${move.name}! Deals ${damage.toFixed(1)} damage to ${defender.name}.`);

        log_js.push({
            turn_: i,
            text: `${attacker.name} used ${move.name}! Deals ${damage.toFixed(1)} damage.`,
            hp1: p1.hp > 0 ? p1.hp : 0,
            hp2: p2.hp > 0 ? p2.hp : 0,
            attacker: attacker.name,
            defender: defender.name,
            move: move.name,
            movePower: move.power,
            maxHp1,
            maxHp2
        });
        i = i+1;

        turn = turn === "p1" ? "p2" : "p1";
    }

    let winner = p1.hp > 0 ? p1.name : p2.name;
    log.push(`${winner} wins the battle!`);
    log_js.push({ text: `${winner} wins the battle!` });

    return { pokemon1: p1, pokemon2: p2, winner, log, log_js };
}


    //Type effectiveness

const typeChart = [{"name":"Normal","immunes":["Ghost"],"weaknesses":["Rock","Steel"],"strengths":[]},
{"name":"Fire","immunes":[],"weaknesses":["Fire","Water","Rock","Dragon"],"strengths":["Grass","Ice","Bug","Steel"]},
{"name":"Water","immunes":[],"weaknesses":["Water","Grass","Dragon"],"strengths":["Fire","Ground","Rock"]},
{"name":"Electric","immunes":["Ground"],"weaknesses":["Electric","Grass","Dragon"],"strengths":["Water","Flying"]},
{"name":"Grass","immunes":[],"weaknesses":["Fire","Grass","Poison","Flying","Bug","Dragon","Steel"],"strengths":["Water","Ground","Rock"]},
{"name":"Ice","immunes":[],"weaknesses":["Fire","Water","Ice","Steel"],"strengths":["Grass","Ground","Flying","Dragon"]},
{"name":"Fighting","immunes":["Ghost"],"weaknesses":["Poison","Flying","Psychic","Bug","Fairy"],"strengths":["Normal","Ice","Rock","Dark","Steel"]},
{"name":"Poison","immunes":["Steel"],"weaknesses":["Poison","Ground","Rock","Ghost"],"strengths":["Grass","Fairy"]},
{"name":"Ground","immunes":["Flying"],"weaknesses":["Grass","Bug"],"strengths":["Fire","Electric","Poison","Rock","Steel"]},
{"name":"Flying","immunes":[],"weaknesses":["Electric","Rock","Steel"],"strengths":["Grass","Fighting","Bug"]},
{"name":"Psychic","immunes":["Dark"],"weaknesses":["Psychic","Steel"],"strengths":["Fighting","Poison"]},
{"name":"Bug","immunes":[],"weaknesses":["Fire","Fighting","Poison","Flying","Ghost","Steel","Fairy"],"strengths":["Grass","Psychic","Dark"]},
{"name":"Rock","immunes":[],"weaknesses":["Fighting","Ground","Steel"],"strengths":["Fire","Ice","Flying","Bug"]},
{"name":"Ghost","immunes":["Normal"],"weaknesses":["Dark"],"strengths":["Psychic","Ghost"]},
{"name":"Dragon","immunes":["Fairy"],"weaknesses":["Steel"],"strengths":["Dragon"]},
{"name":"Dark","immunes":[],"weaknesses":["Fighting","Dark","Fairy"],"strengths":["Psychic","Ghost"]},
{"name":"Steel","immunes":[],"weaknesses":["Fire","Water","Electric","Steel"],"strengths":["Ice","Rock","Fairy"]},
{"name":"Fairy","immunes":[],"weaknesses":["Fire","Poison","Steel"],"strengths":["Fighting","Dragon","Dark"]}]

    // Function to determine type effectiveness
function getTypeEffectiveness(moveType, defenderTypes) {
    let typeData = typeChart.find(t => t.name.toLowerCase() === moveType);
    if (!typeData) return { type1: 1, type2: 1 }; // Default if type not found

    let type1 = 1, type2 = 1;

    // Check immunity first
    if (typeData.immunes.includes(defenderTypes[0])) return { type1: 0, type2: 0 };
    if (defenderTypes[1] && typeData.immunes.includes(defenderTypes[1])) return { type1: 0, type2: 0 };

    // Check effectiveness against first type
    if (typeData.strengths.includes(defenderTypes[0])) {
        type1 = 2; // Super effective
    } else if (typeData.weaknesses.includes(defenderTypes[0])) {
        type1 = 0.5; // Not very effective
    }

    // Check effectiveness against second type (if exists)
    if (defenderTypes.length > 1) {
        if (typeData.strengths.includes(defenderTypes[1])) {
            type2 = 2;
        } else if (typeData.weaknesses.includes(defenderTypes[1])) {
            type2 = 0.5;
        }
    }

    return { type1, type2 };
}


async function fetchMoveDetails(pokemon) {
    try {
        // Shuffle the moves array and select 10 random moves
        let shuffledMoves = pokemon.moves.sort(() => 0.5 - Math.random()).slice(0, 4);
        let movePromises = shuffledMoves.map(async (moveName) => {
            try {
                let response = await axios.get(`https://pokeapi.co/api/v2/move/${moveName}`);
                return { name: moveName,damage_class: response.data.damage_class.name, move_type: response.data.type.name,  power: response.data.power || 40 };
            } catch (error) {
                console.error(`Error fetching move data for ${moveName}:`, error);
                return { name: moveName, power: 40 }; // Default power if API call fails
            }
        });

        // Resolve all move details in parallel
        pokemon.moves = await Promise.all(movePromises);
    } catch (error) {
        console.error("Error fetching move details:", error);
    }
}

app.get("/pokemonRPG", (req, res) => res.render("pokemonRPG", {isRPG:  true}));









// Handle 404 errors
app.use((req, res) => {
    res.status(404);
    res.render("404");
});

// Handle 500 errors
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500);
    res.render("500");
});

app.listen(port, () => console.log(`Express started on http://localhost:${port}`));
