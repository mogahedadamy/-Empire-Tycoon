/** Maps typed sector choices to replayable operating-project receipts. */
import { loadOperatingProjects } from '../../../../packages/content/src';
import { compareOperatingProperty, quoteFactoryBatch, quoteShipment } from '../../../../packages/operations/src';

export const projects = ['manufacturing', 'logistics', 'property'] as const;
export type Project = typeof projects[number];

export type ProjectChoice =
  | { readonly project: 'manufacturing'; readonly supplierId: string; readonly service: boolean }
  | { readonly project: 'logistics'; readonly routeId: string }
  | { readonly project: 'property'; readonly tenure: 'lease' | 'own'; readonly vacancyBps: number };

export function isProject(value: string | null): value is Project {
  return projects.some((project) => project === value);
}

export const scenario = loadOperatingProjects();

export function defaultChoice(project: Project): ProjectChoice {
  if (project === 'manufacturing') return { project, supplierId: scenario.suppliers[0].id, service: false };
  if (project === 'logistics') return { project, routeId: scenario.routes[0].id };
  return { project, tenure: 'lease', vacancyBps: 2000 };
}

/** Recomputes a preview or confirmed receipt from the shipped input contract. */
export function quoteProject(choice: ProjectChoice) {
  switch (choice.project) {
    case 'manufacturing': {
      const { supplierId, service } = choice;
      const supplier = scenario.suppliers.find(({ id }) => id === supplierId);
      if (!supplier || typeof service !== 'boolean') throw new RangeError('Invalid manufacturing choice');
      return { project: choice.project, quote: quoteFactoryBatch(scenario.factory, supplier, 1, service) } as const;
    }
    case 'logistics': {
      const route = scenario.routes.find(({ id }) => id === choice.routeId);
      if (!route) throw new RangeError('Invalid logistics choice');
      return { project: choice.project, quote: quoteShipment(route, scenario.shipping, scenario.bookings) } as const;
    }
    case 'property': {
      if (choice.tenure !== 'lease' && choice.tenure !== 'own') throw new RangeError('Invalid property choice');
      return { project: choice.project, quote: compareOperatingProperty(scenario.property, choice.vacancyBps) } as const;
    }
    default:
      throw new RangeError('Unknown operating project');
  }
}

export type ProjectReceipt = ReturnType<typeof quoteProject>;
