function showSection(sectionId) {
    ['home', 'chat', 'contact', 'flashcard-container', 'login', 'register', 'collection-flashcards-container','learn-history'].forEach(id => {
        const section = document.getElementById(id);
        if (section) {
            section.classList.add('d-none');
        }
    });
    const activeSection = document.getElementById(sectionId);
    if (activeSection) {
        activeSection.classList.remove('d-none');
    }
}

var timeoutReference;

let lastCharacterInput = '';

async function sendMessage(characterType) {
    const activeTab = document.querySelector('.tab-pane.active');
    const input = activeTab.querySelector('input[type="text"]:not(#customCharacterInput)');
    const message = input.value.trim();
    if (message === '') return;

    let figure = activeTab.id.replace('list-', '');
    if (characterType === 'Any') {
        figure = document.getElementById('customCharacterInput').value.trim();
        if (figure === '') {
            alert('Please enter a character name.');
            return;
        }

        const response = await fetch('/ask', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: `question=${encodeURIComponent(message)}&figure=${encodeURIComponent(figure)}&email=${encodeURIComponent(sessionStorage.getItem('userEmail'))}&characterType=${encodeURIComponent(characterType)}`
        });

        const data = await response.json();
        if (data.error) {
            alert(data.error);
            return;
        }

        addMessage(message, 'user-message', activeTab.querySelector('.chat-messages'));
        addMessage(data.response, 'figure-message', activeTab.querySelector('.chat-messages'));

        // Generate character image using DALL-E if input has changed and validation passed
        if (figure !== lastCharacterInput) {
            lastCharacterInput = figure;
            try {
                const imageResponse = await fetch('/generate_character_image', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ character: figure })
                });
                const imageData = await imageResponse.json();
                if (imageData.error) {
                    alert(imageData.error);
                    return;
                }

                document.getElementById('currentGif').src = imageData.image_url;
            } catch (error) {
                console.error('Error generating image:', error);
                alert('Error generating image.');
                return;
            }
        }

        // Call getCharacterInfo only if character is valid
        getCharacterInfo(figure);
    } else {
        const gifPath = '/static/gif/' + figure + '.gif';
        const staticPath = '/static/art/' + figure + '.png';
        document.getElementById('currentGif').src = gifPath;
        clearTimeout(timeoutReference);
        timeoutReference = setTimeout(() => {
            document.getElementById('currentGif').src = staticPath;
        }, 7000);

        addMessage(message, 'user-message', activeTab.querySelector('.chat-messages'));

        fetch('/ask', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: `question=${encodeURIComponent(message)}&figure=${encodeURIComponent(figure)}&email=${encodeURIComponent(sessionStorage.getItem('userEmail'))}&characterType=${encodeURIComponent(characterType)}`
        })
        .then(response => response.json())
        .then(data => {
            if (data.error) {
                alert(data.error);
            } else {
                addMessage(data.response, 'figure-message', activeTab.querySelector('.chat-messages'));
                input.value = '';
            }
        });
    }
}

async function getCharacterInfo(characterName) {
    const response = await fetch('/get_character_info', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ character_name: characterName }),
    });

    if (response.ok) {
        const data = await response.json();
        console.log(data);

        const characterInfo = data.character_info;
        const relatedLinks = data.related_links;

        const infoHtml = `
            <h3>${characterInfo.displaytitle}</h3>
            <p><strong>Description:</strong> ${characterInfo.description}</p>
            <p><strong>Extract:</strong> ${characterInfo.extract}</p>
            <img src="${characterInfo.originalimage ? characterInfo.originalimage.source : ''}">
            <h3>Related Links:</h3>
        `;
        document.getElementById('characterInfo').innerHTML = infoHtml;
        document.getElementById('relatedLinks').innerHTML = relatedLinks.map(link => `<li><a href="${link}" target="_blank">${link}</a></li>`).join('');
    } else {
        document.getElementById('characterInfo').textContent = 'Loading...';
        document.getElementById('relatedLinks').innerHTML = '';
    }
}

function addMessage(text, className, chatContainer) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `chat-message ${className}`;
    messageDiv.textContent = text;
    chatContainer.appendChild(messageDiv);
    chatContainer.scrollTop = chatContainer.scrollHeight;
}

