// Tabs and GIF-based voice state (using local mp.gif and sp.gif)
// Default to Chat tab (GPT-style text chat first)
let currentTab = 'chat';

// Speech recognition and synthesis
let recognition = null;
let synth = window.speechSynthesis;

// State management
let isListening = false;
let isSpeaking = false;
let isPaused = false;
// Start muted by default in Chat (user can unmute TTS)
let isMuted = true;
let ttsPrimed = false; // Track if TTS has been unlocked on mobile
let voiceSessionActive = false; // When true, mic click starts/stops a live back-and-forth session

// User authentication state
let currentUser = null;
let googleClientId = null; // Will be set from config

// Initialize UI
async function initUI() {
	// Preload GIFs to avoid flicker
	preloadVoiceGifs();

	// Tabs
	const tabVoice = document.getElementById('tab-voice');
	const tabChat = document.getElementById('tab-chat');
	const voicePane = document.getElementById('voice-pane');
	const chatPane = document.getElementById('chat-pane');
	
	tabVoice.addEventListener('click', () => switchTab('voice'));
	tabChat.addEventListener('click', () => switchTab('chat'));
	// New conversation
	const newBtn = document.getElementById('new-btn');
	if (newBtn) {
		newBtn.addEventListener('click', resetConversation);
	}
	
	function switchTab(tab) {
		currentTab = tab;
		if (tab === 'voice') {
			// ensure TTS is enabled on Voice tab
			isMuted = false;
			const muteBtnEl = document.getElementById('mute-btn');
			if (muteBtnEl) {
				muteBtnEl.classList.remove('active');
				muteBtnEl.title = 'Mute audio (TTS)';
			}
			tabVoice.classList.add('active');
			tabChat.classList.remove('active');
			voicePane.classList.add('active');
			chatPane.classList.remove('active');
		} else {
			tabChat.classList.add('active');
			tabVoice.classList.remove('active');
			chatPane.classList.add('active');
			voicePane.classList.remove('active');
		}
	}

	// Ensure initial state matches default tab
	switchTab(currentTab);
}

async function resetConversation() {
	// stop any ongoing speech
	if (synth) { try { synth.cancel(); } catch(e) {} }
	isSpeaking = false;
	isPaused = false;
	// clear chat UI
	const messagesContainer = document.getElementById('chat-messages');
	if (messagesContainer) messagesContainer.innerHTML = '';
	// reset server-side conversation
	try {
		await fetch('/api/reset', { method: 'POST' });
	} catch (e) {
		console.warn('Reset failed:', e);
	}
	// go back to Chat tab as default
	const tc = document.getElementById('tab-chat');
	if (tc) tc.click();
}

function preloadVoiceGifs() {
	const imgEl = document.getElementById('voice-gif');
	if (!imgEl) return;
	const mp = imgEl.getAttribute('data-mp');
	const sp = imgEl.getAttribute('data-sp');
	if (mp) {
		const i1 = new Image();
		i1.src = mp;
	}
	if (sp) {
		const i2 = new Image();
		i2.src = sp;
	}
	// Prevent drag/select artifacts
	imgEl.draggable = false;
}

// Update "animation" (now GIF) based on state
async function updateAnimation(state) {
	const img = document.getElementById('voice-gif');
	const vb = document.getElementById('voice-btn');
	if (!img) return;
	const mp = img.getAttribute('data-mp');
	const sp = img.getAttribute('data-sp');
	switch(state) {
		case 'listening':
			if (mp && img.src !== mp) img.src = mp;
			img.style.display = 'block';
			if (vb) vb.style.display = 'none';
			break;
		case 'speaking':
			if (sp && img.src !== sp) img.src = sp;
			img.style.display = 'block';
			if (vb) vb.style.display = 'none';
			break;
		default:
			img.style.display = 'none';
			if (vb) vb.style.display = 'inline-flex';
			break;
	}
}

