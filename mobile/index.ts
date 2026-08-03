import { registerRootComponent } from 'expo';
import { createElement } from 'react';

import App from './App';
import { ErrorBoundary } from './src/components/ErrorBoundary';

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
//
// ErrorBoundary phai boc NGOAI App thi moi bat duoc loi xay ra ben trong App.
// Dung createElement vi file nay la .ts (khong viet duoc JSX).
registerRootComponent(() => createElement(ErrorBoundary, null, createElement(App)));
