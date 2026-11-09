# Hourbox

A simple 1-hour time-boxing planner: top 3 priorities, brain dump, parking lot, a daily hour grid (one activity per hour), a month view, and a "Finish day" review with optional reflection.

**Live app:** https://segaldev.github.io/hourbox/

## Where your data lives

This repository holds only the app's code and is public. Your plans are **not** stored here.

They are saved to a JSON file (`hourbox.json`) in a separate **private** repository (`hourbox-data`) in your own GitHub account. Each device connects with a fine-grained access token that:

- can access only the `hourbox-data` repository, and
- has only **Contents: Read and write** permission.

The token is stored only in that device's browser (localStorage) and is sent only to `api.github.com`. The app refuses to connect to a data repo that is public.

## Connecting a device

1. Make sure `hourbox-data` exists and is **private**.
2. Create a token at https://github.com/settings/personal-access-tokens/new
   - Repository access: *Only select repositories* → `hourbox-data`
   - Repository permissions → *Contents*: **Read and write**
3. Open the app, paste the token, and click **Connect**. Do this once per device.

To use it like an app: on a Mac in Safari, **File → Add to Dock**. On an iPhone in Safari, **Share → Add to Home Screen**.

## Running locally

It's a single static `index.html` with no build step. Open it in a browser or serve the folder with any static server.
