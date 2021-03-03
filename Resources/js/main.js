document.addEventListener("DOMContentLoaded", () => {
    // alert("yo!");
    // localStorage.clear();

    for (let [key, value] of Object.entries(localStorage)) {
        // console.log(`${key}: ${value}`);
        if (value === "Planet") {
            document.getElementById(key.toLowerCase()).checked = true;
            numSelectedSystems++
        }
    }

    updateNumberOfSelectedSystems();

    SetupBuildQueue();
})

const planetnames = ["Coruscant", "Rebel Base", "Alderaan", "Bespin", "Bothawui", "Cato Neimoidia",
    "Felucia", "Geonosis", "Kashyyyk", "Kessel", "Malastare", "Mandalore",
    "Mon Calamari", "Mustafar", "Mygeeto", "Naboo", "Nal Hutta", "Ord Mantell",
    "Rodia", "Ryloth", "Saleucami", "Sullust", "Toydaria", "Utapau"];

function SetupBuildQueue() {
    for (let index = 0; index < planetnames.length; index++) {
        let planetname = planetnames[index];

        cloneNodeAndChangeId('buildtemplate', planetname);
        changePlanetDisplayName(planetname);
        changeRadioGroupName(planetname);
    }

    moveBuildButton();

    setDefaultBuildOptions('Coruscant', 'radioempire');
    setDefaultBuildOptions('Rebel Base', 'radiorebel');

    hideBuildTemplate();
}

function hideBuildTemplate() {
    document.getElementById('buildtemplate').classList.add('d-none');
}

function setDefaultBuildOptions(planetname, selection) {
    let elements = document.getElementById(planetname).querySelectorAll('form-check-input, [type=radio]');
    for (let index = 0; index < elements.length; index++) {
        if (elements[index].id === selection) { elements[index].checked = true; }
        elements[index].disabled = true;
    }
}

function moveBuildButton() {
    // Move build button to bottom of list
    document.getElementById('buildqueue').appendChild(document.getElementById('buildbutton'));
}

function cloneNodeAndChangeId(nodename, planetname) {
    let clonenode = document.getElementById(nodename).cloneNode(true);
    clonenode.id = planetname;
    document.getElementById('buildqueue').appendChild(clonenode);
}

function changePlanetDisplayName(planetname) {
    let elements = document.getElementById(planetname).getElementsByClassName('col-3');
    for (let index = 0; index < elements.length; index++) {
        elements[index].firstElementChild.innerText = planetname;
    }
}

function changeRadioGroupName(planetname) {
    let elements = document.getElementById(planetname).querySelectorAll('form-check-input, [type=radio]');
    for (let index = 0; index < elements.length; index++) {
        elements[index].name = planetname + "RadioOptions";
        if (elements[index].id === "radioneutral") { elements[index].checked = true };
    }
}

function createBuildQueue() {
    resetBuildQueue();

    for (let index = 0; index < planetnames.length; index++) {
        let planetname = planetnames[index];
        let controlname = "";

        let resources = getPlanetsBuildResources(planetname);

        let elements = document.getElementById(planetname).getElementsByClassName('form-check-input');
        for (let index = 0; index < elements.length; index++) {
            if (elements[index].checked === true) {
                switch (elements[index].id) {
                    case "radioempire":
                        controlname = "build-emp-";
                        break;
                    case "radiosubjugated":
                    case "radiorebelsubjugated":
                        controlname = "build-emp-";
                        if (resources.length === 2) { resources.pop() };
                        break;
                    case "radiorebel":
                        controlname = "build-rebel-";
                        break;
                    default:
                        break;
                }

                if (controlname != "") {
                    resources.forEach(resource => {
                        let resourceIcon = document.getElementById(controlname + resource[0] + "-" + resource[1] + "-" + resource[2]);
                        let count = parseInt(resourceIcon.innerText);
                        count++;
                        if (count > 0) {
                            resourceIcon.classList.remove('d-none');
                            resourceIcon.innerText = count;
                        }
                    });
                }
            };
        }
    }
}

function getPlanetsBuildResources(planetname, subjugated = false) {
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
            return [["space", "tri", 2], ["ground", "cir", 2]];
        case "Geonosis":
            return [["space", "tri", 2], ["ground", "squ", 2]];
        case "Kashyyyk":
            return [["ground", "tri", 1], ["ground", "squ", 1]];
        case "Mandalore":
        case "Naboo":
        case "Nal Hutta":
            return [["ground", "tri", 1], ["space", "tri", 1]];
        case "Mon Calamari":
            return [["space", "tri", 3], ["space", "squ", 3]];
        case "Mustafar":
            return [["space", "tri", 2], ["space", "cir", 2]];
        case "Mygeeto":
            return [["space", "tri", 2], ["ground", "squ", 2]];
        case "Ord Mantell":
            return [["ground", "cir", 2], ["space", "cir", 2]];
        case "Rebel Base":
            return [["space", "tri", 1], ["ground", "tri", 1]];
        case "Sullust":
            return [["ground", "tri", 2], ["ground", "squ", 2]];
        case "Toydaria":
            return [["space", "cir", 2]];
        case "Utapau":
            return [["space", "cir", 3], ["space", "squ", 3]];
        default:
            break;
    }
}

