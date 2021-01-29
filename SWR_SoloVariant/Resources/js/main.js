const f = document.getElementById('searchbutton');

function run() {
    // alert('Working?');

    var searchText = document.getElementById('searchbar');

    var collapseElementList = [].slice.call(document.querySelectorAll('.colTest'))

    collapseElementList.forEach(row => {
        if (row.title.includes(searchText.value)) {
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

f.addEventListener('click', run);

// run();

// alert ('yo!');