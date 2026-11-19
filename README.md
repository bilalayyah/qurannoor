<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://ai.google.dev/static/site-assets/images/share-ais-513315318.png" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/0cbf296b-c7f7-4337-a47d-025e89106fbc

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. (Optional) Set `QURAN_CLIENT_ID` and `QURAN_CLIENT_SECRET` in [.env.local](.env.local) for the authenticated Quran Foundation API — when omitted, the server falls back to the official public API v4 endpoint (see [.env.example](.env.example))
3. Run the app:
   `npm run dev`
