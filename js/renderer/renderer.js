//Add a eventlistener to all checkboxes to change the line class
function addInputChangeStyleEvent(){
    document.querySelectorAll('input.switch[type="checkbox"]').forEach(item => {
        item.addEventListener('change', (e) => {
            const row = e.target.closest('tr');
            const name = row.getElementsByClassName('name')[0].innerHTML;
            window.versions.changeRecordingStatus(name, e.target.checked)
                .then((resolve) => {
                    if (e.target.checked) {
                        row.classList.add('recording');
                    } else {
                        row.classList.remove('recording');
                    }
                    /** @todo notification panel appears to notify the user */
                    if(resolve) 
                    {
                        console.log(resolve);
                    } 
                })
                .catch(err => {
                    console.error(err);
                });
        })
    })
}

//test info exchange between main and renderer process
const func = async () => {
    const response = await window.versions.ping()
    console.log(response) // prints out 'pong'
}

//change the check box status according the tr class
function updateCheckboxStatus(){
    document.querySelectorAll('tr').forEach(item => {
        let input = item.querySelector('input.switch[type="checkbox"]');
        if(input == null) return;

        if(item.classList.contains('recording')) {
            input.checked = true;
        }
        else {
            input.checked = false;
        }
    })
}

async function fillRecordingArray() {
    const ask = await window.versions.fillRecordingArray();
    console.log(ask[0]);
    ask.forEach(row => {
        insertNewRow(row);
    });
}

function insertNewRow(row) {
    const table = document.querySelector('section#recordingArray table');

    //Add new row
    let newRow = table.insertRow();

    if(row.Record){newRow.classList.add('recording')};
    
    //Insert the name of each row
    let name = newRow.insertCell(0);
    name.classList.add('name');
    name.innerHTML = row.Name;

    //Insert the url of each row
    let url = newRow.insertCell(1);
    url.classList.add('url');
    url.innerHTML = row.Url;
    
    //Insert the autoRecording status of each row
    let autoRecording = newRow.insertCell(2);
    autoRecording.classList.add('recordingButtons');
    const newInput = document.createElement('input');
    newInput.classList.add('switch')
    newInput.type = 'checkbox';
    newInput.checked = row.Online;
    autoRecording.appendChild(newInput);

    //Insert the delete button
    let action = newRow.insertCell(3);
    action.classList.add('actions');
    const newButton = document.createElement('button');
    newButton.innerHTML = 'Delete';
    newButton.classList.add('delete')
    action.appendChild(newButton);

}

//Apply all functions needed to create the window
func();
fillRecordingArray().then(() => {
    addInputChangeStyleEvent();
    updateCheckboxStatus();
});

