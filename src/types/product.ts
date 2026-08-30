export type Brand = "legendary" | "everyday";
export type Category = "coffee" | "apparel" | "merch" | "gear" | "machines";
export type RoastStyle = "bold" | "balanced" | "gentle";

export interface CoffeeDetails {
  process: string;
  variety: string;
  elevation_m: number;
  origin: string;
  roast_style: RoastStyle;
  flavor_notes: string[];
  flavor_refs?: { gid: string; name: string }[];
  flavor_metafield?: { namespace: string; key: string; type: string };
  flavor_metaobject_type?: string;
  grind_options: ("whole" | "espresso" | "filter")[];
  weight_options_g: number[];
  subscriptionEligible: boolean;
  limitedRelease: boolean;
  benQuote: string;
  country?: string;
  caffeine_content?: string;
  coffee_roast?: string;
  grind_size?: string;
  producer?: string;
  harvest?: string;
}

export interface ApparelOrMerch {
  sizes: ("S" | "M" | "L" | "XL")[];
  material: string;
  color: string;
}

export interface GearOrMachine {
  power?: string;
  dimensions: string;
  starterFriendly: boolean;
}

export interface Product {
  id: string;
  slug: string;
  name: string;
  brand: Brand;
  category: Category;
  price: number;
  images: string[];
  badges: string[];
  description?: string;
  coffee?: CoffeeDetails;
  apparelOrMerch?: ApparelOrMerch;
  gearOrMachine?: GearOrMachine;
  featured?: boolean;
  bensPick?: boolean;
  variantId?: string;
  options?: Array<{ id?: number; name: string; values: string[]; position?: number }>;
  variants?: Array<{
    id: string;
    title: string;
    price: number;
    type?: string;
    sku?: string;
    option1?: string | null;
    option2?: string | null;
    option3?: string | null;
    inventory_quantity?: number;
  }>;
}

export interface CartItem {
  product: Product;
  quantity: number;
  selectedGrind?: string;
  selectedWeight?: number;
  selectedSize?: string;
  isSubscription?: boolean;
  subscriptionFrequency?: "weekly" | "biweekly" | "monthly";
}

export interface FeaturedSection {
  title: string;
  subtitle: string;
  products: string[]; // Product IDs
}

export interface VideoEmbed {
  id: string;
  title: string;
  embedUrl: string;
  thumbnail: string;
  category: string;
}