function resetBuildQueue() {
    document.querySelectorAll("[id^='build-'").forEach(
        element => {
            element.innerHTML = 0;
        }
    )
}

function resetGame() {
    // TODO Message: You sure?
    localStorage.clear();

    document.querySelectorAll("[id^='planet-']").forEach(
        planet => {
            document.getElementById(planet.id).checked = false;
        }
    )

    numSelectedSystems = 0;
    updateNumberOfSelectedSystems();
}

// TODO This needs to be renamed!!
function run() {
    // alert('Working?');

    var searchText = document.getElementById('searchbar');

    var collapseElementList = [].slice.call(document.querySelectorAll('.cardlist'))

    collapseElementList.forEach(row => {
        if (row.title.toUpperCase().includes(searchText.value.toUpperCase())) {
            row.classList.remove('d-none');
        } else {
            row.classList.add('d-none');
        }
    });
}

function chkClick(cb) {
    switch (cb.id) {
        case 'chkROTE-Units':
            showHideElement('ROTE-Setup');
            showHideElement('Base-Setup');
            break;
        case 'chkROTE-TacticCards':
            showHideElement('ROTE-Battles');
            showHideElement('Base-Battles');
            break;
        case 'chkvar-Movement':
            showHideElement('var-movement');
            showHideElement('Base-movement');
            break;
        case 'chkvar-Deployment':
            showHideElement('var-Empiredeploy');
            showHideElement('Base-Empiredeploy');
            break;
        case 'chkvar-UnPlayableMissions':
            showHideElement('var-Unplayablemissions');
            showHideElement('Base-Unplayablemissions');
            break;
        default:
            break;
    }
}

function showHideElement(id) {
    // var element = document.getElementById(id);
    document.querySelectorAll('#' + id).forEach(
        element => {
            if (element.classList.contains('d-none')) {
                element.classList.remove('d-none')
            } else {
                element.classList.add('d-none')
            }
        }
    )

}

// function run2(e){
//     if (e.keyCode == 13) {
//         run();
//     }
// }

// searchbutton.addEventListener('click', run);
// searchbar.addEventListener('keydown', run2);

document.getElementById('searchbar').addEventListener('input', (e) => {
    run();
})


let numSelectedSystems = 0;

document.querySelectorAll('.planetbtn').forEach(
    planetbutton => {
        planetbutton.addEventListener('click', (event) => {
            if (planetbutton.checked == true) {
                numSelectedSystems++
                localStorage.setItem(planetbutton.id, "Planet")
            } else {
                numSelectedSystems--
                localStorage.removeItem(planetbutton.id)
            }

            updateNumberOfSelectedSystems();

            if (numSelectedSystems == 7) {
                alert('The rebel base is on ' + GetRebelBaseName() + '!');
                // alert(GetRebelBaseName());
            }
        })
    }
)

function updateNumberOfSelectedSystems() {
    document.getElementById('numselectedsystems').innerText = numSelectedSystems;
}

function GetRebelBaseName() {
    let rebelbase;
    document.querySelectorAll('.planetbtn').forEach(
        planetbutton => {
            if (planetbutton.checked == false) {
                rebelbase = planetbutton.title;
            }
        }
    )
    return rebelbase;
}

var dice = {
    sides: 6,
    roll: function () {
        var randomNumber = Math.floor(Math.random() * this.sides) + 1;
        return randomNumber;
    }
}

//Prints dice roll to the page
function rollD6(number) {
    var placeholder = document.getElementById('d6');
    // placeholder.innerHTML = number;
    placeholder.src = "./Resources/images/D6_" + number + ".png";
    var d6Modal = new bootstrap.Modal(document.getElementById('d6modal'));
    d6Modal.toggle();
}

// Captures all D6 button on website
document.querySelectorAll('#d6button').forEach(
    d6Button => {
        d6Button.onclick = function () {
            var result = dice.roll();
            rollD6(result);
        };
    });

//   var d6Button = document.getElementById('d6button');

//   d6Button.onclick = function() {
//     var result = dice.roll();
//     rollD6(result);
//   };

// document.getElementById('sidebarToggle').addEventListener('click', (e) => {
//     document.getElementById('sidebar').toggleClass('show');
// })

// $(document).ready(function (){
//     $('#sidebarToggle').on('click', function () {
//         $('#sidebar').toggleClass('show');
//     })
// });

// Example of getting all by toggle type
// var popoverTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="popover"]'))
// var popoverList = popoverTriggerList.map(function (popoverTriggerEl) {
//   return new bootstrap.Popover(popoverTriggerEl)
// })

var tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'))
var tooltipList = tooltipTriggerList.map(function (tooltipTriggerEl) {
    return new bootstrap.Tooltip(tooltipTriggerEl)
})