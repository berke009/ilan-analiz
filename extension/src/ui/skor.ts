export const skorRenk = (s: number): 'yesil' | 'sari' | 'kirmizi' => (s >= 7.5 ? 'yesil' : s >= 5 ? 'sari' : 'kirmizi')
