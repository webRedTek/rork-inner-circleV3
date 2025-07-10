# RevenueCat Integration Setup Guide

This guide will help you set up RevenueCat for subscription management in the Inner Circle Connect app.

## 1. RevenueCat Dashboard Setup

### Create RevenueCat Account
1. Go to [RevenueCat Dashboard](https://app.revenuecat.com)
2. Sign up for a free account
3. Create a new project for "Inner Circle Connect"

### Configure App Settings
1. In the RevenueCat dashboard, go to **Project Settings**
2. Add your iOS app:
   - Bundle ID: `com.innercircle.myapp` (from app.json)
   - App Store Connect API Key (optional but recommended)
3. Add your Android app:
   - Package Name: `com.innercircle.myapp` (from app.json)
   - Google Play Service Account Key (optional but recommended)

## 2. Product Configuration

### Create Products in App Store Connect (iOS)
1. Go to App Store Connect
2. Create the following in-app purchases:
   - **silver_monthly**: Silver Monthly Subscription ($14.99/month)
   - **silver_annual**: Silver Annual Subscription ($149.99/year)
   - **gold_monthly**: Gold Monthly Subscription ($29.99/month)
   - **gold_annual**: Gold Annual Subscription ($299.99/year)

### Create Products in Google Play Console (Android)
1. Go to Google Play Console
2. Create the following subscriptions:
   - **silver_monthly**: Silver Monthly Subscription ($14.99/month)
   - **silver_annual**: Silver Annual Subscription ($149.99/year)
   - **gold_monthly**: Gold Monthly Subscription ($29.99/month)
   - **gold_annual**: Gold Annual Subscription ($299.99/year)

### Configure Products in RevenueCat
1. In RevenueCat dashboard, go to **Products**
2. Add each product with the same identifiers as above
3. Create **Entitlements**:
   - `silver_access`: For Silver tier features
   - `gold_access`: For Gold tier features
4. Create **Offerings**:
   - Default offering with all packages

## 3. API Keys Configuration

### Get API Keys
1. In RevenueCat dashboard, go to **API Keys**
2. Copy the **Public SDK Key** for iOS
3. Copy the **Public SDK Key** for Android

### Update App Configuration
1. Open `store/subscription-store.ts`
2. Replace the placeholder API keys:

```typescript
const REVENUECAT_CONFIG = {
  ios: 'appl_YOUR_ACTUAL_IOS_API_KEY_HERE',
  android: 'goog_YOUR_ACTUAL_ANDROID_API_KEY_HERE',
};
```

## 4. Testing Setup

### iOS Testing
1. Create a sandbox tester account in App Store Connect
2. Sign out of your Apple ID on the device
3. When prompted during purchase, sign in with sandbox account
4. Test purchases will be free and won't charge real money

### Android Testing
1. Add test accounts in Google Play Console
2. Upload a signed APK to Internal Testing track
3. Add testers to the Internal Testing track
4. Test purchases will be free for test accounts

## 5. Entitlements Mapping

The app maps RevenueCat entitlements to membership tiers:

- **bronze**: Free tier (no entitlements needed)
- **silver**: Requires `silver_access` entitlement
- **gold**: Requires `gold_access` entitlement

### Configure Entitlements in RevenueCat
1. Go to **Entitlements** in RevenueCat dashboard
2. Create entitlements:
   - `silver_access`: Attach silver_monthly and silver_annual products
   - `gold_access`: Attach gold_monthly and gold_annual products

## 6. Webhook Configuration (Optional)

For server-side validation and user management:

1. In RevenueCat dashboard, go to **Integrations**
2. Add webhook URL: `https://your-backend-url.com/webhooks/revenuecat`
3. Select events to send (subscription events)
4. Implement webhook handler in your backend

## 7. Production Checklist

Before going live:

- [ ] Products created in App Store Connect and Google Play Console
- [ ] Products configured in RevenueCat dashboard
- [ ] Entitlements properly mapped
- [ ] API keys updated in app code
- [ ] Tested with sandbox/test accounts
- [ ] App Store and Google Play app listings updated
- [ ] Privacy policy updated to mention subscriptions
- [ ] Terms of service updated

## 8. Troubleshooting

### Common Issues

**"No offerings available"**
- Check that products are approved in App Store Connect/Google Play Console
- Verify products are added to RevenueCat dashboard
- Ensure API keys are correct

**"Product not available for purchase"**
- Product might not be approved yet
- Check product identifiers match exactly
- Verify app bundle ID matches

**"Purchase cancelled"**
- Normal user behavior, no action needed
- Make sure not to show error for cancelled purchases

### Debug Mode
The app includes debug logging for subscription events. Check the debug screen in the app for detailed logs.

## 9. Support

- [RevenueCat Documentation](https://docs.revenuecat.com/)
- [RevenueCat Community](https://community.revenuecat.com/)
- [App Store Connect Help](https://help.apple.com/app-store-connect/)
- [Google Play Console Help](https://support.google.com/googleplay/android-developer/)