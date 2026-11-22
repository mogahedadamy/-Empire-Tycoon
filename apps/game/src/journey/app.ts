/** Browser entry point mounting the Big Order journey with a real Web Worker and IndexedDB storage. */
import '../theme.css';
import '../layout.css';
import '../components.css';
import '../company/company.css';
import './journey.css';
import { createJourneyPerformance } from '../platform/performance';
import { mountJourneyApp } from './mount';

const root = document.querySelector<HTMLElement>('#app')!;
const live = document.querySelector<HTMLElement>('#announcements')!;
const params = new URLSearchParams(location.search);
const scenarioParam = params.get('scenario');
const initialScenarioId = scenarioParam === 'big-order-tight' ? 'big-order-tight' : 'big-order';

const performance = params.get('performance') === '1' ? createJourneyPerformance() : undefined;
void mountJourneyApp({ root, live, initialScenarioId, performance });
