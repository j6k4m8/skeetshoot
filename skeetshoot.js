/**
 * This module is the main entrypoint for the Bluesky Strikes browser extension.
 */

// Add debugging flag - set to true to see logs
const DEBUG = true;

// Flag to prevent infinite loops
let isUpdating = false;
let lastUpdateTime = 0;
const UPDATE_THROTTLE = 1000; // Minimum ms between updates

function debugLog(...args) {
    if (DEBUG) {
        console.log('[Bluesky Strikes]', ...args);
    }
}

// Force log to check if the extension is loading at all
console.log('[Bluesky Strikes] Extension loaded!');

class BlueskyUserNotes {
    /**
     * A class to keep track of user notes and strikes.
     */

    constructor() {
        /**
         * Create a new instance of the BlueskyUserNotes class.
         */
        this.notes = {};
        this.loadFromBrowserStorage();
    }

    loadFromBrowserStorage() {
        /**
         * Load the user notes from browser storage.
         */
        browser.storage.local.get('userNotes').then(result => {
            if (result.userNotes) {
                this.notes = result.userNotes;
            } else {
                this.notes = {};
            }
        });
    }

    saveToBrowserStorage() {
        /**
         * Save the user notes to browser storage.
         */
        browser.storage.local.set({ userNotes: this.notes });
    }

    getNote(username) {
        /**
         * Get the note for a given username.
         *
         * @param {string} username The username to get the note for.
         * @return {object} The note and strikes for the given username.
         */
        return this.notes[username] || {
            note: "",
            strikes: 0
        };
    }

    setNote(username, note, strikes) {
        /**
         * Set the note for a given username.
         *
         * @param {string} username The username to set the note for.
         * @param {string} note The note to set.
         * @param {number} strikes The number of strikes to set.
         */
        this.notes[username] = {
            note: note,
            strikes: strikes
        };
        this.saveToBrowserStorage();
    }

    removeNote(username) {
        /**
         * Remove the note for a given username.
         *
         * @param {string} username The username to remove the note for.
         */
        delete this.notes[username];
        this.saveToBrowserStorage();
    }

    getStrikeCount(username) {
        /**
         * Get the number of strikes for a given username.
         *
         * @param {string} username The username to get the strike count for.
         * @return {number} The number of strikes for the given username.
         */
        return (this.notes[username] || {
            strikes: 0
        }).strikes;
    }

    incrementStrikeCount(username) {
        /**
         * Increment the strike count for a given username.
         *
         * @param {string} username The username to increment the strike count for.
         */
        const newCount = this.getStrikeCount(username) + 1;
        this.setNote(username, this.getNote(username).note, newCount);

        // If the user has three strikes, trigger unfollow
        if (newCount >= 3) {
            this.unfollowUser(username);
        }
    }

    decrementStrikeCount(username) {
        /**
         * Decrement the strike count for a given username.
         *
         * @param {string} username The username to decrement the strike count for.
         */
        this.setNote(username, this.getNote(username).note, Math.max(0, this.getStrikeCount(username) - 1));
    }

    unfollowUser(username) {
        /**
         * Trigger unfollow for a user with three strikes
         *
         * @param {string} username The username to unfollow
         */
        // Find the user's profile in the timeline
        const userElements = getBlueskyUserElements();
        const usernames = getBlueskyUsernames();

        for (let i = 0; i < usernames.length; i++) {
            if (usernames[i] === username) {
                const userElement = userElements[i];
                // Find the profile page link to navigate to the profile
                const profileLink = findProfileLinkForUser(userElement);
                if (profileLink) {
                    // Click to open profile and then trigger unfollow
                    profileLink.click();
                    // Set a timeout to allow the profile page to load
                    setTimeout(() => {
                        clickUnfollowButton();
                    }, 1000);
                }
                break;
            }
        }
    }
}

// Initialize the notes object
const notes = new BlueskyUserNotes();

/**
 * Get Bluesky user elements that represent posts in the timeline
 */
