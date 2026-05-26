export interface Client {
    id: string;
    name: string;
    logo_url?: string | null;
    organization_id: string;
    description?: string;
    notes?: string;
    address?: string;
    general_email?: string;
    general_phone?: string;
    website?: string;
    full_name?: string; // NEW
    // address?: string; // Already exists in line 8
    uid_number?: string; // NEW
}

export interface ClientLog {
    id: string;
    client_id: string;
    author_id: string;
    title: string;
    content: string;
    created_at: string;
    organization_id: string;
    employees?: Employee; // Joined author
}

export interface ClientContact {
    id: string;
    client_id: string;
    name: string;
    email?: string;
    phone?: string;
    role?: string;
    organization_id: string;
}

export type WidgetId = 'favorite_projects' | 'deadlines' | 'assigned_todos' | 'private_todos' | 'resource_planning' | 'time_tracking' | 'calendar';

export interface DashboardWidgetConfig {
    id: WidgetId;
    x: number;
    y: number;
    w: number;
    h: number;
}

export interface DashboardConfig {
    widgets: DashboardWidgetConfig[];
    favoriteProjectIds?: string[];
    has_seen_welcome?: boolean;
    sidebar_items?: SidebarItemId[]; // Reihenfolge + Sichtbarkeit der Sidebar-Items
}

export type SidebarItemId = 'dashboard' | 'projects_overview' | 'global_tasks' | 'resource_planning' | 'time_tracking' | 'kalender' | 'reporting' | 'absences';

export const DEFAULT_SIDEBAR_ITEMS: SidebarItemId[] = [
    'dashboard', 'projects_overview', 'global_tasks', 'resource_planning', 'time_tracking', 'kalender', 'absences'
    // 'reporting' bewusst nicht im default — User kann es in Einstellungen aktivieren
];

export const ALL_SIDEBAR_ITEMS: { id: SidebarItemId; label: string; href: string }[] = [
    { id: 'dashboard', label: 'Mein Bereich', href: '/dashboard' },
    { id: 'projects_overview', label: 'Projekte', href: '/uebersicht' },
    { id: 'global_tasks', label: 'Alle Aufgaben', href: '/aufgaben' },
    { id: 'resource_planning', label: 'Ressourcen', href: '/ressourcen' },
    { id: 'time_tracking', label: 'Zeiterfassung', href: '/zeiterfassung' },
    { id: 'kalender', label: 'Kalender', href: '/kalender' },
    { id: 'absences', label: 'Abwesenheiten', href: '/abwesenheiten' },
    { id: 'reporting', label: 'Reporting', href: '/reporting' },
];

export interface Employee {
    id: string;
    name: string;
    initials: string;
    department_id?: string;
    job_title?: string;
    email?: string;
    role?: 'admin' | 'user';
    is_super_admin?: boolean;
    organization_id?: string;
    user_id?: string;
    hourly_rate?: number;
    weekly_hours?: number; // Legacy — summe von weekly_schedule
    weekly_schedule?: number[]; // [Mo, Di, Mi, Do, Fr, Sa, So] Soll-Stunden pro Tag
    phone?: string;
    avatar_url?: string | null;
    dashboard_config?: DashboardConfig;
    manager_id?: string | null;
    vacation_days_per_year?: number;
    carryover_days?: number;
    started_at?: string | null;
}

// ── Abwesenheiten ─────────────────────────────────────────
export type AbsenceType   = 'vacation' | 'sick' | 'home_office' | 'other';
export type AbsenceStatus = 'requested' | 'approved' | 'rejected' | 'cancelled';
export type AbsenceHalfDay = 'none' | 'start' | 'end';

export interface Absence {
    id: string;
    organization_id: string;
    employee_id: string;
    type: AbsenceType;
    start_date: string;       // YYYY-MM-DD
    end_date:   string;
    half_day: AbsenceHalfDay;
    status: AbsenceStatus;
    reason?: string | null;
    notes?: string | null;
    requested_at: string;
    decided_at?: string | null;
    decided_by?: string | null;
    created_at?: string;
    updated_at?: string;

