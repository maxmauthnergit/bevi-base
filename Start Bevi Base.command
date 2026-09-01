#!/bin/bash
# Double-click this file in Finder to start the local development server.
# It installs whatever is missing on first run and opens the browser for you.

cd "$(dirname "$0")" || exit 1

npm run dev

# `npm run dev` only returns once the server is stopped or something went wrong.
# Keep the window open so the message stays readable.
echo
read -n 1 -s -r -p "Press any key to close this window."
