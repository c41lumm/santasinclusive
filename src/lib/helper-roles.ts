/** What each kind of helper can do, as shown on the Dashboard and each helper's page */
export const roleChoices = [
  { value: 'admin', label: 'Admin', hint: 'Everything, including adding helpers' },
  { value: 'lead_elf', label: 'Lead elf', hint: 'Runs the day: bookings, toys and the rota' },
  { value: 'elf', label: 'Elf', hint: 'The elf app on the day' },
  { value: 'santa', label: 'Santa', hint: 'Santa’s cards for each visit' },
];
export const roleLabel = (r: string) => roleChoices.find((c) => c.value === r)?.label ?? r;
