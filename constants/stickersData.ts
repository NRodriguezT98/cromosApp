import data from './stickersData.json';

export const rawStickersData = data as {
  stickers: Array<{
    albumNumber: number;
    code: string;
    section: string;
    name: string;
    teamCode: string;
    teamName: string;
    isoCode: string | null;
    type: 'player' | 'team_logo' | 'team_photo' | 'special';
    foil: boolean;
    quantity: number;
  }>;
  sections: Array<{
    code: string;
    name: string;
    isoCode: string | null;
    total: number;
    group: string | null;
  }>;
};
