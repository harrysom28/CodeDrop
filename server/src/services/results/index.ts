import { config } from '../../config.js';
import { noResultsYet, type ResultsProvider } from '../settle.js';
import { apiFootballProvider } from './apiFootball.js';

export function buildResultsProvider(): ResultsProvider {
  if (config.API_FOOTBALL_KEY) {
    return apiFootballProvider({ apiKey: config.API_FOOTBALL_KEY });
  }
  return noResultsYet;
}
