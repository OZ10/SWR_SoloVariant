
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

function chkClick(cb){
    switch (cb.id) {
        case 'ROTE-Deployment':
            showHideElement('ROTE-Setup');
            showHideElement('Base-Setup');
            break;
    
        default:
            break;
    }
}

function showHideElement(id) {
    var element = document.getElementById(id);
    if (element.classList.contains('d-none')) {
        element.classList.remove('d-none')
    }else{
        element.classList.add('d-none')
    }
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


var numSelectedSystems = 0;

document.querySelectorAll('.planetbtn').forEach(
    planetbutton => {
        planetbutton.addEventListener('click', (event) => {
            if (planetbutton.checked == true) {
                numSelectedSystems++
            }else{
                numSelectedSystems--
            }
            document.getElementById('numselectedsystems').innerText = numSelectedSystems;

            if (numSelectedSystems == 7) {
                alert('they be coming!');
            }
        })
    }
)

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