function getBlueskyUserElements() {
    // Try multiple selectors to find posts
    let posts = [];

    // Try the most specific selector first
    posts = Array.from(document.querySelectorAll('div[role="link"][data-testid^="feedItem-"]'));
    debugLog('Selector 1 found', posts.length, 'posts');

    // If we don't find any, try other approaches
    if (posts.length === 0) {
        posts = Array.from(document.querySelectorAll('div[data-testid="postThreadItem"]'));
        debugLog('Selector 2 found', posts.length, 'posts');
    }

    // Try looking for feed items in another way
    if (posts.length === 0) {
        posts = Array.from(document.querySelectorAll('article'));
        debugLog('Selector 3 found', posts.length, 'posts');
    }

    // As a last resort, look for profile links
    if (posts.length === 0) {
        posts = Array.from(document.querySelectorAll('a[href^="/profile/"]')).map(link => {
            // Go up several levels to find the post container
            let el = link;
            for (let i = 0; i < 6; i++) {
                el = el.parentElement;
                if (!el) break;
                if (el.tagName === 'ARTICLE' ||
                    (el.getAttribute && el.getAttribute('role') === 'link')) {
                    return el;
                }
            }
            return link.closest('div[role="link"]') || link.closest('article');
        }).filter(Boolean);

        // Remove duplicates
        posts = [...new Set(posts)];
        debugLog('Selector 4 found', posts.length, 'posts');
    }

    // Log HTML of first post for debugging
    if (posts.length > 0) {
        debugLog('First post HTML:', posts[0].outerHTML.substring(0, 500) + '...');
    } else {
        debugLog('No posts found with any selector');
        // Dump all profile links to debug
        const links = Array.from(document.querySelectorAll('a[href^="/profile/"]'));
        debugLog('Found', links.length, 'profile links');
        if (links.length > 0) {
            debugLog('First profile link:', links[0].outerHTML);
            debugLog('Parent structure:', getParentChain(links[0]));
        }
    }

    return posts;
}

// Helper to debug parent structure
function getParentChain(element, depth = 5) {
    let result = '';
    let current = element;
    for (let i = 0; i < depth; i++) {
        if (!current) break;
        const tag = current.tagName;
        const id = current.id ? `#${current.id}` : '';
        const cls = current.className ? `.${Array.from(current.classList).join('.')}` : '';
        const role = current.getAttribute('role') ? `[role="${current.getAttribute('role')}"]` : '';
        result += `\n${i}: ${tag}${id}${cls}${role}`;
        current = current.parentElement;
    }
    return result;
}

/**
 * Extract usernames from Bluesky posts
 *
 * @return {Array} Array of usernames corresponding to the posts
 */
function getBlueskyUsernames() {
    const postElements = getBlueskyUserElements();
    return postElements.map(post => {
        let username = null;

        // Try multiple methods to extract the username

        // Method 1: Look for spans containing @ handles
        const handleElements = post.querySelectorAll('a[href^="/profile/"] span');
        for (const el of handleElements) {
            const text = el.textContent || '';
            if (text.trim().startsWith('@')) {
                username = text.trim().substring(1);
                break;
            }
        }

        // Method 2: Extract from the profile link URL if method 1 failed
        if (!username) {
            const profileLink = post.querySelector('a[href^="/profile/"]');
            if (profileLink) {
                const href = profileLink.getAttribute('href');
                if (href) {
                    const match = href.match(/\/profile\/([^/]+)/);
                    if (match && match[1]) {
                        username = match[1];
                    }
                }
            }
        }

        if (username) {
            debugLog('Found username:', username);
        }

        return username;
    }).filter(username => username !== null);
}

/**
 * Find the profile link for a user element
 *
 * @param {Element} userElement The post element from which to find the profile link
 * @return {Element|null} The profile link element if found, otherwise null
 */
function findProfileLinkForUser(userElement) {
    // Find the first profile link in the post
    return userElement.querySelector('a[href^="/profile/"]');
}

/**
 * Click the unfollow button on a user's profile page
 */
