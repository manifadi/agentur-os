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

export type SidebarItemId = 'dashboard' | 'projects_overview' | 'global_tasks' | 'resource_planning' | 'time_tracking' | 'kalender' | 'reporting';

export const DEFAULT_SIDEBAR_ITEMS: SidebarItemId[] = [
    'dashboard', 'projects_overview', 'global_tasks', 'resource_planning', 'time_tracking', 'kalender'
    // 'reporting' bewusst nicht im default — User kann es in Einstellungen aktivieren
];

export const ALL_SIDEBAR_ITEMS: { id: SidebarItemId; label: string; href: string }[] = [
    { id: 'dashboard', label: 'Mein Bereich', href: '/dashboard' },
    { id: 'projects_overview', label: 'Projekte', href: '/uebersicht' },
    { id: 'global_tasks', label: 'Alle Aufgaben', href: '/aufgaben' },
    { id: 'resource_planning', label: 'Ressourcen', href: '/ressourcen' },
    { id: 'time_tracking', label: 'Zeiterfassung', href: '/zeiterfassung' },
    { id: 'kalender', label: 'Kalender', href: '/kalender' },
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
    organization_id?: string;
    user_id?: string;
    hourly_rate?: number;
    weekly_hours?: number; // Legacy — summe von weekly_schedule
    weekly_schedule?: number[]; // [Mo, Di, Mi, Do, Fr, Sa, So] Soll-Stunden pro Tag
    phone?: string;
    avatar_url?: string | null;
    dashboard_config?: DashboardConfig;
}

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

export interface Organization {
    id: string;
    name: string;
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
