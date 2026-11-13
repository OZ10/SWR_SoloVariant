let promptUserRebelsWithin5 = true;

document.addEventListener("DOMContentLoaded", () => {
    // TODO Refactor this
    for (let [key, value] of Object.entries(localStorage)) {
        switch (value) {
            case "Planet":
                document.getElementById(key.toLowerCase()).checked = true;
                numSelectedSystems++;
                break;
            default:
                break;
        }
    }

    loadVariantSettings();
    updateNumberOfSelectedSystems();
    setupBuildQueue();
    setupRoundMarkers();
});

const planetnames = [
    ["Coruscant", "Rebel Base"],
    ["Felucia", "Mon Calamari", "Saleucami"],
    ["Mygeeto", "Ord Mantell"],
    ["Kashyyyk", "Malastare", "Mandalore"],
    ["Alderaan", "Cato Neimoidia", "Corellia"],
    ["Bothawui", "Kessel", "Nal Hutta", "Toydaria"],
    ["Geonosis", "Rodia", "Ryloth"],
    ["Naboo", "Sullust", "Utapau"],
    ["Bespin", "Mustafar"],
];

// Build queue rows are clones of #buildtemplate, one per planet. Each row is identified
// by data-planet="<name>" and each input by data-choice="blockade|subjugate|radio...",
// so the page has no duplicate ids (several planet names also contain spaces).
function getPlanetRow(planetname) {
    return document.querySelector(
        `#buildqueue [data-planet="${CSS.escape(planetname)}"]`
    );
}

function setupBuildQueue() {
    planetnames.forEach((system) => {
        system.forEach((planet) => {
            cloneBuildTemplate(planet, system.indexOf(planet));
            changePlanetDisplayName(planet);
            setupPlanetInputs(planet);
        });
    });

    moveBuildButton();

    setDefaultBuildOptions("Coruscant", "radioempire");
    setDefaultBuildOptions("Rebel Base", "radiorebel");

    hideBuildTemplate();

    loadBuildQueueSettings();

    // Save choices as soon as they change, so a reload doesn't lose them
    document
        .getElementById("buildqueue")
        .addEventListener("change", saveBuildQueueSettings);
}

function setupRoundMarkers() {
    // Set Rebel Rep
    const rebelrep = document.getElementById(GetSettingValueByKey("rebelrep"));
    if (rebelrep) {
        document.getElementById("round_14").checked = false;
        rebelrep.checked = true;
    }

    // Set Round
    const savedRound = document.getElementById(GetSettingValueByKey("round"));
    if (savedRound) {
        for (
            let counter = 1;
            counter < parseInt(getRoundNumber(savedRound.id));
            counter++
        ) {
            const round = document.getElementById("round_" + counter);
            round.disabled = true;
            round.checked = false;
        }

        savedRound.disabled = true;
        savedRound.checked = true;

        updateRoundNumber(getRoundNumber(savedRound.id));
    }
}

const GetSettingsByValue = (val, includes = false) => {
    let settings = new Array();
    for (let [key, value] of Object.entries(localStorage)) {
        if (includes && value.includes(val)) {
            settings.push(key + "," + value);
        } else if (value == val) {
            settings.push(key + "," + value);
        }
    }
    return settings;
};

const GetSettingValueByKey = (keytofind) => {
    for (let [key, value] of Object.entries(localStorage)) {
        if (key == keytofind) {
            return value;
        }
    }

    return "";
};

const SaveSetting = (key, value) => {
    localStorage.setItem(key, value);
};

const RemoveSetting = (val) => {
    for (let [key, value] of Object.entries(localStorage)) {
        if (value === val) {
            localStorage.removeItem(key);
        }
    }
};

// Each saved choice is stored as key "<planet>,<choice>" with value "buildchk".
// Neutral is the default, so only blockade/subjugate/Empire/Rebel choices are stored.
// Disabled inputs (Coruscant and Rebel Base's fixed loyalty) are always set on load.
function saveBuildQueueSettings() {
    RemoveSetting("buildchk");

    planetnames.flat().forEach((planetname) => {
        getPlanetRow(planetname)
            .querySelectorAll(
                ".form-check-input:checked:not([data-choice=radioneutral]):not(:disabled)"
            )
            .forEach((input) => {
                SaveSetting(planetname + "," + input.dataset.choice, "buildchk");
            });
    });
}

function loadBuildQueueSettings() {
    GetSettingsByValue("buildchk").forEach((planet) => {
        const [planetName, choice] = planet.split(",");
        const row = getPlanetRow(planetName);
        const input = row && row.querySelector(`[data-choice="${CSS.escape(choice)}"]`);
        if (input) {
            input.checked = true;
        }
    });
}

