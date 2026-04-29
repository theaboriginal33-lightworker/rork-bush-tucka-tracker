export type PinCategory = 'finding' | 'spot' | 'recipe';

export type CommunityPin = {
  id: string;
  title: string;
  description: string;
  category: PinCategory;
  latitude: number;
  longitude: number;
  createdAt: string;
  imageUri?: string;
  tags: string[];
  author: string;
};
