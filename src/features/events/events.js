// Utility to fetch and inject HTML components
async function loadComponent(path) {
    const response = await fetch(path);
    return await response.text();
}

async function renderComponent(componentPath, containerId = 'app') {
    const html = await loadComponent(componentPath);
    document.getElementById(containerId).innerHTML = html;
}

// const events = [ 
//     { id: 1, name: 'Hyrox Championship', description: 'Competitive fitness event.', startDateTime: '2025-06-20T10:00:00', endDateTime: '2025-06-20T18:00:00', location: 'London Arena', ticketTypes: ['Standard', 'VIP', 'Group'] }, 
//     { id: 2, name: 'Community Run', description: '5K run for all levels.', startDateTime: '2025-07-05T09:00:00', endDateTime: '2025-07-05T12:00:00', location: 'Hyde Park', ticketTypes: ['Standard', 'Charity'] }, 
//     { id: 3, name: 'Yoga Workshop', description: 'Relaxing yoga sessions.', startDateTime: '2025-07-15T18:30:00', endDateTime: null, location: 'Wellness Center', ticketTypes: ['Standard'] }, 
//     { id: 4, name: 'Community Picnic', description: 'Bring your own food!', startDateTime: '2025-08-01T13:00:00', endDateTime: null, location: 'Central Park', ticketTypes: null } 
// ];

import { events } from './eventsData.js'; // Adjust path as needed

let currentEvent = null;
let needs = {};      // {eventId: [{type, name}]}
let purchases = {};  // {eventId: [{type, buyer, requester}]}
let rsvps = {}; // { eventId: [name, name, ...] }
let showPastEvents = false; // Global state

async function showEventsList() {
    await renderComponent('../src/features/events/pages/EventsList.html');
    document.getElementById('togglePastEvents').onclick = function() {
        showPastEvents = !showPastEvents;
        this.textContent = showPastEvents ? "Show Upcoming Events" : "Show Past Events";
        renderEvents(document.getElementById('eventSearch').value);
    };
    document.getElementById('eventSearch').addEventListener('input', filterEvents);
    document.getElementById('addEventBtn').onclick = showAddEventPage;
    renderEvents(); // Initial render
}

function renderEvents(filter = "") {
    const list = document.getElementById('eventList');
    list.innerHTML = "";
    const now = new Date();

    // 1. Filter by search term
    let filtered = events.filter(ev => ev.name.toLowerCase().includes(filter.toLowerCase()));

    // 2. Filter by past/future
    filtered = filtered.filter(ev => {
        const evDate = new Date(ev.startDateTime);
        return showPastEvents ? evDate < now : evDate >= now;
    });

    // 3. Sort by date
    filtered.sort((a, b) => {
        const aDate = new Date(a.startDateTime);
        const bDate = new Date(b.startDateTime);
        return showPastEvents ? bDate - aDate : aDate - bDate;
    });

    // 4. Render events
    filtered.forEach(ev => {
        const li = document.createElement('li');
        li.style.cursor = "pointer";
        li.onclick = () => showEventDetails(ev.id);
        li.innerHTML = `
            <div>
                <div style="font-weight:600;">${ev.name}</div>
                <div style="font-size:0.97em; color:#bbb;">
                    ${formatEventDateTime(ev.startDateTime, ev.endDateTime)} &mdash; ${ev.location}
                </div>
                <div style="font-size:0.95em; color:#888; margin-top:2px;">${ev.description}</div>
            </div>
            <span class="event-chevron">&#8250;</span>
        `;
        list.appendChild(li);
    });

    // 5. Empty state
    if (filtered.length === 0) {
        list.innerHTML = `<li>No ${showPastEvents ? 'past' : 'upcoming'} events found.</li>`;
    }
}

function filterEvents() {
    const val = document.getElementById('eventSearch').value;
    renderEvents(val);
}