function clickUnfollowButton() {
    // First look for the "Following" button which indicates we're following this user
    const followingButton = document.querySelector('button[aria-label="Following"]');
    if (followingButton) {
        followingButton.click();

        // After clicking "Following", a confirmation dialog should appear
        // Wait a moment and then click the confirm button
        setTimeout(() => {
            const confirmButton = document.querySelector('button[aria-label="Unfollow"]');
            if (confirmButton) {
                confirmButton.click();
            }
        }, 500);
    }
}

/**
 * Increment the strike count for a given username
 *
 * @param {string} username The username to increment strikes for
 */
function incrementStrikeCount(username) {
    debugLog('Incrementing strike count for', username);
    notes.incrementStrikeCount(username);
    populateUI();
}

/**
 * Decrement the strike count for a given username
 *
 * @param {string} username The username to decrement strikes for
 */
function decrementStrikeCount(username) {
    debugLog('Decrementing strike count for', username);
    notes.decrementStrikeCount(username);
    populateUI();
}

/**
 * Update the UI to show strikes for users in the timeline
 */
function populateUI() {
    // Prevent infinite loops with a guard
    const now = Date.now();
    if (isUpdating || (now - lastUpdateTime < UPDATE_THROTTLE)) {
        return;
    }

    // Don't update if we're currently typing in a textarea
    if (document.activeElement && document.activeElement.tagName === 'TEXTAREA' &&
        document.activeElement.closest('.user-notepad')) {
        debugLog('Skipping update while typing in notes');
        return;
    }

    isUpdating = true;
    lastUpdateTime = now;

    try {
        debugLog('Updating UI');

        // Add styles to the page if not already added
        if (!document.getElementById('skeetshoot-styles')) {
            let style = document.createElement('style');
            style.id = 'skeetshoot-styles';
            style.innerHTML = `
            .skeetshoot-strike-ui {
                position: absolute;
                top: 8px;
                right: 8px;
                z-index: 99999;
                background-color: rgba(255, 255, 255, 0.9);
                border-radius: 8px;
                padding: 6px;
                opacity: 0.15;
                transition: opacity 0.2s, transform 0.2s;
                pointer-events: auto !important;
                transform: scale(0.9);
                box-shadow: 0 2px 8px rgba(0,0,0,0.2);
            }
            .skeetshoot-strike-ui:hover {
                opacity: 1;
                transform: scale(1);
            }
            .skeetshoot-strike-ui.expanded {
                opacity: 1;
                transform: scale(1);
            }
            .strike-count {
                text-align: center;
                font-size: 1.2em;
                margin-top: 4px;
            }
            .strike-controls {
                display: flex;
                justify-content: space-between;
                margin-top: 4px;
                padding: 4px;
                gap: 8px;
                pointer-events: auto !important;
            }
            .strike-button {
                cursor: pointer !important;
                border: none !important;
                border-radius: 50% !important;
                width: 24px !important;
                height: 24px !important;
                display: flex !important;
                align-items: center !important;
                justify-content: center !important;
                opacity: 0.7 !important;
                transition: opacity 0.1s ease-in-out !important;
                pointer-events: auto !important;
            }
            .strike-button:hover {
                opacity: 1 !important;
                transform: scale(1.1) !important;
            }
            .strike-button.add {
                background-color: #9b4958 !important;
                color: white !important;
            }
            .strike-button.remove {
                background-color: #579b49 !important;
                color: white !important;
            }
            .strike-marker {
                text-align: center !important;
                font-size: 1.2em !important;
                margin-bottom: 2px !important;
            }
            .user-notepad {
                margin-top: 8px;
                width: 100%;
                display: none;
            }
            .user-notepad textarea {
                width: 100%;
                min-width: 150px;
                height: 60px;
                border: 1px solid #ccc;
                border-radius: 4px;
                padding: 4px;
                font-size: 12px;
                resize: vertical;
            }
            .note-toggle {
                background: none;
                border: none;
                color: #666;
                font-size: 12px;
                cursor: pointer;
                padding: 2px 4px;
                margin-top: 4px;
                text-decoration: underline;
                width: 100%;
                text-align: center;
            }
            .note-toggle:hover {
                color: #000;
            }
            .note-save {
                background-color: #4a9b57;
                color: white;
                border: none;
                border-radius: 4px;
                padding: 4px 8px;
                margin-top: 4px;
                cursor: pointer;
                font-size: 11px;
                width: 100%;
            }
            .note-save:hover {
                background-color: #3a8b47;
            }
            `;
            document.head.appendChild(style);
            debugLog('Added styles to the page');
        }

        // Remove debug banner and global UI if they exist
        const debugBanner = document.getElementById('force-indicator');
        if (debugBanner) debugBanner.remove();

        const globalUI = document.getElementById('global-strikes-ui');
        if (globalUI) globalUI.remove();

        // Get all posts and usernames in the timeline
        const userElements = getBlueskyUserElements();
        const usernames = getBlueskyUsernames();

        debugLog('Processing', userElements.length, 'posts with', usernames.length, 'usernames');

        // Add strike UI to each post
        for (let i = 0; i < userElements.length; i++) {
            if (i >= usernames.length) continue;

            const postElement = userElements[i];
            const username = usernames[i];

            if (!username) continue;

            // Make sure the post has position relative for absolute positioning
            postElement.style.position = 'relative';

            const userNote = notes.getNote(username);
            const strikeCount = userNote.strikes;
            const noteText = userNote.note || '';

            debugLog(`User ${username} has ${strikeCount} strikes and note: ${noteText}`);

            // Create strike markers (X emoji)
            let strikeEmojis = "";
            for (let j = 0; j < strikeCount; j++) {
                strikeEmojis += "❌";
            }

            // Create a unique ID for each post UI using the element's position in the DOM
            // This ensures multiple posts from the same user get different UIs
            const postIndex = i;
            const uiId = `skeetshoot-ui-${username.replace(/\./g, '-')}-${postIndex}`;
            let strikeUI = document.getElementById(uiId);

            if (!strikeUI) {
                debugLog(`Creating new UI for ${username} at position ${postIndex}`);

                // Create the UI container
                strikeUI = document.createElement('div');
                strikeUI.id = uiId;
                strikeUI.className = 'skeetshoot-strike-ui';
                strikeUI.style.pointerEvents = 'auto';
                strikeUI.dataset.username = username;

                // Create strike marker
                const markerDiv = document.createElement('div');
                markerDiv.className = 'strike-marker';
                markerDiv.textContent = strikeEmojis;

                // Create strike controls
                const controlsDiv = document.createElement('div');
                controlsDiv.className = 'strike-controls';

                // Add strike button
                const addButton = document.createElement('button');
                addButton.className = 'strike-button add';
                addButton.innerHTML = '❌'; // Using direct emoji
                addButton.title = 'Add strike';
                addButton.dataset.username = username;

                // Remove strike button
                const removeButton = document.createElement('button');
                removeButton.className = 'strike-button remove';
                removeButton.innerHTML = '✅'; // Using direct emoji
                removeButton.title = 'Remove strike';
                removeButton.dataset.username = username;

                // Create note toggle button
                const noteToggleButton = document.createElement('button');
                noteToggleButton.className = 'note-toggle';
                noteToggleButton.textContent = 'Notes';
                noteToggleButton.title = 'Toggle notes for this user';

                // Create notepad container
                const notepadDiv = document.createElement('div');
                notepadDiv.className = 'user-notepad';

                // Create textarea for notes
                const notepadTextarea = document.createElement('textarea');
                notepadTextarea.placeholder = 'Write notes about this user...';
                notepadTextarea.value = noteText;

                // Create save button
                const saveButton = document.createElement('button');
                saveButton.className = 'note-save';
                saveButton.textContent = 'Save Note';

                // Append textarea and save button to notepad
                notepadDiv.appendChild(notepadTextarea);
                notepadDiv.appendChild(saveButton);

                // Append buttons to controls
                controlsDiv.appendChild(removeButton);
                controlsDiv.appendChild(addButton);

                // Append all elements to the strike UI
                strikeUI.appendChild(markerDiv);
                strikeUI.appendChild(controlsDiv);
                strikeUI.appendChild(noteToggleButton);
                strikeUI.appendChild(notepadDiv);

                // Toggle notepad visibility when clicking the toggle button
                noteToggleButton.onclick = function (e) {
                    e.preventDefault();
                    e.stopPropagation();

                    if (notepadDiv.style.display === 'block') {
                        notepadDiv.style.display = 'none';
                        noteToggleButton.textContent = 'Notes';
                        strikeUI.classList.remove('expanded');
                    } else {
                        notepadDiv.style.display = 'block';
                        noteToggleButton.textContent = 'Hide Notes';
                        strikeUI.classList.add('expanded');
                    }

                    return false;
                };

                // Prevent UI from disappearing while typing notes
                notepadTextarea.onfocus = function (e) {
                    strikeUI.classList.add('expanded');
                };

                notepadTextarea.onblur = function (e) {
                    // Only remove expanded class if notes are hidden
                    if (notepadDiv.style.display !== 'block') {
                        strikeUI.classList.remove('expanded');
                    }
                };

                // Save note when clicking the save button
                saveButton.onclick = function (e) {
                    e.preventDefault();
                    e.stopPropagation();

                    const newNote = notepadTextarea.value;
                    notes.setNote(username, newNote, strikeCount);
                    debugLog(`Saved note for ${username}: ${newNote}`);

                    // Give visual feedback
                    saveButton.textContent = 'Saved!';
                    setTimeout(() => {
                        saveButton.textContent = 'Save Note';
                    }, 1000);

                    return false;
                };

                // Add event handlers directly to the buttons
                removeButton.onclick = function (e) {
                    debugLog(`Remove button clicked for ${username}`);
                    e.preventDefault();
                    e.stopPropagation();
                    decrementStrikeCount(username);
                    return false;
                };

                addButton.onclick = function (e) {
                    debugLog(`Add button clicked for ${username}`);
                    e.preventDefault();
                    e.stopPropagation();
                    incrementStrikeCount(username);
                    return false;
                };

                // Ensure no click-through
                strikeUI.onclick = function (e) {
                    e.preventDefault();
                    e.stopPropagation();
                    return false;
                };

                // Add the UI directly to the post
                postElement.appendChild(strikeUI);

                debugLog(`Added strike UI for ${username} at position ${postIndex}`);
            } else {
                // Update the strike marker
                const markerDiv = strikeUI.querySelector('.strike-marker');
                if (markerDiv) {
                    markerDiv.textContent = strikeEmojis;
                }

                // Update the notepad text if it exists
                const notepadTextarea = strikeUI.querySelector('textarea');
                if (notepadTextarea && notepadTextarea.value !== noteText) {
                    notepadTextarea.value = noteText;
                }
            }
        }

        // Clean up any orphaned UIs that might be left over
        document.querySelectorAll('.skeetshoot-strike-ui').forEach(ui => {
            const username = ui.dataset.username;
            if (username) {
                // Check if this UI is still attached to a post element
                const parent = ui.parentElement;
                if (!parent || !parent.querySelector('a[href^="/profile/"]')) {
                    debugLog(`Removing orphaned UI for ${username}`);
                    ui.remove();
                }
            }
        });
    } catch (e) {
        debugLog('Error updating UI:', e);
        console.error(e); // Show full error
    } finally {
        isUpdating = false;
    }
}

// Execute on page load and whenever the DOM changes
debugLog('Setting up Bluesky Strikes extension');

// Initialize with throttled updates
setTimeout(function () {
    populateUI();

    // Set up observer with throttling
    let lastObserverUpdate = 0;
    const OBSERVER_THROTTLE = 2000;

    const observer = new MutationObserver(function (mutations) {
        const now = Date.now();
        if (now - lastObserverUpdate > OBSERVER_THROTTLE) {
            lastObserverUpdate = now;
            populateUI();
        }
    });

    observer.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: false,
        characterData: false
    });

    // Less frequent updates (10 seconds instead of 3) to avoid interrupting typing
    setInterval(populateUI, 10000);
}, 1000); // Delay initial load to ensure page is ready