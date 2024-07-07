function fetchHistory() {
    const country = document.getElementById('countryInput').value;

    if (!country) {
        alert("Please enter a country name.");
        return;
    }

    fetch(`/get-history?country=${country}`, {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
        }
    })
    .then(response => {
        if (!response.ok) {
            throw new Error(`Network response was not ok: ${response.statusText}`);
        }
        return response.json();
    })
    .then(data => {
        if (data.error) {
            alert(data.error);
            return;
        }
        renderTimeline(data.events);
    })
    .catch(error => {
        console.error('Error fetching history:', error);
        alert(`Error fetching history: ${error.message}`);
    });
}


function renderTimeline(events) {
    const timeline = document.getElementById('timeline');
    timeline.innerHTML = '';

    events.forEach(event => {
        const eventElement = document.createElement('div');
        eventElement.className = 'timeline-event';
        eventElement.innerHTML = `<h4>${decodeHtmlEntities(event.year)}</h4><p>${decodeHtmlEntities(event.event)}</p>`;
        eventElement.onclick = () => showEventDetails(event);
        timeline.appendChild(eventElement);
    });
}

function showEventDetails(event) {
    document.getElementById('modalEventYear').innerText = decodeHtmlEntities(event.year);
    document.getElementById('modalEventDescription').innerText = decodeHtmlEntities(event.event);
    document.getElementById('modalEventDetail').innerText = ''; // Clear previous detail

    const viewDetailButton = document.getElementById('viewDetailButton');
    viewDetailButton.dataset.year = event.year;
    viewDetailButton.dataset.event = event.event;
    viewDetailButton.dataset.country = event.country; // Ensure the country is also included in the event data

    const modal = $('#eventModal');
    modal.addClass('slide-in-right');
    modal.modal('show');

    // Add event listener for the "View Detail" button
    viewDetailButton.onclick = () => fetchEventDetails(
        viewDetailButton.dataset.year,
        viewDetailButton.dataset.event,
        viewDetailButton.dataset.country
    );

    // Remove the class after the modal is hidden to ensure the animation is replayed the next time it is shown
    modal.on('hidden.bs.modal', function () {
        modal.removeClass('slide-in-right');
    });
}


function fetchEventDetails(year, event, country) {
    const detailPrompt = `Provide detailed information about the event: "${event}" which occurred in ${year} in ${country}.`;

    fetch('/get-event-detail', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ prompt: detailPrompt })
    })
    .then(response => {
        if (!response.ok) {
            throw new Error('Network response was not ok');
        }
        return response.json();
    })
    .then(data => {
        if (data.error) {
            alert(data.error);
            return;
        }
        document.getElementById('modalEventDetail').innerText = decodeHtmlEntities(data.detail);
    })
    .catch(error => console.error('Error fetching event detail:', error));
}


function decodeHtmlEntities(str) {
    const txt = document.createElement("textarea");
    txt.innerHTML = str;
    return txt.value;
}