document.addEventListener('DOMContentLoaded', function() {
    var gifElement = document.getElementById('currentGif');
    var tabs = document.querySelectorAll('#list-tab a');

    tabs.forEach(function(tab) {
        tab.addEventListener('click', function(event) {
            var character = event.target.getAttribute('aria-controls');
            var staticPath = '/static/art/' + event.target.getAttribute('data-art');
            gifElement.src = staticPath;
            clearTimeout(timeoutReference);

            const email = sessionStorage.getItem('userEmail');
            if (email) {
                loadChatHistory(email, character);
            }

            if (character === 'list-any') {
                gifElement.src = '/static/art/default.png';
            }
        });
    });
});


document.addEventListener('DOMContentLoaded', function() {
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', function(e) {
            e.preventDefault();
            const loginData = {
                email: document.getElementById('loginEmail').value,
                password: document.getElementById('loginPassword').value
            };

            fetch('/perform_login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(loginData)
            })
            .then(response => response.json())
            .then(data => {
                if (data.error) {
                    alert('Login failed: ' + data.error);
                } else {
                    sessionStorage.setItem('userEmail', data.email);
                    alert('Logged in successfully!');
                    updateUserNavbar(data.email);
                    showSection('home');
                    document.getElementById('testimonialFormContainer').style.display = 'block';
                    loadTestimonials();
                    loadFlashcardCollections();
                }
            })
            .catch(error => {
                console.error('Login error:', error);
                alert('Login failed: Please try again.');
            });
        });
    }

    const registerForm = document.getElementById('registerForm');
    if (registerForm) {
        registerForm.addEventListener('submit', function(e) {
            e.preventDefault();
            const registerData = {
                email: document.getElementById('registerEmail').value,
                password: document.getElementById('registerPassword').value,
                confirm_password: document.getElementById('registerConfirmPassword').value
            };

            fetch('/perform_register', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(registerData)
            })
            .then(response => response.json())
            .then(data => {
                if (data.error) {
                    alert('Registration failed: ' + data.error);
                } else {
                    alert('Registered successfully!');
                    updateUserNavbar(data.email);
                    showSection('home');
                }
            })
            .catch(error => {
                console.error('Registration error:', error);
                alert('Registration failed: Please try again.');
            });
        });
    }

    const testimonialForm = document.getElementById('testimonialForm');
    if (testimonialForm) {
        testimonialForm.addEventListener('submit', function(e) {
            e.preventDefault();
            const testimonialData = {
                email: sessionStorage.getItem('userEmail'),
                message: document.getElementById('testimonialMessage').value
            };

            fetch('/submit_testimonial', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(testimonialData)
            })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    alert('Thank you for your testimonial!');
                    loadTestimonials();
                    testimonialForm.reset();
                } else {
                    alert('Failed to submit testimonial: ' + data.error);
                }
            })
            .catch(error => {
                console.error('Testimonial submission error:', error);
                alert('Failed to submit testimonial: Please try again.');
            });
        });
    }

    const createFlashcardForm = document.getElementById('createFlashcardForm');
    if (createFlashcardForm) {
        createFlashcardForm.addEventListener('submit', function(e) {
            e.preventDefault();
            const email = sessionStorage.getItem('userEmail');
            const question = document.getElementById('create-flashcard-question').value;
            const answer = document.getElementById('create-flashcard-answer').value;

            if (!email) {
                alert('You need to log in to create a flashcard.');
                return;
            }

            openSaveFlashcardModal('create', question, answer);
        });
    }

    if (sessionStorage.getItem('userEmail')) {
        document.getElementById('testimonialFormContainer').style.display = 'block';
        loadFlashcardCollections();
    }

    loadTestimonials();
});

function loadTestimonials() {
    fetch('/get_testimonials')
    .then(response => response.json())
    .then(data => {
        const testimonialsContainer = document.getElementById('testimonials');
        testimonialsContainer.innerHTML = '';
        data.testimonials.forEach(testimonial => {
            const testimonialCard = document.createElement('div');
            testimonialCard.className = 'col-md-4 testimonial-card';
            testimonialCard.innerHTML = `
                <p class="testimonial-message">"${testimonial.message}"</p>
                <p class="testimonial-email">- ${testimonial.email}</p>
            `;
            testimonialsContainer.appendChild(testimonialCard);
        });
    })
    .catch(error => {
        console.error('Failed to load testimonials:', error);
    });
}

