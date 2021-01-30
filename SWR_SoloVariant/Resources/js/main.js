
function run() {
    // alert('Working?');

    var searchText = document.getElementById('searchbar');

    var collapseElementList = [].slice.call(document.querySelectorAll('.cardlist'))

    collapseElementList.forEach(row => {
        if (row.title.toUpperCase().includes(searchText.value.toUpperCase())) {
            row.classList.remove('d-none');
            // var bsCol = new bootstrap.Collapse(row, {
            //     show: true})
        } else {
            row.classList.add('d-none');
            // row.collapse('show');
        }
    });

    // var col = document.getElementById('rownum3');
    // var bsCol = new bootstrap.Collapse(col, {
    //     hide: true
    // })
}

function run2(e){
    if (e.keyCode == 13) {
        run();
    }
}

// searchbutton.addEventListener('click', run);
// searchbar.addEventListener('keydown', run2);

document.getElementById('searchbar').addEventListener('input', (e) => {
    run();
})

// run();

// alert ('yo!');