async function showEventDetails(eventId) {
    currentEvent = events.find(ev => ev.id === eventId);
    if (!currentEvent) return;
    await renderComponent('../src/features/events/pages/EventDetails.html');

    // Set event meta info
    document.getElementById('eventTitle').textContent = currentEvent.name;
    document.getElementById('eventDescription').textContent = currentEvent.description;
    document.getElementById('eventLocation').textContent = currentEvent.location || '';
    document.getElementById('eventDateTime').textContent = formatEventDateTime(currentEvent.startDateTime, currentEvent.endDateTime);

    document.getElementById('backToEventsBtn').onclick = showEventsList;

    if (!currentEvent.ticketTypes || currentEvent.ticketTypes.length === 0) {
        // RSVP only
        document.getElementById('rsvpSection').style.display = 'block';
        document.getElementById('ticketSection').style.display = 'none';

        document.getElementById('rsvpBtn').onclick = function() {
            const name = document.getElementById('rsvpName').value.trim();
            if (!name) {
                document.getElementById('rsvpStatus').textContent = "Please enter your name.";
                return;
            }
            if (!rsvps[currentEvent.id]) rsvps[currentEvent.id] = [];
            // Prevent duplicate RSVPs
            if (!rsvps[currentEvent.id].includes(name)) {
                rsvps[currentEvent.id].push(name);
            }
            document.getElementById('rsvpStatus').textContent = "Thank you for your RSVP!";
            document.getElementById('rsvpName').value = '';
            renderRsvps();
        };
        renderRsvps();
    } else {
        // Tickets required
        document.getElementById('rsvpSection').style.display = 'none';
        document.getElementById('ticketSection').style.display = 'block';
        document.getElementById('showNeedPageBtn').onclick = showNeedPage;
        document.getElementById('showPurchasePageBtn').onclick = showPurchasePage;
        renderNeeds();
        renderPurchases();
    }
    document.getElementById('editEventBtn').onclick = function() {
        showEditEventPage(currentEvent.id);
    };
}

function renderRsvps() {
    const list = document.getElementById('rsvpList');
    const arr = rsvps[currentEvent.id] || [];
    list.innerHTML = '';
    if (arr.length === 0) {
        list.innerHTML = '<li>No RSVPs yet.</li>';
        return;
    }
    arr.forEach(name => {
        const li = document.createElement('li');
        li.textContent = name;
        list.appendChild(li);
    });
}

async function showNeedPage() {
    await renderComponent('../src/features/events/pages/NeedTicket.html');
    // Fill ticket types
    const sel = document.getElementById('needTicketType');
    sel.innerHTML = '';
    currentEvent.ticketTypes.forEach(type => {
        const opt = document.createElement('option');
        opt.value = type;
        opt.textContent = type;
        sel.appendChild(opt);
    });
    document.getElementById('needRequester').value = '';
    document.getElementById('addNeedBtn').onclick = addNeed;
    document.getElementById('backToEventDetailsBtn1').onclick = showEventDetails.bind(null, currentEvent.id);
}