function cloneBuildTemplate(planetname, rowCount) {
    const clonenode = document.getElementById("buildtemplate").cloneNode(true);
    clonenode.removeAttribute("id");
    clonenode.dataset.planet = planetname;

    if (rowCount == 0) {
        // add border to the top
        clonenode.classList.add("builditemstart");
    }

    document.getElementById("buildqueue").appendChild(clonenode);
}

function changePlanetDisplayName(planetname) {
    getPlanetRow(planetname).querySelector(".planetname").innerText = planetname;
}

// Gives each row its own radio group, defaults it to Neutral, and names every
// input for screen readers (e.g. "Naboo: Rebel-Loyal")
function setupPlanetInputs(planetname) {
    getPlanetRow(planetname)
        .querySelectorAll(".form-check-input")
        .forEach((input) => {
            input.setAttribute("aria-label", planetname + ": " + input.dataset.label);
            if (input.type === "radio") {
                input.name = planetname + "RadioOptions";
                input.checked = input.dataset.choice === "radioneutral";
            }
        });
}

function hideBuildTemplate() {
    document.getElementById("buildtemplate").classList.add("d-none");
}

function setDefaultBuildOptions(planetname, selection) {
    getPlanetRow(planetname)
        .querySelectorAll("[type=radio]")
        .forEach((radio) => {
            if (radio.dataset.choice === selection) {
                radio.checked = true;
            }
            radio.disabled = true;
        });
}

function moveBuildButton() {
    // Move build button to bottom of list
    document
        .getElementById("buildqueue")
        .appendChild(document.getElementById("buildbutton"));
}

function createBuildQueue() {
    resetBuildQueueCount();

    // The 'planetnames' array is arranged by groups of regions with a number of planets
    // in each region
    for (let regionCount = 0; regionCount < planetnames.length; regionCount++) {
        let region = planetnames[regionCount];

        for (let planetCount = 0; planetCount < region.length; planetCount++) {
            let planetname = region[planetCount];
            let resources = getPlanetsBuildResources(planetname);
            let isBlockaded = false;
            let isSubjugated = false;

            let checks = getPlanetRow(planetname).getElementsByClassName(
                "form-check-input"
            );
            for (let index = 0; index < checks.length; index++) {
                // if Blockaded checkbox is checked don't add any of this planet's resources
                if (checks[index].dataset.choice == "blockade" && checks[index].checked) {
                    isBlockaded = true;
                }

                if (checks[index].dataset.choice == "subjugate" && checks[index].checked) {
                    isSubjugated = true;
                }

                if (checks[index].checked == false) {
                    continue;
                }

                updateBuildQueueCount(
                    isBlockaded,
                    isSubjugated,
                    checks,
                    index,
                    resources
                );
            }
        }
    }
}

function updateBuildQueueCount(
    isBlockaded,
    isSubjugated,
    checks,
    index,
    resources
) {
    let controlname = getControlName(checks, index, resources, isSubjugated);

    if (controlname == "") {
        return;
    }

    if (isBlockaded) {
        return;
    }

    resources.forEach((resource) => {
        // e.g. "build-emp-space-tri-2"
        let resourceIcon = document.getElementById(
            controlname + resource[0] + "-" + resource[1] + "-" + resource[2]
        );
        let count = parseInt(resourceIcon.innerText);
        count++;
        if (count > 0) {
            resourceIcon.classList.remove("d-none");
            resourceIcon.innerHTML = "";

            const buildNumberDiv = document.createElement("div");
            buildNumberDiv.setAttribute(
                "class",
                "build__number build__number-" + resource[1]
            );
            buildNumberDiv.append(count);
            resourceIcon.append(buildNumberDiv);
            // resourceIcon.innerText = count; // TODO: Add inner div as wrapper for number to position number correctly
        }
    });
}

function getControlName(checks, index, resources, isSubjugated) {
    const selectedRadioButton = checks[index].dataset.choice;

    if (selectedRadioButton == "radioempire") {
        return "build-emp-";
    }

    // Subjugated systems always build for the Empire
    if (isSubjugated && selectedRadioButton.includes("radio")) {
        if (resources.length === 2) {
            resources.pop();
        }
        return "build-emp-";
    }

    if (selectedRadioButton == "radiorebel") {
        return "build-rebel-";
    }

    return "";
}