    // Joined (für Listen-Views)
    employees?: Employee;
}

export interface AbsenceRequest {
    id: string;
    employee_id: string;
    employee_name: string;
    employee_email: string;
    type: AbsenceType;
    start_date: string;
    end_date:   string;
    half_day: AbsenceHalfDay;
    reason?: string | null;
    requested_at: string;
}

export interface VacationBalance {
    year: number;
    yearly_entitlement: number;
    carryover: number;
    total_available: number;
    used_days: number;
    remaining: number;
}

export const ABSENCE_TYPE_LABEL: Record<AbsenceType, string> = {
    vacation:    'Urlaub',
    sick:        'Krankmeldung',
    home_office: 'Homeoffice',
    other:       'Sonstige',
};

export const ABSENCE_TYPE_COLOR: Record<AbsenceType, { bg: string; fg: string; border: string; emoji: string }> = {
    vacation:    { bg: 'rgba(107,114,128,0.18)',  fg: 'rgb(75,85,99)',    border: 'rgba(107,114,128,0.30)', emoji: '🌴' },
    sick:        { bg: 'rgba(59,130,246,0.15)',   fg: 'rgb(30,64,175)',   border: 'rgba(59,130,246,0.25)',  emoji: '🤒' },
    home_office: { bg: 'rgba(245,158,11,0.18)',   fg: 'rgb(120,53,15)',   border: 'rgba(245,158,11,0.30)',  emoji: '🏠' },
    other:       { bg: 'rgba(99,102,241,0.15)',   fg: 'rgb(67,56,202)',   border: 'rgba(99,102,241,0.25)',  emoji: '📌' },
};

export interface Department {
    id: string;
    name: string;
    organization_id: string;
}

export interface Todo {
    id: string;
    project_id?: string | null;
    organization_id: string;
    title: string;
    is_done: boolean;
    assigned_to?: string | null;
    description?: string | null;
    image_urls?: string[];
    parent_id?: string | null;
    employees?: Employee;
    // For global view flattening
    project_title?: string;
    project_status?: string;
    clients?: Client;
    job_number?: string;
    deadline?: string | null;
    created_at?: string;
    order_index?: number;
}

export interface ProjectLog {
    id: string;
    project_id: string;
    organization_id: string;
    title: string;
    content: string;
    image_url?: string | null;
    image_urls?: string[];
    entry_date: string;
    employee_id?: string | null;
    is_public?: boolean;
    projects?: { title: string };
    employees?: Employee; // [NEW] Joined author
}

export interface ProjectLink {
    id: string;
    name: string;
    url: string;
    type: 'pdf' | 'image' | 'video' | 'google_drive' | 'google_doc' | 'server' | 'link' | 'other';
    created_at: string;
}

export interface Project {
    id: string;
    created_at: string;
    title: string;
    job_number: string;
    status: string;
    deadline?: string | null;
    client_id: string;
    project_manager_id?: string | null;
    google_doc_url?: string | null;
    offer_pdf_url?: string | null;
    organization_id: string;
    project_links?: ProjectLink[];
    contract_intro?: string; // NEW
    contract_outro?: string; // NEW
    invoice_contact_id?: string | null; // NEW // NEW

    // Joined data
    clients?: Client;
    employees?: Employee;
    invoice_contact?: ClientContact; // Joined
    todos?: Todo[];

    // Computed
    totalTodos?: number;
    doneTodos?: number;
    openTodosPreview?: Todo[];
    sections?: ProjectSection[];
    positions?: ProjectPosition[];
    invoices?: ProjectInvoice[];
}

