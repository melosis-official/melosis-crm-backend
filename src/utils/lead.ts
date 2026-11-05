export const normalizeMobile = (value: string) => value.replace(/\D/g, '').replace(/^0+/, '');
export const publicLeadSelect = {
  id: true, instituteName: true, ownerName: true, mobileNumber: true, email: true,
  location: true, instituteType: true, source: true, status: true, hasBeenCalled: true,
  remarks: true, onboardingStatus: true, convertedAt: true, customerNotes: true,
  createdAt: true, updatedAt: true, archivedAt: true,
} as const;