// Initialize speech recognition
function initSpeechRecognition() {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        recognition = new SpeechRecognition();
        // We manage turn-taking manually to better control when we listen/speak
        recognition.continuous = false;
        recognition.interimResults = false;
        recognition.lang = 'en-US';
        
        recognition.onstart = () => {
            isListening = true;
            updateAnimation('listening');
			const vb = document.getElementById('voice-btn');
			if (vb) vb.classList.add('listening');
            
            // If user starts speaking while bot is speaking, interrupt the bot immediately
            if (isSpeaking && synth) {
                try {
                    synth.cancel();
                    isSpeaking = false;
                    isPaused = false;
                    console.log('Bot speech interrupted by user');
                } catch (e) {
                    console.warn('Error interrupting bot speech:', e);
                }
            }
        };
        
        recognition.onresult = (event) => {
            const transcript = event.results[0][0].transcript;
            
            // Stop any ongoing bot speech when user's speech is detected
            if (isSpeaking && synth) {
                try {
                    synth.cancel();
                    isSpeaking = false;
                    isPaused = false;
                    console.log('Bot speech interrupted by user input');
                } catch (e) {
                    console.warn('Error interrupting bot speech on result:', e);
                }
            }
            
            // Stop listening for this turn and send the message
            recognition.stop();
            sendMessage(transcript);
        };
        
        recognition.onerror = (event) => {
            console.error('Speech recognition error:', event.error);
            isListening = false;
			const vb = document.getElementById('voice-btn');
			if (vb) vb.classList.remove('listening');
            // In a live session, try to recover by going idle; user can speak again
            if (!voiceSessionActive) {
                updateAnimation('idle');
            }
        };
        
        recognition.onend = () => {
            isListening = false;
			const vb = document.getElementById('voice-btn');
			if (vb) vb.classList.remove('listening');

            // If a live voice session is active and the bot is not currently speaking,
            // DO NOT auto-restart here - let the TTS onend handler manage it
            // This prevents the loop where recognition restarts while bot is speaking
            if (!voiceSessionActive || !isSpeaking) {
                updateAnimation('idle');
            }
            // Note: Restarting listening is now handled in speakText's utterance.onend
            // to ensure it only happens after bot finishes speaking
        };
    } else {
        console.warn('Speech recognition not supported');
		const vb = document.getElementById('voice-btn');
		if (vb) vb.style.display = 'none';
    }
}

// Send message to API
async function sendMessage(message) {
    if (!message.trim()) return;

	// If currently speaking, cancel so the user can ask mid-answer
	if (synth) { try { synth.cancel(); } catch(e) {} }
	isSpeaking = false;
	isPaused = false;
    
	// Remove any existing loading messages first
	const existingLoading = document.querySelector('.message .loading');
	if (existingLoading) {
		const loadingMsg = existingLoading.closest('.message');
		if (loadingMsg) loadingMsg.remove();
	}
    
	// Always append user message to chat history immediately (even if on Voice tab)
	addMessage(message, 'user');
    
    // Clear input
	const inputEl = document.getElementById('text-input');
	if (inputEl) inputEl.value = '';
    
    // No separate loading bubble – just show user question and then assistant reply (ChatGPT-style)
	const loadingId = null;
    
    try {
        const response = await fetch('/api/chat', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ question: message })
        });
        
        const data = await response.json();
        
        if (data.success) {
			// Always append assistant message to chat
			addMessage(data.response, 'bot');
            speakText(data.response);
        } else {
			addMessage('Sorry, I encountered an error. Please try again.', 'bot');
        }
    } catch (error) {
        console.error('Error:', error);
		addMessage('Sorry, I encountered an error. Please try again.', 'bot');
    }
}

// Add message to chat
function addMessage(text, type, isLoading = false) {
    const messagesContainer = document.getElementById('chat-messages');
    const messageDiv = document.createElement('div');
    const messageId = 'msg-' + Date.now();
    messageDiv.id = messageId;
    messageDiv.className = `message ${type}-message`;
    
    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-content';
    if (isLoading) {
        contentDiv.innerHTML = `<span class="loading">${text}</span>`;
    } else {
        contentDiv.textContent = text;
    }
    
    messageDiv.appendChild(contentDiv);
    messagesContainer.appendChild(messageDiv);
    
    // Scroll to bottom
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
    
    return messageId;
}

