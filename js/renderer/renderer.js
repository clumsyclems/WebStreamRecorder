//Add a eventlistener to all checkboxes to change the line class
function addInputChangeStyleEvent(){
    document.querySelectorAll('input.switch[type="checkbox"]').forEach(item => {
        item.addEventListener('change', (e) => {
            if (e.target.checked) {
                e.target.closest('tr').classList.add('recording');
            } else {
                e.target.closest('tr').classList.remove('recording');
            }
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
    const table = document.querySelector('section#recordingArray table');
    const ask = await window.versions.fillRecordingArray();
    ask.forEach(row => {
        //Add new row
        let newRow = table.insertRow();

        /** @todo Change Online by record when the rest of the code is finish */
        if(row.Online){newRow.classList.add('recording')};
        
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

    });
}

//Apply all functions needed to create the window
func();
fillRecordingArray().then(() => {
    addInputChangeStyleEvent();
    updateCheckboxStatus();
});

