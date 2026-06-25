# Local Meetup

Mobile Meetup prototype with a live map, searchable places, draggable meetup sheet, attendee avatars and a configurable meetup radar.

## Local preview

Open `index.html` in a browser for the current prototype preview.

For the packaged Capacitor web assets:

```bash
npm install
npm run build
```

## iOS via Codemagic

This project is prepared for Codemagic with `codemagic.yaml`.

1. Push this folder to GitHub.
2. In Codemagic, add a new application and connect the GitHub repository.
3. Select the `ios-simulator` workflow.
4. Start a build.

The current workflow creates an unsigned iOS Simulator `.app`. For TestFlight or App Store builds, add Apple Developer signing in Codemagic and switch the build step to an IPA export.

## App IDs

Capacitor app id: `com.timbo2701.localmeetup`

App name: `Local Meetup`
