/**
 * Typen für die Cockpit-Datenquellen. Spiegeln exakt die in der
 * Supabase-DB vorhandenen Views/Tabellen wider (read-only).
 */

/** view v_partner_bestand */
export interface PartnerBestand {
  partner_id: string;
  aktive_kunden: number;
  /** wiederkehrender Bestand (MRR) in € */
  mrr_bestand: number;
  /** monatliche Bestandsprovision in € */
  monatl_bestandsprovision: number;
}

/** view v_partner_earnings */
export interface PartnerEarnings {
  partner_id: string;
  offen_freigegeben: number;
  ausgezahlt: number;
  in_stornoreserve: number;
  /** > 0 ⇒ Override-Anteil ist pausiert */
  override_pausiert: number;
}

/** view v_leaderboard */
export interface LeaderboardRow {
  rank: number;
  partner_id: string;
  display_name: string;
  mrr_bestand: number;
  aktive_kunden: number;
  /** markiert die:den eingeloggte:n Partner:in */
  is_self?: boolean;
}

/** table deals (join customers, products) */
export type DealStage =
  | "neu"
  | "qualifiziert"
  | "angebot"
  | "verhandlung"
  | "gewonnen"
  | "verloren";

export interface Deal {
  id: string;
  customer_name: string;
  product_name: string;
  stage: DealStage;
  /** monatlicher Wert in € (MRR des Deals) */
  mrr_value: number;
  /** Abschluss-Wahrscheinlichkeit 0..100 */
  probability: number;
  expected_close: string | null;
  updated_at: string;
}

/** view v_override_eligibility + career_levels */
export interface OverrideEligibility {
  partner_id: string;
  own_active: number;
  active_direct_count: number;
  min_active_directs: number;
}

export interface CareerLevel {
  level: number;
  name: string;
  /** benötigte aktive Direktpartner für diese Stufe */
  min_active_directs: number;
  /** benötigter eigener aktiver Bestand (Kunden) */
  min_own_active: number;
}

export interface CareerState {
  current: CareerLevel;
  next: CareerLevel | null;
  own_active: number;
  active_direct_count: number;
}

/** partners where upline_id = own id */
export interface DownlinePartner {
  partner_id: string;
  display_name: string;
  aktive_kunden: number;
  mrr_bestand: number;
  is_active: boolean;
  joined_at: string;
}

/** aus table commissions: closer_recurring je Monat */
export interface BestandPoint {
  /** ISO-Monat, z.B. "2026-06" */
  period: string;
  /** Label für die Achse, z.B. "Jun" */
  label: string;
  /** monatliche Bestandsprovision in € */
  amount: number;
}

/** Bündel aller Cockpit-Daten für die:den eingeloggte:n Partner:in */
export interface CockpitData {
  partner: {
    id: string;
    display_name: string;
    email: string;
  };
  bestand: PartnerBestand;
  earnings: PartnerEarnings;
  bestandsverlauf: BestandPoint[];
  pipeline: Deal[];
  career: CareerState;
  override: OverrideEligibility;
  leaderboard: LeaderboardRow[];
  downline: DownlinePartner[];
}
