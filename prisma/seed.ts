import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { normalizeMobile } from '../src/utils/lead';

const prisma = new PrismaClient();
const institutes = [
  'Northstar Learning Hub', 'BrightPath Coaching Centre', 'CodeSpring Computer Institute',
  'Pinnacle Scholars Academy', 'Maple Leaf Tutorials', 'Summit Edge Institute',
  'Bluebird Learning Studio', 'Cedar Grove Academy', 'Futurewise Coaching Centre',
  'OpenBook Learning House',
];
const owners = ['Aarav Mehta', 'Ananya Rao', 'Kabir Shah', 'Diya Nair', 'Ishaan Gupta', 'Mira Joshi', 'Rohan Das', 'Sara Khan', 'Vivaan Iyer', 'Tara Menon'];
const locations = ['Pune', 'Bengaluru', 'Hyderabad', 'Jaipur', 'Delhi', 'Chennai', 'Kochi', 'Ahmedabad', 'Indore', 'Mumbai'];
const instituteTypes = ['COACHING_CENTRE', 'COMPUTER_INSTITUTE', 'COLLEGE', 'SCHOOL', 'OTHER'] as const;
const sources = ['COLD_CALLING', 'REFERRAL', 'WHATSAPP', 'WEBSITE', 'LINKEDIN', 'WALK_IN', 'OTHER'] as const;
const statuses = ['NEW', 'CONTACTED', 'INTERESTED', 'DEMO_SCHEDULED', 'PILOT', 'CUSTOMER', 'NOT_INTERESTED', 'LOST'] as const;

async function main() {
  const creator = await prisma.user.findFirst({ where: { isActive: true, role: 'SUPERADMIN' }, orderBy: { createdAt: 'asc' } });
  if (!creator) throw new Error('Create the first superadmin with `npm run admin:create` before seeding demo leads.');

  const demoLeads = Array.from({ length: 100 }, (_, index) => {
    const number = index + 1;
    const phoneSuffix = String(index).padStart(2, '0');
    const mobileNumber = `+1 202-555-01${phoneSuffix}`;
    const status = statuses[index % statuses.length]!;
    const createdAt = new Date(Date.now() - (99 - index) * 24 * 60 * 60 * 1000);
    return {
      instituteName: `${institutes[index % institutes.length]} ${String(number).padStart(3, '0')}`,
      ownerName: owners[index % owners.length]!,
      mobileNumber,
      normalizedMobileNumber: normalizeMobile(mobileNumber),
      location: locations[index % locations.length]!,
      instituteType: instituteTypes[index % instituteTypes.length]!,
      source: sources[index % sources.length]!,
      status,
      hasBeenCalled: status !== 'NEW',
      remarks: 'Demo record only. Fictional 555-01xx phone number; do not call.',
      onboardingStatus: status === 'CUSTOMER' ? 'COMPLETED' as const : 'NOT_STARTED' as const,
      convertedAt: status === 'CUSTOMER' ? createdAt : null,
      createdById: creator.id,
      createdAt,
      updatedAt: createdAt,
    };
  });

  const mobileNumbers = demoLeads.map(lead => lead.normalizedMobileNumber);
  const existing = await prisma.lead.findMany({
    where: { normalizedMobileNumber: { in: mobileNumbers } },
    select: { normalizedMobileNumber: true },
  });
  const existingNumbers = new Set(existing.map(lead => lead.normalizedMobileNumber));
  const newLeads = demoLeads.filter(lead => !existingNumbers.has(lead.normalizedMobileNumber));
  if (newLeads.length) await prisma.lead.createMany({ data: newLeads });
  console.log(`Inserted ${newLeads.length} demo leads; ${existingNumbers.size} were already present.`);
}
main().catch(error => { console.error(error instanceof Error ? error.message : 'Unable to seed demo leads.'); process.exitCode = 1; }).finally(() => prisma.$disconnect());
