export interface Coffee {
  id: number;
  code: string;
  name: string;
  description: string;
  fullStory: string;
  origin: string;
  farm: string;
  region: string;
  country: string;
  variety: string;
  altitude: string;
  producer: string;
  tastesLike: string[];
  processing: string;
  roastProfile: string;
  category: string;
  pricing: {
    "125g": number;
    "250g": number;
    "1kg": number;
  };
  sizeAvailability: {
    "125g": boolean;
    "250g": boolean;
    "1kg": boolean;
  };
  available: boolean;
  roastOptions: string[];
  image: string;
}