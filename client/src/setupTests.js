import '@testing-library/jest-dom';

// Polyfill for TextEncoder/TextDecoder (required by react-router-dom in Jest)
import { TextEncoder, TextDecoder } from 'util';

global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;