async function showAddEventPage() {
    await renderComponent('../src/features/events/pages/AddEvent.html');
    document.getElementById('backToEventsBtnAdd').onclick = showEventsList;
    initGooglePlacesAutocomplete();

    // Recurrence show/hide
    const recurringCheckbox = document.getElementById('eventRecurring');
    const recurrenceOptions = document.getElementById('recurrenceOptions');
    const recurFrequency = document.getElementById('recurFrequency');
    const recurrenceDaysSection = document.getElementById('recurrenceDaysSection');
    recurringCheckbox.onchange = () => {
        recurrenceOptions.style.display = recurringCheckbox.checked ? 'block' : 'none';
    };
    recurFrequency.onchange = () => {
        if (recurFrequency.value === 'weekly') {
            recurrenceDaysSection.style.display = 'block';
        } else {
            recurrenceDaysSection.style.display = 'none';
        }
    };
    // Set initial visibility
    recurrenceOptions.style.display = recurringCheckbox.checked ? 'block' : 'none';
    recurrenceDaysSection.style.display = recurFrequency.value === 'weekly' ? 'block' : 'none';

    // --- Add Event Submit Logic with endDateTime always present ---
    document.getElementById('addEventForm').onsubmit = function(e) {
        e.preventDefault();

        const name = document.getElementById('eventName').value.trim();
        const description = document.getElementById('eventDescription').value.trim();
        const startDate = document.getElementById('startDate').value;
        const endDate = document.getElementById('endDate').value;
        const startTime = document.getElementById('startTime').value;
        const endTime = document.getElementById('endTime').value;
        const location = document.getElementById('eventLocation').value.trim();
        const isRecurring = recurringCheckbox.checked;
        const frequency = recurFrequency.value;
        const endByDate = document.getElementById('endByDate').value;

        if (!name || !startDate) {
            alert('Please fill in all required fields.');
            return;
        }
        if (isRecurring && !endByDate) {
            alert('Please select an "Ends by" date for recurring events.');
            return;
        }

        // Helper to combine date and time
        const combineDateTime = (date, time) => time ? `${date}T${time}` : date;

        const eventsToAdd = [];

        if (isRecurring) {
            const start = new Date(startDate);
            const end = new Date(endByDate);

            if (frequency === 'weekly') {
                const dayCheckboxes = document.querySelectorAll('#weekDays input[type=checkbox]:checked');
                const selectedDays = Array.from(dayCheckboxes).map(cb => cb.value);
                if (selectedDays.length === 0) {
                    alert('Please select at least one day for weekly recurrence.');
                    return;
                }
                let currentDate = new Date(start);
                while (currentDate <= end) {
                    const currentDay = currentDate.toLocaleDateString('en-GB', { weekday: 'short' }).toUpperCase().slice(0, 2);
                    if (selectedDays.includes(currentDay)) {
                        eventsToAdd.push({
                            id: Date.now() + eventsToAdd.length,
                            name,
                            description,
                            startDateTime: combineDateTime(currentDate.toISOString().split('T')[0], startTime),
                            endDateTime: endDate ? combineDateTime(currentDate.toISOString().split('T')[0], endTime) : null,
                            location,
                            recurring: true,
                            recurrencePattern: {
                                frequency: 'weekly',
                                days: selectedDays,
                                endBy: endByDate
                            }
                        });
                    }
                    currentDate.setDate(currentDate.getDate() + 1);
                }
            } else if (frequency === 'monthly') {
                let currentDate = new Date(start);
                while (currentDate <= end) {
                    eventsToAdd.push({
                        id: Date.now() + eventsToAdd.length,
                        name,
                        description,
                        startDateTime: combineDateTime(currentDate.toISOString().split('T')[0], startTime),
                        endDateTime: endDate ? combineDateTime(currentDate.toISOString().split('T')[0], endTime) : null,
                        location,
                        recurring: true,
                        recurrencePattern: {
                            frequency: 'monthly',
                            endBy: endByDate
                        }
                    });
                    currentDate.setMonth(currentDate.getMonth() + 1);
                }
            }
        } else {
            // Single event
            eventsToAdd.push({
                id: Date.now(),
                name,
                description,
                startDateTime: combineDateTime(startDate, startTime),
                endDateTime: endDate ? combineDateTime(endDate, endTime) : null,
                location,
                recurring: false
            });
        }

        // Add to events array and refresh
        events.push(...eventsToAdd);
        showEventsList();
    };
}

function initGooglePlacesAutocomplete() {
    const input = document.getElementById('eventLocation');
    if (input && window.google && window.google.maps) {
        const autocomplete = new google.maps.places.Autocomplete(input, {
            types: ['geocode']
        });
        autocomplete.addListener('place_changed', function() {
            const place = autocomplete.getPlace();
            // You can access place details here if needed
        });
    }
}

function addNeed() {
    const type = document.getElementById('needTicketType').value;
    const name = document.getElementById('needRequester').value.trim();
    if (!name) {
        alert('Please enter your name.');
        return;
    }
    if (!needs[currentEvent.id]) needs[currentEvent.id] = [];
    needs[currentEvent.id].push({ type, name });
    showEventDetails(currentEvent.id);
}

function renderNeeds() {
    const list = document.getElementById('needList');
    list.innerHTML = '';
    const arr = needs[currentEvent.id] || [];
    if (arr.length === 0) {
        list.innerHTML = '<li>No ticket requests yet.</li>';
        return;
    }
    arr.forEach(item => {
        const li = document.createElement('li');
        li.textContent = `${item.name} needs a ${item.type} ticket`;
        list.appendChild(li);
    });
}

function renderPurchases() {
    const list = document.getElementById('purchasedList');
    list.innerHTML = '';
    const arr = purchases[currentEvent.id] || [];
    if (arr.length === 0) {
        list.innerHTML = '<li>No tickets purchased yet.</li>';
        return;
    }
    arr.forEach(item => {
        const li = document.createElement('li');
        li.textContent = `${item.buyer} purchased a ${item.type} ticket for ${item.requester}`;
        list.appendChild(li);
    });
}

async function showPurchasePage() {
    await renderComponent('../src/features/events/pages/PurchaseTickets.html');
    // Fill ticket types
    const sel = document.getElementById('purchaseTicketType');
    sel.innerHTML = '';
    currentEvent.ticketTypes.forEach(type => {
        const opt = document.createElement('option');
        opt.value = type;
        opt.textContent = type;
        sel.appendChild(opt);
    });
    document.getElementById('buyerName').value = '';
    document.getElementById('purchaseTicketType').onchange = updatePurchaseList;
    document.getElementById('backToEventDetailsBtn2').onclick = showEventDetails.bind(null, currentEvent.id);
    updatePurchaseList();
}

