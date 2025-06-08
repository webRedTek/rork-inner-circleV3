# Deploying to Expo EAS

This guide explains how to deploy your app using Expo Application Services (EAS).

## Prerequisites

1. Make sure you have an Expo account and are logged in:
   ```
   npx expo login
   ```

2. Initialize your EAS project (if not already done):
   ```
   npm run eas-init
   ```
   
   This will create a project ID in your Expo account and update your app.json file.

## Building Your App

### Preview Builds

Preview builds are for testing and can be installed on your device:

```
# Build for both platforms
npm run eas-build

# Build for specific platform
npm run eas-build-android
npm run eas-build-ios
```

### Production Builds

For app store submission:

```
npm run eas-deploy
```

## Updating Your App

You can push updates to your app without submitting a new build to the app stores:

```
npm run eas-update
```

## Configuration

The EAS configuration is in:
- `eas.json` - Build profiles and settings
- `app.json` - App metadata and configuration

## Troubleshooting

If you encounter errors:

1. Make sure you're logged in to Expo CLI
2. Verify your app.json has the correct projectId in the extra.eas section
3. Check that your package.json and app.json versions match
4. For build errors, check the EAS build logs in the Expo dashboard

For more help, visit the [Expo documentation](https://docs.expo.dev/build/introduction/).