function updateUserNavbar(email) {
    console.log("updateUserNavbar called with email:", email);
    const userEmailContainer = document.getElementById('userEmailContainer');
    const userEmail = document.getElementById('userEmail');
    const loginLink = document.getElementById('navLogin');
    const registerLink = document.getElementById('navRegister');

    if (email) {
        userEmail.textContent = email;
        userEmailContainer.style.display = 'block';
        loginLink.style.display = 'none';
        registerLink.textContent = 'Logout';
        registerLink.onclick = function() {
            logout();
        };
    } else {
        userEmailContainer.style.display = 'none';
        loginLink.style.display = 'block';
        loginLink.textContent = 'Login';
        loginLink.onclick = function() { showSection('login'); };
        registerLink.textContent = 'Register';
        registerLink.onclick = function() { showSection('register'); };
    }
}

function logout() {
    sessionStorage.removeItem('userEmail');
    updateUserNavbar(null);
    alert('You have been logged out.');
    window.location.href = '/';
}

function loadChatHistory(email, figure) {
    fetch('/get_chat_history', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({email: email, figure: figure})
    })
    .then(response => response.json())
    .then(data => {
        if (data.chat_history) {
            const chatContainer = document.querySelector(`#chatMessages${figure.charAt(0).toUpperCase() + figure.slice(1)}`);
            chatContainer.innerHTML = '';
            data.chat_history.forEach(item => {
                addMessage(item.user_message, 'user-message', chatContainer);
                addMessage(item.bot_response, 'figure-message', chatContainer);
            });
        }
    })
    .catch(error => console.error('Failed to load chat history:', error));
}

//Speech to text
document.addEventListener('DOMContentLoaded', function() {
    var tabs = document.querySelectorAll('#list-tab a');
    tabs.forEach(function(tab) {
        tab.addEventListener('click', function(event) {
            var figure = event.target.getAttribute('aria-controls').replace('list-', '');
            startSpeechToText(figure);
        });
    });
});
// Helper object to keep track of recognition states
window.recognitionState = {};

function startSpeechToText(figure) {
    if (!window.recognitionState[figure]) {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
            console.error("Speech recognition is not supported by your browser.");
            return;
        }

        const recognition = new SpeechRecognition();
        recognition.lang = 'en-US';
        recognition.continuous = false;
        recognition.interimResults = false;

        recognition.onresult = function(event) {
            const transcript = event.results[0][0].transcript;
            document.getElementById(`messageInput${figure.charAt(0).toUpperCase() + figure.slice(1)}`).value = transcript;
            sendMessage(); // This needs to handle the figure context properly
        };

        recognition.onend = function() {
            // Automatically reset the button when recognition stops
            toggleSpeechToText(figure, document.getElementById(`speakButton${figure}`), false);
        };

        window.recognitionState[figure] = recognition;
    }

    window.recognitionState[figure].start();
}

function stopSpeechRecognition(figure) {
    if (window.recognitionState[figure]) {
        window.recognitionState[figure].stop();
        window.recognitionState[figure] = null;
    }
}

function addSpeechButton(figure) {
    const inputGroup = document.querySelector(`#list-${figure.toLowerCase()} .input-group`);
    if (!inputGroup) {
        console.error(`Input group not found for figure: ${figure}`);
        return;
    }

    const speechBtn = document.createElement('button');
    speechBtn.id = `speakButton${figure}`;
    speechBtn.className = 'btn speak-btn';
    speechBtn.innerHTML = '<i class="fas fa-microphone"></i>';
    speechBtn.onclick = function() {
        toggleSpeechToText(figure, speechBtn);
    };

    inputGroup.appendChild(speechBtn);
}

function toggleSpeechToText(figure, button, forceStop = false) {
    if (window.recognitionState[figure] && !forceStop) {
        stopSpeechRecognition(figure);
        button.innerHTML = '<i class="fas fa-microphone"></i>';
        button.classList.remove('recording');
    } else {
        startSpeechToText(figure);
        button.innerHTML = '<i class="fas fa-microphone"></i>';
        button.classList.add('recording');
    }
}

