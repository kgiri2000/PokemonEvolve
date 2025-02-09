function animateBattle() {
    let index = 0;

    function nextMove() {
        if (index < logs.length) {
            let log = logs[index];
            let logContainer = document.getElementById("battle-log");
            
            // Append log text
            logContainer.innerHTML += `<li>${log.text}</li>`;

            // Attack animation
            let attackerElement = log.attacker === logs[0].attacker ? document.getElementById("pokemon1") : document.getElementById("pokemon2");
            let defenderElement = log.defender === logs[0].attacker ? document.getElementById("pokemon1") : document.getElementById("pokemon2");

            attackerElement.classList.add("attack-animation");

            setTimeout(() => {
                attackerElement.classList.remove("attack-animation");
                defenderElement.classList.add("damage-animation");

                if (log.hp1 !== undefined) {
                    document.getElementById("hp1").innerText = log.hp1;
                    document.getElementById("hp-bar1").style.width = (log.hp1 / log.maxHp1 * 100) + "%";
                }
                if (log.hp2 !== undefined) {
                    document.getElementById("hp2").innerText = log.hp2;
                    document.getElementById("hp-bar2").style.width = (log.hp2 / log.maxHp2 * 100) + "%";
                }

                setTimeout(() => {
                    defenderElement.classList.remove("damage-animation");
                    index++;
                    setTimeout(nextMove, 1000);
                }, 500);
            }, 500);
        }
    }

    nextMove();
}

window.onload = animateBattle;
