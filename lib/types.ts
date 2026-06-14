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

/**
 * view v_leaderboard (partner_id, full_name, level_id, mrr_bestand, provision_90d).
 * `rank` wird clientseitig aus der Sortierung nach mrr_bestand abgeleitet.
 */
export interface LeaderboardRow {
  rank: number;
  partner_id: string;
  full_name: string;
  level_id: number | null;
  mrr_bestand: number;
  /** Provision der letzten 90 Tage in € */
  provision_90d: number;
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

/**
 * view v_override_eligibility
 * (partner_id, level_id, override_levels, min_active_directs,
 *  active_direct_count, own_active).
 */
export interface OverrideEligibility {
  partner_id: string;
  level_id: number | null;
  /** Tiefe, über die der Override läuft */
  override_levels: number;
  min_active_directs: number;
  active_direct_count: number;
  /** eigene aktive Bestandskunden */
  own_active: number;
}

/**
 * career_levels (Stufenplan laut Provisionsordnung §2). Der Aufstieg ist
 * struktur-/leistungsbasiert; die Stufe schaltet die Override-Ebenen frei.
 */
export interface CareerLevel {
  level: number;
  name: string;
  /** freigeschaltete Override-Ebenen (RSG Partner 0 · Senior 1 · Director/Equity 2) */
  override_levels: number;
}

export interface CareerState {
  current: CareerLevel;
  next: CareerLevel | null;
  /** aktive Direktpartner:innen (aus v_override_eligibility) */
  active_direct_count: number;
  /** Schwelle der aktuellen Stufe für aktiven Override (§6 Mindestaktivität) */
  min_active_directs: number;
}

/** partners where upline_id = own id, Bestand via Join auf v_partner_bestand */
export interface DownlinePartner {
  partner_id: string;
  full_name: string;
  aktive_kunden: number;
  mrr_bestand: number;
  is_active: boolean;
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

/** table customers (join products) für die:den Partner:in */
export type CustomerStatus = "aktiv" | "onboarding" | "storno_reserve" | "gekuendigt";

export interface CustomerRow {
  id: string;
  name: string;
  product_name: string;
  /** monatlicher Umsatz (MRR) in € */
  mrr: number;
  /** monatliche Bestandsprovision (17 % MRR) in € */
  bestandsprovision: number;
  status: CustomerStatus;
  /** Vertragsbeginn (ISO) */
  since: string;
  /** Monate ungekündigter Laufzeit (für Stornoreserve-Freigabe nach 6) */
  laufzeit_monate: number;
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
  /** Provision im laufenden Monat (commissions, Status offen/freigegeben) */
  provisionAktuellerMonat: number;
  bestandsverlauf: BestandPoint[];
  pipeline: Deal[];
  customers: CustomerRow[];
  career: CareerState;
  override: OverrideEligibility;
  leaderboard: LeaderboardRow[];
  downline: DownlinePartner[];
}