document.addEventListener('DOMContentLoaded', function() {
    ['Columbus', 'Charles', 'Einstein', 'Quang', 'Emperor', 'Sun', 'Galileo', 'Napoleon'].forEach(figure => {
        addSpeechButton(figure);
    });
});

///////.........Flashcard
async function generateFlashcard() {
    const character = document.getElementById('character-select').value;
    const email = sessionStorage.getItem('userEmail');

    if (!email) {
        alert('You need to log in to generate a flashcard.');
        return;
    }

    const response = await fetch('/generate_flashcard', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ character: character, email: email })
    });

    if (!response.ok) {
        const errorData = await response.json();
        alert(`Error: ${errorData.error}`);
        return;
    }

    const data = await response.json();
    document.getElementById('flashcard-front').innerText = data.question;
    document.getElementById('flashcard-back').innerText = data.answer;
    document.getElementById('flashcard').style.display = 'block';
    document.getElementById('saveFlashcard').style.display = 'block';

    console.log('Generated Question:', data.question);
    console.log('Generated Answer:', data.answer);

    sessionStorage.setItem('generatedQuestion', data.question);
    sessionStorage.setItem('generatedAnswer', data.answer);
}

function flipFlashcard() {
    document.getElementById('flashcard').classList.toggle('flipped');
}

async function saveFlashcard() {
    const question = sessionStorage.getItem('generatedQuestion');
    const answer = sessionStorage.getItem('generatedAnswer');
    const email = sessionStorage.getItem('userEmail');

    if (!email) {
        alert('You need to log in to save a flashcard.');
        return;
    }

    console.log('Saving Flashcard');
    console.log('Email:', email);
    console.log('Question:', question);
    console.log('Answer:', answer);

    if (question && answer) {
        openSaveFlashcardModal('save', question, answer);
    } else {
        console.error('Error: Question or Answer is undefined.');
    }
}

document.addEventListener('DOMContentLoaded', function() {
    const collectionSelect = document.getElementById('collection-select');
    
    collectionSelect.addEventListener('focus', async function() {
        if (collectionSelect.children.length <= 1) { // Ensure it only loads once
            const email = sessionStorage.getItem('userEmail');
            const response = await fetch('/get_flashcards', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ email: email })
            });
            const data = await response.json();
            const collections = new Set();
            data.flashcards.forEach(flashcard => {
                collections.add(flashcard.collection);
            });

            collections.forEach(collection => {
                const option = document.createElement('option');
                option.value = collection;
                option.textContent = collection;
                collectionSelect.appendChild(option);
            });
        }
    });
});

async function openSaveFlashcardModal(action, question, answer) {
    await loadCollections(); // Ensure collections are loaded
    console.log('Before Setting Modal Values');
    console.log('Action:', action);
    console.log('Question:', question);
    console.log('Answer:', answer);

    document.getElementById('modal-action').value = action || '';
    document.getElementById('modal-question').value = question || '';
    document.getElementById('modal-answer').value = answer || '';
    document.getElementById('collection-select').value = ''; // Clear the selection
    document.getElementById('new-collection-name').value = ''; // Clear the new collection name input

    console.log('Modal Action:', document.getElementById('modal-action').value);
    console.log('Modal Question:', document.getElementById('modal-question').value);
    console.log('Modal Answer:', document.getElementById('modal-answer').value);

    $('#saveFlashcardModal').modal('show');
}

async function loadCollections() {
    const collectionSelect = document.getElementById('collection-select');
    const email = sessionStorage.getItem('userEmail');
    const response = await fetch('/get_flashcards', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email: email })
    });
    const data = await response.json();
    collectionSelect.innerHTML = '<option value="">-- Select a Collection --</option>'; // Reset options
    const collections = new Set();
    data.flashcards.forEach(flashcard => {
        collections.add(flashcard.collection);
    });

    collections.forEach(collection => {
        const option = document.createElement('option');
        option.value = collection;
        option.textContent = collection;
        collectionSelect.appendChild(option);
    });
}