// Remove message
function removeMessage(messageId) {
    const message = document.getElementById(messageId);
    if (message) {
        message.remove();
    }
}

// Prime TTS for mobile browsers (iOS/Android) - unlocks audio with user gesture
function primeTTS() {
    if (ttsPrimed || !synth) return;
    try {
        // Create a silent utterance to unlock audio on mobile browsers
        const u = new SpeechSynthesisUtterance(' ');
        u.volume = 0;
        u.rate = 0.1;
        synth.speak(u);
        synth.cancel(); // Cancel immediately after speaking
        ttsPrimed = true;
        console.log('TTS primed for mobile');
    } catch (e) {
        console.warn('TTS priming failed:', e);
    }
}

// Speak text using Web Speech API
function speakText(text) {
    if (!synth) return;
	if (isMuted) {
		updateAnimation('idle');
		return;
	}
    
    // Prime TTS if not already done (for mobile browsers)
    if (!ttsPrimed) {
        primeTTS();
    }
    
    // Stop any ongoing speech
    synth.cancel();
    
    // CRITICAL: Stop speech recognition when bot starts speaking to prevent feedback loop
    if (recognition && isListening) {
        try {
            recognition.stop();
            isListening = false;
        } catch (e) {
            console.warn('Error stopping recognition before speak:', e);
        }
    }

	// Clean markdown/symbols before speaking to avoid reading asterisks etc.
	const spokenText = sanitizeForSpeech(text);
    
    updateAnimation('speaking');
    isSpeaking = true;
	isPaused = false;
	// Show next control
	const nextBtn = document.getElementById('next-btn');
	if (nextBtn) { nextBtn.style.display = 'inline-flex'; }
    
    const utterance = new SpeechSynthesisUtterance(spokenText);
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    utterance.volume = 1.0;
    
    // Select a voice (prefer English voices on mobile)
    const voices = synth.getVoices();
    if (voices && voices.length > 0) {
        // Try to find an English voice, fallback to first available
        const englishVoice = voices.find(v => /en/i.test(v.lang)) || voices[0];
        utterance.voice = englishVoice;
    }
    
    utterance.onend = () => {
        isSpeaking = false;
		if (nextBtn) nextBtn.style.display = 'none';

        // In live session mode, go back to listening automatically
        // Use a longer delay to ensure bot's speech is fully finished and not picked up
        if (voiceSessionActive && recognition && !isListening) {
            try {
                setTimeout(() => {
                    // Double-check we're still in active session and not speaking before restarting
                    if (!isListening && voiceSessionActive && !isSpeaking) {
                        try { 
                            recognition.start(); 
                        } catch (e) { 
                            console.warn('re-start listen after speak failed:', e); 
                        }
                    }
                }, 1000); // Increased delay from 250ms to 1000ms to prevent feedback loop
            } catch (e) {
                console.warn('Error restarting recognition after speak:', e);
            }
        } else {
            updateAnimation('idle');
        }
    };
    
    utterance.onerror = () => {
        isSpeaking = false;
		if (nextBtn) nextBtn.style.display = 'none';
        if (voiceSessionActive && recognition && !isListening) {
            try {
                setTimeout(() => {
                    if (!isListening && voiceSessionActive) {
                        try { recognition.start(); } catch (e) { console.warn('re-start listen after error failed:', e); }
                    }
                }, 250);
            } catch (e) {
                console.warn('Error restarting recognition after error:', e);
            }
        } else {
            updateAnimation('idle');
        }
    };
    
    synth.speak(utterance);
}

