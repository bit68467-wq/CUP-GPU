import { MockBackend } from './mockBackend.js';
import { RealBackend } from './realBackend.js';

const API_BASE = window.CUP9_API_BASE || null;

/* tombstone: large mock/real backend implementations moved to mockBackend.js and realBackend.js */
export const API = API_BASE ? RealBackend : MockBackend;