document.getElementById('saveFlashcardForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    const email = sessionStorage.getItem('userEmail');
    const collection = document.getElementById('collection-select').value || document.getElementById('new-collection-name').value;
    const action = document.getElementById('modal-action').value;
    const question = document.getElementById('modal-question').value;
    const answer = document.getElementById('modal-answer').value;

    console.log('Form Submission');
    console.log('Email:', email);
    console.log('Collection:', collection);
    console.log('Action:', action);
    console.log('Question:', question);
    console.log('Answer:', answer);

    const flashcardData = {
        email: email,
        question: question,
        answer: answer,
        collection: collection
    };

    const endpoint = action === 'save' ? '/save_flashcard' : '/create_flashcard';

    const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(flashcardData)
    });
    const data = await response.json();
    if (data.success) {
        alert('Flashcard saved successfully!');
        $('#saveFlashcardModal').modal('hide');
        loadFlashcardCollections();
    } else {
        alert('Failed to save flashcard: ' + data.error);
    }
});

async function loadUserFlashcards() {
    const email = sessionStorage.getItem('userEmail');
    const response = await fetch('/get_flashcards', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email: email })
    });
    const data = await response.json();
    const flashcardsContainer = document.getElementById('flashcard-collections');
    flashcardsContainer.innerHTML = '';

    const collections = {};

    data.flashcards.forEach(flashcard => {
        if (!collections[flashcard.collection]) {
            collections[flashcard.collection] = [];
        }
        collections[flashcard.collection].push(flashcard);
    });

    for (const collection in collections) {
        const collectionDiv = document.createElement('div');
        collectionDiv.className = 'collection';
        const collectionTitle = document.createElement('h4');
        collectionTitle.textContent = collection;
        collectionTitle.className = 'collection-title';
        collectionTitle.onclick = () => showCollectionFlashcards(collection);

        collectionDiv.appendChild(collectionTitle);
        flashcardsContainer.appendChild(collectionDiv);
    }
}

function showCollectionFlashcards(collectionName) {
    const email = sessionStorage.getItem('userEmail');
    fetch('/get_flashcards', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email: email })
    })
    .then(response => response.json())
    .then(data => {
        const flashcards = data.flashcards.filter(flashcard => flashcard.collection === collectionName);
        const collectionFlashcardsContainer = document.getElementById('collection-flashcards-container');
        const collectionFlashcards = document.getElementById('collection-flashcards');
        const collectionTitle = document.getElementById('collection-title');

        collectionTitle.textContent = collectionName;
        collectionFlashcards.innerHTML = '';

        flashcards.forEach(flashcard => {
            const flashcardElem = document.createElement('div');
            flashcardElem.className = 'flashcard';
            flashcardElem.onclick = () => flashcardElem.classList.toggle('flipped');

            const innerDiv = document.createElement('div');
            innerDiv.className = 'flashcard-inner';

            const frontDiv = document.createElement('div');
            frontDiv.className = 'flashcard-front';
            frontDiv.innerText = flashcard.question;

            const backDiv = document.createElement('div');
            backDiv.className = 'flashcard-back';
            backDiv.innerText = flashcard.answer;

            innerDiv.appendChild(frontDiv);
            innerDiv.appendChild(backDiv);
            flashcardElem.appendChild(innerDiv);

            collectionFlashcards.appendChild(flashcardElem);
        });

        showSection('collection-flashcards-container');
    })
    .catch(error => console.error('Failed to load flashcards:', error));
}

function loadFlashcardCollections() {
    const email = sessionStorage.getItem('userEmail');
    fetch('/get_flashcards', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email: email })
    })
    .then(response => response.json())
    .then(data => {
        const flashcardsContainer = document.getElementById('flashcard-collections');
        flashcardsContainer.innerHTML = '';

        const collections = {};

        data.flashcards.forEach(flashcard => {
            if (!collections[flashcard.collection]) {
                collections[flashcard.collection] = [];
            }
            collections[flashcard.collection].push(flashcard);
        });

        for (const collection in collections) {
            const collectionDiv = document.createElement('div');
            collectionDiv.className = 'collection';
            const collectionTitle = document.createElement('h4');
            collectionTitle.textContent = collection;
            collectionTitle.className = 'collection-title';
            collectionTitle.onclick = () => showCollectionFlashcards(collection);

            collectionDiv.appendChild(collectionTitle);
            flashcardsContainer.appendChild(collectionDiv);
        }
    })
    .catch(error => console.error('Failed to load flashcards:', error));
}

document.addEventListener('DOMContentLoaded', function() {
    if (sessionStorage.getItem('userEmail')) {
        loadFlashcardCollections();
    }
});
