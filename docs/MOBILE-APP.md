# XDCNet Mobile App

React Native (Expo) mobile app for monitoring XDC network nodes.

## Prerequisites

- Node.js 18+
- Expo CLI: `npm install -g expo-cli`

## Setup

```bash
cd mobile
npm install
npx expo start
```

Scan the QR code with Expo Go (iOS/Android) or press `i`/`a` for simulators.

## Configuration

Set the dashboard API URL:

```bash
# .env
EXPO_PUBLIC_API_URL=https://your-dashboard.example.com
```

## Screens

### Dashboard
- Lists all monitored nodes with health status indicators
- Pull-to-refresh for live updates
- Tap a node to view details

### Node Detail
- Real-time metrics: CPU, memory, disk, block height, peer count
- Health status indicator

## Project Structure

```
mobile/
├── App.tsx                     # Navigation setup
├── screens/
│   ├── DashboardScreen.tsx     # Node list
│   └── NodeDetailScreen.tsx    # Node metrics
├── package.json
└── tsconfig.json
```

## Building for Production

```bash
# Install EAS CLI
npm install -g eas-cli

# Build for both platforms
eas build --platform all

# Submit to stores
eas submit --platform ios
eas submit --platform android
```

## Roadmap

- [ ] Push notifications for node alerts
- [ ] Historical metrics charts
- [ ] Dark mode
- [ ] Biometric authentication
- [ ] Offline support with local caching