function updatePurchaseList() {
    const type = document.getElementById('purchaseTicketType').value;
    const arr = (needs[currentEvent.id] || []).filter(item => item.type === type);
    const ul = document.getElementById('availableRequests');
    ul.innerHTML = '';
    if (arr.length === 0) {
        ul.innerHTML = '<li>No requests for this ticket type.</li>';
        return;
    }
    arr.forEach((item, idx) => {
        const li = document.createElement('li');
        li.textContent = `${item.name} needs a ${item.type} ticket`;
        const btn = document.createElement('button');
        btn.className = 'submit-btn';
        btn.textContent = 'Purchase';
        btn.onclick = () => purchaseTicket(idx, type);
        li.appendChild(btn);
        ul.appendChild(li);
    });
}

function purchaseTicket(idx, type) {
    const buyer = document.getElementById('buyerName').value.trim();
    if (!buyer) {
        alert('Please enter your name.');
        return;
    }
    const arr = needs[currentEvent.id] || [];
    const filtered = arr.filter(item => item.type === type);
    const item = filtered[idx];
    if (!item) return;
    // Remove from needs
    needs[currentEvent.id] = arr.filter((n, i) => !(n.type === type && n.name === item.name && filtered.indexOf(n) === idx));
    // Add to purchases
    if (!purchases[currentEvent.id]) purchases[currentEvent.id] = [];
    purchases[currentEvent.id].push({ type, buyer, requester: item.name });
    updatePurchaseList();
    renderNeeds();
    renderPurchases();
}

function formatEventDateTime(start, end) {
    const startObj = new Date(start);
    const options = { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' };
    let result = startObj.toLocaleString('en-GB', options).replace(',', '');
    if (end) {
        const endObj = new Date(end);
        if (startObj.toDateString() === endObj.toDateString()) {
            result += ' – ' + endObj.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
        } else {
            result += ' – ' + endObj.toLocaleString('en-GB', options).replace(',', '');
        }
    }
    return result;
}

async function showEditEventPage(eventId) {
    const eventToEdit = events.find(ev => ev.id === eventId);
    if (!eventToEdit) return;
    await renderComponent('../src/features/events/pages/AddEvent.html');
    document.getElementById('backToEventsBtnAdd').onclick = showEventsList;

    // Pre-fill form fields
    document.getElementById('eventName').value = eventToEdit.name;
    document.getElementById('eventDescription').value = eventToEdit.description;
    document.getElementById('startDate').value = eventToEdit.startDateTime ? eventToEdit.startDateTime.slice(0,10) : '';
    document.getElementById('startTime').value = eventToEdit.startDateTime && eventToEdit.startDateTime.includes('T') ? eventToEdit.startDateTime.split('T')[1] : '';
    document.getElementById('endDate').value = eventToEdit.endDateTime ? eventToEdit.endDateTime.slice(0,10) : '';
    document.getElementById('endTime').value = eventToEdit.endDateTime && eventToEdit.endDateTime.includes('T') ? eventToEdit.endDateTime.split('T')[1] : '';
    document.getElementById('eventLocation').value = eventToEdit.location || '';

    // If you have recurrence, pre-fill those fields as well (optional)

    // Update submit button text
    document.querySelector('#addEventForm .submit-btn').textContent = "Save Changes";

    // Handle form submission for editing
    document.getElementById('addEventForm').onsubmit = function(e) {
        e.preventDefault();

        eventToEdit.name = document.getElementById('eventName').value.trim();
        eventToEdit.description = document.getElementById('eventDescription').value.trim();
        const startDate = document.getElementById('startDate').value;
        const startTime = document.getElementById('startTime').value;
        const endDate = document.getElementById('endDate').value;
        const endTime = document.getElementById('endTime').value;
        eventToEdit.startDateTime = startTime ? `${startDate}T${startTime}` : startDate;
        eventToEdit.endDateTime = endDate ? (endTime ? `${endDate}T${endTime}` : endDate) : null;
        eventToEdit.location = document.getElementById('eventLocation').value.trim();

        // If you have ticketTypes or recurrence, update those as well

        showEventDetails(eventToEdit.id);
    };
}


// Export for use in index.js
window.showEventsList = showEventsList;
window.showEventDetails = showEventDetails;
window.showAddEventPage = showAddEventPage;
window.showEditEventPage = showEditEventPage;