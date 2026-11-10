import {unlockSite} from './access.js';
import './interface-sound.js';
await unlockSite();
await import('./app.js');