function getPlanetsBuildResources(planetname, subjugated = false) {
    // Each planet can have one or two resources that it produces
    // Resources are returned in arrays
    switch (planetname) {
        case "Alderaan":
        case "Coruscant":
        case "Felucia":
        case "Malastare":
        case "Kessel":
        case "Rodia":
        case "Ryloth":
            return [["ground", "tri", 1]];
        case "Bespin":
        case "Bothawui":
        case "Saleucami":
            return [["ground", "cir", 1]];
        case "Cato Neimoidia":
            return [
                ["space", "tri", 2],
                ["ground", "cir", 2],
            ];
        case "Geonosis":
            return [
                ["space", "tri", 2],
                ["ground", "squ", 2],
            ];
        case "Kashyyyk":
            return [
                ["ground", "tri", 1],
                ["ground", "tri", 1],
            ];
        case "Mandalore":
        case "Naboo":
        case "Nal Hutta":
            return [
                ["ground", "tri", 1],
                ["space", "tri", 1],
            ];
        case "Corellia":
        case "Mon Calamari":
            return [
                ["space", "tri", 3],
                ["space", "squ", 3],
            ];
        case "Mustafar":
            return [
                ["space", "tri", 2],
                ["space", "cir", 2],
            ];
        case "Mygeeto":
            return [
                ["space", "tri", 2],
                ["ground", "squ", 2],
            ];
        case "Ord Mantell":
            return [
                ["ground", "cir", 2],
                ["space", "cir", 2],
            ];
        case "Rebel Base":
            return [
                ["space", "tri", 1],
                ["ground", "tri", 1],
            ];
        case "Sullust":
            return [
                ["ground", "tri", 2],
                ["ground", "squ", 2],
            ];
        case "Toydaria":
            return [["space", "cir", 2]];
        case "Utapau":
            return [
                ["space", "cir", 3],
                ["space", "squ", 3],
            ];
        default:
            break;
    }
}

function resetBuildQueueCount() {
    document.querySelectorAll("[id^='build-']").forEach((element) => {
        element.innerHTML = 0;
        element.classList.add("d-none");
    });
}

function resetGame() {
    // Clear game progress (round, reputation, remote systems, build queue) but keep
    // the player's expansion/variant settings, which are stored under "chk..." keys.
    // The reload then rebuilds the page from the remaining settings.
    Object.keys(localStorage).forEach((key) => {
        if (!key.startsWith("chk")) {
            localStorage.removeItem(key);
        }
    });

    location.reload();
}

function searchCardList() {
    const searchText = document.getElementById("searchbar");

    const collapseElementList = [].slice.call(
        document.querySelectorAll(".cardlist")
    );

    collapseElementList.forEach((row) => {
        if (row.title.toUpperCase().includes(searchText.value.toUpperCase())) {
            row.classList.remove("d-none");
        } else {
            row.classList.add("d-none");
        }
    });
}

// Each settings switch swaps a block of rule text: [shown when ON, shown when OFF]
const variantSections = {
    "chkROTE-Units": ["ROTE-Setup", "Base-Setup"],
    "chkROTE-TacticCards": ["ROTE-Battles", "Base-Battles"],
    "chkvar-Movement": ["var-movement", "Base-movement"],
    "chkvar-Deployment": ["var-Empiredeploy", "Base-Empiredeploy"],
    "chkvar-UnPlayableMissions": ["var-Unplayablemissions", "Base-Unplayablemissions"],
    "chkvar-ActionCardExecution": ["var-ActionCardExecution", "Base-ActionCardExecution"],
};

function loadVariantSettings() {
    Object.keys(variantSections).forEach((id) => {
        const enabled = GetSettingValueByKey(id) === "true";
        document.getElementById(id).checked = enabled;
        setVariant(id, enabled);
    });
}

function chkClick(cb) {
    setVariant(cb.id, cb.checked);
    SaveSetting(cb.id, cb.checked);
}

// Shows the variant's rule text and hides the base text (or the reverse),
// based on the switch's actual state rather than flipping whatever is shown
function setVariant(variantName, enabled) {
    const sections = variantSections[variantName];
    if (!sections) return;

    setElementVisible(sections[0], enabled);
    setElementVisible(sections[1], !enabled);
}

function setElementVisible(className, visible) {
    // Some sections appear more than once on the page, so they're marked with a class
    document.querySelectorAll("." + className).forEach((element) => {
        element.classList.toggle("d-none", !visible);
    });
}

document.getElementById("searchbar").addEventListener("input", (e) => {
    searchCardList();
});

let numSelectedSystems = 0;

