/** Browser entry point mounting the Big Order journey with a real Web Worker and IndexedDB storage. */
import '../theme.css';
import '../layout.css';
import '../components.css';
import '../company/company.css';
import './journey.css';
import { mountJourneyApp } from './mount';

const root = document.querySelector<HTMLElement>('#app')!;
const live = document.querySelector<HTMLElement>('#announcements')!;
const scenarioParam = new URLSearchParams(location.search).get('scenario');
const initialScenarioId = scenarioParam === 'big-order-tight' ? 'big-order-tight' : 'big-order';

void mountJourneyApp({ root, live, initialScenarioId });
