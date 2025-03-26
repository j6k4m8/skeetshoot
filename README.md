# Bluesky Strikes

A Firefox extension that gives your [BlueSky](https://bsky.app) timeline a "strike" feature, allowing you to keep track of who's posting things you don't like, without unfollowing them immediately.

This extension also allows you to add personal notes about users, so you can remember why you added a strike in the first place.

## Features

-   Add "strikes" to users in your Bluesky timeline
-   ~~After three strikes, users are automatically unfollowed~~ (HELP IDK HOW TO DO THIS)
-   Add notes about users for future reference
-   Unobtrusive UI that appears only when needed

## Installation

<a href="https://github.com/j6k4m8/skeetshoot/releases/latest/download/bluesky_strikes.xpi">
  <img src="https://img.shields.io/badge/Install%20for%20Firefox-FF7139?style=for-the-badge&logo=firefox-browser&logoColor=white" alt="Install for Firefox" />
</a>

## How to Use

1. Browse your Bluesky timeline
2. When you see a post from a user who posts something you don't like, click the ❌ button to add a strike
3. If you change your mind, click the ✅ button to remove a strike
4. ~~After three strikes, the user will be automatically unfollowed~~ HELP IDK HOW TO DO THIS
5. Click the "Notes" button to add personal notes about a user

## Development

### Prerequisites

-   Firefox Developer Edition or Firefox Browser
-   Git

### Local Development

1. Clone the repository:

    ```bash
    git clone https://github.com/j6k4m8/skeetshoot.git
    cd skeetshoot
    ```

2. Load the extension in Firefox:

    - Navigate to `about:debugging` in Firefox
    - Click "This Firefox"
    - Click "Load Temporary Add-on..."
    - Select the `manifest.json` file from your cloned repository

3. Test the extension on Bluesky (https://bsky.app)

## License

Apache License 2.0

## Credits

Based on the original [Tweet Strikes](https://github.com/j6k4m8/tweet-strikes) extension by [@j6k4m8](https://github.com/j6k4m8).