export interface ProjectInvoice {
    id: string;
    project_id: string;
    organization_id: string;
    invoice_number: string;
    billing_type: 'full' | 'fraction' | 'positions';
    billing_fraction?: number;
    billed_data: {
        items?: { position_id: string; percentage: number; amount: number }[];
        title: string;
    };
    total_net: number;
    total_tax: number;
    total_gross: number;
    intro_text?: string;
    outro_text?: string;
    invoice_date: string;
    invoice_contact_id?: string | null;
    status: 'draft' | 'final';
    version: number;
    created_at: string;
}

export interface ProjectSection {
    id: string;
    project_id: string;
    title: string;
    description?: string;
    order_index: number;
    positions?: ProjectPosition[]; // Joined
}

export interface ProjectPosition {
    id: string;
    project_id: string;
    section_id?: string;
    position_nr?: string;
    title: string;
    description?: string;
    quantity: number;
    unit: string;
    unit_price: number;
    hourly_rate: number;
    hours_sold: number;
    total_price: number;
    order_index: number;
    is_external?: boolean;
    purchase_price?: number;
}

export interface ResourceAllocation {
    id: string;
    employee_id: string;
    project_id: string;
    year: number;
    week_number: number;
    monday: number;
    tuesday: number;
    wednesday: number;
    thursday: number;
    friday: number;
    comment?: string;
    task_description?: string;
    allocation_status?: string;
    position_id?: string | null;
    projects?: Project;
    positions?: ProjectPosition;
    organization_id: string;
}

export interface TimeEntry {
    id: string;
    project_id: string;
    position_id?: string | null;
    agency_position_id?: string | null; // NEW
    employee_id: string;
    date: string;
    hours: number;
    description?: string;
    created_at?: string;
    // Joined
    projects?: Project;
    positions?: ProjectPosition;
}

// Map for grid: Employee -> Allocations[]
export interface AllocationRow {
    employee: Employee;
    allocations: ResourceAllocation[];
}

export type OrganizationPlan = 'trial' | 'pro' | 'agency' | 'internal';
export type OrganizationStatus = 'active' | 'read_only' | 'suspended';

export interface Organization {
    id: string;
    name: string;
    slug?: string | null;
    industry?: string | null;
    plan: OrganizationPlan;
    status: OrganizationStatus;
    max_employees?: number | null;
    max_projects?: number | null;
    notes?: string | null;
    trial_ends_at?: string | null;
    created_at?: string;
    last_active_at?: string | null;
}

// Aggregierte Sicht für Super-Admin-Übersicht (RPC: get_super_admin_overview)
export interface OrganizationOverview extends Organization {
    employee_count: number;
    project_count: number;
}

export interface OrganizationFeature {
    organization_id: string;
    feature_key: string;
    enabled: boolean;
    expires_at?: string | null;
    updated_at?: string;
    updated_by?: string | null;
}

// Katalog der Feature-Flags — Single Source of Truth fürs UI
export interface FeatureDefinition {
    key: string;
    label: string;
    description: string;
    requiredPlan?: OrganizationPlan; // optionales Plan-Label im UI
    defaultEnabled: boolean;
}

export const FEATURE_CATALOG: FeatureDefinition[] = [
    { key: 'resource_planning', label: 'Ressourcenplanung', description: 'Karten- und Listen-Ansicht für Mitarbeiter-Allokation.', defaultEnabled: true },
    { key: 'calendar_sync',     label: 'Kalender-Sync',     description: 'Google / Outlook / iCal-Integration.', defaultEnabled: true },
    { key: 'reporting',         label: 'Reporting',         description: 'Mitarbeiter- und Projekt-Reporting mit Soll/Ist.', defaultEnabled: true },
    { key: 'calculation',       label: 'Kalkulation & Rechnung', description: 'Angebots- und Rechnungs-PDF, Positionen.', requiredPlan: 'pro', defaultEnabled: true },
    { key: 'pdf_export',        label: 'PDF-Export',        description: 'PDF-Generierung für Angebote/Rechnungen.', requiredPlan: 'pro', defaultEnabled: true },
    { key: 'realtime',          label: 'Realtime-Updates',  description: 'Live-Synchronisierung über mehrere Geräte.', defaultEnabled: true },
    { key: 'client_portal',     label: 'Client-Portal',     description: 'Lesezugriff für Kunden via Token-Link.', requiredPlan: 'agency', defaultEnabled: false },
];

