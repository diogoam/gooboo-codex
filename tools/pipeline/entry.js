import { newGame } from '../gooboo/src/js/init.js';
import store from '../gooboo/src/store/index.js';
import en from '../gooboo/src/lang/en.js';
globalThis.__store = store; globalThis.__en = en; globalThis.__newGame = newGame;