document.querySelectorAll(".planetbtn").forEach((planetbutton) => {
    planetbutton.addEventListener("click", (event) => {
        if (planetbutton.checked == true) {
            numSelectedSystems++;
            localStorage.setItem(planetbutton.id, "Planet");
        } else {
            numSelectedSystems--;
            localStorage.removeItem(planetbutton.id);
        }

        updateNumberOfSelectedSystems();

        if (numSelectedSystems == 7) {
            showMessage(
                "Rebel Base Located",
                "The Rebel Base is on " + GetRebelBaseName() + "!"
            );
        }
    });
});

function updateNumberOfSelectedSystems() {
    document.getElementById("numselectedsystems").innerText =
        numSelectedSystems;
}

function GetRebelBaseName() {
    let rebelbase;
    document.querySelectorAll(".planetbtn").forEach((planetbutton) => {
        if (planetbutton.checked == false) {
            rebelbase = planetbutton.title;
        }
    });
    return rebelbase;
}

// The time marker is the round checkbox that is both checked and disabled
function getTimeMarker() {
    return document.querySelector("input[id^='round_']:checked:disabled");
}

function changeRound() {
    const currentRound = getTimeMarker();
    if (!currentRound) return;

    const nextRoundNumber = getRoundNumber(currentRound.id) + 1;
    const nextRound = document.getElementById("round_" + nextRoundNumber);

    // End of the track: leave the time marker where it is
    if (!nextRound) return;

    // Time marker reaching the reputation marker ends the game; keep both markers visible
    if (nextRound.checked) {
        showMessage(
            "Rebels Win!",
            "The time marker has reached the reputation marker. The Rebellion has won the game."
        );
        return;
    }

    currentRound.checked = false;
    nextRound.checked = true;
    nextRound.disabled = true;

    updateRoundNumber(nextRoundNumber);
    SaveSetting("round", nextRound.id);

    checkIfRebelRepLessThan5(nextRoundNumber);
}

function updateRoundNumber(roundnumber) {
    document.getElementById("roundnumber").innerHTML = roundnumber;
}

function checkIfRebelRepLessThan5(currentRoundNumber) {
    if (getRebelRep() - currentRoundNumber <= 5) {
        if (promptUserRebelsWithin5) {
            showMessage(
                "Crossing The Finish Line",
                "Rebels are now within FIVE rounds of winning the game. The Empire's Movement & Deployment rules have changed"
            );
            promptUserRebelsWithin5 = false;
        }
    } else {
        promptUserRebelsWithin5 = true;
    }
}

function setRebelRep(id) {
    const selected = document.getElementById(id);

    // Clicking the current reputation marker would leave none selected; keep it
    if (!selected.checked) {
        selected.checked = true;
        return;
    }

    document.querySelectorAll("input[id^='round_']").forEach((round) => {
        if (round.checked && !round.disabled && round.id !== id) {
            round.checked = false;
        }
    });

    SaveSetting("rebelrep", id);

    const currentRound = getTimeMarker();
    if (currentRound) {
        checkIfRebelRepLessThan5(getRoundNumber(currentRound.id));
    }
}

function getRebelRep() {
    const rep = document.querySelector(
        "input[id^='round_']:checked:not(:disabled)"
    );
    return rep ? getRoundNumber(rep.id) : 0;
}

function getRoundNumber(roundID) {
    return parseInt(roundID.split("_")[1]);
}

var dice = {
    sides: 6,
    roll: function () {
        var randomNumber = Math.floor(Math.random() * this.sides) + 1;
        return randomNumber;
    },
};

// Returns the modal's existing Bootstrap instance, creating it only the first time.
// Creating a new instance on every use left extra event listeners behind.
function getModal(id) {
    const element = document.getElementById(id);
    return bootstrap.Modal.getInstance(element) || new bootstrap.Modal(element);
}

// Shows the app's message box (used instead of the browser's alert(), which looks
// out of place, especially when the app is installed and running full screen)
function showMessage(title, body) {
    document.getElementById("messageBoxTitle").textContent = title;
    document.getElementById("messageBoxBody").textContent = body;
    getModal("messageBox").show();
}

//Prints dice roll to the page
function rollD6(number) {
    document.getElementById("d6").src = "./resources/images/D6_" + number + ".png";
    getModal("d6modal").show();
}

// Captures all D6 button on website
document.querySelectorAll(".d6button").forEach((d6Button) => {
    d6Button.onclick = function (event) {
        // D6 links use href="#", which would otherwise scroll the page to the top
        event.preventDefault();
        var result = dice.roll();
        rollD6(result);
    };
});

var tooltipTriggerList = [].slice.call(
    document.querySelectorAll('[data-bs-toggle="tooltip"]')
);
var tooltipList = tooltipTriggerList.map(function (tooltipTriggerEl) {
    return new bootstrap.Tooltip(tooltipTriggerEl);
});