export interface SuperAdminAuditEntry {
    id: number;
    actor_user_id?: string | null;
    actor_email?: string | null;
    action: string;
    target_type?: string | null;
    target_id?: string | null;
    payload?: Record<string, any> | null;
    created_at: string;
}

export interface ImpersonationSession {
    target_org_id: string;
    target_org_name: string;
    started_at: string;
    expires_at: string;
}

export interface RegistrationRequest {
    id: string;
    email: string;
    name: string;
    company_name?: string;
    status: 'pending' | 'approved' | 'rejected';
    created_at: string;
    organization_id?: string;
    organization_name?: string;
}

export type ViewState = 'dashboard' | 'projects_overview' | 'global_tasks' | 'resource_planning' | 'settings';

export interface AgencyPosition {
    id: string;
    title: string;
    hourly_rate: number;
    category?: string;
    organization_id: string;
}

export interface AgencySettings {
    id: string;
    organization_id: string;
    company_name: string;
    address: string;
    website?: string;
    general_email?: string;
    general_phone?: string;
    tax_id: string;
    bank_name: string;
    iban: string;
    bic: string;
    commercial_register: string;
    footer_text: string;
    logo_url: string;
    document_header_url?: string;
    resource_planner_departments?: string[];
    default_tax_rate?: number;
    invoice_number_prefix?: string;
}

export interface OrganizationTemplate {
    id: string;
    organization_id: string;
    name: string;
    content: string;
    type: 'intro' | 'outro';
}

// ── Calendar ────────────────────────────────────────────────

export type CalendarView = 'day' | 'week' | 'month';

export type EventColor = 'blue' | 'violet' | 'rose' | 'green' | 'amber' | 'cyan' | 'slate' | 'red' | 'orange';

export type CalendarEventVisibility = 'public' | 'private';

export type CalendarProviderType = 'ical' | 'google' | 'outlook' | 'apple' | 'troi' | 'teams';

export interface CalendarAttendee {
    name: string;
    email: string;
    employee_id?: string | null;
}

export interface CalendarEvent {
    id: string;
    organization_id: string;
    employee_id: string;
    title: string;
    description?: string | null;
    location?: string | null;
    start_at: string;           // ISO string (UTC)
    end_at: string;             // ISO string (UTC)
    all_day: boolean;
    color: EventColor;
    attendees: CalendarAttendee[];
    visibility?: CalendarEventVisibility;   // 'public' | 'private'
    meeting_url?: string | null;            // Teams / Zoom / Meet link
    source_external_id?: string | null;     // original provider event ID
    target_calendar_id?: string | null;     // push to this external calendar
    created_at?: string;
    // Joined
    employees?: Employee;
}

export interface ExternalCalendar {
    id: string;
    organization_id: string;
    employee_id: string;
    name: string;
    url: string;
    color: string;
    is_visible: boolean;
    provider_type: CalendarProviderType;
    is_writable: boolean;
    external_calendar_id?: string | null;
    caldav_username?: string | null;
    account_label?: string | null;
    last_synced_at?: string | null;
    created_at?: string;
}

export interface ParsedExternalEvent {
    id: string;
    externalCalendarId: string;
    title: string;
    start_at: string;
    end_at: string;
    all_day: boolean;
    color: string;
    calendarName: string;
    description?: string;
    location?: string;
    meeting_url?: string;
    uid?: string;
}

export interface HiddenCalendarEvent {
    id: string;
    organization_id: string;
    employee_id: string;
    event_id?: string | null;
    external_event_uid?: string | null;
    external_calendar_id?: string | null;
    created_at: string;
}
