// =====================================================================
// TYPE DEFINITIONS FOR FREESHARE INDIA
// =====================================================================

export type ListingCategory =
  | 'Furniture'
  | 'Electronics'
  | 'Books'
  | 'Clothing'
  | 'Toys'
  | 'Kitchen'
  | 'Appliances'
  | 'Sports'
  | 'Office'
  | 'Miscellaneous';

export type ItemCondition = 'Like New' | 'Good' | 'Fair' | 'Needs Repair';

export type ListingType = 'item' | 'skill';

export type SkillCategory =
  | 'Teaching'
  | 'Repair'
  | 'Creative'
  | 'Fitness'
  | 'Tech Help'
  | 'Cooking'
  | 'Language'
  | 'Other';

export type SkillDuration = '15 min' | '30 min' | '1 hour' | 'Flexible';

export type ListingStatus = 'available' | 'reserved' | 'completed' | 'removed';

export type ClaimStatus =
  | 'pending'
  | 'accepted'
  | 'declined'
  | 'expired'
  | 'completed'
  | 'cancelled';

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  avatar_url?: string;
  date_of_birth: string;
  city: string;
  area: string;
  pincode?: string;
  bio?: string;
  phone?: string;
  show_phone?: boolean;
  trust_score: number;
  total_donated: number;
  total_received: number;
  monthly_claim_count: number;
  is_premium: boolean;
  strike_count: number;
  is_verified: boolean;
  is_ngo: boolean;
  is_admin: boolean;
  created_at: string;
}

export interface Listing {
  id: string;
  donor_id: string;
  title: string;
  description: string;
  category: ListingCategory | SkillCategory;
  condition?: ItemCondition;
  images: string[];
  city: string;
  area: string;
  landmark?: string;
  pincode?: string;
  status: ListingStatus;
  receiver_preference: 'all' | 'ngo_only' | 'high_trust';
  active_claim_id?: string;
  view_count: number;
  listing_type?: ListingType;
  skill_duration?: SkillDuration;
  skill_tags?: string[];
  created_at: string;
  completed_at?: string;
}

export interface Claim {
  id: string;
  listing_id: string;
  receiver_id: string;
  donor_id: string;
  message: string;
  status: ClaimStatus;
  accepted_at?: string;
  expires_at?: string;
  created_at: string;
}

export interface ChatMessage {
  id: string;
  claim_id: string;
  sender_id: string;
  content: string;
  image_url?: string;
  is_read: boolean;
  created_at: string;
}