// Remove basic markdown/markup so TTS doesn't speak symbols like * or `
function sanitizeForSpeech(input) {
	if (!input) return "";
	let t = String(input);
	// Convert markdown links [text](url) -> text
	t = t.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '$1');
	// Strip inline code/backticks
	t = t.replace(/`{1,3}([^`]+)`{1,3}/g, '$1');
	// Strip bold/italic asterisks or underscores ***text***, **text**, *text*, _text_
	t = t.replace(/\*{1,3}([^*]+)\*{1,3}/g, '$1').replace(/_{1,3}([^_]+)_{1,3}/g, '$1');
	// Remove remaining markdown bullets and headers at line starts
	t = t.replace(/^\s*[-*+#>]\s+/gm, '');
	// Collapse multiple spaces/newlines
	t = t.replace(/[ \t]{2,}/g, ' ').replace(/\n{2,}/g, '\n').trim();
	return t;
}
// Google OAuth2 Authentication
async function checkAuthStatus() {
    const welcomePage = document.getElementById('welcome-page');
    const mainApp = document.getElementById('main-app');
    
    try {
        const response = await fetch('/api/auth/user', {
            credentials: 'include'
        });
        const data = await response.json();
        if (data.success && data.user) {
            currentUser = data.user;
            // User is authenticated - show main app
            showMainApp(data.user);
        } else {
            // User not authenticated - show welcome page
            showWelcomePage();
        }
    } catch (e) {
        console.warn('Auth check failed:', e);
        showWelcomePage();
    }
}

function showWelcomePage() {
    const welcomePage = document.getElementById('welcome-page');
    const mainApp = document.getElementById('main-app');
    const body = document.body;
    
    if (welcomePage) welcomePage.style.display = 'block';
    if (mainApp) mainApp.style.display = 'none';
    if (body) body.classList.add('welcome-active');
    
    // Initialize Google Sign-In on welcome page
    initializeGoogleSignInWelcome();
}

function showMainApp(user) {
    const welcomePage = document.getElementById('welcome-page');
    const mainApp = document.getElementById('main-app');
    const body = document.body;
    
    if (welcomePage) welcomePage.style.display = 'none';
    if (mainApp) mainApp.style.display = 'block';
    if (body) body.classList.remove('welcome-active');
    
    // Update user info in header
    updateUserHeader(user);
}

function updateUserHeader(user) {
    const userName = document.getElementById('user-name');
    const userPicture = document.getElementById('user-picture');
    
    if (userName) userName.textContent = user.name;
    if (userPicture) {
        userPicture.src = user.picture || '';
        userPicture.alt = user.name;
    }
}

async function initializeGoogleSignInWelcome() {
    // Get Google Client ID from backend
    if (!googleClientId) {
        try {
            const response = await fetch('/api/auth/config');
            const data = await response.json();
            googleClientId = data.googleClientId;
        } catch (e) {
            console.warn('Failed to get Google Client ID:', e);
            return;
        }
    }
    
    const signInContainer = document.getElementById('google-signin-welcome');
    if (!signInContainer) return;
    
    // Clear any existing content
    signInContainer.innerHTML = '';
    
    if (typeof google !== 'undefined' && google.accounts && googleClientId) {
        google.accounts.id.initialize({
            client_id: googleClientId,
            callback: handleGoogleSignIn
        });
        
        google.accounts.id.renderButton(
            signInContainer,
            { theme: 'outline', size: 'large', text: 'signin_with', width: '300' }
        );
    }
}

async function handleGoogleSignIn(response) {
    try {
        const authResponse = await fetch('/api/auth/google', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            credentials: 'include',
            body: JSON.stringify({ token: response.credential })
        });
        
        const data = await authResponse.json();
        if (data.success) {
            currentUser = data.user;
            showMainApp(data.user);
            console.log('User authenticated:', data.user);
        } else {
            alert('Authentication failed: ' + (data.error || 'Unknown error'));
        }
    } catch (e) {
        console.error('Auth error:', e);
        alert('Authentication failed. Please try again.');
    }
}

async function logout() {
    try {
        await fetch('/api/auth/logout', {
            method: 'POST',
            credentials: 'include'
        });
        currentUser = null;
        showWelcomePage();
    } catch (e) {
        console.error('Logout error:', e);
    }
}

// Event listeners
document.addEventListener('DOMContentLoaded', () => {
	// Initialize UI components (will only work when main app is visible)
	initUI();
    initSpeechRecognition();
	// Ensure the voice GIF is hidden until listening/speaking
	updateAnimation('idle');
	
	// Prime TTS on first user interaction (for mobile browsers)
	const primeOnInteraction = () => {
		primeTTS();
		document.removeEventListener('click', primeOnInteraction);
		document.removeEventListener('touchend', primeOnInteraction);
	};
	document.addEventListener('click', primeOnInteraction, { once: true });
	document.addEventListener('touchend', primeOnInteraction, { once: true });
	
	// Load voices when available (some browsers load voices asynchronously)
	if (synth.onvoiceschanged !== undefined) {
		synth.onvoiceschanged = () => {
			// Voices loaded, ready to use
			console.log('Voices loaded:', synth.getVoices().length);
		};
	}
    
	// Voice button: toggle live conversation session on/off (only if main app is visible)
	const voiceBtn = document.getElementById('voice-btn');
	if (voiceBtn) {
		voiceBtn.addEventListener('click', () => {
		// Prime TTS on mic click (ensures audio is unlocked on mobile)
		primeTTS();

		const vb = document.getElementById('voice-btn');

		// If a session is already active, stop everything
		if (voiceSessionActive) {
			voiceSessionActive = false;
			if (synth) {
				try { synth.cancel(); } catch (e) {}
			}
			if (recognition && isListening) {
				try { recognition.stop(); } catch (e) {}
			}
			isSpeaking = false;
			isPaused = false;
			updateAnimation('idle');
			if (vb) vb.classList.remove('listening');
			return;
		}

		// Start a new live back-and-forth session
		voiceSessionActive = true;

		// barge-in during speaking
		if (isSpeaking && synth) {
			try { synth.cancel(); } catch(e) {}
			isSpeaking = false;
			isPaused = false;
		}

		if (recognition && !isListening) {
			try {
				recognition.start();
			} catch (e) {
				console.warn('Failed to start recognition:', e);
				voiceSessionActive = false;
				updateAnimation('idle');
				if (vb) vb.classList.remove('listening');
			}
		}
		});
	}

	// Skip current speech and immediately listen
	const nextBtn = document.getElementById('next-btn');
	if (nextBtn) {
		nextBtn.addEventListener('click', () => {
			if (synth) { try { synth.cancel(); } catch(e) {} }
			isSpeaking = false;
			isPaused = false;
			updateAnimation('listening');
			if (recognition) {
				try { recognition.start(); } catch (e) { console.warn('Failed to start recognition from next-btn:', e); }
			}
		});
	}

	// Mute/Unmute TTS on Chat
	const muteBtn = document.getElementById('mute-btn');
	if (muteBtn) {
		muteBtn.addEventListener('click', () => {
			isMuted = !isMuted;
			if (isMuted && synth) { try { synth.cancel(); } catch(e) {} }
			muteBtn.classList.toggle('active', isMuted);
			muteBtn.title = isMuted ? 'Unmute audio (TTS)' : 'Mute audio (TTS)';
		});

		// Set initial visual state based on default mute setting
		muteBtn.classList.toggle('active', isMuted);
		muteBtn.title = isMuted ? 'Unmute audio (TTS)' : 'Mute audio (TTS)';
	}
    
    // Send button
    const sendBtn = document.getElementById('send-btn');
    if (sendBtn) {
        sendBtn.addEventListener('click', () => {
            primeTTS(); // Prime TTS before sending (for mobile)
            const input = document.getElementById('text-input');
            sendMessage(input.value);
        });
    }
    
    // Enter key in input
    const textInput = document.getElementById('text-input');
    if (textInput) {
        textInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                primeTTS(); // Prime TTS before sending (for mobile)
                sendMessage(e.target.value);
            }
        });
    }
    
    // Authentication
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', logout);
    }
    
    // Check auth status on page load - this will show welcome page or main app
    checkAuthStatus();
});

